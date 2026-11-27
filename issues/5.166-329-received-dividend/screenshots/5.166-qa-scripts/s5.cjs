const { launch } = require("./lib.cjs");
const F = require("./flow.cjs");
const fs = require("fs");
const OUT = "/home/user/vaultfolio/.memory/issues/5.166-329-received-dividend/screenshots/5.166-qa-";
const L = (k, v) => console.log(k, typeof v === "string" ? v : JSON.stringify(v));
const AFTER = JSON.parse(fs.readFileSync(__dirname + "/../state-after-s2.json", "utf8"));
const K = F.TAGKEY;
const LONG = "TIGER 미국배당다우존스타겟커버드콜2호";
// 최장 종목명·9자리 금액 픽스처
function longSeed() { const s = { ...AFTER }; const tags = JSON.parse(s[K]); const ids = Object.keys(tags).filter((k) => k !== "v"); tags[ids[1]] = { kind: "dividend", ticker: "458730", stockName: LONG }; s[K] = JSON.stringify(tags); const ad = JSON.parse(s.secretasset_asset_data); const t = ad.cashTransactions.find((x) => x.id === ids[1]); t.amount = 123456789; s.secretasset_asset_data = JSON.stringify(ad); return s; }
function noCashSeed() { const s = { ...F.DUMP }; const ad = JSON.parse(s.secretasset_asset_data); ad.cash = []; ad.cashTransactions = []; s.secretasset_asset_data = JSON.stringify(ad); return s; }
// 줄 조각 분석: 조각 안 꺾임, 줄 머리·끝 점, 점 글리프 vs 자르는 선
const analyze = (page, sel) => page.evaluate((sel) => {
  const row = document.querySelector(sel); if (!row) return null;
  const rr = row.getBoundingClientRect(); const cs = getComputedStyle(row); const lh = parseFloat(cs.lineHeight) || 20;
  const clip = cs.clipPath; const m = /inset\(([^)]+)\)/.exec(clip); const leftCut = m ? parseFloat(m[1].trim().split(/\s+/)[3]) : 0;
  const cutX = rr.left + leftCut;
  const frags = [...row.children].map((c) => { const r = c.getBoundingClientRect(); const dot = [...c.querySelectorAll("span[aria-hidden]")].find((s) => s.textContent.includes("·")); let glyph = null; if (dot) { const rg = document.createRange(); const tn = dot.firstChild; const i = tn.textContent.indexOf("·"); rg.setStart(tn, i); rg.setEnd(tn, i + 1); const g = rg.getBoundingClientRect(); glyph = [Math.round(g.left * 100) / 100, Math.round(g.right * 100) / 100]; }
    return { t: c.textContent.trim().slice(0, 28), top: Math.round(r.top), h: Math.round(r.height * 10) / 10, lines: Math.round(r.height / lh), glyph, dotHidden: glyph ? glyph[1] <= cutX : null, lineHead: Math.abs(r.left - rr.left) < 1 }; });
  return { rowH: Math.round(rr.height * 10) / 10, cutX: Math.round(cutX * 100) / 100, frags, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth };
}, sel);
async function focusShot(page, testId, file) {
  await page.keyboard.press("Tab");
  await page.evaluate((id) => document.querySelector(`[data-testid="${id}"]`).focus(), testId);
  await page.waitForTimeout(250);
  const info = await page.evaluate((id) => { const el = document.querySelector(`[data-testid="${id}"]`); const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { fv: el.matches(":focus-visible"), shadow: cs.boxShadow.slice(0, 80), left: Math.round(r.left * 10) / 10, top: r.top, w: r.width, h: r.height }; }, testId);
  await page.screenshot({ path: file, clip: { x: 0, y: Math.max(0, info.top - 30), width: Math.min(260, page.viewportSize().width), height: 80 } });
  await page.evaluate(() => document.activeElement?.blur());
  return info;
}
// 줄 머리 점 픽셀 검사: 점 span을 숨긴 캡처와 바이트 비교(같으면 점이 화면에 그려지지 않는다)
async function dotPixelCheck(page, rowSel) {
  const box = await page.evaluate((sel) => { const row = document.querySelector(sel); const r = row.getBoundingClientRect(); return { x: Math.max(0, r.left - 2), y: r.top - 2, width: 40, height: r.height + 4 }; }, rowSel);
  const a = await page.screenshot({ clip: box });
  await page.evaluate((sel) => { document.querySelectorAll(sel + " > span").forEach((f) => { if (Math.abs(f.getBoundingClientRect().left - document.querySelector(sel).getBoundingClientRect().left) < 1) f.querySelectorAll("span[aria-hidden]").forEach((d) => { if (d.textContent.includes("·")) d.style.visibility = "hidden"; }); }); }, rowSel);
  const b = await page.screenshot({ clip: box });
  await page.evaluate((sel) => document.querySelectorAll(sel + " span[aria-hidden]").forEach((d) => { d.style.visibility = ""; }), rowSel);
  return a.equals(b);
}
(async () => {
  const b = await launch();
  const combos = [[320, "light"], [320, "dark"], [375, "light"], [375, "dark"], [390, "light"], [390, "dark"], [1280, "light"], [1280, "dark"]];
  for (const [w, theme] of combos) {
    const tag = `${w}-${theme}`; const h = w === 1280 ? 900 : 844;
    // ① 합계 칩(최장 금액) + 달 칩 + 포커스
    const A = await F.newSeeded(b, { width: w, height: h, theme, seed: longSeed() }); const p = A.page;
    await F.gotoDividend(p);
    L(tag + " theme", await F.themeOf(p));
    const c = await F.conclusion(p); L(tag + " sum", { row: c.rowText, rowH: c.rowH, chipH: c.chipH, hit: c.hit, next: c.next, ox: c.scrollX });
    L(tag + " sum frags", await analyze(p, '[data-testid="dividend-conclusion"]'));
    L(tag + " dot pixels hidden(sum)", await dotPixelCheck(p, '[data-testid="dividend-conclusion"]'));
    await p.screenshot({ path: `${OUT}${tag}-1-conclusion-sum.png` });
    L(tag + " focus sum", await focusShot(p, "dividend-received", `${OUT}${tag}-1b-focus-sum.png`));
    const m3 = await F.clickMonth(p, 3); L(tag + " month3", m3);
    if (m3.chip) L(tag + " focus month", await focusShot(p, "dividend-received-month", `${OUT}${tag}-2b-focus-month.png`));
    await p.screenshot({ path: `${OUT}${tag}-2-month.png` });
    // 달 칩 실클릭 → 폼
    if (m3.chip) { await F.openChip(p, "dividend-received-month"); const fs1 = await F.formState(p); L(tag + " month chip opens form", { dividend: fs1.dividend, dep: fs1.depositBrand, ox: fs1.dlgOverflowX }); await p.keyboard.press("Escape"); await p.waitForTimeout(500); L(tag + " focus after esc", await p.evaluate(() => document.activeElement?.getAttribute("data-testid"))); }
    await p.click('[data-testid="dividend-month-badge"]').catch(() => {}); await p.waitForTimeout(250);
    const m1 = await F.clickMonth(p, 1); L(tag + " month1(no record)", { chip: m1.chip, cellH: m1.cellH, chartTop: m1.chartTop });
    await p.click('[data-testid="dividend-month-badge"]').catch(() => {}); await p.waitForTimeout(250);
    // ② 폼(칩 진입) 켬/끔 + 중복 요약(9자리)
    await F.openChip(p); const on = await F.formState(p); await p.locator('[role="dialog"]').screenshot({ path: `${OUT}${tag}-3-form-on.png` });
    await p.click('[data-testid="cash-tx-dividend-check"]'); await p.waitForTimeout(350); const off = await F.formState(p); await p.locator('[role="dialog"]').screenshot({ path: `${OUT}${tag}-4-form-off.png` });
    L(tag + " form", { on: [on.recBox, on.divBox, on.recDisabled, on.recHelp], off: [off.recBox, off.divBox, off.recDisabled, off.recHelp], ox: [on.dlgOverflowX, off.dlgOverflowX] });
    await p.click('[data-testid="cash-tx-dividend-check"]'); await p.waitForTimeout(350);
    await F.pickAccount(p, "생활비 통장"); await F.fill(p, { amount: 123456789, date: `${F.YEAR}-03-10` }); await F.setReflected(p, false);
    await p.locator('[role="dialog"] button[type="submit"]').click(); await p.waitForSelector('[data-testid="cash-tx-dup-summary"]', { timeout: 5000 }).catch(() => {});
    L(tag + " dup frags", await analyze(p, '[data-testid="cash-tx-dup-summary"]'));
    if (await p.locator('[data-testid="cash-tx-dup-summary"]').count()) { L(tag + " dot pixels hidden(dup)", await dotPixelCheck(p, '[data-testid="cash-tx-dup-summary"]')); await p.locator('[role="dialog"]').screenshot({ path: `${OUT}${tag}-5-dup.png` }); await p.getByRole("button", { name: "취소", exact: true }).last().click(); await p.waitForTimeout(300); }
    await p.keyboard.press("Escape"); await p.waitForTimeout(400);
    // ③ 거래 행
    await p.goto(F.BASE + "/#detail/cash"); await p.waitForTimeout(1500);
    await p.locator("main button", { hasText: "생활비 통장" }).first().click(); await p.waitForTimeout(500);
    await p.getByRole("button", { name: "입출금 내역" }).first().click(); await p.waitForTimeout(900);
    L(tag + " rows", await p.evaluate(() => [...document.querySelectorAll('[aria-label="거래 삭제"]')].slice(0, 4).concat([...document.querySelectorAll('[aria-label="거래 삭제"]')].slice(-1)).map((b) => { const r = b.parentElement; const bd = r.querySelector('[data-testid="tx-dividend-badge"]'); const st = r.querySelector('[data-testid="tx-dividend-stock"]'); const br = bd?.getBoundingClientRect(); return { h: Math.round(r.getBoundingClientRect().height * 10) / 10, title: r.querySelector(".flex-wrap").textContent, badge: bd ? `${Math.round(br.width)}x${Math.round(br.height)}` : null, stock: st ? { t: st.textContent.slice(0, 12), trunc: st.scrollWidth > st.clientWidth, h: Math.round(st.getBoundingClientRect().height) } : null, amt: r.querySelector("span.font-bold")?.textContent, ox: r.scrollWidth - r.clientWidth }; })));
    L(tag + " rows overflowX", await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
    await p.screenshot({ path: `${OUT}${tag}-6-tx-rows.png`, fullPage: true });
    L(tag + " errs", [...new Set(A.errs)]); await A.ctx.close();
    // ④ 빈 칩(받은 배당 적기)
    const E = await F.newSeeded(b, { width: w, height: h, theme }); await F.gotoDividend(E.page);
    const ce = await F.conclusion(E.page); L(tag + " empty", { row: ce.rowText, rowH: ce.rowH, state: ce.chipState, hit: ce.hit, next: ce.next });
    L(tag + " empty frags", await analyze(E.page, '[data-testid="dividend-conclusion"]')); L(tag + " dot pixels hidden(empty)", await dotPixelCheck(E.page, '[data-testid="dividend-conclusion"]'));
    L(tag + " focus empty", await focusShot(E.page, "dividend-received", `${OUT}${tag}-7b-focus-empty.png`));
    await E.page.screenshot({ path: `${OUT}${tag}-7-conclusion-empty.png` }); await E.ctx.close();
    // ⑤ 현금 계좌 0 → 다음 지급
    const Nn = await F.newSeeded(b, { width: w, height: h, theme, seed: noCashSeed() }); await F.gotoDividend(Nn.page);
    const cn = await F.conclusion(Nn.page); L(tag + " no-cash", { row: cn.rowText, rowH: cn.rowH, chip: cn.chipText ?? null, next: cn.next });
    await Nn.page.screenshot({ path: `${OUT}${tag}-8-conclusion-next.png` }); await Nn.ctx.close();
    // ⑥ 계산 합계 0 + 기록 있음 → solo / 기록도 0 → 없음
    for (const [nm, seed] of [["solo", longSeed()], ["none", F.DUMP]]) {
      const So = await F.newSeeded(b, { width: w, height: h, theme, seed, mock: false });
      await So.page.route("**/api/finance/dividend**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) }));
      await So.page.goto(F.BASE + "/#activity/dividend"); await So.page.waitForTimeout(3500);
      const cs = await So.page.evaluate(() => { const s = document.querySelector('[data-testid="dividend-received-solo"]'); const chip = document.querySelector('[data-testid="dividend-received"]'); const card = [...document.querySelectorAll('[data-slot="card"]')].find((c) => /배당/.test(c.textContent)); const cr = chip?.getBoundingClientRect(); let hit = 0; if (cr) { const x = cr.left + cr.width / 2; for (let y = cr.top - 30; y < cr.bottom + 30; y++) { const el = document.elementFromPoint(x, y); if (el && (el === chip || chip.contains(el))) hit++; } } return { solo: !!s, chip: chip?.textContent ?? null, hit, hero: !!document.querySelector('[data-testid="dividend-hero-label"]'), card: card?.innerText.replace(/\s+/g, " ").slice(0, 160), ox: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
      L(tag + " " + nm, cs);
      if (nm === "solo") { await So.page.screenshot({ path: `${OUT}${tag}-9-solo.png` }); if (cs.chip) { L(tag + " focus solo", await focusShot(So.page, "dividend-received", `${OUT}${tag}-9b-focus-solo.png`)); await F.openChip(So.page); L(tag + " solo opens form", (await F.formState(So.page)).dividend); } }
      await So.ctx.close();
    }
  }
  await b.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
