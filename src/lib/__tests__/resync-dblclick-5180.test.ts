// #368(5.180) 맞추기 연타 — 결과 화면 전환 직후 바깥 닫기 무시 + 되돌리기 토스트 dismiss·재생성 경합 회귀
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { RESULT_CLOSE_GUARD_MS, createUndoToastSlot, isResultCloseGuarded } from "@/lib/asset/resync-return";

describe("isResultCloseGuarded — 결과 화면 진입 직후 바깥 닫기 무시", () => {
  it("기본 400ms", () => expect(RESULT_CLOSE_GUARD_MS).toBe(400));
  it("진입 전(null)은 막지 않는다", () => expect(isResultCloseGuarded(null, 1000)).toBe(false));
  it("진입 직후~399ms는 막고 400ms부터 허용", () => {
    expect(isResultCloseGuarded(1000, 1000)).toBe(true);
    expect(isResultCloseGuarded(1000, 1080)).toBe(true); // dblclick 둘째 탭 간격
    expect(isResultCloseGuarded(1000, 1399)).toBe(true);
    expect(isResultCloseGuarded(1000, 1400)).toBe(false);
    expect(isResultCloseGuarded(1000, 5000)).toBe(false);
  });
  it("시계가 거꾸로면(음수 경과) 막지 않는다", () => expect(isResultCloseGuarded(1000, 900)).toBe(false));
});

// sonner 2.0.7과 같은 의미의 가짜 토스트 저장소: dismiss(id)는 삭제를 다음 프레임으로 미루고, 그때 같은 id를 지운다
function fakeToaster() {
  const shown = new Map<string, string>();
  const frame: (() => void)[] = [];
  return {
    show: (id: string, msg: string) => void shown.set(id, msg),
    dismiss: (id: string) => void frame.push(() => shown.delete(id)),
    flush: () => frame.splice(0).forEach((f) => f()),
    shown,
  };
}

describe("createUndoToastSlot — dismiss·재생성 경합", () => {
  it("예전 방식(같은 id dismiss → 곧바로 재생성)은 늦은 삭제가 새 토스트를 지운다 — 경합 재현", () => {
    const t = fakeToaster();
    t.dismiss("holdings-resync-undo"); // 맞추기 클릭(handleApply)
    t.show("holdings-resync-undo", "보유 현황을 맞췄어요"); // 같은 프레임 둘째 탭으로 닫기(handleClose)
    t.flush();
    expect(t.shown.size).toBe(0);
  });

  it("새 방식은 닫은 뒤 되돌리기 토스트가 남는다", () => {
    const t = fakeToaster();
    const slot = createUndoToastSlot("holdings-resync-undo");
    const dismissUndo = () => {
      const id = slot.take();
      if (id) t.dismiss(id);
    };
    dismissUndo(); // 맞추기 — 떠 있는 토스트 없음
    dismissUndo(); // 닫기 직전
    const id = slot.next();
    t.show(id, "보유 현황을 맞췄어요");
    t.flush();
    expect([...t.shown.values()]).toEqual(["보유 현황을 맞췄어요"]);

    // 다시 열어 맞추고 곧바로 닫기: 이전 토스트만 지워지고 새 토스트는 남는다
    dismissUndo();
    const id2 = slot.next();
    t.show(id2, "보유 현황을 맞췄어요");
    t.flush();
    expect(id2).not.toBe(id);
    expect([...t.shown.keys()]).toEqual([id2]);

    // 토스트에서 되돌리기 → 자기 토스트를 지운다
    dismissUndo();
    t.flush();
    expect(t.shown.size).toBe(0);
  });

  it("take는 한 번만 돌려주고 비운다, next는 매번 다른 id", () => {
    const slot = createUndoToastSlot("x");
    expect(slot.take()).toBeNull();
    const a = slot.next();
    const b = slot.next();
    expect(a).not.toBe(b);
    expect(slot.take()).toBe(b);
    expect(slot.take()).toBeNull();
  });
});

describe("HoldingsResyncDialog 배선(경로 A·B 공통)", () => {
  const src = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/forms/asset-update/screenshot/holdings-resync-dialog.tsx"), "utf8");
  it("고정 id로 토스트를 dismiss·생성하지 않는다", () => {
    expect(src).not.toContain("toast.dismiss(TOAST_ID)");
    expect(src).not.toContain("id: TOAST_ID");
    expect(src).toContain("id: undoToast.next()");
  });
  it("결과 화면 전환 2곳(경로 A handleApply·경로 B handleConfirmSame) 모두 진입 시각을 남긴다", () => {
    const n = src.match(/resultAtRef\.current = performance\.now\(\);\n\s*setStep\("result"\)/g) ?? [];
    expect(n).toHaveLength(2);
    expect(src.match(/setStep\("result"\)/g)).toHaveLength(2);
  });
  it("바깥 클릭·Escape 모두 이 창에서만 막는다(공용 dialog 기본값 변경 0)", () => {
    expect(src).toMatch(/onInteractOutside=\{\(e\) => \{\s*if \(isResultCloseGuarded\(resultAtRef\.current, performance\.now\(\)\)\) e\.preventDefault\(\);/);
    expect(src).toMatch(/onEscapeKeyDown=\{\(e\) => \{\s*if \(running \|\| applying \|\| isResultCloseGuarded\(resultAtRef\.current, performance\.now\(\)\)\) e\.preventDefault\(\);/);
    const dialog = readFileSync(path.resolve(__dirname, "../../components/ui/dialog.tsx"), "utf8");
    expect(dialog).not.toContain("onInteractOutside");
  });
});
