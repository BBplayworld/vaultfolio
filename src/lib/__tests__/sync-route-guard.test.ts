import { describe, it, expect, beforeEach, vi } from "vitest";

import { deriveKeys, generateAssetId, randomNonce, sha256Hex, signMessage, toBase64, toBase64Url } from "@/lib/cloud-sync/crypto";
import { SYNC_AUTH_HEADER } from "@/lib/cloud-sync/config";

// /api/sync 남용 방어(#97) 회귀 — 메모리 저장소 목으로 라우트를 직접 호출한다.
// 정상 다기기 pull·폴링·push·409 충돌 흐름이 막히지 않고, 헤더 위조·잘못된 assetId는 저장소 호출 전 거부되는지 검증.

interface Env { pubKey: string; iv: string; ciphertext: string; version: number; updatedAt: string }
const store = new Map<string, Env>();
const spies = { getEnvelope: vi.fn(), checkRateLimit: vi.fn() };
const putCounters = new Map<string, number>();

vi.mock("@/lib/cache-storage", () => ({
  getCacheStorage: () => ({
    getAssetEnvelope: async (id: string) => {
      spies.getEnvelope(id);
      return store.get(id) ?? null;
    },
    // 운영 저장소와 같은 규칙: IP당 분당 10회
    checkRateLimit: async (ip: string) => {
      spies.checkRateLimit(ip);
      const n = (putCounters.get(ip) ?? 0) + 1;
      putCounters.set(ip, n);
      return n <= 10;
    },
    compareAndSetAssetEnvelope: async (id: string, base: number, v: { pubKey: string; iv: string; ciphertext: string }) => {
      const cur = store.get(id);
      const curVer = cur?.version ?? 0;
      if (curVer !== base) return { ok: false, currentVersion: curVer };
      store.set(id, { ...v, version: curVer + 1, updatedAt: new Date().toISOString() });
      return { ok: true, version: curVer + 1 };
    },
  }),
}));

import { GET, PUT } from "@/app/api/sync/route";

let ipSeq = 0;
const uniqueIp = () => `10.9.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;

async function token(method: "GET" | "PUT", assetId: string, privKey: Uint8Array, extra: (string | number)[] = []) {
  const ts = Math.floor(Date.now() / 1000);
  const nonce = randomNonce();
  const sig = await signMessage([method, assetId, ...extra, ts, nonce].join("|"), privKey);
  return toBase64Url(new TextEncoder().encode(JSON.stringify({ assetId, ts, nonce, sig })));
}

function rawToken(obj: unknown) {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(obj)));
}

async function doGet(auth: string, ip: string, meta = false) {
  return GET(new Request(`http://a.test/api/sync${meta ? "?meta=1" : ""}`, {
    headers: { [SYNC_AUTH_HEADER]: auth, "x-vercel-forwarded-for": ip },
  }));
}

async function doPut(assetId: string, keys: Awaited<ReturnType<typeof deriveKeys>>, baseVersion: number, ip: string, withPubKey = false) {
  const iv = "aXY=";
  const ciphertext = toBase64(new TextEncoder().encode("ct" + baseVersion + Math.random()));
  const h = await sha256Hex(ciphertext);
  const auth = await token("PUT", assetId, keys.privKey, [baseVersion, h]);
  return PUT(new Request("http://a.test/api/sync", {
    method: "PUT",
    headers: { [SYNC_AUTH_HEADER]: auth, "x-vercel-forwarded-for": ip, "content-type": "application/json" },
    body: JSON.stringify({ iv, ciphertext, baseVersion, ...(withPubKey ? { pubKey: toBase64(keys.pubKey) } : {}) }),
  }));
}

