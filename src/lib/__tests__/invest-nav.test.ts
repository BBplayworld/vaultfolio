import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getBackLabel, guardTrialView, isRetiredHash, isSameNavHash, parseHash, swipeOrderOf, toHash,
} from "@/app/(main)/_components/layout/navigation/navigation-context";
import { WHATS_NEW } from "@/config/whats-new";

const read = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

describe("투자 탭 폐지 네비(#263→5.145)", () => {
  it("5.145: #invest·#invest/*는 홈(투자 탭 폐지), 폐지 해시 판정, #investx는 폐지 해시 아님", () => {
    expect(parseHash("#invest")).toEqual({ type: "home" });
    expect(parseHash("#invest/three")).toEqual({ type: "home" });
    expect(parseHash("#invest/anything")).toEqual({ type: "home" });
    expect(isRetiredHash("#invest")).toBe(true);
    expect(isRetiredHash("#invest/three")).toBe(true);
    expect(isRetiredHash("#investx")).toBe(false);
    expect(isRetiredHash("#detail")).toBe(false);
  });
  it("진입 처리: 초기·popstate 모두 폐지 해시는 replaceState(push 0 → 뒤로 가기 루프 0)", () => {
    const nav = read("app/(main)/_components/layout/navigation/navigation-context.tsx");
    expect(nav.match(/if \(isRetiredHash\(window\.location\.hash\)\) window\.history\.replaceState\(/g)?.length).toBe(2);
  });
  it("재탭 push 0: 같은 해시면 건너뜀", () => {
    expect(isSameNavHash("", { type: "home" })).toBe(true);
    expect(isSameNavHash("#detail", { type: "detail", tab: "hub" })).toBe(true);
    expect(isSameNavHash("#invest", { type: "detail", tab: "hub" })).toBe(false);
  });
  it("전 탭 해시 회귀: 홈·상세·활동·성과·더보기·설정·세금 해시는 5.141 전과 같다", () => {
    expect(parseHash("")).toEqual({ type: "home" });
    expect(parseHash("#home")).toEqual({ type: "home" });
    expect(parseHash("#more")).toEqual({ type: "more" });
    expect(parseHash("#settings")).toEqual({ type: "settings" });
    expect(parseHash("#tax")).toEqual({ type: "tax" });
    expect(parseHash("#detail")).toEqual({ type: "detail", tab: "hub" });
    expect(parseHash("#activity")).toEqual({ type: "activity", tab: "hub" });
    for (const t of ["hub", "stocks", "stocks-xray", "stocks-trades", "stocks-item", "real-estate", "physical", "crypto", "crypto-transactions", "cash", "cash-transactions", "loans", "loan-transactions"] as const) {
      const v = parseHash(`#detail/${t}`);
      expect(v).toEqual({ type: "detail", tab: t });
      expect(parseHash(toHash(v))).toEqual(v);
    }
    for (const t of ["hub", "change", "change-market", "dividend", "report"] as const) {
      const v = parseHash(`#activity/${t}`);
      expect(v).toEqual({ type: "activity", tab: t });
      expect(parseHash(toHash(v))).toEqual(v);
    }
    expect(parseHash("#detail/nope")).toEqual({ type: "home" });
    expect(parseHash("#share=abc")).toEqual({ type: "home" });
    expect(parseHash("#sync=abc")).toEqual({ type: "home" });
  });
  it("기존 #more·#settings 북마크는 그대로 더보기·설정(구버전 혼재: 구버전이 #invest를 받으면 홈)", () => {
    expect(parseHash("#more")).toEqual({ type: "more" });
    expect(parseHash("#settings")).toEqual({ type: "settings" });
    expect(toHash({ type: "more" })).toBe("#more");
  });
  it("뒤로 라벨: 더보기 = 홈, 설정 = 더보기", () => {
    expect(getBackLabel({ type: "more" })).toBe("홈");
    expect(getBackLabel({ type: "settings" })).toBe("더보기");
  });
  it("체험은 #more만 홈으로", () => {
    expect(guardTrialView({ type: "more" }, true)).toEqual({ type: "home" });
  });
  it("스와이프 순서 home·detail·activity (체험 같음)", () => {
    expect(swipeOrderOf(false)).toEqual(["home", "detail", "activity"]);
    expect(swipeOrderOf(true)).toEqual(["home", "detail", "activity"]);
  });
  it("상단: 선택기 `상세 | 성과`, 더보기 아이콘은 PWA에서도 노출, 더보기 페이지는 PWA 뒤로가기 헤더", () => {
    const top = read("app/(main)/_components/header-menu/top-bar.tsx");
    expect([...top.matchAll(/\{ value: "(\w+)", label: "([^"]+)"/g)].map((m) => m[2])).toEqual(["상세", "성과"]);
    expect(top).not.toContain("invest");
    expect(top).toMatch(/const isNestedView =\s*view\.type === "more" \|\|/);
    expect(top).toMatch(/\{showMore && <MoreButton \/>\}/);
    expect(top).toContain("const showMore = view.type === \"home\" && !isWelcomeGuide && !trial;");
  });
  it("PWA 하단: 투자 칸 없음, 더보기 칸 없음", () => {
    const nav = read("app/(main)/_components/pwa/bottom-nav.tsx");
    expect(nav).not.toContain("invest");
    expect(nav).not.toContain('id: "more"');
    expect(read("app/(main)/page.tsx")).not.toContain("invest");
  });
  it("새 소식 1줄: 투자 탭이 사라졌고 시장 이야기는 가이드에서 본다(사실만)", () => {
    const e = WHATS_NEW.find((w) => w.id === "20261124-01");
    expect(e?.title).toBe("투자 탭이 없어졌어요");
    expect(e?.body).toBe("시장 이야기는 성과 맨 아래 '크게 빠진 때와 금리'에서 볼 수 있어요");
    // 없는 탭을 안내하던 옛 항목은 목록에서 제외
    for (const id of ["20261123-01", "20261123-02", "20261122-01"]) expect(WHATS_NEW.some((w) => w.id === id)).toBe(false);
  });
  it("성과 허브에 시장 가이드 링크 1줄", () => {
    const hub = read("app/(main)/_components/views/activity/performance-hub.tsx");
    expect(hub).toContain('href="/guide/market-history"');
  });
});
