// 5.164 #328 — 주식 행 인식 호출 고정 + 화면 합계 전용 호출(assetType=stock-total).
// 총액 전용 호출을 더하면서 행 호출의 프롬프트·스키마·생성 설정이 한 글자도 바뀌지 않았음을 SHA-256으로 못 박는다
// (분기 시점 main 60e311b 값). 이 테스트가 깨지면 행 인식 결과가 달라질 수 있다 —
// 기대값만 고쳐 넘기지 말고 C154 실호출 비교(같은 프롬프트 반복 diff 0 → 구·신 diff 0)부터 한다.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const generate = vi.fn();
const reserve = vi.fn(async (..._a: unknown[]) => null as Response | null);
vi.mock("@google/genai", async (orig) => ({
  ...(await orig<typeof import("@google/genai")>()), // Type 값은 실제 SDK 것을 쓴다(스키마 해시가 실제 전송값과 같게)
  GoogleGenAI: class { models = { generateContent: generate }; },
}));
vi.mock("@/server/api-guard", () => ({
  guardRequest: () => null,
  isRatioEntry: () => false,
  RATIO_POOL: { name: "ratio", dailyLimit: 60 },
  STOCK_TOTAL_POOL: { name: "stock-total", dailyLimit: 60 },
  reserveGeminiCalls: (...a: unknown[]) => reserve(...a),
}));

import { POST } from "../route";
import { buildScreenTotalPrompt, parseScreenAmount, readScreenTotalFields, sanitizeScreenTotal, SCREEN_TOTAL_SCHEMA } from "../screen-total";

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const png = (w: number, h: number) => {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
};
async function call(assetType?: string, size: [number, number] = [1080, 1920], extra: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("image", new File([png(...size) as BlobPart], "a", { type: "image/png" }));
  if (assetType) fd.set("assetType", assetType);
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  const res = await POST(new Request("http://localhost/api/parse-screenshot", { method: "POST", body: fd }));
  return { status: res.status, body: await res.json() };
}
const sent = (i = 0): any => generate.mock.calls[i][0];
const reply = (o: unknown) => generate.mockResolvedValue({ text: typeof o === "string" ? o : JSON.stringify(o), candidates: [{ finishReason: "STOP" }] });
const hashes = () => {
  const a = sent(generate.mock.calls.length - 1);
  const { responseSchema, ...config } = a.config;
  return { prompt: sha(a.contents[0].parts[0].text), schema: sha(JSON.stringify(responseSchema)), config: sha(JSON.stringify({ model: a.model, config })) };
};

// 분기 시점 main(60e311b)에서 잰 값
const MAIN_STOCK = {
  prompt: "54eef5c40d2fdfdce75a08c1bd8631a8bdd1c255841e6bea5eb51900204a9d5d",
  schema: "e22a7570a533c8d354263f134f527dab108848dfc1d9d133b8e1e6a3aea0cd2e",
  config: "755b02882ac6d6c2a9e5bd341b7818b4d42360753b57d2d9477671d1bf9dce92",
};
const ROWS = [
  { name: "삼성전자", ticker: "", quantity: 10, quantityMissing: false, currentPrice: 70000, averagePrice: 65000, currentValue: 700000, profitAmount: 50000, profitRate: 7.69, section: "국내", currency: "KRW", brokerHint: "토스증권" },
  { name: "SPY", ticker: "SPY", quantity: 2, quantityMissing: false, currentPrice: 500, averagePrice: 450, currentValue: 1000, profitAmount: 100, profitRate: 11.1, section: "해외", currency: "USD", brokerHint: "키움" },
];

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-key";
  generate.mockReset();
  reply([]);
  reserve.mockReset();
  reserve.mockResolvedValue(null);
});

