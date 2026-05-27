"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAndStoreClassifications } from "@/lib/xray/fetch-classifications";
import { Microscope, Copy, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAssetData } from "@/contexts/asset-data-context";
import { InlineSelector } from "../../../layout/ui/inline-selector";
import { computeBreakdown, type XrayAxis, type BreakdownResult } from "@/lib/xray/stock-xray";
import { formatShortCurrency } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE } from "@/config/theme";
import { buildStockXrayPrompt } from "@/lib/xray/stock-xray-prompt";

const AXIS_OPTIONS = [
  { value: "theme"     as XrayAxis, label: "🎯 핵심 분야" },
  { value: "marketCap" as XrayAxis, label: "📊 시가총액" },
  { value: "index"     as XrayAxis, label: "📈 지수" },
  { value: "region"    as XrayAxis, label: "🌏 지역" },
  { value: "currency"  as XrayAxis, label: "💱 통화" },
];

const CONCENTRATION_LABEL: Record<BreakdownResult["concentration"], { label: string; color: string }> = {
  high:   { label: "집중도 높음", color: "text-amber-600" },
  medium: { label: "집중도 보통", color: "text-foreground" },
  low:    { label: "분산", color: "text-emerald-600" },
};

function BreakdownVisual({ result }: { result: BreakdownResult }) {
  if (result.total === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">집계 가능한 종목이 없습니다.</p>;
  }
  return (
    <div className="space-y-3">
      {result.items.map((item, idx) => {
        const pct = Math.round(item.ratio * 1000) / 10;
        const barPct = Math.min(100, Math.max(pct, 1));
        const color = MAIN_PALETTE[idx % MAIN_PALETTE.length];
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
            {item.contributions.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {item.contributions.map((c) => (
                  <span
                    key={c.ticker}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-muted/40 text-muted-foreground tabular-nums"
                    title={`${c.name} · ${formatShortCurrency(Math.round(c.value))}`}
                  >
                    {c.ticker}
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
  const [, forceRender] = useState(0);

  // X-Ray 페이지 진입 시 분류 fetch (캐시 hit이면 no-op)
  useEffect(() => {
    let mounted = true;
    fetchAndStoreClassifications(assetData.stocks).then(() => {
      if (mounted) forceRender((v) => v + 1); // localStorage 갱신 반영 위해 리렌더
    });
    return () => {
      mounted = false;
    };
  }, [assetData.stocks]);

  const result = useMemo(
    () => computeBreakdown(axis, assetData.stocks, exchangeRates),
    [axis, assetData.stocks, exchangeRates],
  );

  const isExposure = result.mode === "exposure";
  const incomplete = (axis === "theme" || axis === "marketCap" || axis === "index") && result.unclassifiedRatio > 0;
  const conc = CONCENTRATION_LABEL[result.concentration];

  const handleCopyPrompt = async () => {
    try {
      const prompt = buildStockXrayPrompt(assetData.stocks, exchangeRates, [
        computeBreakdown("theme",     assetData.stocks, exchangeRates),
        computeBreakdown("marketCap", assetData.stocks, exchangeRates),
        computeBreakdown("index",     assetData.stocks, exchangeRates),
        computeBreakdown("region",    assetData.stocks, exchangeRates),
        computeBreakdown("currency",  assetData.stocks, exchangeRates),
      ]);
      await navigator.clipboard.writeText(prompt);
      toast.success("주식 X-Ray 진단 프롬프트가 복사되었습니다.");
    } catch {
      toast.error("복사에 실패했습니다.");
    }
  };

  const goFullDiagnosis = () => {
    // 도구 메뉴 페이지로 이동 → 사용자가 "AI 평가용 자산 현황" 진입 가능
    // (직접 다이얼로그를 오픈하는 이벤트는 도입하지 않음 — 단순 백링크)
    if (typeof window !== "undefined") {
      window.location.hash = "more";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Microscope className="size-5 text-primary" />
          주식 X-Ray
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 축 선택 */}
        <div className="flex justify-start">
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
              {isExposure ? "노출 비중 (중복 포함)" : "분포 분석"}
            </span>
            {result.total > 0 && (
              <span className={`text-xs font-medium ${conc.color}`}>{conc.label}</span>
            )}
          </div>
          {incomplete && result.items.length <= 1 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              분류 데이터를 준비 중입니다.
            </p>
          ) : (
            <BreakdownVisual result={result} />
          )}
          {incomplete && result.items.length > 1 && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              ⓘ 미분류 종목 {Math.round(result.unclassifiedRatio * 100)}%는 외부 분류 데이터 수집 후 갱신됩니다.
            </p>
          )}
          {isExposure && result.total > 0 && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              ⓘ 한 종목이 여러 항목에 동시 노출될 수 있어 합이 100%를 초과할 수 있습니다.
            </p>
          )}
        </div>

        {/* AI 진단 프롬프트 복사 — 주식 한정 */}
        <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold">📋 AI 진단 프롬프트</p>
            <p className="text-xs text-muted-foreground mt-1">
              주식 분포를 바탕으로 현재 상태를 진단하는 프롬프트입니다. (투자 추천 ❌, 현재 진단 ✓)
            </p>
          </div>
          <Button
            onClick={handleCopyPrompt}
            disabled={assetData.stocks.length === 0}
            style={{ backgroundColor: MAIN_PALETTE[0] }}
            className="text-white hover:opacity-90 border-none w-full"
          >
            <Copy className="mr-2 size-4" />
            주식 X-Ray 프롬프트 복사
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

        {/* 안내 */}
        <p className={`text-[11px] ${ASSET_THEME.text.muted} text-center pt-2`}>
          이 분석은 투자 추천이 아닌 현재 자산 상태 진단입니다.
        </p>
      </CardContent>
    </Card>
  );
}
