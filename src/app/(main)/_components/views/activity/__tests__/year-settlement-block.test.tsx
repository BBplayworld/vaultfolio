// 5.124 #237 올해 결산 블록 — 묶음·펼침 화살표 조건·대출 없음 2행·현금 링크·결론 줄·전부 예측 안내·1월 초 머리 줄 DOM.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";
import {
  FIXTURE_TODAY, M, R0, R1, decEnd, fixtureMonthly, legacy, mkSnap, now, sDec, sNov, sOct, state, summaryOf,
} from "@/lib/report/__tests__/year-settlement-fixture";

const h = vi.hoisted(() => ({ track: vi.fn(), navigate: vi.fn() }));
vi.mock("@/lib/analytics/ga", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics/ga")>()), track: h.track }));
vi.mock("@/app/(main)/_components/layout/navigation/navigation-context", async (orig) => ({
  ...(await orig<typeof import("@/app/(main)/_components/layout/navigation/navigation-context")>()),
  useAssetNavigation: () => ({ navigate: h.navigate }),
}));

import { buildYearSettlementModel, YearSettlementBlock } from "../year-settlement-block";

const build = (o: { data?: AssetData; monthly?: MonthlyAssetSnapshot[]; today?: string } = {}) => {
  const data = o.data ?? now;
  const today = o.today ?? FIXTURE_TODAY;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${today}T03:00:00Z`));
  try {
    return buildYearSettlementModel({ assetData: data, monthly: o.monthly ?? fixtureMonthly, daily: [], rates: R1, exchangeHistory: {}, summary: summaryOf(data, R1), today });
  } finally {
    vi.useRealTimers();
  }
};
const html = (o: Parameters<typeof build>[0] = {}) => renderToStaticMarkup(<YearSettlementBlock model={build(o)} />);
const valueOf = (markup: string, testId: string) => Number(new RegExp(`data-testid="${testId}" data-value="(-?\\d+)"`).exec(markup)?.[1]);

describe("예측 섞임 픽스처(S2)", () => {
  const out = html();
  it("제목 `올해 결산`, 묶음 3행 금액, 기록 안 된 변화, 기간 행", () => {
    expect(out).toContain('data-testid="year-settle" data-state="mixed"');
    expect(out).toMatch(/data-testid="year-settle-title"[^>]*>올해 결산</);
    expect(valueOf(out, "year-settle-group-in")).toBe(3 * M);
    expect(valueOf(out, "year-settle-group-grow")).toBe(3_300_000);
    expect(valueOf(out, "year-settle-group-out")).toBe(-200_000);
    expect(valueOf(out, "cause-row-unrecorded")).toBe(-100_000);
    expect(valueOf(out, "year-settle-period-row")).toBe(12 * M);
    expect(out).toMatch(/data-testid="year-settle-period-label">1~10월</);
    expect(out).toContain("월 기록 전 기간");
    expect(out).toContain("10/31 기록까지");
  });
  it("순서: 결론 → 넣은 돈 → 불어난 돈 → 빠져나간 돈 → 기록 안 된 변화 → 기간 행", () => {
    const pos = ["year-settle-conclusion", "year-settle-group-in", "year-settle-group-grow", "year-settle-group-out", "cause-row-unrecorded", "year-settle-period-row"].map((id) => out.indexOf(`data-testid="${id}"`));
    expect(pos.every((p) => p >= 0)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
  });
  it("결론 줄은 비율과 기간만(금액 없음)", () => {
    const line = /data-testid="year-settle-conclusion"[^>]*>(.*?)<\/p>/.exec(out)![1].replace(/<[^>]+>/g, "");
    expect(line).toBe("11월부터 순자산을 늘린 금액은 넣은 돈 48%, 불어난 돈 52%예요");
    expect(out).not.toContain('data-testid="year-settle-period-note"');
  });
  it("하위 2행이면 펼침 버튼(기본 접힘)·패널에 시세 변동·환율 효과", () => {
    expect(out).toMatch(/data-testid="year-settle-grow-toggle" aria-expanded="false"/);
    const panel = out.slice(out.indexOf('data-testid="year-settle-grow-panel"'), out.indexOf('data-testid="year-settle-group-out"'));
    expect(valueOf(panel, "cause-row-price") + valueOf(panel, "cause-row-fx")).toBe(valueOf(out, "year-settle-group-grow"));
    expect(panel).toContain("inert");
  });
  it("배지·평면 목록·옛 문구·`0원`·머리 줄이 없고, Hero 증감과 같은 금액의 행이 없다", () => {
    for (const w of ["cause-estimated-badge", "예측", 'data-testid="cause-block"', "올해 입출금을 기록하면", "기록이 없던", ">0원<", 'data-testid="year-settle-head"', "순유입"]) expect(out, w).not.toContain(w);
    expect(out).not.toContain('data-value="18000000"');
  });
});

describe("상태별 DOM", () => {
  it("하위 1행이면 버튼·화살표 없이 도움말만", () => {
    const flatFx = now; // 환율이 같은 구간(R0)만 쓰면 시세 변동 1행
    const out = renderToStaticMarkup(<YearSettlementBlock model={(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(`${FIXTURE_TODAY}T03:00:00Z`));
      try {
        return buildYearSettlementModel({ assetData: flatFx, monthly: fixtureMonthly, daily: [], rates: R0, exchangeHistory: {}, summary: summaryOf(flatFx, R0), today: FIXTURE_TODAY });
      } finally { vi.useRealTimers(); }
    })()} />);
    expect(out).toContain('data-testid="year-settle-group-grow"');
    expect(out).not.toContain("year-settle-grow-toggle");
    expect(out).not.toContain("year-settle-grow-panel");
  });
  it("대출 없음(S10): 빠져나간 돈 행 DOM 없음", () => {
    const mk = (krwPrice: number, cash: number, y: number) => state({ krwPrice, cash, loan: 0, tx: now.cashTransactions, y2026: y, noLoan: true });
    const cur = mk(63000, 35 * M, 128_400_000);
    const out = html({ data: cur, monthly: [mkSnap(mk(60000, 32 * M, 0), R0, "2026-10", "2026-10-31"), mkSnap(mk(61000, 34 * M, 0), R0, "2026-11", "2026-11-30")] });
    expect(out).toContain('data-testid="year-settle-group-in"');
    expect(out).not.toContain("year-settle-group-out");
    expect(out).not.toContain("빠져나간 돈");
  });
  it("현금 링크: 기록 안 된 변화가 크고 입출금 기록이 없고 현금 계좌가 있으면 1개, 계좌 0개면 DOM 없음", () => {
    const noTx = (noCashAccount: boolean) => {
      const mk = (krwPrice: number, cash: number) => state({ krwPrice, cash, loan: 0, tx: [], y2026: 0, noLoan: true, noCashAccount });
      const cur = mk(61000, 40 * M);
      const sO = mkSnap(mk(60000, 32 * M), R0, "2026-10", "2026-10-31");
      const sN = mkSnap(mk(61000, 34 * M), R0, "2026-11", "2026-11-30");
      cur.yearlyNetAssets = [{ year: 2025, netAsset: sO.netAsset - 10 * M, note: "" }, { year: 2026, netAsset: sN.netAsset + 6 * M, note: "자동" }];
      return html({ data: cur, monthly: [sO, sN] });
    };
    const withCash = noTx(false);
    expect(withCash.match(/data-testid="year-settle-cash-link"/g)).toHaveLength(1);
    expect(withCash).toContain("입출금을 기록할 현금 계좌 고르기");
    expect(withCash.indexOf("year-settle-cash-link")).toBeGreaterThan(withCash.indexOf("cause-row-unrecorded"));
    expect(withCash.indexOf("year-settle-cash-link")).toBeLessThan(withCash.indexOf("year-settle-period-row"));
    expect(noTx(true)).not.toContain("year-settle-cash-link");
  });
  it("결론 규칙 밖(부호 섞임)이면 결론 줄 DOM이 없고 기간 캡션 1줄", () => {
    const big = { ...now, yearlyNetAssets: [{ year: 2025, netAsset: 100 * M, note: "" }, { year: 2026, netAsset: 140 * M, note: "" }] };
    const out = html({ data: big });
    expect(out).not.toContain("year-settle-conclusion");
    expect(out).toMatch(/data-testid="year-settle-period-note"[^>]*>11월부터 나눈 금액이에요</);
  });
  it("전부 예측(S3): 안내 1줄만, 행·결론·링크 없음", () => {
    const out = html({ monthly: [...legacy, fixtureMonthly.at(-1)!] });
    expect(out).toContain('data-state="estimated-only"');
    expect(out).toMatch(/data-testid="year-settle-empty"[^>]*>월 기록이 쌓이면 원인을 나눠 보여드려요</);
    for (const id of ["year-settle-group-", "year-settle-period-row", "year-settle-conclusion", "year-settle-cash-link", "cause-row-", "data-value="]) expect(out, id).not.toContain(id);
  });
  it("1월 초(S6): 제목 `2026년 결산` + 머리 줄, 현금 링크 없음", () => {
    const out = html({ data: decEnd, monthly: [sOct, sNov, sDec], today: "2027-01-05" });
    expect(out).toContain('data-state="closed"');
    expect(out).toMatch(/data-testid="year-settle-title"[^>]*>2026년 결산</);
    expect(out).toContain("2025년 말 → 2026년 말");
    expect(valueOf(out, "year-settle-head-delta")).toBe(19 * M);
    expect(out).toContain("2026년 11월부터 순자산을 늘린 금액은");
    expect(out).not.toContain("year-settle-cash-link");
  });
  it("오류: 현행 문구 유지", () => {
    const out = renderToStaticMarkup(<YearSettlementBlock status="error" />);
    expect(out).toMatch(/data-testid="cause-error"[^>]*>변화 원인을 불러오지 못했어요</);
  });
});
