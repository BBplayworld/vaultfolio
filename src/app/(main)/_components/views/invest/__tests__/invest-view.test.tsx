// 투자 탭(#263) 화면 테스트: SSR 마크업(공개 가이드 규칙)·그림 속성·번들 격리·금지어. DOM 상호작용은 preview(qa)에서 본다.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildIndexView } from "@/lib/invest/calc";
import { headlineLines, sourceLines } from "@/lib/invest/text";
import { marketHistory } from "@/lib/invest/market-history";
import { InvestView } from "../invest-view";
import { layoutMain, MainChart, yearAtX } from "../main-chart";
import { DropList } from "../drop-list";
import { YearTable } from "../year-table";
import { PeriodCard } from "../period-card";
import { YearGrid } from "../year-grid";
import { defaultPeriod } from "@/lib/invest/period";

const views = { spx: buildIndexView(marketHistory, "spx"), ndx: buildIndexView(marketHistory, "ndx"), kospi: buildIndexView(marketHistory, "kospi") };
const chart = (k: keyof typeof views, w: number, o: { wide?: boolean; selEp?: number | null; selYear?: number | null; ov?: boolean } = {}) =>
  renderToStaticMarkup(<MainChart data={marketHistory} view={views[k]} width={w} wide={!!o.wide} selEp={o.selEp ?? null} selYear={o.selYear ?? null} overlay={o.ov ? "y10" : null} onPickYear={() => {}} />);
const count = (html: string, re: RegExp) => (html.match(re) || []).length;

// 문장 규칙(spec 6절) 자동 검사 목록. `~해서`·`~하세요`는 사람이 대조한다.
export const FORBIDDEN = ["때문", "덕분", "로 인해", "영향으로", "촉발", "여파", "역전", "신호", "예고", "기회", "타이밍", "유리", "추천", "수익", "로그", "지금 사면", "전조", "조심", "경고", "과열", "붐", "기대", "연착륙", "반등", "→", "↑", "↓", "가데이터", "확인 중"];
// `수익률` 허용 위치(CEO R4.1): 카드 제목 2(연도별 수익률·기간 수익률)·격자 범례 1(아래 기간 수익률에서 고른 기간) — 그 밖의 `수익`은 0
// `→` 예외(CEO R4.2 R1): 기간 결과 공통 1줄 `같은 총액, {시작}년 말 → {끝}년 말` 1곳(시간 구간 표기, 인과 화살표 아님)
const allowRate = (t: string) => t.replaceAll("연도별 수익률", "").replaceAll("기간 수익률", "").replaceAll("년 말 → ", "년 말 ");
const stripTags = (h: string) => h.replace(/<[^>]*>/g, " ");

