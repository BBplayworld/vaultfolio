import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORIES, CSV_DIR, OUT_JSON, PUBLIC_DIR, build, buildPublic, serialize } from "../../../scripts/market-history/build.mjs";
import { parseCsv } from "../../../scripts/market-history/csv.mjs";
import type { MarketEvent, MarketHistoryData } from "../invest/types";

// 투자 탭(#263) 데이터 단언. 아래 재계산은 src/lib/invest 계산과 일부러 따로 쓴 기준 구현이다(독립 재계산, AC4).
const data = build() as unknown as MarketHistoryData;
const monthIdx = (s: string) => +s.slice(0, 4) * 12 + (+s.slice(5) - 1);
const seriesAt = (s: { from: string; v: number[] }, m: string) => s.v[monthIdx(m) - monthIdx(s.from)];

function zig(v: number[], t: number) {
  const eps: { p: number; t: number }[] = [];
  let hi = 0, lo = 0, inD = false;
  for (let i = 1; i < v.length; i++) {
    if (!inD) {
      if (v[i] >= v[hi]) hi = i;
      else if (v[i] <= v[hi] * (1 - t)) { inD = true; lo = i; }
    } else if (v[i] < v[lo]) lo = i;
    else if (v[i] >= v[lo] * (1 + t)) { eps.push({ p: hi, t: lo }); inD = false; hi = i; }
  }
  if (inD) eps.push({ p: hi, t: lo });
  return eps;
}
const cls = (d: number | null) => (d == null ? "none" : Math.abs(d) < 0.25 - 1e-9 ? "flat" : d > 0 ? "up" : "down");
const dec = (r: "us" | "kr", y: number) => { const s = data.rate[r]; const i = monthIdx(`${y}-12`) - monthIdx(s.from); return i >= 0 && i < s.v.length ? s.v[i] : null; };
const delta = (r: "us" | "kr", a: number, b: number) => (dec(r, a) == null || dec(r, b) == null ? null : Math.round((dec(r, b)! - dec(r, a)!) * 100) / 100);
const K = { spx: "us", ndx: "us", kospi: "kr" } as const;

describe("투자 탭 데이터: 생성물·드리프트", () => {
  it("커밋된 생성물이 CSV에서 다시 만든 결과와 같다(수동 편집 금지)", () => {
    expect(fs.readFileSync(OUT_JSON, "utf8")).toBe(serialize(build()));
  });
  it("데이터 마지막 연도는 2025이고 세 지수가 같은 해에 끝난다", () => {
    expect(data.last).toBe(2025);
    for (const x of Object.values(data.idx)) expect(x.start + x.close.length - 1).toBe(2025);
  });
  it("출시 데이터에 verify_status·시안 메모 열이 없다(AC8)", () => {
    for (const f of fs.readdirSync(CSV_DIR).filter((n: string) => n.endsWith(".csv"))) {
      const head = fs.readFileSync(path.join(CSV_DIR, f), "utf8").split("\n")[0];
      expect(head).not.toMatch(/verify_status|evidence|unverified|ref_secondary/);
    }
    expect(fs.readFileSync(OUT_JSON, "utf8")).not.toMatch(/verify_status/);
  });
});

