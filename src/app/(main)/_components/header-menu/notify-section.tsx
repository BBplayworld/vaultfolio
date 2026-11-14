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
import { PUSH_CATALOG, getPushTopic, normalizePushTopics } from "@/lib/push/catalog";
import {
  VAPID_PUBLIC_KEY,
  detectPushEnv,
  enablePush,
  readPushState,
  sendTestPush,
  unsubscribePush,
  updatePushTargets,
} from "@/lib/push/client";
import { PUSH_COND_TOPICS, readPushPrefs, summarizePushPrefs, type PushPrefs } from "@/lib/push/prefs";
import type { PushCond } from "@/lib/push/types";
import { PwaInstallFlow } from "../pwa/pwa-install-flow";
import { MENU_DESC, MENU_ICON, MENU_LABEL, MENU_ROW, MENU_SECTION_LABEL, menuBadge } from "./menu-styles";

// 설정 '알림' 섹션(#179, 4.91) — 아침 시장 요약·국내 장 마감·월 결산 열림·세금 마감 알림 + 큰 움직임 조건. 서버에는 endpoint·keys·알림 종류 ID만 저장(보유 정보 0).
// 켜기 안내(종류를 직접 고름, 미리 체크 없음) → 권한 → 구독 → 종류 Dialog. 체험 모드·Push 미지원 기기에서는 섹션 전체를 그리지 않는다.

type RowState = "loading" | "off" | "on" | "denied";

const ANIM_FADE = "motion-safe:animate-in motion-safe:fade-in duration-150";
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

function TopicChecks({ sel, onToggle }: { sel: string[]; onToggle: (id: string, checked: boolean) => void }) {
  return (
    <div>
      {PUSH_CATALOG.map((t) => (
        <label key={t.id} htmlFor={`notify-target-${t.id}`} className="flex min-h-10 cursor-pointer items-center gap-3 px-1 py-1">
          <Checkbox
            id={`notify-target-${t.id}`}
            data-testid={`notify-target-${t.id}`}
            checked={sel.includes(t.id)}
            onCheckedChange={(c) => onToggle(t.id, c === true)}
          />
          <span className="flex-1 min-w-0">
            <span className="block text-sm break-keep">{t.label}</span>
            <span className="block text-[11px] text-muted-foreground break-keep">{t.desc}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function CondCheck({ cond, sel, onChange }: { cond: PushCond; sel: string[]; onChange: (c: PushCond) => void }) {
  const enabled = sel.some((id) => PUSH_COND_TOPICS.includes(id));
  return (
    <label htmlFor="notify-cond" className={`flex min-h-10 items-center gap-3 px-1 py-1 ${enabled ? "cursor-pointer" : "opacity-50"}`}>
      <Checkbox
        id="notify-cond"
        data-testid="notify-cond"
        checked={cond === "pm2"}
        disabled={!enabled}
        onCheckedChange={(c) => onChange(c === true ? "pm2" : "daily")}
      />
      <span className="flex-1 min-w-0">
        <span className="block text-sm break-keep">큰 움직임 있는 날만</span>
        <span className="block text-[11px] text-muted-foreground break-keep">아침 시장 요약·국내 장 마감에 적용, 지수 ±2% 이상인 날</span>
      </span>
    </label>
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
  const [cond, setCond] = useState<PushCond>("daily");
  const [sel, setSel] = useState<string[]>([]); // 켜기 안내·종류 Dialog 공용 — 켜기 안내를 열 때 빈 선택으로 시작
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
    if (state === "off") {
      setSel([]);
      setCond("daily");
      return setDialog("enable");
    }
    busyRef.current = true;
    setBusy(true);
    await unsubscribePush(true);
    setState("off");
    toast.success("알림을 껐어요");
    track("feature_use", { category: "push_off" });
    busyRef.current = false;
    setBusy(false);
  };

  const handleEnable = async () => {
    if (busyRef.current || sel.length === 0) return;
    busyRef.current = true;
    setBusy(true);
    const r = await enablePush(sel, cond); // 첫 await = 권한 요청(제스처 유지)
    busyRef.current = false;
    setBusy(false);
    if (r === "ok") {
      setPrefs(readPushPrefs());
      setState("on");
      setDialog(null);
      toast.success("알림을 켰어요");
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
    toast.success("알림 종류를 저장했어요");
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

  const rowBody = (
    <>
      <RowIcon className={MENU_ICON} aria-hidden />
      <div className="flex-1 min-w-0">
        <span className={MENU_LABEL}>알림</span>
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
                    : "아침 시장·국내 장 마감·월 결산·세금 마감을 골라 받아요"}
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
                <span className={`${MENU_LABEL} flex-1`}>알림 받을 종류</span>
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
                  알림 켜기
                </DialogTitle>
                <DialogDescription className="sr-only">아침 시장 요약, 국내 장 마감, 월 결산 열림, 세금 마감을 알림으로 받아요. 받을 종류를 직접 골라요.</DialogDescription>
              </DialogHeader>
              <div>
                <p className="px-1 pb-1 text-[11px] text-muted-foreground">예시 알림</p>
                <div className="flex flex-col gap-1.5 rounded-xl bg-background p-2">
                  <NotifyPreview title="11/24 아침 시장" body="미국 S&P 500 +0.8% · 나스닥 +1.1% | 국내 코스피 +0.5% · 코스닥 -0.3%" />
                  <NotifyPreview title="11월 결산이 열렸어요" body="12월 10일까지 이번 달 자산 변화를 볼 수 있어요" />
                </div>
              </div>
              <div>
                <p className="px-1 pb-1 text-sm font-semibold text-muted-foreground">받을 알림을 골라 주세요</p>
                <TopicChecks sel={sel} onToggle={toggleTopic} />
                <CondCheck cond={cond} sel={sel} onChange={setCond} />
              </div>
              <p className="text-sm font-medium text-pretty break-keep">알림에는 공개 시장 정보와 날짜 안내만 담겨요. 자산 정보는 서버로 보내지 않아요.</p>
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty break-keep">
                결산 알림은 &lsquo;캘린더에 추가&rsquo;의 월말 결산 일정과 같은 내용이에요. 알림은 결산이 열리는 날 아침에 도착해요.
              </p>
              <DialogFooter className="flex-col gap-2">
                <Button variant="brand" data-testid="notify-enable-confirm" onClick={handleEnable} disabled={busy || sel.length === 0}>
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

      {/* 알림 종류 */}
      <Dialog open={dialog === "targets"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent data-testid="notify-targets-dialog" className="sm:max-w-md touch-pan-y">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="size-5 text-primary" />
              알림 받을 종류
            </DialogTitle>
            <DialogDescription className="sr-only">알림으로 받을 종류를 고릅니다.</DialogDescription>
          </DialogHeader>
          <div role="status" className="h-5 text-sm">
            {sel.length === 0 ? (
              <span className="text-orange-600 dark:text-orange-400">1개 이상 골라 주세요</span>
            ) : (
              <span data-testid="notify-target-count" className="text-muted-foreground tabular-nums">
                {sel.length}개 선택
              </span>
            )}
          </div>
          <TopicChecks sel={sel} onToggle={toggleTopic} />
          <CondCheck cond={cond} sel={sel} onChange={setCond} />
          <p className="text-sm text-muted-foreground text-pretty break-keep">이 설정은 이 기기에서만 적용돼요.</p>
          <DialogFooter className="flex-col gap-2">
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
