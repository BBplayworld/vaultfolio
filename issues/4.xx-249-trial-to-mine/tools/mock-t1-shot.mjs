// #249 체험 공통 표시·복귀 등록 칸 — 시각 목업 캡처(ui-designer, 2026-11-19). 코드 수정 0.
// node mock-t1-shot.mjs <OUT> [장면 이름 일부,…]
import { readFileSync } from "node:fs";
import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5126-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2]; const ONLY = process.argv[3];
const lib = readFileSync(new URL("./mock-t1-lib.js", import.meta.url), "utf8");
const br = await chromium.launch({ proxy });
const want = (n) => !ONLY || ONLY.split(",").some((o) => n.includes(o));
const log = (n, o) => console.log(n, JSON.stringify(o));
export const SCREENS = [["home", "", "551,303"], ["detail-hub", "#detail"], ["stocks", "#detail/stocks", "14,533,200"], ["stocks-xray", "#detail/stocks-xray"], ["stocks-trades", "#detail/stocks-trades"], ["stocks-item", "ITEM", "원$"], ["real-estate", "#detail/real-estate", "원$"], ["crypto", "#detail/crypto"], ["crypto-tx", "#detail/crypto-transactions"], ["cash", "#detail/cash"], ["cash-tx", "#detail/cash-transactions"], ["loans", "#detail/loans"], ["loan-tx", "#detail/loan-transactions"], ["physical", "#detail/physical"], ["tax", "#tax"], ["activity-hub", "#activity"], ["change", "#activity/change", "^[+−-][0-9,]+원$"], ["change-market", "#activity/change-market"], ["dividend", "#activity/dividend"], ["report", "#activity/report"], ["more", "#more"], ["settings", "#settings"]];

