"use client";

// 새 소식 시트 호스트(#159, 4.82) — (main) layout에 1개 상시 마운트(RelinkHost 옆). `open-whats-new` 이벤트(dispatchOpenWhatsNew)로 연다.
// 홈 팁은 클릭 시 언마운트되고 더보기는 Dialog 위에서 열리므로, 시트를 각자 안에 두지 않고 이 호스트로 통일(재마운트 없이 닫힘 애니메이션 보장).
// 열 때: ① 열기 직전 기록으로 '새'(위 5개) 집합을 스냅샷 ② 읽음 기록(최신 id·seenAt=지금) ③ GA view 1회. 스냅샷은 시트가 열려 있는 동안 유지된다.

import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { APP_VERSION } from "@/config/app-version";
import { APP_FEATURES } from "@/config/app-features";
import { WHATS_NEW, type WhatsNewEntry } from "@/config/whats-new";
import { sheetEntries, newBadgeIds, markWhatsNewSeen, parseEntryId, runSilentFirstRun } from "@/lib/whats-new";
import { useAssetData } from "@/contexts/asset-data-context";
import { isTrialMode } from "@/lib/trial/trial-mode";
import { isPwaLocked } from "@/lib/pwa/app-lock";
import { runFeatureEntry } from "@/lib/feature-usage";
import { track } from "@/lib/analytics/ga";
import { useAssetNavigation } from "../../layout/navigation/navigation-context";

function dateLabel(id: string): string {
  const p = parseEntryId(id);
  return p ? `${Math.floor((p.date % 10000) / 100)}/${p.date % 100}` : "";
}

