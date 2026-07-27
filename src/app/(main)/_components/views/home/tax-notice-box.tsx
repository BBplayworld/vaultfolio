"use client";

// 세금 안내 배너 (S-4.23) — 내 자산 때문에 해야 하는 신고·납부만 홈에 띄운다.
// 전 국민 공통 항목(연말정산·건강보험료)은 여기 뜨지 않고 세금 캘린더에서만 본다.
// 닫으면 그 달 동안 미노출, 달이 바뀌면 자동 재노출(markTaxNoticeDismissed).

import { useEffect, useState } from "react";
import { Receipt, ChevronRight, X } from "lucide-react";
import { useAssetData } from "@/contexts/asset-data-context";
import { useAssetNavigation } from "../../layout/navigation/navigation-context";
import { ASSET_THEME } from "@/config/theme";
import { getAssetDrivenHighlights, isTaxNoticeDismissed, markTaxNoticeDismissed, type TaxEventMatch } from "@/lib/tax-utils";

export function TaxNoticeBox() {
  const { assetData } = useAssetData();
  const { navigate } = useAssetNavigation();
  const [matches, setMatches] = useState<TaxEventMatch[]>([]);

  useEffect(() => {
    // localStorage 접근이 있어 마운트 후 판정 (SSR/hydration 불일치 방지)
    if (isTaxNoticeDismissed()) {
      setMatches([]);
      return;
    }
    setMatches(getAssetDrivenHighlights(assetData));
  }, [assetData]);

  if (matches.length === 0) return null;

  const dismiss = () => {
    markTaxNoticeDismissed();
    setMatches([]);
  };

  return (
    <div className="rounded-xl bg-card dark:border-0 shadow-xs p-4 space-y-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <div className="flex items-start gap-2">
        <Receipt className={`size-4 mt-0.5 shrink-0 ${ASSET_THEME.important}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm sm:text-[15px] font-semibold text-foreground text-pretty">
            내 자산 세금 일정
          </p>
          <p className="text-sm text-muted-foreground mt-0.5 text-pretty">
            보유한 자산 때문에 이번 달·다음 달에 챙겨야 할 신고·납부예요.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="닫기"
          className="shrink-0 -m-2 p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      <ul className="space-y-2">
        {matches.map(({ event, reasons }) => (
          <li key={event.id} className="rounded-lg bg-muted/40 px-3 py-2.5">
            <div className="flex items-baseline gap-2">
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                  event.severity === "high"
                    ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {event.dueLabel}
              </span>
              <p className="text-sm font-semibold text-foreground text-pretty">{event.title}</p>
            </div>
            <p className="text-sm text-muted-foreground mt-1 text-pretty">{event.summary}</p>
            {/* 왜 나에게 뜨는지 — 보유 자산과의 매칭 근거 */}
            <p className="text-xs text-muted-foreground/80 mt-1.5">
              {reasons.join(" · ")} → 대상
            </p>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => navigate({ type: "tax" })}
        className="w-full flex items-center justify-center gap-1 text-sm font-semibold text-primary hover:underline py-1"
      >
        월별 세금 일정 전체 보기
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
