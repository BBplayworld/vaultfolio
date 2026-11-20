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
  it("세금 일정은 연 7건(1/15·5/1·7/16·9/16·11/16·12/1·12/24)만, 달마다 1건·12월만 2건", () => {
    const dates = ["01-15", "05-01", "07-16", "09-16", "11-16", "12-01", "12-24"];
    expect(Object.keys(TAX_PUSH_DATES)).toEqual(dates);
    for (const y of [2026, 2027]) for (const d of dates) expect(pushDueOn(`${y}-${d}`).map((x) => x.kind)).toContain("tax");
    expect(pushDueOn("2026-05-02")).toEqual([]);
    expect(pushDueOn("2026-03-15")).toEqual([]);
    const perMonth = dates.map((d) => d.slice(0, 2));
    expect(perMonth.filter((m) => m === "12")).toHaveLength(2);
    expect(new Set(perMonth).size).toBe(6);
  });
  it("2026~2027 모든 날짜 — 세금·결산이 같은 날 겹치는 경우는 없고 하루 2건 이내, 11/27 결산 첫 발송은 결산 단독", () => {
    for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2028, 0, 1); t += 86400000) {
      const day = new Date(t).toISOString().slice(0, 10);
      const kinds = pushDueOn(day).map((d) => d.kind);
      expect(kinds.length).toBeLessThanOrEqual(2);
      expect(kinds.includes("tax") && kinds.includes("settle")).toBe(false);
    }
    expect(pushDueOn("2026-11-27").map((d) => d.kind)).toEqual(["settle"]);
    expect(pushDueOn("2026-11-16")[0].payload).toMatchObject({ m: "tax", t: "11월 세금 일정" });
  });
  it("세금 문구는 세목과 (대상) 괄호를 담는다", () => {
    for (const v of Object.values(TAX_PUSH_DATES)) expect(v.b.length).toBeGreaterThan(0);
    expect(TAX_PUSH_DATES["01-15"].b).toContain("(근로자)");
    expect(TAX_PUSH_DATES["11-16"].b).toContain("(작년 종소세를 낸 사업·임대소득자)");
  });
  it("세금 알림 근거 일정이 tax-calendar에 있다(5월 양도세·종소세, 12월 연금 납입 마감)", () => {
    const find = (id: string) => TAX_EVENTS.find((e) => e.id === id);
    expect(find("capital-gains-final")).toMatchObject({ month: 5, dueLabel: "~5/31" });
    expect(find("income-tax-final")).toMatchObject({ month: 5 });
    expect(find("pension-contribution-deadline")).toMatchObject({ month: 12, dueLabel: "~12/31" });
    expect(find("year-end-simplified-data")).toMatchObject({ month: 1 });
    expect(find("income-tax-interim")?.tags).not.toContain("common");
  });
  it("앱 세금 일정 상세에 권유 문구 없음", () => {
    const text = JSON.stringify(TAX_EVENTS);
    for (const w of ["채우세요", "점검하세요", "실현하면"]) expect(text).not.toContain(w);
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
import { PUSH_MERGE_ORDER, buildKrCloseMessage, buildMorningMessage, expectedCloseDate, holidayMarketsOn, isRepeatedClose, mergePushPayloads } from "../message";
import type { PushQuote } from "../quotes";

const idx = (label: string, rate: number): PushQuote => ({ label, kind: "index", rate, price: 100 });
const fx = (rate: number, price = 1385.4): PushQuote => ({ label: "환율", kind: "fx", rate, price });

// #241(5.126) spec 5절 단독 문자열 표 — 아침 = 직전 미국 장 종가(장 날짜 표기) + 오늘 환율. 국내 지수 0
describe("아침 시장 요약 — spec 표 1~19행(글자 단위)", () => {
  const us = [idx("S&P 500", 0.8), idx("나스닥", 1.1)];
  const US_TEXT = "S&P 500 +0.8% · 나스닥 +1.1%";
  const FX_TEXT = "환율 1,385원(+0.4%)";
  const body = (today: string, u: PushQuote[], f: PushQuote[], cond: "daily" | "pm2" = "daily") => buildMorningMessage(today, u, f, cond)?.b ?? null;
  // 운영 Cron과 같은 규칙: 미국 반복 거래일이면 미국 값은 조회하지 않아 빈 배열로 넘어온다
  const usFor = (today: string) => (isRepeatedClose(today) ? [] : us);

  it("1 평일 11/24(화) — 제목은 받은 날, 미국 머리는 미국 거래일", () => {
    expect(buildMorningMessage("2026-11-24", us, [fx(0.4)], "daily")).toEqual({
      m: "morning",
      t: "11/24 아침 시장",
      b: "미국 11/23 종가 S&P 500 +0.8% · 나스닥 +1.1% | 환율 1,385원(+0.4%)",
    });
  });
  it("2 월요일 11/23 — 금요일 장", () => {
    expect(body("2026-11-23", us, [fx(0.4)])).toBe("미국 11/20 종가 S&P 500 +0.8% · 나스닥 +1.1% | 환율 1,385원(+0.4%)");
  });
  it("3 하락·혼합 부호", () => {
    expect(body("2026-11-24", [idx("S&P 500", -2.3), idx("나스닥", 0.1)], [fx(-0.6, 1371)])).toBe("미국 11/23 종가 S&P 500 -2.3% · 나스닥 +0.1% | 환율 1,371원(-0.6%)");
  });
  it("4 환율 큰 움직임(±1%)이면 환율 묶음이 앞", () => {
    expect(body("2026-11-24", [idx("S&P 500", 0.4), idx("나스닥", 0.6)], [fx(1.2, 1402)])).toBe("환율 1,402원(+1.2%) | 미국 11/23 종가 S&P 500 +0.4% · 나스닥 +0.6%");
  });
  it("5 미국 휴장 당일 11/26(목)", () => {
    expect(body("2026-11-26", usFor("2026-11-26"), [fx(0.4)])).toBe(`미국 11/25 종가 ${US_TEXT} | ${FX_TEXT} | 오늘 미국 휴장`);
  });
  it("6 미국 휴장 다음 날 11/27(금) — 같은 종가를 반복하지 않고 쉰 날짜만", () => {
    expect(isRepeatedClose("2026-11-27")).toBe(true);
    expect(body("2026-11-27", usFor("2026-11-27"), [fx(0.4)])).toBe(`${FX_TEXT} | 미국 11/26 휴장`);
  });
  it("7 휴장 뒤 첫 장 다음 아침 11/30(월)", () => {
    expect(body("2026-11-30", usFor("2026-11-30"), [fx(0.4)])).toBe(`미국 11/27 종가 ${US_TEXT} | ${FX_TEXT}`);
  });
  it("8 미국 월요일 휴장 주 — 2027-01-18(월)·01-19(화)", () => {
    expect(body("2027-01-18", usFor("2027-01-18"), [fx(0.4)])).toBe(`미국 1/15 종가 ${US_TEXT} | ${FX_TEXT} | 오늘 미국 휴장`);
    expect(body("2027-01-19", usFor("2027-01-19"), [fx(0.4)])).toBe(`${FX_TEXT} | 미국 1/18 휴장`);
  });
  it("9 미국 금요일 휴장 뒤 월요일 — 2027-03-26(금)·03-29(월)", () => {
    expect(body("2027-03-26", usFor("2027-03-26"), [fx(0.4)])).toBe(`미국 3/25 종가 ${US_TEXT} | ${FX_TEXT} | 오늘 미국 휴장`);
    expect(body("2027-03-29", usFor("2027-03-29"), [fx(0.4)])).toBe(`${FX_TEXT} | 미국 3/26 휴장`);
  });
  it("10 한국 휴장일 12/31(목) — 환율 오늘 행이 없으면 미국만, 있으면 환율 포함", () => {
    expect(body("2026-12-31", usFor("2026-12-31"), [])).toBe(`미국 12/30 종가 ${US_TEXT} | 오늘 국내 휴장`);
    expect(body("2026-12-31", usFor("2026-12-31"), [fx(0.4)])).toBe(`미국 12/30 종가 ${US_TEXT} | ${FX_TEXT} | 오늘 국내 휴장`);
  });
  it("11 양쪽 휴장 12/25(금)", () => {
    expect(holidayMarketsOn("2026-12-25")).toEqual(["미국", "국내"]);
    expect(body("2026-12-25", usFor("2026-12-25"), [])).toBe(`미국 12/24 종가 ${US_TEXT} | 오늘 미국·국내 휴장`);
  });
  it("12 12/28(월) — 미국 12/25 휴장 반복, 한국 영업일", () => {
    expect(body("2026-12-28", usFor("2026-12-28"), [fx(0.4)])).toBe(`${FX_TEXT} | 미국 12/25 휴장`);
  });
  it("13 국내 연휴 2027-02-08·09 — 날마다 미국은 새 거래일, 연휴 뒤 2/10은 1행과 같은 꼴", () => {
    expect(body("2027-02-08", usFor("2027-02-08"), [])).toBe(`미국 2/5 종가 ${US_TEXT} | 오늘 국내 휴장`);
    expect(body("2027-02-09", usFor("2027-02-09"), [])).toBe(`미국 2/8 종가 ${US_TEXT} | 오늘 국내 휴장`);
    expect(body("2027-02-10", usFor("2027-02-10"), [fx(0.4)])).toBe(`미국 2/9 종가 ${US_TEXT} | ${FX_TEXT}`);
  });
  it("14 미국 조회 실패(휴장 아님) + 환율 정상 — 실패를 휴장으로 쓰지 않는다", () => {
    expect(isRepeatedClose("2026-11-24")).toBe(false);
    expect(body("2026-11-24", [], [fx(0.4)])).toBe(FX_TEXT);
  });
  it("15 환율 없음 + 미국 정상", () => {
    expect(body("2026-11-24", us, [])).toBe(`미국 11/23 종가 ${US_TEXT}`);
  });
  it("16 지수 1개만 실패", () => {
    expect(body("2026-11-24", [idx("나스닥", 1.1)], [fx(0.4)])).toBe(`미국 11/23 종가 나스닥 +1.1% | ${FX_TEXT}`);
  });
  it("17 값 0(전부 실패, 또는 미국 반복 + 환율 없음)이면 보내지 않는다 — 휴장 표시만 있는 알림 0", () => {
    expect(buildMorningMessage("2026-11-24", [], [], "daily")).toBeNull();
    expect(buildMorningMessage("2026-11-27", usFor("2026-11-27"), [], "daily")).toBeNull();
    expect(buildMorningMessage("2026-12-25", [], [], "daily")).toBeNull();
  });
  it("18 '큰 움직임만' — 미국 ±2.0% 또는 환율 ±1.0%일 때만", () => {
    expect(buildMorningMessage("2026-11-24", us, [fx(0.4)], "pm2")).toBeNull();
    expect(buildMorningMessage("2026-11-24", [idx("S&P 500", 1.9), idx("나스닥", -1.9)], [fx(0.9)], "pm2")).toBeNull();
    expect(body("2026-11-24", us, [fx(-1.0)], "pm2")).toBe(`환율 1,385원(-1.0%) | 미국 11/23 종가 ${US_TEXT}`);
    expect(body("2026-11-24", [idx("S&P 500", 0.3), idx("나스닥", -2.0)], [fx(0.4)], "pm2")).toBe(`미국 11/23 종가 나스닥 -2.0% · S&P 500 +0.3% | ${FX_TEXT}`);
    expect(body("2026-11-24", [idx("S&P 500", -2.0)], [], "pm2")).toBe("미국 11/23 종가 S&P 500 -2.0%");
    expect(buildMorningMessage("2026-11-24", us, [], "pm2")).toBeNull(); // 환율이 검증 탈락으로 빠지면 판정에 안 들어감
  });
  it("19 토·일은 아침 회차가 없다(발송 판정은 cron.test) — 미국 기대 거래일은 한 곳에서 계산", () => {
    expect(expectedCloseDate("2026-11-24")).toBe("2026-11-23");
    expect(expectedCloseDate("2026-11-23")).toBe("2026-11-20");
    expect(expectedCloseDate("2026-11-27")).toBe("2026-11-25");
  });
  it("2026-11 ~ 2027-12 모든 평일 — 본문에 코스피·코스닥·'국내 ' 묶음·'국내 M/D 휴장' 0, 미국 머리 날짜는 받은 날보다 앞", () => {
    for (let t = Date.UTC(2026, 10, 1); t < Date.UTC(2028, 0, 1); t += 86400000) {
      const day = new Date(t).toISOString().slice(0, 10);
      if ([0, 6].includes(new Date(t).getUTCDay())) continue;
      for (const f of [[fx(0.4)], []]) {
        const b = body(day, usFor(day), f);
        if (b === null) continue;
        expect(b, day).not.toMatch(/코스피|코스닥|국내 \d|국내 [^휴]|국내 \d+\/\d+ 휴장/);
        expect(b.replace(/오늘 [^|]*휴장$/, ""), day).not.toContain("국내");
        const head = b.match(/미국 (\d+)\/(\d+) 종가/);
        if (head) expect(expectedCloseDate(day) < day && `${Number(expectedCloseDate(day).slice(5, 7))}/${Number(expectedCloseDate(day).slice(8))}` === `${head[1]}/${head[2]}`, day).toBe(true);
      }
    }
  });
  it("금지어·평가어·조언 0", () => {
    const m = buildMorningMessage("2026-11-26", us, [fx(0.4)], "daily");
    const text = `${m?.t} ${m?.b}`;
    for (const w of ["보유", "평가", "하세요", "급락", "급등", "매수", "매도", "추천", "밤사이"]) expect(text).not.toContain(w);
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
    expect(mergePushPayloads([morning, settle])).toEqual({ ...settle, b: `${settle.b}\n아침 시장 · 미국 S&P 500 +0.8%` });
    expect(mergePushPayloads([morning, tax, settle])?.m).toBe("settle");
    expect(mergePushPayloads([morning, tax])?.m).toBe("tax");
  });
  it("세금+아침: 둘째 줄에 아침 시세 내용", () => {
    expect(mergePushPayloads([morning, tax])).toEqual({ ...tax, b: "12/31 납입분까지예요\n아침 시장 · 미국 S&P 500 +0.8%" });
  });
  it("결산+세금+아침: 세금은 제목만, 아침은 내용", () => {
    expect(mergePushPayloads([morning, tax, settle])?.b).toBe(`${settle.b}\n연금저축·IRP 세액공제 · 아침 시장 · 미국 S&P 500 +0.8%`);
  });
  it("국내 종가는 '국내 종가 · 본문'", () => {
    const kr = { m: "kr" as const, t: "11/27 국내 종가", b: "코스피 +0.5%" };
    expect(mergePushPayloads([kr, tax])?.b).toBe("12/31 납입분까지예요\n국내 종가 · 코스피 +0.5%");
  });
  it("pm2로 아침이 null이면 합쳐도 빈 줄 없음", () => {
    const none = buildMorningMessage("2026-11-27", [], [], "pm2");
    expect(none).toBeNull();
    expect(mergePushPayloads([none, tax].filter((x): x is NonNullable<typeof x> => x !== null))).toEqual(tax);
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

describe("미국 휴장 다음 날 같은 종가 반복 방지", () => {
  it("추수감사절 다음 날(금 11/27)은 반복, 평범한 화요일·월요일은 반복 아님", () => {
    expect(isRepeatedClose("2026-11-27")).toBe(true);
    expect(isRepeatedClose("2026-11-17")).toBe(false);
    expect(isRepeatedClose("2026-11-16")).toBe(false);
  });
  it("국내 연휴는 반복 판정과 무관 — 설날 연휴 다음 영업일(2027-02-10)도 미국은 새 거래일", () => {
    expect(isRepeatedClose("2027-02-10")).toBe(false);
  });
});

describe("합침 — 둘째 줄은 같은 날 단독 본문과 같은 값(C117·C118)", () => {
  const us = [idx("S&P 500", 0.8), idx("나스닥", 1.1)];
  it("결산 11/27 — 미국 반복일", () => {
    const single = buildMorningMessage("2026-11-27", [], [fx(0.4)], "daily")!;
    expect(single.b).toBe("환율 1,385원(+0.4%) | 미국 11/26 휴장");
    expect(mergePushPayloads([single, buildSettleMessage("2026-11-27")])).toEqual({
      m: "settle",
      t: "11월 결산이 열렸어요",
      b: "12월 10일까지 이번 달 자산 변화를 볼 수 있어요\n아침 시장 · 환율 1,385원(+0.4%) | 미국 11/26 휴장",
    });
  });
  it("세금 12/1", () => {
    const single = buildMorningMessage("2026-12-01", us, [fx(0.4)], "daily")!;
    const tax = pushDueOn("2026-12-01")[0].payload;
    expect(mergePushPayloads([single, tax])).toEqual({
      m: "tax",
      t: "12월 세금 일정",
      b: `${TAX_PUSH_DATES["12-01"].b}\n아침 시장 · 미국 11/30 종가 S&P 500 +0.8% · 나스닥 +1.1% | 환율 1,385원(+0.4%)`,
    });
    expect(mergePushPayloads([single, tax])?.b.endsWith(`아침 시장 · ${single.b}`)).toBe(true);
  });
  it("값 0인 날은 결산·세금만 — 빈 둘째 줄 없음", () => {
    const none = buildMorningMessage("2026-11-27", [], [], "daily");
    expect(none).toBeNull();
    expect(mergePushPayloads([buildSettleMessage("2026-11-27")])?.b).not.toContain("\n");
  });
});

describe("설정 설명(#241)", () => {
  it("아침 = 직전 미국 장 종가·환율, 국내 장 마감 = 오늘 코스피·코스닥·환율", () => {
    expect(PUSH_CATALOG[0].desc).toBe("월~금 아침 9시, 직전 미국 장 종가·환율");
    expect(PUSH_CATALOG[1].desc).toBe("월~금 오후 4시, 오늘 코스피·코스닥·환율");
  });
});
