// 보유 현황 맞추기 — 저장 계획(순수). applyResync가 만든 stocks를 거래·대출과 함께 한 번의 저장 데이터로 묶는다(#310, 5.156).
// 결함 수정: 맞추기에서 체크해 실제로 지운 종목의 거래는 직접 삭제(planDeleteStocks)와 같은 규칙으로 정리한다 —
// 남겨 두면 반영 거래가 reflectedTradeFlow·tradedStockIds에 계속 합산돼 결산·홈 원인에 잔차가 생겼다.
// 삭제 규칙 함수는 contexts에 있으므로 호출측이 넘긴다(lib → contexts 의존 금지, 규칙 재구현 금지).
import type { AssetData } from "@/types/asset";
import type { ApplyResult } from "./apply";

/** 지운 종목 id 목록으로 거래를 정리한 데이터를 돌려주는 함수 — 호출측이 `planDeleteStocks(data, ids, rates)`를 넘긴다 */
export type PlanDeleteStocks = (data: AssetData, ids: string[]) => AssetData;

export interface ResyncSavePlan {
  /** 저장할 데이터 1건(stocks·transactions·loans를 함께) */
  data: AssetData;
}

/** 맞추기 적용 결과를 저장 데이터로 만든다. fresh = 저장 직전 getAssetData() 최신본, result = 같은 fresh.stocks로 계산한 applyResync 결과 */
export function planResyncSave(fresh: AssetData, result: Pick<ApplyResult, "stocks">, planDelete: PlanDeleteStocks): ResyncSavePlan {
  const kept = new Set(result.stocks.map((s) => s.id));
  const deleted = fresh.stocks.filter((s) => !kept.has(s.id)).map((s) => s.id);
  const transactions = deleted.length > 0 ? (planDelete(fresh, deleted).transactions ?? []) : fresh.transactions;
  return { data: { ...fresh, stocks: result.stocks, transactions } };
}
