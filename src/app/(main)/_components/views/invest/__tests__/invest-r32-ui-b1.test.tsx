// 5.142 #278 B1 화면(SSR 마크업): 시작 연도 선택지 1개
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InvestView } from "../invest-view";
import { B1_OPTION } from "@/lib/invest/text";

describe("B1(기간 카드)", () => {
  const app = (p: Partial<React.ComponentProps<typeof InvestView>> = {}) => renderToStaticMarkup(<InvestView variant="app" defaultIndex="spx" {...p} />);
  it("B1: firstBuyYear가 있고 앱이며 범위 안일 때만 시작 선택지 1개, 가이드·미지정·범위 밖은 0", () => {
    expect(app({ firstBuyYear: 2015 })).toContain(`<option value="mine">${B1_OPTION(2015)}</option>`);
    expect(app()).not.toContain('value="mine"');
    expect(renderToStaticMarkup(<InvestView variant="guide" defaultIndex="spx" firstBuyYear={2015} />)).not.toContain('value="mine"');
    expect(app({ firstBuyYear: 1959 })).not.toContain('value="mine"');
    expect(app({ firstBuyYear: 2030 })).not.toContain('value="mine"');
    expect(app({ firstBuyYear: 2015 }).match(/value="mine"/g)).toHaveLength(1);
  });
});
