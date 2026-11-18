// 데모·체험 성적표 기록 등급 읽기 — 시드 등급 값 결정용
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const [PV] = process.argv.slice(2);
const b = await chromium.launch({ proxy });
for (const q of ["demo", "trial"]) {
  const ctx = await b.newContext(ctxOpt(390)); const p = await ctx.newPage();
  await p.goto(`${PV}/?${q}=1`, { waitUntil: "load", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(15000);
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(8000);
  console.log(q, await p.evaluate(() => { const d = JSON.parse(localStorage.getItem("secretasset_daily_snapshots") || "[]"); return JSON.stringify(d.filter((x) => x.grade).map((x) => [x.date, x.grade])); }));
  await ctx.close();
}
await b.close();
