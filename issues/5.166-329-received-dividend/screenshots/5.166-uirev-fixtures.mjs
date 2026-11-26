import { launch, BASE, SHOTS, mockDividend } from "./lib.mjs";
import fs from "node:fs";
const base = JSON.parse(fs.readFileSync("./trial-store.json", "utf8"));
const after = JSON.parse(fs.readFileSync("./after-store.json", "utf8"));
const mod = (src, fn) => { const s = JSON.parse(JSON.stringify(src)); const ad = JSON.parse(s.secretasset_asset_data); fn(ad); s.secretasset_asset_data = JSON.stringify(ad); return s; };
const browser = await launch();
async function open(width, theme, store, noMock) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: "theme_mode", value: theme, url: BASE }]);
  const page = await ctx.newPage();
  const bad = []; page.on("response", (r) => { if (r.status() >= 500) bad.push(r.url().replace(BASE, "").slice(0, 80)); });
  if (!noMock) await mockDividend(page);
  await page.addInitScript((st) => { if (!sessionStorage.getItem("__s")) { for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v); sessionStorage.setItem("__s", "1"); } }, store);
  await page.goto(`${BASE}/#activity/dividend`); await page.waitForTimeout(3500);
  return { ctx, page, bad };
}
const clip = async (page, name, h = 300) => { const t = await page.evaluate(() => document.querySelector('[data-slot="card-title"], h1, h2')?.getBoundingClientRect().top ?? 100); await page.screenshot({ path: `${SHOTS}/${name}.png`, clip: { x: 0, y: Math.max(0, 120), width: page.viewportSize().width, height: h } }); };
for (const [w, t] of [[320, "light"], [375, "light"], [375, "dark"], [1280, "light"]]) {
  // 현금 계좌 0 → 다음 지급 유지
  { const { ctx, page, bad } = await open(w, t, mod(base, (ad) => { ad.cash = []; ad.cashTransactions = []; }));
    const r = await page.evaluate(() => { const row = document.querySelector('[data-testid="dividend-conclusion"]'); return { text: row?.textContent, h: row?.getBoundingClientRect().height, chip: !!document.querySelector('[data-testid="dividend-received"]'), next: !!document.querySelector('[data-testid="dividend-conclusion-next"]'), tops: row ? [...row.children].map((c) => Math.round(c.getBoundingClientRect().top)) : null }; });
    console.log(w, t, "cash0", JSON.stringify(r), "5xx", [...new Set(bad)].join(","));
    await clip(page, `${w}-${t}-12-cash0-next`); await ctx.close(); }
  // 계산 0 · 기록만 → solo 칩
  { const { ctx, page } = await open(w, t, mod(after, (ad) => { ad.stocks = []; }));
    const r = await page.evaluate(() => { const solo = document.querySelector('[data-testid="dividend-received-solo"]'); const chip = solo?.querySelector("button"); const cr = chip?.getBoundingClientRect(); let hit = 0; if (cr) { const x = cr.left + cr.width / 2; for (let y = cr.top - 30; y < cr.bottom + 30; y++) { const el = document.elementFromPoint(x, y); if (el && (el === chip || chip.contains(el))) hit++; } }
      const card = solo?.closest('[data-slot="card-content"]'); const nextEl = solo?.nextElementSibling; return { text: chip?.textContent, aria: chip?.getAttribute("aria-label"), w: cr && Math.round(cr.width), h: cr && Math.round(cr.height * 10) / 10, left: cr && cr.left, hit, hero: !!document.querySelector('[data-testid="dividend-conclusion"]'), soloTop: solo && Math.round(solo.getBoundingClientRect().top), nextTop: nextEl && Math.round(nextEl.getBoundingClientRect().top), nextText: nextEl?.textContent.slice(0, 40), count: document.querySelectorAll('[data-testid="dividend-received"]').length, ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
    console.log(w, t, "solo", JSON.stringify(r));
    await page.screenshot({ path: `${SHOTS}/${w}-${t}-13-solo.png`, clip: { x: 0, y: 100, width: w, height: 420 } });
    if (r.text) { await page.keyboard.press("Tab"); await page.locator('[data-testid="dividend-received"]').focus(); await page.waitForTimeout(200); const b = await page.locator('[data-testid="dividend-received"]').boundingBox(); await page.screenshot({ path: `${SHOTS}/${w}-${t}-13b-solo-focus.png`, clip: { x: Math.max(0, b.x - 24), y: b.y - 16, width: b.width + 48, height: b.height + 32 } }); }
    await ctx.close(); }
}
// 767/768/1279 칩 높이 = 줄 높이, 줄 수
for (const w of [360, 430, 767, 768, 1024, 1279]) { const { ctx, page } = await open(w, "light", after);
  const r = await page.evaluate(() => { const row = document.querySelector('[data-testid="dividend-conclusion"]'); const chip = row.querySelector("button"); return { lh: getComputedStyle(row).lineHeight, chipH: chip.getBoundingClientRect().height, rowH: row.getBoundingClientRect().height, tops: [...row.children].map((c) => Math.round(c.getBoundingClientRect().top)), chipLeft: chip.getBoundingClientRect().left, rowLeft: row.getBoundingClientRect().left, ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
  console.log(w, "bp", JSON.stringify(r)); await ctx.close(); }
// 다크 트리거 히트 38 원인
{ const { ctx, page } = await open(375, "dark", base); await page.locator('[data-testid="dividend-received"]').click(); await page.waitForTimeout(600);
  const r = await page.evaluate(() => { const t = document.querySelector('[data-testid="cash-tx-dividend-stock"]'); const b = t.getBoundingClientRect(); const x = b.left + b.width / 2; const at = (y) => { const e = document.elementFromPoint(x, y); return e === t || t.contains(e) ? "trig" : (e.tagName + "." + (e.getAttribute("for") || e.className.toString().slice(0, 30))); }; const cs = getComputedStyle(t); const a = getComputedStyle(t, "::after"); return { top: b.top, bottom: b.bottom, border: cs.borderTopWidth, afterTop: a.top, afterBottom: a.bottom, afterH: a.height, pts: [-3, -2, -1, 0].map((d) => at(b.top + d)).concat([0, 1, 2, 3].map((d) => at(b.bottom - 1 + d))) }; });
  console.log("dark trig", JSON.stringify(r)); await ctx.close(); }
// 조작 없는 자연 상태(배당 API 대체 없음) + 기록 있음 → solo인지
{ const { ctx, page, bad } = await open(375, "light", base, true); console.log("natural 5xx", [...new Set(bad)].join(",")); await ctx.close(); }
await browser.close();
