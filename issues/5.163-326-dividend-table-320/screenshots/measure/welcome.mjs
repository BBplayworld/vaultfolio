import { launch, BASE } from "./lib.mjs";
const b = await launch(); const out = {};
for (const w of [320, 360, 375, 390]) {
  const p = await (await b.newContext({ viewport: { width: w, height: 800 } })).newPage();
  await p.goto(BASE + "/", { waitUntil: "networkidle" }).catch(() => {});
  await p.waitForSelector('[data-testid="welcome-cta-wizard"]');
  await p.waitForTimeout(1200);
  out[w] = await p.evaluate(() => {
    const el = document.querySelector('[data-testid="welcome-hero"] p'); const cs = getComputedStyle(el);
    const de = document.documentElement;
    return { text: el.textContent, lines: Math.round(el.getBoundingClientRect().height / parseFloat(cs.lineHeight)), w: Math.round(el.getBoundingClientRect().width), ctaTop: Math.round(document.querySelector('[data-testid="welcome-cta-wizard"]').getBoundingClientRect().top), hScroll: de.scrollWidth - de.clientWidth };
  });
  await p.context().close();
}
console.log(JSON.stringify(out)); await b.close();
