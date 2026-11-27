const { launch } = require("./lib.cjs");
const F = require("./flow.cjs");
const fs = require("fs");
const SH = __dirname + "/../shots/";
const L = (k, v) => console.log(k, typeof v === "string" ? v : JSON.stringify(v));
const AFTER = JSON.parse(fs.readFileSync(__dirname + "/../state-after-s2.json", "utf8"));
const cardText = (page) => page.evaluate(() => (document.querySelector('[data-testid="dividend-conclusion"]').closest('[data-slot="card"]')?.innerText ?? "").split(/\s+/).join(" "));
async function openTxList(page, acct) {
  await page.goto(F.BASE + "/#detail/cash"); await page.waitForTimeout(1500);
  const card = page.locator("main button", { hasText: acct }).first();
  await card.click(); await page.waitForTimeout(500);
  await page.getByRole("button", { name: "입출금 내역" }).first().click(); await page.waitForTimeout(900);
}
const rows = (page) => page.evaluate(() => [...document.querySelectorAll('[aria-label="거래 삭제"]')].map((b) => { const r = b.parentElement; const rc = r.getBoundingClientRect(); const bd = r.querySelector('[data-testid="tx-dividend-badge"]'); const br = bd?.getBoundingClientRect(); const st = r.querySelector('[data-testid="tx-dividend-stock"]'); const date = r.querySelector("p"); return { h: Math.round(rc.height * 10) / 10, title: r.querySelector(".flex-wrap").textContent, badge: bd ? `${bd.textContent} ${Math.round(br.width)}x${Math.round(br.height)}` : null, date: date.textContent, stock: st?.textContent ?? null, stockBelowDate: st ? st.getBoundingClientRect().top >= date.getBoundingClientRect().bottom - 1 : null, amount: r.querySelector("span.font-bold")?.textContent }; }));
(async () => {
  const b = await launch();
  // (a) 계산값 불변: 표시 없는 새 로드 vs 표시 있는 새 로드(같은 조작 0)
  const A = await F.newSeeded(b, { width: 390 }); await F.gotoDividend(A.page); await A.page.waitForTimeout(1500);
  const B = await F.newSeeded(b, { width: 390, seed: AFTER }); await F.gotoDividend(B.page); await B.page.waitForTimeout(1500);
  const ta = await cardText(A.page), tb = await cardText(B.page);
  const strip = (s) => s.replace(/· 받은 배당 적기|· 받은 기록 [\d,]+원/, "· <CHIP>");
  L("card equal except chip", strip(ta) === strip(tb)); if (strip(ta) !== strip(tb)) { L("A", strip(ta).slice(0, 600)); L("B", strip(tb).slice(0, 600)); }
  const page = B.page;
  // 허브(성과) 카드 값
  for (const [n, P] of [["A", A.page], ["B", page]]) { await P.goto(F.BASE + "/#activity"); await P.waitForTimeout(2000); L("hub " + n, await P.evaluate(() => { const els = [...document.querySelectorAll("main *")].filter((e) => e.children.length === 0 && /배당/.test(e.textContent)); return els.map((e) => e.closest("button,a,[data-slot='card']")?.innerText.replace(/\s+/g, " ").slice(0, 120)).filter(Boolean).slice(0, 4); })); }
  await A.ctx.close();
  // (b) 거래 행
  await openTxList(page, "생활비 통장");
  L("rows 생활비", await rows(page));
  await page.screenshot({ path: SH + "qa-390-light-tx-rows.png", fullPage: true });
  const before = await F.store(page);
  const ids = Object.keys(JSON.parse(before.tags)).filter((k) => k !== "v");
  L("tag ids", ids);
  // 삭제 경로 1: 반영 거래(잔액 역가감) — 종목 있는 첫 배당(tx1, 가장 오래된 11/27 398,200 삼성전자)
  const delBtn = (text) => page.locator('[aria-label="거래 삭제"]').locator("xpath=..").filter({ hasText: text }).first().locator('[aria-label="거래 삭제"]');
  await delBtn("삼성전자").click(); await page.waitForTimeout(400);
  L("confirm1", await page.evaluate(() => document.querySelector(".fixed.inset-0 .rounded-2xl")?.innerText.replace(/\s+/g, " ")));
  await page.getByRole("button", { name: "삭제", exact: true }).last().click(); await page.waitForTimeout(700);
  let s = await F.store(page);
  L("after del1 tags", s.tags); L("after del1 bal/tx", { bal: s.ad.cash[0].balance, n: s.ad.cashTransactions.length, toast: await page.locator("[data-sonner-toast]").allTextContents() });
  // 삭제 경로 2: 기록만(3/10 12,345)
  await delBtn("2026-03-10").click(); await page.waitForTimeout(400);
  L("confirm2", await page.evaluate(() => document.querySelector('[data-testid="tx-delete-confirm"]')?.innerText.replace(/\s+/g, " ")));
  await page.locator('[data-testid="tx-delete-confirm"]').getByRole("button", { name: /삭제|지우기/ }).last().click(); await page.waitForTimeout(700);
  s = await F.store(page);
  L("after del2 tags", s.tags); L("after del2 bal/tx", { bal: s.ad.cash[0].balance, n: s.ad.cashTransactions.length });
  L("rows after", await rows(page));
  // 배당 화면 칩 감소
  await F.gotoDividend(page); const c = await F.conclusion(page); L("chip after 2 deletes", [c.chipText, c.paid, c.expected]);
  // 삭제 경로 3: 계좌 삭제(달러 통장 — tx3 배당 표시 보유)
  await page.goto(F.BASE + "/#detail/cash"); await page.waitForTimeout(1500);
  page.once("dialog", (d) => { L("native confirm", d.message()); d.accept(); });
  await page.locator("main button", { hasText: "달러 통장" }).first().click(); await page.waitForTimeout(500);
  const delAcct = page.locator('button[title="삭제"]:visible');
  L("acct delete buttons", await delAcct.count());
  await delAcct.first().click(); await page.waitForTimeout(900);
  s = await F.store(page);
  L("after acct delete tags", s.tags); L("cash accounts", s.ad.cash.map((x) => x.name)); L("cashTx left", s.ad.cashTransactions.map((t) => `${t.id}:${t.cashId}:${t.amount}`));
  await F.gotoDividend(page); const c2 = await F.conclusion(page); L("chip after acct delete", [c2.chipText, c2.rowText]);
  fs.writeFileSync(__dirname + "/../state-after-s3.json", JSON.stringify(await page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; })));
  L("errs", B.errs); L("non-GET reqs", B.reqs);
  await b.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
