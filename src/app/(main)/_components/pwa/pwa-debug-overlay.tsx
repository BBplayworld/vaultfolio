"use client";

/**
 * [임시 진단] PWA 빈 자산 원인 판별용 화면 오버레이.
 * standalone(또는 ?pwadebug=1)에서만 노출. 로그를 복사해 전달받아 (a)PIN 자동취소 / (b)공유URL 미캡처를 판별한다.
 * 원인 확정 후 이 컴포넌트와 layout 렌더, lib/pwa-debug 계측을 제거할 것.
 */

import { useEffect, useState } from "react";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { getPwaDebugLog, clearPwaDebugLog, type PwaDebugEntry } from "@/lib/pwa-debug";

export function PwaDebugOverlay() {
  const { isStandalone } = usePWAInstall();
  const [open, setOpen] = useState(true);
  const [entries, setEntries] = useState<PwaDebugEntry[]>([]);
  const [forceShow, setForceShow] = useState(false);

  useEffect(() => {
    const refresh = () => setEntries(getPwaDebugLog());
    refresh();
    setForceShow(new URLSearchParams(window.location.search).get("pwadebug") === "1");
    window.addEventListener("pwa-debug-log", refresh);
    return () => window.removeEventListener("pwa-debug-log", refresh);
  }, []);

  if (!isStandalone && !forceShow) return null;

  const copy = () => {
    const text = entries.map((e) => `${e.t} [${e.tag}] ${e.msg}`).join("\n");
    navigator.clipboard?.writeText(text);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-2 left-2 z-[200] rounded-md bg-black/80 px-2 py-1 text-[10px] font-mono text-white"
      >
        debug({entries.length})
      </button>
    );
  }

  return (
    <div className="fixed bottom-2 left-2 right-2 z-[200] max-h-[40vh] overflow-auto rounded-lg border border-white/20 bg-black/90 p-2 text-[10px] font-mono text-white shadow-2xl">
      <div className="mb-1 flex items-center gap-2">
        <span className="font-bold text-amber-400">PWA DEBUG ({entries.length})</span>
        <button onClick={copy} className="rounded bg-white/15 px-2 py-0.5">복사</button>
        <button onClick={() => { clearPwaDebugLog(); setEntries([]); }} className="rounded bg-white/15 px-2 py-0.5">지우기</button>
        <button onClick={() => setOpen(false)} className="ml-auto rounded bg-white/15 px-2 py-0.5">닫기</button>
      </div>
      {entries.length === 0 ? (
        <div className="text-white/50">로그 없음</div>
      ) : (
        entries.map((e, i) => (
          <div key={i} className="whitespace-pre-wrap break-all leading-tight">
            <span className="text-white/40">{e.t}</span>{" "}
            <span className="text-sky-400">[{e.tag}]</span> {e.msg}
          </div>
        ))
      )}
    </div>
  );
}
