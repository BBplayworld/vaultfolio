"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { track, trackScreen, trackThenNavigate } from "@/lib/analytics/ga";
import { TRIAL_ENTRY_URL } from "@/lib/trial/trial-mode";

import type { GuideCta, GuideSlug } from "./guide-copy";

/** 가이드 진입 page_view 1회 (화면 키 guide:<slug>) */
export function GuideScreenTracker({ slug }: { slug: GuideSlug }) {
  useEffect(() => {
    trackScreen(`guide:${slug}`);
  }, [slug]);
  return null;
}

const CTA_BASE = "h-11 w-full text-sm font-semibold break-keep";

function GuideCtaButton({ cta, variant, testId }: { cta: GuideCta; variant: "brand" | "secondary"; testId: string }) {
  const moving = useRef(false);
  if (cta.kind === "link") {
    return (
      <Button asChild variant={variant} className={CTA_BASE} data-testid={testId}>
        {/* 앱 홈(`/`)으로 가는 link CTA만 이동 의도를 센다(page_title `가이드·내 자산 이동`, 파라미터 0). 이동은 막지 않는다 */}
        <Link href={cta.href} onClick={cta.href === "/" ? () => track("feature_use", { category: "guide_move" }) : undefined}>{cta.label}</Link>
      </Button>
    );
  }
  // JS 없는 환경에서도 a href로 이동 가능. JS가 있으면 GA 전송 후 이동(웰컴 체험 칩과 같은 호출, 연타 1회 가드)
  return (
    <Button asChild variant={variant} className={CTA_BASE} data-testid={testId}>
      <a
        href={cta.href}
        onClick={(e) => {
          e.preventDefault();
          if (moving.current) return;
          moving.current = true;
          trackThenNavigate("feature_use", { category: "demo" }, TRIAL_ENTRY_URL);
        }}
      >
        {cta.label}
      </a>
    </Button>
  );
}

export function GuideActions({ primary, secondary }: { primary: GuideCta; secondary: GuideCta }) {
  return (
    <div className="flex flex-col gap-2">
      <GuideCtaButton cta={primary} variant="brand" testId="guide-cta-primary" />
      <GuideCtaButton cta={secondary} variant="secondary" testId="guide-cta-secondary" />
    </div>
  );
}
