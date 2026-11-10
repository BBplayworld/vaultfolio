// 기간 수익 기준가 조회의 요청 순서 정리(#137·#138, 4.72 D1·D2) — 저장 호출 0.
// D1: 자산 변화 › 주식에서 기간을 빠르게 바꾸면 이전 기간 응답이 늦게 도착해 화면을 덮던 문제 → 마지막 요청만 반영.
// D2: 시작 시세 동기화·리셋이 상세·주식 칩 쿼리를 취소만 하고 다시 부르지 않던 문제 → 취소 뒤 활성 쿼리 재조회.
import type { QueryClient } from "@tanstack/react-query";

// 조회 1종(예: 선택 기간 ref, 일별 daily)의 진행 상태. 컴포넌트 useRef에 1개씩 둔다
export interface FetchSlot {
  inFlightKey: string | null; // 진행 중인 요청 key(같은 key 재실행은 진행 보존)
  latestKey: string | null; // 가장 마지막으로 시작한 요청 key — 응답은 이 key일 때만 반영
  controller: AbortController | null;
}

export function createFetchSlot(): FetchSlot {
  return { inFlightKey: null, latestKey: null, controller: null };
}

export interface LatestFetch {
  controller: AbortController;
  // 응답·진행 콜백 직전에 확인 — 더 새 요청이 시작됐거나 취소됐으면 false(버림)
  isCurrent: () => boolean;
  // 요청 종료(성공·실패·취소) 때 호출 — 자기 key·controller일 때만 슬롯을 비운다
  done: () => void;
}

// 같은 key가 진행 중이면 null(의존성이 잠시 흔들려도 진행 보존 — 기존 의도 유지).
// 다른 key면 이전 요청을 abort하고 새 요청을 시작한다.
export function beginLatestFetch(slot: FetchSlot, key: string): LatestFetch | null {
  if (slot.inFlightKey === key) return null;
  slot.controller?.abort();
  const controller = new AbortController();
  slot.inFlightKey = key;
  slot.latestKey = key;
  slot.controller = controller;
  return {
    controller,
    isCurrent: () => slot.latestKey === key && !controller.signal.aborted,
    done: () => {
      if (slot.inFlightKey === key) slot.inFlightKey = null;
      if (slot.controller === controller) slot.controller = null;
    },
  };
}

// 데이터 삭제·불러오기 등 리셋 — 진행 중 요청 abort, 늦게 오는 응답도 버린다
export function resetFetchSlot(slot: FetchSlot): void {
  slot.controller?.abort();
  slot.inFlightKey = null;
  slot.latestKey = null;
  slot.controller = null;
}

// 진행 중인 기준가 쿼리를 취소한 뒤, 화면에 붙어 있는 쿼리만 다시 부른다(취소만 하면 pending으로 남아 칩이 다시 열 때까지 없음)
export async function cancelThenRefetchProfit(queryClient: QueryClient): Promise<void> {
  await queryClient.cancelQueries({ queryKey: ["profit"] });
  await queryClient.invalidateQueries({ queryKey: ["profit"], refetchType: "active" });
}
