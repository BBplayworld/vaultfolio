"use client";

// 거래 입력 '연결 계좌' 행(#103, ui.md 2절) — 주식·코인 수동 입력 폼 공용.
// 즉시 반영 박스 바로 아래 별도 박스. 후보(같은 통화 현금 + 원화 거래의 대출)가 없으면 행 자체를 숨긴다.
import { useEffect } from "react";
import { ResyncTxWarning } from "../asset-update/resync-tx-warning";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { lastRefreshedAt } from "@/lib/asset/asset-refresh-status";
import { shouldWarnTxAfterResync } from "@/lib/asset/balance-edits";
import { todayKst } from "@/lib/tax-utils";
import { linkCandidates, type LinkTrade } from "@/lib/trade/linked-record";
import { LINK_NONE, linkPreviewText, linkValueOf, type LinkEval } from "@/lib/trade/link-text";
import type { AssetData } from "@/types/asset";

export function LinkAccountRow({ data, trade, reflected, value, onChange, ev, hasFee = false }: {
  data: AssetData;
  trade: Omit<LinkTrade, "id">;
  reflected: boolean;
  value: string;
  onChange: (v: string) => void;
  ev: LinkEval;
  hasFee?: boolean;
}) {
  const cands = linkCandidates(data, trade);
  const visible = reflected && (cands.cash.length > 0 || cands.loans.length > 0);
  const inList = value === LINK_NONE
    || cands.cash.some((c) => value === linkValueOf({ kind: "cash", cashId: c.id }))
    || cands.loans.some((l) => value === linkValueOf({ kind: "loan", loanId: l.id }));
  // 반영 해제·종목/통화/날짜 변경으로 후보에서 사라지면 '연결 안 함'으로 복귀
  useEffect(() => {
    if (value !== LINK_NONE && (!visible || !inList)) onChange(LINK_NONE);
  }, [visible, inList, value, onChange]);
  if (!visible) return null;

  const chosenKind = ev.state === "none" ? null : ev.choice.kind;
  const preview = ev.state === "ok" ? linkPreviewText(ev, trade.type, hasFee) : null;
  const warnResync = chosenKind !== null && shouldWarnTxAfterResync({ txDate: trade.date, reflected, refreshedAtIso: lastRefreshedAt(chosenKind) });

  return (
    <>
      <div data-testid="account-link-row" className="rounded-lg bg-muted/40 dark:bg-muted/20 p-3">
        <div className="flex items-center gap-2">
          <span className="shrink-0 whitespace-nowrap text-sm font-medium">연결 계좌</span>
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger data-testid="account-link-select" aria-label="연결 계좌" className="min-w-0 flex-1 [&>span]:truncate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={LINK_NONE}>연결 안 함</SelectItem>
              {cands.cash.length > 0 && (
                <SelectGroup>
                  <SelectLabel>현금 계좌</SelectLabel>
                  {cands.cash.map((c) => <SelectItem key={c.id} value={linkValueOf({ kind: "cash", cashId: c.id })}>{c.name}</SelectItem>)}
                </SelectGroup>
              )}
              {cands.loans.length > 0 && (
                <SelectGroup>
                  <SelectLabel>대출</SelectLabel>
                  {cands.loans.map((l) => <SelectItem key={l.id} value={linkValueOf({ kind: "loan", loanId: l.id })}>{l.name}</SelectItem>)}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </div>
        {/* 잔액 미리보기: 항상 마운트, 펼침만 전환(연타 시 재마운트 0) */}
        <div className={`grid motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-300 ${preview ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="overflow-hidden" inert={!preview} aria-hidden={!preview}>
            <p data-testid="cash-link-preview" aria-live="polite" className="mt-2 break-keep text-sm tabular-nums">
              {preview && (
                <>
                  <span>{preview.main[0]} {preview.main[1]}</span>
                  <span className="text-muted-foreground"> → </span>
                  <span className="font-semibold">{preview.main[2]}</span>
                </>
              )}
            </p>
            <p className="break-keep text-pretty text-xs text-muted-foreground">{preview?.sub}</p>
          </div>
        </div>
      </div>
      {chosenKind && (
        <ResyncTxWarning
          category={chosenKind}
          show={warnResync}
          refreshedAtIso={lastRefreshedAt(chosenKind)}
          todayKst={todayKst()}
          id="link-resync-warning"
        />
      )}
      {ev.state === "error" && (
        <div role="alert" data-testid={ev.testId} className="rounded-lg bg-destructive/10 dark:bg-destructive/20 p-3 text-sm text-destructive font-medium break-keep text-pretty">
          {ev.message}
        </div>
      )}
    </>
  );
}