describe("주식 행 인식 호출 — 바이트 고정(요청 0)", () => {
  it("프롬프트·스키마·생성 설정 SHA-256이 main 값과 같다", async () => {
    await call();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(hashes()).toEqual(MAIN_STOCK);
    // 설정 원문도 함께 고정(해시가 무엇을 덮는지 읽을 수 있게)
    const { responseSchema: _s, ...config } = sent().config;
    expect({ model: sent().model, config }).toEqual({
      model: "gemini-2.5-flash-lite",
      config: { thinkingConfig: { thinkingBudget: 0 }, temperature: 0, maxOutputTokens: 2048, responseMimeType: "application/json" },
    });
    expect(sent().contents).toHaveLength(1);
    expect(sent().contents[0].parts).toHaveLength(2);
  });
  it("assetType=stock을 명시해도, 합계 호출을 먼저 한 뒤에도 같은 값이다(호출 사이 상태 없음)", async () => {
    await call("stock");
    expect(hashes()).toEqual(MAIN_STOCK);
    reply({ screenTotalText: "801,000원", screenTotalLabel: "총 평가금액", screenTotalCurrency: "KRW" });
    await call("stock-total");
    reply(ROWS);
    const row = await call();
    expect(hashes()).toEqual(MAIN_STOCK);
    // 행 응답 모양도 그대로: stocks만, 합계 필드 없음
    expect(Object.keys(row.body)).toEqual(["stocks"]);
    expect(row.body.stocks).toHaveLength(2);
    // 행 호출은 풀 없이 예약한다(4번째 인자 undefined)
    expect(reserve.mock.calls.at(-1)?.[3]).toBeUndefined();
  });
  it("행 호출 한 번에 Gemini는 1번만 부른다(한 요청 안 2회 호출 변형 아님)", async () => {
    reply(ROWS);
    await call();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(reserve).toHaveBeenCalledTimes(1);
  });
});

