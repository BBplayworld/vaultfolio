const { launch, YEAR } = require("./lib.cjs");
const F = require("./flow.cjs");
const OUT = "/home/user/vaultfolio/.memory/issues/5.166-329-received-dividend/screenshots/5.166-qa-";
const K = F.TAGKEY;
const mk = (mut, sum) => { const s = { ...F.DUMP }; const ad = JSON.parse(s.secretasset_asset_data); mut(ad); if (sum) { ad.cashTransactions.push({ id: "ctx_qa_sum_1", cashId: ad.cash[0].id, type: "deposit", amount: sum, currency: "KRW", recurring: false, date: `${YEAR}-11-20`, memo: "", reflected: false, createdAt: `${YEAR}-11-20T00:00:00.000Z` }); s[K] = JSON.stringify({ v: 1, ctx_qa_sum_1: { kind: "dividend" } }); } s.secretasset_asset_data = JSON.stringify(ad); return s; };
(async () => {
  const b = await launch();
  const scales = { "6자리(preview 데모 수준)": [28, 12], "5자리": [3, 1], "7자리": [361, 361] };
  for (const [sn, [paid, est]] of Object.entries(scales)) {
    console.log("== 금액 규모", sn);
    for (const w of [320, 360, 375, 390, 430]) {
      const res = {};
      for (const [st, seed] of [["main동일(다음 지급)", mk((ad) => { ad.cash = []; ad.cashTransactions = []; })], ["받은 배당 적기", mk(() => {})], ["받은 기록 12,345", mk(() => {}, 12345)], ["받은 기록 398,200", mk(() => {}, 398200)], ["받은 기록 1,234,567", mk(() => {}, 1234567)]]) {
        const P = await F.newSeeded(b, { width: w, height: 844, theme: "dark", seed, mock: false });
        await P.page.route("**/api/finance/dividend**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [{ payoutDate: `${YEAR}-02-15`, amountPerShare: paid, currency: "KRW" }, { payoutDate: `${YEAR}-05-15`, amountPerShare: paid, currency: "KRW" }, { payoutDate: `${YEAR}-12-28`, amountPerShare: est, currency: "KRW", isEstimated: true }] }) }));
        await F.gotoDividend(P.page);
        const m = await P.page.evaluate(() => { const row = document.querySelector('[data-testid="dividend-conclusion"]'); const g = document.querySelector(".recharts-cartesian-grid"); return { h: Math.round(row.getBoundingClientRect().height), chartTop: g ? Math.round(g.getBoundingClientRect().top) : null, t: row.textContent }; });
        res[st] = `${m.h}px/차트${m.chartTop}`; if (w === 390 && st === "main동일(다음 지급)") console.log("   문구:", m.t);
        if (w === 390 && sn.startsWith("6") && (st === "받은 배당 적기" || st === "받은 기록 398,200" || st.startsWith("main"))) await P.page.screenshot({ path: `${OUT}390-dark-rowh-${st.startsWith("main") ? "next" : st === "받은 배당 적기" ? "empty" : "sum"}.png`, clip: { x: 0, y: 100, width: 390, height: 330 } });
        await P.ctx.close();
      }
      console.log(w, JSON.stringify(res));
    }
  }
  await b.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
