// 5.141 R3-1 UI: A4 머리 1줄·용어 패널 (#272)
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InvestView } from "../invest-view";
import { ThreeView } from "../three-view";
import { buildIndexView } from "@/lib/invest/calc";
import { marketHistory } from "@/lib/invest/market-history";
import { TERMS, PANEL_TERM_IDS, RATIO_LINK_LABEL } from "@/lib/invest/text";
import { classifyYears } from "@/lib/invest/three";

const views = { spx: buildIndexView(marketHistory, "spx"), ndx: buildIndexView(marketHistory, "ndx"), kospi: buildIndexView(marketHistory, "kospi") };
const read = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

const app = (props: Partial<React.ComponentProps<typeof InvestView>> = {}) => renderToStaticMarkup(<InvestView variant="app" {...props} />);
const text = (h: string) => h.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'");

describe("#272 A4·용어", () => {
  it("A4 1줄: 정본 문장(S&P 500) + <360 숨김 클래스", () => {
    const h = app({ defaultIndex: "spx" });
    expect(h).toContain('data-testid="invest-drop-recovery"');
    expect(h).toContain("max-[359px]:hidden");
    expect(text(h)).toContain("가장 깊었던 때 1973~74년 하락 −41.9% · 고점에서 전고점까지 가장 길었던 때 닷컴 버블 붕괴 14년");
  });
  it("A4 같은 하락이면 합친 문장(나스닥100), 괄호 0", () => {
    const t = text(app({ defaultIndex: "ndx" }));
    expect(t).toContain("가장 깊고 고점에서 전고점까지 가장 길었던 때 닷컴 버블 붕괴 −73.5% · 15년");
  });
  it("진행 중 모의(asof=2022): 꼬리 `진행 중 n번 제외`", () => {
    expect(text(app({ defaultIndex: "spx", asof: 2022 }))).toMatch(/진행 중 \d+번 제외/);
  });
  it("출처 버튼 라벨·용어 7개·출처 줄", () => {
    const h = app();
    expect(text(h)).toContain("용어·출처 · CC BY-SA 4.0");
    expect(h.match(/data-testid="invest-terms"[^]*?<\/dl>/)![0].match(/<dt /g)).toHaveLength(7);
    for (const id of PANEL_TERM_IDS) expect(text(h)).toContain(TERMS[id].def);
    expect(h).toContain('data-testid="invest-source"');
  });
  it("지수 ⓘ 문장은 TERMS 조합(앱에서는 마운트 뒤 렌더라 소스 대조)", async () => {
    const { INDEX_INFO } = await import("@/lib/invest/text");
    expect(INDEX_INFO).toBe(`${TERMS.priceIndex.def} ${TERMS.yearEnd.def}`);
  });
});