describe("/api/sync 방어", () => {
  let assetId: string;
  let keys: Awaited<ReturnType<typeof deriveKeys>>;

  beforeEach(async () => {
    store.clear();
    putCounters.clear();
    spies.getEnvelope.mockClear();
    spies.checkRateLimit.mockClear();
    assetId = generateAssetId();
    keys = await deriveKeys("test-passphrase-1", assetId);
  });

  it("정상 흐름: 신규 등록 → pull → meta 폴링 → 후행 기기 409 → pull 후 재push", async () => {
    const ip = uniqueIp();
    expect((await doPut(assetId, keys, 0, ip, true)).status).toBe(200);
    expect((await doGet(await token("GET", assetId, keys.privKey), ip)).status).toBe(200);
    const meta = await doGet(await token("GET", assetId, keys.privKey), ip, true);
    expect((await meta.json()).version).toBe(1);
    // 다른 기기가 v1에서 push → v2, 기존 기기(base 1)가 stale base로 push하면 409
    expect((await doPut(assetId, keys, 1, ip)).status).toBe(200);
    const conflict = await doPut(assetId, keys, 1, ip);
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).asset.version).toBe(2);
    expect((await doPut(assetId, keys, 2, ip)).status).toBe(200);
  });

  it("정상 다기기: 4기기 x 분당 폴링+포커스(기기당 ≈6회)가 한 IP에서 몰려도 429 없음", async () => {
    const ip = uniqueIp();
    await doPut(assetId, keys, 0, ip, true);
    for (let i = 0; i < 4 * 6; i++) {
      const r = await doGet(await token("GET", assetId, keys.privKey), ip, true);
      expect(r.status).toBe(200);
    }
  });

  it("GET 폭주는 같은 IP에서 L1 한도(120/분) 초과 시 429, Redis(저장소) 호출 없이 차단", async () => {
    const ip = uniqueIp();
    const auth = rawToken({ assetId: generateAssetId(), ts: Math.floor(Date.now() / 1000), nonce: "n", sig: "s" });
    let limitedAt = -1;
    for (let i = 1; i <= 130; i++) {
      const r = await doGet(auth, ip);
      if (r.status === 429) { limitedAt = i; break; }
    }
    expect(limitedAt).toBe(121);
    spies.getEnvelope.mockClear();
    const r = await doGet(auth, ip);
    expect(r.status).toBe(429);
    expect(r.headers.get("Retry-After")).toBe("60");
    expect(spies.getEnvelope).not.toHaveBeenCalled();
    // 다른 IP는 영향 없음
    expect((await doGet(auth, uniqueIp())).status).not.toBe(429);
  });

  it("헤더 조작 우회 불가: x-forwarded-for 좌측 값을 바꿔도 같은 버킷", async () => {
    const real = uniqueIp();
    const auth = rawToken({ assetId: generateAssetId(), ts: Math.floor(Date.now() / 1000), nonce: "n", sig: "s" });
    let blocked = false;
    for (let i = 0; i < 130; i++) {
      const r = await GET(new Request("http://a.test/api/sync", {
        headers: { [SYNC_AUTH_HEADER]: auth, "x-real-ip": real, "x-forwarded-for": `6.6.${i}.1, ${real}` },
      }));
      if (r.status === 429) { blocked = true; break; }
    }
    expect(blocked).toBe(true);
  });

  it("PUT rate limit도 위조 XFF 좌측 값에 영향받지 않는다(IP는 신뢰 헤더 기준)", async () => {
    const real = uniqueIp();
    for (let i = 0; i < 12; i++) {
      await PUT(new Request("http://a.test/api/sync", {
        method: "PUT",
        headers: {
          [SYNC_AUTH_HEADER]: rawToken({ assetId, ts: Math.floor(Date.now() / 1000), nonce: "n", sig: "s" }),
          "x-real-ip": real,
          "x-forwarded-for": `7.7.${i}.1, ${real}`,
        },
        body: "{}",
      }));
    }
    expect(new Set(spies.checkRateLimit.mock.calls.map((c) => c[0]))).toEqual(new Set([real]));
    const r = await PUT(new Request("http://a.test/api/sync", {
      method: "PUT",
      headers: { [SYNC_AUTH_HEADER]: rawToken({ assetId, ts: Math.floor(Date.now() / 1000), nonce: "n", sig: "s" }), "x-real-ip": real },
      body: "{}",
    }));
    expect(r.status).toBe(429);
  });

  it.each([
    ["빈 문자열", ""],
    ["짧음", "abc"],
    ["경로 문자", "../../etc/passwd-aaaaaaaa"],
    ["공백/제어문자", "abcdefgh ijklmnop\n"],
    ["길이 초과", "a".repeat(129)],
    ["콜론 포함(Redis 키 구분자)", "csync:asset:aaaaaaaa"],
    ["숫자 타입", 12345678901234],
  ])("잘못된 assetId 거부(%s): 401, 저장소 조회 없음", async (_n, bad) => {
    const ip = uniqueIp();
    const auth = rawToken({ assetId: bad, ts: Math.floor(Date.now() / 1000), nonce: "n", sig: "s" });
    expect((await doGet(auth, ip)).status).toBe(401);
    expect(spies.getEnvelope).not.toHaveBeenCalled();
    const p = await PUT(new Request("http://a.test/api/sync", {
      method: "PUT",
      headers: { [SYNC_AUTH_HEADER]: auth, "x-vercel-forwarded-for": ip },
      body: JSON.stringify({ iv: "a", ciphertext: "b", baseVersion: 0 }),
    }));
    expect(p.status).toBe(401);
    expect(spies.getEnvelope).not.toHaveBeenCalled();
    expect(spies.checkRateLimit).not.toHaveBeenCalled();
  });

  it("과대 nonce·sig, 비정상 ts 거부", async () => {
    const ip = uniqueIp();
    const ts = Math.floor(Date.now() / 1000);
    for (const t of [
      { assetId, ts, nonce: "n".repeat(65), sig: "s" },
      { assetId, ts, nonce: "n", sig: "s".repeat(201) },
      { assetId, ts, nonce: "n!", sig: "s" },
      { assetId, ts: "1", nonce: "n", sig: "s" },
    ]) {
      expect((await doGet(rawToken(t), ip)).status).toBe(401);
    }
    expect(spies.getEnvelope).not.toHaveBeenCalled();
  });

  it("틀린 서명은 여전히 401(형식 통과 후 검증)", async () => {
    const ip = uniqueIp();
    await doPut(assetId, keys, 0, ip, true);
    const other = await deriveKeys("other-passphrase", assetId);
    expect((await doGet(await token("GET", assetId, other.privKey), ip)).status).toBe(401);
  });
});
