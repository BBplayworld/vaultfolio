import { execSync } from "node:child_process"; import { createRequire } from "node:module"; import path from "node:path"; import fs from "node:fs";
const g = execSync("npm root -g",{encoding:"utf8"}).trim();
const { chromium } = createRequire(path.join(g,"noop.js"))("playwright");
const [,, SHOTS, DATA, WIDTHS] = process.argv;
const widths = WIDTHS.split(",").map(Number);
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const b = await chromium.launch({ proxy });
const SCREENS = [
  ["home", "", null],
  ["detail-hub", "#detail", null],
  ["detail-stocks", "#detail/stocks", null],
  ["detail-stock-page", "#detail/stocks", "stockPage"],
  ["detail-xray", "#detail/stocks-xray", null],
  ["detail-realestate", "#detail/real-estate", null],
  ["detail-crypto", "#detail/crypto", null],
  ["detail-cash", "#detail/cash", null],
  ["detail-loans", "#detail/loans", null],
  ["perf-hub", "#activity", null],
  ["perf-change-day", "#activity/change", "change-period-day"],
  ["perf-change-week", "#activity/change", "change-period-week"],
  ["perf-change-month", "#activity/change", "change-period-month"],
  ["perf-change-year", "#activity/change", "change-period-year"],
  ["perf-change-stock-day", "#activity/change", "stock-day"],
  ["perf-market", "#activity/change-market", null],
  ["perf-dividend", "#activity/dividend", null],
  ["perf-report", "#activity/report", null],
  ["more", "#more", null],
  ["settings", "#settings", null],
  ["tax", "#tax", null],
];
const MODE = process.argv[5] || "before";
const AFTER_CSS = `
:root{--text-2xs:.6875rem}
.text-2xs{font-size:var(--text-2xs);line-height:var(--tw-leading,1.45)}
@media (min-width:768px){:root{--text-2xs:.75rem;--text-xs:.8125rem;--text-sm:.9375rem;--text-base:1.0625rem;--text-lg:1.1875rem;--text-xl:1.375rem;--text-2xl:1.6875rem;--text-3xl:2.0625rem;--text-4xl:2.5rem}
 .md\\:text-xl{font-size:var(--text-xl);line-height:var(--tw-leading,1.4)} .md\\:text-3xl{font-size:var(--text-3xl);line-height:var(--tw-leading,1.2)} .md\\:text-sm{font-size:var(--text-sm);line-height:var(--tw-leading,1.43)}}
@media (min-width:1280px){:root{--text-2xs:.75rem;--text-xs:.875rem;--text-sm:1rem;--text-base:1.125rem;--text-lg:1.25rem;--text-xl:1.5rem;--text-2xl:1.875rem;--text-3xl:2.25rem;--text-4xl:2.75rem}}
@media (min-width:768px){.w-\\[164px\\]{width:176px} .md\\:text-xs{font-size:var(--text-xs);line-height:var(--tw-leading,1.34)}}
@media (min-width:1280px){.w-\\[164px\\]{width:188px}}
`;
const rewrite = () => {
  const SZ = "(?:xs|sm|base|lg|xl|[2-9]xl|\\[[0-9.]+px\\])";
  const re = new RegExp("(?:^|\\s)((?:sm|md|lg):)?text-(" + SZ + ")(?=\\s|$)", "g");
  let cnt = 0;
  for (const el of document.querySelectorAll("[class]")) {
    if (el.closest("svg") || el.dataset.rw) continue;
    const c = el.getAttribute("class"); if (!/text-/.test(c)) continue;
    const found = []; let m; re.lastIndex = 0;
    while ((m = re.exec(c))) found.push((m[1] || "") + m[2]);
    if (!found.length) continue;
    const key = found.join(" ");
    const isInput = /^(INPUT|TEXTAREA)$/.test(el.tagName);
    if (isInput) continue;
    const base = found.find((f) => !f.includes(":"));
    let out = null;
    const has = (x) => found.includes(x);
    if (key.includes("max-")) continue;
    if (base === "sm" && found.length === 1 && el.closest('[data-testid^="home-week"]') && !/font-semibold/.test(c)) out = "text-xs";
    else if (base === "sm" && has("sm:sm") === false && /hidden/.test(c) && /sm:inline/.test(c) && el.closest('[data-testid^="home-week"]')) out = "text-xs";
    else if (found.some((f) => /^\[(8|9|10)px\]$/.test(f))) out = "text-2xs";
    else if (base === "base" && has("sm:lg") && has("lg:2xl")) out = "text-lg md:text-xl";            // 페이지 제목
    else if (base === "lg" && has("sm:2xl")) out = /truncate/.test(c) ? "text-base" : "text-lg md:text-xl"; // TopBar·xl 셀렉터
    else if (base === "2xl" && has("lg:4xl")) out = "text-2xl md:text-3xl";                    // 홈 Display
    else if (base === "2xl" && has("sm:3xl")) out = "text-2xl";                                // 페이지 Hero
    else if (base === "xl" && has("lg:3xl")) out = "text-2xl";                                 // 상세 요약 → 페이지 Hero
    else if (base === "xl" && has("sm:2xl")) out = "text-xl";                                  // 카드 Hero
    else if (base === "sm" && has("sm:base") && has("lg:lg")) out = "text-sm";
    else if (base === "sm" && has("sm:base")) out = (/font-bold/.test(c) && !/tabular-nums/.test(c)) ? "text-base" : "text-sm"; // 섹션 제목만 base
    else if (base === "sm" && has("lg:base") && el.tagName === "H3") out = "text-base";        // KPI 카드 제목
    else if (base === "sm") out = "text-sm";
    else if (base === "base") out = "text-base";
    else if (base === "xs" && has("sm:sm")) out = "text-xs";                                   // 구조 예외(표·셀) 유지
    else if (base === "xs") out = "text-xs";
    else if (base === "[13px]") out = "text-sm";
    else if (base === "[12px]") out = "text-xs";
    else if (base === "[15px]") out = "text-sm";
    else if (base === "[17px]") out = "text-lg";
    else if (base === "[11px]" && has("sm:sm")) out = "text-2xs md:text-xs";                   // 달력 셀
    else if (base === "sm" && el.closest('[data-testid^="home-week"]') && !/font-semibold/.test(c)) out = "text-xs"; // 홈 추이 막대 라벨
    else if (/^\[(8|9|10|11)px\]$/.test(base || "")) out = "text-2xs";
    else if (base) out = "text-" + base;
    if (!out) continue;
    const nc = (c.replace(re, " ") + " " + out).replace(/\\s+/g, " ").trim();
    el.dataset.rw = "1"; if (nc !== c) { el.setAttribute("class", nc); cnt++; }
  }
  return cnt;
};

