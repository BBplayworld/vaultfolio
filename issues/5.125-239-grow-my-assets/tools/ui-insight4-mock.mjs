// #239 인사이트 4종 목업 — preview(1f9578e) 실제 DOM에 4줄 행·연결 문장·도움말을 주입해 조각 폭·행 높이·첫 화면 위치를 잰다. 코드 수정 0.
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const jobs = JSON.parse(process.argv[3] ?? '[[320,"dark"],[336,"dark"],[360,"dark"],[390,"dark"],[430,"dark"],[768,"dark"],[1023,"dark"],[1024,"dark"],[1280,"dark"],[390,"light"]]');
const b = await chromium.launch({ proxy });
for (const [W, scheme] of jobs) {
  const ctx = await b.newContext(ctxOpt(W, scheme));
  if (scheme === "light") await ctx.addCookies([{ name: "theme_mode", value: "light", domain: new URL(PV).hostname, path: "/" }]);
  const p = await ctx.newPage(); await p.goto(`${PV}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(6500);
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(4500);
  for (const variant of ["typical", "long"]) {
    const res = await p.evaluate((variant) => {
      const q = (e) => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, y: Math.round(r.top + scrollY), b: Math.round(r.bottom + scrollY) }; };
      const blk = document.querySelector('[data-testid="grow-block"]'); const long = variant === "long";
      const V = (t) => `<span class="font-semibold text-foreground">${t}</span>`; const nw = (t, m) => `<span data-m="${m}" style="white-space:nowrap">${t}</span>`; const dot = (m) => `<span data-m="${m}" aria-hidden>·</span>`;
      // ── 요약: 연결 문장 2줄 (범례 아래)
      blk.querySelector("[data-mock-link]")?.remove(); const sum = blk.querySelector('[data-testid="grow-summary"]');
      const link = document.createElement("div"); link.dataset.mockLink = "1"; link.className = "text-sm text-muted-foreground"; link.style.cssText = "margin-top:8px;display:flex;flex-direction:column;row-gap:2px";
      const pc = long ? "100%" : "62%";
      link.innerHTML = `<p data-m="div" style="line-height:1.43">${nw(`올해 예상 배당의 ${V(pc)}가`, "d1")} ${nw("오래 둘 자산에서 나와요", "d2")}</p><p data-m="set" style="line-height:1.43">${nw("올해 내 주식에서", "s1")} ${nw(`불어난 돈의 ${V(pc)}가`, "s2")} ${nw("오래 둘 자산에서 나왔어요", "s3")}</p>`;
      sum.appendChild(link);
      const lines = (el) => new Set([...el.querySelectorAll("[data-m]")].map((x) => Math.round(x.getBoundingClientRect().top))).size;
      const linkM = { d: ["d1", "d2"].map((m) => q(link.querySelector(`[data-m="${m}"]`)).w), s: ["s1", "s2", "s3"].map((m) => q(link.querySelector(`[data-m="${m}"]`)).w), divLines: lines(link.querySelector('[data-m="div"]')), setLines: lines(link.querySelector('[data-m="set"]')), h: q(link).h, cont: q(sum).w };
      // ── 행: 이름표 줄(① · ③) / 정한 뒤 줄(P · Q) / 매매 줄
      const rows = [...blk.querySelectorAll('[data-testid="grow-row"]')].map((row) => { const label = row.dataset.label; const op = row.querySelector('[data-testid="grow-row-open"]'); const lf = row.querySelector('[data-testid="grow-row-label-fact"]'); const cont = q(op).w; const fs = parseFloat(getComputedStyle(lf).fontSize);
        if (label !== "keep" && label !== "check") return { t: row.dataset.ticker, label, folded: !!row.closest("[inert]"), h: q(row).h, top: q(row).y, bottom: q(row).b };
        const over = row.dataset.overdue === "true";
        const L1 = long ? (label === "check" ? "마지막 점검 11년 11개월 전" : "오래 두기로 한 지 11년 11개월") : (label === "check" ? "마지막 점검 4개월 전" : "오래 두기로 한 지 5개월");
        const OV = long ? "내가 정한 주기 12개월이 지났어요" : "내가 정한 주기 3개월이 지났어요";
        const P = `정한 날 가격 대비 ${V(long ? "+12345.6%" : "+12.0%")}`;
        const same = label === "keep"; const Q = long ? (same ? "정한 뒤 수량 그대로 11년 11개월" : null) : (same ? "정한 뒤 수량 그대로 5개월" : null);
        const QA = long ? "정한 날 1,234.568주" : "정한 날 10주", QB = long ? "→ 지금 12,345.679주" : "→ 지금 12주";
        const T = `이 앱에 기록한 매매 최근 3개월 ${V(long ? "999건" : "2건")}`;
        const m2 = cont >= 30 * 16, m3 = cont >= 33 * 16;
        const qtyHtml = Q ? nw(Q, "q") : `<span data-m="q" style="${m3 ? "white-space:nowrap" : ""}">${nw(QA, "qa")} ${nw(QB, "qb")}</span>`;
        lf.style.cssText = "display:flex;flex-direction:column;row-gap:2px;margin-top:6px";
        lf.innerHTML = `<span data-m="l2" style="display:flex;flex-direction:${m2 ? "row" : "column"};column-gap:6px">${nw(L1, "a")}${over ? `${m2 ? dot("x") : ""}${nw(OV, "ov")}` : ""}</span><span data-m="l3" style="display:flex;flex-direction:${m3 ? "row" : "column"};column-gap:6px">${nw(P, "p")}${m3 ? dot("x") : ""}${qtyHtml}</span><span data-m="l4">${nw(T, "t")}</span>`;
        const g = (m) => lf.querySelector(`[data-m="${m}"]`); const natural = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); const rs = [...rg.getClientRects()].filter((x) => x.width > 0); return { w: Math.round((Math.max(...rs.map((x) => x.right)) - Math.min(...rs.map((x) => x.left))) * 10) / 10, lines: new Set(rs.map((x) => Math.round(x.top))).size, over: Math.round((Math.max(...rs.map((x) => x.right)) - op.getBoundingClientRect().right) * 10) / 10 }; };
        const w = { a: q(g("a")).w, ov: over ? q(g("ov")).w : 0, p: q(g("p")).w, q: Q ? q(g("q")).w : null, qa: Q ? null : q(g("qa")).w, qb: Q ? null : q(g("qb")).w, t: q(g("t")).w };
        const qn = natural(g("q"));
        return { t: row.dataset.ticker, label, over, same, folded: !!row.closest("[inert]"), cont, fs, m2, m3, w, need2: over ? Math.round(w.a + w.ov + 16) : Math.round(w.a), need3: Math.round(w.p + (Q ? w.q : w.qa + w.qb + 4) + 16), qLines: qn.lines, qOver: qn.over, lfH: q(lf).h, h: q(row).h, top: q(row).y, bottom: q(row).b, lineBottoms: ["l2", "l3", "l4"].map((m) => q(g(m)).b) }; });
      const sec = document.querySelector('[data-testid="report-section-title"]'); const cyc = blk.querySelector('[data-testid="grow-cycle"]');
      return { variant, vh: innerHeight, blockTop: q(blk).y, sumBottom: q(sum).b, legendBottom: q(sum.querySelector("ul")).b, link: linkM, cycleBottom: q(cyc).b, rows, sectionY: sec ? q(sec).y : null, docW: document.documentElement.scrollWidth, vw: innerWidth };
    }, variant);
    console.log(`BLOCK ${W}-${scheme} ${variant}`, JSON.stringify(res));
    await p.screenshot({ path: `${OUT}/insight4-${variant}-${W}-${scheme}.png`, fullPage: false });
    if (variant === "typical") await p.locator('[data-testid="grow-block"]').screenshot({ path: `${OUT}/insight4-block-${W}-${scheme}.png` });
    if (variant === "long") await p.locator('[data-testid="grow-block"]').screenshot({ path: `${OUT}/insight4-block-long-${W}-${scheme}.png` });
  }
  if ([320, 390, 1280].includes(W) && scheme === "dark") { // 도움말 3문단(블록 제목 옆) — 화면 제목 도움말 팝오버를 빌려 내용만 바꿔 잰다
    await p.evaluate(() => scrollTo(0, 0)); await p.locator('[data-testid="grow-hint"] button').click(); await p.waitForTimeout(700);
    console.log(`HINT ${W}`, JSON.stringify(await p.evaluate(() => { const pop = [...document.querySelectorAll('[data-slot="popover-content"]')].pop(); const ps = pop.querySelectorAll("p"); ps[0].textContent = "정한 날의 내 기록과 지금의 내 기록을 나란히 보여 줘요."; const body = ps[1].parentElement; body.innerHTML = ["정한 날은 지금 이름표를 붙인 날이에요. 가격과 수량은 그날의 내 기록과 지금의 내 기록을 나란히 놓은 거예요. 액면분할이 있었거나 계좌를 더 등록해도 달라져요.", "매매 건수는 이 앱의 거래 기록에 남긴 것만 세요. 보유 수량을 직접 고치거나 스크린샷으로 맞춘 변화는 건수에 들어가지 않아요.", "배당은 올해 지급된 배당과 예상 배당을 합친 값이고, 불어난 돈은 지금 가진 수량과 올해 첫 가격으로 계산해요. 올해 결산의 금액과 다를 수 있어요."].map((t) => `<p class="text-pretty break-keep">${t}</p>`).join("");
      const split = []; pop.querySelectorAll("p").forEach((el) => { const t = el.firstChild, full = el.textContent; for (const m of full.matchAll(/\S+/g)) { const rg = document.createRange(); rg.setStart(t, m.index); rg.setEnd(t, m.index + m[0].length); if (new Set([...rg.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size > 1) split.push(m[0]); } });
      const r = pop.getBoundingClientRect(); return { split, box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], vh: innerHeight, scroll: pop.scrollHeight > pop.clientHeight + 1 }; })));
    await p.screenshot({ path: `${OUT}/insight4-hint-${W}-dark.png` });
  }
  await ctx.close();
}
await b.close();
