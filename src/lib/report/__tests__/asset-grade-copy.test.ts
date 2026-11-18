// #239 [5.125] 성적표 문장 정리(AC-13) — '다음 행동' 줄을 채점 기준을 알리는 사실형으로. 점수·등급 계산은 기존 테스트가 고정한다.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { AssetSummary, MonthlyAssetSnapshot } from "@/types/asset";
import type { AssetReport } from "../asset-report";
import { computeAssetGrade, GRADE_THRESHOLDS as G, scoreHabit, type AssetGradeInputs, type AxisKey } from "../asset-grade";
import { WHATS_NEW } from "@/config/whats-new";
import { APP_FEATURES } from "@/config/app-features";

const summary = (o: Partial<AssetSummary> = {}): AssetSummary => ({
  totalValue: 100_000_000, totalCost: 80_000_000, totalProfit: 20_000_000, totalProfitRate: 25, netAsset: 100_000_000,
  loanBalance: 0, cashValue: 20_000_000, ...o,
} as AssetSummary);
const report = (o: Partial<AssetReport> = {}): AssetReport => ({
  totalProfitRate: 10, priceGain: 1, currencyGain: 0, equity: 80_000_000, debtRatio: 0, annualInterest: 0,
  perClass: [{ label: "주식", value: 50_000_000 }, { label: "현금", value: 50_000_000 }], ...o,
} as unknown as AssetReport);
const inputs = (o: Partial<AssetGradeInputs> = {}): AssetGradeInputs => ({
  summary: summary(), report: report(), yearlyNetAssets: [], monthlySnapshots: [], topShare: null, fxRatioSum: 0,
  dividend: { annual: 0, ready: true }, coverage: { value: 0, ready: true }, ...o,
});
const axis = (key: AxisKey, o: Partial<AssetGradeInputs> = {}) => computeAssetGrade(inputs(o)).axes.find((a) => a.key === key)!;
const years = (...v: number[]) => v.map((netAsset, i) => ({ year: 2020 + i, netAsset }));

describe("축 문장 — spec 전수 목록(표 16행 + reason 2건)", () => {
  it("성장: 유지 1 · 교체 3", () => {
    expect(axis("growth").action).toBe("연말마다 순자산이 자동 기록됩니다. 1년 뒤부터 측정돼요."); // 유지(사실)
    expect(axis("growth", { yearlyNetAssets: years(100, -5) }).action).toBe("순자산이 플러스가 되면 성장률이 계산돼요.");
    expect(axis("growth", { yearlyNetAssets: years(100, 130) }).action).toBe("연평균 성장률 15% 이상이 이 축의 가장 높은 구간이에요.");
    expect(axis("growth", { yearlyNetAssets: years(100, 103) }).action).toBe("연평균 성장률 5%·10%·15%를 넘을 때마다 점수 구간이 바뀌어요.");
  });
  it("수익의 질: 교체 2", () => {
    expect(axis("earningQuality", { dividend: { annual: 100, ready: true } }).action).toBe("수익률, 수익 원천 수, 배당수익률로 계산한 점수예요.");
    expect(axis("earningQuality").action).toBe("수익률과 시세차익·환차익·배당 중 기록된 원천 수로 계산한 점수예요.");
  });
  it("레버리지: 교체 4 + reason 1", () => {
    expect(axis("leverage", { summary: summary({ loanBalance: 10 }), report: report({ equity: -1 }) }).action).toBe("투입 원금이 부채보다 커지면 다시 계산돼요.");
    expect(axis("leverage").action).toBe("부채가 기록되면 부채비율과 평균 금리로 계산해요.");
    const high = axis("leverage", { summary: summary({ loanBalance: 70_000_000 }), report: report({ debtRatio: 70, annualInterest: 1_000_000 }) });
    expect(high.action).toBe("부채비율 40%, 평균 금리 6%를 넘으면 감점되는 축이에요.");
    expect(high.reason).toContain("부채비율 70%로 높음");
    expect(high.reason).not.toContain("과도");
    const ok = axis("leverage", { summary: summary({ loanBalance: 10_000_000 }), report: report({ debtRatio: 10, annualInterest: 300_000 }) });
    expect(ok.action).toBe("부채비율, 평균 금리, 이자 대비 투자 수익으로 계산한 점수예요.");
  });
  it("분산: 교체 2 + reason 1", () => {
    const skew = axis("diversification", { fxRatioSum: 80 });
    expect(skew.action).toBe("자산군·분야·통화 비중이 한쪽에 몰릴수록 감점되는 축이에요.");
    expect(skew.reason).toContain("외화 비중 80%로 높음");
    expect(skew.reason).not.toContain("환리스크");
    expect(axis("diversification").action).toBe("자산군·분야·통화 비중으로 계산한 점수예요.");
  });
  it("습관: 유지 1 · 교체 3", () => {
    const m: MonthlyAssetSnapshot[] = [];
    expect(scoreHabit(summary({ totalValue: 0 }), m).action).toBe("자산을 등록해보세요."); // 유지(앱 사용 안내)
    expect(scoreHabit(summary({ cashValue: 60_000_000 }), m).action).toBe("현금을 뺀 자산 비중 30%·50%·70%에서 점수 구간이 바뀌어요.");
    expect(scoreHabit(summary({ cashValue: 0 }), m).action).toBe("현금이 0원이면 이 축에서 감점돼요.");
    expect(scoreHabit(summary({ cashValue: 20_000_000 }), m).action).toBe("현금을 뺀 자산 비중, 꾸준한 기록, 이번 달 기록률로 계산한 점수예요.");
  });
  it("문장 속 숫자는 GRADE_THRESHOLDS에서 온다(기준이 바뀌면 문장도 따라간다)", () => {
    expect([G.growth.cagrReal, G.growth.cagrGood, G.growth.cagrExcellent]).toEqual([5, 10, 15]);
    expect([G.leverage.debtRatioElevated, G.leverage.avgRateHigh]).toEqual([40, 6]);
    expect([G.habit.investRatioLow, G.habit.investRatioMid, G.habit.investRatioHigh]).toEqual([30, 50, 70]);
    expect([G.tier.silver, G.tier.gold, G.tier.platinum]).toEqual([2.5, 3.5, 4.5]);
    const text = readFileSync(path.resolve(__dirname, "../asset-grade.ts"), "utf8");
    for (const literal of ["15% 이상이 이 축", "5%·10%·15%", "부채비율 40%,", "30%·50%·70%"]) expect(text).not.toContain(literal);
  });
});

