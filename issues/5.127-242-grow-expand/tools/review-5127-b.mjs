import { chromium, proxy, open, toReport, lines, box, OUT } from "./review-5127-lib.mjs";
const br = await chromium.launch({ proxy }); const out = {};
const W = +process.argv[2], scheme = process.argv[3] ?? "dark"; const tag = `${W}-${scheme}`;
const { ctx, p } = await open(br, W, scheme);
await toReport(p);
// 실물 2건 — 실제 등록 폼으로
const addPhys = async (name, cur, buy, date) => {
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("trigger-add-physical"))); await p.waitForSelector('[data-testid="physical-form"]', { timeout: 8000 });
  await p.fill('[data-testid="physical-name"]', name);
  await p.fill('[data-testid="physical-current-value"]', String(cur));
  if (buy) await p.fill('[data-testid="physical-purchase-price"]', String(buy));
  await p.fill('[data-testid="physical-purchase-date"]', date);
  await p.click('[data-testid="physical-submit"]'); await p.waitForTimeout(1500);
  return p.evaluate(() => !!document.querySelector('[data-testid="physical-form"]'));
};
try { out.add1 = await addPhys("골드바 100g", 13820000, 10000000, "2023-10-15"); out.add2 = await addPhys("손목시계", 4200000, 0, "2024-07-10"); } catch (e) { out.addErr = String(e).slice(0, 300); await p.screenshot({ path: `${OUT}/r7-x-adderr-${tag}.png` }); }
out.phys = await p.evaluate(() => localStorage.getItem("secretasset.physical_assets"));
out.hash = await p.evaluate(() => location.hash);
await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(2500);
out.seg = await lines(p, '[data-testid="report-tabs"]');
await p.click('[data-testid="grow-kind"][data-kind="real"]'); await p.waitForTimeout(800);
out.list = await lines(p, '[data-testid="grow-list"]');
out.rows = await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row"]')].map((e) => [e.dataset.key, e.dataset.label, Math.round(e.querySelector('[data-testid="grow-row-toggle"]').getBoundingClientRect().height), e.querySelector('[data-testid="grow-row-rate"]')?.textContent]));
await p.screenshot({ path: `${OUT}/r7-07p-own-physical-${tag}.png`, fullPage: true });
const rows = p.locator('[data-testid="grow-row"][data-kind="physical"] [data-testid="grow-row-toggle"]');
out.sheets = [];
for (let i = 0; i < await rows.count(); i++) { await rows.nth(i).click(); await p.waitForTimeout(700); out.sheets.push(await lines(p, `[data-testid="grow-row"][data-kind="physical"] >> nth=${i}`).catch(() => null)); out.sheets.push(await p.evaluate((i) => { const r = document.querySelectorAll('[data-testid="grow-row"][data-kind="physical"]')[i]; const m = new Map(); const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const rg = document.createRange(); rg.selectNodeContents(n); const b = rg.getBoundingClientRect(); if (!b.width) continue; const k = Math.round(b.top / 8); m.set(k, [...(m.get(k) ?? []), n.data.trim()]); } return [...m.values()].map((v) => v.join(" ")); }, i)); await p.screenshot({ path: `${OUT}/r7-07q-physical-sheet${i + 1}-${tag}.png`, fullPage: true }); }
// 평가액 고치기 → 창 → 닫기(마우스/탭) 뒤 포커스
const edit = p.locator('[data-testid="grow-value-edit"]').last();
out.editText = await edit.textContent();
if (W < 700) await edit.tap(); else await edit.click(); await p.waitForTimeout(1500);
out.dialog = await p.evaluate(() => document.querySelector('[role="dialog"]')?.textContent.slice(0, 30) ?? null);
await p.screenshot({ path: `${OUT}/r7-07r-physical-edit-${tag}.png` });
const close = p.locator('[role="dialog"] button:has-text("Close"), [role="dialog"] [data-slot="dialog-close"], [role="dialog"] button[aria-label*="닫"]').first();
out.closeBtn = await close.count();
if (out.closeBtn) { if (W < 700) await close.tap(); else await close.click(); } else await p.keyboard.press("Escape");
await p.waitForTimeout(1200);
out.afterClose = await p.evaluate(() => ({ dialog: !!document.querySelector('[role="dialog"]'), active: document.activeElement?.dataset?.testid ?? document.activeElement?.tagName, text: document.activeElement?.textContent?.slice(0, 20), open: [...document.querySelectorAll('[data-testid="grow-row-toggle"]')].map((e) => e.getAttribute("aria-expanded")) }));
// 실거래 추정 줄 — 저장값 주입(등록 폼으로는 만들 수 없는 파생값)
await p.evaluate(() => { const d = JSON.parse(localStorage.getItem("secretasset_asset_data")); d.realEstate[0].marketEstimate = 529000000; d.realEstate[0].marketEstimateDate = "2026-09-14"; localStorage.setItem("secretasset_asset_data", JSON.stringify(d)); window.dispatchEvent(new Event("storage")); }); await p.waitForTimeout(1200);
const re = p.locator('[data-testid="grow-row"][data-kind="real"] [data-testid="grow-row-toggle"]');
if ((await re.getAttribute("aria-expanded")) !== "true") { await re.click(); await p.waitForTimeout(700); }
out.estimate = await lines(p, '[data-testid="grow-value-estimate"]'); out.valueBox = await box(p, '[data-testid="grow-row"][data-kind="real"] [data-testid="grow-value"]');
await p.screenshot({ path: `${OUT}/r7-07s-estimate-${tag}.png`, fullPage: true });
out.docW = await p.evaluate(() => document.documentElement.scrollWidth); out.errs = p.errs;
console.log(JSON.stringify(out)); await br.close();
