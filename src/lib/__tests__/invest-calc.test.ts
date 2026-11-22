import { describe, expect, it } from "vitest";
import { bandRect, logTicks, mergeEventDots } from "../invest/chart";
import {
  buildIndexView, classifyDelta, episodeIndexOfYear, pickDefaultIndex, rateAxisMax, recessionLabel, recessionMonthsIn, zigzag,
} from "../invest/calc";
import { headlineLines, readoutOf, sourceLines, fmtPct, listNote, LIST_NOTE_2 } from "../invest/text";
import { marketHistory as data } from "../invest/market-history";

const views = { spx: buildIndexView(data, "spx"), ndx: buildIndexView(data, "ndx"), kospi: buildIndexView(data, "kospi") };

describe("투자 탭 계산: 하락 지그재그(−15%)", () => {
  it("건수 S&P 4 · 나스닥100 3 · 코스피 6, 고점·바닥 연도", () => {
    expect(views.spx.eps.map((e) => [e.py, e.ty, e.ry])).toEqual([[1972, 1974, 1980], [1999, 2002, 2013], [2007, 2008, 2013], [2021, 2022, 2023]]);
    expect(views.ndx.eps).toHaveLength(3);
    expect(views.kospi.eps.map((e) => e.name)).toEqual(["1990~91년 하락", "외환위기", "닷컴 버블 붕괴", "글로벌 금융위기", "2018년 하락", "2022년 하락"]);
  });
  it("문턱 경계: 정확히 15% 하락은 하락 시작, 15% 넘게 오르면 끝", () => {
    expect(zigzag([100, 85, 100])).toHaveLength(1);
    expect(zigzag([100, 85.1, 90])).toHaveLength(0);
    // 바닥에서 15%만 오르면(=정확히 문턱) 끝, 다음 하락은 새로 센다
    const z = zigzag([100, 80, 92, 100, 70]);
    expect(z.map((e) => [e.p, e.t])).toEqual([[0, 1], [3, 4]]);
  });
  it("전고점을 못 되찾으면 진행 중(ry null)", () => {
    const e = zigzag([100, 80, 85])[0];
    expect(e.r).toBeNull();
  });
  it("낙폭: S&P 1973~74 −41.9% · 금융위기 −38.49%", () => {
    expect(views.spx.eps[0].dd).toBeCloseTo(-41.9, 1);
    expect(views.spx.eps[2].dd).toBeCloseTo(-38.49, 2);
  });
});

describe("투자 탭 계산: 금리 방향(0.25%p)", () => {
  it("분류 경계", () => {
    expect(classifyDelta(0.24)).toBe("flat");
    expect(classifyDelta(0.25)).toBe("up");
    expect(classifyDelta(-0.25)).toBe("down");
    expect(classifyDelta(null)).toBe("none");
  });
  it("기준선: S&P 43=18/16/9 · 나스닥 40=16/15/9 · 코스피 26=14/12/0 (down/up/flat)", () => {
    expect(views.spx.base).toEqual({ n: 43, up: 16, down: 18, flat: 9 });
    expect(views.ndx.base).toEqual({ n: 40, up: 15, down: 16, flat: 9 });
    expect(views.kospi.base).toEqual({ n: 26, up: 12, down: 14, flat: 0 });
  });
  it("하락 구간 방향 표식", () => {
    expect(views.spx.eps.map((e) => e.dir)).toEqual(["none", "down", "down", "up"]);
    expect(views.kospi.eps.map((e) => e.dir)).toEqual(["none", "none", "up", "down", "up", "up"]);
  });
  it("금융위기 금리 4.25%→0.25%", () => {
    const e = views.spx.eps[2];
    expect([e.rf, e.rt]).toEqual([4.25, 0.25]);
  });
});

describe("투자 탭 계산: NBER 침체(4-7·4-8)", () => {
  it("펼침 문구 검산(AC20)", () => {
    const [a, b, c, d] = views.spx.eps.map((e) => e.recs);
    expect(a).toEqual(["1973년 12월~1975년 3월"]);
    expect(b).toEqual(["2001년 4월~11월"]);
    expect(c).toEqual(["2008년 1월~2009년 6월"]);
    expect(d).toEqual([]);
    expect(views.kospi.eps.every((e) => e.recs === null)).toBe(true);
  });
  it("그해 침체 월 수", () => {
    expect(recessionMonthsIn(data.rec, 2008)).toBe(12);
    expect(recessionMonthsIn(data.rec, 2009)).toBe(6);
    expect(recessionMonthsIn(data.rec, 2020)).toBe(2);
    expect(recessionMonthsIn(data.rec, 2015)).toBe(0);
    expect(views.spx.tbl.find((r) => r.y === 2001)!.rec).toBe(8);
  });
  it("라벨", () => {
    expect(recessionLabel({ s: "2001-04", e: "2001-11", n: 8, peak: "2001-03" })).toBe("2001년 4월~11월");
  });
});

