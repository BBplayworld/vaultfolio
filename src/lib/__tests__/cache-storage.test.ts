import { describe, it, expect, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { FileCacheStorage } from "../cache-storage";

// compareAndSetAssetEnvelope 회귀 — /api/sync PUT의 read-then-write(TOCTOU) 레이스를
// 막기 위한 원자적 CAS. FileCacheStorage 구현(동기 fs 호출로만 구성)에 대해 순차 호출로
// "먼저 쓴 쪽 성공 → 나중에 stale baseVersion으로 쓰려는 쪽은 반드시 실패(409에 해당)"를 검증한다.

const CLOUD_SYNC_PATH = path.join(process.cwd(), "data", "cloud-sync.json");
const TEST_ASSET_ID = `test-cas-${Math.random().toString(36).slice(2)}`;

function cleanup() {
  if (!fs.existsSync(CLOUD_SYNC_PATH)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(CLOUD_SYNC_PATH, "utf8"));
    if (raw.assets) delete raw.assets[TEST_ASSET_ID];
    fs.writeFileSync(CLOUD_SYNC_PATH, JSON.stringify(raw, null, 2), "utf8");
  } catch {
    // ignore
  }
}

describe("FileCacheStorage.compareAndSetAssetEnvelope", () => {
  afterEach(cleanup);

  it("최초 등록(TOFU) — 금고가 없으면 version 1로 성공한다", async () => {
    const storage = new FileCacheStorage();
    const result = await storage.compareAndSetAssetEnvelope(TEST_ASSET_ID, 0, {
      pubKey: "pk1", iv: "iv1", ciphertext: "ct1",
    });
    expect(result).toEqual({ ok: true, version: 1 });
  });

  it("baseVersion이 최신과 일치하면 성공하고 버전이 1 증가한다", async () => {
    const storage = new FileCacheStorage();
    await storage.compareAndSetAssetEnvelope(TEST_ASSET_ID, 0, { pubKey: "pk1", iv: "iv1", ciphertext: "ct1" });
    const result = await storage.compareAndSetAssetEnvelope(TEST_ASSET_ID, 1, { pubKey: "pk1", iv: "iv2", ciphertext: "ct2" });
    expect(result).toEqual({ ok: true, version: 2 });
  });

  it("stale baseVersion으로 쓰려는 두 번째 요청은 반드시 실패한다 — A push 성공 후 B의 stale push가 거부됨(lost update 방지)", async () => {
    const storage = new FileCacheStorage();
    // A: 최초 등록(version 0 → 1)
    await storage.compareAndSetAssetEnvelope(TEST_ASSET_ID, 0, { pubKey: "pk1", iv: "A-iv", ciphertext: "A-ct" });
    // A: 두 번째 push, baseVersion=1 → version 2로 성공(서버 최신 = A의 최신 데이터)
    const aSecond = await storage.compareAndSetAssetEnvelope(TEST_ASSET_ID, 1, { pubKey: "pk1", iv: "A-iv2", ciphertext: "A-ct2" });
    expect(aSecond).toEqual({ ok: true, version: 2 });

    // B: A의 두 번째 push를 못 본 채(자신이 아는 최신 버전은 여전히 1) stale baseVersion=1로 push 시도
    const bStale = await storage.compareAndSetAssetEnvelope(TEST_ASSET_ID, 1, { pubKey: "pk1", iv: "B-iv-stale", ciphertext: "B-ct-stale" });
    expect(bStale).toEqual({ ok: false, currentVersion: 2 });

    // 서버에 실제로 저장된 값은 A의 최신 데이터여야 한다 — B의 stale push가 조용히 덮어쓰지 않았는지 확인
    const stored = await storage.getAssetEnvelope(TEST_ASSET_ID);
    expect(stored?.version).toBe(2);
    expect(stored?.ciphertext).toBe("A-ct2");
  });

  it("pubKey 등 데이터 내용은 실패한 CAS 호출에 의해 변경되지 않는다", async () => {
    const storage = new FileCacheStorage();
    await storage.compareAndSetAssetEnvelope(TEST_ASSET_ID, 0, { pubKey: "pk1", iv: "iv1", ciphertext: "ct1" });
    const failed = await storage.compareAndSetAssetEnvelope(TEST_ASSET_ID, 0, { pubKey: "pk1", iv: "iv-attacker", ciphertext: "ct-attacker" });
    expect(failed.ok).toBe(false);
    const stored = await storage.getAssetEnvelope(TEST_ASSET_ID);
    expect(stored?.ciphertext).toBe("ct1");
  });
});

// ── 보안 강화(4.28) 회귀 ──
import { getCacheStorage } from "../cache-storage";

describe("getCacheStorage fail-closed", () => {
  const saved = { env: process.env.VERCEL_ENV, url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN };
  afterEach(() => {
    process.env.VERCEL_ENV = saved.env;
    if (saved.url === undefined) delete process.env.KV_REST_API_URL; else process.env.KV_REST_API_URL = saved.url;
    if (saved.token === undefined) delete process.env.KV_REST_API_TOKEN; else process.env.KV_REST_API_TOKEN = saved.token;
    if (saved.env === undefined) delete process.env.VERCEL_ENV;
  });

  it("production·preview에서 KV 미설정이면 파일 모드로 폴백하지 않고 throw", () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    for (const env of ["production", "preview"]) {
      process.env.VERCEL_ENV = env;
      expect(() => getCacheStorage()).toThrow();
    }
  });

  it("로컬(VERCEL_ENV 없음)은 파일 모드 유지", () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.VERCEL_ENV;
    expect(getCacheStorage()).toBeInstanceOf(FileCacheStorage);
  });
});

describe("FileCacheStorage 카운터·락", () => {
  it("incrementCounter는 누적값을 반환하고 키별로 독립", async () => {
    const s = new FileCacheStorage();
    const k = `t:${Math.random()}`;
    expect(await s.incrementCounter(k, 1, 60)).toBe(1);
    expect(await s.incrementCounter(k, 2, 60)).toBe(3);
    expect(await s.incrementCounter(`${k}:other`, 1, 60)).toBe(1);
  });

  it("acquireLock은 보유 중 재획득 불가, 소유 토큰으로만 해제", async () => {
    const s = new FileCacheStorage();
    const k = `lock:${Math.random()}`;
    const t1 = await s.acquireLock(k, 10);
    expect(t1).toBeTruthy();
    expect(await s.acquireLock(k, 10)).toBeNull();
    await s.releaseLock(k, "wrong-token");
    expect(await s.acquireLock(k, 10)).toBeNull();
    await s.releaseLock(k, t1!);
    expect(await s.acquireLock(k, 10)).toBeTruthy();
  });
});