describe("화면 합계 전용 호출(assetType=stock-total)", () => {
  it("응답은 { screenTotal: {value,label,currency} } 한 필드뿐, 행(stocks) 없음", async () => {
    reply({ screenTotalText: "801,000원", screenTotalLabel: " 총 평가금액 ", screenTotalCurrency: "KRW" });
    const r = await call("stock-total");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ screenTotal: { value: 801_000, label: "총 평가금액", currency: "KRW" } });
  });
  it("행과 다른 프롬프트·스키마·출력 한도 256으로 1번만 부르고, 전용 풀(stock-total, 일 60)로 1회 예약한다", async () => {
    reply({ screenTotalText: "", screenTotalLabel: "", screenTotalCurrency: "KRW" });
    await call("stock-total");
    expect(generate).toHaveBeenCalledTimes(1);
    const a = sent();
    expect(a.contents[0].parts[0].text).toBe(buildScreenTotalPrompt());
    expect(a.config.responseSchema).toBe(SCREEN_TOTAL_SCHEMA);
    expect(a.config.maxOutputTokens).toBe(256);
    // 금액은 숫자 칸이 아니라 화면 글자 그대로(문자열)로 받는다 — 자릿수 변환은 서버만 한다(qa D-1)
    expect(Object.keys(SCREEN_TOTAL_SCHEMA.properties).sort()).toEqual(["screenTotalCurrency", "screenTotalLabel", "screenTotalText"]);
    expect(SCREEN_TOTAL_SCHEMA.properties.screenTotalText.type).toBe("STRING");
    expect(JSON.stringify(SCREEN_TOTAL_SCHEMA)).not.toContain("NUMBER");
    expect(a.config.temperature).toBe(0);
    expect(hashes().prompt).not.toBe(MAIN_STOCK.prompt);
    expect(reserve).toHaveBeenCalledTimes(1);
    expect(reserve.mock.calls[0][1]).toBe(1);
    expect(reserve.mock.calls[0][3]).toEqual({ name: "stock-total", dailyLimit: 60 });
  });
  it("Gemini에는 프롬프트와 이미지만 간다 — 요청에 다른 필드를 실어도 전달되지 않는다", async () => {
    reply({ screenTotalText: "", screenTotalLabel: "", screenTotalCurrency: "KRW" });
    await call("stock-total", [1080, 1920], { appTotal: "123456789", broker: "토스증권", entry: "ratio" });
    const parts = sent().contents[0].parts;
    expect(parts).toHaveLength(2);
    expect(Object.keys(parts[1])).toEqual(["inlineData"]);
    expect(JSON.stringify(sent().contents[0].parts[0])).not.toMatch(/123456789|토스증권/);
    // /ratio 입구 표시가 있어도 합계 호출은 합계 풀만 쓴다
    expect(reserve.mock.calls[0][3]).toEqual({ name: "stock-total", dailyLimit: 60 });
  });
  it("총액 없음(0·빈 라벨)·통화 불명·형식 어긋남·읽을 수 없는 응답·잘림은 200 null", async () => {
    for (const o of [
      { screenTotalText: "", screenTotalLabel: "", screenTotalCurrency: "KRW" },
      { screenTotalText: "801,000원", screenTotalLabel: "", screenTotalCurrency: "KRW" },
      { screenTotalText: "801,000원", screenTotalLabel: "총 평가금액", screenTotalCurrency: "JPY" },
      { screenTotal: 801_000, screenTotalLabel: "총 평가금액", screenTotalCurrency: "KRW" }, // 숫자 칸은 받지 않는다(글자 칸만)
      { screenTotalText: 801_000, screenTotalLabel: "총 평가금액", screenTotalCurrency: "KRW" },
      { screenTotalText: "+801,000원", screenTotalLabel: "총 평가금액", screenTotalCurrency: "KRW" },
      { screenTotalText: "801,000원", screenTotalLabel: "총 평가금액", screenTotalCurrency: "USD" },
      { screenTotalText: "$801.50", screenTotalLabel: "총 평가금액", screenTotalCurrency: "KRW" },
      [{ screenTotalText: "801,000원" }],
      "not json",
      "",
    ]) {
      reply(o);
      const r = await call("stock-total");
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ screenTotal: null });
    }
    generate.mockResolvedValue({ text: '{"screenTotal": 80', candidates: [{ finishReason: "MAX_TOKENS" }] });
    expect((await call("stock-total")).body).toEqual({ screenTotal: null });
  });
  it("너무 작은 이미지는 호출·예약 없이 null", async () => {
    const r = await call("stock-total", [150, 150]);
    expect(r).toEqual({ status: 200, body: { screenTotal: null } });
    expect(generate).not.toHaveBeenCalled();
    expect(reserve).not.toHaveBeenCalled();
  });
  it("풀·전역 한도 초과는 429(호출 0), 호출 실패는 500 — 어느 쪽도 값을 싣지 않는다", async () => {
    reserve.mockResolvedValue(new Response(JSON.stringify({ error: "마감" }), { status: 429 }));
    const limited = await call("stock-total");
    expect(limited.status).toBe(429);
    expect(limited.body).not.toHaveProperty("screenTotal");
    expect(generate).not.toHaveBeenCalled();

    reserve.mockResolvedValue(null);
    generate.mockRejectedValue(new Error("503 UNAVAILABLE"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const failed = await call("stock-total");
    expect(failed.status).toBe(500);
    expect(failed.body.screenTotal).toBeNull();
    expect(err).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });
  it("값을 읽은 정상 응답에서는 console 출력이 0건이다", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    reply({ screenTotalText: "801,000원", screenTotalLabel: "총 평가금액", screenTotalCurrency: "KRW" });
    await call("stock-total");
    for (const s of spies) {
      expect(s).not.toHaveBeenCalled();
      s.mockRestore();
    }
  });
  it("합계 검증: 문자열·음수·NaN·0·라벨 없음·통화 불명은 총액 없음, 라벨은 30자까지", () => {
    expect(sanitizeScreenTotal(1_000_000, " 총 평가금액 ", "KRW")).toEqual({ value: 1_000_000, label: "총 평가금액", currency: "KRW" });
    expect(sanitizeScreenTotal(1234.5, "총 평가금액", "USD")?.currency).toBe("USD");
    for (const v of ["1000", -1, NaN, Infinity, 0, null, undefined]) expect(sanitizeScreenTotal(v, "총 평가금액", "KRW")).toBeNull();
    for (const l of ["", "  ", 5, null]) expect(sanitizeScreenTotal(100, l, "KRW")).toBeNull();
    for (const c of ["EUR", "JPY", "", undefined]) expect(sanitizeScreenTotal(100, "총 평가금액", c)).toBeNull();
    expect(sanitizeScreenTotal(100, "가".repeat(80), "KRW")?.label).toHaveLength(30);
  });
});

