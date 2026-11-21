import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { RootGuideLinks, shouldInterceptClick } from "../root-guide-links";

describe("RootGuideLinks", () => {
  const html = renderToStaticMarkup(<RootGuideLinks />);
  it("SSR에 a href 3개가 year-end·net-worth·stock-ratio 순", () => {
    const ids = ["year-end", "net-worth", "stock-ratio"];
    const pos = ids.map((i) => html.indexOf(`data-testid="root-guide-link-${i}" `));
    expect(pos.every((p) => p > 0)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
    for (const i of ids) expect(html).toContain(`href="/guide/${i}"`);
  });
  it("체험·/ratio href 0, nav 이름 가이드", () => {
    expect(html).not.toContain("/ratio");
    expect(html).not.toContain("trial");
    expect(html).toContain('aria-label="가이드"');
  });
  it("보조키·휠·이미 처리된 클릭은 가로채지 않는다", () => {
    const base = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
    expect(shouldInterceptClick(base)).toBe(true);
    for (const o of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { defaultPrevented: true }])
      expect(shouldInterceptClick({ ...base, ...o })).toBe(false);
  });
});
