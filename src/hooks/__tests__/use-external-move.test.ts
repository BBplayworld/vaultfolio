// #60 외부 이동 판정(moveExternal) — 게이트·웰컴 공용 단일 구현
import { describe, expect, it, vi } from "vitest";
import { moveExternal } from "../use-external-move";

const deps = (isIOS: boolean, url: string | Promise<string> = "https://example.com/") => ({
  isIOS,
  url,
  copy: vi.fn(async () => {}),
  openExternal: vi.fn(() => true),
  onTrack: vi.fn(),
});

describe("moveExternal", () => {
  it("iOS: 주소 복사 → ios-fallback, 스킴 호출 없음, GA 1회", async () => {
    const d = deps(true);
    expect(await moveExternal(d)).toBe("ios-fallback");
    expect(d.copy).toHaveBeenCalledWith("https://example.com/");
    expect(d.openExternal).not.toHaveBeenCalled();
    expect(d.onTrack).toHaveBeenCalledTimes(1);
  });
  it("Android: 스킴 이동 → opened, 복사 없음, GA 1회", async () => {
    const d = deps(false);
    expect(await moveExternal(d)).toBe("opened");
    expect(d.openExternal).toHaveBeenCalledWith("https://example.com/");
    expect(d.copy).not.toHaveBeenCalled();
    expect(d.onTrack).toHaveBeenCalledTimes(1);
  });
  it("Android: Promise URL(PIN 복원 링크)은 해석 후 이동", async () => {
    const d = deps(false, Promise.resolve("https://example.com/#share=x"));
    await moveExternal(d);
    expect(d.openExternal).toHaveBeenCalledWith("https://example.com/#share=x");
  });
  it("iOS: Promise URL은 그대로 복사 함수에 전달(제스처 만료 전 ClipboardItem)", async () => {
    const p = Promise.resolve("https://example.com/#share=y");
    const d = deps(true, p);
    await moveExternal(d);
    expect(d.copy).toHaveBeenCalledWith(p);
  });
});