describe("화면 금액 글자 → 숫자(qa D-1: 모델이 숫자를 직접 쓰면 5,500,000 → 550000000으로 틀어졌다)", () => {
  it("qa 픽스처 값: 화면 글자 그대로면 자릿수가 보존된다", async () => {
    expect(parseScreenAmount("5,500,000원")).toBe(5_500_000);
    expect(parseScreenAmount("7,845,000원")).toBe(7_845_000);
    reply({ screenTotalText: "5,500,000원", screenTotalLabel: "총 평가금액", screenTotalCurrency: "KRW" });
    expect((await call("stock-total")).body).toEqual({ screenTotal: { value: 5_500_000, label: "총 평가금액", currency: "KRW" } });
    reply({ screenTotalText: "7,845,000 원", screenTotalLabel: "총 평가금액", screenTotalCurrency: "KRW" });
    expect((await call("stock-total")).body.screenTotal.value).toBe(7_845_000);
  });
  it.each([
    ["5,500,000", 5_500_000],
    ["5500000", 5_500_000],
    ["₩5,500,000", 5_500_000],
    ["5,500,000 KRW", 5_500_000],
    [" 5,500,000 원 ", 5_500_000],
    ["999원", 999],
    ["12,345,678,900원", 12_345_678_900],
    ["123,456,789원", 123_456_789],
    ["$12,345.67", 12_345.67],
    ["12,345.67 USD", 12_345.67],
    ["USD 1,000", 1000],
    ["0.5", 0.5],
  ])("일반 표기 %s → %d", (text, want) => expect(parseScreenAmount(text)).toBe(want));
  it.each([
    ["550만원", 5_500_000],
    ["550만 원", 5_500_000],
    ["1억", 100_000_000],
    ["1억원", 100_000_000],
    ["1.2억", 120_000_000],
    ["1.25억원", 125_000_000],
    ["784.5만원", 7_845_000],
    ["1억 2,345만원", 123_450_000],
    ["1억2345만6789원", 123_456_789],
    ["1억 2,345만 6,789원", 123_456_789],
    ["2,345만 6,789원", 23_456_789],
    ["1억 500원", 100_000_500],
    ["1,234억원", 123_400_000_000],
    ["0.5만원", 5000],
  ])("한글 단위 %s → %d", (text, want) => expect(parseScreenAmount(text)).toBe(want));
  it.each([
    "", " ", "원", "억", "만원", "0", "0원", "0만원",
    "5,500,00", "55,00,000", "5,5000,000", ",500", "5,500,", "5.500.000", "5,500.000.1", "1,23",
    "+5,500,000원", "-5,500,000원", "−5,500,000", "▲5,500,000", "▼5,500,000", "12.5%", "+12.5%",
    "약 550만원", "5,500,000원(예수금 포함)", "550만원대", "5천만원", "3백만원", "5,500천원", "1조원",
    "1억 12,345만원", "1억 2,345만 12,345원", "2만 10,000원", "1.5억 2,000만원", "1.5만 500원", "만 5,000", "1억만원",
    "5,500,000원 7,845,000원", "오백만원", "1e7", "0x10", "Infinity", "NaN",
    "1".repeat(41),
  ])("규칙 밖 표기 %j → null(줄 숨김)", (text) => expect(parseScreenAmount(text)).toBeNull());
  it("문자열이 아니면 null", () => {
    for (const v of [5_500_000, null, undefined, {}, [], true]) expect(parseScreenAmount(v)).toBeNull();
  });
  it("통화와 글자가 어긋나면 null, 맞으면 값", () => {
    const L = "총 평가금액";
    expect(readScreenTotalFields("5,500,000원", L, "KRW")).toEqual({ value: 5_500_000, label: L, currency: "KRW" });
    expect(readScreenTotalFields("5,500,000", L, "KRW")?.value).toBe(5_500_000);
    expect(readScreenTotalFields("$12,345.67", L, "USD")).toEqual({ value: 12_345.67, label: L, currency: "USD" });
    expect(readScreenTotalFields("12,345.67", L, "USD")?.value).toBe(12_345.67);
    for (const [t, c] of [["5,500,000원", "USD"], ["550만", "USD"], ["₩5,500,000", "USD"], ["$5,500", "KRW"], ["5,500 USD", "KRW"], ["5,500,000원", "JPY"], ["5,500,000원", ""]]) {
      expect(readScreenTotalFields(t, L, c)).toBeNull();
    }
    expect(readScreenTotalFields("5,500,000원", "", "KRW")).toBeNull();
  });
  it("프롬프트: 금액은 화면 글자 그대로 옮기고 자릿수·쉼표를 바꾸지 않는다", () => {
    const p = buildScreenTotalPrompt();
    expect(p).toContain("화면에 적힌 글자 그대로 옮긴 문자열");
    expect(p).toContain("자릿수와 쉼표 위치를 바꾸지 말고");
    expect(p).not.toContain("숫자만)");
  });
});

