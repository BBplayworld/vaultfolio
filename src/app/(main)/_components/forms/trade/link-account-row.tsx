"use client";

// 거래 입력 '연결 계좌' 행(#103, ui.md 2절) — 주식·코인 수동 입력 폼 공용.
// 즉시 반영 박스 바로 아래 별도 박스. 후보(같은 통화 현금 + 외화 거래의 원화 현금 + 대출)가 없으면 행 자체를 숨긴다.
import { useEffect } from "react";
import { ResyncTxWarning } from "../asset-update/resync-tx-warning";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { lastRefreshedAt } from "@/lib/asset/asset-refresh-status";
import { shouldWarnTxAfterResync } from "@/lib/asset/balance-edits";
import { todayKst } from "@/lib/tax-utils";
import { isLinkDateAllowed, linkCandidates, type LinkTrade } from "@/lib/trade/linked-record";
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
  // 후보는 있는데 거래일이 이번 달이 아니어서 숨기는 경우만 안내 1줄(즉시 반영 끔·후보 0개는 줄 없음, #119)
  const showNote = reflected && !visible && trade.date.length >= 7 && !isLinkDateAllowed(trade.date)
    && (() => { const c = linkCandidates(data, { ...trade, date: todayKst() }); return c.cash.length + c.loans.length > 0; })();
  if (!visible) {
    return showNote ? (
      <p data-testid="account-link-note" className="px-1 text-xs text-muted-foreground break-keep text-pretty">지난달 거래는 계좌 잔액을 바꾸지 않아요</p>
    ) : null;
  }

  // 현금 그룹: 외화 거래는 같은 통화 현금(달러·엔화) → 원화 현금, 원화 거래는 현금 계좌 하나(ui.md 1절)
  const foreignLabel = trade.currency === "USD" ? "달러 현금" : "엔화 현금";
  const cashGroups = trade.currency === "KRW"
    ? [{ label: "현금 계좌", items: cands.cash }]
    : [
        { label: foreignLabel, items: cands.cash.filter((c) => (c.currency || "KRW") === trade.currency) },
        { label: "원화 현금", items: cands.cash.filter((c) => (c.currency || "KRW") === "KRW") },
      ].filter((g) => g.items.length > 0);
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
              {cashGroups.map((g) => (
                <SelectGroup key={g.label}>
                  <SelectLabel>{g.label}</SelectLabel>
                  {g.items.map((c) => <SelectItem key={c.id} value={linkValueOf({ kind: "cash", cashId: c.id })}>{c.name}</SelectItem>)}
                </SelectGroup>
              ))}
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
                  <span>{preview.main[0]} </span>
                  {/* 금액은 각각 한 덩어리(nowrap), 화살표 앞뒤 공백에서만 줄바꿈 — 320px에서 10억 이상도 넘치지 않게 */}
                  <span data-testid="link-preview-before" className="whitespace-nowrap">{preview.main[1]}</span>
                  <span className="text-muted-foreground"> → </span>
                  <span data-testid="link-preview-after" className="whitespace-nowrap font-semibold">{preview.main[2]}</span>
                </>
              )}
            </p>
            <p className="break-keep text-pretty text-xs text-muted-foreground">
              {preview?.formula && preview.sub.startsWith(preview.formula) ? (
                <>
                  <span className="whitespace-nowrap">{preview.formula}</span>
                  {preview.sub.slice(preview.formula.length)}
                </>
              ) : preview?.sub}
            </p>
          </div>
        </div>
      </div>
      {/* 접힘 상태에서는 렌더하지 않는다: 높이 0 래퍼도 부모 space-y 간격을 한 칸 더 만든다(ui-review) */}
      {chosenKind && warnResync && (
        <ResyncTxWarning
          category={chosenKind}
          show
          refreshedAtIso={lastRefreshedAt(chosenKind)}
          todayKst={todayKst()}
          id="link-resync-warning"
          linkVariant
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
