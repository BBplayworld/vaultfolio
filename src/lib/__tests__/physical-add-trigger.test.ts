// #58 — FAB 실물 행이 연 이벤트를 PhysicalInput이 실제로 듣는지 고정(ADD_TRIGGER_EVENTS에 빠지면 행이 무반응)
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ADD_TRIGGER_EVENTS } from "@/app/(main)/_components/layout/navigation/asset-dispatch";

describe("실물 추가 트리거", () => {
  it("ADD_TRIGGER_EVENTS.physical = trigger-add-physical", () => {
    expect(ADD_TRIGGER_EVENTS.physical).toBe("trigger-add-physical");
  });
  it("PhysicalInput이 같은 이벤트를 수신하고 dispatchAddPhysical도 같은 이벤트를 쏜다", () => {
    const input = readFileSync("src/app/(main)/_components/forms/asset-update/input/physical-input.tsx", "utf8");
    expect(input).toContain(`addEventListener("${ADD_TRIGGER_EVENTS.physical}"`);
    const dispatch = readFileSync("src/app/(main)/_components/layout/navigation/asset-dispatch.ts", "utf8");
    expect(dispatch).toContain(`new CustomEvent("${ADD_TRIGGER_EVENTS.physical}")`);
  });
});
