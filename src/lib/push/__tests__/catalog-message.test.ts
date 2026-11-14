import { describe, it, expect } from "vitest";
import { PUSH_CATALOG, normalizePushTopics } from "../catalog";
import { PUSH_FALLBACK_BODY, PUSH_FALLBACK_TITLE, TAX_PUSH_DATES, buildSettleMessage, pushDueOn } from "../message";
import { TAX_EVENTS } from "@/config/tax-calendar";
import { isSettlementCardPeriod } from "@/lib/report/settlement";

// 요청형·조언·평가·금액 어휘 — 상태 안내만 허용
const BANNED = ["내 자산", "내자산", "보유", "평가", "순자산", "절세", "납입하세요", "손실", "실현", "하세요", "해 보세요", "확인해", "정리", "급락", "급등", "매수", "매도", "원)", "만원", "억", "대주주"];

describe("catalog", () => {
  it("ID 유일·2개(settle·tax), 지수·종목 ID 없음", () => {
    expect(PUSH_CATALOG.map((t) => t.id)).toEqual(["settle", "tax"]);
  });
  it("normalize — 알 수 없는 ID(구버전 지수 ID)·중복 제거, 카탈로그 순서", () => {
    expect(normalizePushTopics(["tax", "zzz", "kospi", "spx", "settle", "tax", 3])).toEqual(["settle", "tax"]);
  });
});

describe("pushDueOn — 날짜표", () => {
  it("결산 창 첫날(말일−3일)에만 월 결산 열림, 앱 결산 창과 같은 날", () => {
    expect(pushDueOn("2026-11-27").map((d) => d.kind)).toEqual(["settle"]);
    expect(pushDueOn("2026-11-26")).toEqual([]);
    expect(pushDueOn("2026-11-28")).toEqual([]);
    expect(pushDueOn("2026-02-25").map((d) => d.kind)).toEqual(["settle"]); // 평년 2월(28일)
    expect(pushDueOn("2028-02-26").map((d) => d.kind)).toEqual(["settle"]); // 윤년(29일)
    // 모든 달에서 첫날은 결산 카드 기간 안이고 그 전날은 밖이다(앱 결산 창 로직 재사용 확인)
    for (let m = 1; m <= 12; m++) {
      const last = new Date(Date.UTC(2026, m, 0)).getUTCDate();
      const open = `2026-${String(m).padStart(2, "0")}-${String(last - 3).padStart(2, "0")}`;
      const before = `2026-${String(m).padStart(2, "0")}-${String(last - 4).padStart(2, "0")}`;
      expect(pushDueOn(open).some((d) => d.kind === "settle")).toBe(true);
      expect(isSettlementCardPeriod(open)).toBe(true);
      expect(isSettlementCardPeriod(before)).toBe(false);
    }
  });
  it("세금 마감은 연 2건(5/1·12/24)만", () => {
    expect(pushDueOn("2026-05-01").map((d) => d.kind)).toEqual(["tax"]);
    expect(pushDueOn("2026-12-24").map((d) => d.kind)).toEqual(["tax"]);
    expect(Object.keys(TAX_PUSH_DATES)).toHaveLength(2);
    expect(pushDueOn("2026-05-02")).toEqual([]);
    expect(pushDueOn("2026-03-15")).toEqual([]);
  });
  it("세금 알림 근거 일정이 tax-calendar에 있다(5월 양도세·종소세, 12월 연금 납입 마감)", () => {
    const find = (id: string) => TAX_EVENTS.find((e) => e.id === id);
    expect(find("capital-gains-final")).toMatchObject({ month: 5, dueLabel: "~5/31" });
    expect(find("income-tax-final")).toMatchObject({ month: 5 });
    expect(find("pension-contribution-deadline")).toMatchObject({ month: 12, dueLabel: "~12/31" });
  });
});

describe("문구", () => {
  it("결산 문구 — 월·다음 달 10일, 12월은 1월로 넘어간다", () => {
    expect(buildSettleMessage("2026-11-27")).toEqual({ m: "settle", t: "11월 결산이 열렸어요", b: "12월 10일까지 이번 달 자산 변화를 볼 수 있어요" });
    expect(buildSettleMessage("2026-12-28").b).toBe("1월 10일까지 이번 달 자산 변화를 볼 수 있어요");
  });
  it("전 문구에 요청형·조언·평가·금액 0", () => {
    const texts = [
      JSON.stringify(buildSettleMessage("2026-11-27")),
      JSON.stringify(TAX_PUSH_DATES),
      PUSH_FALLBACK_TITLE,
      PUSH_FALLBACK_BODY,
    ].join(" ");
    for (const w of BANNED) expect(texts).not.toContain(w);
    expect(texts).not.toMatch(/(^|\s)내(\s|$)/);
    expect(texts).not.toMatch(/\d[\d,]*\s?(원|만\s?원|억)/);
    expect(texts).not.toMatch(/\d+%/);
  });
});