const collect = () => {
  const out = []; const vw = innerWidth;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const t = n.nodeValue.replace(/\s+/g, " ").trim(); if (!t) continue;
    const el = n.parentElement; if (!el) continue;
    if (el.closest("script,style,noscript")) continue;
    const r0 = document.createRange(); r0.selectNodeContents(n); const r = r0.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
    if (el.closest('[aria-hidden="true"].sr-only,.sr-only')) continue;
    const svg = !!el.closest("svg");
    let fs = parseFloat(cs.fontSize);
    const lines = Math.round(r.height / (parseFloat(cs.lineHeight) || fs * 1.5));
    // 자신 또는 조상 중 잘리는 요소
    let clip = false; let a = el;
    for (let i = 0; i < 3 && a; i++, a = a.parentElement) { const s = getComputedStyle(a); if ((s.overflowX === "hidden" || s.textOverflow === "ellipsis") && a.scrollWidth > a.clientWidth + 1) { clip = true; break; } }
    const anc = el.closest("button,a,[role=tab],[role=radio],th,td,h1,h2,h3,h4,label,nav,header");
    out.push({ t: t.slice(0, 40), fs, fw: cs.fontWeight, lh: cs.lineHeight, tag: el.tagName.toLowerCase(), anc: anc ? anc.tagName.toLowerCase() : "", cls: (el.getAttribute("class") || "").slice(0, 140), tid: el.closest("[data-testid]")?.getAttribute("data-testid") || "", svg, lines, clip, x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), over: r.right > vw + 1 || r.left < -1, n: t.length });
  }
  // 블록 단위 줄 수
  const blocks = []; const seenB = new Set();
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("svg,script,style")) continue;
    if (![...el.childNodes].some((c) => c.nodeType === 3 && c.nodeValue.trim())) continue;
    let bEl = el; while (bEl && getComputedStyle(bEl).display.startsWith("inline") && bEl.parentElement) bEl = bEl.parentElement;
    if (!bEl || seenB.has(bEl)) continue; seenB.add(bEl);
    const r = bEl.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(bEl); if (cs.visibility === "hidden") continue;
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
    const rg = document.createRange(); rg.selectNodeContents(bEl); const rects = [...rg.getClientRects()].filter((q) => q.width > 0.5);
    const tops = []; for (const q of rects) { if (!tops.some((t) => Math.abs(t - q.top) < q.height * 0.6)) tops.push(q.top); }
    blocks.push({ t: (bEl.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40), lines: tops.length, h: Math.round(r.height), fs: parseFloat(cs.fontSize), tid: bEl.closest("[data-testid]")?.getAttribute("data-testid") || "", clipX: bEl.scrollWidth > bEl.clientWidth + 1, y: Math.round(r.top + scrollY) });
  }
  // 텍스트 조각 간 겹침
  const rs = []; const w2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let m2;
  while ((m2 = w2.nextNode())) { const t = m2.nodeValue.trim(); if (!t || !m2.parentElement || m2.parentElement.closest("svg,script,style,.sr-only")) continue; const cs = getComputedStyle(m2.parentElement); if (cs.visibility === "hidden" || +cs.opacity === 0) continue; const rg = document.createRange(); rg.selectNodeContents(m2); for (const q of rg.getClientRects()) if (q.width > 1 && q.height > 1) rs.push({ t: t.slice(0, 16), l: q.left, r: q.right, tp: q.top, b: q.bottom, n: m2 }); }
  const coll = [];
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], c = rs[j]; if (a.n === c.n) continue; const ox = Math.min(a.r, c.r) - Math.max(a.l, c.l), oy = Math.min(a.b, c.b) - Math.max(a.tp, c.tp); if (ox > 2 && oy > Math.min(a.b - a.tp, c.b - c.tp) * 0.5) { if (a.n.parentElement.contains(c.n.parentElement) || c.n.parentElement.contains(a.n.parentElement)) continue; coll.push(a.t + " × " + c.t); } }
  return { blocks, coll: coll.slice(0, 30), nodes: out, docW: document.documentElement.scrollWidth, vw, docH: document.documentElement.scrollHeight };
};
for (const W of widths) {
  const H = W < 700 ? 844 : W < 1100 ? 1024 : 900;
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: "dark", isMobile: W < 700, hasTouch: W < 1100 });
  const p = await ctx.newPage();
  await p.goto("https://www.secretasset.xyz/?trial=1", { waitUntil: "networkidle", timeout: 90000 }).catch(e => console.log("goto", e.message));
  await p.waitForTimeout(3500);
  for (const [name, hash, act] of SCREENS) {
    try {
      await p.evaluate((h) => { if (h) location.hash = h; else { history.pushState(null, "", location.pathname + location.search); dispatchEvent(new PopStateEvent("popstate")); } }, hash);
      await p.waitForTimeout(1800);
      let note = "";
      if (act && act.startsWith("change-period")) { const l = p.locator(`[data-testid="${act}"]`); if (await l.count()) { await l.first().click(); } else note = "no-selector"; }
      if (act === "stock-day") { const l = p.locator('[data-testid="change-scope-stock"]'); if (await l.count()) await l.first().click(); else note = "no-selector"; await p.waitForTimeout(600); const d = p.locator('[data-testid="change-period-day"]'); if (await d.count()) await d.first().click(); }
      if (act === "settlement") {
        const all = p.locator('[data-testid="change-scope-all"]'); if (await all.count()) await all.first().click(); await p.waitForTimeout(400);
        const m = p.locator('[data-testid="change-period-month"]'); if (await m.count()) await m.first().click(); await p.waitForTimeout(1200);
        const s = p.getByRole("button", { name: /결산/ }); if (await s.count()) { await s.first().click(); } else note = "no-settlement-entry";
      }
      if (act === "openFirstStock" || act === "stockPage") { const l = p.locator('[data-testid="detail-list-box-stocks"] [data-testid^="stock-row-"]').first(); if (await l.count()) { await l.click(); await p.waitForTimeout(1500); if (!(await p.locator('[data-testid="stock-page-entry"]').count())) { await l.click(); await p.waitForTimeout(1500); } } else note = "no-row";
        if (act === "stockPage") { const e = p.locator('[data-testid="stock-page-entry"]').first(); if (await e.count()) { await e.click(); await p.waitForTimeout(2500); } else note = "no-entry"; } }
      await p.waitForTimeout(act ? 2200 : 1200);
      let rw = 0;
      if (MODE === "after") { await p.addStyleTag({ content: AFTER_CSS }).catch(()=>{}); rw = await p.evaluate(rewrite); await p.waitForTimeout(500); rw += await p.evaluate(rewrite); await p.waitForTimeout(400); }
      const d = await p.evaluate(collect); d.rw = rw;
      d.hash = await p.evaluate(() => location.hash); d.note = note;
      fs.writeFileSync(path.join(DATA, `${name}-${W}.json`), JSON.stringify(d));
      await p.screenshot({ path: path.join(SHOTS, `${MODE}-${name}-${W}-dark.png`), fullPage: true });
      console.log(W, name, d.hash, note, "nodes", d.nodes.length, "docW", d.docW, "H", d.docH);
      if (act === "settlement") { await p.keyboard.press("Escape").catch(()=>{}); }
    } catch (e) { console.log("ERR", W, name, e.message.slice(0, 200)); }
  }
  await ctx.close();
}
await b.close();
