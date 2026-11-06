import Link from "next/link";
import type { ReactNode } from "react";

import type { GuideDoc } from "../guide-copy";
import { GuideActions } from "../guide-actions";

// 슬래시 어구는 줄바꿈 기회가 되므로 nowrap으로 묶는다(C25)
const NOWRAP_PHRASE = "국내/해외";
function withNowrap(text: string): ReactNode {
  const parts = text.split(NOWRAP_PHRASE);
  if (parts.length === 1) return text;
  return parts.flatMap((part, i) =>
    i === 0
      ? [part]
      : [
          <span key={i} className="whitespace-nowrap">
            {NOWRAP_PHRASE}
          </span>,
          part,
        ],
  );
}

const BODY = "text-sm sm:text-[15px] leading-7 text-foreground/90 text-pretty break-keep";
const H2 = "text-base font-semibold leading-snug text-balance break-keep";
const INLINE_LINK = "block min-h-10 py-2 text-sm font-medium text-primary underline underline-offset-4 break-keep";

/** 가이드 본문(h1·단계·fact box·행동 블록) — 서버 컴포넌트, 행동 버튼만 클라이언트 */
export function GuideArticle({ doc }: { doc: GuideDoc }) {
  return (
    <>
      <div>
        <h1 data-testid="guide-title" className="text-xl font-bold leading-snug text-balance break-keep sm:text-2xl">
          {doc.h1}
        </h1>
        <p
          data-testid="guide-summary"
          className="mt-2 text-sm sm:text-[15px] leading-relaxed text-muted-foreground text-pretty break-keep"
        >
          {withNowrap(doc.summary)}
        </p>
      </div>
      <ol data-testid="guide-steps" className="flex flex-col gap-5">
        {doc.steps.map((step, i) => (
          <li
            key={step.title}
            data-testid={`guide-step-${i + 1}`}
            className={i === 0 ? "" : "border-t border-border pt-5 dark:border-border/40"}
          >
            <span aria-hidden className="text-[11px] font-semibold tabular-nums text-primary">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h2 className={`${H2} mt-1`}>{withNowrap(step.title)}</h2>
            <p className={`${BODY} mt-1.5`}>{withNowrap(step.body)}</p>
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
              {withNowrap(fact)}
            </li>
          ))}
        </ul>
      </section>
      <GuideActions primary={doc.primary} secondary={doc.secondary} />
    </>
  );
}
