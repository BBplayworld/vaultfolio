// 2기기 동기화 왕복 — 로컬 prod(main c62960e4, KV 없음 = 파일 저장소) 대체. 운영·preview 요청 0, 가상 데모 데이터만
const path = require("path"); const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"));
const BASE = "http://localhost:3591"; const SEED = process.argv[2];
const OUT = "/home/user/vaultfolio/.memory/issues/5.166-329-received-dividend/screenshots/5.166-qa-localsync-";
const K = "secretasset.cash_tx_tags"; const PASS = "qa-test-vault-7!";
const L = (k, v) => console.log(k, typeof v === "string" ? v : JSON.stringify(v));
const W = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const ext = [], sync = [];
  const mk = async (name) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage(); const errs = [];
    p.on("pageerror", (e) => errs.push("PAGEERR " + String(e).slice(0, 200)));
    p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 140)); });
    p.on("request", (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith("data:") && !u.startsWith("blob:")) ext.push(name + " " + u.slice(0, 80)); if (u.includes("/api/sync")) sync.push(`${name} ${r.method()} ${u.replace(BASE, "").slice(0, 60)} body:${(r.postData() || "").slice(0, 0)}${r.postData() ? Object.keys(JSON.parse(r.postData())).join(",") : ""}`); });
    return { p, errs, name };
  };
  const st = (p) => p.evaluate((K) => { const ad = JSON.parse(localStorage.getItem("secretasset_asset_data") || "null"); const s = JSON.parse(localStorage.getItem("secretasset_sync") || "null"); return { tags: JSON.parse(localStorage.getItem(K) || "null"), tx: ad?.cashTransactions?.map((t) => `${t.id.slice(-6)}:${t.amount}`) ?? null, assetId: s?.assetId ?? null, ver: s?.version ?? null }; }, K);
  const chip = async (p) => { await p.evaluate(() => { location.hash = "#activity/dividend"; }); await p.waitForSelector('[data-testid="dividend-received"], [data-testid="dividend-received-solo"]', { timeout: 30000 }).catch(() => {}); await W(1500); return p.evaluate(() => (document.querySelector('[data-testid="dividend-received"]') || document.querySelector('[data-testid="dividend-received-solo"]'))?.getAttribute("aria-label") || null); };
  const record = async (p, stockNth, amount) => {
    await p.click('[data-testid="dividend-received"], [data-testid="dividend-received-solo"]'); await p.waitForSelector('[data-testid="cash-tx-kind-group"]'); await W(400);
    const dlg = p.locator('[role="dialog"]'); const combo = dlg.locator('button[role="combobox"]').first();
    if ((await combo.getAttribute("data-testid")) !== "cash-tx-dividend-stock") { await combo.click(); await W(200); await p.locator('[role="option"]').first().click(); await W(200); }
    await p.click('[data-testid="cash-tx-dividend-stock"]'); await W(200); await p.locator('[role="option"]').nth(stockNth).click(); await W(200);
    await dlg.locator("input[inputmode]").first().fill(String(amount)); await W(200);
    await dlg.locator('button[type="submit"]').click(); await W(1200);
    return (await p.locator("[data-sonner-toast]").allTextContents()).slice(-1)[0];
  };
  const pull = async (p) => { await p.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("focus")); }); await W(6000); };
  const delTx = async (p, amountText) => {
    await p.evaluate(() => { location.hash = "#detail/cash"; }); await W(1500);
    await p.locator("main button", { hasText: "생활비 통장" }).first().click(); await W(600); await p.getByRole("button", { name: "입출금 내역" }).first().click(); await W(1000);
    const row = p.locator('[aria-label="거래 삭제"]').locator("xpath=..").filter({ hasText: amountText }).first();
    await row.locator('[aria-label="거래 삭제"]').click(); await W(400);
    const btns = await p.locator('[role="alertdialog"] button, [role="dialog"] button').allTextContents();
    await p.getByRole("button", { name: "삭제", exact: true }).last().click(); await W(900);
    await p.keyboard.press("Escape"); await W(300); await p.keyboard.press("Escape"); await W(300);
    return btns.map((s) => s.trim()).filter(Boolean).slice(-4);
  };
  // 기기 A: 데모 데이터 → 금고 생성
  const A = await mk("A");
  await A.p.goto(BASE + "/"); await W(2500);
  await A.p.locator('input[type="file"][accept="application/json"]').first().setInputFiles(SEED); await W(3500);
  await A.p.evaluate(() => { location.hash = "#more"; }); await W(1500);
  await A.p.getByText("기기 동기화", { exact: true }).first().click(); await W(1000);
  await A.p.locator('input[type="password"]').first().fill(PASS); await A.p.getByRole("button", { name: /동기화 시작/ }).click(); await W(5000);
  const a0 = await st(A.p); L("A vault", { assetId: !!a0.assetId, ver: a0.ver, armed: await A.p.evaluate(() => /자동 동기화 켜짐/.test(document.body.innerText)) });
  await A.p.keyboard.press("Escape"); await W(400);
  if (!a0.assetId) { L("STOP", "금고 생성 실패"); await A.p.screenshot({ path: OUT + "fail-A.png" }); await b.close(); process.exit(2); }
  L("A chip0", await chip(A.p));
  L("A record", await record(A.p, 1, 11111)); await W(5000);
  const a1 = await st(A.p); L("A after record", a1); L("A chip1", await chip(A.p));
  // 기기 B: 링크로 연결
  const B = await mk("B");
  await B.p.goto(BASE + "/#sync=" + a1.assetId); await W(3000);
  await B.p.locator('[role="dialog"] input[type="password"]').first().fill(PASS); await B.p.getByRole("button", { name: /연결하기/ }).click(); await W(8000);
  L("B toast", await B.p.locator("[data-sonner-toast]").allTextContents());
  const b1 = await st(B.p); L("B after connect", b1); L("B tagsEq A", JSON.stringify(b1.tags) === JSON.stringify(a1.tags)); const bc1 = await chip(B.p); L("B chip", bc1);
  await B.p.screenshot({ path: OUT + "390-B-1-after-connect.png" });
  // B: 배당 추가 → A 반영
  L("B record", await record(B.p, 2, 22222)); await W(5000);
  const b2 = await st(B.p); L("B after record", b2);
  await pull(A.p); const a2 = await st(A.p); L("A after pull", a2); L("A tagsEq B", JSON.stringify(a2.tags) === JSON.stringify(b2.tags)); L("A chip2", await chip(A.p)); L("B chip2", await chip(B.p));
  await A.p.screenshot({ path: OUT + "390-A-2-both.png" });
  // B: A가 적은 배당 거래 삭제(표시 해제) → A 반영
  L("B delete A-tx", await delTx(B.p, "11,111")); await W(5000);
  const b3 = await st(B.p); L("B after delete", b3);
  await pull(A.p); const a3 = await st(A.p); L("A after pull2", a3); L("A tagsEq B (2)", JSON.stringify(a3.tags) === JSON.stringify(b3.tags)); L("A chip3", await chip(A.p)); L("B chip3", await chip(B.p));
  // A: 남은 B 거래 삭제 → B 반영(양쪽 맵 정리)
  L("A delete B-tx", await delTx(A.p, "22,222")); await W(5000);
  const a4 = await st(A.p); L("A after delete", a4);
  await pull(B.p); const b4 = await st(B.p); L("B after pull", b4); L("A chip4", await chip(A.p)); L("B chip4", await chip(B.p));
  await B.p.screenshot({ path: OUT + "390-B-3-cleared.png" });
  L("sync requests", sync); L("external(브라우저→외부)", [...new Set(ext)].slice(0, 10)); L("errs A", [...new Set(A.errs)]); L("errs B", [...new Set(B.errs)]);
  await b.close();
})().catch((e) => { console.error("FAIL", String(e).slice(0, 500)); process.exit(1); });
