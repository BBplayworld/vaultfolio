// 인사이트 4종 R2(eb7316a) — 데모·체험 390·320 다크: 연결 문장·행 높이, 수량 문장 폭, 시드 값. 코드 수정 0
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const b = await chromium.launch({ proxy });
for (const q of ["demo=1", "trial=1"]) for (const W of [390, 320]) {
  const ctx = await b.newContext(ctxOpt(W, "dark")); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${PV}/?${q}&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(7000);
  await p.evaluate(() => { location.hash = "#activity/report"; });
  for (let i = 0; i < 20; i++) { await p.waitForTimeout(2000); if (await p.locator('[data-testid="grow-block"]').count() && !(await p.locator('[data-testid="grow-link-skeleton"]').count())) break; }
  await p.waitForTimeout(1500);
  await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: `${OUT}/i4-r2-${q.slice(0, -2)}-first-${W}-dark.png` });
  const m = p.locator('[data-testid="grow-more"]'); if (await m.count() && (await m.getAttribute("aria-expanded")) === "false") { await m.click(); await p.waitForTimeout(700); }
  const r = await p.evaluate(() => { const box = (e) => e.getBoundingClientRect(); const fg = getComputedStyle(document.body).color;
    const rng = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); const rs = [...rg.getClientRects()].filter((x) => x.width > 0); return Math.max(...rs.map((x) => x.right)); };
    const link = document.querySelector('[data-testid="grow-link"]');
    const rows = [...document.querySelectorAll('[data-testid="grow-row"]')].map((row) => { const t = (id) => row.querySelector(`[data-testid="${id}"]`); const op = t("grow-row-open"); const right = box(op).right;
      const pcs = [...op.querySelectorAll(".whitespace-nowrap")].filter((e) => getComputedStyle(e).whiteSpace === "nowrap" && box(e).height > 0).map((e) => rng(e) - right);
      return { t: row.dataset.ticker, l: row.dataset.label, folded: !!row.closest("[inert]"), h: Math.round(box(row).height), fact: t("grow-row-fact").innerText.replace(/\n/g, " "), lf: t("grow-row-label-fact").innerText.replace(/\n/g, " / "), since: t("grow-row-since")?.innerText.replace(/\n/g, " / ") ?? null, qty: t("grow-row-qty")?.dataset.state ?? null, trades: t("grow-row-trades")?.innerText ?? null, maxOver: pcs.length ? Math.round(Math.max(...pcs) * 10) / 10 : null }; });
    return { linkH: link ? Math.round(box(link).height) : null, links: link ? [...link.children].map((x) => `${x.innerText.replace(/\s+/g, " ")} [${Math.round(box(x).height)}]`) : null, docW: document.documentElement.scrollWidth, rows }; });
  console.log(`== ${q} ${W}`, JSON.stringify({ linkH: r.linkH, links: r.links, docW: r.docW }), "ERR", errs.length); for (const x of r.rows) console.log("  ", JSON.stringify(x));
  await p.locator('[data-testid="grow-block"]').screenshot({ path: `${OUT}/i4-r2-${q.slice(0, -2)}-block-${W}-dark.png` });
  if (q === "demo=1" && W === 390) { await p.evaluate(() => { location.hash = "#detail/stocks"; }); await p.waitForTimeout(3000); }
  await ctx.close();
}
await b.close();