const VIEW_DIR = path.resolve(__dirname, "../../../app/(main)/_components/views/activity");
const read = (f: string) => readFileSync(path.join(VIEW_DIR, f), "utf8");

describe("등급 한 줄 4행 · 축 링크 문구", () => {
  const view = read("asset-report-view.tsx");
  it("등급 문장은 tier 상수로 조립한다", () => {
    for (const s of [
      "bronze: `종합 점수가 ${TIER_CUT.silver}점 미만이에요. 축을 펼치면 점수 기준이 보여요.`",
      "silver: `종합 점수가 ${TIER_CUT.silver}점 이상이에요. ${TIER_CUT.gold}점부터 골드예요.`",
      "gold: `종합 점수가 ${TIER_CUT.gold}점 이상이에요. ${TIER_CUT.platinum}점부터 플래티넘이에요.`",
      "platinum: `종합 점수가 ${TIER_CUT.platinum}점 이상이에요.`",
    ]) expect(view).toContain(s);
  });
  it("축 링크 3개의 글자와 도착지·노출 조건은 그대로다(AC-3)", () => {
    for (const s of ['diversification: "주식 X-Ray 보기"', 'growth: "연도별 자산 변화 보기"', 'habit: "현금 보기"']) expect(view).toContain(s);
    expect(view).toContain('if (key === "diversification") navigate({ type: "detail", tab: "stocks-xray" });');
    expect(view).toContain('else if (key === "growth") navigate({ type: "activity", tab: "change", init: { scope: "all", period: "year", source: "menu" } });');
    expect(view).toContain('else if (key === "habit") navigate({ type: "detail", tab: "cash" });');
    expect(view).toContain('(key === "diversification" && assetData.stocks.length > 0) || key === "growth" ||');
    expect(view.match(/stocks-xray/g)).toHaveLength(1); // X-Ray로 가는 진입은 분산 축 링크 1개
  });
  it("바뀌기 전 권유형 문장이 남아 있지 않다", () => {
    const all = view + readFileSync(path.resolve(__dirname, "../asset-grade.ts"), "utf8");
    for (const old of ["최우선입니다", "유지하세요", "늘려보세요", "방어됩니다", "만들어보세요", "회복하세요", "높일 수 있습니다", "재조정하면", "핵심입니다", "줄이세요", "리밸런싱", "옮겨 돈이", "안전합니다", "복리를 만듭니다", "실행해보세요", "끌어올리면", "최상위권", "꾸준히 유지하세요", "환리스크 큼", "로 과도"]) {
      expect(all, old).not.toContain(old);
    }
  });
});

