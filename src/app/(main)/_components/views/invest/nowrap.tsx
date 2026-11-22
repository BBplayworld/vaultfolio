import type { ReactNode } from "react";

/** 가운뎃점으로 이어진 어구가 줄 중간에서 끊기지 않게 묶는다(C25). 지정한 어구만 nowrap */
export const NOWRAP_PHRASES = ["금리·통화 정책", "배당·세금·수수료는", "금리·침체", "기술 거품"];
/** 문장 끝 `(1983~2025년).`·`평균 5.0년이에요`·`2년이었어요` 같은 짧은 꼬리는 줄 중간에서 끊지 않는다(C25) */
export const NOWRAP_TAIL = ["\\(\\d{4}~\\d{4}년\\)\\.?", "평균 \\d+(?:\\.\\d)?년이에요", "\\d+년이었어요", "\\d+년이에요"];
export function NoBreak({ text, phrases = NOWRAP_PHRASES, tails = [] }: { text: string; phrases?: string[]; tails?: string[] }): ReactNode {
  const esc = phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${[...esc, ...tails].join("|")})`));
  if (parts.length === 1) return text;
  return parts.map((part, i) => (i % 2 === 1 ? <span key={i} className="whitespace-nowrap">{part}</span> : part));
}
