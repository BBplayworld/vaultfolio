export type AssetMode = "screenshot" | "manual";

export function dispatchAddRealEstate() {
  window.dispatchEvent(new CustomEvent("trigger-add-real-estate"));
}

export function dispatchAddStock(mode: AssetMode) {
  window.dispatchEvent(new CustomEvent("trigger-add-stock", { detail: { mode } }));
}

// 현금·대출 잔액 맞추기(#93) 화면 열기 — 보유자의 FAB `직접 입력`이 호출, BalanceResyncDialog가 수신
export function dispatchResyncBalance(category: "cash" | "loan") {
  window.dispatchEvent(new CustomEvent("trigger-resync-balance", { detail: { category } }));
}

export function dispatchAddTrade(stockId?: string) {
  window.dispatchEvent(new CustomEvent("trigger-add-trade", { detail: { stockId } }));
}

export function dispatchAddCashTx(cashId?: string) {
  window.dispatchEvent(new CustomEvent("trigger-add-cash-tx", { detail: { cashId } }));
}

export function dispatchAddLoanTx(loanId?: string) {
  window.dispatchEvent(new CustomEvent("trigger-add-loan-tx", { detail: { loanId } }));
}

export function dispatchAddCryptoTx(cryptoId?: string) {
  window.dispatchEvent(new CustomEvent("trigger-add-crypto-tx", { detail: { cryptoId } }));
}

// 인증카드(공유 스크린샷) 다이얼로그를 그 자리에서 오픈 — top-bar.tsx의 ShareScreenshotButton이 리스닝.
// 홈 기능 활용 팁 박스에서 페이지 이동 없이 바로 열기 위한 용도(S-4.32).
// 방문 기록은 리스너(top-bar.tsx) 쪽에서 함께 남긴다(asset-dispatch.ts↔feature-usage.ts 순환 참조 방지).
// variant 지정 시 해당 카드 타입으로 바로 진입(#4.24 — 홈 "새 공지" 팁이 포트폴리오로 직행할 때 사용).
export function dispatchOpenShareCard(variant?: "stock" | "portfolio" | "type") {
  window.dispatchEvent(new CustomEvent("trigger-open-share-card", { detail: { variant } }));
}

// 과거 순자산 입력창 열기 요청(1회성) — FAB가 연 탭으로 이동한 뒤 YearlyNetAssetChart가 마운트되는 시점이
// 불확실해 타이머 대신 요청을 기록해 두고, 차트가 ⓐ마운트 시 ⓑ이벤트 수신 시 꺼내 쓴다(한 번 쓰면 소멸).
// 이동 중 다른 화면으로 가면 짧은 유효시간이 지나 폐기된다(setTimeout 없이 요청 시각 비교).
export const YEARLY_NET_ASSET_OPEN_TTL_MS = 3000;
let yearlyOpenRequestedAt: number | null = null;

export function dispatchOpenYearlyNetAsset(now: number = Date.now()) {
  yearlyOpenRequestedAt = now;
  window.dispatchEvent(new CustomEvent("trigger-add-yearly-net-asset"));
}

export function consumeYearlyNetAssetOpenRequest(now: number = Date.now()): boolean {
  const at = yearlyOpenRequestedAt;
  yearlyOpenRequestedAt = null;
  return at !== null && now - at <= YEARLY_NET_ASSET_OPEN_TTL_MS;
}

// 자산 추가 폼 열기 이벤트(FAB 방법 선택·스크린샷 실패 박스 [직접 입력]이 공용) — 단일 정의
export const ADD_TRIGGER_EVENTS = {
  "real-estate": "trigger-add-real-estate",
  "stock": "trigger-add-stock",
  "crypto": "trigger-add-crypto",
  "cash": "trigger-add-cash",
  "loan": "trigger-add-loan",
  "yearly-net-asset": "trigger-add-yearly-net-asset",
} as const;
