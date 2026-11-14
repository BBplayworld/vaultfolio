// 5.112 /api/share 정책 — POST는 v73A만, GET은 v72Z 허용, v72Z는 TTL 미연장(FileCacheStorage, 임시 cwd)
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let tmp = "";
let route: typeof import("../route");
const origCwd = process.cwd();

beforeAll(async () => {
  tmp = mkdtempSync(path.join(tmpdir(), "share-route-"));
  mkdirSync(path.join(tmp, "data"));
  vi.spyOn(process, "cwd").mockReturnValue(tmp);
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.resetModules();
  route = await import("../route");
});
afterAll(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); rmSync(tmp, { recursive: true, force: true }); void origCwd; });

const post = (token: string, ip: string) => {
  const body = JSON.stringify({ token });
  return route.POST(new Request("http://localhost/api/share", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(body)), "x-forwarded-for": ip },
    body,
  }));
};
const get = (key: string, ip: string) => route.GET(new Request(`http://localhost/api/share?key=${key}`, { headers: { "x-forwarded-for": ip } }));
const file = () => JSON.parse(readFileSync(path.join(tmp, "data", "share-tokens.json"), "utf8")) as { tokens: Record<string, { token: string; expires_at: number }> };

describe("/api/share 정책", () => {
  it("POST: v72Z·v71P·v71N 거부, v73A 허용", async () => {
    expect((await post("v72Zabc", "10.0.0.1")).status).toBe(400);
    expect((await post("v71Pabc", "10.0.0.1")).status).toBe(400);
    expect((await post("v71Nabc", "10.0.0.1")).status).toBe(400);
    const res = await post("v73Aabc", "10.0.0.1");
    expect(res.status).toBe(200);
    const { key } = await res.json() as { key: string };
    const got = await get(key, "10.0.0.2");
    expect(((await got.json()) as { token: string }).token).toBe("v73Aabc");
  });

  it("GET: 기존 v72Z는 읽히고(기본 허용) TTL은 연장되지 않는다, v73A는 연장", async () => {
    const fs = await import("node:fs");
    const p = path.join(tmp, "data", "share-tokens.json");
    const cur = file() as { tokens: Record<string, { token: string; expires_at: number }>; owners?: unknown };
    const soon = Date.now() + 1000 * 60 * 60;
    cur.tokens["aaaaaaaaaa"] = { token: "v72Zlegacy", expires_at: soon };
    cur.tokens["bbbbbbbbbb"] = { token: "v73Anew", expires_at: soon };
    fs.writeFileSync(p, JSON.stringify(cur));
    const r = await get("aaaaaaaaaa", "10.0.0.3");
    expect(r.status).toBe(200);
    expect(((await r.json()) as { token: string }).token).toBe("v72Zlegacy");
    await get("bbbbbbbbbb", "10.0.0.3");
    const after = file();
    expect(after.tokens["aaaaaaaaaa"].expires_at).toBe(soon);
    expect(after.tokens["bbbbbbbbbb"].expires_at).toBeGreaterThan(soon + 1000 * 60 * 60 * 24);
  });

  it("차단 플래그는 기본 false(허용)이고 410 분기가 route에 있다", () => {
    const src = readFileSync(path.join(origCwd, "src/app/api/share/route.ts"), "utf8");
    expect(src).toMatch(/const BLOCK_LEGACY_V72Z_GET = false;/);
    expect(src).toMatch(/status: 410/);
  });

  describe("once(웹→PWA 1회용)", () => {
    const postOnce = (token: string, ip: string) => {
      const body = JSON.stringify({ token, once: true });
      return route.POST(new Request("http://localhost/api/share", {
        method: "POST",
        headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(body)), "x-forwarded-for": ip },
        body,
      }));
    };
    const onceFile = () => JSON.parse(readFileSync(path.join(tmp, "data", "share-tokens.json"), "utf8")) as {
      tokens: Record<string, unknown>; once: Record<string, { token: string; expires_at: number }>;
    };

    it("저장 TTL 1시간·별도 공간(tokens·owners 미사용)", async () => {
      const before = Date.now();
      const res = await postOnce("v73Aonce1", "10.1.0.1");
      const json = await res.json() as { key: string; owner_id?: string };
      expect(json.owner_id).toBeUndefined();
      const f = onceFile();
      expect(f.tokens[json.key]).toBeUndefined();
      const ttl = f.once[json.key].expires_at - before;
      expect(ttl).toBeGreaterThan(3_590_000);
      expect(ttl).toBeLessThanOrEqual(3_600_000 + 5000);
    });

    it("첫 GET 성공 후 두 번째 GET은 404", async () => {
      const { key } = await (await postOnce("v73Aonce2", "10.1.0.2")).json() as { key: string };
      expect((await get(key, "10.1.0.3")).status).toBe(200);
      expect((await get(key, "10.1.0.3")).status).toBe(404);
    });

    it("동시 GET 2개 중 1개만 성공", async () => {
      const { key } = await (await postOnce("v73Aonce3", "10.1.0.4")).json() as { key: string };
      const rs = await Promise.all([get(key, "10.1.0.5"), get(key, "10.1.0.6")]);
      expect(rs.map((r) => r.status).sort()).toEqual([200, 404]);
    });

    it("간편 공유(once 없음)는 반복 GET 가능", async () => {
      const { key } = await (await post("v73Ashared1", "10.1.0.7")).json() as { key: string };
      expect((await get(key, "10.1.0.8")).status).toBe(200);
      expect((await get(key, "10.1.0.8")).status).toBe(200);
    });
  });
});