describe("투자 탭 데이터: 사건 31건", () => {
  it("31건·분류 7종·분류별 건수", () => {
    expect(data.events).toHaveLength(31);
    expect(CATEGORIES).toHaveLength(7);
    const n: Record<string, number> = {};
    data.events.forEach((e) => (n[e.cat] = (n[e.cat] || 0) + 1));
    expect(n).toEqual({ "금리·통화 정책": 10, 금융위기: 7, "시장 급락": 2, "전쟁·지정학": 7, "기술 거품": 1, 팬데믹: 2, 에너지: 2 });
  });
  it("spec 5절 표시명 정본과 글자 하나까지 같다(AC18)", () => {
    expect(data.events.map((e) => `${e.id}:${e.name}`)).toEqual([
      "E01:닉슨 쇼크", "E02:1차 오일쇼크", "E03:2차 오일쇼크", "E04:볼커 긴축", "E05:플라자 합의", "E06:블랙먼데이", "E08:걸프전", "E09:연준 인상(1994)",
      "E10:멕시코 페소 위기", "E11:아시아 외환위기", "E12:러시아·LTCM 위기", "E13:닷컴 버블 붕괴", "E14:9·11 테러", "E17:사스", "E18:이라크 전쟁",
      "E19:연준 인상(2004)", "E20:글로벌 금융위기", "E21:유럽 재정위기", "E22:미국 신용등급 강등", "E23:테이퍼 탠트럼", "E24:중국 위안화 절하",
      "E25:연준 첫 인상", "E26:브렉시트 국민투표", "E27:미중 무역분쟁", "E28:연준 인상(2018)", "E29:연준 인하 전환", "E30:코로나19",
      "E31:러시아-우크라이나 전쟁", "E32:미국 지역은행 위기", "E33:엔 캐리 청산", "E34:미국 상호관세 발표",
    ]);
  });
  it("표시명 12자 이하·사실 1줄 40자 이하·1차 출처 URL이 있다", () => {
    for (const e of data.events) {
      expect([...e.name].length).toBeLessThanOrEqual(12);
      expect([...e.fact].length).toBeLessThanOrEqual(40);
      expect(e.fact.endsWith("요.")).toBe(true);
      expect(e.urls.length).toBeGreaterThan(0);
    }
  });
  it("사건 원문 CSV의 옛 name·fact 열은 없다(spec 5절 열)", () => {
    const head = fs.readFileSync(path.join(CSV_DIR, "events.csv"), "utf8").split("\n")[0];
    expect(head).toBe("id,name,date_display,point_month,category,fact,source_urls,indexes");
  });
  it("E13·E25·E27 spec 정본(CSV와 다르게 정한 것)", () => {
    const by = Object.fromEntries(data.events.map((e) => [e.id, e])) as Record<string, MarketEvent>;
    expect(by.E13.date).toBe("2000~2002년");
    expect(by.E13.pm).toBe("2000-03");
    expect(by.E25.fact).toContain("2006년 뒤 처음");
    expect(by.E27.date).toBe("2018년 3~4월");
    expect(by.E24.cat).toBe("금리·통화 정책");
    expect(by.E06.cat).toBe("시장 급락");
    expect(by.E33.cat).toBe("시장 급락");
  });
});

describe("투자 탭 데이터: 하락·금리 집계 독립 재계산(AC4·AC5)", () => {
  const closes = (k: "spx" | "ndx" | "kospi") => data.idx[k].close as number[];
  it("연말 −15% 지그재그 건수: S&P 4 · 나스닥100 3 · 코스피 6", () => {
    expect(zig(closes("spx"), 0.15)).toHaveLength(4);
    expect(zig(closes("ndx"), 0.15)).toHaveLength(3);
    expect(zig(closes("kospi"), 0.15)).toHaveLength(6);
  });
  it("행 낙폭: S&P 금융위기 −38.49%·1973~74 −41.9%", () => {
    const v = closes("spx"), start = data.idx.spx.start;
    const e = zig(v, 0.15).map((x) => ({ py: start + x.p, ty: start + x.t, dd: (v[x.t] / v[x.p] - 1) * 100 }));
    expect(e.map((x) => [x.py, x.ty])).toEqual([[1972, 1974], [1999, 2002], [2007, 2008], [2021, 2022]]);
    expect(e[0].dd).toBeCloseTo(-41.9, 1);
    expect(e[2].dd).toBeCloseTo(-38.49, 1);
  });
  it("금리 방향 기준선(머리와 같은 해 범위, 첫 해 제외): S&P 43=18/16/9 · 나스닥 40=16/15/9 · 코스피 26=14/12/0", () => {
    const base = (k: "spx" | "ndx" | "kospi") => {
      const r = K[k], s = data.idx[k], b = { n: 0, up: 0, down: 0, flat: 0 };
      for (let y = s.start + 1; y <= data.last; y++) { const c = cls(delta(r, y - 1, y)); if (c !== "none") { b.n++; b[c as "up" | "down" | "flat"]++; } }
      return b;
    };
    expect(base("spx")).toEqual({ n: 43, up: 16, down: 18, flat: 9 });
    expect(base("ndx")).toEqual({ n: 40, up: 15, down: 16, flat: 9 });
    expect(base("kospi")).toEqual({ n: 26, up: 12, down: 14, flat: 0 });
  });
  it("하락 구간 금리 방향: S&P 내려감 2·올라감 1·자료 없음 1 / 나스닥 2·1 / 코스피 1·3·자료 없음 2", () => {
    const tally = (k: "spx" | "ndx" | "kospi") => {
      const s = data.idx[k], n: Record<string, number> = {};
      zig(closes(k), 0.15).forEach((x) => { const c = cls(delta(K[k], s.start + x.p, s.start + x.t)); n[c] = (n[c] || 0) + 1; });
      return n;
    };
    expect(tally("spx")).toEqual({ none: 1, down: 2, up: 1 });
    expect(tally("ndx")).toEqual({ down: 2, up: 1 });
    expect(tally("kospi")).toEqual({ none: 2, up: 3, down: 1 });
  });
});

