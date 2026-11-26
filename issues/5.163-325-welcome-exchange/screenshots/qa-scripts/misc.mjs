import { launch, HEAD, blockExternal, setTheme, enterDemo, inject, co } from "./lib.mjs";
const SH = process.argv[2]; const b = await launch(); const out = {}; const ext = [];
const REAL = [
  co({ id: "r1", name: "비트코인", symbol: "BTC", exchange: "업비트", quantity: 1.2345, averagePrice: 98000000, currentPrice: 135790000 }),
  co({ id: "r2", name: "이더리움", symbol: "ETH", exchange: "빗썸", quantity: 12.5, averagePrice: 4300000, currentPrice: 3980000 }),
  co({ id: "r3", name: "리플", symbol: "XRP", exchange: "바이낸스", quantity: 15000, averagePrice: 900, currentPrice: 3141 }),
  co({ id: "r4", name: "솔라나", symbol: "SOL", exchange: "", quantity: 20, averagePrice: 210000, currentPrice: 250000 }),
];
// A) 체험(데모) 새 소식 → 바로 가기
for (const tz of ["Asia/Seoul", "UTC"]) {
  const ctx = await b.newContext({ viewport: { width: 375, height: 900 }, timezoneId: tz }); await blockExternal(ctx, ext); await setTheme(ctx, HEAD, "dark");
  const p = await ctx.newPage(); const errs = []; p.on("console", (m) => m.type() === "error" && !/ERR_FAILED|Failed to load resource/.test(m.text()) && errs.push(m.text().slice(0, 200)));
  await enterDemo(p, HEAD);
  const tip = await p.evaluate(() => [...document.querySelectorAll("*")].filter((x) => x.children.length === 0 && /새 소식 \d+개/.test(x.textContent)).map((x) => x.textContent));
  // 더보기 메뉴 열기
  const btns = await p.evaluate(() => [...document.querySelectorAll("button")].filter((x) => x.getClientRects().length).map((x) => x.getAttribute("aria-label") || x.innerText.slice(0, 12)));
  const moreText = "(이벤트로 엶)";
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("open-whats-new", { detail: { source: "more" } }))); await p.waitForSelector('[data-testid="whats-new-sheet"]'); await p.waitForTimeout(600);
  const items = await p.evaluate(() => [...document.querySelectorAll('[data-testid="whats-new-item"]')].map((li) => ({ t: li.innerText.replace(/\n/g, " | ").slice(0, 110), isNew: !!li.querySelector('[data-testid="whats-new-item-new"]'), go: !!li.querySelector('[data-testid="whats-new-go"]') })));
  // 첫 항목 제목 줄 나눔(글자 단위)
  const wrap = await p.evaluate(() => { const li = document.querySelector('[data-testid="whats-new-item"]'); const res = []; const w = document.createTreeWalker(li, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (!n.data.trim()) continue; const lines = []; let last = null; for (let i = 0; i < n.length; i++) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const rc = r.getClientRects()[0]; if (!rc) continue; const t = Math.round(rc.top); if (last === null || Math.abs(t - last) > 4) { lines.push(""); last = t; } lines[lines.length - 1] += n.data[i]; } res.push(lines); } return res; });
  if (tz === "Asia/Seoul") await p.screenshot({ path: `${SH}/whatsnew-sheet-375-dark.png` });
  out["wn-" + tz] = { tip, moreText: moreText.replace(/\n/g, " "), count: items.length, newCount: items.filter((i) => i.isNew).length, first3: items.slice(0, 3), wrap };
  if (tz === "Asia/Seoul") {
    await p.locator('[data-testid="whats-new-item"]').first().locator('[data-testid="whats-new-go"]').click(); await p.waitForTimeout(1200);
    out.wnGo = { hash: p.url().split("#")[1], block: await p.locator('[data-testid="exchange-totals"]').count(), title: await p.evaluate(() => document.body.innerText.includes("총 암호화폐 평가금액")), text거래소별: await p.evaluate(() => /거래소별/.test(document.body.innerText)) };
    await p.screenshot({ path: `${SH}/whatsnew-go-demo-375-dark.png` });
    // 320 시트 줄바꿈
  }
  out["wn-" + tz].errs = errs;
  await ctx.close();
}
// 320 시트 줄바꿈
{ const ctx = await b.newContext({ viewport: { width: 320, height: 800 }, timezoneId: "Asia/Seoul" }); await blockExternal(ctx, ext); await setTheme(ctx, HEAD, "dark"); const p = await ctx.newPage(); await enterDemo(p, HEAD);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("open-whats-new", { detail: { source: "more" } }))); await p.waitForSelector('[data-testid="whats-new-sheet"]'); await p.waitForTimeout(600);
  out.wn320 = await p.evaluate(() => { const li = document.querySelector('[data-testid="whats-new-item"]'); const res = []; const w = document.createTreeWalker(li, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (!n.data.trim()) continue; const lines = []; let last = null; for (let i = 0; i < n.length; i++) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const rc = r.getClientRects()[0]; if (!rc) continue; const t = Math.round(rc.top); if (last === null || Math.abs(t - last) > 4) { lines.push(""); last = t; } lines[lines.length - 1] += n.data[i]; } res.push(lines); } return res; });
  await p.screenshot({ path: `${SH}/whatsnew-sheet-320-dark.png` }); await ctx.close(); }
