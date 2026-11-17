// 데모 평단 재기준 실측 — node dev-demo-avg-check.mjs <출력 폴더> <preview URL> <태그>
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const [OUT, PV, TAG] = process.argv.slice(2);
const b = await chromium.launch({ proxy });
for (const q of ["demo", "trial"]) {
  const ctx = await b.newContext(ctxOpt(390, "dark"));
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${PV}/?${q}=1`, { waitUntil: "networkidle", timeout: 90000 }).catch((e) => console.log("goto", e.message));
  await p.waitForTimeout(15000);
  const home = (await p.locator("main").innerText()).split("\n").map((t) => t.trim()).filter(Boolean);
  const i = home.findIndex((t) => /순자산/.test(t));
  console.log(`== ${TAG} ${q} | 홈: ${home.slice(Math.max(0, i), i + 4).join(" / ")}`);
  await p.screenshot({ path: `${OUT}/insight4-avg-${TAG}-${q}-home-390-dark.png` });
  await p.evaluate(() => { location.hash = "#detail/stocks"; }); await p.waitForTimeout(4000);
  const st = (await p.locator("main").innerText()).split("\n").map((t) => t.trim()).filter(Boolean);
  const names = ["삼성전자", "SK하이닉스", "Apple|애플", "NVIDIA|엔비디아", "TIGER 미국S&P500", "KODEX 200"];
  const picks = names.map((n) => { const k = st.findIndex((t, j) => n.split("|").includes(t) && /주$/.test(st[j + 1] ?? "")); return k < 0 ? `${n}: ?` : `${n}: ${st.slice(k + 1, k + 5).join(" ¦ ")}`; });
  for (const x of picks) console.log(`   주식 탭 ${x}`);
  await p.screenshot({ path: `${OUT}/insight4-avg-${TAG}-${q}-stocks-390-dark.png`, fullPage: true });
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(6000);
  const rows = await p.locator('[data-testid="grow-row"]').evaluateAll((els) => els.slice(0, 3).map((e) => `${e.dataset.ticker} ${e.querySelector('[data-testid="grow-row-fact"]')?.innerText.replace(/\s+/g, " ")} / ${e.querySelector('[data-testid="grow-row-price"]')?.innerText.replace(/\s+/g, " ") ?? "-"}`));
  console.log(`   이름표 행: ${rows.join(" | ")} | pageerrors ${errs.length}`);
  await p.locator('[data-testid="grow-block"]').screenshot({ path: `${OUT}/insight4-avg-${TAG}-${q}-block-390-dark.png` });
  await ctx.close();
}
await b.close();
