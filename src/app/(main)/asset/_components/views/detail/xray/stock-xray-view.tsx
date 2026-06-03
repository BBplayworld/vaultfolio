"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAndStoreClassifications } from "@/lib/xray/fetch-classifications";
import { Microscope, Copy, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAssetData } from "@/contexts/asset-data-context";
import { InlineSelector } from "../../../layout/ui/inline-selector";
import { InfoHint } from "../../../layout/ui/info-hint";
import { PromptPreviewDialog } from "../../../layout/ui/prompt-preview-dialog";
import { computeBreakdown, type XrayAxis, type BreakdownResult } from "@/lib/xray/stock-xray";
import { formatShortCurrency } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE } from "@/config/theme";
import { buildStockXrayPrompt } from "@/lib/xray/stock-xray-prompt";
import { groupStocksByTicker, mergeStockGroup, assignColors } from "../asset-detail-tabs";
import { truncateName } from "@/lib/utils";

const AXIS_OPTIONS = [
  { value: "theme" as XrayAxis, label: "🎯 핵심 분야" },
  { value: "marketCap" as XrayAxis, label: "📊 시가총액" },
  { value: "index" as XrayAxis, label: "📈 지수" },
  { value: "region" as XrayAxis, label: "🌏 지역" },
  { value: "currency" as XrayAxis, label: "💵 통화" },
];

const CONCENTRATION_LABEL: Record<BreakdownResult["concentration"], { label: string; color: string }> = {
  high: { label: "집중도 높음", color: "text-amber-600" },
  medium: { label: "집중도 보통", color: "text-foreground" },
  low: { label: "분산", color: "text-emerald-600" },
};

function ConcentrationInfo() {
  return (
    <InfoHint side="bottom">
      <p className="text-xs font-semibold text-foreground">집중도 기준</p>
      <p className="text-muted-foreground">상위 1개 항목의 비중을 기준으로 평가합니다.</p>
      <ul className="space-y-1 pt-1">
        <li><span className="text-amber-600 font-semibold">집중도 높음</span> <span className="text-muted-foreground">— 60% 이상. 단일 영역 의존도가 큼</span></li>
        <li><span className="text-foreground font-semibold">집중도 보통</span> <span className="text-muted-foreground">— 35~60%. 무난한 분산</span></li>
        <li><span className="text-emerald-600 font-semibold">분산</span> <span className="text-muted-foreground">— 35% 미만. 고르게 분산됨</span></li>
      </ul>
    </InfoHint>
  );
}

