const { launch } = require("./lib.cjs");
const F = require("./flow.cjs");
const fs = require("fs");
const OUT = "/home/user/vaultfolio/.memory/issues/5.166-329-received-dividend/screenshots/5.166-qa-";
const L = (k, v) => console.log(k, typeof v === "string" ? v : JSON.stringify(v));
const AFTER = JSON.parse(fs.readFileSync(__dirname + "/../state-after-s2.json", "utf8"));
const K = F.TAGKEY;
const noTags = () => { const s = { ...AFTER }; delete s[K]; return s; };
// 어절 중간 줄바꿈 검사(글자 위치 측정)
const brokenWords = (page, sel) => page.evaluate((sel) => { const out = []; for (const el of document.querySelectorAll(sel)) { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const t = n.textContent; const re = /\S+/g; let m; while ((m = re.exec(t))) { if (m[0].length < 2) continue; const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + 1); const a = r.getBoundingClientRect(); r.setStart(n, m.index + m[0].length - 1); r.setEnd(n, m.index + m[0].length); const b = r.getBoundingClientRect(); if (a.height && b.height && Math.abs(a.top - b.top) > 4) out.push(m[0]); } } } return out; }, sel);
const mainText = (page) => page.evaluate(() => (document.querySelector("main")?.innerText ?? document.body.innerText).replace(/\s+/g, " "));
(async () => {
  const b = await launch();
  // ── (11) 표시 유무로 다른 화면 값 불변: 같은 자산 데이터, 표시 키만 있음/없음
  const W = await F.newSeeded(b, { width: 390, seed: AFTER }); const N = await F.newSeeded(b, { width: 390, seed: noTags() });
  for (const route of ["", "#activity", "#activity/settlement", "#activity/report", "#detail", "#detail/cash", "#detail/stocks"]) {
    const texts = [];
    for (const X of [W, N]) { await X.page.goto(F.BASE + "/" + route); await X.page.waitForTimeout(2600); texts.push(await mainText(X.page)); }
    const norm = (s) => s.replace(/\d{1,2}:\d{2}(:\d{2})?/g, "T").replace(/방금|\d+초 전|\d+분 전/g, "T");
    L(`same[${route || "home"}]`, { equal: norm(texts[0]) === norm(texts[1]), len: texts[0].length }); if (norm(texts[0]) !== norm(texts[1])) { let i = 0; while (i < texts[0].length && texts[0][i] === texts[1][i]) i++; L(" diff@", [texts[0].slice(Math.max(0, i - 60), i + 80), texts[1].slice(Math.max(0, i - 60), i + 80)]); }
  }
  await N.ctx.close();
  // ── (14) 모르는 kind·모르는 필드 보존
  const txIds = JSON.parse(AFTER.secretasset_asset_data).cashTransactions.map((t) => t.id);
  const plainId = txIds.find((id) => id.startsWith("ctx_") && !(id in JSON.parse(AFTER[K])));
  const U = await F.newSeeded(b, { width: 390, seed: AFTER, extra: { [K]: JSON.stringify({ ...JSON.parse(AFTER[K]), [plainId]: { kind: "interest", rate: 3.5 }, futureTop: { a: 1 } }) } });
  await F.gotoDividend(U.page); const cu = await F.conclusion(U.page); L("unknown-kind chip(합계 불변 826,391)", cu.chipText);
  await F.openChip(U.page); await F.pickAccount(U.page, "비상금 적금"); await F.fill(U.page, { amount: 1000 }); L("unknown-kind save", await F.submit(U.page));
  const us = JSON.parse((await F.store(U.page)).tags); L("unknown kind kept", [us[plainId], us.futureTop, Object.keys(us).length]);
  await U.page.goto(F.BASE + "/#detail/cash"); await U.page.waitForTimeout(1500); await U.page.locator("main button", { hasText: "생활비 통장" }).first().click(); await U.page.waitForTimeout(400); await U.page.getByRole("button", { name: "입출금 내역" }).first().click(); await U.page.waitForTimeout(800);
  L("unknown-kind row badge(777원 행은 배지 없음)", await U.page.evaluate(() => [...document.querySelectorAll('[aria-label="거래 삭제"]')].map((x) => x.parentElement).filter((r) => /\+777원/.test(r.textContent)).map((r) => !!r.querySelector('[data-testid="tx-dividend-badge"]'))));
  await U.ctx.close();
  // ── (15) 손상 원문 / 더 새 v
  for (const [nm, raw] of [["corrupt", "{not json"], ["v2", JSON.stringify({ v: 2, items: [1] })]]) {
    const C = await F.newSeeded(b, { width: 390, seed: AFTER, extra: { [K]: raw } });
    await F.gotoDividend(C.page); const c = await F.conclusion(C.page); L(nm + " chip", [c.chipText, c.heroText?.slice(0, 20)]);
    // 삭제 경로는 원문을 덮지 않는다
    await C.page.goto(F.BASE + "/#detail/cash"); await C.page.waitForTimeout(1500); await C.page.locator("main button", { hasText: "생활비 통장" }).first().click(); await C.page.waitForTimeout(400); await C.page.getByRole("button", { name: "입출금 내역" }).first().click(); await C.page.waitForTimeout(800);
    await C.page.locator('[aria-label="거래 삭제"]').first().click(); await C.page.waitForTimeout(300); await C.page.getByRole("button", { name: "삭제", exact: true }).last().click(); await C.page.waitForTimeout(600);
    L(nm + " after delete raw kept", (await F.store(C.page)).tags === raw);
    L(nm + " errs", [...new Set(C.errs)].filter((e) => !/500/.test(e))); await C.ctx.close();
  }
  // ── (17) 저장 실패 경로
  const X = await F.newSeeded(b, { width: 390, seed: F.DUMP });
  await F.gotoDividend(X.page);
  await X.page.evaluate((K) => { const o = Storage.prototype.setItem; window.__failKey = K; Storage.prototype.setItem = function (k, v) { if (k === window.__failKey) throw new DOMException("QuotaExceededError"); return o.call(this, k, v); }; }, K);
  await F.openChip(X.page); await F.pickAccount(X.page, "생활비 통장"); await F.fill(X.page, { amount: 5000 });
  const r1 = await F.submit(X.page); const s1 = await F.store(X.page); L("표시 쓰기 실패 → 저장 중단", { toast: r1.toast, dialogOpen: r1.dialogOpen, tx: s1.ad.cashTransactions.length, bal: s1.ad.cash[0].balance, tags: s1.tags });
  await X.page.evaluate(() => { window.__failKey = "secretasset_asset_data"; });
  await X.page.locator('[role="dialog"] button[type="submit"]').click(); await X.page.waitForTimeout(900);
  const s2 = await F.store(X.page); L("거래 저장 실패 → 표시 회수", { toast: await X.page.locator("[data-sonner-toast]").allTextContents(), tx: s2.ad.cashTransactions.length, bal: s2.ad.cash[0].balance, tags: s2.tags });
  await X.ctx.close();
  // ── (16) 체험 모드 격리: 실제 localStorage(CDP)에 표시 키가 쓰이지 않는다
  const T = await F.newSeeded(b, { width: 390, seed: {} });
  await T.page.goto(F.BASE + "/"); await T.page.waitForTimeout(2500); await T.page.getByText("직접 둘러보기").first().click(); await T.page.waitForTimeout(3500);
  await T.page.evaluate(() => { location.hash = "#activity/dividend"; }); await T.page.waitForTimeout(2500);
  L("trial chip(조작 없이)", (await F.conclusion(T.page)).chipText);
  await T.page.screenshot({ path: OUT + "390-light-trial-chip.png" });
  await F.openChip(T.page); await F.pickAccount(T.page, "생활비 통장"); await F.fill(T.page, { amount: 4321 }); L("trial save", await F.submit(T.page));
  L("trial chip after", (await F.conclusion(T.page)).chipText); L("trial memory tags", (await F.store(T.page)).tags);
  const cdp = await T.ctx.newCDPSession(T.page); const items = await cdp.send("DOMStorage.getDOMStorageItems", { storageId: { securityOrigin: F.BASE, isLocalStorage: true } });
  L("trial REAL localStorage keys", items.entries.map((e) => e[0])); L("trial REAL has tags key", items.entries.some((e) => e[0] === K));
  L("trial non-GET reqs", T.reqs.filter((r) => r.m !== "GA").map((r) => r.m + " " + r.u)); await T.ctx.close();
  // ── (9) 새 문구 어절 꺾임 320 라이트·다크 + InfoHint 열림 + 새 소식
  for (const theme of ["light", "dark"]) {
    const P = await F.newSeeded(b, { width: 320, height: 720, theme, seed: AFTER }); const p = P.page;
    await F.gotoDividend(p);
    await p.locator('[data-slot="card"]').filter({ hasText: "배당" }).first().locator("button").filter({ has: p.locator("svg") }).first().click().catch(() => {});
    await p.waitForTimeout(600);
    const hint = await p.evaluate(() => { const ps = [...document.querySelectorAll("p.break-keep")].filter((x) => /받은 기록은|예상분은|거래 기록이 있으면/.test(x.textContent)); return ps.map((x) => ({ t: x.textContent.slice(0, 40), vis: x.getBoundingClientRect().height > 0, lines: Math.round(x.getBoundingClientRect().height / parseFloat(getComputedStyle(x).lineHeight)), ox: x.scrollWidth - x.clientWidth })); });
    L(`320-${theme} infohint`, hint); L(`320-${theme} infohint broken`, await brokenWords(p, "p.break-keep"));
    await p.screenshot({ path: `${OUT}320-${theme}-10-infohint.png` });
    await p.keyboard.press("Escape"); await p.mouse.click(5, 5); await p.waitForTimeout(300);
    await F.openChip(p);
    L(`320-${theme} form broken`, await brokenWords(p, '[data-testid="cash-tx-kind-group"] label, [data-testid="cash-tx-kind-group"] span')); 
    await p.click('[data-testid="cash-tx-dividend-check"]'); await p.waitForTimeout(300);
    L(`320-${theme} form(off) broken`, await brokenWords(p, '[data-testid="cash-tx-kind-group"] label > span:not(.invisible)'));
    await p.keyboard.press("Escape"); await p.waitForTimeout(300);
    // 새 소식
    await p.goto(F.BASE + "/#more"); await p.waitForTimeout(1500); await p.getByText("앱 가이드 · 새 소식").first().click(); await p.waitForTimeout(1200);
    const wn = await p.evaluate(() => { const el = [...document.querySelectorAll("*")].filter((e) => e.children.length === 0 && /받은 배당을 적어 두고/.test(e.textContent))[0]; const item = el?.closest("li, article, [data-testid]") ?? el?.parentElement?.parentElement; return { title: el?.textContent, item: item?.innerText.replace(/\s+/g, " ").slice(0, 200), newBadges: [...document.querySelectorAll("*")].filter((e) => e.children.length === 0 && e.textContent.trim() === "새").length }; });
    L(`320-${theme} whats-new`, wn); L(`320-${theme} whats-new broken`, await brokenWords(p, '[role="dialog"] *:not(:has(*)), main *:not(:has(*))').then((a) => a.slice(0, 8)));
    await p.screenshot({ path: `${OUT}320-${theme}-11-whats-new.png` });
    if (theme === "light") {
      const go = p.locator("button, a").filter({ hasText: "바로 가기" }); L("바로 가기 count", await go.count());
      const row = p.locator("li, article, div").filter({ hasText: "받은 배당을 적어 두고" }).last(); const btn = row.locator("button, a").filter({ hasText: "바로 가기" }).first();
      if (await btn.count()) { await btn.click(); await p.waitForTimeout(2500); const c = await p.evaluate(() => { const chip = document.querySelector('[data-testid="dividend-received"]'); const r = chip?.getBoundingClientRect(); return { hash: location.hash, chip: chip?.textContent ?? null, chipTop: r ? Math.round(r.top) : null, vh: innerHeight }; }); L("새 소식 바로 가기 도착", c); await p.screenshot({ path: `${OUT}320-light-12-whats-new-arrive.png` }); }
    }
    L(`320-${theme} errs`, [...new Set(P.errs)].filter((e) => !/500/.test(e))); await P.ctx.close();
  }
  L("errs W", [...new Set(W.errs)].filter((e) => !/500/.test(e)));
  await b.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
