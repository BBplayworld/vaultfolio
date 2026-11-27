const { launch } = require("./lib.cjs");
const F = require("./flow.cjs");
const fs = require("fs");
const SH = __dirname + "/../shots/";
const L = (k, v) => console.log(k, typeof v === "string" ? v : JSON.stringify(v));
const AFTER = JSON.parse(fs.readFileSync(__dirname + "/../state-after-s2.json", "utf8"));
const S3 = JSON.parse(fs.readFileSync(__dirname + "/../state-after-s3.json", "utf8"));
const K = F.TAGKEY;
const chip = async (page) => { await F.gotoDividend(page); const c = await F.conclusion(page); return c.chipText; };
(async () => {
  const b = await launch();
  // ── 백업 내보내기 (표시 4건 기기)
  const S = await F.newSeeded(b, { width: 390, seed: AFTER });
  await S.page.goto(F.BASE + "/#more"); await S.page.waitForTimeout(2000);
  const [dl] = await Promise.all([S.page.waitForEvent("download", { timeout: 15000 }), S.page.getByText("데이터 백업").first().click()]);
  const p1 = __dirname + "/../backup-1.json"; await dl.saveAs(p1);
  const bk = JSON.parse(fs.readFileSync(p1, "utf8"));
  L("backup top keys", Object.keys(bk)); L("backup cashTxTags", bk.cashTxTags); L("backup cashTx n", bk.assetData.cashTransactions.length);
  L("src chip", await chip(S.page));
  // ── 새 기기(빈 저장소)에서 가져오기 → 다시 내보내기
  const N = await F.newSeeded(b, { width: 390, seed: {} });
  await N.page.goto(F.BASE + "/"); await N.page.waitForTimeout(2500);
  L("fresh welcome buttons", (await N.page.locator("button:visible").allTextContents()).map((s) => s.trim().slice(0, 20)).filter(Boolean).slice(0, 8));
  const imp = async (page, file) => { const inp = page.locator('input[type="file"][accept="application/json"]').first(); await inp.setInputFiles(file); await page.waitForTimeout(3000); return (await page.locator("[data-sonner-toast]").allTextContents()).join("/"); };
  L("import toast (fresh)", await imp(N.page, p1));
  const ns = await F.store(N.page);
  L("fresh after import tags", ns.tags); L("equal to backup field", JSON.stringify(JSON.parse(ns.tags)) === JSON.stringify(bk.cashTxTags));
  L("fresh chip", await chip(N.page));
  await N.page.goto(F.BASE + "/#more"); await N.page.waitForTimeout(2000);
  const [dl2] = await Promise.all([N.page.waitForEvent("download", { timeout: 15000 }), N.page.getByText("데이터 백업").first().click()]);
  const p2 = __dirname + "/../backup-2.json"; await dl2.saveAs(p2);
  const bk2 = JSON.parse(fs.readFileSync(p2, "utf8"));
  L("roundtrip cashTxTags deepEqual", JSON.stringify(bk2.cashTxTags) === JSON.stringify(bk.cashTxTags)); L("roundtrip cashTransactions deepEqual", JSON.stringify(bk2.assetData.cashTransactions) === JSON.stringify(bk.assetData.cashTransactions)); L("roundtrip cash deepEqual", JSON.stringify(bk2.assetData.cash) === JSON.stringify(bk.assetData.cash));
  // ── id 합집합: 로컬 표시(다른 id 1건 + 살아남은 1건)가 있는 기기에 가져오기
  const U = await F.newSeeded(b, { width: 390, seed: S3, extra: { [K]: JSON.stringify({ v: 1, ctx_qa_local_only: { kind: "dividend", stockName: "로컬만" }, ...Object.fromEntries(Object.entries(JSON.parse(S3[K])).filter(([k]) => k !== "v")) }) } });
  await U.page.goto(F.BASE + "/#more"); await U.page.waitForTimeout(2000);
  L("union before", (await F.store(U.page)).tags);
  L("import toast (union)", await imp(U.page, p1));
  const us = await F.store(U.page); L("union after", us.tags); L("union ids", Object.keys(JSON.parse(us.tags)).filter((k) => k !== "v").length);
  L("union chip", await chip(U.page));
  // ── 구 백업(필드 없음) 가져오기 → 로컬 유지
  const oldBk = { ...bk }; delete oldBk.cashTxTags; const p3 = __dirname + "/../backup-old-nofield.json"; fs.writeFileSync(p3, JSON.stringify(oldBk));
  await U.page.goto(F.BASE + "/#more"); await U.page.waitForTimeout(1500);
  const beforeOld = (await F.store(U.page)).tags;
  L("import toast (old no-field)", await imp(U.page, p3));
  L("old-backup keeps local", (await F.store(U.page)).tags === beforeOld); L("chip after old backup", await chip(U.page));
  // ── 모든 데이터 삭제
  await U.page.goto(F.BASE + "/#more"); await U.page.waitForTimeout(1500);
  await U.page.getByText("설정", { exact: true }).last().click(); await U.page.waitForTimeout(1200);
  await U.page.click('[data-testid="settings-row-delete-all"]'); await U.page.waitForTimeout(600);
  L("clear dialog", await U.page.evaluate(() => document.querySelector('[role="alertdialog"],[role="dialog"]')?.innerText.replace(/\s+/g, " ").slice(0, 200)));
  await U.page.screenshot({ path: SH + "qa-390-light-clear-all-dialog.png" });
  const dlgBtns = U.page.locator('[role="alertdialog"] button, [role="dialog"] button');
  L("dialog buttons", await dlgBtns.allTextContents());
  await dlgBtns.filter({ hasText: /삭제/ }).last().click(); await U.page.waitForTimeout(1500);
  L("after clear-all", await U.page.evaluate((K) => ({ tags: localStorage.getItem(K), asset: localStorage.getItem("secretasset_asset_data")?.length ?? null, labels: localStorage.getItem("secretasset.stock_labels"), toast: [...document.querySelectorAll("[data-sonner-toast]")].map((t) => t.textContent) }), K));
  // ── 공유 링크 반영(교체): 표시 4건 기기에서 #share=토큰
  const token = fs.readFileSync(__dirname + "/../share-token.txt", "utf8");
  const H = await F.newSeeded(b, { width: 390, seed: AFTER });
  await H.page.goto(F.BASE + "/"); await H.page.waitForTimeout(2000);
  const hs0 = await F.store(H.page); L("share before tags n", Object.keys(JSON.parse(hs0.tags)).length - 1);
  await H.page.goto(F.BASE + "/#share=" + token); await H.page.waitForTimeout(500); await H.page.reload(); await H.page.waitForTimeout(4000);
  const hs1 = await F.store(H.page);
  L("share after", { url: H.page.url().slice(0, 60), tags: hs1.tags, cashTxIds: hs1.ad.cashTransactions.map((t) => t.id).slice(0, 4), n: hs1.ad.cashTransactions.length, sameIds: JSON.stringify(hs1.ad.cashTransactions.map((t) => t.id)) === JSON.stringify(hs0.ad.cashTransactions.map((t) => t.id)), toast: await H.page.locator("[data-sonner-toast]").allTextContents() });
  L("share chip", await chip(H.page));
  for (const [n, X] of [["S", S], ["N", N], ["U", U], ["H", H]]) { L("errs " + n, [...new Set(X.errs)].slice(0, 4)); L("nonGET " + n, X.reqs.filter((r) => r.m !== "GA").map((r) => r.m + " " + r.u + " " + r.body.slice(0, 120))); }
  await b.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
