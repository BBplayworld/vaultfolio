// 투자 탭(#263) 숫자·문장 서식. 문장 규칙 R1~R11(spec 6절): 과거형·같은 시기 표현만, 권유·예측·인과 단정 0.
// 화면·공개 가이드(SSR)·테스트가 같은 문장을 쓴다.
import { DROP_THRESHOLD, INDEX_KEYS, episodeDirCounts, type EventPoint, type IndexView, type RateDir } from "./calc";
import type { IndexKey } from "./types";

export const MINUS = "−";
/** 부호 있는 % (0은 부호 없음) */
export const fmtPct = (v: number, digits = 1) => (v > 0 ? "+" : v < 0 ? MINUS : "") + Math.abs(v).toFixed(digits) + "%";
/** 금리 % (소수 둘째 자리, 뒤 0 하나 생략) */
export const fmtRate = (v: number) => (Math.round(v * 100) / 100).toString().replace(/(\.\d)0$/, "$1") + "%";
/** 지수 값(10 이상은 정수, 천 단위 쉼표) */
export const fmtLevel = (v: number) => (v >= 10 ? Math.round(v).toLocaleString("en-US") : v.toFixed(1));
/** 금리차(%p) 음수는 부호만 */
export const fmtSpread = (v: number | null) => (v == null ? "—" : (v < 0 ? MINUS : "") + Math.abs(v).toFixed(2));
/** 1자리 % (물가·실업률 연평균, 값 없으면 —) */
export const fmtPct1Plain = (v: number | null) => (v == null ? "—" : v.toFixed(1) + "%");
export const fmtPctPlain = (v: number | null) => (v == null ? "—" : v.toFixed(2) + "%");

/** 읽기 줄·표용 금리 방향 */
export const DIR_LABEL: Record<RateDir, string> = { down: "내려감", up: "올라감", flat: "거의 그대로", none: "자료 없음" };
export const DIR_VERB: Record<Exclude<RateDir, "none">, string> = { down: "내려갔어요", up: "올라갔어요", flat: "거의 그대로였어요" };

export const RATE_OWNER = { us: "미국", kr: "한국" } as const;
export const RATE_LABEL = { us: "미국 기준금리", kr: "한국 기준금리" } as const;

export interface HeadlineLines {
  /** 1줄: 빠진 횟수(대표 질문의 답) */
  l1: string;
  /** 2줄: 그 사이 금리 방향 건수. 하락이 없으면 null */
  l2: { lead: string; bold: string; rest: string } | null;
  /** 3줄: 기준선(전체 기간) */
  l3: string;
}
export function headlineLines(v: IndexView): HeadlineLines {
  const who = RATE_OWNER[v.rate], pct = Math.round(DROP_THRESHOLD * 100);
  const w = v.start + 1, n = v.eps.length;
  const l1 = n === 0 ? `${w}년 이후 연말 기준 ${pct}% 넘게 빠진 때는 없었어요` : `${w}년 이후 연말 기준 ${pct}% 넘게 빠진 때는 ${n}번이었어요`;
  let l2: HeadlineLines["l2"] = null;
  if (n > 0) {
    const c = episodeDirCounts(v.eps);
    const bits = ([["down", "내려갔"], ["up", "올라갔"], ["flat", "거의 그대로였"]] as const).filter(([k]) => c[k]).map(([k, verb]) => `${c[k]}번 ${verb}`);
    const texts = bits.map((b, i) => b + (i === bits.length - 1 ? "어요" : "고"));
    const none = c.none ? ` (${c.none}번은 금리 자료 없음)` : "";
    l2 = { lead: `그 사이 ${who} 금리는 `, bold: texts[0], rest: (texts.length > 1 ? `, ${texts.slice(1).join(", ")}` : "") + none };
  }
  const B = v.base;
  const l3 = `${who} 금리 자료가 있는 ${B.n}년 중 내려간 해는 ${B.down}년, 올라간 해는 ${B.up}년` + (B.flat ? `, 거의 그대로인 해는 ${B.flat}년이었어요` : "이었고 거의 그대로인 해는 없었어요");
  return { l1, l2, l3 };
}

