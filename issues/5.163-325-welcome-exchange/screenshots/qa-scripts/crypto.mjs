import { launch, HEAD, blockExternal, setTheme, enterDemo, inject, co } from "./lib.mjs";
const SH = process.argv[2];
const SPEC = [
  co({ id: "a1", name: "비트코인", symbol: "BTC", exchange: "업비트", quantity: 0.12345678, averagePrice: 91234567.8, currentPrice: 135790123.4 }),
  co({ id: "a2", name: "이더리움", symbol: "ETH", exchange: " 업비트 ", quantity: 1.5, averagePrice: 4321098.7, currentPrice: 3987654.3 }),
  co({ id: "a3", name: "비트코인", symbol: "btc", exchange: "upbit", quantity: 0.01, averagePrice: 100000000.5, currentPrice: 135790123.4 }),
  co({ id: "a4", name: "비트코인", symbol: "BTC", exchange: "빗썸", quantity: 0.333333, averagePrice: 120000000.3, currentPrice: 135790123.4 }),
  co({ id: "a5", name: "리플", symbol: "XRP", exchange: "코인원", quantity: 1234.567, averagePrice: 987.65, currentPrice: 3141.59 }),
  co({ id: "a6", name: "도지", symbol: "DOGE", exchange: "코인", quantity: 777.77, averagePrice: 250.5, currentPrice: 199.5 }),
  co({ id: "a7", name: "솔라나", symbol: "SOL", exchange: "기타", quantity: 3.3, averagePrice: 200000.5, currentPrice: 250000.5 }),
  co({ id: "a8", name: "에이다", symbol: "ADA", exchange: "", quantity: 100.5, averagePrice: 1500.5, currentPrice: 999.5 }),
  co({ id: "a9", name: "트론", symbol: "TRX", exchange: "항목 2", quantity: 50.5, averagePrice: 100.5, currentPrice: 400.5 }),
  co({ id: "a10", name: "제로", symbol: "ZERO", exchange: "코빗", quantity: 3, averagePrice: 1234567, currentPrice: 0.0001 }),
  co({ id: "a11", name: "월렛1", symbol: "W1", exchange: "MyWallet", quantity: 1, averagePrice: 500000.5, currentPrice: 600000.5 }),
  co({ id: "a12", name: "월렛2", symbol: "W2", exchange: "mywallet", quantity: 1, averagePrice: 500000.5, currentPrice: 400000.5 }),
];
const LONG = [
  co({ id: "x1", name: "가상코인A", symbol: "ZZA", exchange: "코인베이스", quantity: 1, averagePrice: 1111111111, currentPrice: 9999999999 }),
  co({ id: "x2", name: "가상코인B", symbol: "ZZB", exchange: "바이낸스 선물 지갑 USDT 마진 계정", quantity: 1, averagePrice: 9876543210, currentPrice: 8641975320 }),
  co({ id: "x3", name: "가상코인C", symbol: "ZZC", exchange: "Crypto.com Exchange", quantity: 1, averagePrice: 100000, currentPrice: 7777777777 }),
  co({ id: "x4", name: "가상코인D", symbol: "ZZD", exchange: "하드웨어지갑레저나노엑스콜드월렛보관분", quantity: 1, averagePrice: 5000000000, currentPrice: 6666666666 }),
  co({ id: "x7", name: "가상코인G", symbol: "ZZG", exchange: "빗썸", quantity: 1, averagePrice: 111111111, currentPrice: 999999999 }),
  co({ id: "x5", name: "가상코인E", symbol: "ZZE", exchange: "업비트", quantity: 3, averagePrice: 1234567, currentPrice: 0.0001 }),
  co({ id: "x6", name: "가상코인F", symbol: "ZZF", exchange: "", quantity: 1, averagePrice: 2222222222, currentPrice: 5555555555 }),
];
// 실사용 크기(수백만~수억)
const REAL = [
  co({ id: "r1", name: "비트코인", symbol: "BTC", exchange: "업비트", quantity: 1.2345, averagePrice: 98000000, currentPrice: 135790000 }),
  co({ id: "r2", name: "이더리움", symbol: "ETH", exchange: "빗썸", quantity: 12.5, averagePrice: 4300000, currentPrice: 3980000 }),
  co({ id: "r3", name: "리플", symbol: "XRP", exchange: "바이낸스", quantity: 15000, averagePrice: 900, currentPrice: 3141 }),
  co({ id: "r4", name: "솔라나", symbol: "SOL", exchange: "", quantity: 20, averagePrice: 210000, currentPrice: 250000 }),
];
const measure = () => {
  const range = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
  const q = (root, id) => root.querySelector(`[data-testid="${id}"]`);
  const f = (n) => +n.toFixed(1);
  const sec = document.querySelector('[data-testid="exchange-totals"]');
  if (!sec) return null;
  const rows = [...sec.querySelectorAll('[data-testid="broker-row"]')].map((row) => {
    const name = q(row, "broker-row-name"), val = q(row, "broker-row-value"), prof = q(row, "broker-row-profit"), cnt = q(row, "broker-row-count"), sh = q(row, "broker-row-share");
    const rr = row.getBoundingClientRect(), nr = range(name), vr = range(val), pr = prof.getBoundingClientRect();
    const amt = val.parentElement.getBoundingClientRect(); const left = name.parentElement.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(name).lineHeight);
    const cr = cnt.getBoundingClientRect(), sr = sh.getBoundingClientRect();
    const sameLine = amt.top < left.bottom - 2;
    const profSpans = [...prof.children].map((c) => c.getBoundingClientRect());
    return {
      name: name.textContent, nameLines: Math.round(name.getBoundingClientRect().height / lh), clipped: name.scrollHeight > name.clientHeight + 1,
      count: cnt.textContent, share: sh.textContent, value: val.textContent, profit: prof.children[0].textContent, rate: prof.children[1].textContent,
      profColor: getComputedStyle(prof.children[0]).color,
      sameLine, gap: sameLine ? f(amt.left - Math.max(nr.right, cr.right, sr.right)) : null,
      overlapY: !sameLine ? f(amt.top - left.bottom) : null,
      amtRightGap: f(rr.right - amt.right), valH: f(val.getBoundingClientRect().height), profOneLine: new Set(profSpans.map((s) => Math.round(s.top))).size === 1 && profSpans.every((s) => s.height < 24),
      cntH: f(cr.height), shareH: f(sr.height), metaTwoLines: Math.abs(cr.top - sr.top) > 4, shareLeftAligned: f(sr.left - cr.left),
      rowH: f(rr.height), rowOverflow: row.scrollWidth - row.clientWidth,
    };
  });
  const de = document.documentElement;
  const t = q(sec, "exchange-totals-toggle"); const tr = t.getBoundingClientRect();
  const hdrLabel = [...document.querySelectorAll("*")].find((x) => x.children.length === 0 && x.textContent === "총 암호화폐 평가금액");
  let box = hdrLabel; for (let i = 0; i < 4 && box && !/평가손익/.test(box.innerText); i++) box = box.parentElement;
  return { toggle: { text: t.innerText.replace(/\n/g, " "), h: tr.height, w: tr.width, expanded: t.getAttribute("aria-expanded") }, panel: q(sec, "exchange-totals-panel").dataset.state, panelH: q(sec, "exchange-totals-panel").getBoundingClientRect().height,
    buttons: sec.querySelectorAll("button, [role=button], a").length, hasResync: /맞추기/.test(sec.innerText), note: q(sec, "exchange-totals-note")?.textContent ?? null, hide: sec.hasAttribute("data-screenshot-hide"),
    header: box?.innerText.replace(/\n/g, " | "), rows, hScroll: de.scrollWidth - de.clientWidth,
    above: sec.previousElementSibling?.innerText.slice(0, 20), below: sec.nextElementSibling?.className.slice(0, 30) };
};
const num = (s) => Number(s.replace(/[^0-9.-]/g, ""));
const goCrypto = async (p) => { await p.getByRole("radio", { name: "상세" }).first().click(); await p.waitForTimeout(700); await p.getByText("암호화폐", { exact: true }).first().click(); await p.waitForTimeout(900); };
const b = await launch(); const out = {}; const ext = [];
// 1) spec 픽스처 — 문자열 합·묶음·정렬 (375 다크)
{
  const ctx = await b.newContext({ viewport: { width: 375, height: 900 } }); await blockExternal(ctx, ext); await setTheme(ctx, HEAD, "dark");
  const p = await ctx.newPage(); const errs = []; p.on("console", (m) => m.type() === "error" && !/ERR_FAILED|Failed to load resource/.test(m.text()) && errs.push(m.text().slice(0, 200))); p.on("pageerror", (e) => errs.push("PE " + e.message.slice(0, 200)));
  await enterDemo(p, HEAD);
  await goCrypto(p);
  out.demoDefault = { block: await p.locator('[data-testid="exchange-totals"]').count(), coins: await p.evaluate(() => JSON.parse(localStorage.getItem("secretasset_asset_data")).crypto.map((c) => [c.symbol, c.exchange])) };
  await p.screenshot({ path: `${SH}/crypto-demo-default-375-dark.png` });
  const keys0 = await p.evaluate(() => Object.keys(localStorage).sort());
  await inject(p, { crypto: SPEC });
  const closed = await p.evaluate(measure);
  await p.screenshot({ path: `${SH}/crypto-spec-closed-375-dark.png` });
  await p.click('[data-testid="exchange-totals-toggle"]'); await p.waitForTimeout(600);
  const open = await p.evaluate(measure);
  await p.locator('[data-testid="exchange-totals"]').scrollIntoViewIfNeeded(); await p.screenshot({ path: `${SH}/crypto-spec-open-375-dark.png`, fullPage: true });
  const keys1 = await p.evaluate(() => Object.keys(localStorage).sort());
  const sess = await p.evaluate(() => Object.keys(sessionStorage).sort());
  out.spec = { closed: { toggle: closed.toggle, panel: closed.panel, panelH: closed.panelH, above: closed.above, below: closed.below }, header: open.header, toggle: open.toggle, buttons: open.buttons, hasResync: open.hasResync, note: open.note, hide: open.hide,
    rows: open.rows.map((r) => [r.name, r.count, r.share, r.value, r.profit, r.rate].join(" / ")),
    sumValue: open.rows.reduce((a, r) => a + num(r.value), 0), sumProfit: open.rows.reduce((a, r) => a + num(r.profit), 0), sumShare: +open.rows.reduce((a, r) => a + num(r.share), 0).toFixed(1),
    keysAdded: keys1.filter((k) => !keys0.includes(k)), sess, errs: [...errs] };
  // 닫기 → 재진입
  await p.click('[data-testid="exchange-totals-toggle"]'); await p.waitForTimeout(500);
  const reclosed = await p.evaluate(measure);
  await p.click('[data-testid="exchange-totals-toggle"]'); await p.waitForTimeout(400);
  await p.getByRole("button", { name: "뒤로가기" }).first().click(); await p.waitForTimeout(800);
  out.reentryHash = p.url().split("#")[1];
  await p.getByText("암호화폐", { exact: true }).first().click(); await p.waitForTimeout(900);
  const re = await p.evaluate(measure);
  out.reentry = { afterCloseExpanded: reclosed.toggle.expanded, afterClosePanelH: reclosed.panelH, reenterExpanded: re?.toggle.expanded, reenterPanel: re?.panel };
  // 키보드: 포커스 후 Enter
  await p.focus('[data-testid="exchange-totals-toggle"]'); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
  out.keyboard = await p.evaluate(() => document.querySelector('[data-testid="exchange-totals-toggle"]').getAttribute("aria-expanded"));
  // 접힌 상태에서 내부 포커스 불가(inert)
  // 상태: 1묶음 / 0건 / 총 0 / 2묶음→1묶음
  const states = {};
  for (const [k, list] of Object.entries({
    one: [SPEC[0], SPEC[1], SPEC[2]], zero: [], total0: [co({ id: "z1", symbol: "Z1", exchange: "업비트", quantity: 1, currentPrice: 0.0001 }), co({ id: "z2", symbol: "Z2", exchange: "빗썸", quantity: 2, currentPrice: 0.0001 })],
    unassignedOnly: [SPEC[7], SPEC[8]], two: [SPEC[0], SPEC[3]], twoWithUnassigned: [SPEC[0], SPEC[7]],
  })) { await inject(p, { crypto: list }); states[k] = { block: await p.locator('[data-testid="exchange-totals"]').count(), toggle: await p.locator('[data-testid="exchange-totals-toggle"]').innerText().catch(() => null) }; if (k === "zero" || k === "one") await p.screenshot({ path: `${SH}/crypto-state-${k}-375-dark.png` }); }
  out.states = states;
  out.errsAll = errs;
  await ctx.close();
}
// 2) 폭별 레이아웃 — LONG·REAL·SPEC × 320·359·360·375·390·430·1280
for (const [fx, list] of [["long", LONG], ["real", REAL], ["spec", SPEC]]) for (const w of [320, 359, 360, 375, 390, 430, 1280]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } }); await blockExternal(ctx, ext); await setTheme(ctx, HEAD, "dark");
  const p = await ctx.newPage(); const errs = []; p.on("console", (m) => m.type() === "error" && !/ERR_FAILED|Failed to load resource/.test(m.text()) && errs.push(m.text().slice(0, 200)));
  await enterDemo(p, HEAD, { crypto: list }); await goCrypto(p);
  await p.click('[data-testid="exchange-totals-toggle"]'); await p.waitForTimeout(600);
  const m = await p.evaluate(measure);
  await p.locator('[data-testid="exchange-totals"]').screenshot({ path: `${SH}/crypto-${fx}-${w}-dark.png` });
  if (fx === "real" && (w === 375 || w === 1280)) await p.screenshot({ path: `${SH}/crypto-real-page-${w}-dark.png` });
  out[`${fx}-${w}`] = { toggleH: m.toggle.h, hScroll: m.hScroll, errs, sumValue: m.rows.reduce((a, r) => a + num(r.value), 0), sumProfit: m.rows.reduce((a, r) => a + num(r.profit), 0), sumShare: +m.rows.reduce((a, r) => a + num(r.share), 0).toFixed(1), header: m.header,
    rows: m.rows.map((r) => ({ n: r.name.slice(0, 8), nl: r.nameLines, clip: r.clipped, same: r.sameLine, gap: r.gap, oy: r.overlapY, rg: r.amtRightGap, vh: r.valH, p1: r.profOneLine, m2: r.metaTwoLines, sl: r.shareLeftAligned, ch: r.cntH, sh: r.shareH, ov: r.rowOverflow, h: r.rowH })) };
  await ctx.close();
}
// 라이트 390
{ const ctx = await b.newContext({ viewport: { width: 390, height: 900 } }); await blockExternal(ctx, ext); await setTheme(ctx, HEAD, "light"); const p = await ctx.newPage(); await enterDemo(p, HEAD, { crypto: REAL }); await goCrypto(p); await p.click('[data-testid="exchange-totals-toggle"]'); await p.waitForTimeout(600); out.lightTheme = await p.evaluate(() => document.documentElement.className); await p.screenshot({ path: `${SH}/crypto-real-page-390-light.png` }); await ctx.close(); }
out.ext = [...new Set(ext)];
console.log(JSON.stringify(out));
await b.close();
