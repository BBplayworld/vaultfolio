import type { ReactNode } from "react";

/** 가운뎃점으로 이어진 어구가 줄 중간에서 끊기지 않게 묶는다(C25). 지정한 어구만 nowrap */
export const NOWRAP_PHRASES = ["금리·통화 정책", "배당·세금·수수료는", "금리·침체", "기술 거품"];
export function NoBreak({ text, phrases = NOWRAP_PHRASES }: { text: string; phrases?: string[] }): ReactNode {
  const esc = phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${esc.join("|")})`));
  if (parts.length === 1) return text;
  return parts.map((part, i) => (i % 2 === 1 ? <span key={i} className="whitespace-nowrap">{part}</span> : part));
}
