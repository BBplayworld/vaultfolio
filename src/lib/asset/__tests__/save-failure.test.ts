// #93 p2-6: 자동 저장이 여러 번 실패해도 토스트·계측은 세션당 1회, 성공 시 0회
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ ok: false, toastError: vi.fn(), track: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: h.toastError } }));
vi.mock("@/lib/analytics/ga", () => ({ track: h.track }));
vi.mock("@/lib/asset/asset-storage", () => ({ saveAssetData: () => h.ok }));

import { __resetSaveFailureForTest, saveAssetDataNotify } from "../save-failure";
import type { AssetData } from "@/types/asset";

const data = {} as AssetData;

describe("saveAssetDataNotify", () => {
  beforeEach(() => {
    __resetSaveFailureForTest();
    h.toastError.mockClear();
    h.track.mockClear();
    (globalThis as Record<string, unknown>).window = globalThis;
  });

  it("quota 실패가 반복돼도 토스트 1회·GA 저장 실패 1건(값 0), 반환값은 false 그대로", () => {
    h.ok = false;
    expect([saveAssetDataNotify(data), saveAssetDataNotify(data), saveAssetDataNotify(data)]).toEqual([false, false, false]);
    expect(h.toastError).toHaveBeenCalledTimes(1);
    expect(h.track).toHaveBeenCalledTimes(1);
    expect(h.track).toHaveBeenCalledWith("feature_use", { category: "save_failed" });
    const msg = String(h.toastError.mock.calls[0][0]);
    expect(msg).toBe("저장하지 못했어요. 백업 파일을 내려받아 두세요");
  });

  it("성공하면 알림 0", () => {
    h.ok = true;
    expect(saveAssetDataNotify(data)).toBe(true);
    expect(h.toastError).not.toHaveBeenCalled();
    expect(h.track).not.toHaveBeenCalled();
  });
});