export function WhatsNewHost() {
  const isMobile = useIsMobile();
  const { navigate } = useAssetNavigation();
  const { assetData, getAssetSummary, isDataLoaded } = useAssetData();
  const hasAssets = getAssetSummary().totalValue > 0 || assetData.loans.length > 0;
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<WhatsNewEntry[]>([]);
  const [badgeIds, setBadgeIds] = useState<Set<string>>(new Set());
  const openRef = useRef(false); // 이벤트 open 멱등(연타·중복 디스패치 방지)
  const closingRef = useRef(false); // 바로 가기 연타 시 이동 1회
  const sourceRef = useRef<"home_tip" | "more">("home_tip");
  const goneRef = useRef(false); // 바로 가기로 닫힘 — 닫힘 포커스 복귀 생략

  // 첫 실행 조용한 기록(GA 없음) — 웰컴 화면(자산 0)에서도 돌도록 항상 마운트되는 이 호스트가 맡는다.
  // 불러오기 완료 + 자산 0 + 기록 없음 + 체험·잠금 아님일 때만. 이후 등록한 자산에 지금까지의 소식은 '새'가 아니다
  useEffect(() => {
    runSilentFirstRun({ isDataLoaded, hasAssets, eligible: !isTrialMode() && !isPwaLocked() });
  }, [isDataLoaded, hasAssets]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      if (openRef.current) return;
      openRef.current = true;
      closingRef.current = false;
      goneRef.current = false;
      const source = (e as CustomEvent<{ source?: "home_tip" | "more" }>).detail?.source === "more" ? "more" : "home_tip";
      sourceRef.current = source;
      setBadgeIds(newBadgeIds()); // 읽음 기록 전에 계산
      setList(sheetEntries(WHATS_NEW));
      markWhatsNewSeen();
      track("feature_use", { category: "whats_new", method: "view", source });
      setOpen(true);
    };
    window.addEventListener("open-whats-new", onOpen);
    return () => window.removeEventListener("open-whats-new", onOpen);
  }, []);

  const close = () => {
    openRef.current = false;
    setOpen(false);
  };

  const go = (entry: WhatsNewEntry) => {
    if (closingRef.current) return;
    const feature = APP_FEATURES.find((f) => f.id === entry.featureId);
    if (!feature) return;
    closingRef.current = true;
    goneRef.current = true;
    close();
    track("feature_use", { category: "whats_new", method: "click" });
    runFeatureEntry(feature, navigate, "whats_new"); // 기능 팁 dismiss는 하지 않는다
  };

  const mobile = isMobile === true;

  return (
    <Sheet open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <SheetContent
        data-testid="whats-new-sheet"
        side={mobile ? "bottom" : "right"}
        hideClose={mobile}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement | null)?.focus({ preventScroll: true }); // 스크린리더가 제목부터 읽게 시트 자체에 포커스
        }}
        onCloseAutoFocus={(e) => {
          if (goneRef.current) { e.preventDefault(); return; } // 이동한 화면의 포커스를 뺏지 않는다
          if (sourceRef.current === "home_tip") {
            e.preventDefault(); // 홈 팁은 이미 사라져 복귀 대상이 없다
            const main = document.querySelector("main") as HTMLElement | null;
            if (main) { if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1"); main.focus({ preventScroll: true }); }
          }
        }}
        className={mobile ? "gap-0 rounded-t-2xl max-h-[80dvh] touch-pan-y" : "gap-0"}
      >
        {mobile && (
          <div
            className="absolute top-0 left-0 right-0 h-10 flex items-center justify-center cursor-grab touch-none z-50"
            onPointerDown={(e) => {
              const startY = e.clientY;
              const target = e.currentTarget;
              const sheet = target.closest('[data-slot="sheet-content"]') as HTMLElement | null;
              if (!sheet) return;
              target.setPointerCapture(e.pointerId);
              const onMove = (ev: PointerEvent) => {
                sheet.style.transform = `translateY(${Math.max(0, ev.clientY - startY)}px)`;
                sheet.style.transition = "none";
              };
              const onUp = (ev: PointerEvent) => {
                const dy = Math.max(0, ev.clientY - startY);
                sheet.style.transition = "";
                sheet.style.transform = "";
                target.removeEventListener("pointermove", onMove);
                target.removeEventListener("pointerup", onUp);
                target.removeEventListener("pointercancel", onUp);
                if (dy > 80) close();
              };
              target.addEventListener("pointermove", onMove);
              target.addEventListener("pointerup", onUp);
              target.addEventListener("pointercancel", onUp);
            }}
            aria-hidden="true"
          >
            <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
          </div>
        )}
        <SheetHeader className={mobile ? "px-4 mt-3" : "px-4"}>
          <SheetTitle>새 소식</SheetTitle>
          <SheetDescription data-testid="whats-new-version" className="text-sm text-muted-foreground tabular-nums">
            지금 버전 v{APP_VERSION}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 touch-pan-y">
          {list.length === 0 ? (
            <p data-testid="whats-new-empty" className="py-12 text-center text-sm text-muted-foreground">
              최근 60일 동안 새 소식이 없어요
            </p>
          ) : (
            <ul className="divide-y divide-border dark:divide-border/40">
              {list.map((entry) => (
                <li key={entry.id} data-testid="whats-new-item" className="py-3">
                  <p className="text-sm font-semibold text-foreground text-pretty break-keep wrap-break-word">
                    {badgeIds.has(entry.id) && (
                      <span
                        data-testid="whats-new-item-new"
                        className="inline-flex mr-1.5 rounded bg-orange-500/10 px-1.5 py-0.5 text-[11px] font-bold text-orange-700 dark:text-orange-400 align-middle"
                      >
                        새
                      </span>
                    )}
                    {entry.title}
                  </p>
                  {entry.body && (
                    <p className="text-sm text-muted-foreground leading-relaxed mt-1 break-keep wrap-break-word text-pretty">{entry.body}</p>
                  )}
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground tabular-nums">{dateLabel(entry.id)}</span>
                    {entry.featureId && (
                      <button
                        type="button"
                        data-testid="whats-new-go"
                        aria-label={`${entry.title} 바로 가기`}
                        onClick={() => go(entry)}
                        className="relative inline-flex items-center text-sm font-semibold text-primary active:scale-[0.96] transition-[color,scale] focus-visible:outline-2 focus-visible:outline-ring after:absolute after:-inset-y-2.5 after:-inset-x-2"
                      >
                        바로 가기
                        <ChevronRight className="size-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button variant="brand" className="w-full h-10" onClick={close}>
            닫기
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
