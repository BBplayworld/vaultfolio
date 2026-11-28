// #377(5.184) B 빈도 판정 고정 패턴표 — 기대값은 qa 확정(.memory/issues/5.184-377-dividend-terms/5.184-b-fixtures.md)
// 실제 GET을 KIS 응답 목으로 돌린다. 각 행: 작년 지급월·올해 지급월(오늘까지 조회된 것)·오늘(KST 12:00)·시장
// freq = 허용 배지(frequency), est = 허용 추정 달 집합(보통 1개. 애매한 행만 2개 — 근거는 fixtures.md)
// 주석 `main FAIL` = main(c6fca548)에서 실패하는 행. 구현은 전 행 통과 + main 통과 행을 깨지 않아야 한다
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type Raw = { payoutDate: string; amountPerShare: number; amountForeign?: number; currency?: string };
const kis: Record<string, Raw[]> = {};

vi.mock("@/lib/cache-storage", () => ({ getCacheStorage: () => ({ getDividend: async () => null, setDividend: async () => {} }) }));
vi.mock("@/lib/finance/kis-token", () => ({ getKisAccessToken: async () => ({ token: "t" }) }));
vi.mock("@/server/api-guard", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/server/api-guard")>();
  return { ...mod, guardRequest: () => null, guardRateLimit: async () => null, withinUpstreamBudget: async () => true };
});
vi.mock("@/lib/finance/finance-service", () => ({
  fetchDividendDomestic: async (t: string, f: string) => (kis[`${t}:${f.slice(0, 4)}`] ?? []).map((r) => ({ ...r, currency: "KRW" })),
  fetchDividendOverseas: async (t: string, _e: string, f: string) => kis[`${t}:${f.slice(0, 4)}`] ?? [],
}));

process.env.KIS_APP_KEY = "k";
process.env.KIS_APP_SECRET = "s";

type Freq = "monthly" | "quarterly" | "semiannual" | "annual";
// 월 표기: 정수 m → m월 15일, "m-dd" → 해당 일자
type M = number | string;
type Row = {
  id: string;
  name: string;
  today: string; // KST 날짜
  market?: "domestic" | "foreign";
  prev: M[]; // 작년 지급(작년 0건이면 재작년도 0건으로 본다)
  cur: M[]; // 올해 조회된 지급(오늘까지)
  freq: Freq[];
  est: number[][];
};

const rows = (y: number, ms: M[], usd: boolean): Raw[] =>
  ms.map((m) => {
    const [mm, dd] = String(m).split("-");
    return { payoutDate: `${y}-${mm.padStart(2, "0")}-${dd ?? "15"}`, amountPerShare: usd ? 0.25 : 100, ...(usd ? { amountForeign: 0.25, currency: "USD" } : {}) };
  });
