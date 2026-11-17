// #239 인사이트 4종 ui-review(ed23590) — preview 실측. 코드 수정 0. node ui-review-insight4.mjs <OUT> <mode>
// mode: widths | long | settle | hint | first | trial | whatsnew | hub
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2]; const MODE = process.argv[3] ?? "widths";
const b = await chromium.launch({ proxy });
const log = (k, v) => console.log(k, typeof v === "string" ? v : JSON.stringify(v));
const ALL = [[320, "dark"], [336, "dark"], [360, "dark"], [390, "dark"], [430, "dark"], [768, "dark"], [1023, "dark"], [1024, "dark"], [1280, "dark"], [390, "light"]];
async function open(W, scheme = "dark", q = "demo=1", H) { const o = ctxOpt(W, scheme); if (H) o.viewport.height = H; const ctx = await b.newContext(o);
  if (scheme === "light") await ctx.addCookies([{ name: "theme_mode", value: "light", domain: new URL(PV).hostname, path: "/" }]);
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", (e) => p.errs.push(e.message));
  await p.goto(`${PV}/?${q}&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(7000); return { ctx, p }; }
async function report(p) { await p.evaluate(() => { location.hash = "#activity/report"; });
  for (let i = 0; i < 25; i++) { await p.waitForTimeout(2000); if (await p.locator('[data-testid="grow-block"]').count() && !(await p.locator('[data-testid="grow-link-skeleton"]').count())) break; }
  await p.waitForTimeout(1200); }
async function expand(p) { const m = p.locator('[data-testid="grow-more"]'); if (await m.count() && (await m.getAttribute("aria-expanded")) === "false") { await m.click(); await p.waitForTimeout(700); } }
const shot = (p, n, sel) => (sel ? p.locator(sel).screenshot({ path: `${OUT}/i4-${n}.png` }) : p.screenshot({ path: `${OUT}/i4-${n}.png` })).catch((e) => console.log("shot", n, e.message));

// 블록 측정: 행 4줄 간격·굵기·색, nowrap 조각 Range 오른쪽 끝, 연결 문장 줄 수, 히트영역
const measure = (p) => p.evaluate(() => {
  const R = (x) => Math.round(x * 10) / 10; const box = (e) => e.getBoundingClientRect();
  const rng = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); const rs = [...rg.getClientRects()].filter((x) => x.width > 0); if (!rs.length) return null; return { right: Math.max(...rs.map((x) => x.right)), left: Math.min(...rs.map((x) => x.left)), lines: new Set(rs.map((x) => Math.round(x.top))).size }; };
  const fg = getComputedStyle(document.body).color; const bad = /(rose|blue|orange|red-|amber|important|profit|loss)/;
  const blk = document.querySelector('[data-testid="grow-block"]'); if (!blk) return null;
  const rows = [...blk.querySelectorAll('[data-testid="grow-row"]')].map((row) => {
    const t = (id) => row.querySelector(`[data-testid="${id}"]`); const op = t("grow-row-open"); const area = box(op);
    const fact = t("grow-row-fact"), lf = t("grow-row-label-fact"), since = t("grow-row-since"), tr = t("grow-row-trades"), price = t("grow-row-price"), qty = t("grow-row-qty");
    const lfFirst = lf?.firstElementChild;
    const gap = (a, c) => (a && c ? R(box(c).top - box(a).bottom) : null);
    const pieces = [...op.querySelectorAll(".whitespace-nowrap")].filter((e) => getComputedStyle(e).whiteSpace === "nowrap" && box(e).height > 0).map((e) => { const r = rng(e); return { txt: e.textContent.trim().slice(0, 40), over: r ? R(r.right - area.right) : null, lines: r?.lines }; });
    const sizes = [fact, lf, since, tr].filter(Boolean).map((e) => getComputedStyle(e).fontSize);
    const pv = price?.querySelector("span");
    const qtyBold = qty ? [qty, ...qty.querySelectorAll("*")].some((e) => +getComputedStyle(e).fontWeight >= 600) : null;
    const trBold = tr ? [...tr.querySelectorAll("*")].filter((e) => +getComputedStyle(e).fontWeight >= 600).map((e) => e.textContent) : null;
    const cls = [...row.querySelectorAll("[class]")].map((e) => e.getAttribute("class")).join(" ");
    return { t: row.dataset.ticker, l: row.dataset.label, ov: row.dataset.overdue, folded: !!row.closest("[inert]"), h: R(box(row).height), opH: R(area.height), w: R(area.width),
      lf: lf?.innerText.replace(/\n/g, " / "), since: since?.innerText.replace(/\n/g, " / ") ?? null, trades: tr?.innerText ?? null,
      g12: gap(fact, lfFirst), g23: gap(lf, since), g34: gap(since ?? lf, tr), sizes: [...new Set(sizes)],
      priceIsFg: pv ? getComputedStyle(pv).color === fg : null, priceState: price?.dataset.state ?? null, qtyBold, trBold, badCls: bad.test(cls),
      sinceLines: since ? rng(since)?.lines : null, maxOver: pieces.length ? Math.max(...pieces.map((x) => x.over ?? -999)) : null, pieces };
  });
  const link = blk.querySelector('[data-testid="grow-link"]');
  const links = link ? [...link.children].map((li) => { const r = rng(li); const ar = box(link); const pcs = [...li.querySelectorAll(".whitespace-nowrap")].map((e) => ({ txt: e.textContent, lines: rng(e)?.lines, over: R(rng(e).right - ar.right) })); return { id: li.dataset.testid, state: li.dataset.state, pct: li.dataset.pct, ex: li.dataset.excluded, txt: li.innerText.replace(/\s+/g, " "), lines: r?.lines, h: R(box(li).height), pcs, color: getComputedStyle(li).color, boldColorFg: [...li.querySelectorAll(".font-semibold")].every((e) => getComputedStyle(e).color === fg) }; }) : null;
  const hit = (sel) => [...blk.querySelectorAll(sel)].filter((e) => box(e).height > 0 && !e.closest("[inert]")).map((e) => [R(box(e).width), R(box(e).height)]);
  const minHit = (sel) => { const a = hit(sel); return a.length ? [Math.min(...a.map((x) => x[0])), Math.min(...a.map((x) => x[1]))] : null; };
  const hintBtn = blk.querySelector('[data-testid="grow-block-hint"] button');
  return { vw: innerWidth, docW: document.documentElement.scrollWidth, blkY: Math.round(box(blk).top + scrollY), linkH: link ? R(box(link).height) : null, links,
    hit: { open: minHit('[data-testid="grow-row-open"]'), label: minHit('[data-testid="grow-label"] button'), cycle: minHit('[data-testid="grow-cycle"] button'), check: minHit('[data-testid="grow-check"]'), more: minHit('[data-testid="grow-more"]'), hint: hintBtn ? [R(box(hintBtn).width), R(box(hintBtn).height)] : null },
    rows };
});

if (MODE === "widths") for (const [W, scheme] of ALL) {
  const { ctx, p } = await open(W, scheme); await report(p); await expand(p);
  const m = await measure(p); log(`W ${W} ${scheme}`, { ...m, rows: m.rows.map(({ pieces, ...r }) => r) }); log(`ERR ${W} ${scheme}`, p.errs);
  await shot(p, `block-${W}-${scheme}`, '[data-testid="grow-block"]'); await ctx.close();
}

// 최장 값 주입(실제 DOM의 실제 클래스에 글자만 바꿈)
if (MODE === "long") for (const [W, scheme] of [[320, "dark"], [336, "dark"], [360, "dark"], [390, "dark"], [768, "dark"], [1024, "dark"], [1280, "dark"]]) {
  const { ctx, p } = await open(W, scheme); await report(p); await expand(p);
  await p.evaluate(() => {
    for (const row of document.querySelectorAll('[data-testid="grow-row"]')) {
      if (row.dataset.label !== "keep" && row.dataset.label !== "check") continue;
      const t = (id) => row.querySelector(`[data-testid="${id}"]`);
      const lf = t("grow-row-label-fact"); lf.firstElementChild.textContent = row.dataset.label === "keep" ? "오래 두기로 한 지 11년 11개월" : "마지막 점검 11년 11개월 전";
      const ov = t("grow-row-overdue"); if (ov) ov.textContent = "내가 정한 주기 12개월이 지났어요";
      const pv = t("grow-row-price")?.querySelector("span"); if (pv) pv.textContent = "+12345.6%";
      const q = t("grow-row-qty"); if (q) { const kids = q.querySelectorAll(":scope > span"); if (kids.length === 2) { kids[0].textContent = "정한 날 1,234.568주"; kids[1].textContent = "→ 지금 12,345.679주"; } else if (kids.length === 1) kids[0].textContent = "정한 뒤 수량 그대로 11년 11개월"; }
      const tr = t("grow-row-trades")?.querySelector("span"); if (tr) tr.textContent = "999건";
    }
  });
  await p.waitForTimeout(300);
  const m = await measure(p); log(`LONG ${W}`, m.rows.filter((r) => r.l === "keep" || r.l === "check").map((r) => ({ t: r.t, l: r.l, ov: r.ov, h: r.h, sinceLines: r.sinceLines, maxOver: r.maxOver, worst: r.pieces.sort((a, b) => b.over - a.over).slice(0, 2) })));
  await shot(p, `long-block-${W}-${scheme}`, '[data-testid="grow-block"]'); await ctx.close();
}

// 결산 3갈래·꼬리 주입 — 코드와 같은 클래스(whitespace-nowrap 조각, 공백은 조각 밖, 섞임은 text-pretty break-keep)
if (MODE === "settle") for (const [W, scheme] of ALL) {
  const { ctx, p } = await open(W, scheme); await report(p);
  for (const v of ["up", "down", "mixed", "up-tail", "down-tail", "mixed-tail"]) {
    const ok = await p.evaluate((v) => {
      const li = document.querySelector('[data-testid="grow-link-settle"]'); if (!li) return false;
      const N = (t) => `<span class="whitespace-nowrap">${t}</span>`; const B = (t) => `<span class="font-semibold text-foreground">${t}</span>`;
      const kind = v.split("-")[0], tail = v.endsWith("tail");
      const head = kind === "mixed" ? `<span class="text-pretty break-keep">올해는 불어난 쪽과 줄어든 쪽이 섞여 있어 몫을 비율로 나타내지 않아요</span>` : `${N(kind === "up" ? "올해 내 주식에서 불어난 돈 중" : "올해 내 주식에서 줄어든 돈 중")} ${N(`오래 둘 자산 몫은 ${B("100%")}예요`)}`;
      li.innerHTML = head + (tail ? ` ${N("(기준 가격이 없는 99종목 제외)")}` : ""); li.dataset.state = kind; return true; }, v);
    if (!ok) { log(`SETTLE ${W} ${scheme}`, "결산 줄 없음"); break; }
    const m = await measure(p); log(`SETTLE ${W} ${scheme} ${v}`, { linkH: m.linkH, links: m.links.map((l) => ({ id: l.id, lines: l.lines, h: l.h, pcs: l.pcs })) });
    if ([320, 390, 1280].includes(W) || scheme === "light") await shot(p, `settle-${v}-${W}-${scheme}`, '[data-testid="grow-summary"] + [data-testid="grow-link"], [data-testid="grow-link"]');
    if (v === "mixed-tail" && W === 320) { // 섞임 문장 어절 끊김
      log("SPLIT320", await p.evaluate(() => { const el = document.querySelector('[data-testid="grow-link-settle"] .break-keep'); const t = el.firstChild, s = []; for (const m of t.textContent.matchAll(/\S+/g)) { const rg = document.createRange(); rg.setStart(t, m.index); rg.setEnd(t, m.index + m[0].length); if (new Set([...rg.getClientRects()].map((x) => Math.round(x.top))).size > 1) s.push(m[0]); } return s; }));
    }
  }
  await ctx.close();
}

// 블록 도움말: 320×844, 390×600, 390×844, 1280
if (MODE === "hint") for (const [W, H, scheme] of [[320, 844, "dark"], [390, 600, "dark"], [390, 844, "dark"], [390, 844, "light"], [1280, 900, "dark"]]) {
  const { ctx, p } = await open(W, scheme, "demo=1", H); await report(p);
  await p.locator('[data-testid="grow-block-hint"] button').scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  await p.locator('[data-testid="grow-block-hint"] button').click(); await p.waitForTimeout(800);
  log(`HINT ${W}x${H} ${scheme}`, await p.evaluate(() => { const pop = [...document.querySelectorAll('[data-slot="popover-content"]')].pop(); if (!pop) return null;
    const split = []; pop.querySelectorAll("p").forEach((el) => { const t = el.firstChild; if (!t || t.nodeType !== 3) return; for (const m of el.textContent.matchAll(/\S+/g)) { const rg = document.createRange(); rg.setStart(t, m.index); rg.setEnd(t, m.index + m[0].length); if (new Set([...rg.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size > 1) split.push(m[0]); } });
    const r = pop.getBoundingClientRect(); const ps = [...pop.querySelectorAll("p")].map((e) => ({ wb: getComputedStyle(e).wordBreak, lines: Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)) }));
    return { split, box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], bottom: Math.round(r.bottom), vh: innerHeight, vw: innerWidth, scrollable: pop.scrollHeight > pop.clientHeight + 1, overflowY: getComputedStyle(pop).overflowY, maxH: getComputedStyle(pop).maxHeight, ps, text: pop.innerText.slice(0, 60) }; }));
  await shot(p, `hint-${W}x${H}-${scheme}`);
  // 화면 제목 도움말 문단 수
  await p.keyboard.press("Escape"); await p.waitForTimeout(400); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
  const th = p.locator('[data-testid="grow-hint"] button'); if (await th.count()) { await th.click(); await p.waitForTimeout(700); log(`TITLEHINT ${W}`, await p.evaluate(() => { const pop = [...document.querySelectorAll('[data-slot="popover-content"]')].pop(); return pop ? { ps: pop.querySelectorAll("p").length, text: pop.innerText.replace(/\n+/g, " / ") } : null; })); }
  await ctx.close();
}

// 첫 화면 390×844(조작 없음) · 1280×900
if (MODE === "first") for (const [W, scheme] of [[390, "dark"], [390, "light"], [1280, "dark"]]) {
  const { ctx, p } = await open(W, scheme); await report(p); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500);
  log(`FIRST ${W} ${scheme}`, await p.evaluate(() => { const y = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().bottom + scrollY) : null; }; const blk = document.querySelector('[data-testid="grow-block"]');
    const rows = [...blk.querySelectorAll('[data-testid="grow-row"]')].slice(0, 3).map((r) => ({ t: r.dataset.ticker, l: r.dataset.label, lf: Math.round(r.querySelector('[data-testid="grow-row-label-fact"]').getBoundingClientRect().bottom), since: r.querySelector('[data-testid="grow-row-since"]') ? Math.round(r.querySelector('[data-testid="grow-row-since"]').getBoundingClientRect().bottom) : null, trades: r.querySelector('[data-testid="grow-row-trades"]') ? Math.round(r.querySelector('[data-testid="grow-row-trades"]').getBoundingClientRect().bottom) : null, bottom: Math.round(r.getBoundingClientRect().bottom) }));
    return { vh: innerHeight, title: y('[data-testid="grow-title"]'), summary: y('[data-testid="grow-summary"]'), link: y('[data-testid="grow-link"]'), cycle: y('[data-testid="grow-cycle"]'), caption: y('[data-testid="grow-cycle-caption"]'), rows, section: (() => { const e = document.querySelector('[data-testid="report-section-title"]'); return e ? Math.round(e.getBoundingClientRect().top) : null; })() }; }));
  await shot(p, `first-${W}-${scheme}`); await ctx.close();
}

// 허브 카드 높이(배당 카드와 같은지) — 데모 320·390·1024·1280
if (MODE === "hub") for (const [W, scheme] of [[320, "dark"], [390, "dark"], [1024, "dark"], [1280, "dark"], [390, "light"]]) {
  const { ctx, p } = await open(W, scheme); await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(4000);
  log(`HUB ${W} ${scheme}`, await p.evaluate(() => { const h = (id) => { const e = document.querySelector(`[data-testid="${id}"]`); return e ? Math.round(e.firstElementChild.getBoundingClientRect().height * 10) / 10 : null; }; const s = document.querySelector('[data-testid="hub-report-secondary"]'); return { report: h("hub-card-report"), dividend: h("hub-card-dividend"), sec: s?.innerText ?? null }; }));
  await shot(p, `hub-${W}-${scheme}`); await ctx.close();
}

// 체험
if (MODE === "trial") for (const [W, scheme] of [[320, "dark"], [390, "dark"], [390, "light"], [1280, "dark"]]) {
  const { ctx, p } = await open(W, scheme, "trial=1"); await report(p); await expand(p);
  const m = await measure(p); log(`TRIAL ${W} ${scheme}`, m ? { linkH: m.linkH, links: m.links, hit: m.hit, rows: m.rows.map(({ pieces, ...r }) => r) } : null); log(`ERR ${W}`, p.errs);
  await shot(p, `trial-block-${W}-${scheme}`, '[data-testid="grow-block"]'); await ctx.close();
}

// 새 소식
if (MODE === "whatsnew") for (const [W, scheme] of [[320, "dark"], [390, "dark"], [390, "light"], [1280, "dark"]]) {
  const { ctx, p } = await open(W, scheme); await p.evaluate(() => window.dispatchEvent(new CustomEvent("open-whats-new", { detail: { source: "more" } }))); await p.waitForTimeout(1500);
  log(`WHATSNEW ${W} ${scheme}`, await p.evaluate(() => { const it = document.querySelector('[data-testid="whats-new-item"]'); if (!it) return null; const ps = [...it.querySelectorAll("p")].map((e) => ({ t: e.innerText, lines: Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)) })); return { text: it.innerText.replace(/\n/g, " / "), ps }; }));
  await shot(p, `whatsnew-${W}-${scheme}`); await ctx.close();
}
// 상태(390 다크): 당일·base 없음·base.price 없음·지금 시세 없음·'점검할'만·정하지 않음·스켈레톤
if (MODE === "states") {
  const LK = "secretasset.stock_labels", AK = "secretasset_asset_data";
  const rowsOf = (p) => p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row"]')].filter((r) => !r.closest("[inert]")).map((r) => { const t = (id) => r.querySelector(`[data-testid="${id}"]`); const since = t("grow-row-since"); return { t: r.dataset.ticker, l: r.dataset.label, h: Math.round(r.getBoundingClientRect().height), lf: t("grow-row-label-fact")?.innerText.replace(/\n/g, " / "), since: since ? since.innerText.replace(/\n/g, " / ") : null, price: t("grow-row-price")?.dataset.state ?? null, qty: t("grow-row-qty")?.dataset.state ?? null, dots: since ? since.querySelectorAll('[aria-hidden]').length : 0, trades: t("grow-row-trades")?.innerText ?? null, wrapOpen: getComputedStyle(t("grow-row-label-fact").parentElement.parentElement).gridTemplateRows }; }));
  const links = (p) => p.evaluate(() => { const l = document.querySelector('[data-testid="grow-link"]'); return l ? [...l.children].map((x) => `${x.dataset.testid}:${x.innerText.replace(/\s+/g, " ")}`) : null; });
  const run = async (name, seed, after) => { const { ctx, p } = await open(390); if (seed) { await p.evaluate(seed, { LK, AK }); await p.reload({ waitUntil: "networkidle" }).catch(() => {}); await p.waitForTimeout(6000); }
    await report(p); await expand(p); log(`${name}`, { links: await links(p), rows: await rowsOf(p) }); await shot(p, `state-${name}-390-dark`, '[data-testid="grow-block"]'); if (after) await after(p); log(`${name} ERR`, p.errs); await ctx.close(); };
  await run("demo", null, async (p) => {
    await p.locator('[data-testid="grow-row"][data-ticker="069500"] [data-testid="grow-label-keep"]').click(); await p.waitForTimeout(700);
    log("당일", { links: await links(p), row: (await rowsOf(p)).find((r) => r.t === "069500") }); await shot(p, "state-sameday-390-dark", '[data-testid="grow-block"]');
    await p.locator('[data-testid="grow-row"][data-ticker="005930"] [data-testid="grow-label-none"]').click(); await p.waitForTimeout(700);
    log("정하지 않음", { row: (await rowsOf(p)).find((r) => r.t === "005930") }); await shot(p, "state-none-390-dark", '[data-testid="grow-block"]'); });
  await run("nobase", ({ LK }) => { const l = JSON.parse(localStorage.getItem(LK)); delete l.items.AAPL.base; delete l.items["005930"].base.price; localStorage.setItem(LK, JSON.stringify(l)); });
  await run("nocurprice", ({ LK, AK }) => { const a = JSON.parse(localStorage.getItem(AK)); a.stocks.push({ id: "seed_noprice", category: "domestic", name: "시세없는종목", ticker: "ZZ9999", quantity: 10, averagePrice: 1000, currentPrice: 0, currency: "KRW", purchaseDate: "2025-03-02", broker: "데모증권" }); localStorage.setItem(AK, JSON.stringify(a)); const l = JSON.parse(localStorage.getItem(LK)); const at = l.items["005930"].labeledAt; l.items.ZZ9999 = { label: "keep", labeledAt: at, base: { qty: 10, price: 1000, priceAt: at, weight: 1 }, at }; localStorage.setItem(LK, JSON.stringify(l)); });
  await run("checkonly", ({ LK }) => { const l = JSON.parse(localStorage.getItem(LK)); for (const k of ["360750", "005930"]) l.items[k] = { label: null, at: new Date().toISOString() }; localStorage.setItem(LK, JSON.stringify(l)); });
  // 스켈레톤: 진입 직후 연속 캡처
  { const { ctx, p } = await open(390); await p.evaluate(() => { location.hash = "#activity/report"; });
    for (let i = 0; i < 12; i++) { await p.waitForTimeout(250); const r = await p.evaluate(() => { const s = [...document.querySelectorAll('[data-testid="grow-link-skeleton"]')]; return s.length ? s.map((x) => Math.round(x.getBoundingClientRect().height * 10) / 10) : null; }); if (r) { log("SKELETON", r); await shot(p, "state-skeleton-390-dark", '[data-testid="grow-summary"] ~ [data-testid="grow-link"], [data-testid="grow-link"]'); break; } }
    await report(p); log("AFTER", await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-link"] > li')].map((x) => Math.round(x.getBoundingClientRect().height)))); await ctx.close(); }
}
await b.close();
