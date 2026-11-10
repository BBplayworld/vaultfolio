// 월별 기록(#127, 4.67) — 줄 조립(buildMonthlyLog): 실사용 형태 픽스처(S9)에서 합 검증·순자산만 줄·기록 없음 줄·
// 열 노출·정렬·Hero 끝값 일치·진입 행 조건·금액 표기, 앞 기록 대비 변화(buildMonthlyLogChanges, R3)
import { describe, expect, it } from "vitest";
import {
  buildMonthlyLog, buildMonthlyLogChanges, formatMonthlyLogAmount, formatMonthlyLogDelta, MONTHLY_LOG_KEYS, type MonthlyLogRow,
} from "../monthly-log";
import { resolveSettlementWindow, shiftMonth } from "../settlement";
import { buildLiveAttributionCurr } from "../asset-report";
import { computeAssetCost, computeNetAsset } from "@/contexts/asset-data-context";
import { computeSettlementCauses, settlementDelta } from "@/app/(main)/_components/views/activity/change-hero";
import type { AssetData, MonthlyAssetSnapshot, SnapshotBreakdown } from "@/types/asset";

const RATES = { USD: 1400, JPY: 900 };
const TODAY = "2026-11-15";

type Bd = SnapshotBreakdown;
const snap = (month: string, netAsset: number, opts: { date?: string; breakdown?: Bd } = {}): MonthlyAssetSnapshot => ({
  month, netAsset, financialAsset: 0, ...(opts.date ? { date: opts.date } : {}), ...(opts.breakdown ? { breakdown: opts.breakdown } : {}),
});
/** breakdown 합으로 netAsset을 맞춘 정상 스냅샷(저장 코드와 같은 식) */
const ok = (month: string, date: string | undefined, b: Bd): MonthlyAssetSnapshot =>
  snap(month, b.realEstate + (b.physical ?? 0) + b.stocks + b.crypto + b.cash - b.loans - (b.tenantDeposit ?? 0), { date, breakdown: b });

// 이번 달 실데이터: 부동산(임차보증금 있음)·USD 현금·원화 현금·대출·실물(11월 신규 등록)
const liveData = {
  realEstate: [{ id: "r1", name: "집", currentValue: 600_000_000, purchasePrice: 500_000_000, tenantDeposit: 150_000_000 }],
  stocks: [], crypto: [],
  cash: [
    { id: "c1", name: "예금", balance: 12_000_000, currency: "KRW", type: "bank" },
    { id: "c2", name: "달러 예금", balance: 3_000, currency: "USD", type: "bank" },
  ],
  loans: [{ id: "l1", name: "주담대", balance: 200_000_000, interestRate: 4 }],
  physicalAssets: [{ id: "p1", type: "gold", name: "금", currentValue: 2_000_000, purchasePrice: 1_500_000, purchaseDate: "2026-11-02" }],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-11-15T00:00:00.000Z",
} as unknown as AssetData;
const nab = computeNetAsset(liveData, RATES);
const summary = {
  ...nab, realEstateCost: 0, physicalCost: 0, stockCost: 0, cryptoCost: 0,
} as never as Parameters<typeof buildLiveAttributionCurr>[2];
const live = buildLiveAttributionCurr(liveData, RATES, summary);
const LIVE = { breakdown: live.breakdown, netAsset: nab.netAsset };

// S9 픽스처 — 25년 12월(연 경계·정상) · 1~6월 breakdown 없음(1~3월 date도 없음) · 7월 tenantDeposit 필드 없음+임차보증금 ·
// 8월 정상 · 9월 빠짐 · 10월 정상(USD 현금은 그달 환율로 저장된 원화값) · 11월 이번 달(live, 실물 신규)
const S9: MonthlyAssetSnapshot[] = [
  ok("2025-12", "2025-12-29", { realEstate: 580_000_000, stocks: 0, crypto: 0, cash: 15_000_000, loans: 210_000_000, tenantDeposit: 150_000_000, physical: 0 }),
  ...["01", "02", "03"].map((m) => snap(`2026-${m}`, 230_000_000 + Number(m))),
  ...["04", "05", "06"].map((m) => snap(`2026-${m}`, 235_000_000, { date: `2026-${m}-27` })),
  // 구버전 저장분: tenantDeposit 필드 없음 — netAsset은 보증금 차감 값이라 합 불일치
  snap("2026-07", 240_000_000, { date: "2026-07-30", breakdown: { realEstate: 590_000_000, stocks: 0, crypto: 0, cash: 10_000_000, loans: 210_000_000 } }),
  ok("2026-08", "2026-08-28", { realEstate: 595_000_000, stocks: 0, crypto: 0, cash: 14_000_000, loans: 205_000_000, tenantDeposit: 150_000_000 }),
  ok("2026-10", "2026-10-31", { realEstate: 600_000_000, stocks: 0, crypto: 0, cash: 12_000_000 + 3_000 * 1380, loans: 202_000_000, tenantDeposit: 150_000_000 }),
];

