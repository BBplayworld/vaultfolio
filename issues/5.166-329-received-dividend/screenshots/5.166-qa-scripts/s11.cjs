const { launch, YEAR } = require("./lib.cjs");
const F = require("./flow.cjs");
const OUT = "/home/user/vaultfolio/.memory/issues/5.166-329-received-dividend/screenshots/5.166-qa2-";
const K = F.TAGKEY;
const withRec = () => { const s = { ...F.DUMP }; const ad = JSON.parse(s.secretasset_asset_data); ad.cashTransactions.push({ id: "ctx_qa_sum_1", cashId: ad.cash[0].id, type: "deposit", amount: 398200, currency: "KRW", recurring: false, date: `${YEAR}-11-20`, memo: "", reflected: false, createdAt: `${YEAR}-11-20T00:00:00.000Z` }); s[K] = JSON.stringify({ v: 1, ctx_qa_sum_1: { kind: "dividend" } }); s.secretasset_asset_data = JSON.stringify(ad); return s; };
(async () => {
  const b = await launch();
  for (const [w, theme] of [[320, "light"], [320, "dark"], [390, "light"], [390, "dark"]]) {
    for (const [nm, seed] of [["rec", withRec()], ["none", F.DUMP]]) {
      const P = await F.newSeeded(b, { width: w, height: 844, theme, seed, mock: false });
      await P.page.route("**/api/finance/dividend**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) }));
      await P.page.goto(F.BASE + "/#activity/dividend"); await P.page.waitForTimeout(3500);
      const m = await P.page.evaluate(() => { const box = document.querySelector(".border-dashed"); const r = box?.getBoundingClientRect(); const ps = box ? [...box.querySelectorAll("p")] : []; const inner = box?.firstElementChild?.getBoundingClientRect(); return { cls: document.documentElement.className, boxH: r ? Math.round(r.height * 10) / 10 : null, lines: ps.map((p) => p.textContent), title: !!document.querySelector('[data-testid="dividend-empty-title"]'), mt: ps.map((p) => getComputedStyle(p).marginTop), centered: r && inner ? Math.round(((inner.top - r.top) - (r.bottom - inner.bottom)) * 10) / 10 : null, chip: document.querySelector('[data-testid="dividend-received"]')?.textContent ?? null, card: [...document.querySelectorAll('[data-slot="card"]')].find((c) => /배당/.test(c.textContent))?.innerText.replace(/\s+/g, " ").slice(0, 150), ox: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
      console.log(w, theme, nm, JSON.stringify(m));
      await P.page.screenshot({ path: `${OUT}${w}-${theme}-o1-${nm}.png` });
      if (nm === "rec" && w === 390 && theme === "light") { await F.openChip(P.page); await F.pickAccount(P.page, "생활비 통장"); await F.fill(P.page, { amount: 1000 }); console.log(" solo 저장", JSON.stringify(await F.submit(P.page)), await P.page.evaluate(() => document.querySelector('[data-testid="dividend-received"]')?.textContent)); }
      console.log("  errs", JSON.stringify([...new Set(P.errs)].filter((e) => !/status of 500/.test(e)))); await P.ctx.close();
    }
  }
  // 기록 0 → 첫 기록 저장 순간(현금 › 입출금 기록 경유) 문구 전환: 계산 0 상태에서
  await b.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
