// 5.161 화면 합계(screenTotal) — 응답 분리·하위호환·기존 인식 행 회귀 0·서버 저장/로그 0
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const generate = vi.fn();
vi.mock("@google/genai", () => ({
  Type: { ARRAY: "ARRAY", OBJECT: "OBJECT", STRING: "STRING", NUMBER: "NUMBER", BOOLEAN: "BOOLEAN", INTEGER: "INTEGER" },
  GoogleGenAI: class { models = { generateContent: generate }; },
}));
vi.mock("@/server/api-guard", () => ({
  guardRequest: () => null,
  isRatioEntry: () => false,
  RATIO_POOL: "ratio",
  reserveGeminiCalls: async () => null,
}));

import { POST } from "../route";
import { parseStockPayload, sanitizeScreenTotal } from "../screen-total";

const png = () => {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, 1080);
  new DataView(b.buffer).setUint32(20, 1920);
  return b;
};
async function call(assetType?: string) {
  const fd = new FormData();
  fd.set("image", new File([png() as BlobPart], "a", { type: "image/png" }));
  if (assetType) fd.set("assetType", assetType);
  const res = await POST(new Request("http://localhost/api/parse-screenshot", { method: "POST", body: fd }));
  return { status: res.status, body: await res.json() };
}

// 토스·미래에셋·키움 화면 모양의 행 픽스처(국내 ETF·해외 ETF·2줄 행)
const ROWS = [
  { name: "삼성전자", ticker: "", quantity: 10, quantityMissing: false, currentPrice: 70000, averagePrice: 65000, currentValue: 700000, profitAmount: 50000, profitRate: 7.69, section: "국내", currency: "KRW", brokerHint: "토스증권" },
  { name: "TIGER 미국S&P500", ticker: "", quantity: 5, quantityMissing: false, currentPrice: 20000, averagePrice: 18000, currentValue: 100000, profitAmount: 10000, profitRate: 11.1, section: "국내", currency: "KRW", brokerHint: "미래에셋" },
  { name: "SPY", ticker: "SPY", quantity: 2, quantityMissing: false, currentPrice: 500, averagePrice: 450, currentValue: 1000, profitAmount: 100, profitRate: 11.1, section: "해외", currency: "USD", brokerHint: "키움" },
];
const reply = (o: unknown) => generate.mockResolvedValue({ text: JSON.stringify(o), candidates: [{ finishReason: "STOP" }] });

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-key";
  generate.mockReset();
});

describe("응답 해석(하위호환)", () => {
  it("최상위 배열(구형)과 { rows }가 같은 행을 낸다. 구형은 screenTotal 없음", () => {
    expect(parseStockPayload(ROWS)).toEqual({ rows: ROWS, screenTotal: null });
    expect(parseStockPayload({ rows: ROWS })?.rows).toEqual(ROWS);
  });
  it("배열도 rows도 아니면 null(422)", () => {
    for (const bad of [null, "x", 3, {}, { rows: "x" }, { rows: null }]) expect(parseStockPayload(bad)).toBeNull();
  });
  it("합계 검증: 문자열·음수·NaN·0·라벨 없음·통화 불명은 총액 없음", () => {
    expect(sanitizeScreenTotal(1_000_000, " 총 평가금액 ", "KRW")).toEqual({ value: 1_000_000, label: "총 평가금액", currency: "KRW" });
    for (const v of ["1000", -1, NaN, Infinity, 0, null, undefined]) expect(sanitizeScreenTotal(v, "총 평가금액", "KRW")).toBeNull();
    expect(sanitizeScreenTotal(100, "", "KRW")).toBeNull();
    expect(sanitizeScreenTotal(100, "  ", "KRW")).toBeNull();
    expect(sanitizeScreenTotal(100, 5, "KRW")).toBeNull();
    expect(sanitizeScreenTotal(100, "총 평가금액", "EUR")).toBeNull();
    expect(sanitizeScreenTotal(100, "가".repeat(80), "KRW")?.label).toHaveLength(30);
  });
});

