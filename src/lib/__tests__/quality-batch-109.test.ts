// #109 품질 정돈 — (a) saveData 1회·탭 직접 saveData 제거, (b) 포커스 복귀 배선, (c) ProfitMetric 0 회색, (d) 외화 전액 차단 문구, (e) USD 반올림
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfitMetric } from "@/app/(main)/_components/views/detail/detail-summary-header";
import { getProfitLossColor } from "@/config/theme";
import { evaluateLink } from "@/lib/trade/link-text";
import { roundMoney } from "@/lib/trade/linked-record";
import { isCashWithdrawalBelowFloor } from "@/lib/trade/cash-tx-utils";
import type { AssetData } from "@/types/asset";

const root = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

describe("(a) 삭제 일원화", () => {
  const src = read("contexts/asset-data-context.tsx");
  const bodyOf = (name: string) => { const s = src.indexOf(`const ${name} = useCallback(`); return src.slice(s, src.indexOf("\n  );", s)); };
  it("deleteCryptos·deleteStocks는 saveData를 정확히 1회 호출하고, 단건은 래퍼", () => {
    for (const n of ["deleteCryptos", "deleteStocks"]) expect(bodyOf(n).match(/saveData\(/g)).toHaveLength(1);
    expect(bodyOf("deleteCrypto")).toContain("deleteCryptos([id])");
    expect(bodyOf("deleteStock")).toContain("deleteStocks([id])");
  });
  it("코인·주식 탭의 묶음 삭제는 직접 saveData를 쓰지 않고 컨텍스트 삭제를 호출한다", () => {
    const crypto = read("app/(main)/_components/views/detail/tabs/crypto-tab.tsx");
    const stock = read("app/(main)/_components/views/detail/tabs/stock-tab.tsx");
    const grp = (t: string) => t.slice(t.indexOf("const handleDeleteGroup"), t.indexOf("};", t.indexOf("const handleDeleteGroup")));
    expect(grp(crypto)).toContain("deleteCryptos(ids)");
    expect(grp(crypto)).not.toContain("saveData");
    expect(grp(stock)).toContain("deleteStocks(ids)");
    expect(grp(stock)).not.toContain("saveData");
  });
});

describe("(b) 잔액 맞추기 닫힘 포커스", () => {
  const dlg = read("app/(main)/_components/forms/asset-update/balance-resync-dialog.tsx");
  it("이 창만 onCloseAutoFocus를 쓴다: FAB → 열기 직전 요소 → main", () => {
    expect(dlg).toContain("onCloseAutoFocus={restoreFocus}");
    expect(dlg).toContain("restoreFocusAfterDialog(openerRef.current)"); // #115: FAB → 열기 직전 요소 → main 순서는 공용 함수(restore-focus.ts)로 이동
    const util = read("lib/restore-focus.ts");
    expect(util).toContain('[data-tutorial="tutorial-fab"]');
    expect(util.indexOf("(fab ?? connected ?? main)")).toBeGreaterThan(0);
    const others = ["forms/asset-update/cash-tx-dialog.tsx"].filter((f) => { try { read(`app/(main)/_components/${f}`); return true; } catch { return false; } });
    expect(others).toHaveLength(0);
  });
});

describe("(c) ProfitMetric 0 표시", () => {
  const html = (profit: number, cost = 1_000_000) => renderToStaticMarkup(createElement(ProfitMetric, { label: "평가손익", profit, cost, decimals: 1, formatShort: (v: number) => `${v.toLocaleString("ko-KR")}원` })).replace(/<!-- -->/g, "");
  it("0원: 부호 없음·회색·0.0%", () => {
    const h = html(0);
    expect(h).toContain("0원");
    expect(h).toContain("(0.0%)");
    expect(h).not.toContain("+0");
    expect(h).toContain("text-muted-foreground");
    expect(h).not.toContain(getProfitLossColor(0));
  });
  it("반올림 후 0(0.4원)도 회색·부호 없음", () => {
    const h = html(0.4);
    expect(h).not.toContain("+");
    expect(h).toContain("text-muted-foreground");
  });
  it("±1원 이상은 현행 그대로(부호·색)", () => {
    const up = html(1_000), down = html(-1_000);
    expect(up).toContain("+1,000원");
    expect(up).toContain(getProfitLossColor(1_000));
    expect(down).toContain("-1,000원");
    expect(down).toContain(getProfitLossColor(-1_000));
    expect(up).not.toContain("text-muted-foreground");
  });
  it("getProfitLossColor는 불변(0 = 수익색)", () => {
    expect(getProfitLossColor(0)).toBe(getProfitLossColor(1));
  });
});

describe("(d) 외화 전액 차단 문구", () => {
  const d = (currency: "KRW" | "USD", balance: number): AssetData => ({
    realEstate: [], stocks: [], crypto: [], cash: [{ id: "a", type: "bank", name: "달러통장", balance, currency }], loans: [],
    yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [], lastUpdated: "x", nickname: "",
  });
  it("연결 계좌 zero 문구: USD는 달러 표기, KRW는 현행과 한 글자도 같다", () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-12T03:00:00Z"));
    const t = { type: "buy" as const, quantity: 10, price: 100, date: "2026-11-10", name: "AAPL" };
    const usd = evaluateLink(d("USD", 1000), { ...t, currency: "USD" }, "cash:a", true);
    expect(usd).toMatchObject({ state: "error", message: "달러통장 잔액을 $0으로 둘 수 없어요. 연결 안 함으로 저장하거나 맞추기로 잔액을 고쳐 주세요." });
    if (usd.state === "error") expect(usd.message).not.toContain("0원");
    const krw = evaluateLink(d("KRW", 1_000_000), { ...t, price: 100_000, currency: "KRW" }, "cash:a", true);
    expect(krw).toMatchObject({ message: "달러통장 잔액을 0원으로 둘 수 없어요. 연결 안 함으로 저장하거나 맞추기로 잔액을 고쳐 주세요." });
    vi.useRealTimers();
  });
  it("입출금 입력 문구는 통화 표기(formatCurrencyDisplay)를 쓴다", () => {
    const src = read("app/(main)/_components/forms/asset-update/input/cash-tx-input.tsx");
    expect(src).toContain("잔액을 ${formatCurrencyDisplay(0, cash.currency)}으로 둘 수 없어요. 반영을 끄고 기록하거나 출금액을 줄여 주세요.");
    expect(src).not.toContain("잔액을 0원으로");
  });
});

describe("(e) USD 반영 입출금 잔액 반올림", () => {
  it("1,000.00에서 999.99 출금 → 정확히 0.01", () => {
    expect(roundMoney(1000 - 999.99, "USD")).toBe(0.01);
    expect(1000 - 999.99).not.toBe(0.01); // 보정 전 부동소수 오차
    expect(isCashWithdrawalBelowFloor(1000, 999.99, "USD")).toBe(false);
  });
  it("KRW·JPY는 정수 그대로", () => {
    expect(roundMoney(1_000_000 - 1, "KRW")).toBe(999_999);
    expect(roundMoney(5000 + 123, "JPY")).toBe(5123);
  });
  it("저장 잔액·미리보기가 같은 roundMoney를 쓴다", () => {
    const src = read("app/(main)/_components/forms/asset-update/input/cash-tx-input.tsx");
    expect(src.match(/roundMoney\(/g)).toHaveLength(2);
  });
});