// B) 비체험(실사용 저장소) — GA 횟수·저장 키·인증카드
{
  const c0 = await b.newContext({ viewport: { width: 375, height: 900 } }); await blockExternal(c0, ext); const p0 = await c0.newPage(); await enterDemo(p0, HEAD, { crypto: REAL });
  const data = await p0.evaluate(() => localStorage.getItem("secretasset_asset_data")); await c0.close();
  const ctx = await b.newContext({ viewport: { width: 375, height: 900 }, timezoneId: "Asia/Seoul" }); await blockExternal(ctx, ext); await setTheme(ctx, HEAD, "dark");
  await ctx.addInitScript((d) => { if (!localStorage.getItem("secretasset_asset_data")) localStorage.setItem("secretasset_asset_data", d); }, data);
  const p = await ctx.newPage(); const errs = []; p.on("console", (m) => m.type() === "error" && !/ERR_FAILED|Failed to load resource/.test(m.text()) && errs.push(m.text().slice(0, 200)));
  const reqs = []; p.on("request", (r) => { if (r.method() !== "GET" || /api\//.test(r.url())) reqs.push(r.method() + " " + r.url().replace(HEAD, "").slice(0, 90) + (r.postData() ? " BODY:" + r.postData().slice(0, 200) : "")); });
  await p.goto(HEAD + "/", { waitUntil: "networkidle" }).catch(() => {}); await p.waitForTimeout(2000);
  out.nonTrial = { welcome: await p.locator('[data-testid="welcome-cta-wizard"]').count(), radios: await p.evaluate(() => [...document.querySelectorAll("[role=radio]")].map((x) => x.innerText).slice(0, 4)) };
  await p.getByRole("radio", { name: "상세" }).first().click(); await p.waitForTimeout(700); await p.getByText("암호화폐", { exact: true }).first().click(); await p.waitForTimeout(900);
  const ev = () => p.evaluate(() => (window.dataLayer || []).map((a) => Array.from(a)).filter((a) => a[0] === "event").map((a) => ({ n: a[1], p: a[2] })));
  const keys0 = await p.evaluate(() => Object.keys(localStorage).sort()); const snap0 = await p.evaluate(() => localStorage.getItem("secretasset_asset_data"));
  const before = (await ev()).filter((e) => e.p?.category === "crypto_exchange_open").length;
  const t = p.locator('[data-testid="exchange-totals-toggle"]');
  await t.click(); await p.waitForTimeout(400); await t.click(); await p.waitForTimeout(400); await t.click(); await p.waitForTimeout(400);
  // 화면 떠났다 돌아와 다시 열기
  await p.getByRole("button", { name: "뒤로가기" }).first().click(); await p.waitForTimeout(600); await p.getByText("암호화폐", { exact: true }).first().click(); await p.waitForTimeout(800);
  await p.locator('[data-testid="exchange-totals-toggle"]').click(); await p.waitForTimeout(500);
  const evs = (await ev()); const mine = evs.filter((e) => e.p?.category === "crypto_exchange_open");
  const keys1 = await p.evaluate(() => Object.keys(localStorage).sort()); const snap1 = await p.evaluate(() => localStorage.getItem("secretasset_asset_data"));
  out.ga = { before, count: mine.length, payload: mine[0], gaDisabled: await p.evaluate(() => Object.keys(window).filter((k) => k.startsWith("ga-disable")).map((k) => window[k])), allFeatureCats: [...new Set(evs.filter((e) => e.n === "feature_use").map((e) => e.p.category))] };
  out.storage = { keysAdded: keys1.filter((k) => !keys0.includes(k)), dataUnchanged: snap0 === snap1 };
  out.reqsNonGet = reqs.filter((r) => !/^GET \/_next|^GET \/(icons|images|manifest|favicon)/.test(r)).slice(0, 30);
  // 한 코인 거래소 행 ↔ 코인 카드 대조(C65)
  out.c65 = await p.evaluate(() => { const rows = [...document.querySelectorAll('[data-testid="exchange-totals"] [data-testid="broker-row"]')].map((r) => r.innerText.replace(/\n+/g, " | ")); const legend = document.querySelector('[data-testid="exchange-totals"]').nextElementSibling?.innerText.replace(/\n+/g, " | "); const cards = [...document.querySelectorAll('[data-testid="exchange-totals"]')][0].parentElement.innerText.split("\n").join(" | "); return { rows, legend, cards: cards.slice(cards.indexOf("BT |"), cards.indexOf("BT |") + 600) }; });
  // 인증카드
  await p.getByRole("button", { name: "뒤로가기" }).first().click(); await p.waitForTimeout(500);
  const back2 = p.getByRole("button", { name: "뒤로가기" }).first(); if (await back2.count()) { await back2.click().catch(() => {}); await p.waitForTimeout(500); }
  const share = p.getByRole("button", { name: "인증카드" }).first();
  out.share = { btn: await share.count() };
  if (await share.count()) { await share.click(); await p.waitForTimeout(1500);
    out.share.dialog = await p.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return d ? { text: d.innerText.replace(/\n+/g, " | ").slice(0, 300), block: d.querySelectorAll('[data-testid="exchange-totals"]').length, has거래소별: /거래소별/.test(d.innerText), tabs: [...d.querySelectorAll("button,[role=tab],[role=radio]")].map((x) => x.innerText.replace(/\n/g, " ").slice(0, 12)).filter(Boolean).slice(0, 20) } : null; });
    out.share.docBlocks = await p.locator('[data-testid="exchange-totals"]').count();
    await p.screenshot({ path: `${SH}/sharecard-375-dark.png` }); }
  out.nonTrialErrs = errs;
  await ctx.close();
}
out.ext = [...new Set(ext)].slice(0, 10);
console.log(JSON.stringify(out, null, 1)); await b.close();
