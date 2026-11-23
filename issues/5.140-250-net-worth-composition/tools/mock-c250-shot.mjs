// #250 시각 목업 캡처(ui-designer, 2026-11-20). 코드 수정 0.
// preview(issue-5.132) /?demo=1 로 데모를 넣고 → mock-c250-seed.js 로 상태별 저장값 주입 → 새로고침 → mock-c250-lib.js 로 필터 자리에 블록을 넣어 찍는다. deviceScaleFactor 2.
// node mock-c250-shot.mjs <OUT> [장면 이름 일부,…]
import { readFileSync } from "node:fs";
import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5132-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2]; const ONLY = process.argv[3];
const lib = readFileSync(new URL("./mock-c250-lib.js", import.meta.url), "utf8");
const seed = readFileSync(new URL("./mock-c250-seed.js", import.meta.url), "utf8");
const br = await chromium.launch({ proxy });
const want = (n) => !ONLY || ONLY.split(",").some((o) => n.includes(o));
const log = (n, o) => console.log(n, JSON.stringify(o));

async function open(W, H, kind, { scheme = "dark" } = {}) {
  const ctx = await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: W < 700, hasTouch: W < 1100 });
  const p = await ctx.newPage();
  await p.goto(`${PV}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(6000);
  await p.waitForSelector('html[data-demo-ready="1"]', { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(1500); // 데모 주입이 끝난 뒤에만 시드를 덮는다
  if (kind && kind !== "demo") {
    await p.addScriptTag({ content: seed }); log(`seed ${kind}`, await p.evaluate((k) => c250seed(k), kind));
    await p.goto(`${PV}/?t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(7000);
  }
  await p.waitForSelector('[data-testid="home-donut"]', { timeout: 20000 }).catch(() => {});
  // 테마는 앱 설정값(기본 다크) — 라이트 장면은 html 의 dark 클래스를 내려서 본다(#246 목업과 같은 경로)
  if (scheme === "light") { await p.evaluate(() => { document.documentElement.classList.remove("dark"); document.documentElement.style.colorScheme = "light"; }); await p.waitForTimeout(400); }
  await p.addScriptTag({ content: lib });
  return p;
}
const settle = (p, ms = 250) => p.waitForTimeout(ms);
const M = (p) => p.evaluate(() => c250.measure());
// 홈 카드 조각: Hero 카드 위 8px ~ 도넛 머리(extra)
const cardShot = async (p, extra = 120) => { const c = await p.evaluate(() => c250.R(c250.heroCard())); const vw = p.viewportSize().width; await p.evaluate(() => scrollTo(0, 0)); return { buf: await p.screenshot({ clip: { x: 0, y: Math.max(0, c.y - 8), width: vw, height: c.h + 16 + extra } }), w: vw }; };
const save = (p, name, opt) => p.screenshot({ path: `${OUT}/c250-${name}.png`, ...opt });
async function compose(name, title, items, cols = 1) {
  const ctx = await br.newContext({ viewport: { width: 100, height: 100 }, deviceScaleFactor: 2, colorScheme: "dark" }); const p = await ctx.newPage();
  const maxW = Math.max(...items.map((i) => i.w));
  await p.setContent(`<body style="margin:0;background:#0b0c11;font-family:system-ui,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#9aa0aa;width:${cols * (maxW + 24) + 24}px"><div style="padding:16px 24px 4px;font-size:13px;font-weight:700;color:#e6c35c">${title}</div><div style="display:grid;grid-template-columns:repeat(${cols},${maxW}px);gap:20px 24px;padding:12px 24px 24px;align-items:start">${items.map((i) => `<div><div style="font-size:12px;line-height:16px;margin-bottom:6px;color:#e6c35c">${i.cap}</div><img src="data:image/png;base64,${i.buf.toString("base64")}" style="width:${i.w}px;display:block"></div>`).join("")}</div></body>`);
  await p.waitForTimeout(300); const b = await p.locator("body").boundingBox(); await p.setViewportSize({ width: Math.ceil(b.width), height: Math.ceil(b.height) });
  await p.screenshot({ path: `${OUT}/c250-${name}.png`, fullPage: true }); await ctx.close();
}
const d = (a, b) => Math.round((a - b) * 10) / 10;

