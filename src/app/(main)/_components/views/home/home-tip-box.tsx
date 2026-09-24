"use client";

// 홈 알림/팁 통합 박스 — 백업 안내(backup-nudge.tsx)·세금 안내(tax-notice-box.tsx)·
// 자산 최신화 안내(refresh-nudge.tsx)·기능 활용 팁(feature-tip-box.tsx) 4종을 이 박스 1개로 흡수(S-4.32 후속).
// 새 공지(notice)는 #4.24에서 5번째 종류로 추가 — 필수 노출: 최초 1회는 세션 숨김 플래그를 무시하고
// 반드시 뜨며, X로 닫으면 이번 세션만 숨겨지고(영구 dismiss 아님) 실제로 열어봐야만(activate) 영구 열람 처리된다.
// 판정은 home-tip.ts의 pickHomeTip이 새 공지(필수)>백업>세금>최신화>기능 순으로 1개만 고른다.
// 인터랙션은 5종 모두 "카드 전체 클릭 = 유일한 동작, X = 닫기"로 통일.

import { useEffect, useState } from "react";
import { ShieldAlert, Receipt, RefreshCw, Lightbulb, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useAssetData } from "@/contexts/asset-data-context";
import { useCloudSync } from "@/lib/cloud-sync/cloud-sync-provider";
import { exportAssetData } from "@/lib/asset/asset-storage";
import { EXPORT_STALE_MSG } from "@/hooks/use-data-export";
import { markNudgeShown } from "@/lib/asset/backup-status";
import { markRefreshNudgeShown } from "@/lib/asset/asset-refresh-status";
import { markTaxNoticeDismissed } from "@/lib/tax-utils";
import { dismissTip } from "@/lib/feature-usage";
import { pickHomeTip, markCurrentNoticeSeen, isNoticeUnseen, type HomeTip } from "@/lib/home-tip";
import { NOTICE_TITLE, NOTICE_SUMMARY } from "../../layout/onboarding/notice";
import { dispatchOpenShareCard } from "../../layout/navigation/asset-dispatch";
import { ASSET_THEME } from "@/config/theme";
import { useAssetNavigation } from "../../layout/navigation/navigation-context";

const CATEGORY_LABEL: Record<string, string> = {
  stock: "주식",
  crypto: "암호화폐",
  cash: "현금성 자산",
  loan: "대출",
};

// X 닫기 시 이번 세션(창) 동안 팁 박스를 완전히 숨긴다 — 다음 순위 팁이 바로 튀어나오지 않게.
// sessionStorage라 재접속(새 세션) 시 초기화 → 각 종류의 재노출 정책대로 다음 팁이 정상 노출.
// (pwa-connect-prompt.tsx의 세션 dismiss 패턴과 동일)
const SESSION_DISMISS_KEY = "secretasset_home_tip_session_dismissed";
// 미열람 공지를 이번 세션에 이미 1회라도 노출했는지 — 이 플래그가 서기 전까지만 SESSION_DISMISS_KEY를
// 무시하고 공지를 강제 노출한다. 서고 나면 X 닫기(→ SESSION_DISMISS_KEY)로 세션 내 재노출이 정상 차단된다.
const NOTICE_SHOWN_SESSION_KEY = "secretasset_home_tip_notice_shown";

