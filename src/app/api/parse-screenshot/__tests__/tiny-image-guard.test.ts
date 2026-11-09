// #109 (f) 작은 이미지 가드 — 긴 변 < 200px이면 Gemini 미호출·한도 차감 0, 빈 결과는 Gemini 빈 배열과 같은 응답 형태
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const generate = vi.fn();
const reserve = vi.fn(async () => null);
vi.mock("@google/genai", () => ({
  Type: { ARRAY: "ARRAY", OBJECT: "OBJECT", STRING: "STRING", NUMBER: "NUMBER", BOOLEAN: "BOOLEAN", INTEGER: "INTEGER" },
  GoogleGenAI: class { models = { generateContent: generate }; },
}));
vi.mock("@/server/api-guard", () => ({
  guardRequest: () => null,
  isRatioEntry: () => false,
  RATIO_POOL: "ratio",
  reserveGeminiCalls: (...a: unknown[]) => (reserve as (...x: unknown[]) => unknown)(...a),
}));

import { POST } from "../route";
import { isTinyImage, readImageSize } from "../image-size";

const png = (w: number, h: number) => {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
};
const jpeg = (w: number, h: number) => {
  // SOI + APP0(16) + SOF0
  const b = new Uint8Array(2 + 18 + 19);
  b.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  b.set([0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 3], 20);
  return b;
};
const webpLossy = (w: number, h: number) => {
  const b = new Uint8Array(40);
  b.set([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP"), ...Buffer.from("VP8 "), 0, 0, 0, 0, 0, 0, 0, 0x9d, 0x01, 0x2a, w & 255, w >> 8, h & 255, h >> 8]);
  return b;
};
const webpX = (w: number, h: number) => {
  const b = new Uint8Array(40);
  const cw = w - 1, ch = h - 1;
  b.set([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP"), ...Buffer.from("VP8X"), 10, 0, 0, 0, 0, 0, 0, 0, cw & 255, (cw >> 8) & 255, cw >> 16, ch & 255, (ch >> 8) & 255, ch >> 16]);
  return b;
};
const webpLossless = (w: number, h: number) => {
  const b = new Uint8Array(40);
  const bits = ((w - 1) & 0x3fff) | (((h - 1) & 0x3fff) << 14);
  b.set([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP"), ...Buffer.from("VP8L"), 0, 0, 0, 0, 0x2f, bits & 255, (bits >> 8) & 255, (bits >> 16) & 255, (bits >>> 24) & 255]);
  return b;
};
const heic = () => { const b = new Uint8Array(40); b.set([0, 0, 0, 24, ...Buffer.from("ftypheic")]); return b; };

async function call(bytes: Uint8Array, type: string, assetType?: string) {
  const fd = new FormData();
  fd.set("image", new File([bytes as BlobPart], "a", { type }));
  if (assetType) fd.set("assetType", assetType);
  const res = await POST(new Request("http://localhost/api/parse-screenshot", { method: "POST", body: fd }));
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-key";
  generate.mockReset();
  generate.mockResolvedValue({ text: "[]", candidates: [{ finishReason: "STOP" }] });
  reserve.mockClear();
});

describe("헤더 판독", () => {
  it("PNG·JPEG·WEBP(VP8·VP8L·VP8X) 가로·세로", () => {
    expect(readImageSize(png(1080, 150), "image/png")).toEqual({ width: 1080, height: 150 });
    expect(readImageSize(jpeg(50, 60), "image/jpeg")).toEqual({ width: 50, height: 60 });
    expect(readImageSize(webpLossy(120, 80), "image/webp")).toEqual({ width: 120, height: 80 });
    expect(readImageSize(webpLossless(300, 40), "image/webp")).toEqual({ width: 300, height: 40 });
    expect(readImageSize(webpX(1000, 20), "image/webp")).toEqual({ width: 1000, height: 20 });
  });
  it("판독 실패·HEIC·잘린 버퍼는 null(= 통과), 경계를 넘지 않는다", () => {
    expect(readImageSize(heic(), "image/heic")).toBeNull();
    expect(readImageSize(png(1, 1).subarray(0, 20), "image/png")).toBeNull();
    expect(readImageSize(jpeg(10, 10).subarray(0, 25), "image/jpeg")).toBeNull();
    expect(readImageSize(new Uint8Array([0xff, 0xd8, 0xff]), "image/jpeg")).toBeNull();
    expect(readImageSize(webpLossy(5, 5).subarray(0, 25), "image/webp")).toBeNull();
    expect(isTinyImage(heic(), "image/heic")).toBe(false);
    expect(isTinyImage(png(0, 0), "image/png")).toBe(false);
  });
  it("긴 변 200 경계", () => {
    expect(isTinyImage(png(199, 199), "image/png")).toBe(true);
    expect(isTinyImage(png(200, 10), "image/png")).toBe(false);
    expect(isTinyImage(png(1080, 150), "image/png")).toBe(false);
  });
});

describe("POST 가드", () => {
  it("1×1 PNG: Gemini 미호출·한도 차감 0, 빈 stocks", async () => {
    const r = await call(png(1, 1), "image/png");
    expect(r).toEqual({ status: 200, body: { stocks: [] } });
    expect(generate).not.toHaveBeenCalled();
    expect(reserve).not.toHaveBeenCalled();
  });
  it("50×50 JPEG: 미호출, 자산 종류별 빈 결과 키가 Gemini 빈 배열과 같다", async () => {
    for (const [t, key] of [["stock", "stocks"], ["crypto", "cryptos"], ["cash", "cashes"], ["loan", "loans"], ["trade", "trades"], ["crypto-trade", "cryptoTrades"]] as const) {
      const guarded = await call(jpeg(50, 50), "image/jpeg", t);
      expect(generate).not.toHaveBeenCalled();
      const viaGemini = await call(png(1080, 1920), "image/png", t); // 통과 → Gemini 빈 배열
      expect(guarded).toEqual(viaGemini);
      expect(Object.keys(guarded.body)).toEqual([key]);
      generate.mockClear();
    }
  });
  it("1080×150 PNG는 통과(Gemini 호출·한도 차감 1)", async () => {
    const r = await call(png(1080, 150), "image/png");
    expect(r.status).toBe(200);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(reserve).toHaveBeenCalledTimes(1);
  });
  it("판독 실패 JPEG·HEIC는 통과", async () => {
    await call(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]), "image/jpeg");
    await call(heic(), "image/heic");
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it("라우트·판독 모듈에 크기·바이트 로그 없음, 프롬프트 파일 미변경 표식(가드는 reserve 앞)", () => {
    const root = path.resolve(__dirname, "..");
    const route = readFileSync(path.join(root, "route.ts"), "utf8");
    const size = readFileSync(path.join(root, "image-size.ts"), "utf8");
    expect(size).not.toMatch(/console\./);
    expect(route.indexOf("isTinyImage(new Uint8Array")).toBeLessThan(route.indexOf("await reserveGeminiCalls("));
    expect(route.match(/console\./g)?.length).toBe(1); // 기존 오류 로그 1건만
  });
});
