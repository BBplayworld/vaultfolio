import { launch, HEAD, MAIN, blockExternal, setTheme } from "./lib.mjs";
const b = await launch(); const out = {}; const ext = [];
for (const [tag, base] of [["head", HEAD], ["main", MAIN]]) for (const w of [320, 360, 375, 390, 430, 1280]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 800 } }); await blockExternal(ctx, ext); await setTheme(ctx, base, "dark");
  const p = await ctx.newPage(); const errs = []; p.on("console", (m) => m.type() === "error" && !/ERR_FAILED|Failed to load resource/.test(m.text()) && errs.push(m.text().slice(0, 160)));
  await p.goto(base + "/", { waitUntil: "networkidle" }).catch(() => {});
  await p.waitForSelector('[data-testid="welcome-cta-wizard"]'); await p.waitForTimeout(1200);
  out[`${tag}-${w}`] = await p.evaluate(() => {
    const hero = document.querySelector('[data-testid="welcome-hero"]'); const el = hero.querySelector("p"); const cs = getComputedStyle(el);
    // 글자 단위 줄 나눔
    const tn = el.firstChild; const lines = []; let lastTop = null;
    for (let i = 0; i < tn.length; i++) { const r = document.createRange(); r.setStart(tn, i); r.setEnd(tn, i + 1); const rc = r.getClientRects()[0]; if (!rc) continue; const t = Math.round(rc.top); if (lastTop === null || Math.abs(t - lastTop) > 4) { lines.push(""); lastTop = t; } lines[lines.length - 1] += tn.data[i]; }
    const de = document.documentElement;
    const btns = [...document.querySelectorAll("main button, main a, [data-testid^='welcome-']")].filter((x) => (x.tagName === "BUTTON" || x.tagName === "A") && x.getClientRects().length).map((x) => x.innerText.replace(/\n/g, " ").trim().slice(0, 30));
    return { text: el.textContent, lines, pW: Math.round(el.getBoundingClientRect().width), cls: el.className, h1: hero.querySelector("h1").textContent, ctaTop: Math.round(document.querySelector('[data-testid="welcome-cta-wizard"]').getBoundingClientRect().top), hScroll: de.scrollWidth - de.clientWidth, btns, bodyText: document.body.innerText.replace(/\s+/g, " ").slice(0, 400) };
  });
  out[`${tag}-${w}`].errs = errs;
  if (tag === "head" && [320, 375, 1280].includes(w)) await p.screenshot({ path: `${process.argv[2]}/welcome-${w}-dark.png` });
  await ctx.close();
  if (tag === "head" && w === 390) { const c2 = await b.newContext({ viewport: { width: 390, height: 800 } }); await blockExternal(c2); await setTheme(c2, base, "light"); const p2 = await c2.newPage(); await p2.goto(base + "/", { waitUntil: "networkidle" }).catch(() => {}); await p2.waitForTimeout(1200); await p2.screenshot({ path: `${process.argv[2]}/welcome-390-light.png` }); await c2.close(); }
}
// JS 꺼진 사전 조각(SSR HTML)
const c3 = await b.newContext({ viewport: { width: 320, height: 800 }, javaScriptEnabled: false }); const p3 = await c3.newPage(); await p3.goto(HEAD + "/").catch(() => {});
out.nojs = await p3.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 300));
await c3.close();
out.ext = [...new Set(ext)];
console.log(JSON.stringify(out, null, 1)); await b.close();