/** 읽기 줄(해 선택 시): `{Y}년 말 {값} · {±%} · 금리 {방향}`(+ `· 경기침체`) + 사건 2줄째 */
export interface Readout {
  year: number;
  level: string;
  ret: number | null;
  dir: string;
  recession: boolean;
  events: string | null;
}
/** maxEv: 좁은 폭(320)은 1건 + `외 n건`, 그 밖은 2건 + `외 n건`(말줄임 없음, 전체는 행 펼침·연도별 표) */
export function readoutOf(v: IndexView, year: number, maxEv = 2): Readout {
  const row = v.tbl.find((r) => r.y === year)!;
  const evs = row.issues;
  const events = evs.length ? evs.slice(0, maxEv).map((e) => e.name).join(" · ") + (evs.length > maxEv ? ` 외 ${evs.length - maxEv}건` : "") : null;
  return {
    year, level: fmtLevel(row.close), ret: row.ret, dir: row.dir === "none" ? "금리 자료 없음" : `금리 ${DIR_LABEL[row.dir]}`,
    recession: (row.rec ?? 0) > 0, events,
  };
}

/** 같은 시기 사건 표기: `{표시명} {날짜} · {분류}` */
export const eventLine = (e: Pick<EventPoint, "name" | "date" | "cat">) => `${e.name} ${e.date} · ${e.cat}`;

export function listNote(v: IndexView): string {
  const ex = v.ret[2020 - v.start];
  return `한 해 안에서 빠졌다가 같은 해에 되돌린 하락은 이 목록에 없어요. 예를 들어 2020년 ${v.label}는 연간 ${fmtPct(ex ?? 0)}로 끝나, 그해 3월의 급락은 안 보여요.`;
}
/** 목록 보조문을 한 문장으로 쓸 때(가이드 정의 줄·TERMS): 마침표는 여기서 한 번만 붙인다 */
export const LIST_SUB_SENTENCE = `연말 기준 고점 대비 ${Math.round(DROP_THRESHOLD * 100)}% 넘게 빠진 때예요. 연말만 재서 장중 저점보다 얕게 나와요.`;
/** G3 정의 줄(−15% 이하 해). 뒤에 LIST_NOTE_2를 잇는다 */
export const KOSPI_DEF = "−15% 이하 해는 그해 연말 값이 전해 연말보다 15% 이상 내린 해예요.";
export const LIST_NOTE_2 = "같은 시기에 있었다는 기록이고, 무엇이 원인인지는 말하지 않아요.";
export const LIST_SUB = `연말 기준 고점 대비 ${Math.round(DROP_THRESHOLD * 100)}% 넘게 빠진 때예요. 연말만 재서 장중 저점보다 얕게 나와요`;

/** 결과 숫자 바로 아래 상시 노출(5.138 N-3, CEO 승인): 과거 계산이고 앞날을 말하지 않는다 */
export const CALC_PAST = "과거 연말 값으로 계산한 결과예요. 앞으로도 같다는 뜻은 아니에요.";
export const CALC_FOOT = "배당·세금·수수료는 빼고, 반올림하지 않은 값으로 계산해 마지막에 한 번만 반올림해요.";
export const CALC_DIV = "배당을 다시 넣었다면 결과는 이보다 커요.";
export const EMPTY_LIST = "없었어요";
export const LOAD_ERROR = "잠시 뒤 다시 열어 주세요";
export const READOUT_HINT = "해를 누르거나 끌면 그해 말 값이 나와요";

