import { launch, BASE, SHOTS, mockDividend } from "./lib.mjs";
import fs from "node:fs";
const base = JSON.parse(fs.readFileSync("./trial-store.json", "utf8"));
const browser = await launch();
for (const [w, t] of [[320, "light"], [375, "light"], [375, "dark"], [390, "light"]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: "theme_mode", value: t, url: BASE }]);
  const page = await ctx.newPage(); await mockDividend(page);
  await page.addInitScript((st) => { if (!sessionStorage.getItem("__s")) { for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v); sessionStorage.setItem("__s", "1"); } }, base);
  await page.goto(`${BASE}/#activity/dividend`); await page.waitForSelector('[data-testid="dividend-received"]'); await page.waitForTimeout(1200);
  // (1) 포커스 링: clip 왼쪽 8px → 5px
  const res = {};
  for (const inset of ["0.5rem", "0.3125rem"]) {
    await page.evaluate((v) => { document.querySelector('[data-testid="dividend-conclusion"]').style.clipPath = `inset(-0.625rem -100vw -0.625rem ${v})`; }, inset);
    await page.keyboard.press("Tab"); await page.locator('[data-testid="dividend-received"]').focus(); await page.waitForTimeout(250);
    const b = await page.locator('[data-testid="dividend-received"]').boundingBox();
    await page.screenshot({ path: `${SHOTS}/${w}-${t}-P1-focus-clip-${inset === "0.5rem" ? "8px-now" : "5px-proposed"}.png`, clip: { x: 0, y: b.y - 34, width: Math.min(w, 260), height: b.height + 50 } });
  }
  // 줄 머리 점이 5px clip에서 보이는지: 점 글리프 실제 잉크 위치
  res.dot = await page.evaluate(() => { const row = document.querySelector('[data-testid="dividend-conclusion"]'); const frag = row.querySelector('[data-testid="dividend-conclusion-received"]'); const dot = frag.querySelector("span[aria-hidden]"); const tn = [...dot.childNodes].find((n) => n.nodeType === 3); const r = document.createRange(); r.selectNodeContents(dot); const gr = [...r.getClientRects()].find((x) => x.width > 0); const rowL = row.getBoundingClientRect().left; return { rowLeft: rowL, clipEdge8: rowL + 8, clipEdge5: rowL + 5, dotBox: [dot.getBoundingClientRect().left, dot.getBoundingClientRect().right], glyphBox: gr ? [gr.left, gr.right] : null, chipLeft: frag.querySelector("button").getBoundingClientRect().left }; });
  await page.evaluate(() => document.activeElement.blur());
  // (2) 정기 상자: 지금 vs 제안(B: label 단위 겹침·세로 가운데)
  await page.locator('[data-testid="dividend-received"]').click(); await page.waitForSelector('[data-testid="cash-tx-kind-group"]'); await page.waitForTimeout(500);
  const g = page.locator('[data-testid="cash-tx-kind-group"]');
  await g.screenshot({ path: `${SHOTS}/${w}-${t}-P2-rec-now.png` });
  res.before = await page.evaluate(() => { const [a, b] = document.querySelector('[data-testid="cash-tx-kind-group"]').children; return { recH: a.getBoundingClientRect().height, divTop: b.getBoundingClientRect().top }; });
  await page.evaluate(() => {
    const label = document.querySelector('label[for="cash-tx-recurring"]'); const title = label.children[0]; const grid = label.children[1]; const [helpDefault, helpDisabled] = grid.children;
    // 보이는 묶음(제목+비활성 도움말)과 자리만 잡는 묶음(제목+기본 도움말)을 label 칸에 겹치고 세로 가운데
    const sizer = document.createElement("span"); sizer.style.visibility = "hidden"; sizer.setAttribute("aria-hidden", "true"); sizer.style.gridArea = "1/1"; sizer.style.display = "flex"; sizer.style.flexDirection = "column";
    const t2 = title.cloneNode(true); const h2 = helpDefault.cloneNode(true); h2.classList.remove("invisible"); h2.style.marginTop = "2px"; sizer.append(t2, h2);
    const vis = document.createElement("span"); vis.style.gridArea = "1/1"; vis.style.display = "flex"; vis.style.flexDirection = "column";
    const h3 = helpDisabled.cloneNode(true); h3.style.marginTop = "2px"; vis.append(title, h3);
    grid.remove(); label.style.display = "grid"; label.style.alignItems = "center"; label.append(sizer, vis);
  });
  await page.waitForTimeout(200);
  await g.screenshot({ path: `${SHOTS}/${w}-${t}-P2-rec-proposed.png` });
  res.after = await page.evaluate(() => { const [a, b] = document.querySelector('[data-testid="cash-tx-kind-group"]').children; const lab = a.querySelector("label"); const vis = lab.lastElementChild; const cb = a.querySelector("button"); const ar = a.getBoundingClientRect(), vr = vis.getBoundingClientRect(), cr = cb.getBoundingClientRect(); return { recH: ar.height, divTop: b.getBoundingClientRect().top, padTop: vr.top - ar.top, padBottom: ar.bottom - vr.bottom, cbCenter: cr.top + cr.height / 2 - ar.top, textCenter: vr.top + vr.height / 2 - ar.top }; });
  console.log(w, t, JSON.stringify(res));
  await ctx.close();
}
await browser.close();
