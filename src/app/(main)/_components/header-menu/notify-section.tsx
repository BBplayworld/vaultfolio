"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, ChevronRight, Send, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { track } from "@/lib/analytics/ga";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SKELETON_FILL } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { isPreviewEnv } from "@/lib/cloud-sync/config";
import { isTrialMode } from "@/lib/trial/trial-mode";
import { todayKst } from "@/lib/tax-utils";
import { PUSH_CATALOG, PUSH_GROUPS, getPushTopic, normalizePushTopics } from "@/lib/push/catalog";
import {
  VAPID_PUBLIC_KEY,
  detectPushEnv,
  enablePush,
  readPushState,
  sendTestPush,
  unsubscribePush,
  updatePushTargets,
} from "@/lib/push/client";
import { formatMonthDay } from "@/lib/push/message";
import { readPushPrefs, summarizePushPrefs, type PushPrefs } from "@/lib/push/prefs";
import type { PushCond } from "@/lib/push/types";
import { InlineSelector } from "../layout/ui/inline-selector";
import { PwaInstallFlow } from "../pwa/pwa-install-flow";
import { MENU_DESC, MENU_ICON, MENU_LABEL, MENU_ROW, MENU_SECTION_LABEL, menuBadge } from "./menu-styles";

// 설정 '알림' 섹션(#179) — 시장 종가 알림. 서버에는 endpoint·keys·카탈로그 ID·조건만 저장(보유 정보 0).
// 켜기 안내 → 권한 → 구독 → 대상·조건 Dialog. 체험 모드·Push 미지원 기기에서는 섹션 전체를 그리지 않는다.

type RowState = "loading" | "off" | "on" | "denied";

const ANIM_FADE = "motion-safe:animate-in motion-safe:fade-in duration-150";
// 소형 높이(320×568급): 목록 중첩 스크롤을 풀고 푸터를 sticky로 고정 — Tailwind가 클래스를 생성하도록 아래 className은 리터럴로 쓴다(템플릿 결합 금지)
const COND_DESC: Record<PushCond, string> = {
  daily: "거래일마다 장 마감 후 종가 등락을 알려드려요.",
  pm2: "종가가 ±2% 이상 움직인 대상만 알려드려요. 그런 대상이 없는 날은 알림이 없어요.",
};
const labelOf = (id: string) => getPushTopic(id)?.label ?? id;

function NotifyPreview({ title, body }: { title: string; body: string }) {
  return (
    <div data-testid="notify-preview-card" className="flex items-start gap-2.5 rounded-lg bg-card p-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192x192.png" alt="" className="size-9 shrink-0 rounded-[9px]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>시크릿에셋</span>
          <span>지금</span>
        </div>
        <p className="text-sm font-semibold tabular-nums">{title}</p>
        <p className="text-sm text-muted-foreground tabular-nums">{body}</p>
      </div>
    </div>
  );
}