describe("투자 탭 데이터: 금리·침체 단언(AC3·AC7, 4-14)", () => {
  it("10년물 12월 월말값 = 연말 표 값(불일치 0)", () => {
    let n = 0;
    for (const r of data.usYear) {
      if (r.y10 == null) continue;
      n++;
      expect(Math.abs(seriesAt(data.ovl.us, `${r.y}-12`) - r.y10)).toBeLessThan(0.005);
    }
    expect(n).toBe(64);
  });
  it("침체 9구간(1961년 이후, NBER 고점 다음 달~저점 월)과 월 수 재계산 일치", () => {
    expect(data.rec.map((r) => `${r.s}~${r.e}`)).toEqual([
      "1960-05~1961-02", "1970-01~1970-11", "1973-12~1975-03", "1980-02~1980-07", "1981-08~1982-11", "1990-08~1991-03", "2001-04~2001-11", "2008-01~2009-06", "2020-03~2020-04",
    ]);
    for (const r of data.usYear) {
      let n = 0;
      data.rec.forEach((x) => { for (let m = monthIdx(x.s); m <= monthIdx(x.e); m++) if (Math.floor(m / 12) === r.y) n++; });
      expect(n).toBe(r.rec);
    }
  });
  it("한국 기준금리 연말 = 월 계단 12월(불일치 0), 연말 26값", () => {
    let n = 0;
    for (const r of data.krYear) {
      if (r.base == null) continue;
      n++;
      expect(Math.abs(seriesAt(data.rate.kr, `${r.y}-12`) - r.base)).toBeLessThan(0.005);
    }
    expect(n).toBe(27);
  });
  it("월 계열 시작: 연준 1982-09 · 한은 1999-05 · 10년물 1962-01 · 국고채 10년 2000-10", () => {
    expect([data.rate.us.from, data.rate.kr.from, data.ovl.us.from, data.ovl.kr.from]).toEqual(["1982-09", "1999-05", "1962-01", "2000-10"]);
  });
  it("2023 국고채 기준일은 CSV에 남아 있다(AC2 대조 전 R1 값)", () => {
    const r = data.krYear.find((x) => x.y === 2023);
    expect(r?.d).toBe("2023-12-29");
  });
  it("CSV 값과 생성물이 파싱해도 같다(월 금리 마지막 값)", () => {
    const rm = parseCsv(fs.readFileSync(path.join(CSV_DIR, "rates-monthly.csv"), "utf8"));
    const last = rm[rm.length - 1];
    expect(last.month).toBe("2025-12");
    expect(data.rate.us.v[data.rate.us.v.length - 1]).toBe(+last.fed_target_upper);
  });
});