// direction 금지 단어 — 불리기 화면·허브 카드·새 소식·기능 목록의 사용자 노출 문자열
const FORBIDDEN = [
  "추천", "유망", "우량", "좋은 종목", "나쁜 종목", "저평가", "고평가", "전망", "오를", "내릴", "목표가", "기대수익", "수익 보장", "불려 드려요",
  "사세요", "파세요", "매수 타이밍", "매도 타이밍", "익절", "손절", "물타기", "갈아타기", "비중을 줄이세요", "비중을 늘리세요", "리밸런싱 하세요",
  "적정 비중", "위험 종목", "경고", "점수 낮은 종목", "남들은",
];
// 주석을 뺀 코드에서 한글이 든 문자열·JSX 글자만 본다(주석은 사용자에게 보이지 않는다)
const visibleText = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");

describe("금지 단어 0(AC-13)", () => {
  it("이름표 블록·표시 값·축 문장", () => {
    const texts = [read("stock-label-block.tsx"), readFileSync(path.resolve(__dirname, "../../asset/grow-rows.ts"), "utf8"), readFileSync(path.resolve(__dirname, "../../asset/grow-board.ts"), "utf8"), readFileSync(path.resolve(__dirname, "../asset-grade.ts"), "utf8")];
    for (const t of texts) for (const w of FORBIDDEN) expect(visibleText(t), w).not.toContain(w);
  });
  it("허브 셋째 카드", () => {
    const hub = read("performance-hub.tsx");
    const card = hub.slice(hub.indexOf('data-testid="hub-card-report"'));
    for (const w of FORBIDDEN) expect(visibleText(card), w).not.toContain(w);
    // 6차(11/18): 메뉴 통합 — 제목·설명, 큰 값 = 성적표가 기록한 최신 등급(재계산 없음), 둘째 줄 = 점검 차례 수(불리기 화면과 같은 boardStatus)
    expect(card).toContain('title="자산 성적표·불리기"');
    expect(card).toContain('description="종합 등급과 종목 점검을 한곳에서"');
    expect(hub).toContain("const latestGrade = useLatestAssetGrade();");
    expect(card).toContain("{tierLabel(latestGrade.tier)}");
    expect(hub).toContain("boardStatus(buildBoardRows(assetData.stocks, exchangeRates, labels, growNow, assetData.transactions ?? []))");
    expect(visibleText(card)).toContain("점검 차례 <span");
    expect(visibleText(card)).toContain("장기 보유·점검 대상 정하기");
    expect(card).not.toMatch(/formatPriceByMode|모든 자산|투입 대비|산 날부터|pctText|weights|computeStockTotals/);
    expect(card.match(/getProfitLossColor\(/g)).toBeNull(); // 손익 금액 줄은 화면 안 결론 카드로 옮겼다
    expect(card).toContain("primaryClassName={ASSET_THEME.text.default}"); // 큰 값 숫자는 본문색, 등급 낱말만 등급 색
    expect(card).toContain('onClick={() => { resetReportTab(); go("report"); }}'); // 허브는 기본 칸(종목 점검)으로
  });
  it("새 소식 1줄·기능 목록 이름", () => {
    const entry = WHATS_NEW.find((e) => e.id === "20261117-01")!;
    expect(entry.title).toBe("성과에 '자산 성적표·불리기'가 생겼어요");
    expect(entry.featureId).toBe("report");
    const feature = APP_FEATURES.find((f) => f.id === "report")!;
    expect(feature.title).toBe("자산 성적표·불리기");
    expect(feature.description).toBe("성과 탭에서 종합 등급을 보고, 보유 주식을 장기 보유·점검 대상으로 나눠 기록해요.");
    expect(feature.target).toEqual({ type: "activity", tab: "report" });
    for (const w of FORBIDDEN) expect(`${entry.title}${entry.body}${feature.title}${feature.description}`, w).not.toContain(w);
  });
});

// src 아래(테스트 제외)에서 내용이 pattern에 맞는 파일의 상대 경로
function filesMatching(name: RegExp, pattern: RegExp): string[] {
  const root = path.resolve(__dirname, "../../..");
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const p = path.join(dir, entry);
      if (statSync(p).isDirectory()) { if (entry !== "__tests__") walk(p); }
      else if (name.test(entry) && pattern.test(readFileSync(p, "utf8"))) hits.push(path.relative(root, p));
    }
  };
  walk(root);
  return hits;
}

