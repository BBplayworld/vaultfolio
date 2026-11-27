const { launch } = require("./lib.cjs");
const F = require("./flow.cjs");
const OUT = "/home/user/vaultfolio/.memory/issues/5.166-329-received-dividend/screenshots/5.166-qa-";
const L = (k, v) => console.log(k, typeof v === "string" ? v : JSON.stringify(v));
(async () => {
  const b = await launch();
  for (const [w, theme, when] of [[390, "dark", "2026-12-20T03:00:00Z"]]) {
    const P = await F.newSeeded(b, { width: w, height: 844, theme, seed: Object.fromEntries(Object.entries(F.DUMP).filter(([k]) => k !== "secretasset.stock_labels")), extra: { secretasset_backup: JSON.stringify({ lastBackupAt: when }) } }); const p = P.page;
    await P.ctx.clock.setFixedTime(new Date(when));
    await p.goto(F.BASE + "/"); await p.waitForTimeout(3500);
    const tip = await p.evaluate(() => { const els = [...document.querySelectorAll("main *")].filter((e) => e.children.length === 0 && /새 소식 \d+개/.test(e.textContent)); return els.map((e) => e.textContent.trim().slice(0, 60)).slice(0, 6); });
    L(when + " home tip texts", tip);
    const tipEl = p.locator("main").getByText(/새 소식 \d+개/).first();
    if (await tipEl.count()) { await p.screenshot({ path: `${OUT}390-dark-13-home-tip.png` }); await tipEl.click(); await p.waitForTimeout(1500);
      const n = await p.evaluate(() => [...document.querySelectorAll('[role="dialog"] *')].filter((e) => e.children.length === 0 && e.textContent.trim() === "새").length); L(when + " sheet 새 개수", n);
      const titles = await p.evaluate(() => [...document.querySelectorAll('[role="dialog"] p')].map((x) => x.textContent.trim()).filter((t) => /^새?받은 배당/.test(t))); L(when + " item", titles);
      await p.screenshot({ path: `${OUT}390-dark-14-whats-new-sheet.png` });
      const go = p.locator('[data-testid="whats-new-go"][aria-label^="받은 배당"]'); L("go count", await go.count());
      await go.first().click(); await p.waitForTimeout(3000);
      L(when + " 바로 가기 도착", await p.evaluate(() => { const chip = document.querySelector('[data-testid="dividend-received"]'); const r = chip?.getBoundingClientRect(); return { hash: location.hash, chip: chip?.textContent ?? null, chipBottom: r ? Math.round(r.bottom) : null, vh: innerHeight, dialogs: document.querySelectorAll('[role="dialog"]').length }; }));
      await p.screenshot({ path: `${OUT}390-dark-15-whats-new-arrive.png` });
    }
    await P.ctx.close();
  }
  // 320: 더보기 경유 바로 가기 + 현금 계좌 0 사용자 도착 화면
  for (const [nm, mut] of []) {
    const seed = { ...F.DUMP }; seed.secretasset_asset_data = JSON.stringify(mut(JSON.parse(seed.secretasset_asset_data)));
    const P = await F.newSeeded(b, { width: 320, height: 720, theme: "light", seed }); const p = P.page;
    await p.goto(F.BASE + "/#more"); await p.waitForTimeout(1500); await p.getByText("앱 가이드 · 새 소식").first().click(); await p.waitForTimeout(800); await p.getByText("새 소식 보기").first().click(); await p.waitForTimeout(1200);
    await p.locator('[data-testid="whats-new-go"][aria-label^="받은 배당"]').first().click(); await p.waitForTimeout(3000);
    L(`320 ${nm} 도착`, await p.evaluate(() => { const chip = document.querySelector('[data-testid="dividend-received"]'); const r = chip?.getBoundingClientRect(); return { hash: location.hash, chip: chip?.textContent ?? null, chipBottom: r ? Math.round(r.bottom) : null, vh: innerHeight, concl: document.querySelector('[data-testid="dividend-conclusion"]')?.textContent ?? null, main: document.querySelector("main")?.innerText.replace(/\s+/g, " ").slice(0, 120) }; }));
    await p.screenshot({ path: `${OUT}320-light-12-arrive-${nm.replace(" ", "")}.png` });
    await P.ctx.close();
  }
  await b.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