// ① 대상 상태 — 주식만·코인만(390·320, 다크) + 첫 화면 전체
if (want("01-target")) for (const [W, H] of [[390, 844], [320, 640]]) {
  const items = [];
  for (const kind of ["stocks", "crypto"]) {
    const p = await open(W, H, kind); const m0 = await M(p); log(`01 ${W} ${kind} 지금`, m0);
    items.push({ cap: `${kind === "stocks" ? "주식만" : "코인만"} — 지금(5.132): 필터 ${m0.tabs?.join("·")} · Hero 끝→도넛 ${m0.gapHeroToDonut}`, ...(await cardShot(p)) });
    await p.evaluate((k) => c250.block(k), kind); await settle(p); const m = await M(p); log(`01 ${W} ${kind} 이후`, m);
    items.push({ cap: `이후 — 문장 ${m.textLines}줄 · Hero 끝→도넛 ${m.gapHeroToDonut}(${d(m.gapHeroToDonut, m0.gapHeroToDonut) >= 0 ? "+" : ""}${d(m.gapHeroToDonut, m0.gapHeroToDonut)}) · 7일 카드 ${d(m.weekTop, m0.weekTop)}`, ...(await cardShot(p)) });
    if (kind === "stocks") { await save(p, `01a-stocks-first-screen-${W}`); await p.evaluate(() => c250.showHits()); await settle(p); items.push({ cap: "히트영역 — 노랑 = 버튼 40px, 하늘 = 도넛 조각 상자", ...(await cardShot(p)) }); await p.evaluate(() => c250.showHits(false)); }
    else await save(p, `01b-crypto-first-screen-${W}`);
    await p.context().close();
  }
  await compose(`01-target-${W}`, `① 대상(금융 1종·현금 0·대출 0·실물 0) — 필터 자리 (${W}, 다크)`, items, 2);
}
// ② 라이트
if (want("02-light")) { const items = [];
  for (const [W, H] of [[390, 844], [320, 640]]) { const p = await open(W, H, "stocks", { scheme: "light" }); await p.evaluate(() => c250.block("stocks")); await settle(p); items.push({ cap: `라이트 ${W} — 주식만`, ...(await cardShot(p)) }); if (W === 390) await save(p, "02a-stocks-first-screen-390-light"); await p.context().close(); }
  await compose("02-light", "② 라이트 (390·320)", items, 2); }
// ③ 배치 비교(탈락안 포함)
if (want("03-variant")) { const items = [];
  const p = await open(390, 844, "stocks"); const m0 = await M(p);
  for (const [v, cap] of [["a", "A 확정 — 2줄 가운데, 버튼 사이 가운뎃점"], ["b", "B 탈락 — 가운뎃점 없음(두 버튼이 한 낱말 묶음처럼 읽힘)"], ["c", "C 탈락 — secondary 알약 버튼(높이 +12, 필터와 같은 '고르는 칸'으로 오독)"]]) {
    await p.evaluate((x) => c250.block("stocks", x), v); await settle(p); const m = await M(p); items.push({ cap: `${cap} · Hero 끝→도넛 ${m.gapHeroToDonut}(${d(m.gapHeroToDonut, m0.gapHeroToDonut)})`, ...(await cardShot(p)) }); }
  await p.context().close();
  const q = await open(1280, 900, "stocks"); const n0 = await M(q); log("03 1280 지금", n0);
  await q.evaluate(() => c250.block("stocks")); await settle(q); const n = await M(q); log("03 1280 A", n);
  items.push({ cap: `1280 A 확정 — Hero 끝→도넛 ${n.gapHeroToDonut}(${d(n.gapHeroToDonut, n0.gapHeroToDonut)})`, ...(await cardShot(q, 60)) }); await save(q, "03a-stocks-first-screen-1280");
  await q.evaluate(() => c250.block("stocks", "d")); await settle(q); const n2 = await M(q); items.push({ cap: `1280 D 탈락 — 넓은 폭 1줄(폭마다 꼴이 바뀜) ${n2.gapHeroToDonut}`, ...(await cardShot(q, 60)) });
  await q.context().close();
  await compose("03-variant-compare", "③ 배치 비교 (다크)", items, 1); }
