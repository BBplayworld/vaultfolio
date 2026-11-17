// 인사이트 4종 R2 재판정(d72e5ec) — 데모 평단 재기준 전후: 이름표 행·주식 탭·홈·자산 변화(월·연 결산) 넣은 돈. 코드 수정 0
// node ui-review-insight4-r2b.mjs <OUT>
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const OUT = process.argv[2];
const AFTER = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app", BEFORE = "https://secretasset-4s5q8al1a-bbplayworlds-projects.vercel.app";
const b = await chromium.launch({ proxy });
const lines = async (p) => (await p.locator("main").innerText()).split("\n").map((t) => t.trim()).filter(Boolean);
const around = (arr, re, n = 3) => { const out = []; arr.forEach((t, i) => { if (re.test(t)) out.push(arr.slice(i, i + n).join(" ¦ ")); }); return out; };
for (const [tag, PV, W, q] of [["after", AFTER, 390, "demo"], ["after", AFTER, 320, "demo"], ["after", AFTER, 390, "trial"], ["before", BEFORE, 390, "demo"]]) {
  const ctx = await b.newContext(ctxOpt(W, "dark")); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${PV}/?${q}=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch((e) => console.log("goto", e.message)); await p.waitForTimeout(15000);
  const k = `${tag}-${q}-${W}`;
  const home = await lines(p); const hi = home.findIndex((t) => /순자산/.test(t)); console.log(`== ${k} 홈`, home.slice(Math.max(0, hi), hi + 4).join(" / "), "docW", await p.evaluate(() => document.documentElement.scrollWidth));
  await p.screenshot({ path: `${OUT}/i4-r2b-${k}-home-dark.png` });
  await p.evaluate(() => { location.hash = "#detail/stocks"; }); await p.waitForTimeout(4500);
  const st = await lines(p); for (const n of ["삼성전자", "SK하이닉스", "Apple", "애플", "NVIDIA", "엔비디아", "TIGER 미국S&P500", "KODEX 200"]) { const j = st.findIndex((t, x) => t === n && /주$/.test(st[x + 1] ?? "")); if (j >= 0) console.log(`   주식 ${n}: ${st.slice(j + 1, j + 5).join(" ¦ ")}`); }
  console.log("   주식 docW", await p.evaluate(() => document.documentElement.scrollWidth));
  await p.screenshot({ path: `${OUT}/i4-r2b-${k}-stocks-dark.png`, fullPage: true });
  await p.evaluate(() => { location.hash = "#activity/report"; }); for (let i = 0; i < 15; i++) { await p.waitForTimeout(2000); if (!(await p.locator('[data-testid="grow-link-skeleton"]').count()) && await p.locator('[data-testid="grow-block"]').count()) break; }
  console.log("   이름표", JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row"]')].filter((r) => !r.closest("[inert]")).map((r) => { const op = r.querySelector('[data-testid="grow-row-open"]'); const R = op.getBoundingClientRect().right; const over = Math.max(...[...op.querySelectorAll(".whitespace-nowrap")].filter((e) => e.getBoundingClientRect().height > 0).map((e) => { const rg = document.createRange(); rg.selectNodeContents(e); return Math.max(...[...rg.getClientRects()].map((x) => x.right)) - R; })); return `${r.dataset.ticker}:${Math.round(r.getBoundingClientRect().height)}:${r.querySelector('[data-testid="grow-row-fact"]').innerText.replace(/\s+/g, " ")}:${r.querySelector('[data-testid="grow-row-since"]')?.innerText.replace(/\s+/g, " ") ?? "-"}:over${Math.round(over)}`; }))), "링크", JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-link"] > li')].map((x) => `${x.innerText.replace(/\s+/g, " ")}[${Math.round(x.getBoundingClientRect().height)}]`))));
  await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: `${OUT}/i4-r2b-${k}-report-dark.png` });
  // 자산 변화 연(결산) — 옛 해시 netasset = 모든 자산·연
  await p.evaluate(() => { location.hash = "#activity/netasset"; }); await p.waitForTimeout(6000);
  console.log("   결산", JSON.stringify(await p.evaluate(() => { const s = document.querySelector('[data-testid="year-settle"]'); if (!s) return null; return { state: s.dataset.state, delta: s.querySelector('[data-testid="year-settle-head-delta"]')?.dataset.value, rows: [...s.querySelectorAll("[data-testid^='year-settle-group'], [data-testid^='year-settle-row']")].map((e) => `${e.dataset.testid}=${e.dataset.value}`), text: s.innerText.replace(/\n+/g, " ¦ ").slice(0, 400) }; })));
  await p.locator('[data-testid="year-settle"]').screenshot({ path: `${OUT}/i4-r2b-${k}-year-settle-dark.png` }).catch(() => {});
  // 자산 변화 월
  const mb = p.locator('[data-testid="change-period-month"]'); if (await mb.count()) { await mb.first().click(); await p.waitForTimeout(4000); }
  const mo = await lines(p); console.log("   월", around(mo, /넣은 돈|빠져나간|불어난|순입금|입금|투입/, 3).slice(0, 10).join(" ‖ "));
  await p.screenshot({ path: `${OUT}/i4-r2b-${k}-change-month-dark.png`, fullPage: true });
  console.log("   ERR", errs.length, errs.slice(0, 2).join(" // ")); await ctx.close();
}
await b.close();