describe("route 응답", () => {
  it("행 결과: 구형 배열 응답과 { rows, screenTotal… } 응답의 stocks가 같다(회귀 0)", async () => {
    reply(ROWS);
    const legacy = await call();
    reply({ rows: ROWS, screenTotal: 801_000, screenTotalLabel: "총 평가금액", screenTotalCurrency: "KRW" });
    const next = await call();
    expect(next.status).toBe(200);
    const noId = (l: { id: string }[]) => l.map((x) => ({ ...x, id: x.id.replace(/\d{10,}/, "T") })); // id에 호출 시각이 들어간다
    expect(noId(next.body.stocks)).toEqual(noId(legacy.body.stocks));
    expect(next.body.stocks).toHaveLength(3);
    expect(legacy.body).not.toHaveProperty("screenTotal");
  });
  it("screenTotal은 stocks 배열 밖의 별도 필드, 행으로 섞이지 않는다", async () => {
    reply({ rows: ROWS, screenTotal: 801_000, screenTotalLabel: "총 평가금액", screenTotalCurrency: "KRW" });
    const { body } = await call();
    expect(body.screenTotal).toEqual({ value: 801_000, label: "총 평가금액", currency: "KRW" });
    expect(JSON.stringify(body.stocks)).not.toContain("801000");
    expect(Object.keys(body).sort()).toEqual(["screenTotal", "stocks"]);
  });
  it("총액 0·라벨 없음이면 screenTotal 키 없음(종목 등록·온보딩·/ratio는 stocks만 읽는다)", async () => {
    reply({ rows: ROWS, screenTotal: 0, screenTotalLabel: "", screenTotalCurrency: "KRW" });
    const { body } = await call();
    expect(Object.keys(body)).toEqual(["stocks"]);
    expect(body.stocks).toHaveLength(3);
  });
  it("rows 없는 객체는 422, 코인 등 다른 타입은 여전히 최상위 배열만 받는다", async () => {
    reply({ foo: 1 });
    expect((await call()).status).toBe(422);
    reply({ rows: [] });
    expect((await call("crypto")).status).toBe(422);
    reply([]);
    const c = await call("crypto");
    expect(c.status).toBe(200);
    expect(c.body).toEqual({ cryptos: [] });
  });
  it("요청 설정: 주식은 객체 스키마(rows+합계 3필드), 출력 한도 2304, 다른 타입은 2048", async () => {
    reply(ROWS);
    await call();
    const cfg = generate.mock.calls[0][0].config;
    expect(cfg.maxOutputTokens).toBe(2304);
    expect(Object.keys(cfg.responseSchema.properties).sort()).toEqual(["rows", "screenTotal", "screenTotalCurrency", "screenTotalLabel"]);
    reply([]);
    await call("crypto");
    expect(generate.mock.calls[1][0].config.maxOutputTokens).toBe(2048);
  });
  it("요청 본문 불변: Gemini에는 프롬프트·이미지만 가고 합계 값·앱 값은 없다", async () => {
    reply(ROWS);
    await call();
    const parts = generate.mock.calls[0][0].contents[0].parts;
    expect(parts).toHaveLength(2);
    expect(Object.keys(parts[1])).toEqual(["inlineData"]);
  });
});

describe("서버 저장·캐시·로그 0 (route.ts grep)", () => {
  const src = readFileSync(path.join(__dirname, "../route.ts"), "utf8");
  it("screenTotal을 쓰는 console·저장 호출이 없다", () => {
    const lines = src.split("\n").filter((l) => /screenTotal/.test(l));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l).not.toMatch(/console\.|kv|redis|localStorage|writeFile|cache/i);
    expect(src.match(/console\./g)).toHaveLength(1); // 오류 로그 1건(e.message만)
  });
  it("프롬프트: 합계 줄을 행으로 만들지 말라는 문구가 남아 있다", () => {
    expect(src).toContain("합계 줄(총평가금액 등)은 rows의 행으로 만들지 말 것");
  });
});
