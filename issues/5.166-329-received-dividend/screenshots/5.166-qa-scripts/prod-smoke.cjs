// v5.164 운영 스모크 1회: 테스트 브라우저 로컬 저장소에 데모(가상) 데이터만, 금고·동기화 미설정(서버 쓰기 0)
const path = require("path"); const fs = require("fs"); const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"));
const BASE = "https://www.secretasset.xyz";
const SEED = process.argv[2]; const WORK = process.argv[3];
const OUT = "/home/user/vaultfolio/.memory/issues/5.166-329-received-dividend/screenshots/5.166-qa-prod-";
const K = "secretasset.cash_tx_tags";
const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString().replace("T", " ").slice(0, 19);
const L = (k, v) => console.log(`[${kst()}]`, k, typeof v === "string" ? v : JSON.stringify(v));
const W = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
  let docs = 0, total = 0; const blocked = [], nonGet = [], ga = [], api = new Set();
  const mk = async (w, theme) => {
    const ctx = await b.newContext({ viewport: { width: w, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
    await ctx.addCookies([{ name: "theme_mode", value: theme, url: BASE }]);
    const p = await ctx.newPage(); const errs = [];
    p.on("pageerror", (e) => errs.push("PAGEERR " + String(e).slice(0, 200)));
    p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
    p.on("request", (r) => { total++; const u = r.url(); if (r.resourceType() === "document") docs++;
      if (/google-analytics\.com\/(g\/)?collect|\/g\/collect/.test(u)) ga.push(u.slice(0, 100));
      if (r.method() !== "GET") nonGet.push(r.method() + " " + u.slice(0, 100) + " body:" + (r.postData() || "").slice(0, 120));
      else if (u.startsWith(BASE + "/api/")) api.add(u.replace(BASE, "").replace(/\?.*/, "")); });
    p.on("response", (r) => { if (r.status() === 403 || r.headers()["x-vercel-mitigated"]) blocked.push(r.status() + " " + r.url().slice(0, 100) + " " + (r.headers()["x-vercel-mitigated"] || "")); });
    return { ctx, p, errs };
  };
  const stop = async (why) => { L("STOP", why); L("blocked", blocked); await b.close(); process.exit(2); };
  const hash = async (p, h, ms = 1800) => { await p.evaluate((h) => { location.hash = h; }, h); await W(ms); };
  const imp = async (p, file) => { await p.locator('input[type="file"][accept="application/json"]').first().setInputFiles(file); await W(3500); return (await p.locator("[data-sonner-toast]").allTextContents()).join(" / "); };
  const store = (p) => p.evaluate((K) => ({ tags: localStorage.getItem(K), ad: JSON.parse(localStorage.getItem("secretasset_asset_data") || "null") }), K);
  const concl = (p) => p.evaluate(() => { const row = document.querySelector('[data-testid="dividend-conclusion"]'); const chip = document.querySelector('[data-testid="dividend-received"]') || document.querySelector('[data-testid="dividend-received-solo"]'); const cr = chip?.getBoundingClientRect(); return { row: row?.textContent ?? null, chip: chip?.textContent ?? null, chipId: chip?.dataset.testid ?? null, chipBox: cr ? [Math.round(cr.width), Math.round(cr.height * 10) / 10] : null, ox: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
  const table = (p) => p.evaluate(() => { const rows = [...document.querySelectorAll('[data-testid="dividend-stock-row"]')]; const ts = document.querySelectorAll('[data-testid="dividend-table"]').length; return { tables: ts, rows: rows.length, ox: document.documentElement.scrollWidth - document.documentElement.clientWidth, layout: rows.slice(0, 6).map((r) => { const cells = [...r.querySelectorAll(':scope [role="cell"]')]; const tops = [...new Set(cells.map((c) => Math.round(c.getBoundingClientRect().top)))]; const paid = r.querySelector('[data-testid="dividend-cell-paid"]'); const pr = paid?.getBoundingClientRect(); const first = r.firstElementChild?.getBoundingClientRect(); return { cells: cells.length, lines: tops.length, paidBelowName: pr && first ? pr.top >= first.bottom - 1 : null, rowOX: r.scrollWidth - r.clientWidth, paidClip: paid ? paid.scrollWidth > paid.clientWidth : null }; }) }; });

  // ── 기기 A
  const A = await mk(390, "dark");
  const r0 = await A.p.goto(BASE + "/?ga-optout=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  L("A optout status", { s: r0.status(), mit: r0.headers()["x-vercel-mitigated"] || null }); if (r0.status() === 403) await stop("403 first load");
  await W(3500);
  L("A optout flag", await A.p.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => /ga|optout/i.test(k)).map((k) => [k, localStorage.getItem(k)]))));
  L("A landing", (await A.p.evaluate(() => document.body.innerText.replace(/\s+/g, " "))).slice(0, 100));
  L("A import seed", await imp(A.p, SEED));
  const s0 = await store(A.p); L("A seeded", { cash: s0.ad?.cash?.length, stocks: s0.ad?.stocks?.length, tx: s0.ad?.cashTransactions?.length, tags: s0.tags });
  // 버전
  await hash(A.p, "#more", 1500); await A.p.getByText("설정", { exact: true }).last().click(); await W(1200);
  L("C144 settings version", await A.p.evaluate(() => (document.body.innerText.match(/v\d+\.\d+/g) || []).slice(0, 3)));
  // 배당 화면
  await hash(A.p, "#activity/dividend", 1000);
  await A.p.waitForSelector('[data-testid="dividend-conclusion"], [data-testid="dividend-received-solo"]', { timeout: 30000 }).catch(() => {}); await W(2500);
  const c0 = await concl(A.p); L("A dividend before", c0); await A.p.screenshot({ path: OUT + "390-dark-1-dividend.png" });
  if (!c0.chipId) await stop("받은 배당 칩 없음");
  await A.p.click(`[data-testid="${c0.chipId}"]`); await A.p.waitForSelector('[data-testid="cash-tx-kind-group"]', { timeout: 10000 }); await W(500);
  L("A form", await A.p.evaluate(() => ({ dividend: document.querySelector('[data-testid="cash-tx-dividend-check"]')?.getAttribute("data-state"), recDisabled: document.querySelector('[data-testid="cash-tx-recurring-check"]')?.disabled, help: document.querySelector("#cash-tx-recurring-help")?.textContent, dlgOX: (() => { const d = document.querySelector('[role="dialog"]'); return d.scrollWidth - d.clientWidth; })() })));
  const dlg = A.p.locator('[role="dialog"]');
  const combo = dlg.locator('button[role="combobox"]').first();
  if ((await combo.getAttribute("data-testid")) !== "cash-tx-dividend-stock") { await combo.click(); await W(200); await A.p.locator('[role="option"]').first().click(); await W(200); }
  await A.p.click('[data-testid="cash-tx-dividend-stock"]'); await W(250); const opts = await A.p.locator('[role="option"]').allTextContents(); await A.p.locator('[role="option"]').nth(1).click(); await W(200);
  await dlg.locator("input[inputmode]").first().fill("12345"); await W(200);
  await dlg.screenshot({ path: OUT + "390-dark-2-form.png" });
  await dlg.locator('button[type="submit"]').click(); await W(1300);
  L("A submit", { opts, toast: await A.p.locator("[data-sonner-toast]").allTextContents(), focus: await A.p.evaluate(() => document.activeElement?.getAttribute("data-testid")), dialog: await A.p.locator('[role="dialog"]').count() });
  const c1 = await concl(A.p); L("A dividend after", c1);
  const s1 = await store(A.p); const last = s1.ad.cashTransactions.slice(-1)[0];
  L("A stored", { tags: s1.tags, lastTx: { id: last.id, type: last.type, amount: last.amount, date: last.date }, tx: s1.ad.cashTransactions.length });
  await A.p.screenshot({ path: OUT + "390-dark-3-dividend-sum.png" });
  // 배당 표: 390·375·1280
  L("A table 390", await table(A.p)); await A.p.locator('[data-testid="dividend-table"]').first().screenshot({ path: OUT + "390-dark-4-table.png" }).catch((e) => L("shot err", String(e).slice(0, 80)));
  await A.p.setViewportSize({ width: 375, height: 844 }); await W(900); L("A table 375", await table(A.p)); L("A concl 375", await concl(A.p)); await A.p.locator('[data-testid="dividend-table"]').first().screenshot({ path: OUT + "375-dark-5-table.png" }).catch(() => {});
  await A.p.setViewportSize({ width: 1280, height: 900 }); await W(1200); L("A table 1280", await table(A.p)); L("A concl 1280", await concl(A.p)); await A.p.screenshot({ path: OUT + "1280-dark-6-dividend.png", fullPage: true });
  // 거래 행 배지(390)
  await A.p.setViewportSize({ width: 390, height: 844 }); await W(600);
  await hash(A.p, "#detail/cash", 1800);
  const acct = s1.ad.cash.find((c) => c.id === last.cashId)?.name; L("A acct", acct);
  await A.p.locator("main button", { hasText: acct }).first().click(); await W(600); await A.p.getByRole("button", { name: "입출금 내역" }).first().click(); await W(1200);
  L("A tx row", await A.p.evaluate(() => { const bd = document.querySelector('[data-testid="tx-dividend-badge"]'); const r = bd?.closest(".flex.items-center.gap-3"); const br = bd?.getBoundingClientRect(); return { badge: bd?.textContent ?? null, badgeBox: br ? [Math.round(br.width), Math.round(br.height)] : null, stock: r?.querySelector('[data-testid="tx-dividend-stock"]')?.textContent ?? null, text: r?.innerText.replace(/\s+/g, " ").slice(0, 80), rowOX: r ? r.scrollWidth - r.clientWidth : null }; }));
  await A.p.screenshot({ path: OUT + "390-dark-7-tx-row.png" });
  await A.p.keyboard.press("Escape"); await W(300); await A.p.keyboard.press("Escape"); await W(300);
  // 상세 주식 360
  await A.p.setViewportSize({ width: 360, height: 844 }); await hash(A.p, "#detail/stock", 2500);
  L("A stock 360", await A.p.evaluate(() => { const rr = [...document.querySelectorAll('[data-testid="stock-row-right"]')]; return { rows: rr.length, ox: document.documentElement.scrollWidth - document.documentElement.clientWidth, rightOverflow: rr.filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5).length, clipped: rr.filter((e) => e.scrollWidth > e.clientWidth + 1).length }; }));
  await A.p.screenshot({ path: OUT + "360-dark-8-detail-stock.png" });
  // 백업 내보내기
  await A.p.setViewportSize({ width: 390, height: 844 }); await hash(A.p, "#more", 1800);
  const [dl] = await Promise.all([A.p.waitForEvent("download", { timeout: 15000 }), A.p.getByText("데이터 백업").first().click()]);
  const bk1p = WORK + "/prod-backup-1.json"; await dl.saveAs(bk1p); const bk1 = JSON.parse(fs.readFileSync(bk1p, "utf8"));
  L("A backup", { keys: Object.keys(bk1), cashTxTags: bk1.cashTxTags, tx: bk1.assetData?.cashTransactions?.length });
  // ── 기기 B (새 브라우저 = 빈 저장소)
  const B = await mk(390, "light");
  const r1 = await B.p.goto(BASE + "/?ga-optout=1", { waitUntil: "domcontentloaded", timeout: 60000 }); L("B status", r1.status()); if (r1.status() === 403) await stop("403 B");
  await W(3500); L("B import backup", await imp(B.p, bk1p));
  const sb = await store(B.p);
  L("B roundtrip", { tagsEq: JSON.stringify(JSON.parse(sb.tags)) === JSON.stringify(bk1.cashTxTags), txEq: JSON.stringify(sb.ad.cashTransactions) === JSON.stringify(bk1.assetData.cashTransactions), cashEq: JSON.stringify(sb.ad.cash) === JSON.stringify(bk1.assetData.cash), tags: sb.tags });
  await hash(B.p, "#activity/dividend", 1000); await B.p.waitForSelector('[data-testid="dividend-conclusion"], [data-testid="dividend-received-solo"]', { timeout: 30000 }).catch(() => {}); await W(2500);
  const cb = await concl(B.p); L("B dividend", { cb, sameChipAsA: cb.chip === c1.chip }); await B.p.screenshot({ path: OUT + "390-light-9-B-dividend.png" });
  await hash(B.p, "#more", 1800);
  const [dl2] = await Promise.all([B.p.waitForEvent("download", { timeout: 15000 }), B.p.getByText("데이터 백업").first().click()]);
  const bk2p = WORK + "/prod-backup-2.json"; await dl2.saveAs(bk2p); const bk2 = JSON.parse(fs.readFileSync(bk2p, "utf8"));
  L("B re-export", { tagsEq: JSON.stringify(bk2.cashTxTags) === JSON.stringify(bk1.cashTxTags), txEq: JSON.stringify(bk2.assetData.cashTransactions) === JSON.stringify(bk1.assetData.cashTransactions), cashEq: JSON.stringify(bk2.assetData.cash) === JSON.stringify(bk1.assetData.cash) });
  // ── 기기 B 모든 데이터 삭제
  await B.p.getByText("설정", { exact: true }).last().click(); await W(1200);
  await B.p.click('[data-testid="settings-row-delete-all"]'); await W(700);
  L("B clear dialog", await B.p.evaluate(() => document.querySelector('[role="alertdialog"]')?.innerText.replace(/\s+/g, " ").slice(0, 160)));
  await B.p.screenshot({ path: OUT + "390-light-10-clear-dialog.png" });
  await B.p.locator('[role="alertdialog"] button').filter({ hasText: /삭제/ }).last().click(); await W(2000);
  L("B after clear-all", await B.p.evaluate((K) => ({ tags: localStorage.getItem(K), asset: localStorage.getItem("secretasset_asset_data"), keysLeft: Object.keys(localStorage).filter((k) => /secretasset/.test(k)), toast: [...document.querySelectorAll("[data-sonner-toast]")].map((t) => t.textContent) }), K));
  await B.p.screenshot({ path: OUT + "390-light-11-after-clear.png" });
  L("docs", docs); L("total requests", total); L("api GET", [...api]); L("nonGET", nonGet); L("GA collect", ga.length); L("blocked", blocked);
  L("errs A", [...new Set(A.errs)]); L("errs B", [...new Set(B.errs)]);
  await b.close();
})().catch((e) => { console.error("FAIL", String(e).slice(0, 500)); process.exit(1); });
