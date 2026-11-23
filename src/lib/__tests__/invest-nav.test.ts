import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getBackLabel, guardTrialView, isSameNavHash, parseHash, swipeOrderOf, toHash,
} from "@/app/(main)/_components/layout/navigation/navigation-context";
import { viewToKey } from "@/lib/feature-usage";
import { WHATS_NEW } from "@/config/whats-new";

const read = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

describe("투자 탭 네비(#263)", () => {
  it("#invest 해시 왕복, 하위 해시(#invest/three·모르는 값)도 투자 탭 — toHash는 #invest 그대로", () => {
    expect(parseHash("#invest")).toEqual({ type: "invest" });
    expect(toHash({ type: "invest" })).toBe("#invest");
    expect(parseHash(toHash({ type: "invest" }))).toEqual({ type: "invest" });
    expect(parseHash("#invest/three")).toEqual({ type: "invest" });
    expect(parseHash("#invest/anything")).toEqual({ type: "invest" });
    expect(parseHash("#investx")).toEqual({ type: "home" });
  });
  it("재탭 push 0: 투자 탭 해시면 #invest/three에서도 같은 화면, 다른 화면은 그대로 비교", () => {
    expect(isSameNavHash("#invest/three", { type: "invest" })).toBe(true);
    expect(isSameNavHash("#invest", { type: "invest" })).toBe(true);
    expect(isSameNavHash("", { type: "invest" })).toBe(false);
    expect(isSameNavHash("#detail", { type: "invest" })).toBe(false);
    expect(isSameNavHash("#invest/three", { type: "home" })).toBe(false);
    expect(isSameNavHash("", { type: "home" })).toBe(true);
    expect(isSameNavHash("#detail", { type: "detail", tab: "hub" })).toBe(true);
    expect(isSameNavHash("#invest/three", { type: "detail", tab: "hub" })).toBe(false);
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
  it("뒤로 라벨: 투자·더보기 = 홈, 설정 = 더보기", () => {
    expect(getBackLabel({ type: "invest" })).toBe("홈");
    expect(getBackLabel({ type: "more" })).toBe("홈");
    expect(getBackLabel({ type: "settings" })).toBe("더보기");
  });
  it("체험은 #invest를 허용하고 #more는 계속 홈", () => {
    const v = { type: "invest" } as const;
    expect(guardTrialView(v, true)).toBe(v);
    expect(guardTrialView({ type: "more" }, true)).toEqual({ type: "home" });
  });
  it("스와이프 순서 home·detail·activity·invest (체험 같음)", () => {
    expect(swipeOrderOf(false)).toEqual(["home", "detail", "activity", "invest"]);
    expect(swipeOrderOf(true)).toEqual(["home", "detail", "activity", "invest"]);
  });
  it("방문 집계 키는 기존 키 구조에 `invest` 1개만 추가(스키마 변경 0)", () => {
    expect(viewToKey({ type: "invest" })).toBe("invest");
  });
  it("상단: 선택기 `상세 | 성과 | 투자`, 더보기 아이콘은 PWA에서도 노출, 더보기 페이지는 PWA 뒤로가기 헤더", () => {
    const top = read("app/(main)/_components/header-menu/top-bar.tsx");
    expect([...top.matchAll(/\{ value: "(\w+)", label: "([^"]+)"/g)].map((m) => m[2])).toEqual(["상세", "성과", "투자"]);
    expect(top).toContain('if (tab === "invest") navigate({ type: "invest" });');
    expect(top).toMatch(/const isNestedView =\s*view\.type === "more" \|\|/);
    expect(top).toMatch(/\{showMore && <MoreButton \/>\}/);
    expect(top).toContain("const showMore = view.type === \"home\" && !isWelcomeGuide && !trial;");
  });
  it("PWA 하단 투자 칸: 체험 포함(4칸), 더보기 칸 없음", () => {
    const nav = read("app/(main)/_components/pwa/bottom-nav.tsx");
    expect(nav).toContain('{ id: "invest", label: "투자", icon: ChartCandlestick }');
    expect(nav).not.toContain('id: "more"');
    expect(read("app/(main)/page.tsx")).toContain('view.type === "invest"');
  });
  it("새 소식 1줄이 spec 8절 문구와 같다(AC32)", () => {
    const e = WHATS_NEW.find((w) => w.id === "20261122-01");
    // 정본 1줄이 title 32자 상한(33자)을 넘어 title·body로 나눈 것 — 합치면 spec 8절 문구와 같다
    expect(`${e?.title.replace("생겼어요", "생겼고,")} ${e?.body}`).toBe("하단에 '투자'가 생겼고, 더보기는 홈 오른쪽 위로 옮겼어요");
  });
});