describe("서버 저장·캐시·로그 0 (소스 grep)", () => {
  const route = readFileSync(path.join(__dirname, "../route.ts"), "utf8");
  const total = readFileSync(path.join(__dirname, "../screen-total.ts"), "utf8");
  it("route.ts: 합계 분기는 한 줄 위임뿐이고 console은 기존 오류 로그 1건 그대로", () => {
    expect(route.match(/console\./g)).toHaveLength(1);
    expect(route.split("\n").filter((l) => /STOCK_TOTAL_MODE|respondScreenTotal/.test(l) && !l.startsWith("import "))).toEqual([
      "  if (assetTypeRaw === STOCK_TOTAL_MODE) return respondScreenTotal(request, apiKey, arrayBuffer, imageFile.type);",
    ]);
    // 입구 가드·형식 검사 뒤, 행 경로(작은 이미지 가드·예약) 앞에 있다
    expect(route.indexOf("matchesImageSignature(new Uint8Array")).toBeLessThan(route.indexOf("respondScreenTotal(request"));
    expect(route.indexOf("respondScreenTotal(request")).toBeLessThan(route.indexOf("isTinyImage(new Uint8Array"));
  });
  it("screen-total.ts: console은 호출 오류 메시지 1건뿐이고 읽은 값·응답 본문을 싣지 않는다. 저장·캐시 호출 0", () => {
    const logs = total.split("\n").filter((l) => /console\./.test(l));
    expect(logs).toHaveLength(1);
    expect(logs[0]).not.toMatch(/screenTotal|rawText|parsed|label|value|result|text/i);
    expect(total).not.toMatch(/getCacheStorage|kv\.|redis|localStorage|writeFile|setCache|incrementCounter/i);
  });
  it("프롬프트: 라벨이 글자로 있을 때만 읽고, 행을 더해 만들지 않으며, 손익·예수금은 합계가 아니다", () => {
    const p = buildScreenTotalPrompt();
    expect(p).toContain("합계 라벨(예");
    expect(p).toContain("없거나 불확실하면 읽지 않는다");
    expect(p).toContain("종목 값을 더해 계산하지 말 것");
    expect(p).toContain("총 평가손익");
    expect(p).toContain("예수금");
  });
});