describe("공개 가공 데이터셋(CC BY-SA 4.0)", () => {
  const files = buildPublic() as Record<string, string>;
  it("커밋된 공개 파일이 CSV에서 다시 만든 결과와 같다", () => {
    for (const [name, body] of Object.entries(files)) expect(fs.readFileSync(path.join(PUBLIC_DIR, name), "utf8"), name).toBe(body);
    expect(fs.readdirSync(PUBLIC_DIR).sort()).toEqual(Object.keys(files).sort());
  });
  it("Damodaran 수준값 열·verify_status 열이 없고 S&P 연말 지수 값 칸은 비어 있다(AC8)", () => {
    for (const [name, body] of Object.entries(files)) {
      if (!name.endsWith(".csv")) continue;
      expect(body.split("\n")[0], name).not.toMatch(/damodaran|spx_close|verify_status|evidence|unverified/);
    }
    const rows = parseCsv(files["index-annual.csv"]) as Record<string, string>[];
    const spx = rows.filter((r) => r.index === "SPX");
    expect(spx.length).toBeGreaterThan(60);
    expect(spx.every((r) => r.close === "")).toBe(true);
    // 수준값이 파일 어디에도 없다: Damodaran CSV의 값(예: 6845.5)이 공개 파일에 나오지 않는다
    const dam = parseCsv(fs.readFileSync(path.join(CSV_DIR, "spx-level-damodaran.csv"), "utf8")).map((r) => (r as Record<string, string>).spx_close_damodaran);
    const all = Object.values(files).join("\n");
    for (const v of dam.slice(-5)) expect(all).not.toContain(`,${v},`);
    expect(files["index-annual.csv"]).not.toContain("6845.5");
  });
  it("LICENSE에 CC BY-SA 4.0 전문과 귀속 문구, README에 출처·상표·제휴 아님", () => {
    expect(files["LICENSE"]).toContain("Creative Commons Attribution-ShareAlike 4.0 International Public");
    expect(files["LICENSE"]).toContain("기준일 2025.12.31");
    expect(files["LICENSE"].length).toBeGreaterThan(15000);
    expect(files["README.md"]).toContain("CC BY-SA 4.0");
    expect(files["README.md"]).toContain("제휴 관계가 아니에요");
    expect(files["README.md"]).toContain("S&P 500은 연말 지수 값 없이 등락률만");
  });
  it("나스닥100·코스피 등락률은 종가로 다시 계산한 값(코스피 1998)", () => {
    const rows = parseCsv(files["index-annual.csv"]) as { year: string; index: string; close: string; ret_pct: string }[];
    const k98 = rows.find((r) => r.index === "KOSPI" && r.year === "1998")!, k97 = rows.find((r) => r.index === "KOSPI" && r.year === "1997")!;
    expect(+k98.ret_pct).toBeCloseTo((+k98.close / +k97.close - 1) * 100, 2);
  });
});

describe("R4 데이터: 추가 사건 10건·금리차 월평균", () => {
  it("추가 사건 10건: CEO 판정 표(날짜·이름·분류)와 같고 첫 화면 사건 31건에는 섞이지 않는다", () => {
    expect(data.events).toHaveLength(31);
    expect(data.eventsExtra.map((e) => `${e.date} ${e.name}`)).toEqual([
      "2008년 11월 25일 연준 자산 매입 시작", "2010년 11월 3일 연준 국채 매입(2010)", "2012년 9월 13일 연준 매입 재개(2012)", "2014년 10월 29일 연준 매입 종료(2014)",
      "2017년 9월 20일 연준 보유 축소 시작(2017)", "2019년 7월 31일 연준 보유 축소 종료(2019)", "2020년 3월 15일 연준 매입 재개(2020)", "2022년 1월 26일 연준 매입 종료(2022)",
      "2022년 5월 4일 연준 보유 축소 시작(2022)", "2025년 10월 29일 연준 보유 축소 종료(2025)",
    ]);
    expect(data.eventsExtra.every((e) => e.cat === "금리·통화 정책" && [...e.fact].length <= 40)).toBe(true);
    expect(data.eventsExtra.find((e) => e.id === "R05")?.fact).toBe("연준이 10월에 보유 자산 정상화를 시작하기로 했어요.");
    const ids = new Set([...data.events, ...data.eventsExtra].map((e) => e.id));
    expect(ids.size).toBe(41);
  });
  it("금리차 월평균 600개월(1976-01~2025-12), 10년−2년 1976-06부터·10년−3개월 1981-09부터", () => {
    expect(data.spread.from).toBe("1976-01");
    expect(data.spread.a).toHaveLength(600);
    expect(data.spread.a.findIndex((v) => v != null)).toBe(5);
    expect(data.spread.b.findIndex((v) => v != null)).toBe(12 * 5 + 8);
    const i = monthIdx("2007-01") - monthIdx("1976-01");
    expect(data.spread.a[i]).toBe(-0.12);
    expect(data.spread.b[i]).toBe(-0.35);
  });
});
