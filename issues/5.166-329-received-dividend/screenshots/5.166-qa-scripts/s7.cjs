const { launch } = require("./lib.cjs");
const F = require("./flow.cjs");
const OUT = "/home/user/vaultfolio/.memory/issues/5.166-329-received-dividend/screenshots/5.166-qa-";
const L = (k, v) => console.log(k, typeof v === "string" ? v : JSON.stringify(v));
const brokenWords = (page, sel) => page.evaluate((sel) => { const out = []; for (const el of document.querySelectorAll(sel)) { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const t = n.textContent; const re = /\S+/g; let m; while ((m = re.exec(t))) { if (m[0].length < 2) continue; const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + 1); const a = r.getBoundingClientRect(); r.setStart(n, m.index + m[0].length - 1); r.setEnd(n, m.index + m[0].length); const b = r.getBoundingClientRect(); if (a.height && b.height && Math.abs(a.top - b.top) > 4) out.push(m[0]); } } } return out; }, sel);
(async () => {
  const b = await launch();
  for (const [w, theme] of [[320, "light"], [320, "dark"], [390, "dark"]]) {
    const P = await F.newSeeded(b, { width: w, height: 800, theme }); const p = P.page; const tag = `${w}-${theme}`;
    const bad = []; p.on("response", (r) => { if (r.status() >= 400) bad.push(r.status() + " " + r.url().replace(F.BASE, "").slice(0, 80)); });
    await p.goto(F.BASE + "/"); await p.waitForTimeout(3000);
    L(tag + " home tip", await p.evaluate(() => [...document.querySelectorAll("main *")].filter((e) => e.children.length === 0 && /새 소식/.test(e.textContent)).map((e) => e.closest("button,a,div")?.innerText.replace(/\s+/g, " ").slice(0, 80))));
    await p.goto(F.BASE + "/#more"); await p.waitForTimeout(1500); await p.getByText("앱 가이드 · 새 소식").first().click(); await p.waitForTimeout(800); await p.getByText("새 소식 보기").first().click(); await p.waitForTimeout(1200);
    const wn = await p.evaluate(() => { const leaf = [...document.querySelectorAll("*")].filter((e) => e.children.length === 0); const el = leaf.find((e) => /받은 배당을 적어 두고/.test(e.textContent)); let item = el; for (let i = 0; i < 5 && item && !/바로 가기/.test(item.innerText); i++) item = item.parentElement; return { title: el?.textContent, item: item?.innerText.replace(/\s+/g, " ").slice(0, 220), newBadges: leaf.filter((e) => e.textContent.trim() === "새").length, all: leaf.filter((e) => e.textContent.trim() === "새").map((e) => e.parentElement.parentElement.innerText.replace(/\s+/g, " ").slice(0, 40)) }; });
    L(tag + " whats-new", wn);
    L(tag + " broken", await brokenWords(p, '[role="dialog"] *'));
    await p.screenshot({ path: `${OUT}${tag}-11-whats-new.png` });
    const btn = p.locator('[role="dialog"] *').filter({ hasText: /^받은 배당을 적어 두고/ }).last().locator("xpath=ancestor::*[.//button[contains(., '바로 가기')] or .//a[contains(., '바로 가기')]][1]").locator("button, a").filter({ hasText: "바로 가기" }).first();
    L(tag + " go buttons", await btn.count());
    if (await btn.count()) { await btn.click(); await p.waitForTimeout(3000); const c = await p.evaluate(() => { const chip = document.querySelector('[data-testid="dividend-received"]'); const r = chip?.getBoundingClientRect(); return { hash: location.hash, chip: chip?.textContent ?? null, chipBottom: r ? Math.round(r.bottom) : null, vh: innerHeight, dialogs: document.querySelectorAll('[role="dialog"]').length }; }); L(tag + " 바로 가기 도착", c); await p.screenshot({ path: `${OUT}${tag}-12-whats-new-arrive.png` }); }
    L(tag + " 4xx/5xx", [...new Set(bad)]); L(tag + " errs", [...new Set(P.errs)].filter((e) => !/status of (500|503|404)/.test(e)));
    await P.ctx.close();
  }
  await b.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
