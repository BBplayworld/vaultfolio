// 5.161 맞추기 결과 대조 1줄 — 경계·문장·숨김 조건(C138)
import { describe, expect, it } from "vitest";
import {
  applyResync, collectReconcileRows, computeDiff, mergeScreens, reconcileGaCategory, reconcileLines, reconcileTotal, reconcileTolerance, resolveScreens,
  isStockTotalLabel, type ReconcileFlags, type ReconcileRow, type ScreenTotalInfo,
} from "..";
import { emptySel, row, screen, st, TODAY } from "./fixtures";
import { readFileSync } from "node:fs";
import path from "node:path";

const T = (value: number, label = "총 평가금액", currency: ScreenTotalInfo["currency"] = "KRW"): ScreenTotalInfo => ({ value, label, currency });
const OK: ReconcileFlags = { okShots: 1, shotProblem: false, unapplied: false, stalePrice: false, foreignRateUnsynced: false, undone: false };
const R = (name: string, screenValue: number, appValue: number): ReconcileRow => ({ name, screenValue, appValue });
const rows = (app: number) => [R("삼성전자", app, app)];

describe("허용 오차 경계", () => {
  it("총액 10만 원 → 1,000원, 1,000만 원 → 5만 원, 정확히 같으면 일치·1원 넘으면 차이", () => {
    expect(reconcileTolerance(100_000)).toBe(1000);
    expect(reconcileTolerance(10_000_000)).toBe(50_000);
    expect(reconcileTotal({ screenTotal: T(100_000), rows: rows(101_000), flags: OK }).state).toBe("match");
    expect(reconcileTotal({ screenTotal: T(100_000), rows: rows(101_001), flags: OK }).state).toBe("diff");
    expect(reconcileTotal({ screenTotal: T(10_000_000), rows: rows(10_050_000), flags: OK }).state).toBe("match");
    expect(reconcileTotal({ screenTotal: T(10_000_000), rows: rows(9_949_999), flags: OK }).state).toBe("diff");
  });
});

describe("문장(§5 표, 글자 단위)", () => {
  it("일치: 증권사 화면 합계와 맞아요 / GA match", () => {
    const v = reconcileTotal({ screenTotal: T(10_000_000), rows: rows(10_040_000), flags: OK });
    expect(reconcileLines(v)).toEqual(["증권사 화면 합계와 맞아요"]);
    expect(reconcileGaCategory(v)).toBe("resync_check_match");
  });
  it("차이 + 다른 행 3개: 2.4% · 큰 순서 2개 + 외 1개", () => {
    const rs = [R("삼성전자", 5_000_000, 5_130_000), R("TIGER 미국S&P500", 3_000_000, 3_100_000), R("SK하이닉스", 1_000_000, 1_010_000), R("KODEX 200", 1_000_000, 1_000_000)];
    // 화면 합 10,000,000 vs 앱 합 10,240,000 → 2.4%
    const v = reconcileTotal({ screenTotal: T(10_000_000), rows: rs, flags: OK });
    expect(reconcileLines(v)).toEqual([
      "증권사 화면 합계와 2.4% 달라요. 시세 시각이 달라 조금 다를 수 있어요",
      "차이가 큰 종목: 삼성전자, TIGER 미국S&P500 외 1개",
    ]);
    expect(reconcileGaCategory(v)).toBe("resync_check_diff");
  });
  it("차이 + 다른 행 없음: 안 담긴 종목 문구", () => {
    const rs = [R("a", 5_000_000, 5_000_000), R("b", 5_000_000, 5_000_000)];
    const v = reconcileTotal({ screenTotal: T(10_240_000), rows: rs, flags: OK });
    expect(reconcileLines(v)).toEqual(["증권사 화면 합계와 2.3% 달라요. 시세 시각이 달라 조금 다를 수 있어요", "화면에 안 담긴 종목이 있을 수 있어요"]);
  });
  it("행 2개만 다르면 '외 N개' 없음", () => {
    const v = reconcileTotal({ screenTotal: T(10_000_000), rows: [R("a", 5_000_000, 5_200_000), R("b", 5_000_000, 5_100_000)], flags: OK });
    expect(reconcileLines(v)[1]).toBe("차이가 큰 종목: a, b");
  });
  it("문장에 금액 숫자·금지 어휘가 없다", () => {
    const all = [reconcileLines({ state: "match" }), reconcileLines({ state: "diff", ratePct: "2.4", names: ["a"], more: 0 })].flat().join(" ");
    for (const w of ["정확", "보장", "서버", "원"]) expect(all).not.toContain(w);
  });
});

