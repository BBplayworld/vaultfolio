"use client";

// 세금 캘린더 (S-4.23) — 12개월 전체 신고·납부 일정.
// 홈 배너와 달리 전 국민 공통 항목까지 모두 담는다. "내 세금" 필터로 보유 자산 관련만 좁혀 본다.
// 일정 목록이므로 shadcn Calendar(날짜 선택기)가 아니라 월별 세로 리스트로 구성한다.

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Info, Receipt, TrendingUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InlineSelector } from "../../layout/ui/inline-selector";
import { useAssetData } from "@/contexts/asset-data-context";
import { ASSET_THEME } from "@/config/theme";
import { formatCurrency } from "@/lib/utils";
import { FOREIGN_CAPITAL_GAIN_DEDUCTION, TAX_TAG_LABEL, type TaxEvent } from "@/config/tax-calendar";
import {
  computeForeignRealizedGain,
  getEventsForMonth,
  resolveTaxTags,
  todayKst,
  type TaxTagReasons,
} from "@/lib/tax-utils";

type Filter = "mine" | "all";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function TaxCalendarView() {
  const { assetData, exchangeRates } = useAssetData();
  const [filter, setFilter] = useState<Filter>("mine");
  const currentMonthRef = useRef<HTMLElement | null>(null);

  const today = todayKst();
  const currentMonth = Number(today.slice(5, 7));
  const currentYear = Number(today.slice(0, 4));

  const tags = useMemo(() => resolveTaxTags(assetData), [assetData]);
  const realizedGain = useMemo(
    () => computeForeignRealizedGain(assetData, currentYear, exchangeRates),
    [assetData, currentYear, exchangeRates],
  );

  useEffect(() => {
    currentMonthRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Receipt className={`size-5 shrink-0 ${ASSET_THEME.important}`} />
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground">세금 일정</h2>
            <p className="text-sm text-muted-foreground">보유 자산에 맞춘 월별 신고·납부 안내</p>
          </div>
        </div>
        <InlineSelector<Filter>
          value={filter}
          onChange={setFilter}
          ariaLabel="세금 일정 필터"
          options={[
            { value: "mine", label: "내 세금" },
            { value: "all", label: "전체" },
          ]}
        />
      </div>

      {/* 해외주식 실현차익 — 이듬해 5월 양도세 신고 대상 여부 */}
      {realizedGain && (
        <div className="rounded-xl bg-amber-500/10 p-3.5 flex items-start gap-2.5">
          <TrendingUp className="size-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-bold text-foreground">
              {currentYear}년 해외주식 실현손익 {formatCurrency(Math.round(realizedGain.gainKrw))}
              {realizedGain.estimated && <span className="ml-1 text-xs font-medium text-muted-foreground">(추정)</span>}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
              {realizedGain.overDeduction ? (
                <>
                  기본공제 {formatCurrency(FOREIGN_CAPITAL_GAIN_DEDUCTION)}을 넘었습니다.{" "}
                  <strong className="text-foreground">{currentYear + 1}년 5월 양도소득세 확정신고 대상</strong>입니다.
                  연내에 손실 종목을 함께 실현하면 통산되어 과세 대상 금액이 줄어듭니다.
                </>
              ) : (
                <>
                  기본공제 {formatCurrency(FOREIGN_CAPITAL_GAIN_DEDUCTION)} 이내라 현재로선 신고 대상이 아닙니다.
                  연말까지의 추가 매도로 달라질 수 있습니다.
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground/80">
              반영된 매도 {realizedGain.sellCount}건 기준
              {realizedGain.estimated && " · 매수 기록·체결 환율이 없는 건은 현재 평단·환율로 추정"}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {MONTHS.map((month) => {
          const all = getEventsForMonth(month);
          const events = filter === "mine" ? all.filter((e) => e.tags.some((t) => tags.has(t))) : all;
          if (events.length === 0) return null;
          const isCurrent = month === currentMonth;

          return (
            <section key={month} ref={isCurrent ? currentMonthRef : undefined} className="scroll-mt-16">
              <div className="flex items-center gap-2 mb-2 px-1">
                <p className={`text-sm font-semibold ${isCurrent ? ASSET_THEME.primary.text : ASSET_THEME.text.muted}`}>
                  {month}월
                </p>
                {isCurrent && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">이번 달</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {events.map((event) => (
                  <TaxEventCard key={event.id} event={event} tags={tags} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* 면책 — 세법은 개정되고 개인별 요건이 달라 일반 안내 이상을 보장하지 않는다 */}
      <div className="rounded-lg bg-muted/40 p-3 flex items-start gap-2.5">
        <Info className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
          본 안내는 일반적인 일정 참고용이며 세법 개정·개인별 요건에 따라 달라질 수 있습니다.
          실제 신고·납부 여부와 세액은 국세청(홈택스) 또는 세무 전문가를 통해 확인하세요.
        </p>
      </div>
    </div>
  );
}

function TaxEventCard({ event, tags }: { event: TaxEvent; tags: TaxTagReasons }) {
  const [open, setOpen] = useState(false);
  const mine = event.tags.some((t) => t !== "common" && tags.has(t));

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={`rounded-xl bg-card shadow-xs ${mine ? "" : "opacity-60"}`}
    >
      <CollapsibleTrigger className="w-full text-left px-4 py-3.5 flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                event.severity === "high"
                  ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {event.dueLabel}
            </span>
            <p className="text-sm font-semibold text-foreground text-pretty">{event.title}</p>
          </div>
          <p className="text-xs text-muted-foreground">{event.who}</p>
          <p className="text-sm text-muted-foreground text-pretty">{event.summary}</p>
          <div className="flex flex-wrap gap-1 pt-0.5">
            {event.tags.map((t) => (
              <span
                key={t}
                className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  tags.has(t) && t !== "common"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {TAX_TAG_LABEL[t]}
              </span>
            ))}
            {event.upcoming && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                시행 예정
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={`size-4 shrink-0 mt-0.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed text-pretty">{event.detail}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}
