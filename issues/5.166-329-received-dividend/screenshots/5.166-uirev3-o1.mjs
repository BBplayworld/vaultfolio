import { launch, BASE, SHOTS, mockDividend, wordBreakFn } from "./lib.mjs";
import fs from "node:fs";
const base = JSON.parse(fs.readFileSync("./trial-store.json", "utf8")); const after = JSON.parse(fs.readFileSync("./after-store.json", "utf8"));
const mod = (src) => { const s = JSON.parse(JSON.stringify(src)); const ad = JSON.parse(s.secretasset_asset_data); ad.stocks = []; s.secretasset_asset_data = JSON.stringify(ad); return s; };
const browser = await launch();
for (const [w, t] of [[320, "light"], [320, "dark"], [390, "light"], [390, "dark"]]) for (const [name, store] of [["rec", mod(after)], ["zero", mod(base)]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: "theme_mode", value: t, url: BASE }]);
  const page = await ctx.newPage(); await mockDividend(page);
  await page.addInitScript((st) => { if (!sessionStorage.getItem("__s")) { for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v); sessionStorage.setItem("__s", "1"); } }, store);
  await page.goto(`${BASE}/#activity/dividend`); await page.waitForTimeout(3500);
  const r = await page.evaluate((wb) => { const f = eval(wb); const ps = [...document.querySelectorAll("p")]; const second = ps.find((p) => p.textContent.includes("보유 종목에서 올해 받을 배당이 없어요")); const box = second.parentElement.parentElement; const br = box.getBoundingClientRect(); const inner = second.parentElement.getBoundingClientRect(); const chip = document.querySelector('[data-testid="dividend-received"]');
    return { title: document.querySelector('[data-testid="dividend-empty-title"]')?.textContent ?? null, chip: chip?.textContent ?? null, boxH: br.height, boxTop: Math.round(br.top), above: Math.round((inner.top - br.top) * 10) / 10, below: Math.round((br.bottom - inner.bottom) * 10) / 10, second: f(second), mt: getComputedStyle(second).marginTop, ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth }; }, wordBreakFn);
  console.log(w, t, name, JSON.stringify(r));
  await page.screenshot({ path: `${SHOTS}/${w}-${t}-O1-${name}.png`, clip: { x: 0, y: 100, width: w, height: 400 } });
  await ctx.close();
}
await browser.close();
