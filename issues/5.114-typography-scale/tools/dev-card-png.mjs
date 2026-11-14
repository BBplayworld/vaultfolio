import { execSync } from "node:child_process"; import { createRequire } from "node:module"; import path from "node:path"; import fs from "node:fs"; import crypto from "node:crypto";
const g = execSync("npm root -g",{encoding:"utf8"}).trim();
const { chromium } = createRequire(path.join(g,"noop.js"))("playwright");
const OUT = process.argv[2];
const BASES = { prod: "https://www.secretasset.xyz", pv: "https://secretasset-git-issue-5114-bbplayworlds-projects.vercel.app" };
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const b = await chromium.launch({ proxy });
const res = {};
for (const [name, base] of Object.entries(BASES)) for (const W of [390, 1280]) {
  const ctx = await b.newContext({ viewport: { width: W, height: W < 700 ? 844 : 900 }, deviceScaleFactor: 1, colorScheme: "dark", isMobile: W < 700, hasTouch: W < 700, acceptDownloads: true });
  const p = await ctx.newPage();
  try {
    await p.goto(base + "/?trial=1", { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
    await p.waitForTimeout(3500);
    await p.locator('[data-testid="top-bar-share-card"]').first().click();
    await p.waitForTimeout(2500);
    for (const v of ["투자 유형", "주식 현황", "포트폴리오"]) {
      await p.getByRole("radio", { name: v }).click();
      await p.waitForTimeout(2500);
      // 프리뷰 영역 글자 크기 수집
      const fsz = await p.evaluate(() => { const d = document.querySelector('[role="dialog"]'); const s = {}; const w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (!n.nodeValue.trim() || !n.parentElement.closest(".type-fixed")) continue; const f = getComputedStyle(n.parentElement).fontSize; s[f] = (s[f] || 0) + 1; } return s; });
      await p.screenshot({ path: path.join(OUT, `dlg-${name}-${W}-${v}.png`) });
      const icon = p.locator('[aria-label="이미지로 저장"]');
      const btn = (await icon.count()) ? icon.first() : p.getByRole("button", { name: /^저장$/ });
      const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 30000 }), btn.click()]);
      const f = path.join(OUT, `card-${name}-${W}-${v}.png`); await dl.saveAs(f);
      const h = crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex").slice(0, 12);
      res[`${name}-${W}-${v}`] = h; console.log(name, W, v, h, fs.statSync(f).size, JSON.stringify(fsz));
      await p.waitForTimeout(1500);
    }
  } catch (e) { console.log("ERR", name, W, e.message.slice(0, 300)); }
  await ctx.close();
}
await b.close();