/** 7절 출처·고지 4줄(지수별). 갱신일 `{재대조일}`은 한은 재대조 후 상수만 바꾼다 */
export const KR_RECHECK_DATE = "2026.11.22";
export function sourceLines(v: IndexView, revIds: Record<"spx" | "ndx" | "kospi", string>): [string, string, string, string] {
  const wiki = {
    spx: `위키백과 「S&P 500」(영문, 리비전 ${revIds.spx}, CC BY-SA 4.0)`,
    ndx: `위키백과 「Nasdaq-100」(영문, 리비전 ${revIds.ndx}, CC BY-SA 4.0)`,
    kospi: `위키백과 「코스피」(한국어, 리비전 ${revIds.kospi}, CC BY-SA 4.0)`,
  };
  const l1 = v.key === "spx"
    ? `지수 연말값: S&P 500 연말 지수 값은 Aswath Damodaran(NYU Stern) 공개 자료 「Historical Returns on Stocks, Bonds and Bills」(2026년 1월 갱신)를 썼고, 연간 등락률은 ${wiki.spx}과 대조해 시크릿에셋이 다시 계산했어요.`
    : v.key === "ndx"
      ? `지수 연말값: ${wiki.ndx}을 바탕으로 시크릿에셋이 다시 계산·가공했어요. 2003·2004년 연말값은 다른 공개 자료와 최대 0.6% 차이가 있어요 (위키 값 사용).`
      : `지수 연말값: ${wiki.kospi}를 바탕으로 시크릿에셋이 다시 계산·가공했어요. 1998년 등락률은 표의 %가 아니라 종가로 다시 계산했어요.`;
  const l2 = v.rate === "us"
    ? "금리·침체: 미 기준금리는 미 연준 공개시장 표 · 미 국채 금리: 미 연준(H.15) · 경기침체 기간: NBER(미국 경제연구소) 경기순환 기준일을 가공했어요. " + BLS_SOURCE
    : `금리 출처: ECOS(한국은행, 기준금리·시장금리), ${KR_RECHECK_DATE}. 한국은행이 작성한 통계를 가공했어요. 사건 1건(1997년)은 IMF 보도자료를 확인했어요.`;
  const l3 = `가격 지수(배당 제외) · ${v.currency === "달러" ? "미국 지수는 달러 기준 · " : ""}연말 종가 기준 · 기준일 ${v.last}.12.31 · 가공 데이터는 같은 조건(CC BY-SA 4.0)으로 공개해요`;
  const owner = v.key === "kospi" ? "KOSPI는 한국거래소" : v.key === "spx" ? "S&P 500은 S&P Dow Jones Indices" : "Nasdaq-100은 Nasdaq, Inc.";
  const l4 = `${owner}의 상표이며, 시크릿에셋은 이 기관과 제휴 관계가 아니에요. 과거 시장 사실이며 투자 권유가 아니에요.`;
  return [l1, l2, l3, l4];
}

/** C1(5.141): 용어 사전 단일 출처. 지수 ⓘ·목록 보조문·기간 카드·연도별 표 풀이·출처 패널이 모두 이 문장을 참조한다(새 문장 0).
 *  이음 규칙(마침표)은 여기 한 곳에서만 정한다: 앞 문장은 마침표 없이 쓴 원문(LIST_SUB)만 `. `로 잇는다. */
