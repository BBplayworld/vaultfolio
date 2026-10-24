"use client";

import { Check, Plus } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/number-utils";
import { securitiesFirms, stockCategories } from "@/config/asset-options";
import type { Stock } from "@/types/asset";
import type { PositionSnapshot } from "@/types/transaction";
import { CATEGORY_TABS } from "../../views/detail/tabs/stock-tab";

// 거래 반영 대상 — 기존 보유 항목 직접 선택 또는 신규 자산(증권사 + 주식 타입) 등록
export type TradeTarget =
  | { kind: "existing"; stockId: string }
  | { kind: "new"; broker: string; category: Stock["category"] };

export const formatPrice = (value: number, currency: string) => {
  if (currency === "USD") return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (currency === "JPY") return `¥${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return formatCurrency(value);
};

export function getPositionSnapshot(stock: Stock, lockedByManual = false): PositionSnapshot {
  return {
    stockId: stock.id,
    quantity: stock.quantity,
    avgPrice: stock.averagePrice,
    avgExchangeRate: stock.purchaseExchangeRate ?? 0,
    source: stock.positionSource ?? "manual",
    effectiveDate: stock.positionEffectiveDate ?? stock.purchaseDate,
    lockedByManual,
  };
}

export const categoryLabel = (category: string) =>
  stockCategories.find((c) => c.value === category)?.label ?? category;

// 좁은 카드용 축약 — 주식 상세 카테고리 탭(CATEGORY_TABS)과 동일 표기(국내·해외·IRP·ISA·연금·비상장)
const categoryShortLabel = (category: string) =>
  CATEGORY_TABS.find((c) => c.value === category)?.label ?? categoryLabel(category);


interface StockTargetPickerProps {
  candidates: Stock[];
  value: TradeTarget | undefined;
  onChange: (target: TradeTarget) => void;
  allowNew: boolean;
  defaultCategory: Stock["category"];
  defaultBroker?: string;
}

// 보유 자산 항목 선택 카드 목록 + 신규 자산 등록(증권사·주식 타입 선택)
export function StockTargetPicker({ candidates, value, onChange, allowNew, defaultCategory, defaultBroker = "" }: StockTargetPickerProps) {
  const isNew = value?.kind === "new";
  const cardClass = (selected: boolean) =>
    `flex w-full min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-[background-color,box-shadow] motion-safe:active:scale-[0.96] ${selected ? "bg-card shadow-sm ring-2 ring-brand" : "bg-muted/40 hover:bg-muted/70 dark:bg-muted/25 dark:hover:bg-muted/40"
    }`;

  return (
    <div className="space-y-1.5">
      {candidates.map((s) => {
        const selected = value?.kind === "existing" && value.stockId === s.id;
        return (
          <button key={s.id} type="button" aria-pressed={selected} className={cardClass(selected)} onClick={() => onChange({ kind: "existing", stockId: s.id })}>
            <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">{categoryShortLabel(s.category)}</span>
            {/* 좁은 폭에서도 종목명이 과하게 잘리지 않도록 증권사·종목명 / 수량·평단 2줄 */}
            <span className="min-w-0 flex-1">
              <span className="block truncate">
                <span className="font-medium">{s.broker || "증권사 미지정"}</span>
                <span className="text-muted-foreground"> · {s.name}</span>
              </span>
              <span className="block truncate text-xs tabular-nums text-muted-foreground">
                {s.quantity.toLocaleString()}주 · 평단 {formatPrice(s.averagePrice, s.currency || "KRW")}
              </span>
            </span>
            {selected && <Check className="size-4 shrink-0 text-brand" />}
          </button>
        );
      })}

      {allowNew && (
        <div className={`rounded-lg ${isNew ? "bg-card shadow-sm ring-2 ring-brand" : ""}`}>
          <button
            type="button"
            aria-pressed={isNew}
            className={isNew ? "flex w-full min-h-10 items-center gap-2 px-3 py-2 text-left text-sm" : cardClass(false)}
            onClick={() => { if (!isNew) onChange({ kind: "new", broker: defaultBroker, category: defaultCategory }); }}
          >
            <Plus className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 font-medium">신규 자산 등록</span>
            {isNew && <Check className="size-4 shrink-0 text-brand" />}
          </button>
          {value?.kind === "new" && (
            <div className="grid grid-cols-2 gap-2 px-3 pb-3">
              <Select value={value.broker} onValueChange={(v) => onChange({ ...value, broker: v })}>
                <SelectTrigger className="h-9 w-full min-w-0 text-sm"><SelectValue placeholder="증권사 선택" /></SelectTrigger>
                <SelectContent>
                  {securitiesFirms.map((g) => g.items.map((f) => (
                    <SelectItem key={f} value={f} className="text-sm">{f}</SelectItem>
                  )))}
                </SelectContent>
              </Select>
              <Select value={value.category} onValueChange={(v) => onChange({ ...value, category: v as Stock["category"] })}>
                <SelectTrigger className="h-9 w-full min-w-0 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stockCategories.map((c) => (
                    <SelectItem key={c.value} value={c.value} className="text-sm">{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface PositionChangePreviewProps {
  before: { quantity: number; avgPrice: number };
  after: { quantity: number; avgPrice: number };
  currency: string;
  title?: string;
}

// 반영 후 예상 포지션(보유 수량·평단 before → after)
export function PositionChangePreview({ before, after, currency, title = "반영 후 예상 포지션" }: PositionChangePreviewProps) {
  return (
    <div className="rounded-lg bg-muted/40 dark:bg-muted/25 p-3 space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-sm text-muted-foreground">보유 수량</p>
          <p className="tabular-nums">
            <span className="text-muted-foreground">{before.quantity.toLocaleString()}</span>
            <span className="text-muted-foreground/60"> → </span>
            <span className="font-semibold">{after.quantity.toLocaleString()}주</span>
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">평단가</p>
          <p className="tabular-nums">
            <span className="text-muted-foreground">{formatPrice(before.avgPrice, currency)}</span>
            <span className="text-muted-foreground/60"> → </span>
            <span className="font-semibold">{formatPrice(after.avgPrice, currency)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
