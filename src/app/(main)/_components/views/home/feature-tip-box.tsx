"use client";

// 기능 활용 팁 박스 (S-4.32) — 신규 기능(이번 릴리스)을 최우선 추천하고, 이후엔 방문 기록 기반
// 저방문 기능을 추천한다. 닫기·클릭 이동 모두 해당 팁을 영구 dismiss(재노출 없음 — 앱의 기존
// "반복 리마인드 지양" 기조와 일치). tax-notice-box.tsx와 동일한 보더리스 카드 셸을 그대로 재사용한다.

import { useEffect, useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { ASSET_THEME } from "@/config/theme";
import { useAssetNavigation } from "../../layout/navigation/navigation-context";
import { dismissTip, pickRecommendedFeature } from "@/lib/feature-usage";
import type { AppFeature } from "@/config/app-features";

export function FeatureTipBox() {
  const { navigate } = useAssetNavigation();
  const [feature, setFeature] = useState<AppFeature | null>(null);

  useEffect(() => {
    // localStorage 접근이 있어 마운트 후 판정 (SSR/hydration 불일치 방지)
    setFeature(pickRecommendedFeature());
  }, []);

  if (!feature) return null;

  const go = () => {
    dismissTip(feature.id);
    if (feature.action) {
      feature.action();
      return;
    }
    feature.beforeNavigate?.();
    if (feature.target) navigate(feature.target);
  };

  const close = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    dismissTip(feature.id);
    setFeature(null);
  };

  const Icon = feature.icon;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      }}
      className="rounded-xl bg-card dark:border-0 shadow-xs p-4 space-y-3 cursor-pointer motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
    >
      <div className="flex items-start gap-2">
        <Lightbulb className={`size-4 mt-0.5 shrink-0 ${ASSET_THEME.important}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="rounded bg-orange-500/10 px-1.5 py-0.5 text-xs font-bold text-orange-600 dark:text-orange-400">
              TIP
            </span>
            {feature.isNew && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">NEW</span>
            )}
            <p className="text-sm sm:text-[15px] font-semibold text-foreground text-pretty">{feature.title}</p>
          </div>
          <p className="text-sm text-muted-foreground mt-1 text-pretty">{feature.description}</p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="닫기"
          className="shrink-0 -m-2 p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
