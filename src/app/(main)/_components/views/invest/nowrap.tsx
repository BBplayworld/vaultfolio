import type { ReactNode } from "react";

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
