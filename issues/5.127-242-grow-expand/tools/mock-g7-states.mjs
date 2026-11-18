// #242 `내 선택` 결론 줄 상태 전수(C138) + 주식만 가진 사람 5.125 대비 합성(ui-designer, 2026-11-18). 코드 수정 0.
// ① 운영 체험 카드의 라벨 행 자리에 상태별 `내 선택` 행만 쌓아 390·320으로 찍는다(노란 글자 = 목업 주석). ② g7-10a·10b 두 장을 나란히 붙인다.
// node mock-g7-states.mjs <OUT>   (mock-g7-shot.mjs 를 먼저 실행해 10a·10b·10c가 있어야 한다)
import { readFileSync } from "node:fs";
import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PROD = "https://www.secretasset.xyz"; const OUT = process.argv[2];
const lib = readFileSync(new URL("./mock-g7-lib.js", import.meta.url), "utf8");
const b = (t) => `<b class="font-bold">${t}</b>`;
const W = (a, c) => `<span style="white-space:nowrap">${a} ·</span> <span style="white-space:nowrap">${c}</span>`; // 아직 못 셈: 가운뎃점 뒤에서만 줄바꿈
const STATES = [ // [주석, 문장, 화살표(패널 열림) 여부] — 굵은 것은 숫자뿐(모두·없음은 같은 굵기)
  ["정상", `6번 중 ${b("5번")}은 그때보다 오름`, 1], ["손실", `6번 중 ${b("1번")}은 그때보다 오름`, 1], ["0번", `6번 중 그때보다 오른 것 없음`, 1], ["전부", `6번 모두 그때보다 오름`, 1],
  ["큰 수(최장)", `128번 중 ${b("101번")}은 그때보다 오름`, 1],
  ["아직 못 셈(30일 지난 기록 3번 미만 · 매수 3건 미만) — 화살표 없음", W("기록 2번", "30일 지난 3번부터 보여요"), 0], ["아직 못 셈 · 두 자리(최장)", W("기록 12번", "30일 지난 3번부터 보여요"), 0],
  ["아직 못 셈 · 그때 가격이 남은 기록 0 — 화살표 없음", `30일 지난 기록 3번부터 보여요`, 0], ["시세 미수신(지금 가격 없음) — 화살표 없음", W("기록 4번", "가격을 받으면 보여요"), 0],
  ["아직 못 셈 + 매수 3건 이상", `매수 12건 중 ${b("9건")}은 매수가보다 오름`, 1], ["매수 0건", `매수 12건 중 매수가보다 오른 것 없음`, 1], ["매수 전부", `매수 12건 모두 매수가보다 오름`, 1], ["매수 큰 수(최장)", `매수 128건 중 ${b("101건")}은 매수가보다 오름`, 1],
];
const br = await chromium.launch({ proxy });
for (const W of [390, 320]) {
  const ctx = await br.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: true, hasTouch: true }); const p = await ctx.newPage();
  await p.goto(`${PROD}/?trial=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(7000);
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForSelector('[data-testid="grow-row"]', { timeout: 30000 }); await p.waitForTimeout(3000);
  await p.addScriptTag({ content: lib });
  const info = await p.evaluate((STATES) => { const { $, H } = g7; const dl = $('[data-testid="grow-summary"]'); dl.replaceChildren(); $('[data-testid="grow-axes"]').remove(); const out = [];
    for (const [note, html, panel] of STATES) { dl.append(H(`<p class="g7-note" style="grid-column:1/-1;margin-top:4px">${note}</p>`)); g7.pick.call(null, null); dl.append(H(`<dt class="text-xs text-muted-foreground">내 선택</dt>`));
      const dd = H(panel ? `<dd class="min-w-0 tabular-nums break-keep"><button type="button" aria-expanded="false" class="g7-pick"><span>${html}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button></dd>` : `<dd class="min-w-0 tabular-nums break-keep text-muted-foreground" style="text-wrap:balance">${html}</dd>`); dl.append(dd);
      const sp = dd.querySelector("span") ?? dd; out.push({ note: note.slice(0, 14), lines: g7.linesOf(sp), w: g7.textW(sp), area: Math.round(dd.clientWidth - (panel ? 24 : 0)) }); }
    return out; }, STATES);
  console.log(`STATES ${W}`, JSON.stringify(info));
  await p.evaluate(() => scrollTo(0, 0)); await p.locator('[data-testid="grow-total-card"]').screenshot({ path: `${OUT}/g7-05c-pick-states-${W}.png` }); await ctx.close();
}
if (process.argv[3] === "states") { await br.close(); process.exit(0); }
// 주식만 가진 사람 — 5.125(왼쪽) / 새 화면(오른쪽) 나란히
const img = (n) => `data:image/png;base64,${readFileSync(`${OUT}/g7-${n}.png`).toString("base64")}`;
for (const [name, l, r, lt, rt] of [["10-stock-only-compare", "10a-stock-only-5125-390", "10b-stock-only-new-390", "운영 v5.125 (지금)", "새 화면 · 주식만 가진 사람 — 달라지는 곳: 칸 이름, `내 선택` 1행"], ["10d-stock-only-first-compare", "10a-stock-only-5125-390", "10c-stock-only-new-first-390", "운영 v5.125 (지금, 정한 것 있음 — 참고)", "새 화면 · 주식만 · 처음 쓰는 사람 — `내 선택` 행 없음(칸 이름만 다름)"]]) {
  const ctx = await br.newContext({ viewport: { width: 1640, height: 1760 }, deviceScaleFactor: 1 }); const p = await ctx.newPage();
  await p.setContent(`<body style="margin:0;background:#05060a;font:600 22px system-ui;color:#e8c56a"><div style="display:flex;gap:40px;padding:20px"><div><p style="margin:0 0 12px">${lt}</p><img src="${img(l)}" width="780"></div><div><p style="margin:0 0 12px">${rt}</p><img src="${img(r)}" width="780"></div></div></body>`);
  await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/g7-${name}.png`, fullPage: true }); await ctx.close();
}
await br.close();
