// #170 [4.87] 홈 기능 팁 보유 필터 — 실제 recordVisit·dismissTip로 방문·dismiss를 만들어 판정(C76·C83)
import { beforeEach, describe, expect, it } from "vitest";
import type { AssetData } from "@/types/asset";
import { dismissTip, isTipDismissed, pickRecommendedFeature, recordVisit } from "../feature-usage";
import { pickHomeTip } from "../home-tip";
import { APP_FEATURES } from "@/config/app-features";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as Record<string, unknown>).window = globalThis;
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };
});

const EMPTY = { stocks: [], realEstate: [], crypto: [], cash: [], loans: [] };
const KR = { category: "domestic", currency: "KRW", quantity: 3 };
const US = { category: "foreign", currency: "USD", quantity: 2 };
const mk = (o: Partial<Record<keyof typeof EMPTY, unknown[]>>) => ({ ...EMPTY, ...o, lastUpdated: "2026-11-10T00:00:00.000Z" }) as unknown as AssetData;
const F1 = mk({ cash: [{}] });
const F2 = mk({ stocks: [KR] });
const F3 = mk({ crypto: [{}] });
const F4 = mk({ loans: [{}] });
const F5 = mk({ stocks: [US] });
const F6 = mk({ stocks: [US], realEstate: [{}], crypto: [{}], cash: [{}], loans: [{}] });
const F7 = mk({ stocks: [{ ...US, inactiveStatus: "delisted" }] });
const ZERO = mk({ stocks: [{ ...KR, quantity: 0 }] });

// "누름" = dismiss + 방문 기록(실제 호출). 후보가 없을 때까지 id 순서를 모은다.
function sequence(data: AssetData): string[] {
  const out: string[] = [];
  for (let i = 0; i < 30; i++) {
    const f = pickRecommendedFeature(data);
    if (!f) break;
    out.push(f.id);
    dismissTip(f.id);
    recordVisit(f.visitKey ?? (f.target ? (f.target.type === "detail" || f.target.type === "activity" ? `${f.target.type}:${f.target.tab}` : f.target.type) : f.id));
  }
  return out;
}

describe("보유 구성별 팁 순서 (기본·경계·폴백)", () => {
  it("F2 국내주식만(기본): 세금 일정 → 주식 → X-Ray 로 이어지고 끝은 null", () => {
    expect(pickRecommendedFeature(F2)?.id).toBe("tax-schedule");
    const seq = sequence(F2);
    expect(seq.slice(0, 3)).toEqual(["tax-schedule", "stocks", "stocks-xray"]);
    expect(seq).not.toContain("tax-simulator");
    expect(seq).not.toContain("crypto");
    expect(seq).toContain("dividend");
    expect(pickRecommendedFeature(F2)).toBeNull();
  });
  it("F1 현금만: 세금 일정 → 현금 → 자산 변화 → 주간 → 성적표, 주식·부동산 계열 없음", () => {
    expect(sequence(F1)).toEqual(["tax-schedule", "cash", "change", "week-causes", "report"]);
  });
  it("F3 코인·F4 대출은 각 자산군 팁만 포함", () => {
    expect(sequence(F3)).toEqual(["tax-schedule", "crypto", "change", "week-causes", "report"]);
    store.clear(); // 같은 테스트 안에서 기록 초기화
    expect(sequence(F4)).toEqual(["tax-schedule", "loans", "change", "week-causes", "report"]);
  });
  it("F5 해외주식: 첫 팁 절세 시뮬, 누름 처리 뒤에는 세금 일정이 아니라 주식(tax 방문 공유)", () => {
    expect(pickRecommendedFeature(F5)?.id).toBe("tax-simulator");
    dismissTip("tax-simulator");
    recordVisit("tax");
    expect(pickRecommendedFeature(F5)?.id).toBe("stocks");
  });
  it("F6 전 자산군(폴백): main과 같이 첫 팁이 절세 시뮬, 카탈로그의 tip 항목 전부 후보", () => {
    expect(pickRecommendedFeature(F6)?.id).toBe("tax-simulator");
    expect(sequence(F6).length).toBe(APP_FEATURES.filter((f) => f.tip !== false).length);
  });
  it("F7 상폐 해외주식만(경계): 절세 시뮬 제외, 주식 계열은 남는다", () => {
    const seq = sequence(F7);
    expect(seq[0]).toBe("tax-schedule");
    expect(seq).not.toContain("tax-simulator");
    expect(seq).toContain("stocks");
  });
  it("수량 0 주식만(경계): 주식 계열 전부 제외 — F1 계열 순서", () => {
    const seq = sequence(ZERO);
    expect(seq).toEqual(["tax-schedule", "change", "week-causes", "report"]);
  });
});

describe("걸러진 항목은 dismiss 기록 없음 — 보유가 생기면 다시 후보", () => {
  it("현금만일 때 crypto는 dismiss되지 않고, 코인 추가 후 추천된다", () => {
    sequence(F1);
    expect(isTipDismissed("crypto")).toBe(false);
    expect(pickRecommendedFeature(mk({ cash: [{}], crypto: [{}] }))?.id).toBe("crypto");
  });
});

describe("pickHomeTip 통합(모킹 없음) — 우선순위 불변", () => {
  const base = { hasAssets: true, syncArmed: false, hasRelink: false, whatsNewOk: false };
  it("결산 창 밖: F1은 feature·tax-schedule", () => {
    const tip = pickHomeTip({ ...base, assetData: F1, today: "2026-11-12" });
    expect(tip?.kind).toBe("feature");
    if (tip?.kind === "feature") expect(tip.feature.id).toBe("tax-schedule");
  });
  it("후보 0이면 null", () => {
    sequence(F1);
    expect(pickHomeTip({ ...base, assetData: F1, today: "2026-11-12" })).toBeNull();
  });
});