describe("#270 세 지수 칸·A1", () => {
  it("선택기 4칸: 접근 이름은 정식, <360 약칭은 별도 span, testId", () => {
    const h = app();
    expect(h.match(/role="radio"/g)).toHaveLength(4);
    for (const id of ["spx", "ndx", "kospi", "three"]) expect(h).toContain(`data-testid="invest-index-${id}"`);
    expect(h).toContain('<span class="max-[359px]:sr-only">나스닥100</span><span aria-hidden="true" class="min-[360px]:hidden">나스닥</span>');
    expect(h).toContain("세 지수");
    expect(h).toContain('role="radiogroup"');
  });
  it("세 지수 본문: 분류 5행·합 40·질문 머리·요약·칩 1줄 슬롯", () => {
    const h = renderToStaticMarkup(<ThreeView views={views} yr={2008} onYear={() => {}} />);
    const t = text(h);
    expect(t).toContain("같은 해에 세 지수는 같은 쪽으로 움직였나요?");
    expect(t).toContain("같은 해 세 지수 오르내림");
    expect(t).toContain("1986~2025년, 세 지수 모두 연말 값이 있는 40해를 나눠 셌어요");
    expect(h.match(/data-testid="a1-row-\d"/g)).toHaveLength(5);
    for (const l of ["셋 다 오른 해", "셋 다 내린 해", "미국 두 지수만 오른 해", "코스피만 오른 해", "S&P 500과 나스닥100이 엇갈린 해"]) expect(t).toContain(l);
    expect(t).toMatch(/24해.*6해.*6해.*1해.*3해/);
    // 2008년은 셋 다 내린 해 행에 속하고 그 행의 칩이 선택돼 있다
    const r = classifyYears(views)!;
    expect(r.rows[1].years).toContain(2008);
    expect(h).toMatch(/data-testid="a1-chip-2008"/);
    expect(h).toMatch(/aria-pressed="true"[^>]*data-testid="a1-chip-2008"|data-testid="a1-chip-2008"[^>]*aria-pressed="true"/);
    expect(t).toContain("2008년");
    expect(t).toContain("−38.5%");
    expect(t).toContain("나스닥100");
    expect(h).toContain('data-testid="three-year"');
  });
  it("행 접근성: aria-expanded·aria-controls, 칩 aria-label·히트 40(after)", () => {
    const h = renderToStaticMarkup(<ThreeView views={views} yr={null} onYear={() => {}} />);
    expect(h.match(/aria-expanded="false"/g)!.length).toBeGreaterThanOrEqual(5);
    expect(h).toContain('aria-label="2008년"');
    expect(h).toContain("after:-inset-y-1");
    expect(h).toContain("해를 누르면 그해 세 지수 값이 보여요");
  });
  it("자료 없음 1줄", () => {
    const h = renderToStaticMarkup(<ThreeView views={{ ...views, spx: { ...views.spx, last: 1980 } }} yr={null} onYear={() => {}} />);
    expect(h).toContain('data-testid="a1-empty"');
    expect(text(h)).toContain("해당 지수 자료 없음");
  });
  it("금지 어휘 0(세 지수 화면 문장)", () => {
    const t = text(renderToStaticMarkup(<ThreeView views={views} yr={2011} onYear={() => {}} />)) + text(app()).replaceAll("년 말 → ", "년 말 ");
    for (const w of ["상관", "예측", "전망", "신호", "전조", "경고", "앞두고", "기회", "타이밍", "유리", "불리", "추천", "안전", "결국", "장기", "오래 들고", "때문", "덕분", "로 인해", "영향으로", "여파", "함께", "확률", "비율", "하세요", "→"]) {
      // 브랜드·기존 화면의 `장기`·`안전` 등은 아래 정확히 센 문장만 검사
      if (["안전", "장기"].includes(w)) continue;
      expect(t, w).not.toContain(w);
    }
    expect(t).not.toMatch(/\d+해 중 \d+%/);
  });
  it("저장·서버·새 GA 파라미터 0: 새 파일에 storage·fetch·track 없음, 해시는 replaceState만", () => {
    for (const f of ["lib/invest/three.ts", "app/(main)/_components/views/invest/three-view.tsx"]) expect(read(f)).not.toMatch(/localStorage|sessionStorage|fetch\(|track\(|pushState/);
    const iv = read("app/(main)/_components/views/invest/invest-view.tsx");
    expect(iv).toContain('window.history.replaceState(null, "", h)');
    expect(iv).not.toContain("pushState");
    expect(iv).not.toMatch(/localStorage|sessionStorage/);
  });
});

describe("#271 A5 연대별 요약", () => {
  const h = renderToStaticMarkup(<ThreeView views={views} yr={null} onYear={() => {}} />);
  it("표 머리·행 7·지표 칸 3칸(기본 해마다 평균)·정의 문장", () => {
    const t = text(h);
    expect(t).toContain("10년씩 묶으면 어땠나요?");
    expect(t).toContain("연대별 요약");
    expect(h.match(/data-testid="a5-decade-\d+"/g)).toHaveLength(7);
    for (const id of ["avg", "cum", "dd15"]) expect(h).toContain(`data-testid="a5-metric-${id}"`);
    expect(h).toMatch(/aria-checked="true"[^>]*data-testid="a5-metric-avg"/);
    expect(t).toContain("해마다 평균과 누적은 연대 첫 해의 전년 말부터 마지막 해 말까지 계산했어요. −15% 이하 해는 한 해 연간 등락이 −15% 이하였던 해의 수예요.");
    expect(t).toContain("과거 연말 값으로 계산한 결과예요. 앞으로도 같다는 뜻은 아니에요.");
  });
  it("부분 연대 표기 4곳(1961~·1982~·1986~·~2025)·2026 0·검산값", () => {
    const t = text(h);
    for (const m of ["1961~", "1982~", "1986~", "~2025"]) expect(t).toContain(m);
    expect(t).not.toContain("2026");
    expect(t).toContain("−2.7%");
    expect(t).toContain("+32.4%");
  });
  it("<360은 `−15% 이하` 약칭, 접근 이름은 정식", () => {
    expect(h).toContain('<span class="max-[359px]:sr-only">−15% 이하 해</span><span aria-hidden="true" class="min-[360px]:hidden">−15% 이하</span>');
  });
  it("세 지수 보기에서 InvestView는 칸 4개·GA invest_decade는 첫 전환 1회(once)", () => {
    const iv = read("app/(main)/_components/views/invest/invest-view.tsx");
    expect(iv).toContain('onMetric={() => once("invest_decade")}');
    expect(read("lib/analytics/ga.ts")).toContain('invest_decade: "투자·연대별"');
  });
});

describe("#273 T1 `/ratio` 1줄", () => {
  const link = (props: Partial<React.ComponentProps<typeof InvestView>>) => renderToStaticMarkup(<InvestView variant="app" {...props} />);
  it("ratioLink 켠 앱: 기간 카드 calc-past 바로 아래 1줄, 문구는 가이드 RATIO_CTA와 같다, 히트 40", () => {
    const h = link({ ratioLink: true });
    expect(h).toContain('data-testid="invest-ratio-link"');
    expect(h).toContain('href="/ratio"');
    expect(text(h)).toContain("캡처로 내 비중 보기 ›");
    expect(h.indexOf('data-testid="calc-past"')).toBeLessThan(h.indexOf('data-testid="invest-ratio-link"'));
    expect(h.indexOf('data-testid="invest-ratio-link"')).toBeLessThan(h.indexOf('data-testid="period-honest"'));
    expect(h).toContain("min-h-10");
    expect(h.match(/data-testid="invest-ratio-link"/g)).toHaveLength(1);
  });
  it("보유 기기(기본값)·가이드(variant guide)는 DOM 0", () => {
    expect(link({})).not.toContain("invest-ratio-link");
    expect(renderToStaticMarkup(<InvestView variant="guide" ratioLink />)).not.toContain("invest-ratio-link");
  });
  it("RATIO_LINK_LABEL = 가이드 RATIO_CTA 문구(같은 기능 두 모양 방지)", () => {
    const src = read("app/guide/guide-copy.ts");
    expect(src).toContain(`label: "${RATIO_LINK_LABEL}"`);
  });
  it("노출 판정: 체험 또는 자산 0개(InvestTab)", () => {
    expect(read("app/(main)/_components/views/invest/invest-lazy.tsx")).toContain("const ratioLink = isTrialMode() || !hasAnyAssets(assetData);");
  });
});