const byMonth = (rows: MonthlyLogRow[]) => Object.fromEntries(rows.map((r) => [r.month, r]));
const sumOf = (r: Extract<MonthlyLogRow, { kind: "full" }>) =>
  r.values.realEstate + r.values.physical + r.values.stocks + r.values.crypto + r.values.cash - r.values.loans - r.values.tenantDeposit;

describe("buildMonthlyLog — S9 실사용 픽스처", () => {
  const log = buildMonthlyLog(S9, TODAY, LIVE);
  const m = byMonth(log.rows);

  it("최신순(이번 달 맨 위), 첫 기록 달 ~ 이번 달만, 9월은 기록 없음 줄", () => {
    expect(log.rows.map((r) => r.month)).toEqual([
      "2026-11", "2026-10", "2026-09", "2026-08", "2026-07", "2026-06", "2026-05", "2026-04", "2026-03", "2026-02", "2026-01", "2025-12",
    ]);
    expect(m["2026-09"].kind).toBe("gap");
    expect(log.recordedCount).toBe(11);
    expect(log.firstMonth).toBe("2025-12");
    expect(log.currentMonth).toBe("2026-11");
    expect(log.atLimit).toBe(false);
  });

  it("각 full 줄의 자산군 합 = 순자산(±1원), 불일치·breakdown 없음 줄은 순자산만", () => {
    for (const r of log.rows) if (r.kind === "full") expect(Math.abs(sumOf(r) - r.netAsset)).toBeLessThanOrEqual(1);
    for (const mo of ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"]) expect(m[mo].kind).toBe("net-only");
    for (const mo of ["2025-12", "2026-08", "2026-10", "2026-11"]) expect(m[mo].kind).toBe("full");
    expect(log.hasNetOnly).toBe(true);
  });

  it("기록일: 이번 달 '오늘'·진행 중, 지난 달 M/D, date 없는 레거시 'YYYY-MM 기록'", () => {
    const cur = m["2026-11"] as Extract<MonthlyLogRow, { kind: "full" }>;
    expect(cur.current).toBe(true);
    expect(cur.recordLabel).toBe("오늘");
    expect((m["2026-10"] as Extract<MonthlyLogRow, { kind: "full" }>).recordLabel).toBe("10/31");
    expect((m["2025-12"] as Extract<MonthlyLogRow, { kind: "full" }>).recordLabel).toBe("12/29");
    expect((m["2026-02"] as Extract<MonthlyLogRow, { kind: "net-only" }>).recordLabel).toBe("2026-02 기록");
    expect((m["2026-05"] as Extract<MonthlyLogRow, { kind: "net-only" }>).recordLabel).toBe("5/27");
    expect(log.rows.filter((r) => r.kind !== "gap" && r.current)).toHaveLength(1);
  });

  it("이번 달 = live(USD 현금은 오늘 환율), 지난 달 = 저장 원화값 그대로", () => {
    const cur = m["2026-11"] as Extract<MonthlyLogRow, { kind: "full" }>;
    expect(cur.values.cash).toBe(12_000_000 + 3_000 * RATES.USD);
    expect(cur.values.physical).toBe(2_000_000);
    expect(cur.values.tenantDeposit).toBe(150_000_000);
    expect(cur.netAsset).toBe(nab.netAsset);
    expect((m["2026-10"] as Extract<MonthlyLogRow, { kind: "full" }>).values.cash).toBe(12_000_000 + 3_000 * 1380);
  });

  it("열: 한 번이라도 0이 아닌 자산군만(실물 신규 → 열 생김, 이전 달은 0), 주식·암호화폐 0이면 없음", () => {
    expect(log.columns).toEqual(["realEstate", "physical", "cash", "loans", "tenantDeposit"]);
    expect((m["2026-10"] as Extract<MonthlyLogRow, { kind: "full" }>).values.physical).toBe(0);
  });

  it("선택 달 순자산 = 결산 Hero 끝값(settlementDelta) — 지난 달 전부·이번 달", () => {
    for (const r of log.rows) {
      if (r.kind === "gap") continue;
      const { currValue } = settlementDelta(resolveSettlementWindow(S9, r.month, TODAY), LIVE.netAsset);
      expect(r.netAsset).toBe(currValue);
    }
  });
});

describe("buildMonthlyLog — 기록된 달 수·경계", () => {
  const full = (month: string) => ok(month, `${month}-28`, { realEstate: 0, stocks: 1_000_000, crypto: 0, cash: 500_000, loans: 0, tenantDeposit: 0, physical: 0 });
  const liveSmall = { breakdown: { realEstate: 0, stocks: 2_000_000, crypto: 0, cash: 0, loans: 0, tenantDeposit: 0, physical: 0 }, netAsset: 2_000_000 };

  it("스냅샷 0개 → 이번 달 1줄, 기록된 달 1(진입 행 숨김 조건)", () => {
    const log = buildMonthlyLog([], TODAY, liveSmall);
    expect(log.rows).toHaveLength(1);
    expect(log.recordedCount).toBe(1);
  });

  it("이번 달 스냅샷만 저장 → 기록된 달 1, 이번 달 줄은 저장값이 아니라 live", () => {
    const log = buildMonthlyLog([full("2026-11")], TODAY, liveSmall);
    expect(log.recordedCount).toBe(1);
    expect(log.rows[0].kind === "full" && log.rows[0].values.stocks).toBe(2_000_000);
    expect(log.rows[0].kind !== "gap" && log.rows[0].netAsset).toBe(2_000_000);
  });

  it("2개월(지난 달 1 + 진행 중) → 2줄, 기록된 달 2", () => {
    const log = buildMonthlyLog([full("2026-10")], TODAY, liveSmall);
    expect(log.rows.map((r) => r.month)).toEqual(["2026-11", "2026-10"]);
    expect(log.recordedCount).toBe(2);
    expect(log.hasNetOnly).toBe(false);
  });

  it("13개월 보존 최대 → 13줄 + 한도 캡션 조건, 창 밖(14개월 전)·미래 달은 줄을 만들지 않음", () => {
    const months = Array.from({ length: 13 }, (_, i) => shiftMonth("2026-11", -i - 1)); // 2026-10 ~ 2025-10(창 밖 1개 포함)
    const log = buildMonthlyLog([...months.map(full), full("2026-12")], TODAY, liveSmall);
    expect(log.rows).toHaveLength(13);
    expect(log.rows[log.rows.length - 1].month).toBe("2025-11");
    expect(log.rows.some((r) => r.month === "2025-10" || r.month === "2026-12")).toBe(false);
    expect(log.atLimit).toBe(true);
    expect(log.recordedCount).toBe(13);
  });

  it("연 경계(1월): 지난해 달도 13개월 안이면 보이고 순서 유지", () => {
    const log = buildMonthlyLog([full("2025-11"), full("2025-12")], "2026-01-05", liveSmall);
    expect(log.rows.map((r) => r.month)).toEqual(["2026-01", "2025-12", "2025-11"]);
    expect(log.firstMonth).toBe("2025-11");
  });

  it("live breakdown 없음(계산 실패 분기) → 이번 달도 순자산만", () => {
    const log = buildMonthlyLog([full("2026-10")], TODAY, { netAsset: 5 });
    expect(log.rows[0].kind).toBe("net-only");
  });

  it("합 오차 1원 이하는 통과, 1원 초과는 순자산만", () => {
    const b = { realEstate: 0, stocks: 1_000_000, crypto: 0, cash: 0, loans: 0, tenantDeposit: 0, physical: 0 };
    const a = buildMonthlyLog([snap("2026-10", 1_000_001, { date: "2026-10-30", breakdown: b })], TODAY, liveSmall);
    const c = buildMonthlyLog([snap("2026-10", 1_000_002, { date: "2026-10-30", breakdown: b })], TODAY, liveSmall);
    expect(a.rows[1].kind).toBe("full");
    expect(c.rows[1].kind).toBe("net-only");
  });

  it("구버전 기기가 쓴 달(실물 보유인데 physical 필드 없음) → 합 불일치로 순자산만", () => {
    const b = { realEstate: 0, stocks: 1_000_000, crypto: 0, cash: 0, loans: 0, tenantDeposit: 0 };
    const log = buildMonthlyLog([snap("2026-10", 3_000_000, { date: "2026-10-30", breakdown: b })], TODAY, liveSmall);
    expect(log.rows[1].kind).toBe("net-only");
  });

  it("순자산 음수도 그대로 둔다", () => {
    const log = buildMonthlyLog([ok("2026-10", "2026-10-30", { realEstate: 0, stocks: 0, crypto: 0, cash: 1_000_000, loans: 5_000_000, tenantDeposit: 0 })], TODAY, liveSmall);
    expect(log.rows[1].kind !== "gap" && log.rows[1].netAsset).toBe(-4_000_000);
  });

  it("열 키는 정해진 순서(자산 5종 → 부채 2종)", () => {
    expect(MONTHLY_LOG_KEYS).toEqual(["realEstate", "physical", "stocks", "crypto", "cash", "loans", "tenantDeposit"]);
  });
});

describe("표기", () => {
  it("변화 금액: 0 → '0원'(부호 없음), 양수 '+', 음수 U+2212, 원 단위 반올림", () => {
    expect(formatMonthlyLogDelta(0)).toBe("0원");
    expect(formatMonthlyLogDelta(0.4)).toBe("0원");
    expect(formatMonthlyLogDelta(-0.4)).toBe("0원");
    expect(formatMonthlyLogDelta(16_866_081)).toBe("+16,866,081원");
    expect(formatMonthlyLogDelta(-523_000)).toBe("\u2212523,000원");
    expect(formatMonthlyLogDelta(-523_000)).not.toContain("-");
    expect(formatMonthlyLogDelta(1_234.6)).toBe("+1,235원");
  });

  it("짧은 금액: 1만원 이상 '원' 생략, 1만원 미만·0은 '원', 음수·부채는 U+2212", () => {
    expect(formatMonthlyLogAmount(12_340_000, "short")).toBe("1,234만");
    expect(formatMonthlyLogAmount(1_230_000_000, "short")).toBe("12.3억");
    expect(formatMonthlyLogAmount(1_234_567_890, "short")).toBe("12.34억");
    expect(formatMonthlyLogAmount(5_000, "short")).toBe("5,000원");
    expect(formatMonthlyLogAmount(0, "short")).toBe("0원");
    expect(formatMonthlyLogAmount(0, "full", true)).toBe("0원");
    expect(formatMonthlyLogAmount(120_000_000, "short", true)).toBe("−1.2억");
    expect(formatMonthlyLogAmount(-4_000_000, "short")).toBe("−400만");
  });

  it("1억 이상 짧은 표기는 소수 둘째 자리 버림·끝 0 제거(COO U1 — 0.1억 버림으로 월 변화가 사라지지 않게)", () => {
    expect(formatMonthlyLogAmount(644_450_000, "short")).toBe("6.44억");
    expect(formatMonthlyLogAmount(621_000_000, "short")).toBe("6.21억");
    expect(formatMonthlyLogAmount(660_097_840, "short")).toBe("6.6억");
    expect(formatMonthlyLogAmount(100_000_000, "short")).toBe("1억");
    expect(formatMonthlyLogAmount(1_000_000_000, "short")).toBe("10억");
    expect(formatMonthlyLogAmount(215_000_000, "short", true)).toBe("\u22122.15억");
    expect(formatMonthlyLogAmount(-400_000_000, "short")).toBe("\u22124억");
    // 1억 미만은 기존 만 단위 그대로
    expect(formatMonthlyLogAmount(99_990_000, "short")).toBe("9,999만");
    // 데모 8월(612,000,000)·9월(621,000,000)이 같은 글자로 보이지 않는다
    expect(formatMonthlyLogAmount(612_000_000, "short")).not.toBe(formatMonthlyLogAmount(621_000_000, "short"));
  });

  it("1억 이상 짧은 표기 부동소수 오차 없음(COO U2) — 대표 사례", () => {
    expect(formatMonthlyLogAmount(230_000_000, "short")).toBe("2.3억");
    expect(formatMonthlyLogAmount(410_000_000, "short")).toBe("4.1억");
    expect(formatMonthlyLogAmount(870_000_000, "short")).toBe("8.7억");
    expect(formatMonthlyLogAmount(201_000_000, "short")).toBe("2.01억");
    expect(formatMonthlyLogAmount(113_000_000, "short")).toBe("1.13억");
    expect(formatMonthlyLogAmount(230_000_000, "short", true)).toBe("\u22122.3억");
    expect(formatMonthlyLogAmount(-113_000_000, "short")).toBe("\u22121.13억");
    expect(formatMonthlyLogAmount(229_999_999, "short")).toBe("2.29억"); // 100만원 미만은 내림
  });

  it("1억~50억 100만원 배수 전체가 정수 계산 기대값과 일치(양수·부채)", () => {
    const mismatches: string[] = [];
    for (let k = 100; k <= 5_000; k++) {
      const frac = k % 100;
      const expected = `${Math.floor(k / 100).toLocaleString("ko-KR")}${frac ? `.${String(frac).padStart(2, "0").replace(/0+$/, "")}` : ""}억`;
      const v = k * 1_000_000;
      if (formatMonthlyLogAmount(v, "short") !== expected) mismatches.push(`${v}:${formatMonthlyLogAmount(v, "short")}≠${expected}`);
      if (formatMonthlyLogAmount(v, "short", true) !== `\u2212${expected}`) mismatches.push(`debt ${v}`);
    }
    expect(mismatches).toEqual([]);
  });

  it("원 단위(sm 이상): 콤마 원, 부채 −", () => {
    expect(formatMonthlyLogAmount(1_234_567_890, "full")).toBe("1,234,567,890원");
    expect(formatMonthlyLogAmount(200_000_000, "full", true)).toBe("−200,000,000원");
    expect(formatMonthlyLogAmount(-1_500, "full")).toBe("−1,500원");
    expect(formatMonthlyLogAmount(-1_500, "full")).not.toContain("-");
  });
});

describe("buildMonthlyLogChanges — 앞 기록 대비 변화(R3)", () => {
  const T = "2026-11-05";
  const bd = (re: number, st: number, cash: number, loans: number, extra: Partial<Bd> = {}): Bd =>
    ({ realEstate: re, stocks: st, crypto: 0, cash, loans, tenantDeposit: 0, physical: 0, ...extra });
  const liveOf = (b: Bd) => ({ breakdown: b, netAsset: b.realEstate + (b.physical ?? 0) + b.stocks + b.crypto + b.cash - b.loans - (b.tenantDeposit ?? 0) });

  it("첫 기록 달은 키 없음, 다음 달은 바로 앞 달과 비교(skipped 없음)", () => {
    const log = buildMonthlyLog([ok("2026-10", "2026-10-28", bd(600, 40, 10, 200))], T, liveOf(bd(600, 45, 10, 200)));
    const ch = buildMonthlyLogChanges(log.rows);
    expect(ch.has("2026-10")).toBe(false);
    expect(ch.get("2026-11")).toMatchObject({ vsMonth: "2026-10", skipped: false, net: 5 });
  });

  it("gap 줄은 키 없음, 건너뛴 뒤 줄은 앞 기록 달과 비교하고 skipped", () => {
    const log = buildMonthlyLog([ok("2026-08", "2026-08-28", bd(600, 30, 0, 200)), ok("2026-10", "2026-10-28", bd(600, 40, 0, 200))], T, liveOf(bd(600, 41, 0, 200)));
    const ch = buildMonthlyLogChanges(log.rows);
    expect(log.rows.find((r) => r.month === "2026-09")!.kind).toBe("gap");
    expect(ch.has("2026-09")).toBe(false);
    expect(ch.get("2026-10")).toMatchObject({ vsMonth: "2026-08", skipped: true, net: 10 });
    expect(ch.get("2026-11")).toMatchObject({ vsMonth: "2026-10", skipped: false, net: 1 });
  });

  it("net-only 줄이 끼면 그 줄과 다음 줄의 groups는 null, 순자산 변화는 계산", () => {
    const log = buildMonthlyLog([
      ok("2026-08", "2026-08-28", bd(600, 30, 0, 200)),
      snap("2026-09", 435, { date: "2026-09-28" }), // breakdown 없음(레거시)
      ok("2026-10", "2026-10-28", bd(600, 40, 0, 200)),
    ], T, liveOf(bd(600, 50, 0, 200)));
    const ch = buildMonthlyLogChanges(log.rows);
    expect(ch.get("2026-09")).toMatchObject({ vsMonth: "2026-08", net: 5, groups: null });
    expect(ch.get("2026-10")).toMatchObject({ vsMonth: "2026-09", net: 5, groups: null });
    expect(ch.get("2026-11")!.groups).not.toBeNull();
  });

  it("대출 증가는 순자산 기여 감소(음수), 임차보증금 증가도 음수, 자산 증가는 양수", () => {
    const log = buildMonthlyLog(
      [ok("2026-10", "2026-10-28", bd(600_000_000, 30_000_000, 0, 20_000_000, { tenantDeposit: 100_000_000 }))],
      T, liveOf(bd(616_067_000, 32_089_081, 0, 20_523_000, { tenantDeposit: 110_000_000 })),
    );
    const g = buildMonthlyLogChanges(log.rows).get("2026-11")!.groups!;
    expect(g.loans).toBe(-523_000);
    expect(g.tenantDeposit).toBe(-10_000_000);
    expect(g.realEstate).toBe(16_067_000);
    expect(g.stocks).toBe(2_089_081);
  });

  // 화면 문자열 → 정수(원). 사용자가 화면 숫자로 직접 빼 보는 값
  const shownOf = (text: string) => (text === "0원" ? 0 : Number(text.replace(/원$/, "").replace(/,/g, "").replace("\u2212", "-")));
  const shownNet = (r: MonthlyLogRow) => shownOf(formatMonthlyLogAmount((r as Extract<MonthlyLogRow, { kind: "full" }>).netAsset, "full"));
  const shownGroup = (r: Extract<MonthlyLogRow, { kind: "full" }>, k: (typeof MONTHLY_LOG_KEYS)[number]) =>
    shownOf(formatMonthlyLogAmount(r.values[k], "full", k === "loans" || k === "tenantDeposit"));
  /** 모든 변화가 '이번 표시값 − 앞 표시값'인지(순자산·자산군) — 화면 숫자끼리 모순 0 */
  const expectShownDiffs = (rows: MonthlyLogRow[]) => {
    const ch = buildMonthlyLogChanges(rows);
    const m = byMonth(rows);
    let checked = 0;
    for (const [month, c] of ch) {
      const cur = m[month], prev = m[c.vsMonth];
      expect(c.net).toBe(shownNet(cur) - shownNet(prev));
      expect(formatMonthlyLogDelta(c.net)).toBe(formatMonthlyLogDelta(shownNet(cur) - shownNet(prev)));
      if (c.groups) {
        for (const k of MONTHLY_LOG_KEYS) {
          expect(c.groups[k]).toBe(shownGroup(cur as never, k) - shownGroup(prev as never, k));
          expect(Number.isInteger(c.groups[k])).toBe(true);
        }
        checked++;
      }
    }
    return { ch, checked };
  };

  it("변화 = 화면 표시값끼리의 차(순자산·자산군) — S9 실사용 픽스처 전 구간", () => {
    const { checked } = expectShownDiffs(buildMonthlyLog(S9, TODAY, LIVE).rows);
    expect(checked).toBeGreaterThan(0);
  });

  it("소수 원화값: 표시 7,000,001 − 6,000,000 → 변화 +1,000,001(qa R3 관찰 사례), 부채 소수도 표시값 차", () => {
    const log = buildMonthlyLog(
      [ok("2026-10", "2026-10-28", bd(300_000_000, 0, 10_000_000, 20_000_000.4, { crypto: 6_000_000 }))],
      T, liveOf(bd(300_000_000, 0, 10_000_000, 20_500_000.6, { crypto: 7_000_000.6 })),
    );
    const c = buildMonthlyLogChanges(log.rows).get("2026-11")!;
    expect(formatMonthlyLogAmount((log.rows[0] as Extract<MonthlyLogRow, { kind: "full" }>).values.crypto, "full")).toBe("7,000,001원");
    expect(c.groups!.crypto).toBe(1_000_001);
    // 대출 표시 −20,500,001원(−20,500,000.6 반올림) vs −20,000,000원 → −500,001
    expect(formatMonthlyLogAmount(20_500_000.6, "full", true)).toBe("\u221220,500,001원");
    expect(c.groups!.loans).toBe(-500_001);
    expectShownDiffs(log.rows);
  });

  it("소수 원화값: 자산군 변화 합과 순자산 변화의 차 = 두 줄의 '자산군 표시값 합 − 순자산 표시값' 차(반올림 잔차, 수 원)", () => {
    // 10월 100.4·200.4·300.4(표시 100·200·300, 합 600) 순자산 601.2(표시 601) → 11월 101·201·301(합 603) 순자산 603
    const log = buildMonthlyLog([ok("2026-10", "2026-10-28", bd(100.4, 200.4, 300.4, 0))], T, liveOf(bd(101, 201, 301, 0)));
    const c = buildMonthlyLogChanges(log.rows).get("2026-11")!;
    expect(c.net).toBe(2); // 603 − 601
    expect(c.groups).toMatchObject({ realEstate: 1, stocks: 1, cash: 1 }); // 각 줄 표시값 차
    const gap = (r: MonthlyLogRow) =>
      MONTHLY_LOG_KEYS.reduce((s, k) => s + shownGroup(r as never, k), 0) - shownNet(r);
    const sum = MONTHLY_LOG_KEYS.reduce((s, k) => s + (c.groups![k] ?? 0), 0);
    expect(sum - c.net).toBe(gap(log.rows[0]) - gap(log.rows[1])); // 0 − (−1) = 1
    expect(sum - c.net).toBe(1);
    expectShownDiffs(log.rows);
  });

  it("순자산 변화 = 결산 Hero 증감(settlementDelta) — 이번 달·지난 달", () => {
    const log = buildMonthlyLog(S9, TODAY, LIVE);
    const ch = buildMonthlyLogChanges(log.rows);
    for (const m of ["2026-11", "2026-10"]) {
      const w = resolveSettlementWindow(S9, m, TODAY);
      expect(ch.get(m)!.net).toBe(Math.round(settlementDelta(w, LIVE.netAsset).delta));
    }
  });

  it("소수 순자산 달도 순자산 변화(표시값 차) = 결산 Hero 증감 = Hero 끝 − 시작 화면 금액(COO R3 F1)", () => {
    // 10월 100.6(표시 101) → 11월 201.4(표시 201): 표시값 차 100, Hero도 round(201.4) − round(100.6) = 100
    const monthly = [ok("2026-10", "2026-10-28", bd(0, 0, 100.6, 0))];
    const liveV = liveOf(bd(0, 0, 201.4, 0));
    const c = buildMonthlyLogChanges(buildMonthlyLog(monthly, T, liveV).rows).get("2026-11")!;
    const { prevValue, currValue, delta } = settlementDelta(resolveSettlementWindow(monthly, "2026-11", T), liveV.netAsset);
    expect(c.net).toBe(100);
    expect(delta).toBe(100);
    expect(delta).toBe(Math.round(currValue) - Math.round(prevValue));
  });
});

// C48(COO R3 F1) — Hero 증감을 화면 금액 차(round(끝) − round(시작))로 바꿔도 원인 목록은 이전(b6b90d8: 원값 차)과
// '기록 안 된 변화' 최대 1원 외에는 같다. 소수 원화값 픽스처(해외주식×환율·코인 소수수량)로 causes 자체를 비교한다.
describe("C48 — settlementDelta 화면 금액 차 전환 전후 원인 목록", () => {
  const R_OCT = { USD: 1387.45, JPY: 900 };
  const R_NOV = { USD: 1391.27, JPY: 900 };
  const base = (): AssetData => ({
    realEstate: [], loans: [], physicalAssets: [], yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
    stocks: [{ id: "s1", category: "foreign", name: "애플", ticker: "AAPL", quantity: 3, averagePrice: 170.11, currentPrice: 190.37, currency: "USD", purchaseDate: "2024-06-02", purchaseExchangeRate: 1300 }],
    crypto: [{ id: "c1", name: "비트코인", symbol: "BTC", quantity: 0.0123457, averagePrice: 90_000_000, currentPrice: 101_234_567, purchaseDate: "2024-02-01" }],
    cash: [{ id: "k1", type: "bank", name: "통장", balance: 1_000_000, currency: "KRW" }],
    lastUpdated: "2026-10-28T09:00:00.000Z",
  }) as unknown as AssetData;
  const mkSnap = (d: AssetData, r: typeof R_OCT): MonthlyAssetSnapshot => {
    const n = computeNetAsset(d, r);
    const c = computeAssetCost(d, r);
    const usd = d.stocks.reduce((s, x) => s + (x.currency === "USD" ? x.quantity * x.currentPrice * r.USD : 0), 0);
    return {
      month: "2026-10", date: "2026-10-28", netAsset: n.netAsset, financialAsset: n.financialAsset,
      breakdown: { realEstate: n.realEstateValue, stocks: n.stockValue, crypto: n.cryptoValue, cash: n.cashValue, loans: n.loanBalance, tenantDeposit: n.tenantDepositTotal, physical: n.physicalValue },
      fx: { USD: r.USD, JPY: r.JPY }, fxBase: { USD: usd, JPY: 0 },
      cost: { total: c.realEstateCost + c.physicalCost + c.stockCost + c.cryptoCost + n.cashValue, stock: c.stockCost, crypto: c.cryptoCost, realEstate: c.realEstateCost, physical: c.physicalCost },
    };
  };

  it("소수 달: 시세·환율 항목 동일, 기록 안 된 변화만 ≤1원 차, 합계 = 새 Hero 증감", () => {
    const oct = base();
    const nov = base();
    nov.stocks = nov.stocks.map((s) => ({ ...s, currentPrice: 197.83 }));
    nov.crypto = nov.crypto.map((c) => ({ ...c, currentPrice: 103_456_814 }));
    nov.cash = nov.cash.map((c) => ({ ...c, balance: 1_500_000 })); // 기록 없는 현금 증가 → 기록 안 된 변화
    const snaps = [mkSnap(oct, R_OCT)];
    const n = computeNetAsset(nov, R_NOV);
    const c = computeAssetCost(nov, R_NOV);
    const summaryNov = { ...n, ...c } as unknown as Parameters<typeof buildLiveAttributionCurr>[2];
    const live = buildLiveAttributionCurr(nov, R_NOV, summaryNov);
    const w = resolveSettlementWindow(snaps, "2026-11", "2026-11-15");
    const { prevValue, currValue, delta } = settlementDelta(w, n.netAsset);
    // 픽스처가 실제로 '원값 차 반올림 ≠ 화면 금액 차'인 달인지(아니면 비교가 의미 없음)
    expect(prevValue % 1).not.toBe(0);
    expect(Math.round(currValue - prevValue)).not.toBe(delta);
    const args = { start: w.start, end: w.end, live, startDate: w.startDate, endDate: w.endDate, liveCash: n.cashValue, exchangeHistory: {}, assetData: nov, rates: R_NOV };
    const before = computeSettlementCauses({ ...args, deltaNet: currValue - prevValue }).mapped; // b6b90d8
    const after = computeSettlementCauses({ ...args, deltaNet: delta }).mapped;
    const amt = (m: typeof after, k: string) => m.causes.find((x) => x.key === k)?.amount ?? 0;
    expect(after.causes.filter((x) => x.key !== "unrecorded")).toEqual(before.causes.filter((x) => x.key !== "unrecorded"));
    expect(Math.abs(amt(after, "unrecorded") - amt(before, "unrecorded"))).toBeLessThanOrEqual(1);
    expect(after.causes.map((x) => x.key)).toEqual(before.causes.map((x) => x.key));
    expect(after.deltaNet).toBe(delta);
    expect(after.causes.reduce((s, x) => s + x.amount, 0)).toBe(delta);
  });
});
