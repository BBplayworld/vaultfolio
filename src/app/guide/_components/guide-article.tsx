import Link from "next/link";
import type { ReactNode } from "react";

import type { GuideDoc } from "../guide-copy";
import { GuideActions } from "../guide-actions";

// '·'·'/'로 이어진 어구(국내/해외, 증권사·은행·거래소 등)는 줄바꿈 기회가 되므로 통째로 nowrap으로 묶는다(C25)
const JOINED_PHRASE = /[가-힣·/]+/g;
function withNowrap(text: string, phrases: string[] = []): ReactNode {
  if (phrases.length) {
    // 지정 어구(숫자+단위·'>'·따옴표+조사)는 통째로 nowrap — 나머지는 기본 규칙
    const esc = phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const parts = text.split(new RegExp(`(${esc.join("|")})`));
    if (parts.length > 1) {
      return parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="whitespace-nowrap">
            {part}
          </span>
        ) : (
          <span key={i}>{withNowrap(part)}</span>
        ),
      );
    }
  }
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(JOINED_PHRASE)) {
    if (!/[·/]/.test(m[0])) continue;
    out.push(text.slice(last, m.index));
    out.push(
      <span key={m.index} className="whitespace-nowrap">
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last === 0) return text;
  out.push(text.slice(last));
  return out;
}

const BODY = "text-sm leading-7 text-foreground/90 text-pretty break-keep";
const H2 = "text-base font-semibold leading-snug text-balance break-keep";
const INLINE_LINK = "block min-h-10 py-2 text-sm font-medium text-foreground underline underline-offset-4 dark:text-primary break-keep";

/** 가이드 본문(h1·단계·fact box·행동 블록) — 서버 컴포넌트, 행동 버튼만 클라이언트 */
export function GuideArticle({ doc }: { doc: GuideDoc }) {
  return (
    <>
      <div>
        <h1 data-testid="guide-title" className="text-xl md:text-2xl font-bold leading-snug text-balance break-keep">
          {doc.h1}
        </h1>
        <p
          data-testid="guide-summary"
          className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty break-keep"
        >
          {withNowrap(doc.summary, doc.nowrapPhrases)}
        </p>
      </div>
      <ol data-testid="guide-steps" className="flex flex-col gap-5">
        {doc.steps.map((step, i) => (
          <li
            key={step.title}
            data-testid={`guide-step-${i + 1}`}
            className={i === 0 ? "" : "border-t border-border pt-5 dark:border-border/40"}
          >
            <span aria-hidden className="text-2xs font-semibold tabular-nums text-primary">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h2 className={`${H2} mt-1`}>{withNowrap(step.title, doc.nowrapPhrases)}</h2>
            <p className={`${BODY} mt-1.5`}>{withNowrap(step.body, doc.nowrapPhrases)}</p>
            {step.inlineLink && (
              <Link data-testid="guide-inline-link" href={step.inlineLink.href} className={INLINE_LINK}>
                {step.inlineLink.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
      <section data-testid="guide-fact-box" className="rounded-xl bg-card p-4 dark:border dark:shadow-sm">
        <h2 className={H2}>{doc.factTitle}</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {doc.facts.map((fact) => (
            <li key={fact} className="text-sm leading-relaxed text-muted-foreground text-pretty break-keep">
              {withNowrap(fact, doc.nowrapPhrases)}
            </li>
          ))}
        </ul>
      </section>
      <GuideActions primary={doc.primary} secondary={doc.secondary} />
    </>
  );
}
