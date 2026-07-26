import { describe, it, expect, afterEach, vi } from "vitest";
import { getStockCacheSlot } from "../stock-cache-slot";

// 회귀 테스트: 휴장일(주말)엔 slot이 날마다 바뀌지 않고 직전 영업일로 고정돼야 한다.
// 예전엔 effectiveDate(달력 날짜)를 그대로 반환해 주말 내내 매일 slot이 바뀌었고,
// 그 결과 syncTodayStockPrices가 휴장 중에도 매일 실시간 시세를 재조회해
// (실측 종가는 그대로인데 quote만 미세하게 흔들려) 원인분해에 "휴장일 시세 변동"이 허위로 잡혔다.
// 2026-07-24(금)·25(토)·26(일)·27(월) 실제 요일 기준.

const setKst = (isoUtc: string) => {
  // Date.now()+9h = nowKST 이므로, isoUtc는 "원하는 KST 시각 - 9h"로 지정
  vi.useFakeTimers();
  vi.setSystemTime(new Date(isoUtc));
};

afterEach(() => {
  vi.useRealTimers();
});

describe("getStockCacheSlot — 휴장일 slot 고정", () => {
  it("토요일엔 domestic·foreign 모두 직전 영업일(금요일)로 고정된다", () => {
    // KST 2026-07-25(토) 21:00 = UTC 2026-07-25 12:00
    setKst("2026-07-25T12:00:00.000Z");
    expect(getStockCacheSlot("domestic")).toBe("2026-07-24");
    expect(getStockCacheSlot("foreign")).toBe("2026-07-24");
  });

  it("일요일에도 slot이 그대로 유지된다(토요일과 동일, 날짜가 바뀌지 않음)", () => {
    // KST 2026-07-26(일) 21:00 = UTC 2026-07-26 12:00
    setKst("2026-07-26T12:00:00.000Z");
    expect(getStockCacheSlot("domestic")).toBe("2026-07-24");
    expect(getStockCacheSlot("foreign")).toBe("2026-07-24");
  });

  it("영업일 장중엔 기존대로 1시간 슬롯을 반환한다(회귀 없음)", () => {
    // KST 2026-07-27(월) 10:00 = UTC 2026-07-27 01:00 — domestic 장중(09~20시)
    setKst("2026-07-27T01:00:00.000Z");
    const slot = getStockCacheSlot("domestic");
    expect(slot).toMatch(/^\d{4}-\d{2}-\d{2}-H\d{2}$/);
  });
});
