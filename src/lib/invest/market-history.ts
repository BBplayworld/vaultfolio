// 투자 탭 정적 데이터 진입점. 투자 탭 번들(동적 import)에서만 import한다 — 첫 화면 번들에 넣지 않는다(spec 4-14).
import raw from "./data/market-history.generated.json";
import type { MarketHistoryData } from "./types";

export const marketHistory = raw as unknown as MarketHistoryData;
