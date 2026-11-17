// 인사이트 4종 R1 재판정(53ba53b) — 체험·데모 390 SK하이닉스 행. 갱신 대기 후 측정. 코드 수정 0
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const b = await chromium.launch({ proxy });
const one = async (q, scheme = "dark") => { const ctx = await b.newContext(ctxOpt(390, scheme)); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${PV}/?${q}&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(7000);
  await p.evaluate(() => { location.hash = "#activity/report"; });
  for (let i = 0; i < 20; i++) { await p.waitForTimeout(2000); if (await p.locator('[data-testid="grow-row"][data-ticker="000660"]').count() && !(await p.locator('[data-testid="grow-link-skeleton"]').count())) break; }
  const m = p.locator('[data-testid="grow-more"]'); if (await m.count() && (await m.getAttribute("aria-expanded")) === "false") { await m.click(); await p.waitForTimeout(700); }
  const r = await p.evaluate(() => { const fg = getComputedStyle(document.body).color; const row = document.querySelector('[data-testid="grow-row"][data-ticker="000660"]'); const t = (id) => row.querySelector(`[data-testid="${id}"]`); const v = t("grow-row-price")?.querySelector("span");
    return { h: Math.round(row.getBoundingClientRect().height), fact: t("grow-row-fact").innerText.replace(/\n/g, " / "), lf: t("grow-row-label-fact").innerText, since: t("grow-row-since")?.innerText.replace(/\n/g, " / "), trades: t("grow-row-trades")?.innerText, priceFg: v ? getComputedStyle(v).color === fg : null, rowsH: [...document.querySelectorAll('[data-testid="grow-row"]')].filter((x) => !x.closest("[inert]")).map((x) => `${x.dataset.ticker}:${Math.round(x.getBoundingClientRect().height)}`).join(" "), links: [...document.querySelectorAll('[data-testid="grow-link"] > li')].map((x) => x.innerText.replace(/\s+/g, " ")) }; });
  await p.locator('[data-testid="grow-row"][data-ticker="000660"]').screenshot({ path: `${OUT}/i4-r1-${q.replace("=1", "")}-row-000660-390-${scheme}.png` });
  console.log(q, scheme, JSON.stringify(r), "ERR", errs.length); await ctx.close(); return r; };
for (let i = 0; i < 20; i++) { const r = await one("trial=1"); if (!r.since.includes("80.0")) { await one("trial=1", "light"); await one("demo=1"); break; } console.log("옛 배포, 대기"); await new Promise((s) => setTimeout(s, 30000)); }
await b.close();
