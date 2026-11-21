"use client";

import { useRef } from "react";

import { GUIDES, type GuideSlug } from "@/app/guide/guide-copy";
import { trackThenNavigate } from "@/lib/analytics/ga";

// 루트 가이드 링크 줄(#261) — 사전 조각·웰컴 분기 공용. SSR에 <a href>가 나와야 수집기·JS 없음도 이동 가능(prefetch 없는 일반 a).
// 누르면 feature_use guide_open 1건 후 href로 이동(연타 1회 가드). 금액·경로·slug는 보내지 않는다.
const ORDER: GuideSlug[] = ["year-end", "net-worth", "stock-ratio"];

/** 보조키·휠·가운데 클릭·이미 처리된 클릭은 브라우저 기본 동작(새 탭 등)에 맡긴다 — GA도 보내지 않는다 */
export function shouldInterceptClick(e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean }): boolean {
  return !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

export function RootGuideLinks() {
  const moving = useRef(false);
  return (
    <nav aria-label="가이드" data-testid="root-guide-links" className="flex flex-col items-center">
      <span aria-hidden className="mb-0.5 text-xs font-semibold leading-none text-muted-foreground">
        가이드
      </span>
      <div className="flex flex-wrap justify-center">
        {ORDER.map((slug) => {
          const href = `/guide/${slug}`;
          return (
            <a
              key={slug}
              href={href}
              data-testid={`root-guide-link-${slug}`}
              onClick={(e) => {
                if (!shouldInterceptClick(e)) return;
                e.preventDefault();
                if (moving.current) return;
                moving.current = true;
                trackThenNavigate("feature_use", { category: "guide_open" }, href);
              }}
              className="inline-flex min-h-10 items-center whitespace-nowrap rounded-md px-2 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="underline decoration-muted-foreground/40 underline-offset-4">{GUIDES[slug].linkLabel}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
