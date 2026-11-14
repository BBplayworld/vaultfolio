import { describe, it, expect } from "vitest";
import { PUSH_CATALOG, normalizePushTopics } from "../catalog";
import { PUSH_FALLBACK_BODY, PUSH_FALLBACK_TITLE, TAX_PUSH_DATES, buildSettleMessage, pushDueOn } from "../message";
import { TAX_EVENTS } from "@/config/tax-calendar";
import { isSettlementCardPeriod } from "@/lib/report/settlement";

// 요청형·조언·평가·금액 어휘 — 상태 안내만 허용
const BANNED = ["내 자산", "내자산", "보유", "평가", "순자산", "절세", "납입하세요", "손실", "실현", "하세요", "해 보세요", "확인해", "정리", "급락", "급등", "매수", "매도", "원)", "만원", "억", "대주주"];

describe("catalog", () => {
  it("ID 유일·4개(morning·kr·settle·tax), 주간·미국 단독 ID 없음", () => {
    expect(PUSH_CATALOG.map((t) => t.id)).toEqual(["morning", "kr", "settle", "tax"]);
  });
  it("normalize — 알 수 없는 ID(구버전 지수 ID)·중복 제거, 카탈로그 순서", () => {
    expect(normalizePushTopics(["tax", "zzz", "kospi", "spx", "settle", "tax", 3, "kr"])).toEqual(["kr", "settle", "tax"]);
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

// ── 시장 알림 문구 ──
import { PUSH_MERGE_ORDER, buildKrCloseMessage, buildMorningMessage, holidayMarketsOn, isRepeatedClose, mergePushPayloads } from "../message";
import type { PushQuote } from "../quotes";

const idx = (label: string, rate: number): PushQuote => ({ label, kind: "index", rate, price: 100 });
const fx = (rate: number, price = 1385.4): PushQuote => ({ label: "환율", kind: "fx", rate, price });

describe("아침 시장 요약", () => {
  const us = [idx("S&P 500", 0.8), idx("나스닥", 1.1)];
  const kr = [idx("코스피", 0.5), idx("코스닥", -0.3), fx(0.4)];
  it("제목·본문 틀 — 미국 | 국내(환율은 국내 구간 안) | 휴장 없으면 생략", () => {
    expect(buildMorningMessage("2026-11-24", us, kr, "daily")).toEqual({
      m: "morning",
      t: "11/24 아침 시장",
      b: "미국 S&P 500 +0.8% · 나스닥 +1.1% | 국내 코스피 +0.5% · 코스닥 -0.3% · 환율 1,385원(+0.4%)",
    });
  });
  it("오늘 휴장은 kr/us-holidays 상수로 — 11/26 미국, 12/25 둘 다, 평일은 없음", () => {
    expect(buildMorningMessage("2026-11-26", us, [], "daily")?.b).toBe("미국 S&P 500 +0.8% · 나스닥 +1.1% | 오늘 미국 휴장");
    expect(holidayMarketsOn("2026-12-25")).toEqual(["미국", "국내"]);
    expect(holidayMarketsOn("2026-11-24")).toEqual([]);
  });
  it("검증 실패 구간은 생략, 둘 다 비면 발송 안 함", () => {
    expect(buildMorningMessage("2026-11-24", [], kr, "daily")?.b.startsWith("국내")).toBe(true);
    expect(buildMorningMessage("2026-11-24", us, [idx("코스피", 0.5)], "daily")?.b).not.toContain("환율");
    expect(buildMorningMessage("2026-11-24", [], [], "daily")).toBeNull();
  });
  it("큰 움직임 항목(지수 ±2%·환율 ±1%)은 본문 맨 앞으로", () => {
    const m = buildMorningMessage("2026-11-24", us, [idx("코스피", 0.5), idx("코스닥", -2.4), fx(1.2)], "daily");
    expect(m?.b).toBe("국내 코스닥 -2.4% · 환율 1,385원(+1.2%) · 코스피 +0.5% | 미국 S&P 500 +0.8% · 나스닥 +1.1%");
  });
  it("조건 pm2 — 지수 ±2% 또는 환율 ±1%가 없으면 null, 있으면 발송(환율은 quotes에 있을 때=날짜 검증 통과 때만)", () => {
    expect(buildMorningMessage("2026-11-24", us, kr, "pm2")).toBeNull();
    expect(buildMorningMessage("2026-11-24", us, [idx("코스피", 0.1), fx(0.9)], "pm2")).toBeNull();
    expect(buildMorningMessage("2026-11-24", us, [idx("코스피", 0.1), fx(-1.0)], "pm2")?.b).toBe("국내 환율 1,385원(-1.0%) · 코스피 +0.1% | 미국 S&P 500 +0.8% · 나스닥 +1.1%");
    expect(buildMorningMessage("2026-11-24", us, [idx("코스피", 0.1)], "pm2")).toBeNull(); // 환율이 검증 탈락으로 빠지면 판정에 안 들어감
    expect(buildMorningMessage("2026-11-24", [idx("S&P 500", -2.0)], [], "pm2")?.b).toBe("미국 S&P 500 -2.0%");
  });
  it("금지어·평가어·조언 0", () => {
    const m = buildMorningMessage("2026-11-26", us, kr, "daily");
    const text = `${m?.t} ${m?.b}`;
    for (const w of ["보유", "평가", "하세요", "급락", "급등", "매수", "매도", "추천"]) expect(text).not.toContain(w);
  });
});

describe("국내 장 마감", () => {
  it("코스피·코스닥(+환율) 한 줄, 환율 없으면 지수 2개만", () => {
    expect(buildKrCloseMessage("2026-11-24", [idx("코스피", 0.5), idx("코스닥", -0.3), fx(0.4)], "daily")).toEqual({
      m: "kr",
      t: "11/24 국내 종가",
      b: "코스피 +0.5% · 코스닥 -0.3% · 환율 1,385원(+0.4%)",
    });
    expect(buildKrCloseMessage("2026-11-24", [idx("코스피", 0.5), idx("코스닥", -0.3)], "daily")?.b).toBe("코스피 +0.5% · 코스닥 -0.3%");
    expect(buildKrCloseMessage("2026-11-24", [], "daily")).toBeNull();
  });
  it("pm2는 지수 ±2% 또는 환율 ±1% 이상인 날만", () => {
    expect(buildKrCloseMessage("2026-11-24", [idx("코스피", 0.3), fx(1.1)], "pm2")?.b).toBe("환율 1,385원(+1.1%) · 코스피 +0.3%");
    expect(buildKrCloseMessage("2026-11-24", [idx("코스피", 1.9)], "pm2")).toBeNull();
    expect(buildKrCloseMessage("2026-11-24", [idx("코스피", -2.1), fx(0.2)], "pm2")?.b).toBe("코스피 -2.1% · 환율 1,385원(+0.2%)");
  });
});

describe("09시 합치기 — 결산 > 세금 > 아침 요약, 1건", () => {
  const settle = buildSettleMessage("2026-11-27");
  const morning = { m: "morning" as const, t: "11/27 아침 시장", b: "미국 S&P 500 +0.8%" };
  const tax = { m: "tax" as const, t: "연금저축·IRP 세액공제", b: "12/31 납입분까지예요" };
  it("우선순위 순서 상수", () => expect(PUSH_MERGE_ORDER.slice(0, 3)).toEqual(["settle", "tax", "morning"]));
  it("제목·도착 종류는 높은 우선순위, 나머지는 둘째 줄에 제목만", () => {
    expect(mergePushPayloads([morning, settle])).toEqual({ ...settle, b: `${settle.b}\n11/27 아침 시장` });
    expect(mergePushPayloads([morning, tax, settle])?.m).toBe("settle");
    expect(mergePushPayloads([morning, tax])?.m).toBe("tax");
  });
  it("1건이면 그대로, 0건이면 null", () => {
    expect(mergePushPayloads([morning])).toEqual(morning);
    expect(mergePushPayloads([])).toBeNull();
  });
});

describe("휴장표 — 2027 설날", () => {
  it("2/8(월)·2/9(화 대체) 휴장, 2/10(수)은 영업일", () => {
    expect(holidayMarketsOn("2027-02-08")).toContain("국내");
    expect(holidayMarketsOn("2027-02-09")).toContain("국내");
    expect(holidayMarketsOn("2027-02-10")).not.toContain("국내");
  });
});

describe("휴장 다음 날 같은 종가 반복 방지", () => {
  const q: PushQuote[] = [{ label: "코스피", kind: "index", rate: 0.5, price: 2500 }];
  it("추수감사절 다음 날(금 11/27) 미국은 반복, 국내는 새 종가", () => {
    expect(isRepeatedClose("2026-11-27", "us")).toBe(true);
    expect(isRepeatedClose("2026-11-27", "kr")).toBe(false);
  });
  it("평범한 화요일·월요일은 반복 아님", () => {
    expect(isRepeatedClose("2026-11-17", "us")).toBe(false);
    expect(isRepeatedClose("2026-11-16", "kr")).toBe(false);
  });
  it("설날 연휴 다음 영업일(2027-02-10) 국내는 반복", () => {
    expect(isRepeatedClose("2027-02-10", "kr")).toBe(true);
  });
  it("반복 구간은 수치 없이 '미국 직전 휴장'으로 표시, 나머지는 그대로", () => {
    const m = buildMorningMessage("2026-11-27", [], q, "daily");
    expect(m?.b).toBe("국내 코스피 +0.5% | 미국 직전 휴장");
  });
  it("보낼 새 수치가 없으면 미발송", () => {
    expect(buildMorningMessage("2026-11-27", [], [], "daily")).toBeNull();
  });
});
