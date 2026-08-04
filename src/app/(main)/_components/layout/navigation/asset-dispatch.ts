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
