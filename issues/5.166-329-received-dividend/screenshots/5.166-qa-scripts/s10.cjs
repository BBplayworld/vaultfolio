const { launch } = require("./lib.cjs");
const F = require("./flow.cjs");
const fs = require("fs");
const L = (k, v) => console.log(k, typeof v === "string" ? v : JSON.stringify(v));
const AFTER = JSON.parse(fs.readFileSync(__dirname + "/../state-after-s2.json", "utf8"));
(async () => {
  const b = await launch();
  // (1) 359/360/361 종목 줄·날짜 줄 글자 크기 + (2) 오늘 날짜 기록 rect 겹침
  for (const w of [359, 360, 361, 390, 1280]) {
    const P = await F.newSeeded(b, { width: w, height: 844, theme: "dark", seed: AFTER }); const p = P.page;
    await p.goto(F.BASE + "/#detail/cash"); await p.waitForTimeout(1500); await p.locator("main button", { hasText: "생활비 통장" }).first().click(); await p.waitForTimeout(400); await p.getByRole("button", { name: "입출금 내역" }).first().click(); await p.waitForTimeout(900);
    L(String(w), await p.evaluate(() => { const st = document.querySelector('[data-testid="tx-dividend-stock"]'); const row = st.closest(".flex.items-center.gap-3"); const date = row.querySelector("p"); const amt = row.querySelector("span.font-bold"); const del = row.querySelector('[aria-label="거래 삭제"]'); const R = (e) => e.getBoundingClientRect(); const rg = document.createRange(); rg.selectNodeContents(date); const dr = rg.getBoundingClientRect(); rg.selectNodeContents(st); const sr = rg.getBoundingClientRect(); const ov = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top); return { stockFont: getComputedStyle(st).fontSize, dateFont: getComputedStyle(date).fontSize, rowH: Math.round(R(row).height), dateText: date.textContent, dateVsAmt: ov(dr, R(amt)), stockVsAmt: ov(sr, R(amt)), amtVsDel: ov(R(amt), R(del)), gapDateAmt: Math.round(R(amt).left - dr.right), delHit: [Math.round(R(del).width), Math.round(R(del).height)] }; }));
    await P.ctx.close();
  }
  // (3) 모션: 종목 칸 펼침 보간(같은 노드) · reduced-motion 즉시
  for (const rm of [false, true]) {
    const P = await F.newSeeded(b, { width: 390, seed: F.DUMP }); const p = P.page; if (rm) await p.emulateMedia({ reducedMotion: "reduce" });
    await F.gotoDividend(p); await F.openChip(p);
    const res = await p.evaluate(async () => { const box = document.querySelector('[data-testid="cash-tx-dividend-stock"]').closest(".grid"); window.__node = box; const samples = []; document.querySelector('[data-testid="cash-tx-dividend-check"]').click(); const t0 = performance.now(); while (performance.now() - t0 < 320) { samples.push(Math.round(box.getBoundingClientRect().height)); await new Promise((r) => requestAnimationFrame(r)); } return { same: window.__node === document.querySelector('[data-testid="cash-tx-dividend-stock"]').closest(".grid"), distinct: [...new Set(samples)].length, first: samples[0], last: samples[samples.length - 1], transition: getComputedStyle(box).transitionProperty + " " + getComputedStyle(box).transitionDuration }; });
    L(rm ? "reduced-motion 접힘" : "모션 접힘", res);
    // 연타 5회 뒤 상태 일치
    for (let i = 0; i < 5; i++) await p.click('[data-testid="cash-tx-dividend-check"]', { delay: 0 });
    await p.waitForTimeout(450);
    L(rm ? "rm 연타5" : "연타5", await p.evaluate(() => ({ checked: document.querySelector('[data-testid="cash-tx-dividend-check"]').getAttribute("data-state"), h: Math.round(document.querySelector('[data-testid="cash-tx-dividend-stock"]').closest(".grid").getBoundingClientRect().height), inert: !!document.querySelector('[data-testid="cash-tx-dividend-stock"]').closest("[inert]") })));
    await P.ctx.close();
  }
  // 키보드만으로: 칩 Enter → 폼, Esc → 칩 복귀 / FAB·계좌 카드 진입은 배당 꺼짐
  const P = await F.newSeeded(b, { width: 390, seed: F.DUMP }); const p = P.page; await F.gotoDividend(p);
  await p.evaluate(() => document.querySelector('[data-testid="dividend-received"]').focus()); await p.keyboard.press("Enter"); await p.waitForTimeout(600);
  L("키보드 Enter 진입", await F.formState(p).then((s) => ({ dividend: s.dividend, rec: s.recDisabled }))); await p.keyboard.press("Escape"); await p.waitForTimeout(500);
  L("Esc 뒤 포커스", await p.evaluate(() => document.activeElement?.getAttribute("data-testid")));
  await p.goto(F.BASE + "/#detail/cash"); await p.waitForTimeout(1500); await p.locator("main button", { hasText: "생활비 통장" }).first().click(); await p.waitForTimeout(400); await p.getByRole("button", { name: "입출금 기록" }).first().click(); await p.waitForTimeout(600);
  L("계좌 카드 진입(배당 꺼짐이어야)", await F.formState(p).then((s) => ({ dividend: s.dividend, recDisabled: s.recDisabled, help: s.recHelp })));
  // 칩 진입 후 닫고 → 일반 진입 시 배당 상태가 남지 않는가
  await p.keyboard.press("Escape"); await p.waitForTimeout(400); await F.gotoDividend(p); await F.openChip(p); await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  await p.goto(F.BASE + "/#detail/cash"); await p.waitForTimeout(1500); await p.locator("main button", { hasText: "생활비 통장" }).first().click(); await p.waitForTimeout(400); await p.getByRole("button", { name: "입출금 기록" }).first().click(); await p.waitForTimeout(600);
  L("칩 진입·닫기 뒤 일반 진입(배당 꺼짐이어야)", await F.formState(p).then((s) => ({ dividend: s.dividend, recDisabled: s.recDisabled })));
  await b.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
