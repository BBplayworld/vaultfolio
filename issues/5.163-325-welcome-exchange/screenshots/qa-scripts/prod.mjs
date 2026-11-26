import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { payoutsFor, DIV_STOCKS, co } from "./lib.mjs";
const BASE = "https://www.secretasset.xyz"; const SH = process.argv[2]; const out = { steps: [] };
const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString().replace("T", " ").slice(0, 19) + " KST";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", proxy: { server: process.env.HTTPS_PROXY } });
const ctx = await b.newContext({ viewport: { width: 375, height: 900 }, timezoneId: "Asia/Seoul", locale: "ko-KR" });
await ctx.addCookies([{ name: "theme_mode", value: "dark", url: BASE }]);
const p = await ctx.newPage();
const pageErrors = [], consoleErrors = [], ga = [], bad = []; let versionSeen = null; const reqCount = { doc: 0, api: 0, total: 0 };
p.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 200)));
p.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 200)));
p.on("request", (r) => { reqCount.total++; const u = r.url(); if (/google-analytics\.com|analytics\.google\.com|\/g\/collect/.test(u)) ga.push(u.slice(0, 100)); if (u.startsWith(BASE + "/api/")) reqCount.api++; if (r.resourceType() === "document") reqCount.doc++; });
p.on("response", async (r) => { const u = r.url(); if (!u.startsWith(BASE)) return; const h = r.headers(); if (r.status() === 403 || h["x-vercel-mitigated"]) bad.push(`${r.status()} ${h["x-vercel-mitigated"] ?? ""} ${u.slice(0, 80)}`);
  if (/\/_next\/static\/.*\.js/.test(u) && !versionSeen) { try { const t = await r.text(); const m = t.match(/"5\.16\d"/g); if (m) { versionSeen = { v: [...new Set(m)], at: kst(), file: u.split("/").pop().slice(0, 40) }; } } catch {} } });
