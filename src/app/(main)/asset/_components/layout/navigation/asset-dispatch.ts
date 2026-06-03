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