export const TERM_PRICE_INDEX = "지수에 든 종목의 가격만으로 낸 값이에요. 배당은 들어 있지 않아요.";
export const TERM_YEAR_END = "해마다 마지막 날(연말) 종가 기준이에요. 한 해 안의 움직임은 담지 않아요.";
const TERM_DIV_HEAD = "받은 배당을 다시 넣지 않고 계산했어요.";
const TERM_DROP_TAIL = "한 해 연간 등락이 −15% 이하인 해와는 다른 기준이에요.";
export type TermId = "priceIndex" | "exDividend" | "yearEnd" | "bigDrop" | "nber" | "spread" | "lumpDca" | "y10" | "fedRate" | "fedBs" | "rateDir" | "spreadNeg";
export const TERMS: Record<TermId, { term: string; def: string }> = {
  priceIndex: { term: "가격 지수", def: TERM_PRICE_INDEX },
  exDividend: { term: "배당 제외", def: `${TERM_DIV_HEAD} ${CALC_DIV}` },
  yearEnd: { term: "연말 기준", def: TERM_YEAR_END },
  bigDrop: { term: "크게 빠진 때(−15%)", def: `${LIST_SUB_SENTENCE} ${TERM_DROP_TAIL}` },
  nber: { term: "경기침체(NBER)", def: "미국 경제연구소(NBER)가 정한 경기침체 기간이에요." },
  spread: { term: "장단기 금리차", def: "10년 만기 국채 금리에서 2년(3개월) 만기 금리를 뺀 값이에요. 마이너스면 짧은 쪽 금리가 더 높았다는 뜻이에요." },
  lumpDca: { term: "한 번에 넣기·매달 나눠 넣기", def: "한 번에 넣기는 시작 해 말에 총액을 한 번에 넣은 경우, 매달 나눠 넣기는 같은 총액을 매달 같은 금액으로 나눠 넣은 경우예요." },
  y10: { term: "10년물", def: "10년 만기 미국 국채의 금리예요." },
  fedRate: { term: "연준 금리", def: "미국 중앙은행(연준)의 기준금리예요." },
  fedBs: { term: "연준 대차대조표 사건", def: "연준이 채권을 사들이거나 줄인 결정이에요." },
  // 5.142(#275): 지표별 오른 해 표(A2)와 `하락 전 12개월` 각주가 같은 문장을 쓴다(새 문장 0, 용어 패널 7개에는 넣지 않는다)
  rateDir: { term: "금리 방향", def: "전년 12월 말과 그해 12월 말 기준금리를 비교해 0.25%p 이상 오르면 올라간 해, 0.25%p 이상 내리면 내려간 해, 그 사이면 거의 그대로인 해로 셌어요." },
  spreadNeg: { term: "금리차 마이너스 달", def: "금리차는 월평균이 0보다 낮은 달이 1개 이상이면 셌어요(연준 H.15)." },
};
/** 출처 패널 `용어` 7개(순서 고정) */
export const PANEL_TERM_IDS: TermId[] = ["priceIndex", "exDividend", "yearEnd", "bigDrop", "nber", "spread", "lumpDca"];
/** 지수 ⓘ: TERMS 두 문장을 이은 것(새 문장 0) */
export const INDEX_INFO = `${TERMS.priceIndex.def} ${TERMS.yearEnd.def}`;

/** R4.2 용어 풀이 5줄(연도별 표 펼침 아래 `invest-gloss`) — 풀이는 TERMS 참조 */
export const GLOSS: { term: string; text: string }[] = [
  { term: "장단기 금리차(10년−2년·10년−3개월)", text: TERMS.spread.def },
  { term: TERMS.y10.term, text: TERMS.y10.def },
  { term: TERMS.nber.term, text: TERMS.nber.def },
  { term: TERMS.fedRate.term, text: TERMS.fedRate.def },
  { term: TERMS.fedBs.term, text: TERMS.fedBs.def },
];
/** A4(5.141): `크게 빠진 때` 카드 머리 1줄. 회복된 하락만 비교(진행 중은 제외하고 꼬리로 건수), 전부 진행 중이면 깊이만.
 *  가장 깊었던 때 = dd 최소, 가장 길었던 때 = 고점에서 전고점까지(ry−py) 최대(같으면 이른 하락) — 펼침 `고점에서 전고점까지`와 같은 값 */
export interface RecoverySummary {
  deep: { name: string; dd: number };
  long: { name: string; n: number } | null;
  /** 가장 깊은 하락이 가장 긴 하락과 같음 */
  merged: boolean;
  /** 진행 중이라 비교에서 뺀 하락 수 */
  skipped: number;
}
export function recoverySummary(v: IndexView): RecoverySummary | null {
  if (!v.eps.length) return null;
  const done = v.eps.filter((e) => !e.ongoing), pool = done.length ? done : v.eps;
  const deep = pool.reduce((b, e) => (e.dd < b.dd ? e : b), pool[0]);
  const longest = done.length ? done.reduce((b, e) => ((e.ry as number) - e.py > (b.ry as number) - b.py ? e : b), done[0]) : null;
  const skipped = done.length ? v.eps.length - done.length : 0;
  return { deep: { name: deep.name, dd: deep.dd }, long: longest ? { name: longest.name, n: (longest.ry as number) - longest.py } : null, merged: longest === deep, skipped };
}
export const RECOVERY_TAIL = (n: number) => `진행 중 ${n}번 제외`;

