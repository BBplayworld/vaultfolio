// restoreFocusAfterDialog — 복귀 순서(FAB → 열기 직전 요소 → main), opener가 body면 main으로(4.64 ui 검수)
import { afterEach, describe, expect, it, vi } from "vitest";
import { restoreFocusAfterDialog } from "@/lib/restore-focus";

const el = (connected = true) => ({ isConnected: connected, focus: vi.fn(), hasAttribute: () => true, setAttribute: vi.fn(), classList: { add: vi.fn() }, getClientRects: () => [1], closest: () => null });
function setup(fab: ReturnType<typeof el> | null, main: ReturnType<typeof el>, body: object) {
  vi.stubGlobal("document", {
    body,
    querySelectorAll: () => (fab ? [fab] : []),
    querySelector: (q: string) => (q === "main" ? main : null),
  });
}
afterEach(() => vi.unstubAllGlobals());

describe("restoreFocusAfterDialog", () => {
  it("FAB가 있으면 FAB 우선", () => {
    const fab = el(), main = el(), opener = el();
    setup(fab, main, {});
    restoreFocusAfterDialog(opener as unknown as HTMLElement);
    expect(fab.focus).toHaveBeenCalled();
    expect(opener.focus).not.toHaveBeenCalled();
  });
  it("FAB가 없고 opener가 남아 있으면 opener", () => {
    const main = el(), opener = el();
    setup(null, main, {});
    restoreFocusAfterDialog(opener as unknown as HTMLElement);
    expect(opener.focus).toHaveBeenCalled();
    expect(main.focus).not.toHaveBeenCalled();
  });
  it("FAB가 없고 opener가 document.body면 main으로", () => {
    const main = el(), body = el();
    setup(null, main, body);
    restoreFocusAfterDialog(body as unknown as HTMLElement);
    expect(body.focus).not.toHaveBeenCalled();
    expect(main.focus).toHaveBeenCalledWith({ preventScroll: true });
  });
  it("FAB가 없고 opener가 DOM에서 사라졌으면 main으로", () => {
    const main = el(), opener = el(false);
    setup(null, main, {});
    restoreFocusAfterDialog(opener as unknown as HTMLElement);
    expect(main.focus).toHaveBeenCalled();
  });
});