describe("투자 탭 계산: 머리·읽기 줄 문장", () => {
  it("S&P 머리 3줄", () => {
    const h = headlineLines(views.spx);
    expect(h.l1).toBe("1961년 이후 연말 기준 15% 넘게 빠진 때는 4번이었어요");
    expect(h.l2).toEqual({ lead: "그 사이 미국 금리는 ", bold: "2번 내려갔고", rest: ", 1번 올라갔어요 (1번은 금리 자료 없음)" });
    expect(h.l3).toBe("미국 금리 자료가 있는 43년 중 내려간 해는 18년, 올라간 해는 16년, 거의 그대로인 해는 9년이었어요");
  });
  it("코스피: 그대로 0이면 `없었어요`", () => {
    const h = headlineLines(views.kospi);
    expect(h.l1).toBe("1982년 이후 연말 기준 15% 넘게 빠진 때는 6번이었어요");
    expect(h.l3).toBe("한국 금리 자료가 있는 26년 중 내려간 해는 14년, 올라간 해는 12년이었고 거의 그대로인 해는 없었어요");
  });
  it("하락 0건 지수는 `없었어요`, 2줄째 없음", () => {
    const v = { ...views.spx, eps: [] };
    const h = headlineLines(v);
    expect(h.l1).toBe("1961년 이후 연말 기준 15% 넘게 빠진 때는 없었어요");
    expect(h.l2).toBeNull();
  });
  it("읽기 줄: 2008년 말 903 · −38.5% · 금리 내려감 · 경기침체 + 사건", () => {
    const r = readoutOf(views.spx, 2008);
    expect(r.level).toBe("903");
    expect(fmtPct(r.ret!)).toBe("−38.5%");
    expect(r.dir).toBe("금리 내려감");
    expect(r.recession).toBe(true);
    expect(r.events).toBe("글로벌 금융위기");
  });
  it("목록 각주에 2020 연간 등락", () => {
    expect(listNote(views.spx)).toContain("2020년 S&P 500는 연간 +16.3%로 끝나");
    expect(LIST_NOTE_2).toContain("무엇이 원인인지");
  });
});

describe("투자 탭 계산: 사건 점·연결", () => {
  it("지수별 사건 수 S&P 23 · 나스닥 13 · 코스피 21", () => {
    expect([views.spx.ev.length, views.ndx.ev.length, views.kospi.ev.length]).toEqual([23, 13, 21]);
  });
  it("하락 창 사건: 금융위기 행에 글로벌 금융위기 포함, 닷컴 행에 E13·E14", () => {
    expect(views.spx.eps[2].evl).toContain("E20");
    expect(views.spx.eps[1].evl).toEqual(expect.arrayContaining(["E13", "E14"]));
  });
  it("해가 하락 구간 안이면 그 행 인덱스", () => {
    expect(episodeIndexOfYear(views.spx.eps, 2008)).toBe(2);
    expect(episodeIndexOfYear(views.spx.eps, 2015)).toBe(-1);
  });
});

describe("투자 탭 계산: 기본 지수·진행 중·기준일", () => {
  it("기본 지수: 국내 > 해외 = 코스피, 그 밖·체험·가이드 = S&P 500", () => {
    expect(pickDefaultIndex({ domestic: 200, overseas: 100 })).toBe("kospi");
    expect(pickDefaultIndex({ domestic: 100, overseas: 100 })).toBe("spx");
    expect(pickDefaultIndex({ domestic: 0, overseas: 0 })).toBe("spx");
    expect(pickDefaultIndex(null)).toBe("spx");
  });
  it("진행 중 모의(asof=2022, 코스피): 마지막 하락이 진행 중이고 머리 건수에 포함", () => {
    const v = buildIndexView(data, "kospi", 2022);
    const e = v.eps[v.eps.length - 1];
    expect(v.last).toBe(2022);
    expect(e.ongoing).toBe(true);
    expect(e.ry).toBeNull();
    expect(headlineLines(v).l1).toContain(`${v.eps.length}번`);
  });
  it("기준일은 데이터 마지막 연도에서 읽는다(AC21)", () => {
    const v = buildIndexView(data, "spx", 2022);
    expect(sourceLines(v, { spx: "1", ndx: "2", kospi: "3" })[2]).toContain("기준일 2022.12.31");
    expect(sourceLines(views.spx, { spx: "1", ndx: "2", kospi: "3" })[2]).toContain("기준일 2025.12.31");
  });
  it("오른쪽 축 상한: 미국 16 · 한국 10 (켜기 전·후 같은 스케일)", () => {
    expect(rateAxisMax(data, "us")).toBe(16);
    expect(rateAxisMax(data, "kr")).toBe(10);
  });
});