// 재설계 3차(11/18) — 판단은 막대·기준선이 맡고 말로 평가·권유하지 않는다(redesign.md 4절 grep 목록 + 오케스트레이터 금지어)
const REDESIGN_FORBIDDEN = [
  "더 좋", "나빠", "늘리", "줄이", "유지하세요", "이대로면", "전망", "목표", "가장", "쏠림", "추천", "좋아요", "유망", "성과 우수",
  "잘했어요", "흔들렸어요", "원칙 위반", "순위", "1위", "보다 높아요", "보다 낮아요", "덕분에", "때문에", "시장 대비",
];

describe("재설계 3차 금지어·금지 형식", () => {
  const block = visibleText(read("stock-label-block.tsx"));
  const rowsLib = visibleText(readFileSync(path.resolve(__dirname, "../../asset/grow-rows.ts"), "utf8"));
  const boardLib = visibleText(readFileSync(path.resolve(__dirname, "../../asset/grow-board.ts"), "utf8"));
  const hub = read("performance-hub.tsx");
  const hubCard = visibleText(hub.slice(hub.indexOf('data-testid="hub-card-report"')));
  const view = read("asset-report-view.tsx");
  const hint = view.slice(view.indexOf('data-testid="grow-hint"'), view.indexOf("</CardTitle>"));
  it("불리기 블록·표시 값·허브 셋째 카드·화면 제목 도움말에 금지어가 없다", () => {
    for (const [name, text] of [["블록", block], ["표시 값", rowsLib], ["판 값", boardLib], ["허브 카드", hubCard], ["도움말", hint]] as const) {
      for (const w of [...FORBIDDEN, ...REDESIGN_FORBIDDEN]) expect(text, `${name}: ${w}`).not.toContain(w);
    }
  });
  it("새 소식 본문에 금지어가 없고, 지금 화면이 보여 주는 것을 말한다(48자 이하)", () => {
    const body = WHATS_NEW.find((e) => e.id === "20261117-01")!.body!;
    for (const w of [...FORBIDDEN, ...REDESIGN_FORBIDDEN]) expect(body, w).not.toContain(w);
    expect(body).toBe("종합 등급과 종목 점검을 한곳에서 보고, 장기 보유·점검 대상은 내가 정해요");
    expect([...body].length).toBeLessThanOrEqual(48);
  });
  it("화면 제목 도움말은 1문단(a2fb703)", () => {
    expect(hint).toContain('<InfoHint summary="내 기준을 기록하고 내가 점검하는 화면이에요.">');
    expect(hint.match(/<p /g)).toHaveLength(1);
  });
  it("점수 기준표 ⓘ: 5개 구간을 HOLD_SCORE_BANDS에서 그리고, 측정 중 경계·같은 잣대 근거를 적는다", () => {
    const raw = read("stock-label-block.tsx");
    const scoreHint = raw.slice(raw.indexOf('data-testid="grow-score-hint"'), raw.indexOf("</InfoHint>", raw.indexOf('data-testid="grow-score-hint"')));
    expect(scoreHint).toContain("HOLD_SCORE_BANDS.map");
    expect(scoreHint).toContain("측정 중");
    expect(scoreHint).toContain("연 환산");
    expect(scoreHint.match(/<p className="text-pretty break-keep">/g)).toHaveLength(4); // 6차: 점수·측정 중 + 정한 날·점검일 대비 정의 + 묶음 ≠ 보유 기간
    expect(scoreHint).toContain("5점 만점");
    expect(scoreHint).toContain("장기 보유·점검 대상은 내가 정한 묶음이에요. 보유 기간과는 따로예요.");
    expect(scoreHint).toContain("정한 날 대비는 장기 보유·점검 대상으로 정한 날의 가격부터, 점검일 대비는 마지막으로 그대로 두기를 누른 날의 가격부터 지금까지예요.");
    // 괄호 뒤 조사로 줄이 끊기지 않게 문장에 괄호를 쓰지 않는다(C114) — JSX 표현식을 뺀 글자만 본다
    let plain = scoreHint;
    for (let prev = ""; prev !== plain;) { prev = plain; plain = plain.replace(/\{[^{}]*\}/g, ""); }
    expect(plain.replace(/<[^>]+>/g, "")).not.toMatch(/[()]/);
  });
  it("점수·수익률로 정렬하지 않는다 — 묶음 안은 화면에 들어올 때 정한 순번(boardRowRank)뿐, 정렬 선택 UI 없음", () => {
    expect(block + boardLib).not.toMatch(/sort\(\(a, b\) => [^)]*(score|\.rate|profit)/);
    expect(block).not.toMatch(/정렬|수익률 순|점수 순/);
    expect(block).toContain("boardRowRank(rows)");
    expect(block.match(/\.sort\(/g)).toHaveLength(1); // 순번 정렬 1곳
  });
  it("정한 날 지표 중 비중·수량(base.weight·qty)은 어느 화면에도 그리지 않는다(5차: base.price는 행 2줄 `정한 뒤 %` 한 곳). 홈·알림·AI 프롬프트는 이름표를 읽지 않는다", () => {
    expect(block + rowsLib.replace(/buildLabelBase[\s\S]*?\n}\n/, "") + boardLib).not.toMatch(/base\.(weight|qty)|priceAt/);
    expect(block).not.toMatch(/base\.price/);
    expect(boardLib.match(/base\?\.price/g)).toHaveLength(1); // 정한 뒤 % 기준 가격 1곳
    const using = filesMatching(/\.(ts|tsx)$/, /stock-labels|grow-rows/).sort();
    expect(using).toEqual([
      "app/(main)/_components/header-menu/settings-page.tsx",
      "app/(main)/_components/preview/demo-snapshot-rebase.tsx", // 데모·체험 이름표 정한 날 가격 재기준(5.125)
      "app/(main)/_components/preview/preview-gate.tsx",
      "app/(main)/_components/views/activity/asset-report-view.tsx", // 6차 세그먼트 둘째 줄(블록과 같은 저장소 값)
      "app/(main)/_components/views/activity/performance-hub.tsx",
      "app/(main)/_components/views/activity/stock-label-block.tsx",
      "hooks/use-stock-labels.ts",
      "lib/asset/asset-storage.ts",
      "lib/asset/grow-board.ts",
      "lib/asset/grow-rows.ts",
      "lib/asset/stock-labels.ts",
      "lib/local-storage.ts",
      "lib/preview/demo-live-rebase.ts", // 데모·체험 이름표 정한 날 가격 재기준(순수 함수, 5.125)
    ]);
  });
  it("'다시 봄' 전송은 불리기 블록 한 곳이고 preview 가드가 앞에 있다(AC-30 데모 0회). 기준 탭 전환은 GA를 보내지 않는다", () => {
    expect(filesMatching(/\.(ts|tsx)$/, /category: "grow_revisit"/)).toEqual(["app/(main)/_components/views/activity/stock-label-block.tsx"]);
    const src = read("stock-label-block.tsx");
    const guard = src.indexOf("if (isPreviewEnv()) return;");
    const send = src.indexOf('track("feature_use", { category: "grow_revisit" })');
    expect(guard).toBeGreaterThan(0);
    expect(send).toBeGreaterThan(guard);
    expect(src.slice(send - 200, send)).toContain("isStockLabelRevisit(labels, Date.now())");
    expect(src.match(/track\(/g)).toHaveLength(1);
    expect(src).not.toMatch(/localStorage|sessionStorage/); // 새 저장 키·플래그 없음
  });
  it("이 화면은 분류를 새로 요청하지 않는다(X-Ray 캐시 읽기만)", () => {
    for (const t of [read("stock-label-block.tsx"), readFileSync(path.resolve(__dirname, "../../asset/grow-board.ts"), "utf8")]) {
      expect(t).not.toMatch(/fetchAndStoreClassifications|useXrayClassifications|fetch\(|xray-classify/);
    }
  });
});

describe("추천 아님 조건 — 이름표 블록(AC-9·AC-10·AC-12)", () => {
  const block = visibleText(read("stock-label-block.tsx"));
  it("주황·경고색이 없고, 손익색은 %·막대·큰 합계 금액에만(pctTone·fillTone 두 곳)", () => {
    expect(block).not.toMatch(/red-|orange-|amber-|destructive|important|text-profit|text-loss/);
    expect(block.match(/getProfitLossColor\(/g)).toHaveLength(1);
    expect(block.match(/rose-|blue-/g)).toHaveLength(4); // fillTone의 bg-rose-500·dark:bg-rose-400·bg-blue-500·dark:bg-blue-400
    expect(block).not.toMatch(/정렬|손실 순|수익률 순/);
  });
  it("성적표 축 영역은 이름표를 가리키지 않고, `지났어요` 문구는 표시 값 한 곳에서만 만든다", () => {
    const grade = readFileSync(path.resolve(__dirname, "../asset-grade.ts"), "utf8");
    expect(grade).not.toMatch(/이름표|오래 둘|점검할|stock-labels/);
    // 주기 경과 문구(`주기 N개월이 지났어요`)를 만드는 곳 — 홈 팁·알림 등 다른 화면에 없어야 한다
    const hits = filesMatching(/\.(ts|tsx)$/, /주기[^"`\n]*지났어요/);
    expect(hits.sort()).toEqual(["lib/asset/grow-board.ts", "lib/asset/grow-rows.ts"]); // 6차: 차례 이유 `점검 주기 N개월이 지났어요`(불리기 화면 표시 값)
  });
  it("Plus 배지는 0곳 — 결제 없는 단계에서 유료로 오해되는 표시 폐지(대표 결정 11/17, AC-2 개정)", () => {
    const hits = filesMatching(/\.tsx$/, />\s*Plus\s*</).map((p) => path.basename(p));
    expect(hits).toEqual([]);
  });
});

// 4·5차(11/18) — 선택의 결과·오래 둘 손실·다시 볼 조건은 사실만 말한다. 평가·후회·권유·행동 재촉 낱말과 '이름표' 단어 0(redesign 4-2·5-2, cto 4차 3-③·5차 1·3)
const R45_FORBIDDEN = [
  "덕분", "손해", "놓친", "아깝", "나았", "본전", "만회", "물타기", "추가 매수", "버티", "떨어진", "익절", "손절", "목표가", "회복", "반등", "물린",
  "손실 종목", "정리하", "기다리", "잘 고르셨", "바꾼 게 나았", "그대로 뒀으면", "팔지 않았다면", "계속 두세요", "점검하세요", "이름표", "주의",
];

describe("재설계 4·5차 금지어 — 불리기 블록·표시 값·허브 셋째 카드·화면 도움말·새 소식·기능 목록", () => {
  const hub = read("performance-hub.tsx");
  const view = read("asset-report-view.tsx");
  const entry = WHATS_NEW.find((e) => e.id === "20261117-01")!;
  const feature = APP_FEATURES.find((f) => f.id === "report")!;
  const texts: [string, string][] = [
    ["블록", visibleText(read("stock-label-block.tsx"))],
    ["판 값", visibleText(readFileSync(path.resolve(__dirname, "../../asset/grow-board.ts"), "utf8"))],
    ["허브 카드", visibleText(hub.slice(hub.indexOf('data-testid="hub-card-report"')))],
    ["도움말", view.slice(view.indexOf('data-testid="grow-hint"'), view.indexOf("</CardTitle>"))],
    ["새 소식", `${entry.title}${entry.body}`],
    ["기능 목록", `${feature.title}${feature.description}`],
  ];
  it.each(R45_FORBIDDEN)("%s 0건", (w) => {
    for (const [name, text] of texts) expect(text, `${name}: ${w}`).not.toContain(w);
  });
  it("손실은 '평단보다 낮음' 사실형으로만, 차례 이유는 `…에 닿았어요`·`…지났어요` 사실형", () => {
    const board = texts[1][1];
    expect(board).toContain("이하에 닿았어요");
    expect(board).toContain("이상에 닿았어요");
    expect(visibleText(read("stock-label-block.tsx"))).toContain("평단보다 낮은 종목 없음");
  });
  it("메모는 점검 한 장 입력 칸에만 — 캡처 숨김 칸 안, 링크 변환 없음, 카드·허브·새 소식에 메모 값 없음", () => {
    const block = read("stock-label-block.tsx");
    const memoAt = block.indexOf('data-testid="grow-plan-memo"');
    expect(block.lastIndexOf("data-screenshot-hide", memoAt)).toBeGreaterThan(block.lastIndexOf("<label", memoAt) - 1);
    // 메모 값은 조건 폼(draftOf ~ PlanEditor)에서만 읽는다 — 요약 줄은 '메모' 표시만, 행·카드·기록에 복사 없음
    const formStart = block.indexOf("const draftOf");
    const formEnd = block.indexOf("function ReviewSheet(");
    expect(formStart).toBeGreaterThan(0);
    expect((block.slice(0, formStart) + block.slice(formEnd)).match(/\.memo\b/g)).toBeNull();
    expect(block.slice(formStart, formEnd)).toContain('plan?.memo ? "메모" : null');
    expect(block).not.toMatch(/href=|<a |linkify|dangerouslySetInnerHTML/);
    expect(hub).not.toMatch(/\.plan\b|memo/);
  });
});

// 6차(11/18 대표 지시 ②·④) — 어색한 낱말을 일상어로(ui.md 용어표). 옛 낱말은 화면 문자열에 0건
const R6_OLD = ["오래 둘", "오래 둠", "점검할", "아직 안 정함", "산 날부터", "산 날보다", "정한 뒤", "점검 뒤", "그대로 둠", "매매 ", "내 자산 불리기", "점수 "];

describe("재설계 6차 — 옛 낱말 0건, 새 용어·정의 문장", () => {
  const view = read("asset-report-view.tsx");
  const hub = read("performance-hub.tsx");
  const entry = WHATS_NEW.find((e) => e.id === "20261117-01")!;
  const feature = APP_FEATURES.find((f) => f.id === "report")!;
  const texts: [string, string][] = [
    ["블록", visibleText(read("stock-label-block.tsx"))],
    ["판 값", visibleText(readFileSync(path.resolve(__dirname, "../../asset/grow-board.ts"), "utf8"))],
    ["허브 카드", visibleText(hub.slice(hub.indexOf('data-testid="hub-card-report"')))],
    ["화면 제목·도움말", view.slice(view.indexOf('data-testid="grow-title"'), view.indexOf("</CardTitle>"))],
    ["세그먼트", visibleText(view.slice(view.indexOf('data-testid="report-tabs"'), view.indexOf('data-testid="report-panel-grade"')))],
    ["세그먼트 둘째 줄", visibleText(view.slice(view.indexOf("const growSub"), view.indexOf("const growSub") + 400))],
    ["새 소식", `${entry.title}${entry.body}`],
    ["기능 목록", `${feature.title}${feature.description}`],
  ];
  it.each(R6_OLD)("'%s' 0건", (w) => {
    for (const [name, text] of texts) expect(text, `${name}: ${w}`).not.toContain(w);
  });
  it("새 용어가 정해진 자리에 있다 — 묶음·버튼·수익률 정의", () => {
    const block = texts[0][1];
    for (const w of ["평단 대비 수익 · 내 주식", "평단 대비 수익률", "정한 날 대비", "점검일 대비", "오늘 정함", "평단보다 낮은 종목 없음", "점검 대상에서 빼면", "최근 3개월 거래", "그때 수익률", "수익률은 평단 대비예요.", "내 주식 전체"]) expect(block, w).toContain(w);
    expect(block.match(/"그대로 두기"/g)!.length).toBeGreaterThanOrEqual(3); // 두 묶음 버튼 + 기록 줄 — 같은 낱말(COO 수정 1)
    expect(block).not.toMatch(/계속 장기 보유|장기 보유하세요/);
    const board = texts[1][1];
    for (const w of ['"장기 보유"', '"점검 대상"', '"정하지 않음"', "점검 대상에서 뺌"]) expect(board, w).toContain(w);
    expect(texts[5][1]).toContain("종목 · 정하기 전"); // 첫 사용자 세그먼트(사업 수정 1)
  });
  it("기준 패널 — `0`·`전체 ±x%` 라벨·점선 기준선이 없고, 0점 눈금은 라벨 없는 1px", () => {
    const block = read("stock-label-block.tsx");
    expect(block).not.toMatch(/grow-ref-label|grow-ref-line|border-dashed|>전체 \{/);
    expect(block).toContain('data-testid="grow-zero-tick"');
  });
});
