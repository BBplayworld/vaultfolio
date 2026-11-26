// 증권사 블록 펼친 상태(10자리) + 현금 9자리 출금·긴 메모 행. BASE·TAG·SHOTS
import { launch, enter } from "./h.mjs";
const b = await launch(); const out = {};
for (const w of process.argv[2].split(",").map(Number)) for (const light of (process.argv[3] === "both" && w === 359 ? [false, true] : [false])) {
  const { ctx, p } = await enter(b, process.env.BASE, w, { light });
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem("secretasset_asset_data")); d.stocks.find((x) => x.id === "demo_st_samsung").quantity = 20000;
    for (const c of d.cash) d.cashTransactions.push({ reflected: true, reflectedAt: "2026-11-20", createdAt: "2026-11-20", date: "2026-11-20", id: "qa_" + c.id, cashId: c.id, type: "withdrawal", amount: 123456789, currency: c.currency || "KRW", memo: "전세 보증금 잔금 이체와 중개 수수료 정산 메모가 길어지는 경우" });
    localStorage.setItem("secretasset_asset_data", JSON.stringify(d)); window.dispatchEvent(new Event("storage")); });
  await p.waitForTimeout(1200);
  await p.evaluate(() => { location.hash = "#detail/stocks"; }); await p.waitForTimeout(1500);
  const state = async () => p.evaluate(() => { const t = document.querySelector('[data-testid="broker-totals-toggle"]'); return t?.getAttribute("aria-expanded"); });
  const s0 = await state(); if (s0 !== "true") { await p.getByTestId("broker-totals-toggle").click(); await p.waitForTimeout(900); }
  const m = await p.evaluate(() => { const f = (n) => +n.toFixed(1); const de = document.documentElement; return { hs: de.scrollWidth - de.clientWidth, rows: [...document.querySelectorAll('[data-testid="broker-row-resync"]')].map((e) => { const row = e.parentElement; const rr = row.getBoundingClientRect(); const cs = getComputedStyle(row); const inR = rr.right - parseFloat(cs.paddingRight); const r = e.getBoundingClientRect(); const sib = [...row.children].filter((c) => c !== e); const sr = sib.map((c) => c.getBoundingClientRect()); const card = row.closest('[class*="rounded"]')?.getBoundingClientRect(); const hit = document.elementFromPoint(Math.min(r.right - 4, innerWidth - 1), r.top + r.height / 2); return { txt: row.innerText.replace(/\s+/g, " ").slice(0, 60), visible: rr.height > 0 && r.height > 0, wrapped: r.top >= Math.max(...sr.map((s) => s.bottom)) - 1, btnRightMinusInner: f(r.right - inR), rowScroll: row.scrollWidth - row.clientWidth, btn: [f(r.width), f(r.height)], rowH: f(rr.height), cardOver: card ? f(r.right - card.right) : null, viewportOver: f(r.right - innerWidth), hitIsBtn: !!hit && (hit === e || e.contains(hit)), sibText: sib.map((c) => c.innerText.replace(/\s+/g, " ").slice(0, 40)).join(" / ") }; }) }; });
  const el = p.getByTestId("broker-totals-toggle").locator("xpath=ancestor::*[.//*[@data-testid='broker-row-resync']][1]");
  await el.screenshot({ path: `${process.env.SHOTS}/${process.env.TAG}-broker10-${w}-${light ? "light" : "dark"}.png`, animations: "disabled" }).catch(async () => { await p.screenshot({ path: `${process.env.SHOTS}/${process.env.TAG}-broker10-${w}-${light ? "light" : "dark"}.png` }); });
  // 현금 거래: 생활비 통장
  await p.evaluate(() => { location.hash = "#detail/cash"; }); await p.waitForTimeout(1200);
  await p.evaluate(() => { const b = [...document.querySelectorAll('button[aria-expanded="false"]')].find((x) => x.innerText.includes("생활비 통장")); b?.click(); }); await p.waitForTimeout(700);
  await p.evaluate(() => { const e = [...document.querySelectorAll("button")].find((x) => x.getClientRects().length && x.innerText.includes("입출금 내역")); e?.click(); }); await p.waitForTimeout(1300);
  const c = await p.evaluate(() => { const f = (n) => +n.toFixed(1); const de = document.documentElement; const range = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
    const rows = [...document.querySelectorAll('[class*="max-[360px]:flex-wrap"],[class*="max-[359px]:flex-wrap"]')]; return { title: document.querySelector("h1,h2")?.innerText, hs: de.scrollWidth - de.clientWidth, rows: rows.map((row) => { const amt = row.querySelector('[class*="px]:ml-auto"]'); const date = row.querySelector("p.tabular-nums, p[class*='text-xs'] span"); const ar = range(amt), dr = date ? range(date) : null; const memo = [...row.querySelectorAll("p")].find((x) => x.className.includes("break-keep")); return { amt: amt.innerText, wrap: getComputedStyle(row).flexWrap, dateFont: date ? getComputedStyle(date).fontSize : null, amtLines: Math.round(ar.height / parseFloat(getComputedStyle(amt).lineHeight)), overlapDateAmt: dr ? !(dr.right <= ar.left || ar.right <= dr.left || dr.bottom <= ar.top || ar.bottom <= dr.top) : null, rowScroll: row.scrollWidth - row.clientWidth, rowH: f(row.getBoundingClientRect().height), memoFont: memo ? getComputedStyle(memo).fontSize : null }; }) }; });
  await p.screenshot({ path: `${process.env.SHOTS}/${process.env.TAG}-cash9-${w}-${light ? "light" : "dark"}.png`, fullPage: true, animations: "disabled" });
  out[`${w}${light ? "L" : ""}`] = { toggle0: s0, broker: m, cash: c };
  await ctx.close();
}
console.log(JSON.stringify(out, null, 0)); await b.close();
