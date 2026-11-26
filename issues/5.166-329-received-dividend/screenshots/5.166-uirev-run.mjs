import { launch, BASE, SHOTS, mockDividend, wordBreakFn, YEAR } from "./lib.mjs";
import fs from "node:fs";
const LONG = "TIGER 미국배당다우존스타겟커버드콜2호";
const base = JSON.parse(fs.readFileSync("./trial-store.json", "utf8"));
function fixture(kind) {
  const s = JSON.parse(JSON.stringify(base));
  const ad = JSON.parse(s["secretasset_asset_data"]);
  ad.stocks = ad.stocks.map((x) => (x.ticker === "360750" ? { ...x, name: LONG } : x));
  if (kind === "cash0") { ad.cash = []; ad.cashTransactions = []; }
  s["secretasset_asset_data"] = JSON.stringify(ad);
  return s;
}
const browser = await launch();
const R = {};
const J = (o) => JSON.stringify(o);
async function open(width, theme, store, hash = "#activity/dividend", height = 800) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: "theme_mode", value: theme, url: BASE }]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
  await mockDividend(page);
  await page.addInitScript((st) => { if (!sessionStorage.getItem("__seeded")) { for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v); sessionStorage.setItem("__seeded", "1"); } }, store);
  await page.goto(`${BASE}/${hash}`);
  return { ctx, page, errors };
}
const measureConclusion = (page) => page.evaluate(() => {
  const row = document.querySelector('[data-testid="dividend-conclusion"]');
  if (!row) return null;
  const chip = row.querySelector('[data-testid="dividend-received"]');
  const frags = [...row.children].map((c) => { const r = c.getBoundingClientRect(); return { id: c.dataset.testid.replace("dividend-conclusion-", ""), top: Math.round(r.top), left: Math.round(r.left), h: Math.round(r.height), text: c.textContent.trim() }; });
  const cr = chip?.getBoundingClientRect();
  let hit = 0;
  if (cr) { const x = cr.left + cr.width / 2; for (let y = cr.top - 30; y < cr.bottom + 30; y += 1) { const el = document.elementFromPoint(x, y); if (el && (el === chip || chip.contains(el))) hit++; } }
  const cv = document.createElement("canvas"); cv.width = cv.height = 1; const c2 = cv.getContext("2d", { willReadFrequently: true });
  const rgba = (col) => { c2.clearRect(0, 0, 1, 1); c2.fillStyle = col; c2.fillRect(0, 0, 1, 1); return [...c2.getImageData(0, 0, 1, 1).data]; };
  const card = row.closest('[data-slot="card"]') || document.body;
  const rr = row.getBoundingClientRect();
  const chart = document.querySelector(".recharts-responsive-container, [data-slot='chart']");
  return { rowH: Math.round(rr.height * 10) / 10, rowLeft: Math.round(rr.left * 10) / 10, lh: getComputedStyle(row).lineHeight, chipH: cr ? Math.round(cr.height * 10) / 10 : null, chipW: cr ? Math.round(cr.width) : null, chipLeft: cr ? Math.round(cr.left * 10) / 10 : null, hit,
    state: chip?.dataset.state, chipText: chip?.textContent, aria: chip?.getAttribute("aria-label"), next: !!document.querySelector('[data-testid="dividend-conclusion-next"]'), frags,
    chartTop: chart ? Math.round(chart.getBoundingClientRect().top * 10) / 10 : null,
    colors: chip ? { label: rgba(getComputedStyle(chip).color), bg: rgba(getComputedStyle(chip).backgroundColor), amount: chip.querySelector("span") ? rgba(getComputedStyle(chip.querySelector("span")).color) : null, card: rgba(getComputedStyle(card).backgroundColor), icon: rgba(getComputedStyle(chip.querySelector("svg")).color) } : null,
    scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth };
});
const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const over = (fg, bg) => { const a = fg[3] / 255; return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)).concat(255); };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100; };
const contrasts = (c) => { if (!c) return null; const bg = over(c.bg, c.card); return { label: contrast(over(c.label, bg), bg), amount: c.amount ? contrast(over(c.amount, bg), bg) : null, chipVsCard: contrast(bg, c.card), bg: c.bg.join(","), labelRgb: c.label.join(",") }; };
const heroShot = async (page, name) => { const card = page.locator('[data-testid="dividend-conclusion"], [data-testid="dividend-received-solo"]').first().locator("xpath=ancestor::*[@data-slot='card'][1]"); const b = await card.boundingBox(); const vp = page.viewportSize(); await page.screenshot({ path: `${SHOTS}/${name}.png`, clip: { x: 0, y: Math.max(0, b.y - 8), width: vp.width, height: Math.min(360, vp.height - Math.max(0, b.y - 8)) } }); };

