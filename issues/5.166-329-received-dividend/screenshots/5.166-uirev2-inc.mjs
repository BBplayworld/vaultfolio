import { launch, BASE, SHOTS, mockDividend } from "./lib.mjs";
import fs from "node:fs";
const base = JSON.parse(fs.readFileSync("./trial-store.json", "utf8"));
const browser = await launch();
for (const [w, t] of [[320, "light"], [320, "dark"], [375, "light"], [375, "dark"], [390, "light"], [1280, "light"], [1280, "dark"]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: "theme_mode", value: t, url: BASE }]);
  const page = await ctx.newPage(); await mockDividend(page);
  await page.addInitScript((st) => { if (!sessionStorage.getItem("__s")) { for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v); sessionStorage.setItem("__s", "1"); } }, base);
  await page.goto(`${BASE}/#activity/dividend`); await page.waitForSelector('[data-testid="dividend-received"]'); await page.waitForTimeout(1200);
  const tag = `${w}-${t}`; const r = {};
  // R2
  await page.keyboard.press("Tab"); await page.locator('[data-testid="dividend-received"]').focus(); await page.waitForTimeout(250);
  const b = await page.locator('[data-testid="dividend-received"]').boundingBox();
  await page.screenshot({ path: `${SHOTS}/${tag}-R2-focus.png`, clip: { x: Math.max(0, b.x - 40), y: b.y - 34, width: Math.min(w, 300), height: b.height + 50 } });
  r.r2 = await page.evaluate(() => { const row = document.querySelector('[data-testid="dividend-conclusion"]'); const chip = row.querySelector("button"); const frags = [...row.children]; const rowL = row.getBoundingClientRect().left; const clip = getComputedStyle(row).clipPath;
    const dots = frags.map((f) => { const d = f.querySelector(":scope > span[aria-hidden]"); if (!d) return null; const rg = document.createRange(); rg.selectNodeContents(d); const g = [...rg.getClientRects()].find((x) => x.width > 0); return { top: Math.round(f.getBoundingClientRect().top), glyph: g ? [Math.round(g.left * 100) / 100, Math.round(g.right * 100) / 100] : null }; });
    let hit = 0; const cr = chip.getBoundingClientRect(); const x = cr.left + cr.width / 2; for (let y = cr.top - 30; y < cr.bottom + 30; y++) { const el = document.elementFromPoint(x, y); if (el && (el === chip || chip.contains(el))) hit++; }
    return { clip, clipEdge: rowL + 5, chipLeft: cr.left, ringLeft: cr.left - 3, fv: chip.matches(":focus-visible"), dots, rowH: row.getBoundingClientRect().height, hit, ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
  await page.evaluate(() => document.activeElement.blur());
  // 줄 머리 점 픽셀 검사: 포커스 없이 줄 왼쪽 0~clipEdge 영역 캡처
  await page.screenshot({ path: `${SHOTS}/${tag}-R2-linehead.png`, clip: { x: 0, y: b.y - 26, width: Math.min(w, 120), height: b.height + 30 } });
  // R1 / R3
  await page.locator('[data-testid="dividend-received"]').click(); await page.waitForSelector('[data-testid="cash-tx-kind-group"]'); await page.waitForTimeout(500);
  const m = () => page.evaluate(() => { const [a, d] = document.querySelector('[data-testid="cash-tx-kind-group"]').children; const lab = a.querySelector("label"); const vis = lab.children[0]; const cb = a.querySelector("button"); const ar = a.getBoundingClientRect(), vr = vis.getBoundingClientRect(), cr = cb.getBoundingClientRect(); const help = document.getElementById("cash-tx-recurring-help");
    const rg = document.createRange(); rg.selectNodeContents(help); const lines = new Set([...rg.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size;
    const t = document.querySelector('[data-testid="cash-tx-dividend-stock"]'); const tb = t.getBoundingClientRect(); let th = 0; const x = tb.left + tb.width / 2; for (let y = tb.top - 10; y < tb.bottom + 10; y++) { const el = document.elementFromPoint(x, y); if (el && (el === t || t.contains(el))) th++; }
    return { recH: ar.height, divTop: d.getBoundingClientRect().top, divH: d.getBoundingClientRect().height, padTop: Math.round((vr.top - ar.top) * 10) / 10, padBottom: Math.round((ar.bottom - vr.bottom) * 10) / 10, cbCenter: cr.top + cr.height / 2 - ar.top, textCenter: vr.top + vr.height / 2 - ar.top, help: help.textContent, helpLines: lines, helpCount: document.querySelectorAll("#cash-tx-recurring-help").length, describedby: cb.getAttribute("aria-describedby"), disabled: cb.disabled, labelH: lab.getBoundingClientRect().height, trigHit: th, trigBorder: getComputedStyle(t).borderTopWidth, dlgOvf: document.querySelector('[role="dialog"]').scrollWidth - document.querySelector('[role="dialog"]').clientWidth }; });
  r.on = await m();
  await page.locator('[data-testid="cash-tx-kind-group"]').screenshot({ path: `${SHOTS}/${tag}-R1-on.png` });
  await page.locator('[role="dialog"]').screenshot({ path: `${SHOTS}/${tag}-R1-form-on.png` });
  await page.click('[data-testid="cash-tx-dividend-check"]'); await page.waitForTimeout(400);
  r.off = await m();
  await page.locator('[data-testid="cash-tx-kind-group"]').screenshot({ path: `${SHOTS}/${tag}-R1-off.png` });
  // 끈 상태에서 정기 label 눌러 체크되는지, 켠 상태에서는 안 되는지
  await page.locator('label[for="cash-tx-recurring"]').click({ position: { x: 20, y: 8 } }); await page.waitForTimeout(150);
  r.labelClick = await page.evaluate(() => document.querySelector('[data-testid="cash-tx-recurring-check"]').dataset.state);
  await page.click('[data-testid="cash-tx-dividend-check"]'); await page.waitForTimeout(400);
  r.afterDivOn = await page.evaluate(() => ({ rec: document.querySelector('[data-testid="cash-tx-recurring-check"]').dataset.state, dis: document.querySelector('[data-testid="cash-tx-recurring-check"]').disabled }));
  console.log(tag, JSON.stringify(r));
  await ctx.close();
}
await browser.close();
