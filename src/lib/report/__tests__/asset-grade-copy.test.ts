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
    expect(card).toContain("내 기준으로 지키고, 내가 점검해요");
    expect(card).not.toMatch(/formatPriceByMode|getProfitLossColor|toFixed|모든 자산|투입 대비|원\b/); // 금액·손익색 없음(AC-1). %는 '오래 둘' 무게 1개뿐(AC-23)
    expect(card).toContain("오래 둘 자산이 내 주식의 ");
    expect(card.match(/pctText/g)).toHaveLength(2); // data-pct와 표시값 — 무게 줄 첫 묶음과 같은 문자열 값
    expect(card).toContain("primaryClassName={ASSET_THEME.text.default}");
  });
  it("새 소식 1줄·기능 목록 이름", () => {
    const entry = WHATS_NEW.find((e) => e.id === "20261117-01")!;
    expect(entry.title).toBe("성과에 '내 자산 불리기'가 생겼어요");
    expect(entry.featureId).toBe("report");
    const feature = APP_FEATURES.find((f) => f.id === "report")!;
    expect(feature.title).toBe("내 자산 불리기");
    expect(feature.description).toBe("성과 탭에서 보유 주식에 이름표를 붙이고 자산 성적표를 확인하세요.");
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
    expect(body).toBe("산 날부터 손익과 보유 기간 대비 점수를 기준별로 보고, 이름표로 점검해요");
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
    expect(scoreHint.match(/<p className="text-pretty break-keep">/g)).toHaveLength(2);
  });
  it("점수·수익률로 정렬하지 않는다 — 표는 오래 가진 순 고정, 정렬 선택 UI 없음", () => {
    expect(block).not.toMatch(/sort\(\(a, b\) => [^)]*(score|rate)/);
    expect(block).not.toMatch(/정렬|수익률 순|점수 순/);
    expect(block).toContain("오래 가진 순");
  });
  it("정한 날 지표(base.price·weight·qty)는 어느 화면에도 그리지 않는다. 홈·알림·AI 프롬프트는 이름표를 읽지 않는다", () => {
    expect(block + rowsLib.replace(/buildLabelBase[\s\S]*?\n}\n/, "") + boardLib).not.toMatch(/base\.(price|weight|qty)|priceAt/);
    const using = filesMatching(/\.(ts|tsx)$/, /stock-labels|grow-rows/).sort();
    expect(using).toEqual([
      "app/(main)/_components/header-menu/settings-page.tsx",
      "app/(main)/_components/preview/demo-snapshot-rebase.tsx", // 데모·체험 이름표 정한 날 가격 재기준(5.125)
      "app/(main)/_components/preview/preview-gate.tsx",
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
    expect(hits).toEqual(["lib/asset/grow-rows.ts"]);
  });
  it("Plus 배지는 0곳 — 결제 없는 단계에서 유료로 오해되는 표시 폐지(대표 결정 11/17, AC-2 개정)", () => {
    const hits = filesMatching(/\.tsx$/, />\s*Plus\s*</).map((p) => path.basename(p));
    expect(hits).toEqual([]);
  });
});