export const QUESTION_HEAD = {
  drops: "크게 빠지고 오른 때, 금리는 어땠나요?",
  grid: "해마다 얼마나 움직였나요?",
  period: "같은 돈을 한 번에, 또는 매달 넣었다면 얼마가 됐을까요?",
} as const;

/** R2: 미국 물가·실업률 출처·정의(화면 반영 전 문구 정본). 'BLS 공식' 표기·FRED 로고·제휴 표현 금지 */
export const BLS_SOURCE = "물가·실업률: 미 노동통계국(BLS) · FRED(세인트루이스 연은) 경유(CPIAUCNS·UNRATENSA) 자료를 가공했어요(공공 영역).";
export const BLS_INFO = "연평균은 월 12개 평균이에요. 물가는 CPI-U(전 품목) 연평균의 전년 대비 %, 실업률은 연평균 %예요.";

/** R2-3: 펼침 안 `같은 해` 줄 값(현재 지수 제외 나머지). 단위 표기만, 환산·인과 0 */
export const SAME_YEAR_LABEL = "같은 해";
/** R2-1: 2025 물가·실업률 빈 칸 각주 */
export const BLS_GAP_NOTE = "2025년은 미 정부 업무 중단으로 10월 값이 발표되지 않아 비워 뒀어요.";

// ---- 5.141 R3-1 `세 지수` 보기 정본 문장(spec 4절). 화면·테스트가 같은 문장을 쓴다. 해 수 비율 %·상관·예측·권유·평가 어휘 0 ----
const hasBatchim = (ch: string) => (/[가-힣]/.test(ch) ? (ch.charCodeAt(0) - 0xac00) % 28 !== 0 : "0136780".includes(ch));
/** 주제 조사 `은/는`(S&P 500은·나스닥100은·코스피는) */
export const topic = (label: string) => label + (hasBatchim(label.slice(-1)) ? "은" : "는");
/** 오른 해 정의 문장(A1 ⓘ·A2 정의 줄이 같은 문장을 쓴다) */
export const A1_INFO_FIRST = "오른 해는 연간 등락이 0보다 큰 해이고, 그 밖은 내린 해로 셌어요.";
export const THREE_LABEL = "세 지수";
export const THREE_TEXT = {
  qA1: "같은 해에 세 지수는 같은 쪽으로 움직였나요?",
  titleA1: "같은 해 세 지수 오르내림",
  summary: (from: number, to: number, n: number) => `${from}~${to}년, 세 지수 모두 연말 값이 있는 ${n}해를 나눠 셌어요`,
  rowValue: (k: number) => `${k}해`,
  slotHint: "해를 누르면 그해 세 지수 값이 보여요",
  infoLabel: "오른 해·내린 해를 센 기준",
  info: `${A1_INFO_FIRST} 미국 지수는 달러, 코스피는 원 기준이고 서로 환산하지 않았어요.`,
  zeroNote: (y: number, label: string) => `${y}년 ${topic(label)} 0.0%로 보이지만 반올림 전 값이 0보다 작아 내린 해로 셌어요.`,
  empty: "해당 지수 자료 없음",
  qA5: "10년씩 묶으면 어땠나요?",
  titleA5: "연대별 요약",
  a5Head: ["연대", "S&P 500", "나스닥100", "코스피"],
  a5Def: "해마다 평균과 누적은 연대 첫 해의 전년 말부터 마지막 해 말까지 계산했어요. −15% 이하 해는 한 해 연간 등락이 −15% 이하였던 해의 수예요.",
} as const;

