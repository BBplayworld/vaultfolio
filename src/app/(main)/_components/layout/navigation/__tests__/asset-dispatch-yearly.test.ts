import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  consumeYearlyNetAssetOpenRequest,
  dispatchOpenYearlyNetAsset,
  YEARLY_NET_ASSET_OPEN_TTL_MS,
} from "../asset-dispatch";

describe("과거 순자산 열기 요청(1회성)", () => {
  beforeEach(() => {
    // node 환경 — window를 EventTarget으로 대체(CustomEvent는 Node 내장)
    vi.stubGlobal("window", new EventTarget());
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-08T00:00:00Z"));
    consumeYearlyNetAssetOpenRequest(); // 이전 요청 비우기
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("요청이 없으면 열림 0", () => {
    expect(consumeYearlyNetAssetOpenRequest()).toBe(false);
  });

  it("마운트가 늦어도 유효시간 안이면 1회 열림, 이후 소멸", () => {
    dispatchOpenYearlyNetAsset();
    vi.advanceTimersByTime(YEARLY_NET_ASSET_OPEN_TTL_MS - 1);
    expect(consumeYearlyNetAssetOpenRequest()).toBe(true);
    expect(consumeYearlyNetAssetOpenRequest()).toBe(false);
  });

  it("유효시간이 지난 뒤 마운트하면 열림 0(요청 폐기)", () => {
    dispatchOpenYearlyNetAsset();
    vi.advanceTimersByTime(YEARLY_NET_ASSET_OPEN_TTL_MS + 1);
    expect(consumeYearlyNetAssetOpenRequest()).toBe(false);
    expect(consumeYearlyNetAssetOpenRequest()).toBe(false);
  });

  it("이벤트 수신으로 소비하면 마운트 소비는 열림 0(입력창 2개 불가)", () => {
    let opened = 0;
    const onTrigger = () => {
      if (consumeYearlyNetAssetOpenRequest()) opened++;
    };
    window.addEventListener("trigger-add-yearly-net-asset", onTrigger);
    dispatchOpenYearlyNetAsset();
    dispatchOpenYearlyNetAsset(); // 연타
    window.removeEventListener("trigger-add-yearly-net-asset", onTrigger);
    expect(opened).toBe(2); // 요청마다 1회씩(요청 1건당 1회 소비)
    expect(consumeYearlyNetAssetOpenRequest()).toBe(false);
  });

  it("연타 시 마운트 전이면 요청은 1건으로 합쳐져 1회만 열림", () => {
    dispatchOpenYearlyNetAsset();
    dispatchOpenYearlyNetAsset();
    expect(consumeYearlyNetAssetOpenRequest()).toBe(true);
    expect(consumeYearlyNetAssetOpenRequest()).toBe(false);
  });
});
