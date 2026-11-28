// #371(5.181) 동승 — 코인 '반영된 기록 삭제' 확인창 본문 줄바꿈(break-keep text-pretty)·같은 화면 문구 해요체(소스 고정)
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(__dirname, "../../app/(main)/_components/views/detail/crypto-tx/crypto-tx-view.tsx"), "utf8");

describe("코인 거래 삭제 확인창 문구", () => {
  it("반영 기록 삭제 본문은 어절 단위로만 꺾인다", () => {
    expect(src).toMatch(/<p className="text-sm text-muted-foreground break-keep text-pretty">\s*이 기록은 보유 수량·평단에 반영돼 있어요\. 삭제하면 포지션이 되돌아가요\./);
  });
  it("같은 화면 안내·결과 토스트에 합니다체가 남지 않는다", () => {
    expect(src).not.toMatch(/습니다|되었습니다|됩니다/);
    for (const s of ["삭제하고 포지션을 되돌렸어요.", "매수/매도 내역이 표시돼요.", "매수/매도 기록이 없어요.", '"삭제했어요."']) expect(src).toContain(s);
  });
});