const r = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const TABLE: Row[] = [
  // ── D-1: 작년 중간 상장·누락(5.183 1차 qa) ──
  { id: "D1-1", name: "월배당 작년 3월 상장(작년 10건), 4월", today: "2027-04-20", prev: r(3, 12), cur: r(1, 4), freq: ["monthly"], est: [r(5, 12)] },
  { id: "D1-2", name: "월배당 작년 5월 상장(작년 8건), 4월", today: "2027-04-20", prev: r(5, 12), cur: r(1, 4), freq: ["monthly"], est: [r(5, 12)] },
  { id: "D1-3", name: "월배당 작년 5월 상장, 8월", today: "2027-08-20", prev: r(5, 12), cur: r(1, 8), freq: ["monthly"], est: [r(9, 12)] },
  { id: "D1-4", name: "분기 작년 8월 시작(작년 2건), 5월", today: "2027-05-20", prev: [8, 11], cur: [2, 5], freq: ["quarterly"], est: [[8, 11]] },
  { id: "D1-5", name: "월배당 작년·올해 3회씩 누락(9건), 11월", today: "2026-11-28", prev: [1, 2, 3, 4, 5, 6, 8, 10, 11], cur: [1, 2, 3, 4, 5, 6, 8, 10, 11], freq: ["monthly"], est: [[12]] },
  // ── D-2: 국내 반기 4·8월(5.183 재qa) ──
  { id: "D2-1", name: "반기 4·8 정상, 5월(올해 4월 지급)", today: "2026-05-10", prev: [4, 8], cur: [4], freq: ["semiannual"], est: [[8], [10]] },
  { id: "D2-2", name: "반기 4·8, 결산 지급 4→3월 앞당김, 3월", today: "2026-03-25", prev: ["4-20", "8-20"], cur: ["3-25"], freq: ["semiannual"], est: [[8], [9]] },
  { id: "D2-3", name: "D2-2 같은 종목, 4월", today: "2026-04-20", prev: ["4-20", "8-20"], cur: ["3-25"], freq: ["semiannual"], est: [[8], [9]] },
  { id: "D2-4", name: "반기 4·8 → 2월(2개월 앞당김), 3월", today: "2026-03-10", prev: [4, 8], cur: [2], freq: ["semiannual"], est: [[8]] },
  { id: "D2-5", name: "반기 4·10 → 3·9, 9월", today: "2026-09-20", prev: [4, 10], cur: [3, 9], freq: ["semiannual"], est: [[]] },
  { id: "D2-6", name: "반기 5·11 → 4·10, 10월", today: "2026-10-20", prev: [5, 11], cur: [4, 10], freq: ["semiannual"], est: [[]] },
  { id: "D2-7", name: "반기 4·8 정상, 11월(올해 지급 완료)", today: "2026-11-28", prev: [4, 8], cur: [4, 8], freq: ["semiannual"], est: [[]] },
  // ── 특별배당(5.183 재qa 5절) ──
  // main FAIL 아님(반기 10). 연간·0이 상식이나 금액이 같으면 반기 4·12와 구별 불가 → main 이하만 요구
  { id: "S-1", name: "연1회 4월 + 작년 12월 특별, 5월", today: "2026-05-20", prev: [4, 12], cur: [4], freq: ["annual", "semiannual"], est: [[], [10]] },
  // S-2a main FAIL(반기 10), S-2b main 통과(A 규칙으로 10월 제외): 특별 8월로 올해 2회 = 반기 회수 채움 → 추정 0
  { id: "S-2a", name: "연1회 4월 + 올해 8월 특별, 9월", today: "2026-09-10", prev: [4], cur: [4, 8], freq: ["annual", "semiannual"], est: [[]] },
  { id: "S-2b", name: "연1회 4월 + 올해 8월 특별, 11월", today: "2026-11-28", prev: [4], cur: [4, 8], freq: ["annual", "semiannual"], est: [[]] },
  // main FAIL(월배당 11·12): 분기 배지. 12월 정기분 추정은 있어도 없어도 허용(0 = 보수적)
  { id: "S-3", name: "분기 + 올해 특별 1회(3·4·6·9), 11월", today: "2026-11-28", prev: [3, 6, 9, 12], cur: [3, 4, 6, 9], freq: ["quarterly"], est: [[], [12]] },
  // main FAIL(월배당 11·12). '올해 4건 초과 → 월배당' 단순 규칙은 이 행을 깨므로 쓰지 않는다
  { id: "S-4", name: "분기 + 올해 특별 2회(3·4·6·9·10), 11월", today: "2026-11-28", prev: [3, 6, 9, 12], cur: [3, 4, 6, 9, 10], freq: ["quarterly"], est: [[], [12]] },
  // main 분기 7·10. 반기·10이 상식이나 작년 3건(4·6·10)은 불규칙 분기와 구별 불가 → main 이하(7월 가짜 회차 제거는 개선)
  { id: "S-5", name: "반기 + 작년 특별(4·6·10), 5월", today: "2026-05-20", prev: [4, 6, 10], cur: [4], freq: ["semiannual", "quarterly"], est: [[10], [7, 10]] },
  { id: "S-6", name: "분기 3·6·9·12 → 2·5 앞당김, 5월", today: "2026-05-20", prev: [3, 6, 9, 12], cur: [2, 5], freq: ["quarterly"], est: [[8, 11]] },
  // ── 연 1회 지급월 이동(main 기존 결함) ──
  // main FAIL(월배당 4~12)
  { id: "Y-1", name: "연1회 4월 → 3월, 3월", today: "2026-03-25", prev: [4], cur: [3], freq: ["annual"], est: [[]] },
  // main FAIL(월배당 11·12)
  { id: "Y-2", name: "연1회 4월 → 3월, 11월", today: "2026-11-28", prev: [4], cur: [3], freq: ["annual"], est: [[]] },
  // main FAIL(월배당 5~12)
  { id: "Y-3", name: "연1회 3월 → 4월(늦어짐), 5월", today: "2026-05-20", prev: [3], cur: [4], freq: ["annual"], est: [[]] },
  // main FAIL(분기 5·8·11)
  { id: "Y-4", name: "연1회 4월 → 2월(2개월), 3월", today: "2026-03-10", prev: [4], cur: [2], freq: ["annual"], est: [[]] },
  { id: "Y-5", name: "연1회 4월 정상, 11월", today: "2026-11-28", prev: [4], cur: [4], freq: ["annual"], est: [[]] },
  // 가드: 작년·올해 1건씩이어도 실제 경과 간격이 짧으면 빈도 유지(연간으로 바꾸는 단순 수정 방지)
  { id: "Y-G1", name: "월배당 작년 12월 상장, 1월", today: "2026-01-20", prev: [12], cur: [1], freq: ["monthly"], est: [r(2, 12)] },
  { id: "Y-G2", name: "분기 작년 12월 시작, 4월", today: "2026-04-10", prev: [12], cur: [3], freq: ["quarterly"], est: [[6, 9, 12]] },
  // ── CEO 초기 6패턴(오늘 11-28, 삼성은 진행 중 1행 추가) ──
  // main FAIL(월배당 12)
  { id: "C-1", name: "삼성 4·5·8·11 완료", today: "2026-11-28", prev: ["4-18", "5-20", "8-20", "11-20"], cur: ["4-17", "5-20", "8-20", "11-20"], freq: ["quarterly"], est: [[]] },
  // main FAIL(월배당 9~12): 남은 1회(실제 11월). 격자 규칙이면 10월 → 둘 다 허용
  { id: "C-1b", name: "삼성형 진행 중(4·5·8), 9월", today: "2026-09-10", prev: ["4-18", "5-20", "8-20", "11-20"], cur: ["4-17", "5-20", "8-20"], freq: ["quarterly"], est: [[10], [11]] },
  { id: "C-2", name: "SK하이닉스형 분기 1·4·10(7월 누락)", today: "2026-11-28", prev: ["1-20", "4-20", "7-20", "10-20"], cur: ["1-20", "4-20", "10-20"], freq: ["quarterly"], est: [[]] },
  { id: "C-3", name: "TIGER형 월배당 7·9월 누락", today: "2026-11-28", prev: r(1, 12), cur: [1, 2, 3, 4, 5, 6, 8, 10, 11], freq: ["monthly"], est: [[12]] },
  { id: "C-4", name: "KODEX형 분기 4·7만 조회", today: "2026-11-28", prev: [1, 4, 7, 10], cur: [4, 7], freq: ["quarterly"], est: [[]] },
  { id: "C-5", name: "Apple형 분기 2·5·8·11", today: "2026-11-28", market: "foreign", prev: [2, 5, 8, 11], cur: [2, 5, 8, 11], freq: ["quarterly"], est: [[]] },
  { id: "C-6", name: "NVIDIA형 분기 3·6·9", today: "2026-11-28", market: "foreign", prev: [3, 6, 9, 12], cur: [3, 6, 9], freq: ["quarterly"], est: [[12]] },
  // ── 운영 스모크 관찰(11-28): NVDA KIS가 올해 3월만 줌(6·9월 누락) ──
  { id: "P-1", name: "NVDA 운영형 올해 3월만", today: "2026-11-28", market: "foreign", prev: [3, 6, 9, 12], cur: [3], freq: ["quarterly"], est: [[12]] },
  // ── 추가 가드 ──
  // G-1만 main FAIL(월배당 5~12): 5.183 B 테스트 원래 기대(반기·0) 복원. G-2~G-6은 main 통과(회귀 방지)
  { id: "G-1", name: "반기 작년 3·9 + 올해 2·3 완료, 5월", today: "2026-05-10", prev: [3, 9], cur: [2, 3], freq: ["semiannual"], est: [[]] },
  { id: "G-2", name: "올해 7월 신규 상장 월배당(작년·재작년 0건)", today: "2026-11-28", prev: [], cur: r(7, 11), freq: ["monthly"], est: [[12]] },
  { id: "G-3", name: "올해 신규 분기 5·8·11(작년 0건)", today: "2026-11-28", prev: [], cur: [5, 8, 11], freq: ["quarterly"], est: [[]] },
  { id: "G-4", name: "월배당 정상 1~5월, 5월", today: "2026-05-20", prev: r(1, 12), cur: r(1, 5), freq: ["monthly"], est: [r(6, 12)] },
  { id: "G-5", name: "반기 6월 지급, 12월 남음", today: "2026-11-28", prev: [6, 12], cur: [6], freq: ["semiannual"], est: [[12]] },
  { id: "G-6", name: "이번 달 회차 미조회 분기 2·5·8, 11월", today: "2026-11-28", prev: [2, 5, 8, 11], cur: [2, 5, 8], freq: ["quarterly"], est: [[11]] },
];

