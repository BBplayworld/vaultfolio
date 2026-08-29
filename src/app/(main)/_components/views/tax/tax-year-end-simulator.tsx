"use client";

// 연말 절세 시뮬레이션 (S-4.31) — "지금 팔면 세금이 얼마인가" + 손실 종목 손익통산 + 재매수 절세 팁.
// 체크박스+버튼(프리셋·스테퍼)만으로 조작한다 — 텍스트 입력 없음. 순수 조회/계산 UI, assetData 변경 없음.

import { useMemo, useState } from "react";
import { Minus, Plus, Info, Receipt } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/number-utils";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";
import { FOREIGN_CAPITAL_GAIN_DEDUCTION } from "@/config/tax-calendar";
import {
  computeRebuyQuantity,
  getYearEndTaxSimulation,
  simulateSelectedForeignSale,
  todayKst,
  type TaxSimCandidate,
} from "@/lib/tax-utils";
import type { AssetData } from "@/types/asset";

export function TaxYearEndSimulator({
  assetData,
  exchangeRates,
}: {
  assetData: AssetData;
  exchangeRates: { USD: number; JPY: number };
}) {
  const year = Number(todayKst().slice(0, 4));
  const sim = useMemo(
    () => getYearEndTaxSimulation(assetData, year, exchangeRates),
    [assetData, year, exchangeRates],
  );

  // stockId → 선택 수량. 맵에 없으면 미선택.
  const [selected, setSelected] = useState<Map<string, number>>(new Map());

  const selection = useMemo(
    () => Array.from(selected.entries()).map(([stockId, quantity]) => ({ stockId, quantity })),
    [selected],
  );
  // 선택이 없어도 baseline만으로 계산돼(체크된 종목 손익 0 합산) 항상 유효한 결과를 반환한다.
  const result = useMemo(
    () => simulateSelectedForeignSale(assetData, selection, year, exchangeRates),
    [assetData, selection, year, exchangeRates],
  );
  // 선택에 따라 즉시 갱신되는 잔여 공제 한도 — 실현손익 합계(sim.baselineGainKrw)는 매도 확정분이라 고정,
  // 한도는 "지금 이대로 매도하면"의 결과이므로 선택을 반영해야 의미가 있다.
  // 클램프 없이 그대로 뺀다 — 선택한 손실 종목이 크면 한도가 250만원보다 커지는 게 정상 손익통산이다.
  const remainingDeductionKrw = Math.max(FOREIGN_CAPITAL_GAIN_DEDUCTION - result.combinedGainKrw, 0);
  const candidateById = useMemo(
    () => new Map(sim.candidates.map((c) => [c.stockId, c])),
    [sim.candidates],
  );

  const setQuantity = (stockId: string, qty: number, max: number) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(stockId);
      else next.set(stockId, Math.min(qty, max));
      return next;
    });
  };
  const toggle = (c: TaxSimCandidate, checked: boolean) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (checked) next.set(c.stockId, c.quantity);
      else next.delete(c.stockId);
      return next;
    });
  };

  if (sim.candidates.length === 0) {
    return (
      <div className="flex h-36 items-center justify-center rounded-lg border border-dashed">
        <p className="text-muted-foreground text-sm">보유 중인 해외주식이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 예상 세액 + 실현손익·잔여한도·합산손익 통합, 스크롤 무관 고정(부모 헤더+탭 높이만큼 아래) */}
      <div className="sticky top-28 z-10 bg-background pb-1">
        <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Receipt className="size-5 text-amber-600 dark:text-amber-500 shrink-0" />
            <p className="text-sm font-semibold text-muted-foreground">예상 양도소득세</p>
          </div>
          <p className={`text-2xl sm:text-3xl font-extrabold tabular-nums ${ASSET_THEME.important}`}>
            {formatCurrency(Math.round(result.taxKrw))}
            {result.estimated && <span className="ml-1.5 text-sm font-medium text-muted-foreground">(추정)</span>}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>{year}년 실현손익 {formatCurrency(Math.round(sim.baselineGainKrw))}</span>
            <span>잔여 공제 한도 {formatCurrency(Math.round(remainingDeductionKrw))}</span>
            <span className="font-medium text-foreground">합산 손익 {formatCurrency(Math.round(result.combinedGainKrw))}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {sim.candidates.map((c) => {
          const qty = selected.get(c.stockId) ?? 0;
          const checked = qty > 0;
          const previewGainKrw = checked ? c.gainPerShareKrw * qty : c.unrealizedGainKrw;
          // "한도까지"는 이 종목을 제외한 현재 선택 전체 + 기준 손익을 반영해 매 렌더마다 다시 계산한다
          // (정적 c.rebuyQuantity는 선택 0개 기준이라 다른 종목을 선택/해제해도 갱신되지 않는 버그가 있었음)
          const otherSelectedGainKrw = selection.reduce((sum, s) => {
            if (s.stockId === c.stockId) return sum;
            const other = candidateById.get(s.stockId);
            return other ? sum + other.gainPerShareKrw * s.quantity : sum;
          }, 0);
          const rebuyQuantity = computeRebuyQuantity(c.gainPerShareKrw, c.quantity, sim.baselineGainKrw + otherSelectedGainKrw);
          const showRebuyChip = rebuyQuantity > 0 && rebuyQuantity < c.quantity;

          return (
            <div key={c.stockId} className="rounded-xl bg-card shadow-xs p-3.5 space-y-2.5">
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox checked={checked} onCheckedChange={(v) => toggle(c, v === true)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">보유 {c.quantity.toLocaleString()}주</p>
                </div>
                <p className={`text-sm font-bold tabular-nums ${getProfitLossColor(previewGainKrw)}`}>
                  {previewGainKrw >= 0 ? "+" : ""}{formatCurrency(Math.round(previewGainKrw))}
                  {c.estimated && <span className="ml-1 text-xs font-medium text-muted-foreground">(추정)</span>}
                </p>
              </label>

              {checked && (
                <div className="flex items-center gap-2 flex-wrap pl-7">
                  <Button
                    type="button" variant="secondary" size="sm" className="h-7 text-xs"
                    onClick={() => setQuantity(c.stockId, c.quantity, c.quantity)}
                    disabled={qty === c.quantity}
                  >
                    전량 ({c.quantity.toLocaleString()}주)
                  </Button>
                  {showRebuyChip && (
                    <Button
                      type="button" variant="secondary" size="sm" className="h-7 text-xs"
                      onClick={() => setQuantity(c.stockId, rebuyQuantity, c.quantity)}
                      disabled={qty === rebuyQuantity}
                    >
                      한도까지 ({rebuyQuantity.toLocaleString()}주 · 비과세)
                    </Button>
                  )}
                  <div className="flex items-center gap-1 ml-auto flex-wrap justify-end">
                    {c.quantity > 10 && (
                      <Button
                        type="button" variant="secondary" size="sm" className="h-7 px-1.5 text-xs"
                        onClick={() => setQuantity(c.stockId, qty - 10, c.quantity)}
                        disabled={qty <= 0}
                      >
                        -10
                      </Button>
                    )}
                    {c.quantity > 5 && (
                      <Button
                        type="button" variant="secondary" size="sm" className="h-7 px-1.5 text-xs"
                        onClick={() => setQuantity(c.stockId, qty - 5, c.quantity)}
                        disabled={qty <= 0}
                      >
                        -5
                      </Button>
                    )}
                    <Button
                      type="button" variant="secondary" size="icon" className="size-7"
                      onClick={() => setQuantity(c.stockId, qty - 1, c.quantity)}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="text-sm font-medium tabular-nums w-10 text-center">{qty}주</span>
                    <Button
                      type="button" variant="secondary" size="icon" className="size-7"
                      onClick={() => setQuantity(c.stockId, qty + 1, c.quantity)}
                      disabled={qty >= c.quantity}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                    {c.quantity > 5 && (
                      <Button
                        type="button" variant="secondary" size="sm" className="h-7 px-1.5 text-xs"
                        onClick={() => setQuantity(c.stockId, qty + 5, c.quantity)}
                        disabled={qty >= c.quantity}
                      >
                        +5
                      </Button>
                    )}
                    {c.quantity > 10 && (
                      <Button
                        type="button" variant="secondary" size="sm" className="h-7 px-1.5 text-xs"
                        onClick={() => setQuantity(c.stockId, qty + 10, c.quantity)}
                        disabled={qty >= c.quantity}
                      >
                        +10
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg bg-muted/40 p-3 flex items-start gap-2.5">
        <Info className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
          &quot;한도까지&quot; 수량은 현재 선택된 다른 종목의 손익까지 반영해 계산됩니다. 참고용 추정치이며 실제 세액은 세무 전문가 확인이 필요합니다.
        </p>
      </div>
    </div>
  );
}