describe("투자 탭 출처 4줄(7절)", () => {
  const revs = { spx: "1386627454", ndx: "1381716602", kospi: "42210370" };
  it("지수별로 다르고 나스닥에 S&P 상표·코스피에 미국 금리 문구가 없다", () => {
    const s = sourceLines(views.spx, revs), n = sourceLines(views.ndx, revs), k = sourceLines(views.kospi, revs);
    expect(s[3]).toContain("S&P Dow Jones Indices");
    expect(n.join("")).not.toContain("S&P");
    expect(k.join("")).not.toMatch(/H\.15|연준|NBER|미국 지수는 달러/);
    expect(k[1]).toMatch(/^금리 출처: ECOS\(한국은행, 기준금리·시장금리\), \d{4}\.\d{2}\.\d{2}\./);
    expect(n[0]).toContain("리비전 1381716602");
  });
});

describe("투자 탭 차트 기하", () => {
  it("C1 같은 해 점 합침: 표시 점 사이 간격 ≥ 6px, 연결 점이 있으면 큰 점", () => {
    const m = mergeEventDots([
      { id: "a", x: 10, linked: false }, { id: "b", x: 13, linked: true }, { id: "c", x: 17, linked: false }, { id: "d", x: 24, linked: false },
    ]);
    expect(m.map((d) => [d.x, d.ids, d.linked])).toEqual([[10, ["a", "b"], true], [17, ["c"], false], [24, ["d"], false]]);
    for (let i = 1; i < m.length; i++) expect(m[i].x - m[i - 1].x).toBeGreaterThanOrEqual(6);
  });
  it("실제 데이터: 폭 320·390·1280 어디서도 표시 점 간격 ≥ 6px", () => {
    for (const k of ["spx", "ndx", "kospi"] as const) {
      for (const w of [264, 326, 1000]) {
        const v = views[k], span = v.last - v.start;
        const X = (t: number) => 44 + ((t - (v.start + 1)) / span) * (w - 44 - 24);
        const dots = v.ev.map((e) => ({ id: e.id, x: X(Math.min(Math.max(e.t, v.start + 1), v.last + 1)), linked: v.eps.some((q) => e.t >= q.py + 1 && e.t < q.ty + 1) }));
        const m = mergeEventDots(dots);
        for (let i = 1; i < m.length; i++) expect(m[i].x - m[i - 1].x).toBeGreaterThanOrEqual(6);
        expect(m.reduce((a, d) => a + d.ids.length, 0)).toBe(dots.length);
      }
    }
  });
  it("침체 띠 최소 폭 2.6px", () => {
    expect(bandRect(10, 11).w).toBe(2.6);
    expect(bandRect(10, 20)).toEqual({ x: 10, w: 10 });
  });
  it("로그 축 눈금이 범위를 덮는다", () => {
    const t = logTicks(58, 6846, 6);
    expect(t.lo).toBeLessThanOrEqual(58);
    expect(t.hi).toBeGreaterThanOrEqual(6846);
  });
});

describe("투자 탭 기본 지수 판정용 보유 분할(기기 안 계산)", () => {
  const st = (category: "domestic" | "foreign" | "unlisted", q: number, p: number, currency: "KRW" | "USD" = "KRW", inactiveStatus?: "delisted") => ({ category, quantity: q, currentPrice: p, currency, inactiveStatus });
  it("국내·해외 평가액(원 환산)", async () => {
    const { holdingSplit } = await import("../invest/default-index");
    expect(holdingSplit([st("domestic", 10, 1000), st("foreign", 1, 5, "USD")], { USD: 1400, JPY: 900 })).toEqual({ domestic: 10000, overseas: 7000 });
  });
  it("주식이 없거나 상장폐지뿐이면 null(= S&P 500)", async () => {
    const { holdingSplit } = await import("../invest/default-index");
    expect(holdingSplit([], { USD: 1400, JPY: 900 })).toBeNull();
    expect(holdingSplit([st("domestic", 1, 1000, "KRW", "delisted")], { USD: 1400, JPY: 900 })).toBeNull();
    expect(holdingSplit([st("unlisted", 1, 1000)], { USD: 1400, JPY: 900 })).toBeNull();
  });
});