const UA_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
async function open(W, H, { scheme = "dark", q = "trial=1", pwa = false } = {}) {
  const ctx = await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, colorScheme: scheme, isMobile: W < 700, hasTouch: W < 1100, ...(pwa && W < 700 ? { userAgent: UA_IOS } : {}) });
  const p = await ctx.newPage();
  // 설치 앱 흉내: matchMedia(display-mode: standalone) 참 + 로드 뒤 @media (display-mode: standalone) 안의 규칙을 조건 없이 다시 넣는다(Playwright 가 CDP 미디어 기능을 덮어써서)
  if (pwa) await p.addInitScript(() => { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => { const r = mm(q); if (/display-mode:\s*standalone/.test(q)) return { matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } }; return r; }; });
  await p.goto(`${PV}/?${q}${q ? "&" : ""}t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(7000);
  if (scheme === "light") { await p.evaluate(() => { document.documentElement.classList.remove("dark"); document.documentElement.style.colorScheme = "light"; }); await p.waitForTimeout(400); }
  if (pwa) await p.evaluate(() => { let out = ""; for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch { continue; } const walk = (rs) => { for (const r of rs) { if (r instanceof CSSMediaRule && /display-mode:\s*standalone/.test(r.conditionText)) { const rest = r.conditionText.replace(/\(display-mode:\s*standalone\)/, "").replace(/^\s*and\s*|\s*and\s*$/g, "").trim(); let inner = ""; for (const i of r.cssRules) inner += i.cssText + "\n"; out += rest ? `@media ${rest}{${inner}}\n` : inner; } else if (r.cssRules) walk(r.cssRules); } }; walk(rules); } const st = document.createElement("style"); st.textContent = out; document.head.append(st); });
  await p.addScriptTag({ content: lib });
  return p;
}
async function go(p, hash) {
  if (hash === "ITEM") { await go(p, "#detail/stocks"); const row = p.getByText(/1년 주가 등락/).first(); await row.click(); await p.waitForTimeout(3000); return; }
  await p.evaluate((h) => { if (h) location.hash = h; else { history.pushState(null, "", location.pathname + location.search); dispatchEvent(new PopStateEvent("popstate")); } }, hash); await p.waitForTimeout(2800);
  await p.evaluate(() => { for (const t of document.querySelectorAll("[data-sonner-toast]")) t.style.display = "none"; });
}
const shot = (p, name, opt) => p.screenshot({ path: `${OUT}/t1-${name}.png`, ...opt });
const buf = async (p, clip) => ({ buf: await p.screenshot(clip ? { clip } : {}), w: clip ? clip.width : p.viewportSize().width });
async function compose(name, title, items, cols = 1) {
  const ctx = await br.newContext({ viewport: { width: 100, height: 100 }, deviceScaleFactor: 1, colorScheme: "dark" }); const p = await ctx.newPage();
  const maxW = Math.max(...items.map((i) => i.w));
  await p.setContent(`<body style="margin:0;background:#0b0c11;font-family:system-ui,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#9aa0aa;width:${cols * (maxW + 24) + 24}px"><div style="padding:16px 24px 4px;font-size:13px;font-weight:700;color:#e6c35c">${title}</div><div style="display:grid;grid-template-columns:repeat(${cols},${maxW}px);gap:20px 24px;padding:12px 24px 24px;align-items:start">${items.map((i) => `<div><div style="font-size:12px;line-height:16px;margin-bottom:6px;color:#e6c35c;min-height:32px">${i.cap}</div><img src="data:image/png;base64,${i.buf.toString("base64")}" style="width:${i.w}px;display:block;outline:1px solid #2a2d36"></div>`).join("")}</div></body>`);
  await p.waitForTimeout(400); const b = await p.locator("body").boundingBox(); await p.setViewportSize({ width: Math.ceil(b.width), height: Math.ceil(b.height) });
  await p.screenshot({ path: `${OUT}/t1-${name}.png`, fullPage: true }); await ctx.close();
}
const bar = (p, opt) => p.evaluate((o) => t1.bar(o), opt ?? {});
const meas = (p, key) => p.evaluate((k) => t1.measure(k), key ?? null);

// ① 전 화면 × 390 다크 — 표시 자리(상단 sticky 1줄), 스크롤 0 + 스크롤 뒤
if (want("01-all")) { const p = await open(390, 844); const top = [], scr = [];
  for (const [name, hash, key] of SCREENS) { await go(p, hash); await bar(p); await p.waitForTimeout(300); const m = await meas(p, key);
    log(`01 ${name}`, { scrollY: m.scrollY, wrap: m.wrap, card: m.card, btn: m.btn, textLines: m.textLines, tag: m.tagCount, btnN: m.btnCount, overlap: m.overlap, stickies: m.stickies, key: m.key });
    top.push({ cap: `${name} — 도착 직후(scrollY ${m.scrollY}) · 표시 y ${m.card.y}~${m.card.b}`, ...(await buf(p)) });
    if (["home", "stocks", "stocks-item", "tax", "change", "report", "more"].includes(name)) { await p.evaluate(() => scrollBy(0, 420)); await p.waitForTimeout(500); const m2 = await meas(p); log(`01 ${name} scrolled`, { scrollY: m2.scrollY, wrap: m2.wrap, overlap: m2.overlap, stickies: m2.stickies }); scr.push({ cap: `${name} — 420px 내린 뒤 · 표시 y ${m2.card.y}~${m2.card.b}`, ...(await buf(p)) }); await p.evaluate(() => scrollTo(0, 0)); }
  }
  await compose("01-all-screens-390", "① 체험 전 화면 22곳 × 390 다크 — 공통 표시 1개(상단 sticky 1줄, 높이 48 + 가림 면 위아래 4)", top, 6);
  await compose("01b-scrolled-390", "① 스크롤 뒤에도 같은 자리(상단 고정) — 다른 sticky·헤더와 겹침 0", scr, 4);
  await p.context().close(); }

// ② 대표 5화면 320×568 첫 화면 — 지금(5.126) / 이후. 첫 핵심 값이 첫 화면에 남는가 + 390 낱장
const REP = [["home", "", "551,303", "홈 순자산"], ["stocks", "#detail/stocks", "14,533,200", "상세·주식 합계"], ["stocks-item", "ITEM", "^[0-9,]+원$", "종목 한 장 첫 큰 값"], ["change", "#activity/change", "^[+−-][0-9,]+원$", "자산 변화 첫 카드"], ["real-estate", "#detail/real-estate", "^[0-9,]+원$", "상세·부동산 합계"]];
if (want("02-rep")) for (const [W, H] of [[320, 568], [390, 844]]) { const p = await open(W, H); const before = [], after = [];
  for (const [name, hash, key, label] of REP) { await go(p, hash); await p.evaluate(() => t1.bar(false)); await p.waitForTimeout(300);
    const k0 = await p.evaluate((k) => t1.keyRect(k), key); before.push({ cap: `지금 — ${label} ${k0?.text} y ${k0?.y}~${k0?.b}`, ...(await buf(p)) });
    await bar(p); await p.waitForTimeout(300); const m = await meas(p, key); log(`02-${W} ${name}`, { before: k0 && [k0.text, k0.y, k0.b, k0.inFirst], after: m.key && [m.key.text, m.key.y, m.key.b, m.key.inFirst], card: m.card, btn: m.btn, textLines: m.textLines, btnLines: m.btnLines, hit: m.btnHit });
    after.push({ cap: `이후 — ${label} y ${m.key?.y}~${m.key?.b} (${m.key ? (m.key.y - k0.y >= 0 ? "+" : "") + Math.round((m.key.y - k0.y) * 10) / 10 : "?"}) · 첫 화면 ${H} 안 ${m.key?.inFirst ? "O" : "X"}`, ...(await buf(p)) });
    if (["home", "stocks", "real-estate", "stocks-item", "change"].includes(name)) await shot(p, `02-${name}-${W}`); }
  await compose(`02-rep5-before-after-${W}`, `② 대표 5화면 ${W}×${H} 첫 화면(다크) — 윗줄 지금(5.126) / 아랫줄 이후. 첫 핵심 값이 첫 화면에 남는다`, [...before, ...after], 5);
  await p.context().close(); }

// ③ 복귀한 웰컴 등록 칸 — 자산군별 상태 + 팝오버 짚는 표시
const KINDS = [[null, "현행(값 없음·홈·성과·상세 허브·세금·실물에서 복귀) — 지금과 같음"], ["stocks", "주식 화면에서 복귀"], ["crypto", "암호화폐 화면에서 복귀"], ["cash", "현금 화면에서 복귀"], ["loans", "대출 화면에서 복귀"], ["real-estate", "부동산 화면에서 복귀 — 강조·포커스 = 직접 입력"]];
async function openWelcome(W, H, scheme) { const p = await open(W, H, { q: "", scheme }); await p.evaluate(() => t1.hideGate()); return p; }
const slotClip = async (p, extra = 0) => { const r = await p.evaluate(() => { const s = document.querySelector('[data-testid="welcome-cta-slot"]'); s.scrollIntoView({ block: "center" }); return null; }); await p.waitForTimeout(250); const c = await p.evaluate(() => t1.R(document.querySelector('[data-testid="welcome-cta-slot"]'))); return { x: 0, y: Math.max(0, c.y - 12), width: p.viewportSize().width, height: Math.min(p.viewportSize().height - Math.max(0, c.y - 12), c.h + 24 + extra) }; };
if (want("03-cta")) for (const W of [390, 320]) { const p = await openWelcome(W, W === 320 ? 568 : 844); const items = [], pops = [];
  for (const [kind, cap] of KINDS) { const m = await p.evaluate((k) => t1.cta(k), kind); await p.waitForTimeout(200); log(`03-${W} ${kind}`, m); items.push({ cap: `${cap} · 제목 ${m.hLines}줄 설명 ${m.pLines}줄`, ...(await buf(p, await slotClip(p))) }); }
  await compose(`03-cta-states-${W}`, `③ 복귀한 웰컴 등록 칸 — 자산군별 시작 상태 (${W}, 다크). 버튼 2개·순서·문구 그대로`, items, 3);
  for (const [kind, cap] of KINDS.slice(1)) { await p.evaluate((k) => t1.cta(k), kind); await p.evaluate(() => document.querySelector('[data-testid="welcome-cta-slot"]').scrollIntoView({ block: "start" })); await p.locator('[data-testid="welcome-cta-more"]').click(); await p.waitForTimeout(700); const m = await p.evaluate((k) => t1.pick(k), kind); await p.waitForTimeout(200); log(`03-${W} pop ${kind}`, m); pops.push({ cap: `${cap} → 직접 입력 · 가져오기 팝오버 · 짚는 행 = ${m.picked}`, ...(await buf(p)) }); await p.keyboard.press("Escape"); await p.waitForTimeout(400); }
  await compose(`03b-cta-popover-pick-${W}`, `③ 팝오버 '짚는 표시' — 방금 본 자산군 행 1개(${W}, 다크). 행 7개·순서·문구 그대로`, pops, 5);
  // 복귀 직후 첫 화면(포커스가 간 버튼이 화면에 들어온 상태) — 부동산·현금
  for (const kind of ["real-estate", "cash"]) { await p.evaluate(() => scrollTo(0, 0)); await p.evaluate((k) => { t1.cta(k); (k === "real-estate" ? t1.$('[data-testid="welcome-cta-more"]') : t1.$('[data-testid="welcome-cta-wizard"]')).scrollIntoView({ block: "center" }); }, kind); await p.waitForTimeout(400); await shot(p, `03c-return-${kind}-${W}`); }
  await p.context().close(); }
if (want("03-cta-wide")) { const items = [];
  { const p = await openWelcome(1280, 900); for (const kind of ["stocks", "real-estate"]) { const m = await p.evaluate((k) => t1.cta(k), kind); log(`03-1280 ${kind}`, m); items.push({ cap: `1280 다크 — ${kind}`, ...(await buf(p, await slotClip(p))) }); } await p.context().close(); }
  { const p = await openWelcome(390, 844, "light"); for (const kind of ["cash", "real-estate"]) { await p.evaluate((k) => t1.cta(k), kind); items.push({ cap: `390 라이트 — ${kind}`, ...(await buf(p, await slotClip(p))) }); }
    await p.evaluate(() => { t1.cta("real-estate"); document.querySelector('[data-testid="welcome-cta-slot"]').scrollIntoView({ block: "start" }); }); await p.locator('[data-testid="welcome-cta-more"]').click(); await p.waitForTimeout(700); await p.evaluate(() => t1.pick("real-estate")); await p.waitForTimeout(200); items.push({ cap: "390 라이트 — 부동산 팝오버 짚는 표시", ...(await buf(p)) }); await p.context().close(); }
  await compose("03d-cta-1280-light", "③ 등록 칸 상태 — 1280 다크 · 390 라이트", items, 1); }

// ④ 홈 기존 배너와 중복 처리 — 기존 배너(122px)를 공통 표시(48px)로 대체, 화면당 1개
if (want("04-home")) { const p = await open(390, 844); const items = []; await go(p, "");
  await p.evaluate(() => t1.bar(false)); await p.waitForTimeout(300); const k0 = await p.evaluate(() => ({ key: t1.keyRect("551,303"), banner: t1.R(t1.$('[data-testid="trial-banner"]')) })); items.push({ cap: `지금(5.126) — 배너 ${k0.banner.h}px(문장 2줄 + 전폭 버튼) · 순자산 y ${k0.key.y}`, ...(await buf(p)) });
  const m = await bar(p); await p.waitForTimeout(300); const k1 = await p.evaluate(() => t1.keyRect("551,303")); log("04 home", { before: k0, after: k1, m }); items.push({ cap: `이후 — 공통 표시 ${m.card.h}px 1개(기존 배너 삭제, 같은 컴포넌트) · 순자산 y ${k1.y} (${Math.round((k1.y - k0.key.y) * 10) / 10})`, ...(await buf(p)) });
  await p.evaluate(() => t1.showHits()); await p.waitForTimeout(200); const c = await p.evaluate(() => t1.R(t1.$(".t1-wrap"))); items.push({ cap: `히트영역(노랑) — 버튼 보이는 크기 ${m.btn.w}×${m.btn.h}, 누름 ${m.btnHit.w}×${m.btnHit.h}`, ...(await buf(p, { x: 0, y: c.y - 8, width: 390, height: c.h + 16 })) });
  await compose("04-home-dedupe-390", "④ 홈 — 기존 배너와 중복 처리(390, 다크)", items, 3); await p.context().close(); }

// ⑤ 폭·환경 — 320/344/360/375/412/768/1280, 라이트, PWA(하단 탭), 인앱 iOS 안내 펼침, 탈락안 비교
if (want("05-width")) { const items = [];
  for (const [W, H] of [[320, 568], [344, 882], [360, 780], [375, 667], [412, 915], [768, 1024]]) { const p = await open(W, H); await go(p, "#detail/stocks"); await bar(p); await p.waitForTimeout(300); const m = await meas(p); log(`05 width ${W}`, { card: m.card, btn: m.btn, textLines: m.textLines, btnLines: m.btnLines, hit: m.btnHit }); const c = m.wrap; items.push({ cap: `${W} — 높이 ${m.card.h} · 글 ${m.textLines}줄 · 버튼 ${m.btn.w}×${m.btn.h}`, ...(await buf(p, { x: 0, y: c.y - 44, width: W, height: c.h + 120 })) }); await p.context().close(); }
  await compose("05-widths", "⑤ 폭별 표시 꼴(다크, 상세·주식) — 390 이상 1줄, 그 아래는 글만 2줄(높이 48 그대로)", items, 3); }
if (want("05-1280")) { const p = await open(1280, 900); for (const [name, hash] of [["home", ""], ["stocks", "#detail/stocks"], ["tax", "#tax"]]) { await go(p, hash); await bar(p); await p.waitForTimeout(400); const m = await meas(p); log(`05-1280 ${name}`, { scrollY: m.scrollY, wrap: m.wrap, card: m.card, btn: m.btn, overlap: m.overlap, stickies: m.stickies }); await shot(p, `05-1280-${name}`); }
  await go(p, "#detail/stocks"); await bar(p); await p.evaluate(() => scrollBy(0, 500)); await p.waitForTimeout(400); await shot(p, "05-1280-stocks-scrolled"); await p.context().close(); }
if (want("05-light")) { const p = await open(390, 844, { scheme: "light" }); const items = []; for (const [name, hash, y] of [["home", "", 0], ["stocks", "#detail/stocks", 0], ["stocks", "#detail/stocks", 420], ["tax", "#tax", null]]) { await go(p, hash); await bar(p); if (y) await p.evaluate((v) => scrollBy(0, v), y); await p.waitForTimeout(400); items.push({ cap: `라이트 — ${name}${y ? " 스크롤 뒤" : ""}`, ...(await buf(p)) }); }
  await compose("05-light-390", "⑤ 라이트 (390)", items, 4); await p.context().close(); }
if (want("05-pwa")) { const p = await open(390, 844, { pwa: true }); const items = []; log("05 pwa standalone", await p.evaluate(() => matchMedia("(display-mode: standalone)").matches));
  for (const [name, hash, y] of [["home", "", 0], ["detail-hub", "#detail", 0], ["stocks", "#detail/stocks", 0], ["stocks", "#detail/stocks", 600], ["tax", "#tax", null]]) { await go(p, hash); await bar(p); if (y) await p.evaluate((v) => scrollBy(0, v), y); await p.waitForTimeout(400); const m = await meas(p); log(`05 pwa ${name} ${y}`, { scrollY: m.scrollY, wrap: m.wrap, nav: m.navRect, overlap: m.overlap, stickies: m.stickies }); items.push({ cap: `설치 앱(standalone) — ${name}${y ? " 스크롤 뒤" : ""} · 표시 ${m.card.y}~${m.card.b} · 하단 탭 y ${m.navRect?.y}`, ...(await buf(p)) }); }
  await compose("05-pwa-390", "⑤ 설치 앱(하단 탭 있음) 390 다크 — 표시는 위, 하단 탭·맨 위로 버튼과 겹침 0", items, 5); await p.context().close();
  // PC 설치 앱: 상단 고정 내비(65px) 아래에 붙는다 = top 65px
  const q = await open(1280, 900, { pwa: true }); await go(q, "#detail/stocks"); await q.evaluate(() => { t1.bar(); const n = t1.R(t1.$('[data-testid="bottom-nav"]')); t1.$(".t1-wrap").style.top = n.b + "px"; scrollBy(0, 500); }); await q.waitForTimeout(500); const m = await meas(q); log("05 pwa pc scrolled", { device: await q.evaluate(() => document.documentElement.dataset.device), wrap: m.wrap, nav: m.navRect, overlap: m.overlap }); await shot(q, "05-pwa-pc-1280-stocks-scrolled"); await q.context().close(); }
if (want("05-guide")) { const items = []; for (const [W, H] of [[390, 844], [320, 568]]) { const p = await open(W, H); await go(p, "#detail/stocks"); await bar(p, { guide: true }); await p.waitForTimeout(400); const m = await p.evaluate(() => ({ wrap: t1.R(t1.$(".t1-wrap")), inner: t1.R(t1.$(".t1-guide-in")), sh: t1.$(".t1-guide-in").scrollHeight, close: t1.R(t1.$('[data-testid="trial-inapp-guide-close"]')) })); log(`05 guide ${W}`, m); items.push({ cap: `${W}×${H} 인앱 iOS — 버튼 누른 뒤 안내 펼침 · 표시 전체 ${m.wrap.h}px(화면 ${H}) · 안쪽 스크롤 ${m.sh > m.inner.h + 1 ? "있음" : "없음"}`, ...(await buf(p)) }); await p.context().close(); }
  await compose("05-inapp-guide", "⑤ 인앱 iOS 외부 이동 안내 펼침 — 표시 안에서 아래로, 화면을 넘지 않고 `닫기`로 접는다", items, 2); }
if (want("05-reject")) { const items = [];
  { let p = await open(390, 844); await go(p, "#tax"); await bar(p, { variant: "flow" }); await p.waitForTimeout(400); const m = await meas(p); log("05 reject flow tax", { scrollY: m.scrollY, wrap: m.wrap }); items.push({ cap: `탈락 C안(in-flow) — 세금 관리 도착 직후 scrollY ${m.scrollY}, 표시 y ${m.wrap.y}(화면 밖) → AC-1 불충족`, ...(await buf(p)) });
    await bar(p); await p.waitForTimeout(400); const m2 = await meas(p); items.push({ cap: `확정 A안(상단 sticky) — 같은 순간 표시 y ${m2.card.y}~${m2.card.b}, 세금 머리 ${m2.stickies[0]?.y}부터`, ...(await buf(p)) });
    await p.context().close(); p = await open(390, 844); await p.evaluate(() => { location.hash = "#detail/stocks"; }); await p.waitForSelector("[data-sonner-toast]", { timeout: 20000 }).catch(() => {}); await p.evaluate(() => { t1.bar(); const w = t1.$(".t1-wrap"); w.style.cssText += "position:fixed;top:auto;bottom:0;left:0;right:0;margin:0;z-index:20"; }); await p.waitForTimeout(300); const tb = await p.evaluate(() => ({ w: t1.R(t1.$(".t1-wrap")), toast: t1.R(document.querySelector("[data-sonner-toast]")) })); log("05 reject bottom", tb); items.push({ cap: `탈락 B안(하단 fixed) — 토스트 자리(${tb.toast ? tb.toast.y + "~" + tb.toast.b : "하단"})와 겹침`, ...(await buf(p)) }); await p.context().close(); }
  await compose("05-rejected-variants-390", "⑤ 자리 비교 — 확정 A(상단 sticky) / 탈락 B(하단 fixed)·C(in-flow)", items, 3); }
await br.close();
