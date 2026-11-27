// #339(5.169) 입금 폼 계좌 기본값 결선 + 요약 상자 펼침(소스 고정). 판정(정확 일치·통화 가드)은 broker-cash-default-5169 단위 테스트가 맡는다.
// 진입 4경로: ① FAB(자유) ② 현금 탭 계좌 칩 ③ 계좌 입출금 화면 — cashId 전달 → lockedCash ④ 배당 받은 기록 칩 — 현금 1개면 고정, 2개 이상 자유
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8");
const src = read("../cash-tx-input.tsx");
const VIEWS = "../../../../views";

describe("계좌 기본값 결선", () => {
  const fn = src.slice(src.indexOf("const pickDividendStock"), src.indexOf("};", src.indexOf("const pickDividendStock")));
  it("종목 선택 onValueChange에서 1회 판정(effect 아님), 계좌 고정·`선택 안 함`은 건드리지 않음", () => {
    expect(src).toContain("<Select value={dividendStock} onValueChange={pickDividendStock}>");
    expect(fn).toContain("const items = v === NO_STOCK ? undefined : stockGroups.get(v);");
    expect(fn).toContain("if (lockedCash || !items) return;");
    expect(fn).toContain("candidate: brokerCashDefault(items, cashAccounts),");
    expect(fn).toContain('current: form.getValues("cashId"),');
    expect(fn).toContain("auto: autoCashId,");
    expect(fn).toContain('amount: form.getValues("amount"),');
    // 계좌 외 폼 값은 건드리지 않는다
    expect([...fn.matchAll(/form\.setValue\("(\w+)"/g)].map((m) => m[1])).toEqual(["cashId"]);
    expect(src).not.toMatch(/useEffect\([^)]*brokerCashDefault/);
    expect(src.match(/brokerCashDefault\(/g)).toHaveLength(1);
  });
  it("사용자가 계좌를 직접 고르면 규칙 값 표시를 지운다(이후 불변), 닫으면 초기화", () => {
    expect(src).toContain('onValueChange={(v) => { setAutoCashId(null); form.setValue("cashId", v); }}');
    const reset = src.slice(src.indexOf("const resetAndClose"), src.indexOf("}, [form]);", src.indexOf("const resetAndClose")));
    expect(reset).toContain("setAutoCashId(null);");
  });
  it("data-autofill — 규칙이 채운 값일 때만 broker, 새 문구 0", () => {
    expect(src).toContain('data-testid="cash-tx-account" data-autofill={selectedCashId && selectedCashId === autoCashId ? "broker" : "none"}');
  });
  it("계좌 고정 진입 ②③은 cashId를 넘기고, ④는 현금 1개일 때만 고정 — lockedCash면 계좌 칸 없음", () => {
    expect(read(`${VIEWS}/detail/tabs/cash-tab.tsx`)).toContain("dispatchAddCashTx(item.id)");
    expect(read(`${VIEWS}/detail/cash-tx/cash-tx-view.tsx`)).toContain("dispatchAddCashTx(cash.id)");
    expect(read(`${VIEWS}/activity/dividend-chart.tsx`)).toContain("dispatchAddCashTx(undefined, { dividend: true })");
    expect(src).toContain("const id = detail?.cashId ?? (detail?.dividend && cashAccountsRef.current.length === 1 ? cashAccountsRef.current[0].id : undefined);");
    expect(src).toContain("setLockedCash(true);");
    expect(src).toContain("{!lockedCash && (\n                  <FormItem>\n                    <FormLabel>계좌</FormLabel>");
  });
});

describe("요약 상자 펼침(ui.md 3장)", () => {
  const block = src.slice(src.indexOf('data-testid="cash-tx-account-block"'), src.indexOf("{/* 입금/출금 토글 */}"));
  it("항상 마운트한 grid 펼침 + 접힘 inert, 간격은 펼침 안쪽(계좌 고정이면 0)", () => {
    expect(block).toContain("inert={!selectedCash}");
    expect(block).toContain('grid ease-out motion-safe:transition-[grid-template-rows] motion-safe:duration-200 ${selectedCash ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}');
    expect(block).toContain('<div className="min-h-0 overflow-hidden">');
    expect(block).toContain('<div className={lockedCash ? "pt-0" : "pt-4"}>');
    // 요약 상자 클래스는 이전 그대로
    expect(block).toContain('data-testid="cash-tx-account-summary" className="flex items-center gap-2 rounded-lg bg-muted/50 dark:bg-muted/40 px-3 py-2 text-sm"');
    expect(block).not.toMatch(/transition-all|transition:\s*all/);
  });
});
