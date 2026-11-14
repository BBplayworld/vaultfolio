import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

// 5.113 — Redis에 IP가 들어간 키를 만들지 않는다(grep 단언). IP는 api-guard의 L1 메모리 버킷에서만 쓴다.
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (n !== "__tests__") walk(p, out); }
    else if (/\.(ts|tsx)$/.test(n)) out.push(p);
  }
  return out;
}
const files = walk("src").filter((f) => !f.endsWith(".test.ts"));

describe("IP 키 0", () => {
  it("rl:legacy·rl:*:{ip}·gemini ip/pool-ip 키 패턴이 소스에 없다", () => {
    const bad = /rl:legacy|`rl:[^`]*\$\{ip\}|gemini-\$\{pool\.name\}:\$\{ip\}|checkRateLimit|perIpDailyLimit|GEMINI_PER_IP/;
    const hits = files.filter((f) => bad.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
  it("getClientIp는 api-guard 안에서만 쓰인다(저장소·라우트로 IP가 넘어가지 않음)", () => {
    const users = files.filter((f) => readFileSync(f, "utf8").includes("getClientIp(") && !f.endsWith("server/api-guard.ts"));
    expect(users).toEqual([]);
  });
});