/** 세 지수 출처: 지수별 연말값 줄 3개 + 공통 1줄 + 상표 1줄(spec 4절) */
export function threeSourceLines(vs: Record<IndexKey, IndexView>, revIds: Record<IndexKey, string>): string[] {
  const to = Math.min(...INDEX_KEYS.map((k) => vs[k].last));
  return [
    ...INDEX_KEYS.map((k) => sourceLines(vs[k], revIds)[0]),
    `가격 지수(배당 제외) · 미국 지수는 달러, 코스피는 원 기준 · 연말 종가 기준 · 기준일 ${to}.12.31 · 가공 데이터는 같은 조건(CC BY-SA 4.0)으로 공개해요`,
    "KOSPI는 한국거래소, S&P 500은 S&P Dow Jones Indices, Nasdaq-100은 Nasdaq, Inc.의 상표이며, 시크릿에셋은 이 기관들과 제휴 관계가 아니에요. 과거 시장 사실이며 투자 권유가 아니에요.",
  ];
}

/** T1: 기간 카드 아래 링크 문구. 가이드 RATIO_CTA(`/guide/guide-copy.ts`)와 같은 문구 — 두 곳이 어긋나면 테스트가 막는다 */
export const RATIO_LINK_LABEL = "캡처로 내 비중 보기";

// ---- 5.142 R3-2 정본 문장(spec 4절). 화면·테스트가 같은 문장을 쓴다. 해 수 비율 %·상관·예측·권유·평가 어휘 0 ----
const ymKo = (ym: string) => `${+ym.slice(0, 4)}년 ${+ym.slice(5)}월`;
export const A2_TEXT = {
  q: "금리·물가가 이랬던 해에 세 지수는 어땠나요?",
  title: "지표로 나눠 본 오른 해",
  summary: "미국 지표 기준으로 해를 나눠, 지수가 오른 해를 셌어요.",
  basisLabel: "기준 선택",
  head: ["기준", "S&P 500", "나스닥100", "코스피"],
  sub: "오른 해",
  cell: (n: number, k: number) => `${n}해 중 ${k}해`,
  empty: "—",
  range: (labels: string[], rs: ({ from: number; to: number } | null)[]) => labels.map((l, i) => (rs[i] ? `${l} ${rs[i]!.from}~${rs[i]!.to}년` : `${l} —`)).join(" · "),
  defLabel: "이 기준을 센 방법",
  /** 정의 줄: 공통 오른 해 정의 → 기준별 문장 → 같은 시기 고지. 자료 시작 달은 데이터에서 읽는다 */
  def: (basis: "rate" | "cpi" | "unemp" | "spread", d: { rateFrom: string; spreadFrom: string }) => {
    const part = basis === "rate"
      ? `${TERMS.rateDir.def} 미 연준 목표금리(범위면 위쪽 값) 자료가 ${ymKo(d.rateFrom)}부터라 ${+d.rateFrom.slice(0, 4) + 1}년부터 셌어요.`
      : basis === "cpi" ? `${BLS_INFO} 물가 4% 이상 오른 해는 물가 연평균이 전년보다 4.0% 이상 오른 해예요. ${BLS_GAP_NOTE}`
        : basis === "unemp" ? `${BLS_INFO} 실업률 오른 해는 연평균 실업률이 전년보다 높았던 해예요. ${BLS_GAP_NOTE}`
          : `${TERMS.spread.def} ${TERMS.spreadNeg.def} 10년−2년 금리차이고 ${ymKo(d.spreadFrom)}부터 있어요.`;
    return `${A1_INFO_FIRST} ${part} ${LIST_NOTE_2}`;
  },
  linkPattern: "지수 하나로 본 하락 전 12개월",
  linkThree: "세 지수를 같은 기준으로 본 표",
} as const;
export const A3_TEXT = {
  q: "미국 경기침체 앞뒤로 지수는 어땠나요?",
  title: "경기침체 앞뒤 연말 등락",
  pick: "S&P 500·나스닥100 중 하나를 골라 봐요",
  pickLabel: "경기침체 앞뒤 지수 선택",
  head: ["침체 기간", "전해", "시작 해", "끝난 다음 해"],
  def: `경기침체 기간은 미국 경제연구소(NBER)가 정한 경기 고점 다음 달부터 저점 달까지예요. 전해는 시작 해의 전해, 끝난 다음 해는 저점 달이 든 해의 다음 해예요. ${TERM_YEAR_END} ${LIST_NOTE_2} 코스피는 미국 경기침체 기준이라 넣지 않았어요.`,
} as const;
