/**
 * X-Ray 분류 API 호출 + 클라이언트 캐시 머지
 *
 * - 클라 캐시(localStorage)에 이미 있는 ticker는 fetch 대상에서 제외 (1차 hit)
 * - 미스만 모아 1회 호출 → 서버가 추가로 90일 캐시 hit/miss 처리
 * - 모듈 단위 dedup: 동시 호출 방지
 */

import type { Stock } from "@/types/asset";
import { getAllClassifications, upsertClassifications } from "./classification-store";

let inflight: Promise<void> | null = null;

function deriveMarket(stock: Stock): string | undefined {
  if (stock.category === "domestic" || stock.category === "irp" || stock.category === "isa" || stock.category === "pension") {
    return "KRX"; // 코스피·코스닥 세부 구분은 분류 정확도에 큰 영향 없음
  }
  if (stock.category === "foreign") {
    if (stock.currency === "JPY") return "TSE";
    return "US"; // NASDAQ/NYSE/AMEX 등 통합 힌트
  }
  return undefined;
}

export async function fetchAndStoreClassifications(stocks: Stock[]): Promise<void> {
  if (typeof window === "undefined") return;
  if (inflight) return inflight;

  const existing = getAllClassifications();
  const items = stocks
    .filter((s) => s.ticker && s.ticker.trim())
    .filter((s) => {
      // themes가 채워져 있으면 수집 완료 — Gemini 호출 생략
      const cur = existing[s.ticker!.trim().toUpperCase()];
      return !cur || !Array.isArray(cur.themes) || cur.themes.length === 0;
    })
    .map((s) => ({
      ticker: s.ticker!.trim().toUpperCase(),
      name: s.name,
      market: deriveMarket(s),
      category: s.category,
    }));

  if (items.length === 0) return;

  inflight = (async () => {
    try {
      const res = await fetch("/api/xray-classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn("[xray-classify 실패]", res.status, text.slice(0, 200));
        return;
      }
      const json = (await res.json()) as { classifications?: Record<string, Parameters<typeof upsertClassifications>[0][string]> };
      if (json.classifications) {
        upsertClassifications(json.classifications);
      }
    } catch (e) {
      console.warn("[xray-classify 호출 오류]", e);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
