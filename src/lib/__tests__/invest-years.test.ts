import { describe, expect, it } from "vitest";
import { buildIndexView, yearIssues } from "../invest/calc";
import { readoutOf } from "../invest/text";
import { marketHistory as data } from "../invest/market-history";

const V = { spx: buildIndexView(data, "spx"), ndx: buildIndexView(data, "ndx"), kospi: buildIndexView(data, "kospi") };
const FORBID = ["때문", "덕분", "로 인해", "영향으로", "촉발", "여파", "역전", "신호", "예고", "기회", "타이밍", "유리", "추천", "수익", "로그", "지금 사면", "→", "↑", "↓", "전조", "조심", "경고", "과열", "붐", "기대", "연착륙", "반등"];

describe("해별 경제 이슈(1990~2026)", () => {
  it("53행·사실 53/53이 40자 이하·금지어 0·연준 1차 출처만", () => {
    expect(data.eventsYear).toHaveLength(53);
    for (const e of data.eventsYear) {
      expect([...e.fact].length, e.id).toBeLessThanOrEqual(40);
      for (const w of FORBID) expect(e.fact + e.name, `${e.id} ${w}`).not.toContain(w);
      expect(e.urls.every((u) => u.startsWith("https://www.federalreserve.gov/")), e.id).toBe(true);
    }
  });
  it("1990~2025는 1996·2006을 빼고 해마다 1건 이상(S&P·나스닥·코스피 모두)", () => {
    for (const k of ["spx", "ndx", "kospi"] as const) {
      for (let y = Math.max(1990, V[k].start + 1); y <= 2025; y++) {
        const n = yearIssues(V[k], y).length;
        if (y === 1996 || y === 2006) expect(n, `${k} ${y}`).toBe(0);
        else expect(n, `${k} ${y}`).toBeGreaterThan(0);
      }
    }
  });
  it("2019·2022는 3건(읽기 줄은 앞 2건 + 외 1건, 펼침은 3건 시간순)", () => {
    for (const y of [2019, 2022]) {
      expect(yearIssues(V.spx, y)).toHaveLength(3);
      expect(readoutOf(V.spx, y).events).toMatch(/ 외 1건$/);
    }
    expect(yearIssues(V.spx, 2022).map((e) => e.id)).toEqual(["Y-R08", "Y-E31", "Y-R09"]);
    expect(yearIssues(V.spx, 2021)).toHaveLength(1);
  });
  it("한국 행은 코스피만: 2010 연평도 0건(S&P), 2017 북한 긴장은 코스피에만", () => {
    expect(yearIssues(V.spx, 2010).some((e) => e.name.includes("연평도"))).toBe(false);
    expect(data.eventsYear.some((e) => e.name.includes("연평도"))).toBe(false);
    expect(yearIssues(V.kospi, 2017).some((e) => e.name === "북한 긴장(2017)")).toBe(true);
    expect(yearIssues(V.spx, 2017).some((e) => e.name === "북한 긴장(2017)")).toBe(false);
  });
  it("2013 키프로스 문장 교체, 2026은 진행 중 1행(표 맨 위)·연말 값이 없으니 해 행은 없다", () => {
    expect(data.eventsYear.find((e) => e.id === "Y2013-1")?.fact).toBe("키프로스가 유로존·IMF 지원 과정에서 예금 과세안을 내놨어요.");
    expect(V.spx.wip?.y).toBe(2026);
    expect(V.spx.tbl.some((r) => r.y === 2026)).toBe(false);
    expect(V.spx.issues[2026]).toBeUndefined();
  });
  it("기존 정본 사건(A)은 이름·사실이 그대로, 읽기 줄·표·오른 해가 같은 값(yearIssues)", () => {
    const row = V.spx.tbl.find((r) => r.y === 2008)!;
    expect(row.issues).toBe(yearIssues(V.spx, 2008));
    expect(readoutOf(V.spx, 2008).events).toBe("글로벌 금융위기 · 연준 자산 매입 시작");
  });
  it("qa 원문 대조 반영: 1991 걸프전 문장·1999 출처·2026 날짜 표기", () => {
    const by = Object.fromEntries(data.eventsYear.map((e) => [e.id, e]));
    expect(by["Y1991-1"].fact).toBe("1월에 걸프전이 시작됐어요.");
    expect(by["Y1999-1"].urls).toEqual(["https://www.federalreserve.gov/fomc/minutes/19990202.htm", "https://www.federalreserve.gov/fomc/minutes/19981222.htm"]);
    expect(by["Y2026-1"].date).toBe("2026년 초");
  });
  it("첫 화면 사건 점은 31건 그대로", () => {
    expect(V.spx.ev.length).toBe(23);
    expect(V.kospi.ev.length).toBe(21);
    expect(data.events).toHaveLength(31);
  });
  it("1996·2006 행은 데이터에 없다", () => {
    expect(data.eventsYear.some((e) => e.id === "Y1996-1" || e.id === "Y2006-1")).toBe(false);
  });
});

describe("분류 라벨 nowrap(qa D-7)", () => {
  it("사건 분류 7종이 모두 nowrap 묶음에 있고, 분류를 보여 주는 곳은 모두 NoBreak를 쓴다", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), "src/app/(main)/_components/views/invest");
    const nw = readFileSync(join(dir, "nowrap.tsx"), "utf8");
    for (const c of ["금리·통화 정책", "금융위기", "시장 급락", "전쟁·지정학", "기술 거품", "팬데믹", "에너지"]) expect(nw, c).toContain(`"${c}"`);
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".tsx"))) {
      const src = readFileSync(join(dir, f), "utf8");
      for (const m of src.matchAll(/\{[a-zA-Z.]*\.cat\}/g)) throw new Error(`${f}: 분류를 NoBreak 없이 출력 ${m[0]}`);
    }
  });
});
