import { describe, it, expect, afterEach, vi } from "vitest";
import { getStockCacheSlot } from "../finance/stock-cache-slot";

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

// 버그 회귀: 해외 마감 컷오프(07:00 KST)가 개장(17:00/18:00 KST)보다 훨씬 일러,
// 07:00~개장 전 구간에서 "오늘" flat 라벨에 "어제 종가"가 캐싱되고, 이 라벨이 이후
// 휴장일 롤백 결과와 동일해져(둘 다 "금요일") 어제 종가로 교체돼야 할 캐시가
// 갱신되지 않는 문제가 있었다(2026-08-22(토) 18:20 접속 시 08-21 baseDate에
// 08-20 종가가 남아있던 실사용 사례로 발견).
describe("getStockCacheSlot — 해외 개장 전(pre-open) flat 라벨 회귀", () => {
  it("금요일 오전(개장 전)엔 목요일(직전 영업일) flat 라벨을 반환한다", () => {
    // KST 2026-08-21(금) 10:00 = UTC 2026-08-21 01:00 — foreign 개장(17:00) 전, 컷오프(07:00) 이후
    setKst("2026-08-21T01:00:00.000Z");
    expect(getStockCacheSlot("foreign")).toBe("2026-08-20");
  });

  it("금요일 오전 flat 라벨과 그 다음 토요일 flat 라벨이 서로 다르다(핵심 불변조건)", () => {
    setKst("2026-08-21T01:00:00.000Z"); // 금 10:00 KST
    const friMorning = getStockCacheSlot("foreign");
    setKst("2026-08-22T09:20:00.000Z"); // 토 18:20 KST
    const satEvening = getStockCacheSlot("foreign");
    expect(friMorning).toBe("2026-08-20");
    expect(satEvening).toBe("2026-08-21");
    expect(friMorning).not.toBe(satEvening);
  });

  it("금요일 세션 중(개장 후)엔 기존대로 금요일 날짜의 시간 슬롯을 반환한다(회귀 없음)", () => {
    // KST 2026-08-21(금) 20:00 = UTC 2026-08-21 11:00 — foreign 장중(17:00~익일05:00)
    setKst("2026-08-21T11:00:00.000Z");
    expect(getStockCacheSlot("foreign")).toBe("2026-08-21-H20");
  });

  it("평일 새벽 05:00~07:00(정규장 마감 후, 컷오프 전)엔 기존과 동일하게 전날로 유지된다(회귀 없음)", () => {
    // 2026-08-18(화)→19(수) — 둘 다 평일이라 휴장일 롤백이 아닌 isBusinessDay 분기를 그대로 탄다.
    // KST 2026-08-19(수) 06:00 = UTC 2026-08-18 21:00 — 화요일 세션 마감 후, 컷오프(07:00) 전
    setKst("2026-08-18T21:00:00.000Z");
    expect(getStockCacheSlot("foreign")).toBe("2026-08-18");
  });
});