describe("투자 탭 그림: 이름표·점·침체 띠(AC9·AC11~13)", () => {
  it("이름표 전부 노출: 390(326)·320(264) S&P 4/4 · 나스닥 3/3 · 코스피 6/6", () => {
    for (const w of [326, 264]) {
      const sizes = { spx: 4, ndx: 3, kospi: 6 } as const;
      for (const k of ["spx", "ndx", "kospi"] as const) {
        const L = layoutMain(views[k], w, false);
        expect(L.labels.filter((l) => !l.drop)).toHaveLength(sizes[k]);
        expect(count(chart(k, w), /data-nm="1"/g)).toBe(sizes[k]);
      }
    }
  });
  it("이름표 단: 320 코스피만 3단, 나머지 폭·지수는 ≤2단", () => {
    expect(layoutMain(views.kospi, 264, false).nameRows).toBeLessThanOrEqual(3);
    expect(layoutMain(views.spx, 264, false).nameRows).toBeLessThanOrEqual(2);
    expect(layoutMain(views.ndx, 264, false).nameRows).toBeLessThanOrEqual(2);
    for (const k of ["spx", "ndx", "kospi"] as const) {
      expect(layoutMain(views[k], 326, false).nameRows).toBeLessThanOrEqual(2);
      expect(layoutMain(views[k], 1000, true).nameRows).toBeLessThanOrEqual(2);
    }
  });
  it("침체 띠: 미국 지수 9구간, 코스피 0", () => {
    expect(count(chart("spx", 326), /data-rec=/g)).toBe(9);
    expect(count(chart("ndx", 326), /data-rec=/g)).toBe(4);
    expect(count(chart("kospi", 326), /data-rec=/g)).toBe(0);
  });
  it("사건 점: 합친 뒤에도 모든 사건이 점 안에 있고(ids), 표시 점 간격 ≥6px", () => {
    for (const k of ["spx", "ndx", "kospi"] as const) {
      for (const w of [264, 326, 1000]) {
        const html = chart(k, w, { wide: w > 600 });
        const ids = [...html.matchAll(/data-ev-ids="([^"]+)"/g)].flatMap((m) => m[1].split(","));
        expect(ids.sort()).toEqual(views[k].ev.map((e) => e.id).sort());
        const xs = [...html.matchAll(/<circle cx="([\d.]+)" cy="[\d.]+" r="(?:2|3\.3)"[^>]*data-ev=/g)].map((m) => +m[1]).sort((a, b) => a - b);
        for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(6);
      }
    }
  });
  it("C2 회복 띠는 기본 상태에서 0, 행을 펼치면(selEp) 나타난다", () => {
    expect(chart("spx", 326)).not.toContain("recovery-band");
    expect(chart("spx", 326, { selEp: 2 })).toContain("recovery-band");
  });
  it("C3 선택선은 글자 구간에서 끊긴다(세로선 3조각) + 읽기 선택 표식", () => {
    const html = chart("spx", 326, { selYear: 2008 });
    const g = html.slice(html.indexOf('data-testid="year-select"'));
    expect(count(g.slice(0, g.indexOf("</g>")), /<line /g)).toBe(3);
  });
  it("겹쳐 보기 선은 항상 DOM에 있고 꺼짐은 opacity 0, 켜면 1 (스케일 같음)", () => {
    const off = chart("spx", 326), on = chart("spx", 326, { ov: true });
    expect(off).toContain("overlay-line");
    expect(off).toMatch(/data-testid="overlay-line"[^>]*opacity:0/);
    expect(on).toMatch(/data-testid="overlay-line"[^>]*opacity:1/);
    // 켜기 전·후 금리 층(오른쪽 축 눈금 포함) 좌표 같음: opacity 값만 다르다
    expect(off.replace(/opacity:0/, "opacity:1")).toBe(on);
  });
  it("차트 접근성: role=img, 대체 문장에 연도별 표 안내, touch-action pan-y", () => {
    const html = chart("kospi", 326);
    expect(html).toContain('role="img"');
    expect(html).toContain("같은 값은 아래 연도별 표에 있어요");
    expect(html).toContain("touch-action:pan-y");
  });
  it("선택 해: 탭 위치는 그 해 막대 안, 범위 밖은 끝 해로", () => {
    const W = 326;
    expect(yearAtX(views.spx, W, 0)).toBe(1961);
    expect(yearAtX(views.spx, W, 400)).toBe(2025);
  });
});

