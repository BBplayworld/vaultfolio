// 현금 링크·이웃 도움말 터치 영역 전수 측정(1px 격자) + 화면 캡처
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
import { readFileSync } from "node:fs";
const [, , SEEDS, OUT, BASE] = process.argv; const s = JSON.parse(readFileSync(SEEDS, "utf8"))["s2-link"];
const b = await chromium.launch({ proxy });
for (const W of [360, 390]) {
  const ctx = await b.newContext(ctxOpt(W)); await ctx.clock.setFixedTime(new Date(`${s.clock}T03:00:00Z`));
  await ctx.route("**/*", (r) => { const u = r.request().url(); if (/google-analytics|googletagmanager|\/g\/collect/.test(u)) return r.fulfill({ status: 204, body: "" }); if (/\/api\/finance/.test(u)) return r.fulfill({ status: 503, headers: { "X-KIS-Unavailable": "1", "content-type": "application/json" }, body: JSON.stringify({ error: "차단" }) }); if (/\/api\//.test(u)) return r.abort(); return r.continue(); });
  await ctx.addInitScript(({ s }) => { if (sessionStorage.getItem("__s")) return; sessionStorage.setItem("__s", "1"); const L = (k, v) => localStorage.setItem(k, JSON.stringify(v)); L("secretasset_asset_data", s.data); L("secretasset_monthly_snapshots", s.monthly); L("secretasset_daily_snapshots", s.daily); L("secretasset_exchange_rate", s.rates); localStorage.setItem("secretasset_exchange_last_sync_date", s.clock); L("secretasset_tutorial_status", { 1: "skipped", 2: "skipped", 3: "skipped", 4: "skipped", 5: "skipped" }); }, { s });
  const p = await ctx.newPage(); await p.goto(BASE + "/#activity/change", { waitUntil: "domcontentloaded" }).catch(() => {});
  await p.waitForSelector('[data-testid="change-period-year"]', { timeout: 30000 }).catch(() => {}); await p.locator('[data-testid="change-period-year"]').first().click({ timeout: 8000 }).catch((e) => console.log("click", e.message)); await p.waitForTimeout(2500);
  const m = await p.evaluate(() => { const link = document.querySelector('[data-testid="year-settle-cash-link"]'); const hint = document.querySelector('[data-testid="cause-row-unrecorded"] button[aria-label="설명 보기"]'); const blk = document.querySelector('[data-testid="year-settle"]'); if (!link || !hint) return { link: !!link, hint: !!hint };
    const lr = link.getBoundingClientRect(); let miss = 0, tot = 0; for (let y = Math.ceil(lr.top); y < lr.bottom; y++) for (let x = Math.ceil(lr.left); x < lr.right; x++) { tot++; const t = document.elementFromPoint(x, y); if (!(t === link || link.contains(t))) miss++; }
    const hr = hint.getBoundingClientRect(); const cx = hr.left + hr.width / 2, cy = hr.top + hr.height / 2; let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1; for (let y = Math.floor(cy - 24); y <= cy + 24; y++) for (let x = Math.floor(cx - 24); x <= cx + 24; x++) { const t = document.elementFromPoint(x, y); if (t === hint || hint.contains(t)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); } }
    return { link: [Math.round(lr.width), Math.round(lr.height)], linkMissPx: miss, linkTotal: tot, hintHit: [maxX - minX + 1, maxY - minY + 1], block: Math.round(blk.getBoundingClientRect().height * 10) / 10, cs: [getComputedStyle(link).position, getComputedStyle(link).zIndex] }; });
  console.log(W, JSON.stringify(m)); await p.locator('[data-testid="year-settle"]').screenshot({ path: `${OUT}/r3-s2-link-${W}-dark-block.png` });
  // 실제 터치: 링크 위쪽 끝(도움말 확장 영역과 겹치던 곳) 탭 → 도착, 도움말 아이콘 탭 → 팝오버
  const hb = await p.locator('[data-testid="cause-row-unrecorded"] button[aria-label="설명 보기"]').boundingBox(); const lb = await p.locator('[data-testid="year-settle-cash-link"]').boundingBox();
  await p.touchscreen.tap(hb.x + hb.width / 2, hb.y + hb.height / 2); await p.waitForTimeout(600); const pop = await p.evaluate(() => !!document.querySelector("[data-radix-popper-content-wrapper]")); await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  await p.touchscreen.tap(Math.min(hb.x + hb.width / 2, lb.x + lb.width - 2), lb.y + 2); await p.waitForTimeout(1500);
  console.log("   tap hint → popover:", pop, "| tap link top edge under hint → hash:", await p.evaluate(() => location.hash)); await ctx.close();
}
await b.close();
