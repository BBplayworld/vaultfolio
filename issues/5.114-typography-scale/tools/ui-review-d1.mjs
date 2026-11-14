// ui-review 추가 판정: D1 원인 패널 시장 줄 폭 수정안 주입 검증
import { chromium, PV, proxy, ctxOpt } from "./lib.mjs";
const OUT = process.argv[2];
const b = await chromium.launch({ proxy });
for (const W of [390, 768, 1024, 1280, 1440]) {
  const ctx = await b.newContext(ctxOpt(W)); const p = await ctx.newPage(); await p.goto(PV + "/?trial=1", { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(5000);
  const l = p.locator('[data-testid="home-cause-line"]'); if (await l.count()) { await l.first().click(); await p.waitForTimeout(1500); }
  const m = () => p.evaluate(() => { const btn = [...document.querySelectorAll("button")].find((e) => /max-w-xs/.test(e.className) && /@container/.test(e.className)); if (!btn) return null; const inner = btn.firstElementChild; const ch = btn.querySelector("svg.lucide-chevron-right"); const br = btn.getBoundingClientRect(); const cr = ch ? ch.getBoundingClientRect() : null; return { btnW: Math.round(br.width), parentW: Math.round(btn.parentElement.getBoundingClientRect().width), content: inner.scrollWidth, client: inner.clientWidth, chevronInside: cr ? cr.right <= br.right + 0.5 && cr.width > 0 : null, text: inner.innerText.replace(/\s+/g, " ").slice(0, 60) }; });
  console.log(W, "현재", JSON.stringify(await m()));
  await p.addStyleTag({ content: `@media (min-width:48rem){ button[class*="max-w-xs"][class*="@container"]{ max-width:22.5rem !important; } }` }); await p.waitForTimeout(500);
  console.log(W, "수정안", JSON.stringify(await m())); await p.screenshot({ path: `${OUT}/fix-d1-${W}.png` }); await ctx.close();
}
await b.close();
