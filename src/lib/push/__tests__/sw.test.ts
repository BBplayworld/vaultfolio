import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as vm from "vm";

const SRC = fs.readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");

function load() {
  const handlers: Record<string, (e: unknown) => void> = {};
  const shown: { title: string; opts: Record<string, unknown> }[] = [];
  const clients = { matchAll: vi.fn(), openWindow: vi.fn().mockResolvedValue(null) };
  const self = {
    addEventListener: (t: string, h: (e: unknown) => void) => (handlers[t] = h),
    registration: { showNotification: (title: string, opts: Record<string, unknown>) => (shown.push({ title, opts }), Promise.resolve()) },
    clients,
    location: { origin: "https://app.test" },
    skipWaiting: () => Promise.resolve(),
  };
  vm.runInNewContext(SRC, { self, URL, caches: {}, Promise, JSON });
  return { handlers, shown, clients };
}
const evt = (json?: () => unknown) => {
  const waits: Promise<unknown>[] = [];
  return { data: json ? { json } : null, waitUntil: (p: Promise<unknown>) => waits.push(p), waits };
};

describe("sw push", () => {
  it("캐시 버전 v5", () => expect(SRC).toContain('"secretasset-cache-v5"'));
  it("정상 페이로드는 시장별 tag로 표시", async () => {
    const { handlers, shown } = load();
    const e = evt(() => ({ m: "us", t: "11/12 미국 종가", b: "S&P 500 -0.3%" }));
    handlers.push(e);
    await Promise.all(e.waits);
    expect(shown[0].title).toBe("11/12 미국 종가");
    expect(shown[0].opts).toMatchObject({ tag: "market-us", renotify: false, data: { url: "/?from=push" } });
  });
  it("파싱 실패·형식 이상은 숫자 없는 폴백", async () => {
    for (const j of [() => { throw new Error("x"); }, () => ({ t: 1 }), undefined]) {
      const { handlers, shown } = load();
      const e = evt(j as never);
      handlers.push(e);
      await Promise.all(e.waits);
      expect(shown[0].title).toBe("시장 종가");
      expect(shown[0].opts.body).toBe("오늘 시장 종가가 업데이트됐어요");
    }
  });
});

describe("sw notificationclick", () => {
  const click = (c: ReturnType<typeof load>) => {
    const close = vi.fn();
    const e = { notification: { close, data: { url: "/?from=push" } }, waits: [] as Promise<unknown>[], waitUntil(p: Promise<unknown>) { this.waits.push(p); } };
    c.handlers.notificationclick(e);
    return { e, close };
  };
  it("열린 창이 있으면 focus만", async () => {
    const c = load();
    const focus = vi.fn().mockResolvedValue("f");
    c.clients.matchAll.mockResolvedValue([{ url: "https://app.test/#x", focus }]);
    const { e, close } = click(c);
    await Promise.all(e.waits);
    expect(close).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
    expect(c.clients.openWindow).not.toHaveBeenCalled();
  });
  it("창이 없으면 홈을 연다", async () => {
    const c = load();
    c.clients.matchAll.mockResolvedValue([]);
    const { e } = click(c);
    await Promise.all(e.waits);
    expect(c.clients.openWindow).toHaveBeenCalledWith("/?from=push");
  });
});
