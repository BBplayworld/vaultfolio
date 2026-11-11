// 4.84 E — 공통 로딩 단계 타이밍(0~0.5초 조용 → 0.5초 문구 → 5초 지연 문구). 훅의 실제 타이머 함수를 fake timer로 검증(C83)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadingPhaseAt, NOTE_DELAY_MS, SLOW_DELAY_MS, startLoadingPhase, type LoadingPhase } from "../use-loading-phase";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("loadingPhaseAt 경계", () => {
  it.each([[0, "quiet"], [499, "quiet"], [500, "note"], [4999, "note"], [5000, "slow"], [60000, "slow"]] as [number, LoadingPhase][])("%i ms → %s", (ms, p) => {
    expect(loadingPhaseAt(ms)).toBe(p);
  });
});

describe("startLoadingPhase 타이머", () => {
  it("quiet → 0.5초 note → 5초 slow, 단계가 바뀔 때만 콜백", () => {
    const seen: LoadingPhase[] = [];
    startLoadingPhase((p) => seen.push(p));
    expect(seen).toEqual(["quiet"]);
    vi.advanceTimersByTime(NOTE_DELAY_MS - 1);
    expect(seen).toEqual(["quiet"]); // 300ms 안에 끝나는 응답은 문구를 한 번도 못 본다
    vi.advanceTimersByTime(1);
    expect(seen).toEqual(["quiet", "note"]);
    vi.advanceTimersByTime(SLOW_DELAY_MS - NOTE_DELAY_MS);
    expect(seen).toEqual(["quiet", "note", "slow"]);
  });
  it("취소하면 이후 단계가 오지 않고 대기 타이머가 남지 않는다(연타·재마운트 시 중복 0)", () => {
    const seen: LoadingPhase[] = [];
    const stop = startLoadingPhase((p) => seen.push(p));
    vi.advanceTimersByTime(200);
    stop();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(10000);
    expect(seen).toEqual(["quiet"]);
    // 다시 시작하면 quiet부터
    const again: LoadingPhase[] = [];
    startLoadingPhase((p) => again.push(p));
    expect(again).toEqual(["quiet"]);
    expect(vi.getTimerCount()).toBe(2);
  });
});
