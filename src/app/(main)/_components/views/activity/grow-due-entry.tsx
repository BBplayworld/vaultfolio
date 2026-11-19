"use client";

// 점검 한 장 진입(#245, 5.130) — `점검 차례 · {이유} ›` 한 줄 버튼. 종목 한 장 머리와 상세·주식 차례 행 펼침 맨 위가 이 컴포넌트 하나를 쓴다
// (같은 기능 두 진입은 문구·모양이 같다). 문장은 도착한 점검 한 장 이유 줄(grow-sheet-reason)과 글자·색이 같다.
// 누르면 성과 › 자산 성적표·불리기 › 내 자산 점검 › 주식 보기에서 그 종목 한 장이 열린 채로 도착한다(report-tab.aimGrowStockView).
// 종목 정보는 속성·GA에 싣지 않는다.
import { ChevronRight } from "lucide-react";
import { track } from "@/lib/analytics/ga";
import { isPreviewEnv } from "@/lib/cloud-sync/config";
import { useAssetNavigation } from "../../layout/navigation/navigation-context";
import { aimGrowStockView } from "./report-tab";

/** `점검 차례` 글자색 — 불리기 화면 행·한 장 이유 줄·상세·주식 행 표시·타일 차례 수가 같은 값을 쓴다 */
export const DUE_TEXT = "font-semibold text-indigo-600 dark:text-indigo-200";

export function GrowDueEntry({ name, text, labelKey, at, className = "" }: {
  /** 종목명 — aria-label에만 쓴다 */
  name: string;
  /** `점검 차례 · {dueReasonText}`(grow-decision.dueEntryText) */
  text: string;
  /** 열어 둘 종목의 이름표 키 */
  labelKey: string;
  at: "head" | "row";
  className?: string;
}) {
  const { navigate } = useAssetNavigation();
  const open = () => {
    if (!isPreviewEnv()) track("feature_use", { category: "stock_decision" });
    aimGrowStockView(labelKey);
    navigate({ type: "activity", tab: "report" });
  };
  return (
    <button
      type="button"
      data-testid="decision-entry"
      data-at={at}
      aria-label={`${name} ${text.replace(" · ", ", ")}, 점검 한 장 열기`}
      onClick={open}
      className={`flex min-h-10 w-full items-center gap-1 rounded-lg bg-foreground/6 py-2 pl-3 pr-2 text-left text-sm outline-none hover:bg-foreground/9 focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.98] motion-safe:transition-[transform,background-color] motion-safe:duration-150 ${className}`}
    >
      <span className={`min-w-0 flex-1 text-pretty break-keep ${DUE_TEXT}`}>{text}</span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
