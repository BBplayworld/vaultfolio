export type AssetMode = "screenshot" | "manual";

export function dispatchAddRealEstate() {
  window.dispatchEvent(new CustomEvent("trigger-add-real-estate"));
}

export function dispatchAddStock(mode: AssetMode) {
  window.dispatchEvent(new CustomEvent("trigger-add-stock", { detail: { mode } }));
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
export function dispatchOpenShareCard(variant?: "stock" | "portfolio") {
  window.dispatchEvent(new CustomEvent("trigger-open-share-card", { detail: { variant } }));
}
