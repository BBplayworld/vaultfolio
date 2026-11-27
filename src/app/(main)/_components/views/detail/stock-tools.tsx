"use client";

// 상세·주식 '내 주식 도구' 타일 묶음(4.83 T-A) — 요약 박스 바로 아래. X-Ray 분석 / 내 자산 점검(#245), 2개면 한 줄 2칸.
// 5.170 #341: 시장과 비교·해외주식 세금 타일 제거(같은 목적지 입구 유지 — 홈 지수 줄·자산 변화 시장 타일 / 허브 세금 관리 행·홈 세금 팁). 내 자산 점검 값은 StockTab이 만든 주식 행(buildBoardRows 1회)을 받는다.
// 옛 요약 안 시장 글줄·X-Ray 상자·세금 문장 상자를 대체한다. 타일마다 그 기능의 숫자 1개를 미리 보인다(금액·투자 판단 없음).
// useXrayClassifications(분류 수집·완료 토스트)는 이 묶음이 계속 호출한다 — 타일이 안 보여도 호출은 유지(StockInsightStrip에서 이전).
// 인증카드 캡처에는 나오지 않는다(data-screenshot-hide, StockTab은 screenshotMode 렌더 안 함). 저장 호출 0.
import { useMemo } from "react";
import { ListChecks, Microscope } from "lucide-react";
import type { Stock } from "@/types/asset";
import type { ExchangeRates } from "@/lib/finance/finance-service";
import { pickXrayTile } from "@/lib/xray/stock-xray";
import { useXrayClassifications } from "@/lib/xray/use-xray-classifications";
import { useXrayViewStore } from "@/stores/xray-view-store";
import type { GrowTileValue } from "@/lib/asset/grow-decision";
import { track } from "@/lib/analytics/ga";
import { isPreviewEnv } from "@/lib/cloud-sync/config";
import { groupStocksByTicker, mergeStockGroup } from "./asset-detail-tabs";
import { useAssetNavigation } from "../../layout/navigation/navigation-context";
import { ToolTile } from "../../layout/ui/tool-tile";
import { DOT_WRAP_FIRST, DOT_WRAP_ROW, DotLead } from "../../layout/ui/dot-wrap";
import { DUE_TEXT } from "../activity/grow-due-entry";
import { aimGrowStockView } from "../activity/report-tab";

const NUM = "font-semibold text-foreground";

/** `내 자산 점검` 타일 값 줄(#245) — 조각은 grow-decision.growTileValueOf의 parts와 글자가 같다. 줄은 가운뎃점 자리에서만 바뀌고 줄 끝에 가운뎃점이 남지 않는다 */
export function GrowTileValueLine({ value }: { value: GrowTileValue | "pending" }) {
  // 이름표를 읽기 전 — 값 줄만 비운다(타일 높이 불변)
  if (value === "pending") return <span data-testid="stock-tool-grow-value" data-kind="pending" aria-hidden className="block">{"\u00a0"}</span>;
  // 조각은 한 줄로 묶되, 360 미만 반 칸(5.170 한 줄 2칸)에서 조각 하나가 칸보다 길면 그 조각 안 어절에서만 꺾는다(넘침 0, break-keep·text-pretty).
  // 둘째 조각은 조각 안에서 접히므로 inset 규약(DotLead inset + ml-2) — 접힌 줄이 clip 가장자리에서 시작해 잘림 0
  const piece = "whitespace-nowrap max-[360px]:whitespace-normal max-[360px]:text-pretty";
  return (
    <span
      data-testid="stock-tool-grow-value"
      data-kind={value.kind}
      data-due={value.due}
      data-keep={value.keep}
      data-check={value.check}
      data-count={value.count}
      className={`flex flex-wrap gap-x-1 tabular-nums ${DOT_WRAP_ROW}`}
    >
      {value.kind === "due" ? (
        <span className={`${piece} ${DOT_WRAP_FIRST}`}>주식 점검 차례 <span className={DUE_TEXT}>{value.due}종목</span></span>
      ) : value.kind === "labeled" ? (
        <>
          <span className={`${piece} ${DOT_WRAP_FIRST}`}>주식 장기 보유 <span className={NUM}>{value.keep}</span></span>
          <span className={`${piece} ml-2`}><DotLead inset />점검 대상 <span className={NUM}>{value.check}</span></span>
        </>
      ) : (
        <>
          <span className={`${piece} ${DOT_WRAP_FIRST}`}>장기 보유</span>
          <span className={`${piece} ml-2`}><DotLead inset />점검 대상 정하기 전</span>
        </>
      )}
    </span>
  );
}

// grow = 내 자산 점검 타일 값(주식 행 기준). undefined = 주식 보기에 행이 없음(타일 없음), "pending" = 이름표 읽기 전
export function StockToolTiles({ stocks, exchangeRates, grow }: { stocks: Stock[]; exchangeRates?: ExchangeRates; grow?: GrowTileValue | "pending" }) {
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

  const showGrow = grow !== undefined;
  // 격자: 2열 한 줄(320 포함 — 점검 값은 가운뎃점 자리에서만 꺾인다, C152). X-Ray 1개면 전체 폭
  return (
    <div
      data-testid="stock-tools"
      role="group"
      aria-label="내 주식 도구"
      data-screenshot-hide
      className={`grid ${showGrow ? "grid-cols-2" : "grid-cols-1"} gap-2`}
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
      {showGrow && (
        <ToolTile
          icon={ListChecks}
          name="내 자산 점검"
          testId="stock-tool-grow"
          onClick={() => {
            if (!isPreviewEnv()) track("feature_use", { category: "stock_check_tile" });
            aimGrowStockView(); // 내 자산 점검 칸 › 주식 보기(코인 차례가 있어도 주식 보기). 종목 지정 없음
            navigate({ type: "activity", tab: "report" });
          }}
        >
          <GrowTileValueLine value={grow} />
        </ToolTile>
      )}
    </div>
  );
}