function BreakdownVisual({ result }: { result: BreakdownResult }) {
  if (result.total === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">집계 가능한 종목이 없습니다.</p>;
  }
  // stock-tab 비중바와 동일한 분배 규칙: 최대값=MAIN_PALETTE[0], 나머지=1~9 순환
  const colors = assignColors(result.items.map((it) => ({ value: it.value })));
  return (
    <div className="space-y-3">
      {result.items.map((item, idx) => {
        const pct = Math.round(item.ratio * 1000) / 10;
        const barPct = Math.min(100, Math.max(pct, 1));
        const color = colors[idx];
        return (
          <div key={item.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium truncate">{item.label}</span>
              <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                {formatShortCurrency(Math.round(item.value))} · {pct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${barPct}%`, backgroundColor: color }}
              />
            </div>
            {item.topThemes && item.topThemes.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {item.topThemes.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-medium"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
            {item.contributions.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {item.contributions.map((c, ci) => (
                  <span
                    key={`${c.ticker}-${ci}`}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-muted/40 text-muted-foreground tabular-nums"
                    title={`${c.name} · ${formatShortCurrency(Math.round(c.value))}`}
                  >
                    {truncateName(c.displayLabel, 15)}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function StockXrayView() {
  const { assetData, exchangeRates } = useAssetData();
  const [axis, setAxis] = useState<XrayAxis>("theme");
  const [tick, setTick] = useState(0);
  const [promptOpen, setPromptOpen] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // X-Ray 페이지 진입 시 분류 fetch (캐시 hit이면 no-op). 스트리밍 진행률로 % 표시
  useEffect(() => {
    let mounted = true;
    fetchAndStoreClassifications(assetData.stocks, (p) => {
      if (mounted) setProgress(p);
    }).then(() => {
      if (mounted) {
        setTick((v) => v + 1); // localStorage 갱신 반영 위해 useMemo 재계산 트리거
        setProgress(null);
      }
    });
    return () => {
      mounted = false;
    };
  }, [assetData.stocks]);

  const classifying = progress !== null && progress.total > 0 && progress.done < progress.total;
  const progressPct = classifying ? Math.round((progress!.done / progress!.total) * 100) : 0;

  // 증권사별로 나뉜 동일 ticker 항목을 1개로 병합 후 집계 (티커별 1회 노출 보장)
  const mergedStocks = useMemo(() => {
    const grouped = groupStocksByTicker(assetData.stocks);
    return Array.from(grouped.values()).map((g) => mergeStockGroup(g));
  }, [assetData.stocks]);

  const result = useMemo(
    () => computeBreakdown(axis, mergedStocks, exchangeRates),
    // tick: localStorage 분류 갱신 반영
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [axis, mergedStocks, exchangeRates, tick],
  );

  const incomplete = (axis === "theme" || axis === "marketCap" || axis === "index") && result.unclassifiedRatio > 0;
  const unclassPct = Math.round(result.unclassifiedRatio * 1000) / 10;
  const showWarning = unclassPct > 0;
  const conc = CONCENTRATION_LABEL[result.concentration];

  const buildXrayPromptText = () => buildStockXrayPrompt(mergedStocks, exchangeRates, [
    computeBreakdown("theme", mergedStocks, exchangeRates),
    computeBreakdown("marketCap", mergedStocks, exchangeRates),
    computeBreakdown("index", mergedStocks, exchangeRates),
    computeBreakdown("region", mergedStocks, exchangeRates),
    computeBreakdown("currency", mergedStocks, exchangeRates),
  ]);

  const goFullDiagnosis = () => {
    // 도구 메뉴 페이지로 이동 → 사용자가 "AI 평가용 자산 현황" 진입 가능
    // (직접 다이얼로그를 오픈하는 이벤트는 도입하지 않음 — 단순 백링크)
    if (typeof window !== "undefined") {
      window.location.hash = "more";
    }
  };

  return (
    // min-w-0 chain: 부모 flex item(Card·CardContent)이 자식 max-content에 끌려 grow하지 않도록 차단 → wrapper가 부모 폭에 고정되어 가로 스크롤 정상 작동
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Microscope className="size-5 text-primary" />
          주식 X-Ray
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 min-w-0">
        {/* 축 선택 */}
        {/*
          축 셀렉터 가로 스크롤:
          - block wrapper + max-w-full로 자식의 max-content가 wrapper를 넘지 못하게 폭 고정
          - flex가 아닌 block이어야 자식 inline-flex가 shrink되지 않고 max-content 유지 → overflow-x:auto 발동
          - [scrollbar-width:thin]: PC에서 마우스 드래그 가능한 가는 스크롤바 노출. 모바일은 자동 페이드
          - [touch-action:pan-x]: 모바일 가로 스와이프 명시 허용
        */}
        <div className="scrollbar-themed max-w-full overflow-x-auto whitespace-nowrap [touch-action:pan-x]">
          <InlineSelector
            value={axis}
            onChange={setAxis}
            options={AXIS_OPTIONS}
            ariaLabel="X-Ray 축 선택"
          />
        </div>

        {/* 분포 시각화 */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-muted-foreground tracking-wide">
              분포 분석
            </span>
            {result.total > 0 && (
              <span className="flex items-center gap-1">
                <ConcentrationInfo />
                <span className={`text-xs font-medium ${conc.color}`}>{conc.label}</span>
              </span>
            )}
          </div>
          {classifying ? (
            <div className="py-6 space-y-2">
              <Progress value={progressPct} />
              <p className="text-sm text-muted-foreground text-center tabular-nums">
                AI 분류 중… {progressPct}% · {progress!.done}/{progress!.total} 종목
              </p>
            </div>
          ) : incomplete && result.items.length <= 1 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              분류 데이터를 준비 중입니다.
            </p>
          ) : (
            <BreakdownVisual result={result} />
          )}
          {incomplete && showWarning && result.items.length > 1 && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              ⓘ 미분류 종목 {unclassPct}%는 외부 분류 데이터 수집 후 갱신됩니다.
            </p>
          )}
        </div>

        {/* AI 진단 프롬프트 복사 — 주식 한정 */}
        <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold">📋 AI 진단 프롬프트</p>
            <p className="text-xs text-muted-foreground mt-1">
              주식 분포를 바탕으로 현재 상태를 진단하는 프롬프트입니다.
            </p>
          </div>
          <Button
            onClick={() => setPromptOpen(true)}
            disabled={assetData.stocks.length === 0}
            style={{ backgroundColor: MAIN_PALETTE[0] }}
            className="text-white hover:opacity-90 border-none w-full"
          >
            <Copy className="mr-2 size-4" />
            주식 X-Ray 프롬프트 확인 · 복사
          </Button>
        </div>

        {/* 종합 진단 백링크 */}
        <button
          type="button"
          onClick={goFullDiagnosis}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors text-left"
        >
          <span className="text-xs text-muted-foreground">
            전체 자산 종합 진단이 필요하면 → 더보기 메뉴
          </span>
          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
        </button>
      </CardContent>
      <PromptPreviewDialog
        open={promptOpen}
        onOpenChange={setPromptOpen}
        title={<><Microscope className="size-5 text-primary" />주식 X-Ray 진단 프롬프트</>}
        description="아래 프롬프트를 확인 후 복사하여 Grok·Gemini·GPT 등 AI에게 주식 분포 진단을 요청하세요."
        tabs={[{ id: "xray", label: "주식 X-Ray", getPrompt: buildXrayPromptText }]}
        copySuccessMessage="주식 X-Ray 진단 프롬프트가 복사되었습니다."
      />
    </Card>
  );
}