describe("숨김 조건 1~6 → 줄 없음 · GA none", () => {
  const good = { screenTotal: T(1_000_000), rows: rows(1_000_000), flags: OK };
  const hidden = (o: { screenTotal?: ScreenTotalInfo | null; rows?: ReconcileRow[]; flags?: Partial<ReconcileFlags> }) => {
    const v = reconcileTotal({ ...good, ...o, flags: { ...OK, ...o.flags } });
    expect(v.state).toBe("hidden");
    expect(reconcileLines(v)).toEqual([]);
    expect(reconcileGaCategory(v)).toBe("resync_check_none");
  };
  it("기준: 숨김 사유가 없으면 보인다", () => expect(reconcileTotal(good).state).toBe("match"));
  it("1 총액 없음·0·음수·NaN·통화 KRW 아님", () => {
    hidden({ screenTotal: null });
    hidden({ screenTotal: undefined });
    hidden({ screenTotal: T(0) });
    hidden({ screenTotal: T(-5) });
    hidden({ screenTotal: T(NaN) });
    hidden({ screenTotal: T(1_000_000, "총 평가금액", "USD") });
  });
  it("2 라벨: 평가 없음·자산·예수금·예탁·추정·순", () => {
    for (const l of ["총자산", "추정자산", "예수금", "총 예탁자산", "순자산", "합계", "총평가금액 (예수금 포함)", "추정 평가금액", "순 평가금액", ""]) hidden({ screenTotal: T(1_000_000, l) });
    for (const l of ["총 평가금액", "총평가금액", "평가금액", "총 평가"]) expect(isStockTotalLabel(l)).toBe(true);
  });
  it("3 장 2장 이상·0장·실패·잘림·한도·실패 장 삭제", () => {
    hidden({ flags: { okShots: 2 } });
    hidden({ flags: { okShots: 0 } });
    hidden({ flags: { shotProblem: true } });
  });
  it("3-1 해외 종목 + 환율 미동기화", () => hidden({ flags: { foreignRateUnsynced: true } }));
  it("4 확인 필요·적용하지 않은 행", () => hidden({ flags: { unapplied: true } }));
  it("5 현재가 0·시세 실패", () => hidden({ flags: { stalePrice: true } }));
  it("6 되돌린 뒤", () => hidden({ flags: { undone: true } }));
  it("대응 행이 0개", () => hidden({ rows: [] }));
});

describe("collectReconcileRows — 실제 맞추기 결과와 이어붙이기", () => {
  const toss = { brokerHint: "토스증권" };
  const sam = st("s1", "005930", "domestic", "토스증권", 10, 70_000, { currentPrice: 70_000 });
  const k = st("s2", "000660", "domestic", "토스증권", 1, 100_000, { currentPrice: 100_000 });
  const other = st("s3", "035720", "domestic", "미래에셋증권", 3, 50_000);
  function run(existing: typeof sam[], items: ReturnType<typeof row>[]) {
    const resolved = resolveScreens([screen(0, items)], existing, { usdRate: 1400 });
    const diff = computeDiff(existing, mergeScreens(resolved), resolved);
    const sel = emptySel();
    const result = applyResync(existing, diff, sel, { today: TODAY, usdRate: 1400, now: 7 });
    return { diff, sel, result, c: collectReconcileRows({ diff, sel, result, existing, rates: { USD: 1400, JPY: 900 } }) };
  }
  it("변경 행은 맞춘 뒤 수량 × 앱 현재가, 화면에 없는 다른 증권사 종목은 합계에 안 들어간다", () => {
    const { c } = run([sam, k, other], [row("005930", 12, 70_000, toss), row("000660", 1, 100_000, toss)]);
    expect(c.unapplied).toBe(false);
    expect(c.rows.map((r) => r.appValue)).toEqual([840_000, 100_000]);
    expect(c.rows.map((r) => r.screenValue)).toEqual([840_000, 100_000]);
    expect(reconcileTotal({ screenTotal: T(940_000), rows: c.rows, flags: OK }).state).toBe("match");
  });
  it("신규 추가 행도 앱 값에 들어간다(화면 현재가)", () => {
    const { c } = run([sam], [row("005930", 10, 70_000, toss), row("000660", 2, 100_000, toss)]);
    expect(c.rows.map((r) => r.appValue)).toEqual([700_000, 200_000]);
  });
  it("앱 현재가가 화면과 다르면 행별 차이로 잡힌다", () => {
    const stale = { ...sam, currentPrice: 60_000 };
    const { c } = run([stale, k], [row("005930", 10, 70_000, { ...toss, currentPrice: 70_000 }), row("000660", 1, 100_000, toss)]);
    const v = reconcileTotal({ screenTotal: T(800_000), rows: c.rows, flags: OK });
    expect(v).toMatchObject({ state: "diff", names: ["이름005930"] });
  });
  it("현재가 0 종목이 있으면 stalePrice", () => {
    const zero = { ...sam, currentPrice: 0 };
    const { c } = run([zero], [row("005930", 10, 0, toss)]);
    expect(c.stalePrice).toBe(true);
  });
  it("확인 필요(수량 미인식) 행이 있으면 unapplied", () => {
    const { c } = run([sam], [row("005930", 1, 70_000, { ...toss, quantityMissing: true })]);
    expect(c.unapplied).toBe(true);
  });
});

describe("저장 0·전송 0 (소스 grep)", () => {
  it("reconcile.ts는 저장·네트워크 호출이 없고, 대화상자 GA는 category만 보낸다", () => {
    const base = path.join(__dirname, "..");
    const rec = readFileSync(path.join(base, "reconcile.ts"), "utf8");
    expect(rec).not.toMatch(/localStorage|fetch\(|saveData|track\(/);
    const dlg = readFileSync(path.join(base, "../../../app/(main)/_components/forms/asset-update/screenshot/holdings-resync-dialog.tsx"), "utf8");
    expect(dlg).toContain('track("feature_use", { category: reconcileGaCategory(view) });');
    expect(dlg).not.toMatch(/AssetData[^\n]*screenTotal|saveData\([^)]*reconcile/);
  });
});