await p.route("**/api/finance/dividend**", (route) => { const t = new URL(route.request().url()).searchParams.get("ticker"); route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: payoutsFor(t) }) }); });
try {
  const resp = await p.goto(BASE + "/?ga-optout=1", { waitUntil: "networkidle", timeout: 45000 }).catch((e) => ({ err: e.message }));
  out.first = { at: kst(), status: resp?.status?.(), mitigated: resp?.headers?.()["x-vercel-mitigated"] ?? null, err: resp?.err };
  if (bad.length || resp?.status?.() !== 200) throw new Error("STOP: " + JSON.stringify(bad) + " " + resp?.status?.());
  out.optout = await p.evaluate(() => localStorage.getItem("ga-optout"));
  await p.waitForSelector('[data-testid="welcome-cta-wizard"]', { timeout: 15000 }); await p.waitForTimeout(1000);
  const sub = () => p.evaluate(() => { const el = document.querySelector('[data-testid="welcome-hero"] p'); const tn = el.firstChild; const lines = []; let last = null; for (let i = 0; i < tn.length; i++) { const r = document.createRange(); r.setStart(tn, i); r.setEnd(tn, i + 1); const rc = r.getClientRects()[0]; if (!rc) continue; const t = Math.round(rc.top); if (last === null || Math.abs(t - last) > 4) { lines.push(""); last = t; } lines[lines.length - 1] += tn.data[i]; } return { lines, cta: Math.round(document.querySelector('[data-testid="welcome-cta-wizard"]').getBoundingClientRect().top), hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
  out.welcome375 = await sub(); await p.screenshot({ path: `${SH}/prod-welcome-375.png` });
  await p.setViewportSize({ width: 320, height: 900 }); await p.waitForTimeout(500); out.welcome320 = await sub(); await p.screenshot({ path: `${SH}/prod-welcome-320.png` });
  await p.setViewportSize({ width: 375, height: 900 }); await p.waitForTimeout(300);
  // 체험 진입(메모리 저장소 — 운영 금고·동기화 쓰기 없음)
  await p.click('[data-testid="welcome-trial-link"]'); await p.waitForFunction(() => !!localStorage.getItem("secretasset_asset_data"), null, { timeout: 25000 }); await p.waitForTimeout(2500);
  out.url = p.url().replace(BASE, "");
  out.home = await p.evaluate(() => ({ radios: [...document.querySelectorAll("[role=radio]")].map((x) => x.innerText).slice(0, 6), hasNet: /순자산/.test(document.body.innerText), len: document.body.innerText.length, hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
  await p.screenshot({ path: `${SH}/prod-home-375.png` });
  // 새 소식
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("open-whats-new", { detail: { source: "more" } }))); await p.waitForSelector('[data-testid="whats-new-sheet"]', { timeout: 8000 }); await p.waitForTimeout(700);
  out.whatsNew = await p.evaluate(() => { const items = [...document.querySelectorAll('[data-testid="whats-new-item"]')]; return { version: document.querySelector('[data-testid="whats-new-version"]')?.innerText, count: items.length, first: items[0].innerText.replace(/\n+/g, " | "), firstGo: !!items[0].querySelector('[data-testid="whats-new-go"]'), goTotal: items.filter((i) => i.querySelector('[data-testid="whats-new-go"]')).length }; });
  await p.screenshot({ path: `${SH}/prod-whatsnew-375.png` }); await p.keyboard.press("Escape"); await p.waitForTimeout(600);
  // 테스트 브라우저 안 데이터만 바꿈
  const CR = [co({ id: "r1", name: "비트코인", symbol: "BTC", exchange: "업비트", quantity: 0.12345678, averagePrice: 98000000.5, currentPrice: 135790123.4 }), co({ id: "r2", name: "이더리움", symbol: "ETH", exchange: "빗썸", quantity: 1.5, averagePrice: 4300000.3, currentPrice: 3987654.3 }), co({ id: "r3", name: "리플", symbol: "XRP", exchange: "", quantity: 1234.567, averagePrice: 987.65, currentPrice: 3141.59 })];
  await p.evaluate(({ crypto, stocks }) => { const d = JSON.parse(localStorage.getItem("secretasset_asset_data")); d.crypto = crypto; d.cryptoTransactions = []; d.stocks = stocks; d.transactions = []; localStorage.setItem("secretasset_asset_data", JSON.stringify(d)); window.dispatchEvent(new Event("storage")); }, { crypto: CR, stocks: DIV_STOCKS }); await p.waitForTimeout(1000);
  await p.getByRole("radio", { name: "상세" }).first().click(); await p.waitForTimeout(800); await p.getByText("암호화폐", { exact: true }).first().click(); await p.waitForTimeout(1500);
  out.cryptoClosed = await p.evaluate(() => { const t = document.querySelector('[data-testid="exchange-totals-toggle"]'); return t ? { text: t.innerText.replace(/\n/g, " "), expanded: t.getAttribute("aria-expanded") } : null; });
  await p.click('[data-testid="exchange-totals-toggle"]'); await p.waitForTimeout(700);
  out.crypto = await p.evaluate(() => { const num = (s) => Number(s.replace(/[^0-9.-]/g, "")); const sec = document.querySelector('[data-testid="exchange-totals"]'); const rows = [...sec.querySelectorAll('[data-testid="broker-row"]')]; const hdr = document.body.innerText.match(/총 암호화폐 평가금액\s+([\d,]+)원\s+([+-]?[\d,]+)원/); return { rows: rows.map((r) => r.innerText.replace(/\n+/g, " | ")), sumV: rows.reduce((a, r) => a + num(r.querySelector('[data-testid="broker-row-value"]').textContent), 0), sumP: rows.reduce((a, r) => a + num(r.querySelector('[data-testid="broker-row-profit"]').children[0].textContent), 0), share: +rows.reduce((a, r) => a + num(r.querySelector('[data-testid="broker-row-share"]').textContent), 0).toFixed(1), hdr: [hdr[1], hdr[2]], hdrNum: [num(hdr[1]), num(hdr[2])], buttons: sec.querySelectorAll("button").length, resync: /맞추기/.test(sec.innerText) }; });
  await p.screenshot({ path: `${SH}/prod-crypto-375.png` });
  await p.getByRole("button", { name: "뒤로가기" }).first().click(); await p.waitForTimeout(700);
  const back = p.getByRole("button", { name: "뒤로가기" }).first(); if (await back.count() && !(await p.getByRole("radio", { name: "성과" }).count())) { await back.click(); await p.waitForTimeout(700); }
  await p.getByRole("radio", { name: "성과" }).first().click(); await p.waitForTimeout(2000);
  out.activity = await p.evaluate(() => ({ len: document.body.innerText.length, head: document.body.innerText.replace(/\s+/g, " ").slice(0, 160), hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth })); await p.screenshot({ path: `${SH}/prod-activity-375.png` });
  await p.getByText("배당", { exact: true }).first().click(); await p.waitForSelector('[data-testid="dividend-stock-row"]', { timeout: 20000 }); await p.waitForTimeout(1200);
  const g = () => p.evaluate(() => { const row = document.querySelector('[data-testid="dividend-stock-row"]'); const head = document.querySelector('[data-testid="dividend-table"] [role="row"]'); const name = row.querySelector('[data-testid="dividend-stock-name"]'); return { tracks: getComputedStyle(row).gridTemplateColumns.split(" ").length, headTracks: getComputedStyle(head).gridTemplateColumns.split(" ").length, rows: document.querySelectorAll('[data-testid="dividend-stock-row"]').length, nameClipped: name.scrollWidth > name.clientWidth + 1, hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth, tables: document.querySelectorAll('[role="table"]').length }; });
  await p.setViewportSize({ width: 320, height: 900 }); await p.waitForTimeout(500); out.div320 = await g(); await p.locator('[data-testid="dividend-table"]').first().screenshot({ path: `${SH}/prod-div-320.png` });
  await p.setViewportSize({ width: 360, height: 900 }); await p.waitForTimeout(500); out.div360 = await g(); await p.locator('[data-testid="dividend-table"]').first().screenshot({ path: `${SH}/prod-div-360.png` });
} catch (e) { out.error = e.message.slice(0, 400); await p.screenshot({ path: `${SH}/prod-error.png` }).catch(() => {}); }
out.version = versionSeen; out.pageErrors = pageErrors; out.consoleErrors = consoleErrors.slice(0, 8); out.ga = ga; out.bad = bad; out.reqCount = reqCount; out.end = kst();
console.log(JSON.stringify(out, null, 1)); await b.close();
