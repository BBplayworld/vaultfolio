import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
export const launch = () => chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
export async function enter(b, base, w, { light = false, h = 1000 } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: "reduce", colorScheme: light ? "light" : "dark" });
  await ctx.addCookies([{ name: "theme_mode", value: light ? "light" : "dark", url: base }]);
  const p = await ctx.newPage(); const errs = [];
  p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 200))); p.on("pageerror", (e) => errs.push("PE " + String(e).slice(0, 200)));
  await p.clock.setFixedTime(new Date("2026-11-26T03:00:00Z"));
  await p.goto(base + "/", { waitUntil: "networkidle" }).catch(() => {});
  await p.click('[data-testid="welcome-trial-link"]');
  await p.waitForFunction(() => !!localStorage.getItem("secretasset_asset_data"), null, { timeout: 20000 });
  await p.waitForTimeout(1500);
  return { ctx, p, errs };
}
// max-[360px]: 접두를 가진 요소의 계산 스타일 서명(폭에 따라 달라지는 px 값은 제외)
export const sig = (p) => p.evaluate(() => {
  const props = ["display", "flexWrap", "flexBasis", "order", "maxWidth", "fontSize", "whiteSpace", "justifyContent", "marginLeft", "paddingLeft", "minHeight", "columnGap", "rowGap", "position", "gridColumnEnd"];
  const de = document.documentElement;
  const els = [...document.querySelectorAll('[class*="max-[360px]:"],[class*="max-[359px]:"]')];
  return { hScroll: de.scrollWidth - de.clientWidth, n: els.length, items: els.map((e) => { const s = getComputedStyle(e); const cls = (typeof e.className === "string" ? e.className : "").split(/\s+/).filter((c) => /max-\[3(59|60)px\]:/.test(c)).map((c) => c.replace("359", "360")).join(" "); return cls + " => " + props.map((k) => s[k]).join("|") + "|cols" + (s.display.includes("grid") ? s.gridTemplateColumns.split(" ").length : "-"); }) };
});
