import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

// #215 타이포 스케일 — `text-2xs`가 tailwind-merge에서 크기 클래스로 인식되는지 고정한다.
describe("cn — text-2xs 병합", () => {
  it("크기끼리는 뒤의 것이 이긴다", () => {
    expect(cn("text-sm", "text-2xs")).toBe("text-2xs");
    expect(cn("text-[11px]", "text-2xs")).toBe("text-2xs");
    expect(cn("text-2xs", "md:text-xs")).toBe("text-2xs md:text-xs");
  });

  it("색 클래스와 서로 지우지 않는다", () => {
    expect(cn("text-2xs", "text-muted-foreground")).toBe("text-2xs text-muted-foreground");
    expect(cn("text-muted-foreground", "text-2xs")).toBe("text-muted-foreground text-2xs");
  });

  it("줄높이 클래스는 크기 뒤에 둬야 남는다(text-sm과 같은 동작)", () => {
    expect(cn("text-2xs", "leading-tight")).toBe("text-2xs leading-tight");
    expect(cn("leading-tight", "text-2xs")).toBe("text-2xs");
  });
});
