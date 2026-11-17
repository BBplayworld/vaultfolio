// #239 인사이트 증분 목업 — preview(a2fb703) 화면의 실제 DOM에 문구·막대를 주입해 폭과 행 높이를 잰다. 코드 수정 0.
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const b = await chromium.launch({ proxy });
const jobs = JSON.parse(process.argv[3] ?? "[[320,\"dark\"],[360,\"dark\"],[390,\"dark\"],[430,\"dark\"],[768,\"dark\"],[1023,\"dark\"],[1024,\"dark\"],[1280,\"dark\"],[390,\"light\"]]");
for (const [W, scheme] of jobs) {
  const ctx = await b.newContext(ctxOpt(W, scheme));
  if (scheme === "light") await ctx.addCookies([{ name: "theme_mode", value: "light", domain: new URL(PV).hostname, path: "/" }]);
  const p = await ctx.newPage();
  await p.goto(`${PV}/?demo=1`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(7000);
  const tag = `${W}-${scheme}`;
  await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(3000);
  console.log(`HUB ${tag}`, JSON.stringify(await p.evaluate(() => { const s = document.querySelector('[data-testid="hub-report-secondary"]'); const card = document.querySelector('[data-testid="hub-card-report"]').firstElementChild; const h0 = Math.round(card.getBoundingClientRect().height);
    const m = (t) => { s.style.whiteSpace = "nowrap"; s.innerHTML = t; return Math.round(s.getBoundingClientRect().width); }; const avail = Math.round(s.parentElement.getBoundingClientRect().width);
    const v = (x) => `<span class="font-semibold text-foreground">${x}</span>`; const max = m(`오래 둘 자산 · 내 주식의 ${v("100.0%")}`); const dash = m(`오래 둘 자산 · ${v("—")}`); m(`오래 둘 자산 · 내 주식의 ${v("58.4%")}`);
    return { max, dash, avail, cardH0: h0, cardH: Math.round(card.getBoundingClientRect().height) }; })));
  await p.locator('[data-testid="hub-card-report"]').screenshot({ path: `${OUT}/insight-hub-card-${tag}.png` });
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(4500);
  await p.locator('[data-testid="grow-more"]').click().catch(() => {}); await p.waitForTimeout(700);
  const res = await p.evaluate(() => {
    const q = (e) => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 }; };
    const blk = document.querySelector('[data-testid="grow-block"]'); const sum = blk.querySelector('[data-testid="grow-summary"]'); const sumH0 = q(sum).h; const blkH0 = q(blk).h;
    const rows0 = Object.fromEntries([...blk.querySelectorAll('[data-testid="grow-row"]')].map((r) => [r.dataset.ticker, q(r).h]));
    // ── 무게 줄: 막대 + 범례 3묶음
    const v = (x) => `<span class="font-semibold text-foreground">${x}</span>`;
    const seg = [["오래 둘", 99, "100.0%", 58.4, 0.8], ["점검할", 99, "100.0%", 18.3, 0.45], ["정하지 않음", 99, "100.0%", 23.3, 0.15]];
    const dot = (o) => `<span aria-hidden style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:color-mix(in oklab, var(--foreground) ${o * 100}%, transparent);margin-right:6px;flex-shrink:0"></span>`;
    const item = (s, i, real) => `<span data-m="w${i}" style="white-space:nowrap;display:inline-flex;align-items:center">${dot(s[4])}${s[0]}&nbsp;${v(real ? 2 : s[1])}종목 · ${i === 0 ? "내 주식의 " : ""}${v(real ? s[3].toFixed(1) + "%" : s[2])}</span>`;
    const bar = `<div data-m="bar" style="display:flex;gap:2px;height:8px;border-radius:9999px;overflow:hidden">${seg.map((s) => `<span style="width:${s[3]}%;background:color-mix(in oklab, var(--foreground) ${s[4] * 100}%, transparent)"></span>`).join("")}</div>`;
    const cw = q(sum.parentElement).w - 32;
    const box = document.createElement("div"); box.dataset.m = "weight"; box.className = "text-sm text-muted-foreground tabular-nums";
    box.innerHTML = `${bar}<div data-m="legend" style="margin-top:8px;display:flex;flex-direction:column;align-items:flex-start;row-gap:2px;column-gap:16px">${seg.map((s, i) => item(s, i, false)).join("")}</div>`;
    sum.replaceWith(box); const legend = box.querySelector('[data-m="legend"]');
    const wMax = [0, 1, 2].map((i) => q(box.querySelector(`[data-m="w${i}"]`)).w); const stackH = q(box).h;
    legend.style.flexDirection = "row"; const inlineNeed = wMax.reduce((a, c) => a + c, 0) + 32; const inlineH = q(box).h;
    const inlineOk = inlineNeed <= q(box).w; if (!inlineOk) legend.style.flexDirection = "column";
    legend.innerHTML = seg.map((s, i) => item(s, i, true)).join("");
    // 0개 문구 높이
    const z = document.createElement("p"); z.className = "text-sm text-muted-foreground text-pretty break-keep"; z.textContent = "이름표를 붙이면 내 주식이 어떻게 나뉘는지 여기에 보여요."; box.after(z); const zeroH = q(z).h; const zeroLines = Math.round(zeroH / parseFloat(getComputedStyle(z).lineHeight)); z.remove();
    // ── 행 이름표 사실 줄: 조각 3개(사실 · 수량 · 경과)
    const P1 = { check: "마지막 점검 11년 11개월 전", keep: "오래 두기로 한 지 11년 11개월" }, QTY = "정한 날 1,234주 → 지금 12,345주", QTYF = "정한 날 1,234.568주 → 지금 12,345.679주", SAME = "정한 뒤 수량 그대로", OVER = "내가 정한 주기 12개월이 지났어요";
    const rows = [...blk.querySelectorAll('[data-testid="grow-row"]')].map((row) => {
      const lf = row.querySelector('[data-testid="grow-row-label-fact"]'); const label = row.dataset.label; if (label !== "keep" && label !== "check") return { t: row.dataset.ticker, label, h0: rows0[row.dataset.ticker], h: q(row).h };
      const over = row.dataset.overdue === "true"; const cont = q(row.querySelector('[data-testid="grow-row-open"]')).w; const fs = parseFloat(getComputedStyle(lf).fontSize);
      const piece = (t, m) => `<span data-m="${m}" style="white-space:nowrap">${t}</span>`; const sep = `<span data-m="sep" aria-hidden>·</span>`;
      lf.style.cssText = "display:flex;flex-direction:row;column-gap:6px;flex-wrap:nowrap";
      lf.innerHTML = `${piece(P1[label], "p1")}${sep}${piece(QTYF, "qf")}`; const qf = q(lf.querySelector('[data-m="qf"]')).w;
      lf.innerHTML = `<span data-m="A" style="display:flex;column-gap:6px">${piece(P1[label], "p1")}${sep}${piece(QTY, "qty")}</span>${over ? `${sep.replace("sep", "sep2")}${piece(OVER, "ov")}` : ""}`;
      const w = { p1: q(lf.querySelector('[data-m="p1"]')).w, qty: q(lf.querySelector('[data-m="qty"]')).w, ov: over ? q(lf.querySelector('[data-m="ov"]')).w : 0, qf, sepW: q(lf.querySelector('[data-m="sep"]')).w };
      const needA = w.p1 + w.qty + w.sepW + 12, needAll = needA + (over ? w.ov + w.sepW + 12 : 0), needAf = w.p1 + w.qf + w.sepW + 12, needAllF = needAf + (over ? w.ov + w.sepW + 12 : 0);
      // 폭 기준 2단: 33rem 이상 [사실 · 수량] + [경과] / 미만 조각마다 한 줄 (rem = 16px 고정)
      const mode = cont >= 33 * 16 ? "two" : "stack"; const A = lf.querySelector('[data-m="A"]'); const s2 = lf.querySelector('[data-m="sep2"]');
      if (mode !== "inline") { lf.style.flexDirection = "column"; if (s2) s2.style.display = "none"; }
      if (mode === "stack") { A.style.flexDirection = "column"; A.querySelector('[data-m="sep"]').style.display = "none"; }
      return { t: row.dataset.ticker, label, over, cont, fs, mode, w, needA: Math.round(needA), needAll: Math.round(needAll), needAf: Math.round(needAf), needAllF: Math.round(needAllF), h0: rows0[row.dataset.ticker], h: q(row).h, lfH: q(lf).h, overflow: lf.scrollWidth > Math.ceil(cont) + 1 };
    });
    return { cw, sumH0, blkH0, blkH: q(blk).h, weight: { wMax, inlineNeed: Math.round(inlineNeed), boxW: q(box).w, stackH, inlineH, inlineOk, shownH: q(box).h }, zeroH, zeroLines, rows, docW: document.documentElement.scrollWidth, vw: innerWidth };
  });
  console.log(`BLOCK ${tag}`, JSON.stringify(res));
  await p.locator('[data-testid="grow-block"]').screenshot({ path: `${OUT}/insight-block-${tag}.png` });
  if ([320, 390].includes(W)) { // InfoHint 본문 2문단(추가 1줄) 어절 끊김
    await p.evaluate(() => scrollTo(0, 0)); await p.locator('[data-testid="grow-hint"] button').click(); await p.waitForTimeout(700);
    console.log(`HINT ${tag}`, JSON.stringify(await p.evaluate(() => { const pop = [...document.querySelectorAll('[data-slot="popover-content"]')].pop(); const body = pop.querySelector("div"); const np = document.createElement("p"); np.className = "text-pretty break-keep"; np.textContent = "수량은 정한 날의 내 기록과 지금의 내 기록을 나란히 놓은 거예요. 액면분할이 있었거나 계좌를 더 등록해도 달라져요."; body.appendChild(np);
      const full = np.textContent; const t = np.firstChild; const split = []; for (const m of full.matchAll(/\S+/g)) { const rg = document.createRange(); rg.setStart(t, m.index); rg.setEnd(t, m.index + m[0].length); if (new Set([...rg.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size > 1) split.push(m[0]); }
      const r = pop.getBoundingClientRect(); return { split, popH: Math.round(r.height), bottom: Math.round(r.bottom), vh: innerHeight, paras: pop.querySelectorAll("p").length }; })));
    await p.screenshot({ path: `${OUT}/insight-hint-${tag}.png` });
  }
  await ctx.close();
}
await b.close();
