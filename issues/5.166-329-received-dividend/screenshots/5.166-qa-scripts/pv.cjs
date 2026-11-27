const path = require("path"); const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"));
const BASE = "https://secretasset-git-issue-5166-bbplayworlds-projects.vercel.app";
const OUT = "/home/user/vaultfolio/.memory/issues/5.166-329-received-dividend/screenshots/5.166-qa-preview-";
const K = "secretasset.cash_tx_tags";
const L = (k, v) => console.log(k, typeof v === "string" ? v : JSON.stringify(v));
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", proxy: { server: process.env.HTTPS_PROXY } });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: "theme_mode", value: "dark", url: BASE }]);
  const page = await ctx.newPage();
  const errs = [], reqs = [], blocked = [];
  let docs = 0;
  page.on("pageerror", (e) => errs.push("PAGEERR " + String(e).slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
  page.on("request", (r) => { const u = r.url(); if (r.resourceType() === "document") docs++; if (/google-analytics|googletagmanager|\/g\/collect|doubleclick/.test(u)) reqs.push("GA " + u.slice(0, 120)); else if (r.method() !== "GET") reqs.push(r.method() + " " + u.replace(BASE, "").slice(0, 100) + " body:" + (r.postData() || "").slice(0, 200)); else if (/\/api\//.test(u)) reqs.push("GET " + u.replace(BASE, "").slice(0, 140)); });
  page.on("response", (r) => { if (r.status() === 403 || r.headers()["x-vercel-mitigated"]) blocked.push(r.status() + " " + r.url().slice(0, 100) + " " + (r.headers()["x-vercel-mitigated"] || "")); });
  const stop = async (why) => { L("STOP", why); L("blocked", blocked); await b.close(); process.exit(2); };
  const r0 = await page.goto(BASE + "/?ga-optout=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  L("optout status", r0.status()); if (r0.status() === 403) await stop("403 on first load");
  await page.waitForTimeout(3500);
  L("theme", await page.evaluate(() => ({ cls: document.documentElement.className, bg: getComputedStyle(document.body).backgroundColor })));
  L("landing", (await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "))).slice(0, 160));
  // 데모 주입 clear 확인용 가짜 표시
  await page.evaluate((K) => localStorage.setItem(K, JSON.stringify({ v: 1, ctx_qa_fake_before_demo: { kind: "dividend" } })), K);
  const r1 = await page.goto(BASE + "/?demo=1#activity/dividend", { waitUntil: "domcontentloaded", timeout: 60000 }); if (r1.status() === 403) await stop("403 on demo");
  await page.waitForSelector('[data-testid="dividend-conclusion"], [data-testid="dividend-received"]', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(3000);
  L("after demo inject: tag key", await page.evaluate((K) => localStorage.getItem(K), K)); L("url", page.url());
  const concl = () => page.evaluate(() => { const row = document.querySelector('[data-testid="dividend-conclusion"]'); const chip = document.querySelector('[data-testid="dividend-received"]'); const cr = chip?.getBoundingClientRect(); let hit = 0; if (cr) { const x = cr.left + cr.width / 2; for (let y = cr.top - 30; y < cr.bottom + 30; y++) { const el = document.elementFromPoint(x, y); if (el && (el === chip || chip.contains(el))) hit++; } } return { row: row?.textContent ?? null, rowH: row ? Math.round(row.getBoundingClientRect().height * 10) / 10 : null, chip: chip?.textContent ?? null, hit, next: !!document.querySelector('[data-testid="dividend-conclusion-next"]'), hero: document.querySelector('[data-testid="dividend-hero-label"]')?.parentElement?.parentElement?.innerText.replace(/\s+/g, " ").slice(0, 60), ox: document.documentElement.scrollWidth - document.documentElement.clientWidth, main: document.querySelector("main")?.innerText.replace(/\s+/g, " ").slice(0, 200) }; });
  const c0 = await concl(); L("C0", c0);
  await page.screenshot({ path: OUT + "390-dark-1-dividend.png" });
  if (!c0.chip) { L("no chip on preview dividend — 화면 텍스트", c0.main); }
  else {
    await page.click('[data-testid="dividend-received"]'); await page.waitForSelector('[data-testid="cash-tx-kind-group"]'); await page.waitForTimeout(500);
    L("form", await page.evaluate(() => ({ dividend: document.querySelector('[data-testid="cash-tx-dividend-check"]').getAttribute("data-state"), recDisabled: document.querySelector('[data-testid="cash-tx-recurring-check"]').disabled, help: document.querySelector("#cash-tx-recurring-help").textContent })));
    await page.locator('[role="dialog"]').screenshot({ path: OUT + "390-dark-2-form.png" });
    const dlg = page.locator('[role="dialog"]'); await dlg.locator('button[role="combobox"]').first().click(); await page.locator('[role="option"]').first().click(); await page.waitForTimeout(200);
    await page.click('[data-testid="cash-tx-dividend-stock"]'); await page.waitForTimeout(200); await page.locator('[role="option"]').nth(1).click(); await page.waitForTimeout(200);
    await dlg.locator("input[inputmode]").first().fill("398200"); await page.waitForTimeout(200);
    await dlg.locator('button[type="submit"]').click(); await page.waitForTimeout(1200);
    L("toast/focus", { toast: await page.locator("[data-sonner-toast]").allTextContents(), focus: await page.evaluate(() => document.activeElement?.getAttribute("data-testid")) });
    const c1 = await concl(); L("C1", { row: c1.row, chip: c1.chip, rowH: c1.rowH, hero: c1.hero });
    L("stored", await page.evaluate((K) => ({ tags: localStorage.getItem(K), last: JSON.parse(localStorage.getItem("secretasset_asset_data")).cashTransactions.slice(-1)[0] }), K));
    await page.screenshot({ path: OUT + "390-dark-3-dividend-sum.png" });
    // 이번 달 칩
    const nowM = Number(new Date(Date.now() + 9 * 3600e3).toISOString().slice(5, 7));
    const pos = await page.evaluate((m) => { const g = document.querySelector(".recharts-cartesian-grid")?.getBoundingClientRect(); return g ? { x: g.left + ((m - 0.5) / 12) * g.width, y: g.top + g.height / 2 } : null; }, nowM);
    if (pos) { await page.mouse.click(pos.x, pos.y); await page.waitForTimeout(500); L("month chip", await page.evaluate(() => ({ chip: document.querySelector('[data-testid="dividend-received-month"]')?.textContent ?? null, badge: document.querySelector('[data-testid="dividend-month-badge"]')?.textContent ?? null }))); await page.screenshot({ path: OUT + "390-dark-4-month.png" }); await page.click('[data-testid="dividend-month-badge"]').catch(() => {}); }
    // 1280 데스크톱
    await page.setViewportSize({ width: 1280, height: 900 }); await page.waitForTimeout(1200); L("1280", await concl().then((c) => ({ row: c.row, rowH: c.rowH, hit: c.hit, ox: c.ox }))); await page.screenshot({ path: OUT + "1280-dark-5-dividend-sum.png" });
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(600);
    // 거래 행
    await page.evaluate(() => { location.hash = "#detail/cash"; }); await page.waitForTimeout(1500);
    const acct = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("secretasset_asset_data")); return d.cash.find((c) => c.id === d.cashTransactions.slice(-1)[0].cashId).name; });
    await page.locator("main button", { hasText: acct }).first().click(); await page.waitForTimeout(500); await page.getByRole("button", { name: "입출금 내역" }).first().click(); await page.waitForTimeout(1000);
    L("row", await page.evaluate(() => { const bd = document.querySelector('[data-testid="tx-dividend-badge"]'); const r = bd?.closest(".flex.items-center.gap-3"); return { badge: bd?.textContent ?? null, stock: r?.querySelector('[data-testid="tx-dividend-stock"]')?.textContent ?? null, text: r?.innerText.replace(/\s+/g, " ") }; }));
    await page.screenshot({ path: OUT + "390-dark-6-tx-rows.png" });
  }
  L("sync/비GET 요청", reqs.filter((r) => !r.startsWith("GET") && !r.startsWith("GA"))); L("GA 요청 수", reqs.filter((r) => r.startsWith("GA")).length); L("API GET", [...new Set(reqs.filter((r) => r.startsWith("GET")).map((r) => r.replace(/\?.*/, "")))]);
  L("sync UI", await page.evaluate(() => /동기화/.test(document.body.innerText)));
  // ?demo=empty
  const before = await page.evaluate((K) => localStorage.getItem(K), K);
  const r2 = await page.goto(BASE + "/?demo=empty", { waitUntil: "domcontentloaded", timeout: 60000 }); if (r2.status() === 403) await stop("403 on demo=empty");
  await page.waitForTimeout(3500);
  L("demo=empty", { before: !!before, tagKey: await page.evaluate((K) => localStorage.getItem(K), K), asset: await page.evaluate(() => localStorage.getItem("secretasset_asset_data")?.length ?? null), url: page.url() });
  L("docs loaded", docs); L("blocked", blocked); L("errs", [...new Set(errs)]);
  await b.close();
})().catch((e) => { console.error("FAIL", String(e).slice(0, 400)); process.exit(1); });
