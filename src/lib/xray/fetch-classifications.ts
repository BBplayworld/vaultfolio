/**
 * X-Ray 분류 API 호출 + 클라이언트 캐시 머지
 *
 * - 클라 캐시(localStorage)에 이미 있는 ticker는 fetch 대상에서 제외 (1차 hit)
 * - 미스만 모아 1회 호출 → 서버가 추가로 90일 캐시 hit/miss 처리
 * - 모듈 단위 dedup: 동시 호출 방지
 */

import type { Stock } from "@/types/asset";
import { toast } from "sonner";
import { getAllClassifications, upsertClassifications } from "./classification-store";

export interface ClassifyProgress {
  done: number;
  total: number;
}

let inflight: Promise<void> | null = null;
// 진행률 브로드캐스트 — 재마운트·재렌더로 콜백이 교체돼도 진행 표시가 끊기지 않도록 모듈 단위로 관리
let lastProgress: ClassifyProgress | null = null;
const progressListeners = new Set<(p: ClassifyProgress) => void>();
function emitProgress(p: ClassifyProgress) {
  lastProgress = p;
  for (const l of progressListeners) l(p);
}

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

export async function fetchAndStoreClassifications(
  stocks: Stock[],
  onProgress?: (p: ClassifyProgress) => void,
): Promise<void> {
  if (typeof window === "undefined") return;

  const existing = getAllClassifications();
  const items = stocks
    .filter((s) => s.ticker && s.ticker.trim())
    .filter((s) => {
      // themes·indices 둘 다 있어야 수집 완료 — 하나라도 비면 재분류 대상(ETF 지수 보강 트리거)
      const cur = existing[s.ticker!.trim().toUpperCase()];
      const hasThemes = !!cur && Array.isArray(cur.themes) && cur.themes.length > 0;
      const hasIndices = !!cur && Array.isArray(cur.indices) && cur.indices.length > 0;
      return !hasThemes || !hasIndices;
    })
    .map((s) => ({
      ticker: s.ticker!.trim().toUpperCase(),
      name: s.name,
      market: deriveMarket(s),
      category: s.category,
    }));

  if (items.length === 0) return;

  // 진행률 리스너 등록 — inflight 중 재마운트돼도 현재 진행률을 즉시 받도록 마지막 값 재생
  if (onProgress) {
    progressListeners.add(onProgress);
    if (lastProgress) onProgress(lastProgress);
  }
  if (inflight) return inflight;

  const totalItems = items.length;

  inflight = (async () => {
    // 스트리밍 중에는 store에 즉시 반영하지 않고 버퍼에 모아 완료 시 1회 반영 → 결과 점진 노출 방지
    const buffered: Record<string, Parameters<typeof upsertClassifications>[0][string]> = {};
    try {
      const res = await fetch("/api/xray-classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn("[xray-classify 실패]", res.status, text.slice(0, 200));
        toast.warning("X-Ray 분류에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }

      const contentType = res.headers.get("content-type") ?? "";

      // 스트리밍(NDJSON): 배치마다 진행률 수신 (결과는 버퍼에만 누적)
      if (contentType.includes("application/x-ndjson") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const handleLine = (line: string) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          let evt: {
            type?: string;
            done?: number;
            total?: number;
            classifications?: Record<string, Parameters<typeof upsertClassifications>[0][string]>;
            meta?: { partialFailedCount?: number };
            error?: string;
          };
          try {
            evt = JSON.parse(trimmed);
          } catch {
            return; // 불완전/손상 라인 무시
          }
          if (evt.classifications) Object.assign(buffered, evt.classifications);
          if (evt.type === "meta" || evt.type === "chunk") {
            emitProgress({ done: evt.done ?? 0, total: evt.total ?? totalItems });
          } else if (evt.type === "done") {
            const partialFailed = evt.meta?.partialFailedCount ?? 0;
            if (partialFailed > 0) {
              toast.warning(`일부 종목(${partialFailed}개) 분류에 실패했습니다. 잠시 후 다시 시도해주세요.`);
            }
          } else if (evt.type === "error") {
            toast.warning(evt.error || "X-Ray 분류 중 오류가 발생했습니다.");
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            handleLine(buffer.slice(0, nl));
            buffer = buffer.slice(nl + 1);
          }
        }
        handleLine(buffer); // 마지막 라인 flush
      } else {
        // 빠른 경로(JSON): 전체 캐시 hit / 빈 입력 등
        const json = (await res.json()) as {
          classifications?: Record<string, Parameters<typeof upsertClassifications>[0][string]>;
          meta?: { partialFailedCount?: number };
        };
        if (json.classifications) Object.assign(buffered, json.classifications);
        const partialFailed = json.meta?.partialFailedCount ?? 0;
        if (partialFailed > 0) {
          toast.warning(`일부 종목(${partialFailed}개) 분류에 실패했습니다. 잠시 후 다시 시도해주세요.`);
        }
      }

      // 완료 시 1회 반영 + 100% 진행률
      if (Object.keys(buffered).length > 0) {
        upsertClassifications(buffered);
        toast.success("주식 X-Ray 분류가 완료되었습니다.");
      }
      emitProgress({ done: totalItems, total: totalItems });
    } catch (e) {
      console.warn("[xray-classify 호출 오류]", e);
    } finally {
      inflight = null;
      lastProgress = null;
      progressListeners.clear();
    }
  })();
  return inflight;
}
