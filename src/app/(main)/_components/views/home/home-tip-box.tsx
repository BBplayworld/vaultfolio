"use client";

// 홈 알림/팁 통합 박스 — 백업 안내(backup-nudge.tsx)·세금 안내(tax-notice-box.tsx)·
// 자산 최신화 안내(refresh-nudge.tsx)·기능 활용 팁(feature-tip-box.tsx) 4종을 이 박스 1개로 흡수(S-4.32 후속).
// 새 소식(whats_new, #159)은 공지(notice)를 대체 — 세션 숨김을 무시하는 강제 노출 없이 다른 팁과 같은 규칙(X = 읽음 처리 + 그 세션 박스 숨김).
// 판정은 home-tip.ts의 pickHomeTip이 백업>임박 세금>결산(#4.36)>새 소식>끊긴 거래 잇기(#147)>세금>최신화>기능 순으로 1개만 고른다.
// 인터랙션은 모두 "카드 전체 클릭 = 유일한 동작, X = 닫기"로 통일.

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics/ga";
import { ShieldAlert, Receipt, RefreshCw, Lightbulb, Sparkles, CalendarCheck, Link2, X } from "lucide-react";
import { toast } from "sonner";
import { useAssetData } from "@/contexts/asset-data-context";
import { useCloudSync } from "@/lib/cloud-sync/cloud-sync-provider";
import { exportAssetData } from "@/lib/asset/asset-storage";
import { EXPORT_STALE_MSG } from "@/hooks/use-data-export";
import { markNudgeShown } from "@/lib/asset/backup-status";
import { markRefreshNudgeShown } from "@/lib/asset/asset-refresh-status";
import { markTaxNoticeDismissed } from "@/lib/tax-utils";
import { dismissTip, isTipDismissed, runFeatureEntry } from "@/lib/feature-usage";
import { detectRelink, RELINK_OFFER_ID } from "@/lib/asset/resync";
import { isTrialMode } from "@/lib/trial/trial-mode";
import { isPwaLocked } from "@/lib/pwa/app-lock";
import { pickHomeTip, type HomeTip } from "@/lib/home-tip";
import { markWhatsNewSeen } from "@/lib/whats-new";
import { dispatchOpenRelink, dispatchOpenWhatsNew } from "../../layout/navigation/asset-dispatch";
import { ASSET_THEME } from "@/config/theme";
import { useAssetNavigation } from "../../layout/navigation/navigation-context";
import { settlementName } from "../activity/change-hero";

export const CATEGORY_LABEL: Record<string, string> = {
  stock: "주식",
  crypto: "암호화폐",
  cash: "현금성 자산",
  loan: "대출",
};

// X 닫기 시 이번 세션(창) 동안 팁 박스를 완전히 숨긴다 — 다음 순위 팁이 바로 튀어나오지 않게.
// sessionStorage라 재접속(새 세션) 시 초기화 → 각 종류의 재노출 정책대로 다음 팁이 정상 노출.
// (pwa-connect-prompt.tsx의 세션 dismiss 패턴과 동일)
const SESSION_DISMISS_KEY = "secretasset_home_tip_session_dismissed";

/** 노출 GA 중복 방지 키 — 같은 페이지에서 같은 팁(종류·결산 월·기능)은 1회만 view 전송(#4.36) */
export function homeTipViewKey(tip: HomeTip): string {
  if (tip.kind === "settlement") return `settlement:${tip.window.month}`;
  if (tip.kind === "feature") return `feature:${tip.feature.id}`;
  return tip.kind;
}