async function main(width, theme) {
  const tag = `${width}-${theme}`; const r = (R[tag] = {});
  const { ctx, page, errors } = await open(width, theme, fixture("long"));
  await page.waitForSelector('[data-testid="dividend-conclusion"]', { timeout: 30000 });
  await page.waitForTimeout(1200);
  r.empty = await measureConclusion(page); r.emptyContrast = contrasts(r.empty.colors); delete r.empty.colors;
  await heroShot(page, `${tag}-1-conclusion-empty`);
  // 포커스 링(키보드)
  await page.keyboard.press("Tab");
  await page.locator('[data-testid="dividend-received"]').focus();
  await page.waitForTimeout(250);
  r.focusVisible = await page.evaluate(() => document.activeElement.matches(":focus-visible") && document.activeElement.dataset.testid);
  { const b = await page.locator('[data-testid="dividend-received"]').boundingBox(); await page.screenshot({ path: `${SHOTS}/${tag}-1b-focus-ring.png`, clip: { x: Math.max(0, b.x - 24), y: b.y - 16, width: b.width + 48, height: b.height + 32 } }); }
  // 폼 열기(실제 클릭)
  await page.locator('[data-testid="dividend-received"]').click();
  await page.waitForSelector('[data-testid="cash-tx-kind-group"]'); await page.waitForTimeout(450);
  const formMeasure = () => page.evaluate((wb) => {
    const f = eval(wb); const q = (s) => document.querySelector(s); const rect = (el) => { const b = el.getBoundingClientRect(); return { top: Math.round(b.top * 10) / 10, h: Math.round(b.height * 10) / 10, w: Math.round(b.width), bottom: Math.round(b.bottom * 10) / 10 }; };
    const group = q('[data-testid="cash-tx-kind-group"]'); const [recBox, divBox] = group.children; const dlg = q('[role="dialog"]');
    const recHelpVisible = q("#cash-tx-recurring-help"); const helpR = recHelpVisible.getBoundingClientRect(); const recR = recBox.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(recHelpVisible); const textBottom = Math.max(...[...range.getClientRects()].map((x) => x.bottom));
    const texts = {}; for (const [k, sel] of Object.entries({ recTitle: 'label[for="cash-tx-recurring"] > span:first-child', recHelp: "#cash-tx-recurring-help", divTitle: 'label[for="cash-tx-dividend"] > span:first-child', divHelp: "#cash-tx-dividend-help", stockLabel: 'label[for="cash-tx-dividend-stock"]' })) { const el = q(sel); if (el) texts[k] = f(el); }
    const trig = q('[data-testid="cash-tx-dividend-stock"]'); const tr = trig?.getBoundingClientRect();
    let trigHit = 0; if (tr) { const x = tr.left + tr.width / 2; for (let y = tr.top - 10; y < tr.bottom + 10; y++) { const el = document.elementFromPoint(x, y); if (el && (el === trig || trig.contains(el))) trigHit++; } }
    const lab = q('label[for="cash-tx-dividend"]').getBoundingClientRect(); const lab2 = q('label[for="cash-tx-recurring"]').getBoundingClientRect();
    return { divChecked: q('[data-testid="cash-tx-dividend-check"]').dataset.state, recDisabled: q('[data-testid="cash-tx-recurring-check"]').disabled, recState: q('[data-testid="cash-tx-recurring-check"]').dataset.state,
      rec: rect(recBox), div: rect(divBox), gap: Math.round((divBox.getBoundingClientRect().top - recR.bottom) * 10) / 10, recPadBelowText: Math.round((recR.bottom - textBottom) * 10) / 10, recPadAboveTitle: Math.round((q('label[for="cash-tx-recurring"] > span').getBoundingClientRect().top - recR.top) * 10) / 10,
      trig: tr ? { w: Math.round(tr.width), h: Math.round(tr.height), hit: trigHit, text: trig.textContent, scrollW: trig.querySelector("span")?.scrollWidth, clientW: trig.querySelector("span")?.clientWidth } : null,
      labelH: [Math.round(lab2.height), Math.round(lab.height)], texts, dlg: { scrollW: dlg.scrollWidth, clientW: dlg.clientWidth, w: Math.round(dlg.getBoundingClientRect().width) }, docScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      recTitleColor: getComputedStyle(q('label[for="cash-tx-recurring"] > span')).color, recOpacity: getComputedStyle(q('[data-testid="cash-tx-recurring-check"]')).opacity };
  }, wordBreakFn);
  r.formOn = await formMeasure();
  await page.locator('[role="dialog"]').screenshot({ path: `${SHOTS}/${tag}-2-form-on.png` });
  await page.locator('[data-testid="cash-tx-kind-group"]').screenshot({ path: `${SHOTS}/${tag}-2b-kind-on.png` });
  // 끄기
  await page.click('[data-testid="cash-tx-dividend-check"]'); await page.waitForTimeout(400);
  r.formOff = await formMeasure();
  await page.locator('[data-testid="cash-tx-kind-group"]').screenshot({ path: `${SHOTS}/${tag}-3-kind-off.png` });
  // 정기 켠 상태에서 배당 켜기 → 정기 해제
  await page.click('[data-testid="cash-tx-recurring-check"]'); await page.waitForTimeout(150);
  await page.click('[data-testid="cash-tx-dividend-check"]'); await page.waitForTimeout(400);
  r.afterRecThenDiv = await page.evaluate(() => ({ rec: document.querySelector('[data-testid="cash-tx-recurring-check"]').dataset.state, div: document.querySelector('[data-testid="cash-tx-dividend-check"]').dataset.state }));
  // 연타 5회(끝 상태 = 켬 유지 위해 6회 → 켬→… ) : 5회 누르면 꺼짐, 1회 더 눌러 켬
  for (let i = 0; i < 5; i++) { await page.click('[data-testid="cash-tx-dividend-check"]'); await page.waitForTimeout(40); }
  await page.waitForTimeout(450);
  r.rapid5 = await page.evaluate(() => { const g = document.querySelector('[data-testid="cash-tx-kind-group"]').children[1]; return { state: document.querySelector('[data-testid="cash-tx-dividend-check"]').dataset.state, divH: Math.round(g.getBoundingClientRect().height) }; });
  await page.click('[data-testid="cash-tx-dividend-check"]'); await page.waitForTimeout(400);
  // 계좌
  const dlg = page.locator('[role="dialog"]');
  const pickAccount = async () => { const hasAcc = await dlg.locator("label", { hasText: /^계좌$/ }).count(); if (hasAcc) { await dlg.locator('button[role="combobox"]').first().click(); await page.locator('[role="option"]').first().click(); await page.waitForTimeout(200); } return hasAcc; };
  r.accountShown = await pickAccount();
  // 종목 목록
  await page.click('[data-testid="cash-tx-dividend-stock"]'); await page.waitForTimeout(350);
  r.options = await page.evaluate((wb) => { const f = eval(wb); return [...document.querySelectorAll('[role="option"]')].map((o) => { const sp = o.querySelector("span:last-child") || o; const b = o.getBoundingClientRect(); return { t: o.textContent, h: Math.round(b.height), w: Math.round(b.width), right: Math.round(b.right), clipped: sp.scrollWidth > sp.clientWidth + 1, lines: f(o).lines, bad: f(o).bad }; }); }, wordBreakFn);
  await page.screenshot({ path: `${SHOTS}/${tag}-4a-stock-list.png` });
  await page.locator('[role="option"]', { hasText: "커버드콜" }).click(); await page.waitForTimeout(300);
  await dlg.locator("input[inputmode]").first().fill("398200"); await page.waitForTimeout(200);
  r.formFilled = await formMeasure();
  await dlg.screenshot({ path: `${SHOTS}/${tag}-4-form-filled.png` });
  await dlg.locator('button[type="submit"]').click(); await page.waitForTimeout(1000);
  r.toast = (await page.locator("[data-sonner-toast]").allTextContents()).join("/");
  r.focusBack = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
  r.sum = await measureConclusion(page); r.sumContrast = contrasts(r.sum.colors); delete r.sum.colors;
  await heroShot(page, `${tag}-5-conclusion-sum`);
  // 중복
  await page.locator('[data-testid="dividend-received"]').click(); await page.waitForSelector('[data-testid="cash-tx-kind-group"]'); await page.waitForTimeout(300);
  await pickAccount(); await dlg.locator("input[inputmode]").first().fill("398200"); await dlg.locator('button[type="submit"]').click();
  await page.waitForSelector('[data-testid="cash-tx-dup-summary"]'); await page.waitForTimeout(300);
  r.dup = await page.evaluate(() => { const p = document.querySelector('[data-testid="cash-tx-dup-summary"]'); return { text: p.textContent, tops: [...p.children].map((c) => Math.round(c.getBoundingClientRect().top)) }; });
  await dlg.screenshot({ path: `${SHOTS}/${tag}-6-dup.png` });
  await page.getByRole("button", { name: "새로 추가" }).click(); await page.waitForTimeout(800);
  // 최장 금액(기록만) → 합계 123,456,789
  await page.locator('[data-testid="dividend-received"]').click(); await page.waitForSelector('[data-testid="cash-tx-kind-group"]'); await page.waitForTimeout(300);
  await pickAccount(); await dlg.locator("input[inputmode]").first().fill("122660389");
  const reflect = dlg.getByRole("checkbox", { name: /잔액에 즉시 반영/ }); r.reflectCount = await reflect.count(); if (r.reflectCount) { await reflect.first().click(); await page.waitForTimeout(200); }
  await dlg.locator('button[type="submit"]').click(); await page.waitForTimeout(1000);
  r.max = await measureConclusion(page); delete r.max.colors;
  await heroShot(page, `${tag}-7-conclusion-max`);
  // 월 선택
  const clickMonth = async (m) => { const pos = await page.evaluate((m) => { const g = document.querySelector(".recharts-cartesian-grid").getBoundingClientRect(); return { x: g.left + ((m - 0.5) / 12) * g.width, y: g.top + g.height / 2 }; }, m); await page.mouse.move(pos.x, pos.y); await page.waitForTimeout(120); await page.mouse.click(pos.x, pos.y); await page.waitForTimeout(500); return pos; };
  const nowM = new Date(Date.now() + 9 * 3600e3).getUTCMonth() + 1;
  r.monthClick = await clickMonth(nowM);
  r.month = await page.evaluate(() => { const c = document.querySelector('[data-testid="dividend-received-month"]'); const row = document.querySelector('[data-testid="dividend-conclusion"]'); const cell = row.parentElement; const chart = document.querySelector(".recharts-responsive-container, [data-slot='chart']"); const cr = c?.getBoundingClientRect();
    let hit = 0; if (cr) { const x = cr.left + cr.width / 2; for (let y = cr.top - 30; y < cr.bottom + 30; y++) { const el = document.elementFromPoint(x, y); if (el && (el === c || c.contains(el))) hit++; } }
    const hidden = row.querySelector('[data-testid="dividend-received"]'); const hr = hidden.getBoundingClientRect(); const top = document.elementFromPoint(hr.left + hr.width / 2, hr.top + hr.height / 2);
    return { text: c?.textContent, aria: c?.getAttribute("aria-label"), w: cr ? Math.round(cr.width) : null, h: cr ? Math.round(cr.height * 10) / 10 : null, left: cr ? Math.round(cr.left * 10) / 10 : null, hit, cellH: Math.round(cell.getBoundingClientRect().height * 10) / 10, cellW: Math.round(cell.getBoundingClientRect().width), chartTop: chart ? Math.round(chart.getBoundingClientRect().top * 10) / 10 : null, rowInert: row.inert, rowOpacity: getComputedStyle(row).opacity, hiddenChipClickable: top === hidden || hidden.contains(top), badge: document.querySelector('[data-testid="dividend-month-badge"]')?.textContent }; });
  // Tab으로 숨은 칩에 닿는지
  r.tabReach = await page.evaluate(() => { const els = [...document.querySelectorAll("button, a, input, [tabindex]")].filter((e) => !e.closest("[inert]") && e.tabIndex >= 0); return { hiddenInTabOrder: els.some((e) => e.dataset.testid === "dividend-received"), monthInTabOrder: els.some((e) => e.dataset.testid === "dividend-received-month") }; });
  await heroShot(page, `${tag}-8-month-selected`);
  // 월 칩 포커스 링
  if (r.month.text) { await page.keyboard.press("Tab"); await page.locator('[data-testid="dividend-received-month"]').focus(); await page.waitForTimeout(200); const b = await page.locator('[data-testid="dividend-received-month"]').boundingBox(); await page.screenshot({ path: `${SHOTS}/${tag}-8b-month-focus.png`, clip: { x: Math.max(0, b.x - 24), y: b.y - 16, width: b.width + 48, height: b.height + 32 } }); await page.evaluate(() => document.activeElement.blur()); }
  const other = nowM === 2 ? 5 : 2; await clickMonth(other);
  r.monthOther = await page.evaluate(() => ({ chip: !!document.querySelector('[data-testid="dividend-received-month"]'), cellH: Math.round(document.querySelector('[data-testid="dividend-conclusion"]').parentElement.getBoundingClientRect().height * 10) / 10, chartTop: Math.round(document.querySelector(".recharts-responsive-container, [data-slot='chart']").getBoundingClientRect().top * 10) / 10, badge: document.querySelector('[data-testid="dividend-month-badge"]')?.textContent }));
  await heroShot(page, `${tag}-9-month-other`);
  await clickMonth(other); // 해제
  // InfoHint
  const hintBtn = page.locator('[data-slot="card"]', { has: page.locator('[data-testid="dividend-conclusion"]') }).locator("button").first();
  r.hintBtn = await hintBtn.getAttribute("aria-label");
  await hintBtn.click(); await page.waitForTimeout(500);
  r.hint = await page.evaluate((wb) => { const f = eval(wb); const ps = [...document.querySelectorAll("p")].filter((p) => /받은 기록은 현금 입금에|예상분은 작년 지급|거래 기록이 있으면/.test(p.textContent)); return ps.map((p) => { const b = p.getBoundingClientRect(); return { ...f(p), w: Math.round(b.width), left: Math.round(b.left), right: Math.round(b.right) }; }); }, wordBreakFn);
  await page.screenshot({ path: `${SHOTS}/${tag}-10-infohint.png` });
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  // 저장 덤프(다른 픽스처용)
  if (tag === "375-light") { const keys = await page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; }); fs.writeFileSync("./after-store.json", JSON.stringify(keys)); }
  r.stored = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("secretasset_asset_data")); const last3 = d.cashTransactions.slice(-3); return { tags: localStorage.getItem("secretasset.cash_tx_tags"), last3: last3.map((t) => ({ recurring: t.recurring, reflected: t.reflected, keys: Object.keys(t).length })) }; });
  // 거래 행
  await page.evaluate(() => { location.hash = "#detail/cash"; }); await page.waitForTimeout(1200);
  await page.locator("main button", { hasText: "생활비 통장" }).first().click(); await page.waitForTimeout(600);
  await page.getByRole("button", { name: "입출금 내역" }).first().click(); await page.waitForTimeout(1000);
  r.rows = await page.evaluate(() => {
    const cv = document.createElement("canvas"); cv.width = cv.height = 1; const c2 = cv.getContext("2d", { willReadFrequently: true }); const rgba = (col) => { c2.clearRect(0, 0, 1, 1); c2.fillStyle = col; c2.fillRect(0, 0, 1, 1); return [...c2.getImageData(0, 0, 1, 1).data].join(","); };
    const badges = [...document.querySelectorAll('[data-testid="tx-dividend-badge"]')]; if (!badges.length) return null;
    const rows = badges.map((b) => b.closest(".py-2\\.5")); const all = [...rows[0].parentElement.children]; const h = (el) => Math.round(el.getBoundingClientRect().height * 10) / 10;
    const plain = all.find((r) => !r.querySelector('[data-testid="tx-dividend-badge"]') && !r.querySelector('[data-testid="tx-memo"]') && r.textContent.includes("입금") && !r.querySelector('[data-testid="tx-record-only-badge"]'));
    const b0 = badges[0]; const br = b0.getBoundingClientRect(); const cs = getComputedStyle(b0);
    return { badge: { w: Math.round(br.width), h: Math.round(br.height), bg: rgba(cs.backgroundColor), color: rgba(cs.color), border: cs.borderTopWidth + " " + rgba(cs.borderTopColor) },
      rows: rows.map((r) => { const st = r.querySelector('[data-testid="tx-dividend-stock"]'); const title = r.querySelector(".flex-wrap"); const kids = [...title.children]; const date = r.querySelector("p"); return { h: h(r), stock: st?.textContent ?? null, stockTrunc: st ? st.scrollWidth > st.clientWidth : null, stockH: st ? h(st) : null, stockBelowDate: st ? st.getBoundingClientRect().top >= date.getBoundingClientRect().bottom - 1 : null, titleTops: kids.map((k) => Math.round(k.getBoundingClientRect().top)), titleText: kids.map((k) => k.textContent).join("|"), amount: r.querySelector("span.font-bold")?.textContent }; }),
      plainH: plain ? h(plain) : null, docScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  await page.screenshot({ path: `${SHOTS}/${tag}-11-tx-rows.png` });
  r.errors = errors.slice(0, 4);
  await ctx.close();
}
const args = process.argv.slice(2);
const combos = args.length ? args.map((a) => a.split("-")) : [];
for (const [w, t] of combos) { try { await main(Number(w), t); } catch (e) { (R[`${w}-${t}`] ||= {}).ERR = String(e).slice(0, 700); } console.log(`### ${w}-${t}\n` + Object.entries(R[`${w}-${t}`]).map(([k, v]) => `${k}: ${J(v)}`).join("\n")); }
fs.writeFileSync(`./result-${args.join("_") || "none"}.json`, JSON.stringify(R, null, 1));
await browser.close();
