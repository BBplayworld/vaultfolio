// #339(5.169) 입금 폼 `M/D 지급일로` 버튼 결선(소스 고정, 5166 패턴) — 판정 자체는 latestPaidPayout·dividendDateQueryArgs 단위 테스트가 맡는다
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { featureTitleOf } from "@/lib/analytics/ga";

const src = readFileSync(resolve(__dirname, "../cash-tx-input.tsx"), "utf8");
const btn = src.slice(src.indexOf('data-testid="cash-tx-dividend-date-btn"') - 200, src.indexOf("지급일로\n", src.indexOf('data-testid="cash-tx-dividend-date-btn"')));

describe("지급일 버튼 결선", () => {
  it("조회는 dividendQueryOptions 경유(쿼리 키 리터럴 신설 0) + 국내형 게이트일 때만 enabled", () => {
    expect(src).toContain('const dateArgs = txType === "deposit" && pickedItems ? dividendDateQueryArgs(pickedItems) : null;');
    expect(src).toContain('useQuery({ ...dividendQueryOptions(dateArgs?.ticker ?? "", "domestic", "NAS"), enabled: !!dateArgs })');
    expect(src).toContain("const pickedItems = dividend && dividendStock !== NO_STOCK ? stockGroups.get(dividendStock) : undefined;");
    expect(src).not.toMatch(/"v13"|\/api\/finance\/dividend/);
  });
  it("조회 완료 + 후보 있을 때만 버튼(조회 중·실패는 DOM 0), 후보는 latestPaidPayout(오늘·폼 min)", () => {
    expect(src).toContain("const latestPaid = dateArgs && dateQuery.isSuccess ? latestPaidPayout(dateQuery.data, todayStr, minDate) : null;");
    expect(src).toContain("{latestPaid && (");
  });
  it("누르면 날짜만 바꾼다 — 금액·계좌·메모·반영 setValue 0, 적용됨은 no-op", () => {
    const fn = src.slice(src.indexOf("const applyPayoutDate"), src.indexOf("};", src.indexOf("const applyPayoutDate")));
    expect(fn).toContain("if (!latestPaid || dateApplied) return;");
    expect([...fn.matchAll(/form\.setValue\("(\w+)"/g)].map((m) => m[1])).toEqual(["date"]);
    // GA는 category 1개만
    expect(fn).toContain('track("feature_use", { category: "cash_dividend_date" });');
    expect(fn.match(/track\(/g)).toHaveLength(1);
  });
  it("종목 선택만으로 날짜가 바뀌지 않는다(종목 onValueChange에 date setValue 0)", () => {
    const sel = src.slice(src.indexOf("<Select value={dividendStock}"), src.indexOf("<SelectTrigger", src.indexOf("<Select value={dividendStock}")));
    expect(sel).not.toContain('"date"');
  });
  it("ui.md 2장 규격 — secondary·알약 24px·히트 40px·aria-disabled(disabled 아님)·brand/의미색 0·key 없음", () => {
    expect(btn).toContain('variant="secondary"');
    expect(btn).toContain("relative -my-[5px] h-6 gap-1 rounded-full");
    expect(btn).toContain("after:-top-[13px] after:-bottom-[3px]");
    expect(btn).toContain("aria-disabled={dateApplied || undefined}");
    expect(btn).toContain('data-state={dateApplied ? "applied" : "ready"}');
    expect(btn).toContain("motion-safe:animate-in motion-safe:fade-in-0");
    expect(btn).not.toMatch(/(?<![-\w])disabled=|\bkey=|brand|important|rose|red-|blue-|opacity-50/);
    expect(btn).toContain("aria-label={`${payM}/${payD} 지급일로 날짜 바꾸기`}");
  });
  it("스크린리더 알림은 항상 마운트(role=status)", () => {
    expect(src).toContain('<span role="status" data-testid="cash-tx-dividend-date-status" className="sr-only">{dateApplied ? dateStatus : ""}</span>');
    expect(src).toContain("setDateStatus(`날짜를 ${payM}월 ${payD}일로 바꿨어요`);");
  });
  it("GA 카테고리 등록", () => {
    expect(featureTitleOf("feature_use", { category: "cash_dividend_date" }, "cash")).toBe("현금·배당 입금 지급일로");
  });
});