export function HomeTipBox() {
  const { assetData, getAssetSummary, isDataLoaded } = useAssetData();
  const cs = useCloudSync();
  const { navigate } = useAssetNavigation();
  const [tip, setTip] = useState<HomeTip | null>(null);
  const keepShownRef = useRef<"backup" | "refresh" | undefined>(undefined); // 이번 마운트에서 승자였던 backup·refresh 종류 — effect 재실행에도 유지(#115)
  const lastViewKey = useRef<string | null>(null); // assetData 갱신마다 effect가 다시 돌아도 같은 팁 노출 GA는 1회

  const hasAssets = getAssetSummary().totalValue > 0 || assetData.loans.length > 0;

  useEffect(() => {
    // 자산 불러오기가 끝나기 전엔 판정·기록을 하지 않는다(#159 S7) — 로드 전 빈 상태를 '첫 실행'으로 오인해 기존 사용자를 전원 읽음 처리하는 것 방지
    if (!isDataLoaded) return;
    const eligible = !isTrialMode() && !isPwaLocked();
    // 첫 실행 조용한 기록은 항상 마운트되는 WhatsNewHost가 맡는다(HomeTipBox는 자산이 있을 때만 마운트 — 4.82 qa D2)
    try {
      if (sessionStorage.getItem(SESSION_DISMISS_KEY) === "true") { setTip(null); return; }
    } catch { /* 무시 */ }
    // 끊긴 거래 후보(#147) — 체험·앱잠금 중이거나 '그대로 두기'를 눌렀으면 감지하지 않는다
    const hasRelink = eligible && !isTipDismissed(RELINK_OFFER_ID) && detectRelink(assetData).length > 0;
    const picked = pickHomeTip({ assetData, hasAssets, syncArmed: cs.status === "armed", keepShown: keepShownRef.current, hasRelink, whatsNewOk: eligible });
    keepShownRef.current = picked?.kind === "backup" || picked?.kind === "refresh" ? picked.kind : undefined;
    // 승자만 "오늘 떴다" flag를 찍는다 — 안 뜬 하위 종류까지 flag를 찍으면 실제로 못 본 채로 소비된다.
    if (picked?.kind === "backup") markNudgeShown();
    if (picked?.kind === "refresh") markRefreshNudgeShown();
    setTip(picked);
    if (picked) {
      const key = homeTipViewKey(picked);
      if (lastViewKey.current !== key) {
        lastViewKey.current = key;
        track("feature_use", { category: "home_tip", method: "view" });
      }
    }
  }, [assetData, hasAssets, cs.status, isDataLoaded]);

  // '그대로 두기' 직후 — 같은 세션 홈에서 relink 팁을 즉시 내린다(#147)
  useEffect(() => {
    const onKept = () => setTip((t) => (t?.kind === "relink" ? null : t));
    window.addEventListener("relink-kept", onKept);
    return () => window.removeEventListener("relink-kept", onKept);
  }, []);

  if (!tip) return null;

  const close = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    keepShownRef.current = undefined;
    if (tip.kind === "tax") markTaxNoticeDismissed();
    // "whats_new" X = 읽음 처리(시트는 열지 않는다) — 같은 소식이 세션·다음 방문마다 되살아나지 않게
    if (tip.kind === "whats_new") markWhatsNewSeen();
    if (tip.kind === "feature") dismissTip(tip.feature.id);
    // 이번 세션 동안 팁 박스 전체를 숨김 (다음 순위 팁도 안 뜨게). 재접속 시 초기화.
    try { sessionStorage.setItem(SESSION_DISMISS_KEY, "true"); } catch { /* 무시 */ }
    track("feature_use", { category: "home_tip", method: "close" });
    setTip(null);
  };

  const activate = () => {
    keepShownRef.current = undefined;
    track("feature_use", { category: "home_tip", method: "click" });
    if (tip.kind === "backup") {
      try {
        if (!exportAssetData(assetData)) {
          toast.error(EXPORT_STALE_MSG);
          track("data_action", { method: "export", source: "home_tip", result: "blocked" });
          return;
        }
        toast.success("자산 데이터가 다운로드되었습니다.");
        track("data_action", { method: "export", source: "home_tip", result: "success" });
      } catch {
        toast.error("데이터 내보내기에 실패했습니다.");
        track("data_action", { method: "export", source: "home_tip", result: "fail" });
        return;
      }
      setTip(null);
      return;
    }
    if (tip.kind === "tax") {
      navigate({ type: "tax" });
      return;
    }
    if (tip.kind === "settlement") {
      // 허브 결산 카드와 같은 진입 형태 — source만 home_tip
      navigate({ type: "activity", tab: "change", init: { scope: "all", period: "month", month: tip.window.month, source: "home_tip" } });
      return;
    }
    if (tip.kind === "relink") {
      dispatchOpenRelink(); // 확인 화면은 RelinkHost가 연다 — 팁은 그대로 둬 적용 후 후보가 사라지면 다음 판정에서 내려간다
      return;
    }
    if (tip.kind === "refresh") {
      window.dispatchEvent(new CustomEvent("open-add-asset-sheet", { detail: { category: tip.staleCategories[0] } }));
      setTip(null);
      return;
    }
    if (tip.kind === "whats_new") {
      // 시트는 WhatsNewHost가 연다(열기 직전 상태로 '새' 표시를 계산하고 같은 순간 읽음 기록). 같은 세션에 다른 팁이 튀어나오지 않게 박스 전체 숨김
      try { sessionStorage.setItem(SESSION_DISMISS_KEY, "true"); } catch { /* 무시 */ }
      dispatchOpenWhatsNew("home_tip");
      setTip(null);
      return;
    }
    // feature
    dismissTip(tip.feature.id);
    runFeatureEntry(tip.feature, navigate, "home_tip");
  };

  const { Icon, badgeLabel, title, description } = contentOf(tip);

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="home-tip"
      data-kind={tip.kind}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      }}
      className="rounded-xl bg-card dark:border-0 shadow-xs p-4 space-y-3 cursor-pointer motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
    >
      <div className="flex items-start gap-2">
        <Icon className={`size-4 mt-0.5 shrink-0 ${ASSET_THEME.important}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="rounded bg-orange-500/10 px-1.5 py-0.5 text-xs font-bold text-orange-600 dark:text-orange-400">
              {badgeLabel}
            </span>
            <p data-testid="home-tip-title" className="text-sm sm:text-[15px] font-semibold text-foreground text-pretty break-keep wrap-break-word">{title}</p>
          </div>
          <p className="text-sm text-muted-foreground mt-1 text-pretty break-keep wrap-break-word">{description}</p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="닫기"
          data-testid="home-tip-close"
          className="shrink-0 -m-3 p-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

function contentOf(tip: HomeTip) {
  if (tip.kind === "backup") {
    return {
      Icon: ShieldAlert,
      badgeLabel: "백업",
      title: tip.days === null ? "아직 백업한 적이 없어요" : `백업한 지 ${tip.days}일 지났어요`,
      description: "자산 기록은 이 기기에만 저장돼요. 브라우저 데이터를 지우면 복구할 수 없어요.",
    };
  }
  if (tip.kind === "tax") {
    const top = tip.matches[0];
    const rest = tip.matches.length - 1;
    return {
      Icon: Receipt,
      badgeLabel: "세금",
      title: `[${top.event.dueLabel}] ${top.event.title}`,
      description: rest > 0 ? `${top.event.summary} 그 외 ${rest}건도 확인하세요.` : top.event.summary,
    };
  }
  if (tip.kind === "settlement") {
    return {
      Icon: CalendarCheck,
      badgeLabel: "결산",
      title: `${settlementName(tip.window.month, tip.today, true)}이 열렸어요`,
      description: "한 달 동안 순자산이 무엇 때문에 바뀌었는지 볼 수 있어요.",
    };
  }
  if (tip.kind === "relink") {
    return {
      Icon: Link2,
      badgeLabel: "거래",
      title: "맞추기 때 끊긴 거래 기록이 있어요",
      description: "확인하고 다시 이어 보세요",
    };
  }
  if (tip.kind === "refresh") {
    const rest = tip.staleCategories.length - 1;
    return {
      Icon: RefreshCw,
      badgeLabel: "최신화",
      title: `${CATEGORY_LABEL[tip.staleCategories[0]]} 최신화가 오래됐어요`,
      description: `보유 현황이 오래되면 순자산 원인분해·성적표가 실제와 달라질 수 있어요.${rest > 0 ? ` 그 외 ${rest}곳도 최신화가 필요해요.` : ""}`,
    };
  }
  if (tip.kind === "whats_new") {
    return {
      Icon: Sparkles,
      badgeLabel: "소식",
      title: `새 소식 ${tip.count}개`,
      description: tip.title,
    };
  }
  // feature
  return {
    Icon: Lightbulb,
    badgeLabel: "TIP",
    title: tip.feature.title,
    description: tip.feature.description,
  };
}
