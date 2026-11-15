// 홈 알림 팁 노출 환경(5.115) — standalone·ready·권한 default·로컬 off, 팁 경로에서 권한 요청 0
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const h = vi.hoisted(() => ({ on: false }));
vi.mock("../prefs", async (orig) => ({ ...(await orig<typeof import("../prefs")>()), readPushPrefs: () => ({ on: h.on }) }));

import { isNotifyTipEligible } from "../client";

function env(o: { standalone?: boolean; permission?: string; push?: boolean }) {
  const win: Record<string, unknown> = {
    matchMedia: () => ({ matches: o.standalone ?? true }),
  };
  if (o.push !== false) win.PushManager = {};
  if (o.permission) win.Notification = { permission: o.permission };
  vi.stubGlobal("window", win);
  vi.stubGlobal("navigator", { serviceWorker: {} });
  vi.stubGlobal("Notification", o.permission ? { permission: o.permission } : undefined);
}
afterEach(() => { vi.unstubAllGlobals(); h.on = false; });

describe("isNotifyTipEligible", () => {
  it("standalone·ready·default·로컬 off면 true", () => {
    env({ permission: "default" });
    expect(isNotifyTipEligible()).toBe(true);
  });
  it.each(["granted", "denied"])("권한 %s면 false", (permission) => {
    env({ permission });
    expect(isNotifyTipEligible()).toBe(false);
  });
  it("로컬 알림 on이면 false", () => {
    env({ permission: "default" });
    h.on = true;
    expect(isNotifyTipEligible()).toBe(false);
  });
  it("standalone 아님·push 미지원이면 false", () => {
    env({ permission: "default", standalone: false });
    expect(isNotifyTipEligible()).toBe(false);
    env({ permission: "default", push: false });
    expect(isNotifyTipEligible()).toBe(false);
  });
  it("홈 팁 경로에 권한 요청 호출 0(AC-8)", () => {
    const src = readFileSync(path.resolve(__dirname, "../../../app/(main)/_components/views/home/home-tip-box.tsx"), "utf8");
    expect(src).not.toMatch(/requestPermission|enablePush/);
  });
});

describe("설정 알림 구역 스크롤 가드(R-1)", () => {
  it("mounted 이후에만 찾고, 찾은 뒤에만 1회 소비한다", () => {
    const src = readFileSync(path.resolve(__dirname, "../../../app/(main)/_components/header-menu/settings-page.tsx"), "utf8");
    expect(src).toMatch(/!mounted\) return;\s*const el = document\.getElementById\("settings-section-notify"\);\s*if \(!el\) return;\s*focusedRef\.current = true;/);
    expect(src).toContain("}, [focus, mounted]);");
  });
});
