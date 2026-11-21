import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { RootGuideLinks } from "../root-guide-links";

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
});
