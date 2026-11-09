// #99 실패 박스 — node 환경: 정적 마크업 + 도착지 순수 함수(runDirectInput)
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const h = vi.hoisted(() => ({ tracked: [] as unknown[][], events: [] as { type: string; detail: unknown }[], data: { cash: [] as unknown[], loans: [] as unknown[] } }));
vi.mock("@/lib/analytics/ga", () => ({ track: (...a: unknown[]) => void h.tracked.push(a) }));
vi.mock("@/lib/asset/asset-storage", () => ({ getAssetData: () => h.data }));
vi.mock("@/contexts/asset-data-context", () => ({ useAssetData: () => ({ assetData: h.data }) }));

import { ScreenshotFailNotice, runDirectInput } from "../screenshot-fail-notice";
import { makeScreenshotFail } from "@/lib/asset/screenshot-fail";

beforeEach(() => {
  h.tracked = []; h.events = []; h.data = { cash: [], loans: [] };
  vi.stubGlobal("window", { dispatchEvent: (e: CustomEvent) => void h.events.push({ type: e.type, detail: e.detail }) });
});

const render = (over: Partial<Parameters<typeof ScreenshotFailNotice>[0]> = {}) =>
  renderToStaticMarkup(
    <ScreenshotFailNotice fail={makeScreenshotFail("empty", "인식된 종목이 없어요")} assetType="stock" canRetry onRetry={() => {}} onClose={() => {}} {...over} />,
  );

describe("렌더", () => {
  it("제목·alert·data-kind·두 버튼, 다른 캡처=brand/직접 입력=secondary", () => {
    const html = render();
    expect(html).toContain('role="alert"');
    expect(html).toContain('data-kind="empty"');
    expect(html).toContain("인식된 종목이 없어요");
    expect(html).toContain("screenshot-fail-retry");
    expect(html).toContain("직접 입력으로 등록");
    expect(html.indexOf("screenshot-fail-retry")).toBeLessThan(html.indexOf("screenshot-fail-manual"));
  });
  it("남은 횟수 0이면 다른 캡처 DOM 0, 직접 입력만(brand)", () => {
    const html = render({ canRetry: false });
    expect(html).not.toContain("screenshot-fail-retry");
    expect(html).toContain("screenshot-fail-manual");
    expect(html).toMatch(/bg-brand[^"]*"[^>]*data-testid="screenshot-fail-manual"|data-testid="screenshot-fail-manual"[^>]*bg-brand/);
  });
  it("현금 보유자는 '잔액 고치기', 마법사(directInput=add)는 항상 '등록'", () => {
    h.data = { cash: [{}], loans: [] };
    expect(render({ assetType: "cash" })).toContain("직접 입력으로 잔액 고치기");
    expect(render({ assetType: "cash", directInput: "add" })).toContain("직접 입력으로 등록");
  });
});

describe("runDirectInput 도착지", () => {
  it("1회 = asset_add_start(manual) 1건 + 도착 이벤트 1건", () => {
    runDirectInput("crypto");
    expect(h.tracked).toEqual([["asset_add_start", { asset_type: "crypto", method: "manual" }]]);
    expect(h.events).toEqual([{ type: "trigger-add-crypto", detail: { mode: "manual" } }]);
  });
  it("주식 = trigger-add-stock manual", () => {
    runDirectInput("stock");
    expect(h.events).toEqual([{ type: "trigger-add-stock", detail: { mode: "manual" } }]);
  });
  it("현금·대출 0건 → 추가 폼, 보유 → 잔액 맞추기, 마법사는 보유여도 추가 폼", () => {
    runDirectInput("loan");
    expect(h.events[0].type).toBe("trigger-add-loan");
    h.events = []; h.data = { cash: [], loans: [{}] };
    runDirectInput("loan");
    expect(h.events).toEqual([{ type: "trigger-resync-balance", detail: { category: "loan" } }]);
    h.events = [];
    runDirectInput("loan", "add");
    expect(h.events[0].type).toBe("trigger-add-loan");
  });
});
