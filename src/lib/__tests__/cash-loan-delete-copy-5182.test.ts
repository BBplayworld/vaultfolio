// #374(5.182) 현금·대출 '반영된 기록 삭제' 확인창 본문 줄바꿈(break-keep text-pretty)·확인창·토스트 해요체(소스 고정, 코인 5.181과 동일)
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(__dirname, "../../app/(main)/_components/views/detail", p), "utf8");
const FILES = { 현금: read("cash-tx/cash-tx-view.tsx"), 대출: read("loan-tx/loan-tx-view.tsx") };

describe.each(Object.entries(FILES))("%s 거래 삭제 확인창 문구", (_name, src) => {
  it("반영 기록 삭제 본문은 어절 단위로만 꺾인다(break-keep text-pretty) + 해요체", () => {
    expect(src).toMatch(/<p className="text-sm text-muted-foreground break-keep text-pretty">\s*이 기록은 잔액에 반영돼 있어요\. 삭제하면 잔액이 되돌아가요\./);
    expect(src).not.toContain("반영되어 있습니다");
    expect(src).not.toContain("되돌아갑니다");
  });
  it("삭제 결과 토스트는 해요체", () => {
    expect(src).toContain("삭제하고 잔액을 되돌렸어요.");
    expect(src).toContain('toast.success("삭제했어요.")');
    expect(src).not.toMatch(/되돌렸습니다|삭제되었습니다/);
  });
});
