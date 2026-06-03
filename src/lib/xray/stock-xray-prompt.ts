/**
 * 주식 X-Ray AI 진단 프롬프트
 *
 * - 외부 AI(Grok·Gemini·GPT)에 붙여넣는 텍스트 생성
 * - 주식 한정 컨텍스트 + 분포 데이터 + 가드(투자 추천 금지) 포함
 * - 기존 lib/ai-prompts.ts와 별개 파일 — X-Ray 도메인에 종속된 프롬프트는 xray 패키지에 보관
 */

import { Stock } from "@/types/asset";
import { ExchangeRates } from "@/lib/finance-service";
import { formatShortCurrency } from "@/lib/number-utils";
import type { BreakdownResult } from "./stock-xray";

const AXIS_TITLE: Record<BreakdownResult["axis"], string> = {
  region: "지역",
  currency: "통화",
  theme: "핵심 분야",
  marketCap: "시가총액",
  index: "지수",
};

function getMultiplier(currency: string | undefined, rates: ExchangeRates | undefined): number {
  if (!rates) return 1;
  if (currency === "USD") return rates.USD;
  if (currency === "JPY") return rates.JPY / 100;
  return 1;
}

function summarizeAxis(result: BreakdownResult): string {
  if (result.total === 0) return `[${AXIS_TITLE[result.axis]}] 집계 가능 종목 없음`;
  const head = result.items
    .slice(0, 6)
    .map((it) => `${it.label} ${(it.ratio * 100).toFixed(1)}% (${formatShortCurrency(Math.round(it.value))})`)
    .join(" / ");
  const tail = result.items.length > 6 ? ` 외 ${result.items.length - 6}건` : "";
  return `[${AXIS_TITLE[result.axis]}] ${head}${tail}`;
}

export function buildStockXrayPrompt(
  stocks: Stock[],
  exchangeRates: ExchangeRates | undefined,
  breakdowns: BreakdownResult[],
): string {
  const totalValue = stocks.reduce((sum, s) => {
    if (s.inactiveStatus === "delisted") return sum;
    return sum + s.quantity * s.currentPrice * getMultiplier(s.currency, exchangeRates);
  }, 0);

  const lines: string[] = [];
  lines.push("# 주식 X-Ray 진단 요청");
  lines.push("");
  lines.push("## 가드레일 (반드시 준수)");
  lines.push("- 투자 추천 금지: 매수·매도 권유, 종목 추천, 미래 가격 예측을 하지 마세요.");
  lines.push("- 현재 상태 진단만: 분포 비중, 집중도, 노출 위험을 객관적으로 설명하세요.");
  lines.push("- 표현 예시: \"OO 비중이 X%입니다\", \"OO에 Y% 노출되어 있습니다\" (O), \"OO를 사세요/파세요\" (X)");
  lines.push("- 모든 축은 한 종목을 단일 항목에만 배정해 집계합니다(중복 없음, 합 ≈ 100%).");
  lines.push("");
  lines.push("## 주식 포트폴리오 요약");
  lines.push(`- 총 평가금액(원화): ${formatShortCurrency(Math.round(totalValue))}`);
  lines.push(`- 종목 수: ${stocks.filter((s) => s.inactiveStatus !== "delisted").length}개`);
  lines.push("");
  lines.push("## 축별 분포");
  for (const br of breakdowns) {
    lines.push(`- ${summarizeAxis(br)}`);
    if (br.unclassifiedRatio > 0) {
      lines.push(`  · 미분류 비중: ${(br.unclassifiedRatio * 100).toFixed(1)}% (외부 데이터 미수집)`);
    }
  }
  lines.push("");
  lines.push("## 요청 사항");
  lines.push("1. 위 분포에서 가장 주목해야 할 집중·편중 포인트 1~2개를 짚어 주세요.");
  lines.push("2. 각 포인트의 위험 성격(예: 단일 통화 노출, 단일 섹터 집중 등)을 진단해 주세요.");
  lines.push("3. 분산이 잘 된 영역이 있다면 함께 언급해 주세요.");
  lines.push("4. 결과는 한국어로, 3~5문장 이내로 간결하게 작성해 주세요.");
  return lines.join("\n");
}
