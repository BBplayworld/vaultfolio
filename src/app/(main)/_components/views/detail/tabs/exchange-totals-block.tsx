"use client";

// 상세·암호화폐 '거래소별' 접기 블록(#325, 5.163) — 읽기 전용(맞추기 버튼 없음). 열림 상태는 useState만(저장 키 0).
// 행은 주식 증권사별(5.160)의 BrokerRow를 그대로 쓴다. 값은 computeExchangeTotals(헤더와 같은 모집단·같은 표시값).
import { useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ASSET_THEME } from "@/config/theme";
import { computeExchangeTotals } from "@/lib/asset/exchange-totals";
import type { Crypto } from "@/types/asset";
import { isPreviewEnv } from "@/lib/cloud-sync/config";
import { track } from "@/lib/analytics/ga";
import { BrokerRow } from "./broker-totals-block";

// `상세·암호화폐·거래소별 열기` — 페이지 수명당 1회(거래소명·금액 미전송, 저장 키 0)
let exchangeOpenSent = false;

export function ExchangeTotalsBlock({ crypto }: { crypto: Crypto[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rows = useMemo(() => computeExchangeTotals(crypto), [crypto]);
  // 묶음 2개 미만이거나 총 평가금이 0이면 그리지 않는다
  if (rows.length < 2 || rows.reduce((a, r) => a + r.valueUnits, 0) <= 0) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !exchangeOpenSent) {
      exchangeOpenSent = true;
      if (!isPreviewEnv()) track("feature_use", { category: "crypto_exchange_open" });
    }
  };
  const hasUnassigned = rows.some((r) => r.unassigned);

  return (
    <section data-testid="exchange-totals" data-screenshot-hide className={`rounded-lg bg-card shadow-sm ${ASSET_THEME.listBox}`}>
      <button
        type="button"
        data-testid="exchange-totals-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className="flex min-h-10 w-full items-center gap-1.5 px-4 py-2.5 text-left motion-safe:transition-transform duration-150 active:scale-[0.99]"
      >
        <span className="text-sm font-semibold">거래소별</span>
        <span className="text-sm text-muted-foreground">· {rows.length}곳</span>
        <ChevronDown aria-hidden className={`ml-auto size-4 shrink-0 text-muted-foreground motion-safe:transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        id={panelId}
        role="region"
        aria-label="거래소별 합계"
        data-testid="exchange-totals-panel"
        data-state={open ? "open" : "closed"}
        {...(open ? {} : { inert: true, "aria-hidden": true })}
        className={`grid ease-out motion-safe:transition-[grid-template-rows,opacity,visibility] motion-safe:duration-300 ${open ? "grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0"}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="divide-y divide-border px-4 pb-2 dark:divide-border/30">
            {rows.map((r) => (
              <BrokerRow key={r.unassigned ? "__unassigned" : r.name} row={r} scale={1} countText={`코인 ${r.count}개`} />
            ))}
          </div>
          {hasUnassigned && (
            <p data-testid="exchange-totals-note" className="px-4 pb-3 text-sm text-muted-foreground text-pretty break-keep">거래소를 적지 않은 코인이에요.</p>
          )}
        </div>
      </div>
    </section>
  );
}
