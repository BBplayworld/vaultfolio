import type { ReactNode } from "react";
import type { IndexView } from "@/lib/invest/calc";
import { SAME_YEAR_LABEL, fmtPct, type Readout } from "@/lib/invest/text";
import { getProfitLossColor } from "@/config/theme";

/** 가운뎃점으로 이어진 어구가 줄 중간에서 끊기지 않게 묶는다(C25). 지정한 어구만 nowrap */
// 사건 분류 7종 전부(금리·통화 정책·금융위기·시장 급락·전쟁·지정학·기술 거품·팬데믹·에너지)는 줄 중간에서 끊지 않는다(qa D-7)
export const NOWRAP_PHRASES = ["금리·통화 정책", "전쟁·지정학", "시장 급락", "기술 거품", "금융위기", "팬데믹", "에너지", "배당·세금·수수료는", "금리·침체", "(CC BY-SA 4.0)으로", "CC BY-SA 4.0"];
/** 문장 끝 `(1983~2025년).`·`평균 5.0년이에요`·`2년이었어요` 같은 짧은 꼬리는 줄 중간에서 끊지 않는다(C25) */
export const NOWRAP_TAIL = ["[+−-]?\\d+(?:\\.\\d+)?%예요\\.?", "[^\\s]*\\([^)]*\\)\\.?", "\\(\\d{4}~\\d{4}년\\)\\.?", "평균 \\d+(?:\\.\\d)?년이에요", "\\d+년이었어요", "\\d+년이에요"];
export function NoBreak({ text, phrases = NOWRAP_PHRASES, tails = [] }: { text: string; phrases?: string[]; tails?: string[] }): ReactNode {
  const esc = phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${[...esc, ...tails].join("|")})`));
  if (parts.length === 1) return text;
  return parts.map((part, i) => (i % 2 === 1 ? <span key={i} className="whitespace-nowrap">{part}</span> : part));
}

/** 사건 사실 1줄: `5.25%가`·`2~2.25%로`처럼 수치와 조사 사이에서 끊기지 않게 묶는다(qa D-6) */
export const NOWRAP_PCT = ["[0-9][0-9.]*(?:~[0-9][0-9.]*)?%[가-힣]{0,2}"];

/** 사건 표시명 끝 `(YYYY)`는 앞 어절에 붙여 한 덩어리로(읽기 줄·표·펼침 공통, R-2) */
export const NOWRAP_YEAR_SUFFIX = ["[^\\s·]*\\(\\d{4}(?:~\\d{2,4})?\\)"];
export const EventName = ({ name }: { name: string }) => <NoBreak text={name} phrases={[]} tails={NOWRAP_YEAR_SUFFIX} />;

/** 읽기 줄 칩: 구분점 `·`을 뒤 칩 앞에 붙여 한 덩어리로 묶는다 — 좁은 폭에서 줄 끝에 `·`이 매달리지 않는다(D-11) */
export function ReadoutChips({ ro, hideYear = false }: { ro: Readout; hideYear?: boolean }) {
  return (
    <>
      <span className="whitespace-nowrap">{hideYear ? "연말" : `${ro.year}년 말`} <b className="font-bold tabular-nums">{ro.level}</b></span>
      <span className="whitespace-nowrap">· <b className={`font-bold tabular-nums ${ro.ret == null ? "" : getProfitLossColor(ro.ret)}`}>{ro.ret == null ? "—" : fmtPct(ro.ret)}</b></span>
      <span className="whitespace-nowrap text-muted-foreground">· {ro.dir}</span>
      {ro.recession && <span className="whitespace-nowrap text-muted-foreground">· 경기침체</span>}
    </>
  );
}

/** 지수명+값 묶음(줄바꿈 단위). 320 미만은 약칭(`S&P`·`나스닥`), 접근 이름은 정식 이름·값. 색·인과 0 */
function RetItem({ label, ret, first, trail = false }: { label: string; ret: number; first: boolean; trail?: boolean }) {
  return (
    <span className="whitespace-nowrap" aria-label={`${label} ${fmtPct(ret, 1)}`}>
      <span aria-hidden className="text-muted-foreground">{first ? "" : "· "}<span className="max-[360px]:hidden">{label}</span><span className="hidden max-[360px]:inline">{label.replace(/ ?100$| 500$/, "")}</span></span>{" "}
      <span aria-hidden className="text-foreground">{fmtPct(ret, 1)}</span>
      {trail && <span aria-hidden className="text-muted-foreground"> ·</span>}
    </span>
  );
}

/** R2-3: 펼침 안 1줄 `같은 해 나스닥100 −41.9% · 코스피 −40.7%`. 현재 지수 제외·자료 없는 지수 생략, 둘 다 없으면 줄 0. 단위만 표기(환산·인과·`함께` 0). 묶음(지수명+값) 단위로만 줄바꿈 */
export function SameYear({ view, year, className = "mt-1.5" }: { view: IndexView; year: number; className?: string }) {
  const o = view.same[year];
  if (!o?.length) return null;
  return (
    <div data-testid="same-year" className={`${className} flex flex-wrap gap-x-1.5 text-xs tabular-nums break-keep`}>
      <span className="text-muted-foreground">{SAME_YEAR_LABEL}</span>
      {o.map((x, i) => <RetItem key={x.label} label={x.label} ret={x.ret} first={i === 0} />)}
    </div>
  );
}

/** 5.141 A1 칩 1줄: SameYear와 같은 형식으로 세 지수 전부(`{Y}년 S&P 500 +26.7% · 나스닥100 +39.6% · 코스피 +49.5%`) */
export function ThreeYear({ year, items }: { year: number; items: { label: string; ret: number }[] }) {
  return (
    <div data-testid="three-year" className="flex flex-wrap items-baseline gap-x-1.5 text-xs tabular-nums break-keep">
      <b className="mr-0.5 text-sm font-bold">{year}년</b>
      {items.map((x, i) => <RetItem key={x.label} label={x.label} ret={x.ret} first trail={i < items.length - 1} />)}
    </div>
  );
}
