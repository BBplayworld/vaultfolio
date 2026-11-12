import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { taxEntryLine } from "../tax-utils";
import { featureTitleOf } from "../analytics/ga";
import type { AssetData } from "@/types/asset";

// 4.89 세금 관리를 더보기 밖으로 + 홈 원인 펼침 계측
const read = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");
const empty = { stocks: [], realEstate: [], crypto: [], cash: [], loans: [], physical: [] } as unknown as AssetData;

describe("세금 행 보조줄 taxEntryLine", () => {
  it("자산 0건이면 null(기본 문구)", () => {
    expect(taxEntryLine(empty, "2026-12-10")).toBeNull();
  });
  it("내 자산 파생 일정이 있으면 1건, 임박 여부는 0~6일", () => {
    const data = { ...empty, realEstate: [{ type: "apartment" }] } as unknown as AssetData;
    const near = taxEntryLine(data, "2026-12-10"); // 12/15 마감까지 5일
    expect(near?.dueLabel).toBeTruthy();
    expect(near?.imminent).toBe(true);
    const far = taxEntryLine(data, "2026-12-01");
    expect(far?.imminent).toBe(false);
  });
});

describe("활성 탭·스와이프 매핑", () => {
  it("bottom-nav getActiveId: tax → detail, settings → more", () => {
    const nav = read("app/(main)/_components/pwa/bottom-nav.tsx");
    expect(nav).toContain('viewType === "detail" || viewType === "tax"');
    expect(nav).not.toMatch(/viewType === "more"[^\n]*"tax"/);
    expect(nav).toContain('viewType === "more" || viewType === "settings"');
  });
  it("mainTypeOf: tax → detail, settings → more", () => {
    expect(read("app/(main)/_components/layout/navigation/navigation-context.tsx"))
      .toContain('t === "settings" ? "more" : t === "tax" ? "detail" : t');
  });
});

describe("더보기 '도구' 섹션 제거", () => {
  it("tool-menu에 도구 섹션·세금 행·Receipt가 없다", () => {
    const src = read("app/(main)/_components/header-menu/tool-menu.tsx");
    expect(src).not.toContain("more-section-tools");
    expect(src).not.toContain("more-row-tax");
    expect(src).not.toContain("Receipt");
    expect(src).not.toContain('type: "tax"');
  });
});

describe("홈 원인 펼침 계측 home_cause_open", () => {
  it("제목 매핑", () => {
    expect(featureTitleOf("feature_use", { category: "home_cause_open" }, "home")).toBe("홈 변동 원인 열기");
  });
  it("송출처는 홈 대시보드 1곳(핸들러 1개), 열 때(!causeOpen)만 — B 줄 탭과 원인 0개 쉐브론 두 입구가 같은 핸들러를 쓴다(4.90)", () => {
    const root = join(process.cwd(), "src");
    const out: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const f = join(d, n);
        if (statSync(f).isDirectory()) { if (n !== "__tests__") walk(f); continue; }
        if (/\.(ts|tsx)$/.test(n) && readFileSync(f, "utf8").includes('category: "home_cause_open"')) out.push(f.slice(root.length + 1).replace(/\\/g, "/"));
      }
    };
    walk(root);
    const dash = "app/(main)/_components/views/home/dashboard.tsx";
    expect(out.filter((f) => !f.endsWith("analytics/ga.ts"))).toEqual([dash]);
    const src = read(dash);
    expect(src.match(/category: "home_cause_open"/g)).toHaveLength(1);
    expect(src).toMatch(/if \(!causeOpen\) track\("feature_use", \{ category: "home_cause_open" \}\)/);
    // 두 입구: B 줄(펼칠 때만 클릭 가능 — 접힘 줄은 inert)과 쉐브론이 toggleCause를 부르고, 접기 줄은 포커스만 옮긴 뒤 같은 핸들러(열림 상태라 송출 0)
    expect(src).toContain("onClick={toggleCause}"); // 쉐브론
    expect(src).toMatch(/data-testid="home-cause-line"[\s\S]{0,400}focusTo\.current = "panel"; toggleCause\(\)/); // B 줄
  });
});
