// #309 복귀 트리거 — visible·pageshow(persisted)만, 겹침은 1회
import { describe, expect, it, vi } from "vitest";
import { createSingleFlight, onPageResume } from "../page-resume";

function fakeEnv() {
  const doc = new EventTarget() as EventTarget & { visibilityState: string };
  doc.visibilityState = "hidden";
  const win = new EventTarget();
  const pageshow = (persisted: boolean) => {
    const e = new Event("pageshow") as Event & { persisted: boolean };
    Object.defineProperty(e, "persisted", { value: persisted });
    win.dispatchEvent(e);
  };
  return { doc, win, pageshow };
}

describe("onPageResume", () => {
  it("visible·pageshow(persisted)만 부른다", () => {
    const { doc, win, pageshow } = fakeEnv();
    const cb = vi.fn();
    const off = onPageResume(cb, doc as unknown as Document, win as unknown as Window);
    doc.dispatchEvent(new Event("visibilitychange")); // hidden
    expect(cb).toHaveBeenCalledTimes(0);
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(cb).toHaveBeenCalledTimes(1);
    pageshow(false); // 첫 로드
    expect(cb).toHaveBeenCalledTimes(1);
    pageshow(true); // bfcache 복원
    expect(cb).toHaveBeenCalledTimes(2);
    win.dispatchEvent(new Event("focus"));
    win.dispatchEvent(new Event("online"));
    expect(cb).toHaveBeenCalledTimes(2);
    off();
    doc.dispatchEvent(new Event("visibilitychange"));
    pageshow(true);
    expect(cb).toHaveBeenCalledTimes(2);
  });
});

describe("createSingleFlight", () => {
  it("진행 중 연타·visible+pageshow 연속은 1회", async () => {
    let release!: () => void;
    const run = vi.fn(() => new Promise<void>((r) => { release = r; }));
    const trigger = createSingleFlight(run);
    const a = trigger();
    void trigger();
    void trigger();
    expect(run).toHaveBeenCalledTimes(1);
    release();
    await a;
    const b = trigger();
    expect(run).toHaveBeenCalledTimes(2);
    release();
    await b;
  });

  it("canStart가 false면 시작하지 않는다(잠금·오프라인·다른 사슬 진행 중)", async () => {
    const run = vi.fn(async () => {});
    let ok = false;
    const trigger = createSingleFlight(run, () => ok);
    await trigger();
    expect(run).toHaveBeenCalledTimes(0);
    ok = true;
    await trigger();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("실패해도 다음 복귀에 다시 시작할 수 있다", async () => {
    const run = vi.fn(async () => { throw new Error("x"); });
    const trigger = createSingleFlight(run);
    await expect(trigger()).rejects.toThrow("x");
    await expect(trigger()).rejects.toThrow("x");
    expect(run).toHaveBeenCalledTimes(2);
  });
});