afterEach(() => vi.useRealTimers());

describe("5.184 B 빈도 판정 고정 패턴표", () => {
  it.each(TABLE)("$id $name", async (row) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${row.today}T03:00:00Z`)); // KST 12:00
    const y = +row.today.slice(0, 4);
    const market = row.market ?? "domestic";
    const t = `FX${row.id.replace(/[^A-Z0-9]/gi, "").toUpperCase()}`; // 라우트가 티커를 대문자로 바꾼다
    kis[`${t}:${y}`] = rows(y, row.cur, market === "foreign");
    kis[`${t}:${y - 1}`] = rows(y - 1, row.prev, market === "foreign");
    const { GET } = await import("../route");
    const p = GET(new NextRequest(`https://example.test/api/finance/dividend?ticker=${t}&type=${market}`));
    await vi.runAllTimersAsync(); // 연도 사이 500ms 대기
    const data: Array<{ payoutDate: string; isEstimated?: boolean; frequency: string }> = (await (await p).json()).data;
    const freqs = new Set(data.map((d) => d.frequency));
    const est = data.filter((d) => d.isEstimated).map((d) => +d.payoutDate.slice(5, 7));
    // 한 종목의 행은 모두 같은 빈도
    expect(freqs.size).toBe(1);
    expect(row.freq).toContain([...freqs][0]);
    expect(row.est.map((e) => e.join(","))).toContain(est.join(","));
  });
});