describe("투자 탭 행·표·③ 마크업", () => {
  it("목록 행 = 하락 건수 전부(R7), 각주 2개, 기본 접힘", () => {
    for (const [k, n] of [["spx", 4], ["ndx", 3], ["kospi", 6]] as const) {
      const html = renderToStaticMarkup(<DropList data={marketHistory} view={views[k]} sel={null} yr={null} onSelect={() => {}} inlineDetail width={300} />);
      expect(count(html, /data-testid="drop-row"/g)).toBe(n);
      expect(count(html, /aria-expanded="false"/g)).toBe(n + 1); // 행 n + 각주 접힘 버튼 1(5.138 D-2)
      expect(html).toContain('data-testid="invest-notes"');
      expect(count(html, /data-testid="drop-dd"/g)).toBe(n); // D-3: 행마다 낙폭 상시
      expect(html).not.toContain("episode-detail");
      expect(html).toContain("무엇이 원인인지는 말하지 않아요");
    }
  });
  it("행 펼침: 낙폭·3칸·침체 문구·사건 사실 1줄(S&P 금융위기)", () => {
    const html = renderToStaticMarkup(<DropList data={marketHistory} view={views.spx} sel={2} yr={null} onSelect={() => {}} inlineDetail width={300} />);
    expect(html).toContain("episode-detail");
    expect(html).toContain("−38.5%");
    expect(html).toContain("미국 경기침체 2008년 1월~2009년 6월(NBER)");
    expect(html).toContain("리먼 브라더스가 파산 보호를 신청했어요.");
    expect(html).toContain("고점에서 전고점까지");
    expect(html).toContain("4.25%에서 0.25%로");
  });
  it("코스피 펼침에는 침체 줄이 없다(AC20)", () => {
    const html = renderToStaticMarkup(<DropList data={marketHistory} view={views.kospi} sel={3} yr={null} onSelect={() => {}} inlineDetail width={300} />);
    expect(html).not.toContain("detail-recession");
  });
  it("2022 행은 `이 기간에 미국 경기침체는 없었어요(NBER)`", () => {
    const html = renderToStaticMarkup(<DropList data={marketHistory} view={views.spx} sel={3} yr={null} onSelect={() => {}} inlineDetail width={300} />);
    expect(html).toContain("이 기간에 미국 경기침체는 없었어요(NBER)");
  });
  it("연도별 표는 접힌 채 SSR에는 표 HTML 0(AC34)", () => {
    const html = renderToStaticMarkup(<YearTable view={views.spx} />);
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('data-testid="yearly-table"');
  });
  it("기간 수익률 카드 기본 S&P 2015→2025: 한 번에 3.35배·+235%·+12.85% / 매달 2.01배·+101%·평균 5.0년, 어림 1줄·ⓘ·고정 문장", () => {
    const html = renderToStaticMarkup(<PeriodCard view={views.spx} period={defaultPeriod(views.spx)} onChange={() => {}} />);
    for (const t of ["3.35배", "+235%", "+12.85%", "2.01배", "+101%", "넣은 돈이 들어가 있던 기간은 ", "평균 5.0년이에요"]) expect(html).toContain(t);
    expect(html).toContain('월 지수 값 대신 연말 값의 평균으로 매달 산 것으로 <span class="whitespace-nowrap">어림했어요<button'); // 끝 어절 + ⓘ 한 묶음(5.143 UI(a))
    expect(html).toContain('data-testid="calc-hold-dca"');
    expect(html).toContain('data-testid="honest-irr"');
    expect(html).toContain("넣은 시점을 반영해 해마다 평균으로 바꾸면 ");
    expect(html).toContain("+13.60%예요.");
    expect(html).toContain("배당을 다시 넣었다면 결과는 이보다 커요.");
    expect(html).toContain("반올림하지 않은 값으로 계산해 마지막에 한 번만 반올림해요");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("가장 낮았던 해 말");
    expect(html).not.toMatch(/한 번에<\/button>|해마다<\/button>/);
    expect(html).toContain("S&amp;P 500 기간 수익률");
  });
  it("연도별 수익률 격자: S&P 7열·셀 65개·밑줄 2016~2025·범례 문구", () => {
    const html = renderToStaticMarkup(<YearGrid view={views.spx} period={{ sy: 2015, ey: 2025 }} showLevels />);
    expect(count(html, /data-testid="year-cell"/g)).toBe(65);
    expect(html).toContain("grid-template-columns:12px repeat(7, minmax(0, 1fr))");
    expect(count(html, /inset 0 -3px 0 var\(--brand\)/g)).toBe(10);
    expect(html).toContain("S&amp;P 500 연도별 수익률");
    expect(html).toContain("아래 기간 수익률에서 고른 기간");
    expect(html).toContain("−38.5");
    expect(count(renderToStaticMarkup(<YearGrid view={views.kospi} period={{ sy: 2015, ey: 2025 }} showLevels />), /role="columnheader"/g)).toBe(5);
  });
  it("모바일 섹션 순서(P2) first→drops→grid→period→deeper, 지수 선택기 상단 고정(P4)", () => {
    const html = renderToStaticMarkup(<InvestView variant="guide" />);
    const idx = ["first", "drops", "grid", "period", "deeper"].map((id) => html.indexOf(`data-section="${id}"`));
    expect(idx.every((i) => i > 0)).toBe(true);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    expect(html).toContain('data-testid="invest-index-sticky"');
    expect(html).toContain("sticky top-[max(var(--trial-bar-h,0px),env(safe-area-inset-top,0px))]");
  });
});

describe("투자 탭 공개 가이드 SSR 규칙(AC34)", () => {
  const html = renderToStaticMarkup(<InvestView variant="guide" />);
  it("머리 3줄·목록 행은 SSR에 있고, 그림·표·지수 수준값은 없다", () => {
    expect(html).toContain("1961년 이후 연말 기준 15% 넘게 빠진 때는 4번이었어요");
    expect(count(html, /data-testid="drop-row"/g)).toBe(4);
    expect(html).toContain("invest-chart-skeleton");
    expect(html).not.toContain('data-testid="invest-chart"');
    expect(html).not.toContain('role="img"');
    expect(html).not.toContain('data-testid="yearly-table"');
    expect(html).toContain("pattern-conclusion");
    expect(html).toContain("크게 빠지기 전 12개월에 연준 금리가 올라간 때는 자료가 있는 3번 중 1번이었어요.");
    for (const level of ["6,846", "6846", "5,882", "903", "1,469", "1469", "4,766"]) expect(html).not.toContain(level);
  });
  it("지수 선택 3칸·출처 4줄이 있고 다운로드·복사·CSV 링크가 없다", () => {
    expect(html).toContain('data-testid="invest-index-kospi"');
    expect(count(stripTags(html), /Damodaran|가격 지수|상표이며/g)).toBeGreaterThan(0);
    expect(html).not.toMatch(/\.csv|download|<a /i);
  });
});

