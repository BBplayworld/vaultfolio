import { chromium, proxy, open, toReport, lines, box, OUT } from "./review-5127-lib.mjs";
const br = await chromium.launch({ proxy }); const out = {};
const only = process.argv[2];
const hit = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); const cx = b.left + b.width / 2; let up = 0, dn = 0; for (let d = 0; d < 40; d++) { const t = document.elementFromPoint(cx, b.top + b.height / 2 - d); if (t && (e.contains(t) || t === e)) up = d; else break; } for (let d = 0; d < 40; d++) { const t = document.elementFromPoint(cx, b.top + b.height / 2 + d); if (t && (e.contains(t) || t === e)) dn = d; else break; } return [Math.round(b.width), Math.round(b.height), up + dn + 1]; }, sel);
for (const [W, scheme] of [[390, "dark"], [390, "light"], [320, "dark"], [320, "light"], [1280, "dark"], [1280, "light"]]) {
  const tag = `${W}-${scheme}`; if (only && only !== tag) continue; const o = (out[tag] = {});
  const { ctx, p } = await open(br, W, scheme);
  await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(2500);
  o.hub = { desc: await lines(p, '[data-testid="hub-card-report"]'), box: await box(p, '[data-testid="hub-card-report"]'), div: await box(p, '[data-testid="hub-card-dividend"]') };
  await p.screenshot({ path: `${OUT}/r7-hub-${tag}.png` });
  await toReport(p);
  o.html = await p.evaluate(() => document.documentElement.className);
  o.seg = await lines(p, '[data-testid="report-tabs"]');
  o.kinds = { text: await lines(p, '[data-testid="grow-kinds"]'), box: await box(p, '[data-testid="grow-kinds"]'), hit: await hit(p, '[data-testid="grow-kind"][data-kind="crypto"]'), selBg: await p.evaluate(() => getComputedStyle(document.querySelector('[data-testid="grow-kind"][aria-selected="true"]')).backgroundColor), canvas: await p.evaluate(() => getComputedStyle(document.body).backgroundColor) };
  o.pick = { l: await lines(p, '[data-testid="grow-pick"]'), hit: await hit(p, '[data-testid="grow-pick-toggle"]') };
  o.rowBottoms = await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row-toggle"]')].slice(0, 4).map((e) => Math.round(e.getBoundingClientRect().bottom)));
  o.docW = await p.evaluate(() => document.documentElement.scrollWidth);
  o.cardText = await lines(p, '[data-testid="grow-total-card"]');
  o.listText = await lines(p, '[data-testid="grow-list"]');
  await p.screenshot({ path: `${OUT}/r7-01-stock-${tag}.png` });
  await p.screenshot({ path: `${OUT}/r7-01f-stock-full-${tag}.png`, fullPage: true });
  await p.click('[data-testid="grow-pick-toggle"]'); await p.waitForTimeout(600);
  o.panel = { text: await lines(p, '[data-testid="grow-pick-panel"]'), h: (await box(p, '[data-testid="grow-pick-panel"]'))?.[3],
    cells: await p.evaluate(() => { const on = document.querySelector('i[data-on="true"]'), off = document.querySelector('i[data-on="false"]'); const pn = document.querySelector('[data-testid="grow-pick-panel"]'); const card = document.querySelector('[data-testid="grow-total-card"]'); return { on: getComputedStyle(on).backgroundColor, off: getComputedStyle(off).backgroundColor, w: Math.round(on.getBoundingClientRect().width * 10) / 10, panel: getComputedStyle(pn).backgroundColor, card: getComputedStyle(card).backgroundColor }; }),
    bold: await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-pick-panel"] *, [data-testid="grow-pick"] *')].filter((e) => e.children.length === 0 && e.textContent.trim() && +getComputedStyle(e).fontWeight >= 600).map((e) => e.textContent.trim())),
    rowHit: await hit(p, '[data-testid="grow-pick-row"][data-kind="same"]'), hitHit: await hit(p, '[data-testid="grow-pick-hit"]'), panelBox: await box(p, '[data-testid="grow-pick-panel"]') };
  await p.screenshot({ path: `${OUT}/r7-09-panel-${tag}.png` });
  await p.locator('[data-testid="grow-total-card"]').screenshot({ path: `${OUT}/r7-09c-panel-card-${tag}.png` });
  for (const k of ["set", "same", "move"]) { await p.click(`[data-testid="grow-pick-row"][data-kind="${k}"]`); await p.waitForTimeout(350); (o.filter ??= {})[k] = { fact: await lines(p, '[data-testid="grow-filter-fact"]'), rows: await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row"]')].map((e) => e.dataset.ticker)) }; if (k === "same") await p.screenshot({ path: `${OUT}/r7-09d-filter-${tag}.png` }); }
  for (const k of ["grow-pick-hit", "grow-pick-buy"]) { await p.click(`[data-testid="${k}"]`); await p.waitForTimeout(350); o.filter[k] = { fact: await lines(p, '[data-testid="grow-filter-fact"]'), rows: await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row"]')].map((e) => e.dataset.ticker)) }; }
  await p.click('[data-testid="grow-pick-hint"] button'); await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/r7-hint-pick-${tag}.png` }); o.hintPick = await lines(p, '[data-radix-popper-content-wrapper]'); await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  // 배타: 기준 칸
  await p.click('[data-testid^="grow-axis-"]'); await p.waitForTimeout(500);
  o.exclusive = await p.evaluate(() => ({ pickOpen: document.querySelector('[data-testid="grow-pick-toggle"]').getAttribute("aria-expanded"), fact: document.querySelector('[data-testid="grow-filter-fact"]')?.textContent ?? null, groups: !!document.querySelector('[data-testid="grow-groups"]') }));
  await p.click('[data-testid^="grow-axis-"]'); await p.waitForTimeout(400);
  await p.click('[data-testid="grow-row"][data-ticker="AAPL"] [data-testid="grow-row-toggle"]'); await p.waitForTimeout(700);
  o.aapl = await lines(p, '[data-testid="grow-row"][data-ticker="AAPL"]');
  o.aaplBtn = await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row"][data-ticker="AAPL"] button[data-testid^="grow-choice-"]')].map((e) => Math.round(e.getBoundingClientRect().height)));
  await p.locator('[data-testid="grow-row"][data-ticker="AAPL"]').screenshot({ path: `${OUT}/r7-11-history-${tag}.png` });
  // 코인
  await p.click('[data-testid="grow-kind"][data-kind="crypto"]'); await p.waitForTimeout(800);
  o.coin = { kinds: await lines(p, '[data-testid="grow-kinds"]'), card: await lines(p, '[data-testid="grow-total-card"]'), list: await lines(p, '[data-testid="grow-list"]'), toggle: await p.locator('[data-testid="grow-pick-toggle"]').count(), panel: await p.locator('[data-testid="grow-pick-panel"]').count() };
  await p.screenshot({ path: `${OUT}/r7-08-coin-${tag}.png` });
  const ch = p.locator('[data-testid="grow-total-card"] [data-screenshot-hide] button').first();
  if (await ch.count()) { await ch.click(); await p.waitForTimeout(500); o.coin.hint = await lines(p, '[data-radix-popper-content-wrapper]'); await p.screenshot({ path: `${OUT}/r7-hint-coin-${tag}.png` }); await p.keyboard.press("Escape"); await p.waitForTimeout(300); }
  await p.click('[data-testid="grow-row-toggle"]'); await p.waitForTimeout(700); o.coin.sheet = await lines(p, '[data-testid="grow-row"]'); await p.screenshot({ path: `${OUT}/r7-08b-coin-sheet-${tag}.png`, fullPage: true });
  // 부동산·실물
  await p.click('[data-testid="grow-kind"][data-kind="real"]'); await p.waitForTimeout(800);
  o.own = { kinds: await lines(p, '[data-testid="grow-kinds"]'), kindsBox: await box(p, '[data-testid="grow-kinds"]'), card: await p.locator('[data-testid="grow-total-card"]').count(), list: await lines(p, '[data-testid="grow-list"]'), rowH: (await box(p, '[data-testid="grow-row-toggle"]'))?.[3] };
  await p.screenshot({ path: `${OUT}/r7-07-own-${tag}.png` });
  await p.click('[data-testid="grow-own-hint"] button'); await p.waitForTimeout(500); o.own.hint = await lines(p, '[data-radix-popper-content-wrapper]'); await p.screenshot({ path: `${OUT}/r7-hint-own-${tag}.png` }); await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  await p.click('[data-testid="grow-row-toggle"]'); await p.waitForTimeout(700);
  o.own.sheet = { all: await lines(p, '[data-testid="grow-row"]'), value: await lines(p, '[data-testid="grow-value"]'), valueBox: await box(p, '[data-testid="grow-value"]'), editBox: await box(p, '[data-testid="grow-value-edit"]'), mineBox: await box(p, '[data-testid="grow-value-mine"]'), editHit: await hit(p, '[data-testid="grow-value-edit"]'), btn: await p.evaluate(() => [...document.querySelectorAll('button[data-testid^="grow-choice-"]')].map((e) => [e.textContent, Math.round(e.getBoundingClientRect().height)])) };
  await p.screenshot({ path: `${OUT}/r7-07b-own-sheet-${tag}.png`, fullPage: true });
  // 수정 창 → 닫기 → 포커스
  await p.focus('[data-testid="grow-value-edit"]'); await p.keyboard.press("Enter"); await p.waitForTimeout(1500);
  o.own.dialog = await p.evaluate(() => document.querySelector('[role="dialog"]')?.textContent.slice(0, 40) ?? null);
  await p.screenshot({ path: `${OUT}/r7-07d-own-edit-${tag}.png` });
  await p.keyboard.press("Escape"); await p.waitForTimeout(1200);
  o.own.afterClose = await p.evaluate(() => ({ dialog: !!document.querySelector('[role="dialog"]'), active: document.activeElement?.dataset?.testid ?? document.activeElement?.tagName, activeText: document.activeElement?.textContent?.slice(0, 30), sheetOpen: document.querySelector('[data-testid="grow-row-toggle"]')?.getAttribute("aria-expanded"), valueVisible: !!document.querySelector('[data-testid="grow-value"]')?.getBoundingClientRect().height }));
  await p.screenshot({ path: `${OUT}/r7-07e-own-after-close-${tag}.png` });
  o.errs = p.errs;
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await br.close();
