// #249 2단 준비 — 웰컴 첫 화면 A/B/C 목업 캡처(ui-designer, 2026-11-19). 코드 수정 0.
// node mock-s2-shot.mjs <OUT>   (preview issue-5.131, 먼저 /?ga-optout=1 을 연 같은 컨텍스트 — C141)
import { readFileSync } from "node:fs";
import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5131-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const lib = readFileSync(new URL("./mock-s2-lib.js", import.meta.url), "utf8");
const br = await chromium.launch({ proxy });
const log = (n, o) => console.log(n, JSON.stringify(o));
let gaHits = 0;
async function open(W, H, { scheme = "dark", q = "" } = {}) {
  const ctx = await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, colorScheme: scheme, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); p.on("request", (r) => { if (/google-analytics\.com|\/g\/collect/.test(r.url())) gaHits++; });
  await p.goto(`${PV}/?ga-optout=1`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(1500);
  await p.goto(`${PV}/${q ? "?" + q : ""}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(6500);
  if (scheme === "light") { await p.evaluate(() => { document.documentElement.classList.remove("dark"); document.documentElement.style.colorScheme = "light"; }); await p.waitForTimeout(400); }
  await p.addScriptTag({ content: lib }); await p.evaluate(() => s2.hideGate()); await p.waitForTimeout(300);
  return p;
}
const buf = async (p) => ({ buf: await p.screenshot(), w: p.viewportSize().width });
async function compose(name, title, items, cols) {
  const ctx = await br.newContext({ viewport: { width: 100, height: 100 }, deviceScaleFactor: 1, colorScheme: "dark" }); const p = await ctx.newPage();
  const maxW = Math.max(...items.map((i) => i.w));
  await p.setContent(`<body style="margin:0;background:#0b0c11;font-family:system-ui,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#9aa0aa;width:${cols * (maxW + 24) + 24}px"><div style="padding:16px 24px 4px;font-size:14px;font-weight:700;color:#e6c35c">${title}</div><div style="display:grid;grid-template-columns:repeat(${cols},${maxW}px);gap:20px 24px;padding:12px 24px 24px;align-items:start">${items.map((i) => `<div><div style="font-size:13px;line-height:18px;margin-bottom:6px;color:#e6c35c;min-height:36px">${i.cap}</div><img src="data:image/png;base64,${i.buf.toString("base64")}" style="width:${i.w}px;display:block;outline:1px solid #2a2d36"></div>`).join("")}</div></body>`);
  await p.waitForTimeout(400); const b = await p.locator("body").boundingBox(); await p.setViewportSize({ width: Math.ceil(b.width), height: Math.ceil(b.height) });
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); await ctx.close();
}
const CAP = { A: "A 둘러보기 먼저(배지 예시 자산)", B: "B 주식 1개 직접 입력 먼저(배지 예시 자산)", C: "C 현행(대조, 배지 예시 데이터)" };

// ① 첫 화면 6장(390×844·320×568, 다크) + 라이트 390 비교
for (const [W, H, scheme] of [[390, 844, "dark"], [320, 568, "dark"], [390, 844, "light"]]) { const items = [];
  for (const v of ["A", "B", "C"]) { const p = await open(W, H, { scheme });
    const m = v === "C" ? await p.evaluate(() => s2.measure()) : await p.evaluate((x) => s2[x](), v); await p.waitForTimeout(1000);
    log(`${v}-${W}-${scheme}`, m);
    if (scheme === "dark") await p.screenshot({ path: `${OUT}/s2-${v}-${W}.png` });
    items.push({ cap: `${CAP[v]} · 첫 화면 누를 것 ${m.tappable.length}개`, ...(await buf(p)) });
    await p.context().close(); }
  await compose(`s2-compare-${W}${scheme === "light" ? "-light" : ""}`, `웰컴 첫 화면 A/B/C — ${W}×${H} ${scheme === "light" ? "라이트" : "다크"} (데모 값, preview 5.131 실제 DOM·토큰에서 순서 바꾸기·합치기만)`, items, 3); }

// ② 첫 누름 뒤 화면(390, 다크)
const after = [];
{ // A: 직접 둘러보기 → 체험 홈(1단 공통 표시가 실제로 붙은 화면)
  const p = await open(390, 844, { q: "trial=1" }); await p.screenshot({ path: `${OUT}/s2-A-after-390.png` }); after.push({ cap: "A 첫 누름 뒤 — 체험 홈(상단 '예시 자산 · 내 자산으로 시작', 1단 실제 화면) — 미리보기와 도넛 비중 다름", ...(await buf(p)) });
  const p3 = await open(320, 568, { q: "trial=1" }); await p3.screenshot({ path: `${OUT}/s2-A-after-320.png` }); await p3.context().close(); await p.context().close(); }
{ // B: 주식 직접 입력 → 주식 추가 창(실제 창). 팝오버 재구성도 1장
  const p = await open(390, 844); await p.evaluate(() => s2.B()); await p.waitForTimeout(300);
  await p.click('[data-testid="welcome-cta-more"]'); await p.waitForTimeout(700); const rows = await p.evaluate(() => s2.Bpop()); log("B-pop", rows); await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/s2-B-popover-390.png` }); const pop = { cap: "B 보조 버튼 '다른 자산 · 스크린샷' 팝오버 — 첫 행 스크린샷 등록, 주식 행 빠짐", ...(await buf(p)) };
  await p.keyboard.press("Escape"); await p.waitForTimeout(600);
  // 주식 직접 입력(목업 버튼은 화면만 바뀐 것) → 실제 동작 = 팝오버 '주식' 행과 같은 이벤트
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("trigger-add-stock", { detail: { mode: "manual" } }))); await p.waitForTimeout(1200);
  let dlg = await p.evaluate(() => !!document.querySelector('[role="dialog"]'));
  if (!dlg) { await p.click('[data-testid="welcome-cta-more"]'); await p.waitForTimeout(700); await p.evaluate(() => document.querySelector('[data-testid="welcome-manual-stock"]').classList.remove("s2-hide")); await p.click('[data-testid="welcome-manual-stock"]'); await p.waitForTimeout(1500); }
  await p.screenshot({ path: `${OUT}/s2-B-after-390.png` }); after.push({ cap: "B 첫 누름 뒤 — 주식 추가 창(실제 창, 필수 4칸 중 매수일은 기본값)", ...(await buf(p)) }); after.push(pop);
  const p3 = await open(320, 568); await p3.evaluate(() => s2.B()); await p3.click('[data-testid="welcome-cta-more"]'); await p3.waitForTimeout(700); await p3.click('[data-testid="welcome-manual-stock"]'); await p3.waitForTimeout(1500); await p3.screenshot({ path: `${OUT}/s2-B-after-320.png` });
  log("B-after-320", await p3.evaluate(() => { const b = [...document.querySelectorAll('[role="dialog"] button')].find((e) => e.innerText.trim() === "추가"); const r = b?.getBoundingClientRect(); return { addBtnY: r && Math.round(r.y), vh: innerHeight }; }));
  await p3.context().close(); await p.context().close(); }
{ // C: 스크린샷으로 자산 등록 → 마법사(주식 단계)
  const p = await open(390, 844); await p.click('[data-testid="welcome-cta-wizard"]'); await p.waitForTimeout(1500); await p.evaluate(() => s2.hideGate());
  await p.screenshot({ path: `${OUT}/s2-C-after-390.png` }); after.push({ cap: "C 첫 누름 뒤 — 스크린샷 마법사 주식 단계(현행)", ...(await buf(p)) }); await p.context().close(); }
await compose("s2-after-390", "첫 누름 뒤 화면 — 390 다크 (A 체험 홈 / B 주식 추가 창 / C 마법사 / B 팝오버)", after, 4);
console.log("GA 요청", gaHits);
await br.close();
