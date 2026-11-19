// #246 홈 '내 종목 오늘' 1줄 — 시각 목업 캡처(ui-designer, 2026-11-19). 코드 수정 0.
// preview(issue-5.126) 데모 홈(/?demo=1)에 mock-m1-lib.js(+ #245 mock-d1-lib.js 의 팁 주입)를 넣고 장면별로 새 줄만 덧붙여 찍는다. deviceScaleFactor 2.
// node mock-m1-shot.mjs <OUT> [장면 이름 일부]
import { readFileSync } from "node:fs";
import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5126-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2]; const ONLY = process.argv[3];
const lib = readFileSync(new URL("./mock-m1-lib.js", import.meta.url), "utf8");
const d1lib = readFileSync(new URL("../../4.xx-245-my-decision-everywhere/tools/mock-d1-lib.js", import.meta.url), "utf8");
const br = await chromium.launch({ proxy });
const want = (n) => !ONLY || ONLY.split(",").some((o) => n.includes(o));
const log = (n, o) => console.log(n, JSON.stringify(o));

async function open(W, H, { scheme = "dark", q = "demo=1", hash } = {}) {
  const ctx = await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, colorScheme: scheme, isMobile: W < 700, hasTouch: W < 1100 });
  const p = await ctx.newPage();
  await p.goto(`${PV}/?${q}&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(6000);
  if (hash) { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(4000); }
  else await p.waitForSelector('[data-testid="home-cause-line"]');
  // 테마는 앱 설정값(기본 다크)을 따르므로 라이트 장면은 html 의 dark 클래스를 내려서 본다(토큰 전환과 같은 경로)
  if (scheme === "light") { await p.evaluate(() => { document.documentElement.classList.remove("dark"); document.documentElement.style.colorScheme = "light"; }); await p.waitForTimeout(400); }
  await p.addScriptTag({ content: d1lib }); await p.addScriptTag({ content: lib });
  return p;
}
const settle = (p) => p.waitForTimeout(250);
const set = async (p, spec, opt) => { await p.evaluate(([s, o]) => m1.line(s, o), [spec, opt ?? {}]); await settle(p); return p.evaluate(() => m1.measure()); };
// 카드 조각(카드 위 8px ~ 도넛 머리 일부)
const cardShot = async (p, extra = 56) => { const c = await p.evaluate(() => m1.R(m1.card())); const vw = p.viewportSize().width; return { buf: await p.screenshot({ clip: { x: 0, y: c.y - 8, width: vw, height: c.h + 16 + extra } }), w: vw }; };
const save = (p, name, opt) => p.screenshot({ path: `${OUT}/m1-${name}.png`, ...opt });
async function compose(name, title, items, cols = 1, scheme = "dark") {
  const ctx = await br.newContext({ viewport: { width: 100, height: 100 }, deviceScaleFactor: 2, colorScheme: "dark" }); const p = await ctx.newPage();
  const maxW = Math.max(...items.map((i) => i.w));
  await p.setContent(`<body style="margin:0;background:#0b0c11;font-family:system-ui,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#9aa0aa;width:${cols * (maxW + 24) + 24}px"><div style="padding:16px 24px 4px;font-size:13px;font-weight:700;color:#e6c35c">${title}</div><div style="display:grid;grid-template-columns:repeat(${cols},${maxW}px);gap:20px 24px;padding:12px 24px 24px;align-items:start">${items.map((i) => `<div><div style="font-size:12px;line-height:16px;margin-bottom:6px;color:#e6c35c">${i.cap}</div><img src="data:image/png;base64,${i.buf.toString("base64")}" style="width:${i.w}px;display:block"></div>`).join("")}</div></body>`);
  await p.waitForTimeout(300); const b = await p.locator("body").boundingBox(); await p.setViewportSize({ width: Math.ceil(b.width), height: Math.ceil(b.height) });
  await p.screenshot({ path: `${OUT}/m1-${name}.png`, fullPage: true }); await ctx.close();
}
// 대입값 — 종목명은 preview 데모 보유 6종목(삼성전자·SK하이닉스·KODEX 200·TIGER 미국S&P500·애플·엔비디아) 그대로. 오늘 = 2026-11-19(목)
// REAL = 캡처 시각(11/19 장 종료 뒤) preview 상세·주식 행 칩의 실제 최대값(SK하이닉스 11/19 종가 ▲2.9%, 나머지 5행 모두 칩 있음)
const REAL = { name: "SK하이닉스", label: "11/19 종가", rate: "+2.9%", n: 5 };
const S1 = { name: "엔비디아", label: "11/18 종가", rate: "+3.2%", n: 5 };
const S2 = { name: "삼성전자", label: "오늘", rate: "-4.1%", n: 5 };
const S3 = { name: "삼성전자", label: "오늘", rate: "-1.5%", n: 5 }; // 새 기준(원화 등락 기여): 삼성전자 -1.5% ≈ -19.5만 vs SK하이닉스 +2.9% ≈ +16.7만
const S5 = { name: "삼성전자", label: "오늘", rate: "+0.8%", n: 0 };
const S7 = { name: "애플", label: "11/18 종가", rate: "-1.5%", n: 1 };
// S11(CEO 디자인 판정 ②, 2026-11-19): 고르는 기준 = 원화 등락 기여(현지 등락 × 수량 × 환율) 절대값 최대. 기여 ≈ 평가금 × r / (1 + r), 평가금은 preview 데모 상세·주식 실제 값
const S11 = { name: "삼성전자", label: "오늘", rate: "+0.4%", n: 6 };
const S11OLD = { name: "에코프로", label: "오늘", rate: "+20.0%", n: 6 }; // 이전 기준(등락률 절대값 최대) — 표기 비교·폐기 비교용
const S12 = { name: "엔비디아", label: "11/18 종가", rate: "+3.2%", n: 5 };
const S13 = { name: "삼성전자", label: "11/19 종가", rate: "+2.0%", n: 5 };
const S14 = { name: "삼성전자", label: "11/20 종가", rate: "-1.2%", n: 5 };
const S15 = { name: "TIGER 미국나스닥100커버드콜(합성)", label: "11/18 종가", rate: "+1.4%", n: 5 };
const S15b = { name: "TIGER 미국S&amp;P500", label: "11/18 종가", rate: "+1.4%", n: 12 };
const WIDE = { name: "SK하이닉스", label: "11/19 종가", rate: "-12.3%", n: 12 };
const DUE = { badge: "내 조건", title: "점검 차례 <span class='tabular-nums'>1종목</span>", desc: "평단 대비 −15% 이하에 닿았어요" };

// ⓪ 데모 상세·주식 행 칩의 지금 값(목업 값과 대조용 로그)
if (want("00-chips")) { const p = await open(390, 844, { hash: "#detail/stocks" }); await p.waitForSelector('[data-testid="stock-row-left"]');
  log("00-chips", await p.evaluate(() => [...document.querySelectorAll('[data-testid="stock-row-left"]')].map((l) => l.closest('[data-slot="collapsible"]').innerText.replace(/\n+/g, " | ").slice(0, 160)))); await p.context().close(); }

// ① 자리·높이 — 지금 / A(+40) / B(+34 아래 10) / C(+34 확정) + 히트영역 표시
if (want("01-place")) { const p = await open(390, 844); const items = [];
  const m0 = await p.evaluate(() => m1.measure()); log("01 now", m0); items.push({ cap: `지금(5.126) — 카드 끝 ${m0.card.b} · 도넛 ${m0.donut.y}`, ...(await cardShot(p, 150)) });
  for (const [geo, cap] of [["a", "A안(탈락) 위아래 10 + 카드 끝 6"], ["b", "B안(탈락) tech-review +34 — 줄 간격 20 · 아래 여백 10"], ["c", "C안(확정) 줄 간격 14 · 아래 여백 16"]]) {
    const m = await set(p, REAL, { geo }); log(`01 ${geo}`, m); items.push({ cap: `${cap} — 카드 끝 ${m.card.b}(+${Math.round((m.card.b - m0.card.b) * 10) / 10}) · 도넛 ${m.donut.y}`, ...(await cardShot(p, 150)) }); }
  await p.evaluate(() => m1.showHits()); await settle(p); items.push({ cap: "C안 히트영역(노랑 = 내 종목 줄 40px, 하늘 = 원인 줄 40px, 분홍 = 성적표 배지) — 교집합 0", ...(await cardShot(p, 150)) }); await p.evaluate(() => m1.showHits(false));
  await compose("01-place-height-390", "① 자리·높이 — 카드 맨 끝 1곳 (390, 다크)", items, 2);
  await save(p, "01a-first-screen-real-390"); await set(p, null); await save(p, "01b-first-screen-none-390");
  await p.context().close(); }

// ② 상태 — 390 카드 조각
if (want("02-states")) { const p = await open(390, 844); const items = [];
  for (const [cap, s] of [["데모 실제 값(11/19 장 종료 뒤) — 원화 등락 기여 최대 행의 칩", REAL], ["S1 오른 날", S1], ["S2 내린 날(장중)", S2], ["S3 부호 혼합 — 원화 등락 기여가 큰 쪽(삼성전자 -1.5% ≈ -19.5만 / SK하이닉스 +2.9% ≈ +16.7만)", S3], ["S5 1종목 — 꼬리 없음", S5], ["S7 나머지가 0.0% — 칩이 있으므로 센다", S7], ["S11 새 기준 — 소액 +20.0%가 있어도 주력 종목(원화 등락 기여 최대)", S11], ["S12 국내 장중·미국 마감 — 고른 종목의 라벨", S12], ["S13 미국 장중·국내 마감", S13], ["S14 주말·휴장", S14], ["S15 긴 종목명", S15], ["두 자리 % · 두 자리 N", WIDE], ["S16 조회 중 — 자리만", "pending"], ["S6·S8·S9·S10·S17 줄 없음 = 지금 화면 그대로", null]]) {
    const m = await set(p, s); log(`02 ${cap}`, { card: m.card, text: m.text, overlap: m.overlap }); items.push({ cap, ...(await cardShot(p, 24)) }); }
  await compose("02-states-390", "② 상태별 문장 (390, 다크) — 꼴·자리·굵기 같고 등락률 색만 다르다", items, 2); await p.context().close(); }

// ③ 차례 팁이 보일 때 — 줄 숨김 / 닫은 뒤 — 줄
// ③ 팁과 줄 — CEO 디자인 판정 ①(2026-11-19): '팁이 보이면 줄 숨김' 폐기. 차례 팁이어도 줄은 그대로 같이 보인다(03a·03b 장면은 폐기)
if (want("03-due")) { const p = await open(390, 844);
  await p.evaluate((s) => d1.tip(s), DUE); await set(p, REAL); log("03 due tip + line 390", await p.evaluate(() => m1.measure())); await save(p, "03d-due-tip-with-line-390", { fullPage: true });
  await p.context().close();
  const q = await open(390, 844); await set(q, REAL); log("03 other tip + line", await q.evaluate(() => m1.measure())); await save(q, "03c-other-tip-with-line-390", { fullPage: true }); await q.context().close(); }
if (want("03-due")) { const p = await open(1280, 900); await p.evaluate((s) => d1.tip(s), DUE); await set(p, REAL); log("03 due tip + line 1280", await p.evaluate(() => m1.measure())); await save(p, "03e-due-tip-with-line-1280"); await p.context().close(); }

// ④ 펼침 패널 — 1곳(접기 아래) / 비교안(패널 안 지수 줄 아래)
if (want("04-open")) for (const W of [390, 1280]) { const p = await open(W, W > 1000 ? 900 : 844); const items = [];
  await p.locator('[data-testid="home-cause-line"]').click(); await p.waitForTimeout(500);
  const m0 = await p.evaluate(() => m1.measure()); log(`04-${W} open now`, m0); items.push({ cap: `지금(5.126) 펼침 — 카드 끝 ${m0.card.b}`, ...(await cardShot(p, 40)) });
  let m = await set(p, REAL); log(`04-${W} end`, m); items.push({ cap: `확정 — 카드 맨 끝 1곳(접기 아래, 간격 0) 카드 끝 ${m.card.b}(+${Math.round((m.card.b - m0.card.b) * 10) / 10})`, ...(await cardShot(p, 40)) });
  await p.evaluate(() => m1.showHits()); await settle(p); items.push({ cap: "확정안 히트영역 — 접기 40px 바로 아래 40px, 교집합 0", ...(await cardShot(p, 40)) }); await p.evaluate(() => m1.showHits(false));
  m = await set(p, REAL, { where: "panel" }); log(`04-${W} panel`, m); items.push({ cap: `비교(탈락) — 패널 안 지수 줄 아래·접기 위(두 군데 구조) 카드 끝 ${m.card.b}(+${Math.round((m.card.b - m0.card.b) * 10) / 10})`, ...(await cardShot(p, 40)) });
  await compose(`04-open-panel-${W}`, `④ 원인 패널 펼침 (${W}, 다크)`, items, W > 1000 ? 1 : 2); await p.context().close(); }

// ⑤ 원인 없는 날(카드 안 지수 줄 아래) + 시간차 문장
if (want("05-nocause")) { const items = [];
  for (const [cap, mk, s] of [["원인 없는 날 · S1 — 지수 줄 바로 아래", null, S1], ["S12 목 10:00 — 국내 장중·미국 마감", null, S12], ["S12 같은 시각에 국내 종목이 뽑힌 경우", null, { name: "삼성전자", label: "오늘", rate: "+2.4%", n: 5 }], ["S13 목 23:40 — 지수 줄(390은 첫 시장만) 11/19 종가 + 내 종목 11/19 종가", ["11/19", "+2.0%", "11/18", "-0.2%"], S13], ["비교(탈락) 날짜를 앞에 — 지수 줄과 구분이 약해진다", null, { ...S1, order: "date-first" }], ["줄 없는 날(0.0%·칩 없음) — 지금 화면", null, null]]) {
    const p = await open(390, 844); await p.evaluate((a) => m1.noCause(a ? m1.marketDiff(...a) : null), mk); const m = await set(p, s); log(`05 ${cap}`, { card: m.card, hits: m.hits, overlap: m.overlap, donut: m.donut });
    if (s === S1 && !mk && !items.length) { await p.evaluate(() => m1.showHits()); await settle(p); items.push({ cap: "원인 없는 날 히트영역 — 지수 줄 40 / 내 종목 줄 40, 교집합 0", ...(await cardShot(p, 24)) }); await p.evaluate(() => m1.showHits(false)); await settle(p); }
    items.push({ cap: `${cap} — 카드 끝 ${m.card.b}`, ...(await cardShot(p, 24)) }); await p.context().close(); }
  await compose("05-nocause-timediff-390", "⑤ 원인 없는 날 · 해외/국내 시간차 (390, 다크)", items, 2); }

// ⑥ 폭 — 320 · 1280
if (want("06-width")) { const items = [];
  { const p = await open(320, 640); const m0 = await p.evaluate(() => m1.measure());
    for (const [cap, s] of [["S1", S1], ["S2", S2], ["긴 이름 + 두 자리 N — 외 N종목 먼저 숨김", S15b], ["S15 아주 긴 이름 — 이름 말줄임, 라벨·등락률 온전", S15], ["두 자리 %", WIDE]]) { const m = await set(p, s); log(`06-320 ${cap}`, { card: [m0.card.b, m.card.b], text: m.text, overlap: m.overlap }); items.push({ cap: `320 — ${cap}`, ...(await cardShot(p, 16)) }); }
    await set(p, REAL); await save(p, "06a-first-screen-real-320"); await p.context().close(); }
  await compose("06-width-320", "⑥ 320 폭 (다크)", items, 2);
  { const p = await open(390, 844); const it = []; for (const [cap, s] of [["긴 이름 + 두 자리 N — 외 N종목 숨김, 이름 온전", S15b], ["S15 아주 긴 이름 — 외 N종목 숨김 + 이름 말줄임", S15]]) { const m = await set(p, s); log(`06-390 ${cap}`, m.text); it.push({ cap: `390 — ${cap}`, ...(await cardShot(p, 16)) }); } await compose("06b-long-name-390", "⑥ 긴 종목명 (390, 다크)", it, 2); await p.context().close(); }
  { const p = await open(1280, 900); const m0 = await p.evaluate(() => m1.measure()); log("06-1280 now", m0); await save(p, "06c-first-screen-none-1280");
    const m = await set(p, REAL); log("06-1280 real", m); await save(p, "06d-first-screen-real-1280"); const it = [{ cap: `1280 데모 실제 값 — 카드 끝 ${m0.card.b} → ${m.card.b}(+${Math.round((m.card.b - m0.card.b) * 10) / 10})`, ...(await cardShot(p, 60)) }];
    await p.evaluate(() => m1.showHits()); await settle(p); it.push({ cap: "1280 히트영역", ...(await cardShot(p, 60)) }); await p.evaluate(() => m1.showHits(false));
    const m2 = await set(p, S15); log("06-1280 S15", m2.text); it.push({ cap: "1280 S15 긴 이름", ...(await cardShot(p, 60)) });
    await compose("06e-card-1280", "⑥ 1280 폭 (다크) — 같은 카드 같은 자리, 줄 높이 고정 20px", it, 1); await p.context().close(); } }

// ⑦ 라이트
if (want("07-light")) { const p = await open(390, 844, { scheme: "light" }); log("07 html class", await p.evaluate(() => document.documentElement.className)); const items = [];
  for (const [cap, s] of [["S1 오른 날", S1], ["S2 내린 날", S2], ["S5 1종목", S5], ["S16 조회 중", "pending"]]) { await set(p, s); items.push({ cap: `라이트 — ${cap}`, ...(await cardShot(p, 24)) }); }
  await set(p, REAL); await save(p, "07a-first-screen-real-390-light"); await compose("07-light-390", "⑦ 라이트 (390)", items, 2); await p.context().close(); }

// ⑧ 표기 비교(탈락안) — 부호 꼴·가운뎃점
if (want("08-notation")) { const p = await open(390, 844); const items = [];
  for (const [cap, s] of [["확정 — 지수 줄과 같은 +/- 꼴", S1], ["비교(탈락) — 상세·주식 칩 꼴 ▲", { ...S1, rate: "▲3.2%" }], ["확정 — 내린 날", S2], ["비교(탈락) — ▼", { ...S2, rate: "▼4.1%" }], ["확정 — 가운뎃점으로 사실과 개수를 나눈다", S11OLD], ["비교(탈락) — 가운뎃점 없음(원인 줄 `외 1개` 꼴)", { ...S11OLD, noDot: true }]]) { await set(p, s); items.push({ cap, ...(await cardShot(p, 8)) }); }
  await compose("08-notation-compare-390", "⑧ 표기 비교 (390, 다크)", items, 2); await p.context().close(); }
// ⑨ 고르는 기준 — 원화 등락 기여 절대값 최대(CEO 디자인 판정 ②). 화면에 보이는 값은 그 종목의 칩 값(%)뿐, 기여 금액은 어디에도 쓰지 않는다(아래 금액은 검수용 캡션)
if (want("09-pick")) { const p = await open(390, 844); const items = [];
  for (const [cap, s] of [
    ["데모 실제 값(11/19 장 종료 뒤) — SK하이닉스 +2.9% ≈ +16.7만 / 삼성전자 +0.4% ≈ +5.1만 / 엔비디아 -2.5% ≈ -4.2만 / KODEX 200 +1.0% ≈ +3.2만 / 애플 +0.3% ≈ +1.7만 / TIGER +0.3% ≈ +0.8만 → SK하이닉스(이전 기준과 같음)", REAL],
    ["폐기(이전 기준 = 등락률 절대값 최대) — 소액 종목 +20.0%가 뽑혔다", S11OLD],
    ["가정 ① 주력 +0.4% vs 소액 +20.0% — 삼성전자(평가금 1,279만) ≈ +5.1만 / 소액 종목(평가금 20만 가정) ≈ +3.3만 → 삼성전자", S11],
    ["가정 ② 주력 +0.1% vs 중간 비중 -8.0% — 삼성전자 ≈ +1.3만 / KODEX 200(323만) ≈ -28.0만 → KODEX 200", { name: "KODEX 200", label: "오늘", rate: "-8.0%", n: 5 }],
    ["가정 ③ 부호 혼합 — 삼성전자 -1.5% ≈ -19.5만 / SK하이닉스 +2.9% ≈ +16.7만 → 삼성전자(등락률은 SK하이닉스가 더 크다)", { name: "삼성전자", label: "오늘", rate: "-1.5%", n: 5 }],
    ["가정 ④ 국내·해외 섞임(목 10:00) — 애플 11/18 종가 +3.0% ≈ +16.4만 / 삼성전자 오늘 +0.8% ≈ +10.1만 / 엔비디아 11/18 종가 +6.0% ≈ +9.2만 → 애플(등락률은 엔비디아가 더 크다)", { name: "애플", label: "11/18 종가", rate: "+3.0%", n: 5 }]]) {
    await set(p, s); items.push({ cap, ...(await cardShot(p, 8)) }); }
  await compose("09-pick-by-contribution-390", "⑨ 고르는 기준 = 원화 등락 기여(현지 등락 × 보유 수량 × 환율) 절대값 최대 1종목 (390, 다크) — 화면 표기는 그 종목의 칩 값(%)만", items, 2); await p.context().close(); }
await br.close();
