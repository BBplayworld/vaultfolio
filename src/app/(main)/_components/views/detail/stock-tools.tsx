"use client";

// 상세·주식 '내 주식 도구' 타일 묶음(4.83 T-A) — 요약 박스 바로 아래. X-Ray 분석 1개(전체 폭).
// 5.170 #341: 시장과 비교·해외주식 세금 타일 제거(같은 목적지 입구 유지 — 홈 지수 줄·자산 변화 시장 타일 / 허브 세금 관리 행·홈 세금 팁).
// 5.171 #343: 내 자산 점검 타일 제거(입구 유지 — 성과 허브 자산 성적표 카드·홈 점검 차례 팁·차례 행 펼침·종목 한 장 머리).
// 옛 요약 안 시장 글줄·X-Ray 상자·세금 문장 상자를 대체한다. 타일마다 그 기능의 숫자 1개를 미리 보인다(금액·투자 판단 없음).
// useXrayClassifications(분류 수집·완료 토스트)는 이 묶음이 계속 호출한다 — 타일이 안 보여도 호출은 유지(StockInsightStrip에서 이전).
// 인증카드 캡처에는 나오지 않는다(data-screenshot-hide, StockTab은 screenshotMode 렌더 안 함). 저장 호출 0.
import { useMemo } from "react";
import { Microscope } from "lucide-react";
import type { Stock } from "@/types/asset";
import type { ExchangeRates } from "@/lib/finance/finance-service";
import { pickXrayTile } from "@/lib/xray/stock-xray";
import { useXrayClassifications } from "@/lib/xray/use-xray-classifications";
import { useXrayViewStore } from "@/stores/xray-view-store";
import { groupStocksByTicker, mergeStockGroup } from "./asset-detail-tabs";
import { useAssetNavigation } from "../../layout/navigation/navigation-context";
import { ToolTile } from "../../layout/ui/tool-tile";

export function StockToolTiles({ stocks, exchangeRates }: { stocks: Stock[]; exchangeRates?: ExchangeRates }) {
  const { navigate } = useAssetNavigation();
  // 주식 목록이 바뀌면 분류 미수집 ticker만 모아 백그라운드 fetch(공용 훅, 완료 토스트 포함) — 주식 0건이면 [] 전달(no-op)
  const { tick, progress } = useXrayClassifications(stocks);

  // 증권사별 분리 항목을 ticker 단위로 병합 — X-Ray 페이지와 같은 병합이라 같은 비중 값
  const xray = useMemo(() => {
    const merged = Array.from(groupStocksByTicker(stocks).values()).map((g) => mergeStockGroup(g));
    // 분류 수집 중에는 비분류 축의 중간 값이 보이지 않게 폴백 문구(spec 8절)
    return progress ? null : pickXrayTile(merged, exchangeRates);
    // tick 의존성으로 localStorage 분류 갱신 반영
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stocks, exchangeRates, tick, progress]);

  if (stocks.length === 0) return null;

  // 5.171 #343: X-Ray 1개 — 전체 폭(요약 카드와 좌우 끝 맞춤)
  return (
    <div
      data-testid="stock-tools"
      role="group"
      aria-label="내 주식 도구"
      data-screenshot-hide
      className="grid grid-cols-1 gap-2"
    >
      <ToolTile
        icon={Microscope}
        name="X-Ray 분석"
        testId="stock-tool-xray"
        onClick={() => {
          if (xray) useXrayViewStore.getState().setInitialAxis(xray.axis); // 타일 값의 축으로 열린다(1회 소비)
          navigate({ type: "detail", tab: "stocks-xray" });
        }}
      >
        <span data-testid="stock-tool-xray-value" className="flex w-full min-w-0">
          {xray ? (
            <>
              <span className="truncate">{xray.itemLabel}</span>
              <span className="ml-1 shrink-0 font-semibold tabular-nums text-foreground">{xray.pct}%</span>
            </>
          ) : "분야·지역 비중 보기"}
        </span>
      </ToolTile>
    </div>
  );
}
