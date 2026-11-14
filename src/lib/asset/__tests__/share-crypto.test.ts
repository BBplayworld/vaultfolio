// 5.112 공유 v73A — 왕복·오답 PIN·변조(GCM)·v72Z/v71 하위호환·크기·CSPRNG·route 정책
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { generateShareToken, parseShareToken } from "@/lib/asset/asset-storage";
import { generateShareUrlKey, encryptShare, decryptShare } from "@/lib/asset/share-crypto";
import { cashItem, emptyData } from "@/lib/__tests__/physical-fixtures";

const data = () => ({ ...emptyData(), cash: [cashItem("a", 5_000_000)] });
const KEY = "0123456789abcdef0123456789abcdef";
const OTHER_KEY = "fedcba9876543210fedcba9876543210";
// 4.x(v72Z 생성기)가 만든 고정 벡터: PIN 1234, localKey abcdef123456
const V72Z_FIXTURE = 'v72Z$6MDvA$HkxKz0WU+-czI$srzD2QAK7QB1Cz';
const V71N_FIXTURE = "v71NPIaQPgelAMaBBjgIOrAVgLJQgRgPYHcMERA";

const ok = (r: Awaited<ReturnType<typeof parseShareToken>>) => {
  if (!r || "pinRequired" in r) throw new Error("parse 실패");
  return r;
};

describe("v73A 왕복", () => {
  it("토큰은 v73A 접두, 정답 PIN+키로 복원", async () => {
    const token = await generateShareToken(data(), undefined, "1234", KEY);
    expect(token.startsWith("v73A")).toBe(true);
    expect(ok(await parseShareToken(token, "1234", KEY)).data.cash[0].balance).toBe(5_000_000);
  });
  it("PIN 없으면 pinRequired, 키 없으면 null", async () => {
    const token = await generateShareToken(data(), undefined, "1234", KEY);
    expect(await parseShareToken(token, undefined, KEY)).toEqual({ pinRequired: true });
    expect(await parseShareToken(token, "1234")).toBeNull();
  });
  it("오답 PIN·다른 URL 키는 null", async () => {
    const token = await generateShareToken(data(), undefined, "1234", KEY);
    expect(await parseShareToken(token, "1235", KEY)).toBeNull();
    expect(await parseShareToken(token, "1234", OTHER_KEY)).toBeNull();
    expect(await parseShareToken(token, "1234", "short")).toBeNull();
  });
  it("2회 생성 토큰이 서로 다르다(salt·nonce 무작위)", async () => {
    const a = await generateShareToken(data(), undefined, "1234", KEY);
    const b = await generateShareToken(data(), undefined, "1234", KEY);
    expect(a).not.toBe(b);
  });
});

describe("v73A 변조 감지(GCM)", () => {
  const flipAt = (token: string, byteIdx: number) => {
    const body = token.slice(4);
    const bin = Buffer.from(body, "base64url");
    bin[byteIdx] ^= 1;
    return "v73A" + bin.toString("base64url");
  };
  it.each([["salt", 0], ["nonce", 16], ["ciphertext", 30]])("%s 1비트 변조 → null", async (_n, idx) => {
    const token = await generateShareToken(data(), undefined, "1234", KEY);
    expect(await parseShareToken(flipAt(token, idx), "1234", KEY)).toBeNull();
  });
  it("태그 변조·잘림 → null", async () => {
    const token = await generateShareToken(data(), undefined, "1234", KEY);
    const len = Buffer.from(token.slice(4), "base64url").length;
    expect(await parseShareToken(flipAt(token, len - 1), "1234", KEY)).toBeNull();
    expect(await parseShareToken(token.slice(0, 20), "1234", KEY)).toBeNull();
  });
  it("접두 AAD 불일치 평문은 복호화 불가(decryptShare 직접)", async () => {
    const t = await encryptShare("hello", "1234", KEY);
    expect(await decryptShare(t, "1234", KEY)).toBe("hello");
  });
});

describe("하위호환 읽기", () => {
  it("v72Z 고정 벡터를 새 코드가 읽는다", async () => {
    expect(ok(await parseShareToken(V72Z_FIXTURE, "1234", "abcdef123456")).data.cash[0].balance).toBe(5_000_000);
    expect(await parseShareToken(V72Z_FIXTURE, "9999", "abcdef123456")).toBeNull();
  });
  it("v71N 고정 벡터 회귀 + 무암호 생성 경로 유지", async () => {
    expect(ok(await parseShareToken(V71N_FIXTURE)).data.cash[0].balance).toBe(5_000_000);
    expect((await generateShareToken(data())).startsWith("v71N")).toBe(true);
  });
  it("v71P 왕복 유지(키 없이 PIN만)", async () => {
    const t = await generateShareToken(data(), undefined, "1234");
    expect(t.startsWith("v71P")).toBe(true);
    expect(ok(await parseShareToken(t, "1234")).data.cash[0].balance).toBe(5_000_000);
  });
});

describe("크기·CSPRNG", () => {
  it("대형 자산에서도 900k 이내이며 v71N 대비 오버헤드 한정", async () => {
    const big = { ...emptyData(), cash: Array.from({ length: 300 }, (_, i) => cashItem("c" + i, 1000 * (i + 1))) };
    const t73 = await generateShareToken(big, undefined, "1234", KEY);
    const t71 = await generateShareToken(big);
    expect(t73.length).toBeLessThan(900_000);
    expect(t73.length / t71.length).toBeLessThan(1.4); // base64 바이트 인코딩 오버헤드 포함
  });
  it("URL 키는 hex 32자이며 crypto.getRandomValues 16바이트로 만든다", () => {
    const spy = vi.spyOn(crypto, "getRandomValues");
    const k = generateShareUrlKey();
    expect(k).toMatch(/^[0-9a-f]{32}$/);
    expect(spy).toHaveBeenCalledTimes(1);
    expect((spy.mock.calls[0][0] as Uint8Array).length).toBe(16);
    spy.mockRestore();
    expect(generateShareUrlKey()).not.toBe(k);
  });
  afterEach(() => vi.restoreAllMocks());
  it("공유 호출부에 Math.random 기반 localKey가 없다", () => {
    const root = path.resolve(__dirname, "../../..");
    for (const f of ["hooks/use-share-artifacts.ts", "app/(main)/_components/header-menu/tool-menu.tsx"]) {
      expect(readFileSync(path.join(root, f), "utf8")).not.toMatch(/Math\.random\(\)\.toString\(36\)/);
    }
  });
});
