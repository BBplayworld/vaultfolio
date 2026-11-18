import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
export { chromium, proxy };
export const PV = "https://secretasset-git-issue-5127-bbplayworlds-projects.vercel.app";
export const OUT = "/home/user/vaultfolio/.memory/issues/5.127-242-grow-expand/screenshots/review";
export const lines = (p, sel) => p.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const m = new Map(); const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const re = /\S+/g; let x; while ((x = re.exec(n.data))) { const r = document.createRange(); r.setStart(n, x.index); r.setEnd(n, x.index + x[0].length); const b = r.getBoundingClientRect(); if (!b.width) continue; const k = Math.round(b.top / 6); m.set(k, [...(m.get(k) ?? []), x[0]]); } } return [...m.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1].join(" ")); }, sel);
export const box = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; }, sel);
export async function open(br, W, scheme = "dark", { route } = {}) {
  const ctx = await br.newContext({ viewport: { width: W, height: W < 700 ? 844 : 900 }, deviceScaleFactor: 2, colorScheme: scheme, isMobile: W < 700, hasTouch: W < 1100 });
  await ctx.addCookies([{ name: "theme_mode", value: scheme, domain: "secretasset-git-issue-5127-bbplayworlds-projects.vercel.app", path: "/" }]);
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", (e) => p.errs.push(String(e).slice(0, 200)));
  if (route) await route(p);
  await p.goto(`${PV}/?trial=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(6000);
  return { ctx, p };
}
export async function toReport(p) { await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForSelector('[data-testid="grow-row"]', { timeout: 30000 }); await p.waitForTimeout(3000); }