export function NotifySection() {
  const [env] = useState(detectPushEnv);
  const trial = isTrialMode();
  const unready = !VAPID_PUBLIC_KEY;
  const [state, setState] = useState<RowState>("loading");
  const [prefs, setPrefs] = useState<PushPrefs>(() => readPushPrefs());
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<null | "enable" | "denied" | "targets">(null);
  const [sel, setSel] = useState<string[]>([]);
  const [cond, setCond] = useState<PushCond>("daily");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    if (env !== "ready" || unready || trial) return;
    let alive = true;
    readPushState().then((s) => {
      if (!alive) return;
      setPrefs(readPushPrefs());
      setState(s);
    });
    return () => {
      alive = false;
    };
  }, [env, unready, trial]);

  // 체험 모드·미지원 기기·(운영에서) 키 미설정은 섹션 자체를 그리지 않는다. preview에서 키가 없으면 '준비 중'
  if (trial || env === "unsupported" || (unready && !isPreviewEnv())) return null;

  const on = state === "on";
  const summary = summarizePushPrefs(prefs, labelOf);

  const handleRow = async () => {
    if (busyRef.current || state === "loading") return;
    if (state === "denied") return setDialog("denied");
    if (state === "off") return setDialog("enable");
    busyRef.current = true;
    setBusy(true);
    await unsubscribePush(true);
    setState("off");
    toast.success("시장 알림을 껐어요");
    track("feature_use", { category: "push_off" });
    busyRef.current = false;
    setBusy(false);
  };

  const handleEnable = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const p = readPushPrefs();
    const r = await enablePush(p.topics, p.cond); // 첫 await = 권한 요청(제스처 유지)
    busyRef.current = false;
    setBusy(false);
    if (r === "ok") {
      setPrefs(readPushPrefs());
      setState("on");
      setDialog(null);
      toast.success("시장 알림을 켰어요");
      track("feature_use", { category: "push_on" });
    } else if (r === "denied") {
      setState("denied");
      setDialog("denied");
      track("feature_use", { category: "push_denied" });
    } else {
      toast.error("잠시 후 다시 시도해 주세요");
    }
  };

  const openTargets = () => {
    const p = readPushPrefs();
    setSel(normalizePushTopics(p.topics));
    setCond(p.cond);
    setDialog("targets");
  };

  const handleSave = async () => {
    if (saving || sel.length === 0) return;
    setSaving(true);
    const ok = await updatePushTargets(sel, cond);
    setSaving(false);
    if (!ok) return toast.error("잠시 후 다시 시도해 주세요");
    setPrefs(readPushPrefs());
    setDialog(null);
    toast.success("알림 대상을 저장했어요");
  };

  const handleTest = async () => {
    if (testing) return;
    setTesting(true);
    const r = await sendTestPush();
    setTesting(false);
    if (r === "ok") toast.success("테스트 알림을 보냈어요");
    else toast.error("잠시 후 다시 시도해 주세요");
  };

  const toggleTopic = (id: string, checked: boolean) =>
    setSel((cur) => (checked ? PUSH_CATALOG.filter((t) => t.id === id || cur.includes(t.id)).map((t) => t.id) : cur.filter((x) => x !== id)));

  const rowIcon = state === "denied" ? BellOff : Bell;
  const RowIcon = rowIcon;
  const today = formatMonthDay(todayKst());

  const rowBody = (
    <>
      <RowIcon className={MENU_ICON} aria-hidden />
      <div className="flex-1 min-w-0">
        <span className={MENU_LABEL}>시장 알림</span>
        {state === "loading" && env === "ready" && !unready ? (
          <div className="mt-1.5 space-y-1.5" aria-hidden>
            <div className={`h-3.5 w-4/5 rounded ${SKELETON_FILL}`} />
            <div className={`h-3.5 w-2/5 rounded ${SKELETON_FILL}`} />
          </div>
        ) : (
          <p className={`${MENU_DESC} ${state === "denied" ? "text-orange-600 dark:text-orange-400" : ""}`}>
            {unready
              ? "준비 중이에요"
              : env === "needs-install"
                ? "홈 화면에 추가한 앱에서 쓸 수 있어요"
                : state === "on"
                  ? summary
                  : state === "denied"
                    ? "알림이 차단돼 있어요. 기기 설정에서 허용해 주세요"
                    : "거래일 장 마감 후 시장 종가 등락을 알려드려요"}
          </p>
        )}
      </div>
    </>
  );

  return (
    <section data-testid="settings-section-notify">
      <p className={MENU_SECTION_LABEL}>알림</p>
      <div className="flex flex-col">
        {env === "needs-install" && !unready ? (
          <PwaInstallFlow>
            {({ onClick }) => (
              <button type="button" data-testid="settings-row-notify" data-state="ios" className={MENU_ROW} onClick={onClick}>
                {rowBody}
                <ChevronRight className={MENU_ICON} aria-hidden />
              </button>
            )}
          </PwaInstallFlow>
        ) : (
          <button
            type="button"
            data-testid="settings-row-notify"
            data-state={unready ? "unready" : state}
            className={MENU_ROW}
            aria-pressed={on}
            aria-busy={busy || state === "loading"}
            disabled={unready}
            onClick={handleRow}
          >
            {rowBody}
            {state !== "loading" && !unready && (
              <span key={state} className={`${menuBadge(on)} ${ANIM_FADE}`}>
                {on ? "ON" : "OFF"}
              </span>
            )}
            {state === "loading" && !unready && <span className={`h-6 w-10 rounded ${SKELETON_FILL}`} aria-hidden />}
          </button>
        )}

        {/* 행 2·3 — 항상 마운트, 펼침 전환(재마운트 없음) */}
        <div
          className={`grid ease-out motion-safe:transition-[grid-template-rows] motion-safe:duration-300 ${on ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
          inert={!on}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="flex flex-col gap-2 pt-2">
              <button type="button" data-testid="settings-row-notify-targets" className={MENU_ROW} aria-haspopup="dialog" onClick={openTargets}>
                <SlidersHorizontal className={MENU_ICON} aria-hidden />
                <span className={`${MENU_LABEL} flex-1`}>알림 받을 대상·조건</span>
                <ChevronRight className={MENU_ICON} aria-hidden />
              </button>
              {isPreviewEnv() && (
                <button type="button" data-testid="settings-row-notify-test" className={MENU_ROW} onClick={handleTest} disabled={testing}>
                  <Send className={MENU_ICON} aria-hidden />
                  <div className="flex-1 min-w-0">
                    <span className={MENU_LABEL}>{testing ? "보내는 중…" : "테스트 알림 보내기"}</span>
                    <p className={MENU_DESC}>미리보기 환경에서만 보여요</p>
                  </div>
                  {testing && <Spinner className="shrink-0" />}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 켜기 안내 / 권한 거부 */}
      <Dialog open={dialog === "enable" || dialog === "denied"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md touch-pan-y" data-testid={dialog === "denied" ? "notify-denied-dialog" : "notify-enable-dialog"}>
          {dialog === "denied" ? (
            <div className={`grid gap-4 ${ANIM_FADE}`}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BellOff className="size-5 text-primary" />
                  알림이 차단돼 있어요
                </DialogTitle>
                <DialogDescription>기기 설정 &gt; 알림 &gt; 시크릿에셋에서 허용한 뒤 다시 켜 주세요.</DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-col gap-2">
                <Button variant="brand" onClick={() => setDialog(null)}>
                  확인
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Bell className="size-5 text-primary" />
                  시장 알림 켜기
                </DialogTitle>
                <DialogDescription className="sr-only">장 마감 후 시장 종가 등락을 알림으로 받아요.</DialogDescription>
              </DialogHeader>
              <div>
                <p className="px-1 pb-1 text-[11px] text-muted-foreground">예시 알림</p>
                <div className="flex flex-col gap-1.5 rounded-xl bg-background p-2">
                  <NotifyPreview title={`${today} 국내 종가`} body="코스피 +0.8%" />
                  <NotifyPreview title={`${today} 미국 종가`} body="S&P 500 -0.3%" />
                </div>
              </div>
              <p className="text-sm font-medium text-pretty break-keep">알림에는 시장 등락률만 담겨요. 자산 정보는 서버로 보내지 않아요.</p>
              <div className="space-y-1 text-sm leading-relaxed text-muted-foreground text-pretty break-keep">
                <p>국내 장은 오후 4~5시, 미국 장은 다음 날 아침 9~10시에 도착해요.</p>
                <p>처음엔 코스피, S&amp;P 500만 받아요. 나중에 바꿀 수 있어요.</p>
              </div>
              <DialogFooter className="flex-col gap-2">
                <Button variant="brand" data-testid="notify-enable-confirm" onClick={handleEnable} disabled={busy}>
                  {busy ? (
                    <>
                      <Spinner /> 켜는 중…
                    </>
                  ) : (
                    "알림 켜기"
                  )}
                </Button>
                <Button variant="secondary" onClick={() => setDialog(null)}>
                  취소
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 대상·조건 */}
      <Dialog open={dialog === "targets"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent
          data-testid="notify-targets-dialog"
          className="sm:max-w-md touch-pan-y max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain [@media(max-height:700px)]:pb-0"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="size-5 text-primary" />
              알림 받을 대상·조건
            </DialogTitle>
            <DialogDescription className="sr-only">알림으로 받을 시장 항목과 발송 조건을 고릅니다.</DialogDescription>
          </DialogHeader>
          <div role="status" className="h-5 text-sm">
            {sel.length === 0 ? (
              <span className="text-orange-600 dark:text-orange-400">대상을 1개 이상 골라 주세요</span>
            ) : (
              <span data-testid="notify-target-count" className="text-muted-foreground tabular-nums">
                {sel.length}개 선택
              </span>
            )}
          </div>
          <div className="-mx-2 max-h-[320px] overflow-y-auto overscroll-contain px-1 [@media(max-height:700px)]:max-h-none [@media(max-height:700px)]:overflow-visible">
            {PUSH_GROUPS.map((g) => (
              <div key={g.id} role="group" aria-labelledby={`notify-group-${g.id}`}>
                <p id={`notify-group-${g.id}`} className="flex h-8 items-center px-1 text-sm font-semibold text-muted-foreground">
                  {g.label}
                </p>
                {PUSH_CATALOG.filter((t) => t.group === g.id).map((t) => (
                  <label key={t.id} htmlFor={`notify-target-${t.id}`} className="flex min-h-10 cursor-pointer items-center gap-3 px-1">
                    <Checkbox
                      id={`notify-target-${t.id}`}
                      data-testid={`notify-target-${t.id}`}
                      checked={sel.includes(t.id)}
                      onCheckedChange={(c) => toggleTopic(t.id, c === true)}
                    />
                    <span className="flex-1 text-sm break-keep">{t.label}</span>
                    {g.id !== "kr-index" && g.id !== "us-index" && (
                      <span className="text-[11px] text-muted-foreground">{t.market === "kr" ? "국내" : "미국"}</span>
                    )}
                  </label>
                ))}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">알림 조건</p>
            <div data-testid="notify-condition">
              <InlineSelector
                value={cond}
                onChange={(v) => setCond(v as PushCond)}
                options={[
                  { value: "daily", label: "매 거래일" },
                  { value: "pm2", label: "±2% 이상만" },
                ]}
                fullWidth
                ariaLabel="알림 조건"
              />
            </div>
            <p className="min-h-11 text-sm text-muted-foreground text-pretty break-keep">{COND_DESC[cond]}</p>
          </div>
          <p className="text-sm text-muted-foreground text-pretty break-keep">
            국내 장은 오후 4~5시, 미국 장은 다음 날 아침 9~10시에 도착해요. 이 설정은 이 기기에서만 적용돼요.
          </p>
          <DialogFooter
            className="flex-col gap-2 [@media(max-height:700px)]:sticky [@media(max-height:700px)]:bottom-0 [@media(max-height:700px)]:-mx-6 [@media(max-height:700px)]:bg-background [@media(max-height:700px)]:dark:bg-popover [@media(max-height:700px)]:px-6 [@media(max-height:700px)]:pb-6 [@media(max-height:700px)]:pt-2"
          >
            <Button variant="brand" data-testid="notify-targets-save" onClick={handleSave} disabled={sel.length === 0 || saving}>
              {saving ? "저장 중…" : "저장"}
            </Button>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
