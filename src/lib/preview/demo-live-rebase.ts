/**
 * preview/demo-live-rebase.ts — 체험·미리보기 데모의 스냅샷을 '실시간 시세 수준'으로 재기준(4.94 ui-review R1).
 * 데모 JSON의 주식·코인 가격은 고정값이지만 체험은 실시간 시세로 가격을 덮어쓴다. 스냅샷이 JSON 가격 수준이면
 * 전일 대비·7일·허브가 가짜 급등락이 된다. 시세가 얼마나 움직여도(0.4~2.5배 이상) 같은 배율로 스냅샷의 주식·코인 평가를 맞춘다.
 * 순수 함수만 둔다(저장 접근은 demo-snapshot-rebase.tsx). 부동산·현금·대출·투입원가는 시세 무관이라 건드리지 않는다.
 */

import type { DailyAssetSnapshot, MonthlyAssetSnapshot } from "@/types/asset";

type Row = DailyAssetSnapshot | MonthlyAssetSnapshot;

/** 기준 평가액 — 오늘 이전 가장 늦은 enrich 일별 기록의 주식·코인(스케일 배율의 분모) */
export function pickRebaseRef(daily: DailyAssetSnapshot[], today: string): { stocks: number; crypto: number } | null {
  const row = [...daily].filter((d) => d?.date && d.date < today && d.breakdown).sort((a, b) => b.date.localeCompare(a.date))[0];
  return row?.breakdown ? { stocks: row.breakdown.stocks, crypto: row.breakdown.crypto } : null;
}

/** 배율 = 현재(실시간) 평가액 / 기준 평가액. 기준이 0이면 1 */
export const rebaseRatio = (live: number, ref: number): number => (ref > 0 && live >= 0 ? live / ref : 1);

/**
 * rows의 주식·코인 평가를 ks·kc배로 옮긴다. enrich 기록은 breakdown·netAsset·financialAsset·fxBase.USD(외화 주식 노출, 근사)를 함께,
 * net-only 기록은 기준 평가액 몫만큼 netAsset·financialAsset을 옮긴다. cost·fx·부동산·현금·대출은 그대로. 입력은 바꾸지 않는다.
 */
export function rebaseDemoRows<T extends Row>(rows: T[], ref: { stocks: number; crypto: number }, ks: number, kc: number): T[] {
  return rows.map((r) => {
    const b = r.breakdown;
    const dS = b ? b.stocks * (ks - 1) : ref.stocks * (ks - 1);
    const dC = b ? b.crypto * (kc - 1) : ref.crypto * (kc - 1);
    const next = { ...r, netAsset: Math.round(r.netAsset + dS + dC), financialAsset: Math.round(r.financialAsset + dS + dC) };
    if (b) {
      next.breakdown = { ...b, stocks: Math.round(b.stocks * ks), crypto: Math.round(b.crypto * kc) };
      if (r.fxBase) next.fxBase = { ...r.fxBase, USD: Math.round(r.fxBase.USD * ks) };
    }
    return next as T;
  });
}