describe("투자 탭 문장 규칙·번들 격리", () => {
  it("금지어 0: 모든 지수의 머리·출처·가이드 SSR 문장", () => {
    const rev = { spx: marketHistory.idx.spx.rev, ndx: marketHistory.idx.ndx.rev, kospi: marketHistory.idx.kospi.rev };
    const texts: string[] = [stripTags(renderToStaticMarkup(<InvestView variant="guide" />))];
    for (const k of ["spx", "ndx", "kospi"] as const) {
      const h = headlineLines(views[k]);
      texts.push(h.l1, h.l2 ? h.l2.lead + h.l2.bold + h.l2.rest : "", h.l3, ...sourceLines(views[k], rev));
      for (const e of views[k].ev) texts.push(e.name, e.date, e.cat, e.fact);
    }
    for (const t of texts) for (const w of FORBIDDEN) expect(allowRate(t), `금지어 ${w}`).not.toContain(w);
  });
  it("금지어 0: 화면·계산 소스의 문장(주석 제외)", () => {
    const root = path.join(__dirname, "..");
    const files = [...fs.readdirSync(root).filter((f) => /\.(tsx?|ts)$/.test(f)).map((f) => path.join(root, f)), path.join(__dirname, "../../../../../../lib/invest/text.ts"), path.join(__dirname, "../../../../../../lib/invest/calc.ts")];
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      for (const w of FORBIDDEN) expect(allowRate(src), `${path.basename(f)}의 금지어 ${w}`).not.toContain(w);
    }
  });
  it("`수익률`은 허용 위치(격자 제목·범례, 기간 카드 제목)에만 있다", () => {
    const root = path.join(__dirname, "..");
    const hits: string[] = [];
    for (const f of fs.readdirSync(root).filter((n) => /\.tsx?$/.test(n))) {
      const src = fs.readFileSync(path.join(root, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      for (const m of src.matchAll(/.{0,8}수익률.{0,8}/g)) hits.push(`${f}:${m[0]}`);
    }
    expect(hits.every((h) => /^(year-grid|period-card)\.tsx:/.test(h))).toBe(true);
    expect(hits.filter((h) => h.startsWith("year-grid")).length).toBe(3);
    expect(hits.filter((h) => h.startsWith("period-card")).length).toBe(1);
  });
  it("투자 데이터·화면 본체를 정적 import하는 파일은 투자 폴더·가이드뿐이다(첫 화면 JS 증가 0)", () => {
    const srcRoot = path.join(__dirname, "../../../../../..");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); continue; }
        if (!/\.(tsx?|mjs)$/.test(e.name) || p.includes("__tests__") || /\.test\./.test(e.name)) continue;
        const src = fs.readFileSync(p, "utf8");
        if (/from\s+["'][^"']*(invest-view|lib\/invest\/market-history|market-history\.generated)["']/.test(src)) hits.push(path.relative(srcRoot, p));
      }
    };
    walk(srcRoot);
    const bad = hits.filter((h) => !h.includes("views/invest/") && !h.includes("src/lib/invest/") && !h.startsWith("lib/invest/") && !h.startsWith("app/guide/"));
    expect(bad).toEqual([]);
    // 앱 연결 파일은 동적 진입점(invest-lazy)만 import 한다
    for (const f of ["app/(main)/_components/layout/navigation/asset-page-tabs.tsx", "app/(main)/_components/pwa/bottom-nav.tsx"]) {
      const p = path.join(srcRoot, f);
      if (fs.existsSync(p)) expect(fs.readFileSync(p, "utf8")).not.toMatch(/invest-view|market-history/);
    }
  });
  it("진입 컴포넌트는 next/dynamic + ssr:false", () => {
    const src = fs.readFileSync(path.join(__dirname, "../invest-lazy.tsx"), "utf8");
    expect(src).toContain("next/dynamic");
    expect(src).toContain("ssr: false");
    expect(src).toContain("LOAD_ERROR");
    expect(src).toContain("다시 시도");
  });
  it("저장·전송 0: 투자 화면 소스에 저장소·fetch·XHR·sendBeacon 호출이 없다", () => {
    const root = path.join(__dirname, "..");
    for (const f of fs.readdirSync(root).filter((n) => /\.tsx?$/.test(n))) {
      const src = fs.readFileSync(path.join(root, f), "utf8");
      expect(src, f).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie|\bfetch\(|XMLHttpRequest|sendBeacon|useAssetStorage/);
    }
  });
});