export function HomeTipBox() {
  const { assetData, getAssetSummary } = useAssetData();
  const cs = useCloudSync();
  const { navigate } = useAssetNavigation();
  const [tip, setTip] = useState<HomeTip | null>(null);

  const hasAssets = getAssetSummary().totalValue > 0 || assetData.loans.length > 0;

  useEffect(() => {
    let noticeShownThisSession = false;
    try { noticeShownThisSession = sessionStorage.getItem(NOTICE_SHOWN_SESSION_KEY) === "true"; } catch { /* 무시 */ }
    // 미열람 공지가 이번 세션에 아직 한 번도 안 떴을 때만 세션 숨김 플래그를 무시하고 강제 노출한다
    // (다른 팁의 X 닫기가 공지의 "최초 1회 노출"을 가로막지 못하게). 한 번 뜬 뒤엔 X 닫기가 정상 작동.
    if (!(isNoticeUnseen() && !noticeShownThisSession)) {
      try {
        if (sessionStorage.getItem(SESSION_DISMISS_KEY) === "true") { setTip(null); return; }
      } catch { /* 무시 */ }
    }
    const picked = pickHomeTip({ assetData, hasAssets, syncArmed: cs.status === "armed" });
    // 승자만 "오늘 떴다" flag를 찍는다 — 안 뜬 하위 종류까지 flag를 찍으면 실제로 못 본 채로 소비된다.
    if (picked?.kind === "backup") markNudgeShown();
    if (picked?.kind === "refresh") markRefreshNudgeShown();
    if (picked?.kind === "notice") {
      try { sessionStorage.setItem(NOTICE_SHOWN_SESSION_KEY, "true"); } catch { /* 무시 */ }
    }
    setTip(picked);
  }, [assetData, hasAssets, cs.status]);

  if (!tip) return null;

  const close = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (tip.kind === "tax") markTaxNoticeDismissed();
    // "notice"는 X로는 영구 dismiss 안 함(markCurrentNoticeSeen 미호출) — 실제로 열어봐야(activate)
    // 열람 처리된다. X 닫기는 SESSION_DISMISS_KEY만 세워 이번 세션 내 재노출을 막고(NOTICE_SHOWN_SESSION_KEY가
    // 이미 서 있어 강제 노출 바이패스가 꺼진 상태), 새 세션에선 다시 최우선으로 떠서 실제 열람을 유도한다.
    if (tip.kind === "feature") dismissTip(tip.feature.id);
    // 이번 세션 동안 팁 박스 전체를 숨김 (다음 순위 팁도 안 뜨게). 재접속 시 초기화.
    try { sessionStorage.setItem(SESSION_DISMISS_KEY, "true"); } catch { /* 무시 */ }
    setTip(null);
  };

  const activate = () => {
    if (tip.kind === "backup") {
      try {
        if (!exportAssetData(assetData)) {
          toast.error(EXPORT_STALE_MSG);
          return;
        }
        toast.success("자산 데이터가 다운로드되었습니다.");
      } catch {
        toast.error("데이터 내보내기에 실패했습니다.");
        return;
      }
      setTip(null);
      return;
    }
    if (tip.kind === "tax") {
      navigate({ type: "tax" });
      return;
    }
    if (tip.kind === "refresh") {
      window.dispatchEvent(new CustomEvent("open-add-asset-sheet", { detail: { category: tip.staleCategories[0] } }));
      setTip(null);
      return;
    }
    if (tip.kind === "notice") {
      markCurrentNoticeSeen();
      // 이번 공지의 핵심 기능(투자 유형 인증카드)으로 바로 이동 — 공지 본문 대신 실제 결과물을 보여준다.
      // 다음 릴리스에서 홍보 대상이 바뀌면 이 액션도 함께 갱신할 것(notice.tsx 콘텐츠와 짝).
      dispatchOpenShareCard("type");
      setTip(null);
      return;
    }
    // feature
    dismissTip(tip.feature.id);
    if (tip.feature.action) {
      tip.feature.action();
      return;
    }
    tip.feature.beforeNavigate?.();
    if (tip.feature.target) navigate(tip.feature.target);
  };

  const { Icon, badgeLabel, title, description } = contentOf(tip);

  return (
    <div
      role="button"
      tabIndex={0}
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
            {tip.kind === "feature" && tip.feature.isNew && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">NEW</span>
            )}
            <p className="text-sm sm:text-[15px] font-semibold text-foreground text-pretty">{title}</p>
          </div>
          <p className="text-sm text-muted-foreground mt-1 text-pretty">{description}</p>
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
  if (tip.kind === "refresh") {
    const rest = tip.staleCategories.length - 1;
    return {
      Icon: RefreshCw,
      badgeLabel: "최신화",
      title: `${CATEGORY_LABEL[tip.staleCategories[0]]} 최신화가 오래됐어요`,
      description: `보유 현황이 오래되면 순자산 원인분해·성적표가 실제와 달라질 수 있어요.${rest > 0 ? ` 그 외 ${rest}곳도 최신화가 필요해요.` : ""}`,
    };
  }
  if (tip.kind === "notice") {
    return {
      Icon: Sparkles,
      badgeLabel: "공지",
      title: NOTICE_TITLE,
      description: NOTICE_SUMMARY,
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
