import { launch, enter } from "./h.mjs";
const b = await launch(); const pre = process.env.TAG === "br" ? "max-[360px]" : "max-[359px]"; const o = [];
for (const w of [320, 358, 359, 360]) {
  const { ctx, p } = await enter(b, process.env.BASE, w);
  await p.evaluate(() => { location.hash = "#activity/change-market"; }); await p.waitForTimeout(1500);
  o.push(w + ":" + JSON.stringify(await p.evaluate((pre) => { const host = document.querySelector("main") || document.body; const d = document.createElement("div"); d.className = "space-y-1 border-t pt-3"; d.innerHTML = `<p class="text-sm text-muted-foreground text-pretty break-keep"><span class="whitespace-nowrap font-semibold text-foreground">비교하지 않은 종목 2</span><span id="qa-sep" class="${pre}:hidden"> · </span><span id="qa-reason" class="${pre}:block">해외 자산⁠·⁠채권⁠·⁠금리형 ETF는 코스피와 비교하지 않아요</span></p>`; host.appendChild(d); const g = (id) => getComputedStyle(document.getElementById(id)).display; const p0 = d.querySelector("p"); return { sep: g("qa-sep"), reason: g("qa-reason"), lines: Math.round(p0.getBoundingClientRect().height / parseFloat(getComputedStyle(p0).lineHeight)) }; }, pre)));
  await ctx.close();
}
console.log(process.env.TAG, o.join("  ")); await b.close();