// ④ 누른 뒤 — 시트 시작 화면 (현금·대출) + 현금 1건↑ 기기의 같은 이벤트(잔액 맞추기, 이 블록에서는 닿지 않음)
if (want("04-sheet")) {
  for (const [cat, name] of [["cash", "현금"], ["loan", "대출"]]) { const p = await open(390, 844, "stocks"); await p.evaluate(() => c250.block("stocks")); await settle(p);
    await p.click(`[data-testid="home-compose-${cat}"]`); await settle(p, 1500); await save(p, `04-${cat}-sheet-start-390`); log(`04 ${cat}`, await p.evaluate(() => document.querySelector('[role="dialog"]')?.innerText.slice(0, 300)));
    await p.context().close(); }
  const p = await open(390, 844, "demo"); await p.evaluate(() => window.dispatchEvent(new CustomEvent("open-add-asset-sheet", { detail: { category: "cash" } }))); await settle(p, 1500); await save(p, "04-cash-sheet-has-cash-390"); log("04 has-cash", await p.evaluate(() => document.querySelector('[role="dialog"]')?.innerText.slice(0, 300))); await p.context().close();
  // 허브 0건 카드 `추가하기` 같은 시트(주식만 기기)
  const h = await open(390, 844, "stocks"); await h.evaluate(() => { location.hash = "#detail"; }); await settle(h, 3000); await save(h, "04-hub-zero-card-390"); await h.evaluate(() => { const l = [...document.querySelectorAll('[data-testid="hub-add-line"]')].find((e) => /현금/.test(e.closest("button,[role=button],.rounded-xl")?.innerText ?? "")); l?.click(); }); await settle(h, 1500); await save(h, "04-hub-cash-sheet-390"); await h.context().close(); }
// ⑤ 저장 직후(상태 14·15) — 필터 복귀
if (want("05-after")) { const items = [];
  for (const [kind, cap] of [["stocksCash", "상태 14 주식만 → 현금 저장 직후: 블록 없음, 필터 2칸"], ["stocksLoan", "상태 15 주식만 → 대출 저장 직후: 필터 3칸"]]) { const p = await open(390, 844, kind); const m = await M(p); log(`05 ${kind}`, m); items.push({ cap, ...(await cardShot(p)) });
    if (kind === "stocksCash") { await p.locator('[aria-label="자산 분포 필터"] [role="radio"]').nth(1).click(); await settle(p, 600); await save(p, "05a-cash-saved-financial-tab-390", { fullPage: true }); }
    await p.context().close(); }
  await compose("05-after-save-390", "⑤ 저장 뒤 홈 (390, 다크) — 블록이 사라지고 지금 화면 그대로", items, 2); }
// ⑥ 대상 아닌 기기 — 무변화(지금 = 이후)
if (want("06-nontarget")) { const items = [];
  for (const [kind, cap] of [["stocksCrypto", "주식+코인 — 금융 2종"], ["loan", "대출만"], ["stocksPhysical", "주식+실물(금 10돈) — 실물이 순자산에 더해짐"], ["demo", "데모(여러 자산군)"]]) { const p = await open(390, 844, kind); const m = await M(p); log(`06 ${kind}`, m); items.push({ cap: `${cap} — 필터 ${m.tabs?.join("·") ?? "없음"} · 블록 없음(diff 0)`, ...(await cardShot(p)) }); await p.context().close(); }
  await compose("06-nontarget-390", "⑥ 대상 아닌 기기 — 지금 화면 그대로 (390, 다크)", items, 2); }
// ⑦ 첫 저장 당일(기록 없음) — 처음 쓰는 사람
if (want("07-first")) { for (const [W, H] of [[390, 844], [320, 640]]) { const p = await open(W, H, "first"); await p.evaluate(() => c250.block("stocks")); await settle(p); log(`07 ${W}`, await M(p)); await save(p, `07-first-day-${W}`, { fullPage: true }); await p.context().close(); } }
await br.close();
