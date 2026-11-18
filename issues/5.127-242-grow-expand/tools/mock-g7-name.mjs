// #242 칸 이름 3안 320 실측 비교 + 허브 카드 둘째 줄(ui-designer, 2026-11-18). 코드 수정 0.
// 운영 체험 화면의 세그먼트(report-tabs)를 복제해 안별로 세로로 쌓고, 이름·둘째 줄 글자 폭과 칸 글자 영역 폭을 잰다. 노란 작은 글자는 목업 주석(화면 요소 아님).
// node mock-g7-name.mjs <OUT>
import { readFileSync } from "node:fs";
import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PROD = "https://www.secretasset.xyz"; const OUT = process.argv[2];
const lib = readFileSync(new URL("./mock-g7-lib.js", import.meta.url), "utf8");
const br = await chromium.launch({ proxy });
for (const W of [320, 390]) {
  const ctx = await br.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(`${PROD}/?trial=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(7000);
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForSelector('[data-testid="grow-row"]', { timeout: 30000 }); await p.waitForTimeout(3000);
  await p.addScriptTag({ content: lib });
  if (process.argv[3] !== "hub") {
  const info = await p.evaluate(() => {
    const { $, H } = g7; const tabs = $('[data-testid="report-tabs"]'); const host = tabs.parentElement; const out = [];
    const SUBS = [["점검 차례 있음", '점검 차례 <span class="tabular-nums">4개</span>'], ["차례 0(최장)", '장기 보유 <span class="tabular-nums">12</span> · 점검 대상 <span class="tabular-nums">12</span>'], ["정한 것 0", '<span class="tabular-nums">12개</span> · 정하기 전']];
    const wrap = H('<div data-g7="names" style="display:flex;flex-direction:column;gap:6px"></div>');
    for (const [tag, name] of [["A", "보유 자산 점검"], ["B", "내 자산 점검"], ["C", "종목 점검"]]) for (const [st, sub] of SUBS) {
      const c = tabs.cloneNode(true); c.removeAttribute("data-testid"); const g = c.children[0]; g.children[0].textContent = name; g.children[1].innerHTML = sub;
      wrap.append(H(`<p class="g7-note">${tag} · ${st}</p>`), c); out.push({ tag, st, c });
    }
    host.replaceChildren(wrap);
    const w = (e) => { const r = document.createRange(); r.selectNodeContents(e); return Math.round(r.getBoundingClientRect().width * 10) / 10; };
    return out.map(({ tag, st, c }) => { const g = c.children[0]; const cs = getComputedStyle(g); const area = Math.round((g.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) * 10) / 10; return { tag, st, area, name: w(g.children[0]), sub: w(g.children[1]), lines: Math.round(g.children[0].getBoundingClientRect().height / 20) + Math.round(g.children[1].getBoundingClientRect().height / 16), h: Math.round(c.getBoundingClientRect().height) }; });
  });
  console.log(`NAME ${W}`, JSON.stringify(info));
  await p.evaluate(() => scrollTo(0, 0)); await p.locator('[data-g7="names"]').screenshot({ path: `${OUT}/g7-name-3way-${W}.png` });
  }
  // 허브 셋째 카드 둘째 줄 — 전 종류 합
  await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForSelector('[data-testid="hub-card-report"]', { timeout: 30000 }); await p.waitForTimeout(2500);
  if (process.argv[3] === "hub") await p.addScriptTag({ content: lib });
  const hub = await p.evaluate(() => { const c = document.querySelector('[data-testid="hub-card-report"]'); const se = c.querySelector('[data-testid="hub-report-secondary"]'); const before = se.innerHTML; const h0 = c.firstElementChild.getBoundingClientRect().height; const num = se.querySelector("span"); if (num) num.textContent = "4개"; else se.textContent = "점검 차례 4개";
    const dd = [...c.querySelectorAll("*")].find((e) => e.childElementCount === 0 && e.textContent.includes("종목 점검")); const descBefore = dd?.textContent; const cand = {};
    // spec 2-6: 사업안이 320에서 1줄이면 채택, 2줄이면 `등급과…`. 후보 전부 재서 남긴다
    for (const t of ["종합 등급과 내 자산 점검을 한곳에서", "등급과 내 자산 점검을 한곳에서", "성적표와 내 자산 점검을 한곳에서"]) { dd.textContent = t; const r = document.createRange(); r.selectNodeContents(dd); cand[t] = { w: Math.round(r.getBoundingClientRect().width * 10) / 10, area: dd.clientWidth, lines: g7.linesOf(dd).length, cardH: Math.round(c.firstElementChild.getBoundingClientRect().height) }; }
    if (cand["성적표와 내 자산 점검을 한곳에서"].lines > 1) dd.textContent = "등급과 내 자산 점검을 한곳에서";
    const prim = c.querySelector('[data-testid="hub-report-primary"]')?.textContent; const div = c.parentElement.querySelector('[data-testid="hub-card-dividend"]'); const divH = div ? Math.round(div.firstElementChild.getBoundingClientRect().height) : null;
    const sr = se.getBoundingClientRect(), cr = se.parentElement.getBoundingClientRect(); const dr = dd?.getBoundingClientRect(); return { before, descBefore, cand, prim, divH, desc: dd?.textContent, descLines: dr ? Math.round(dr.height / 20) : null, h0: Math.round(h0), h1: Math.round(c.firstElementChild.getBoundingClientRect().height), secOver: Math.round(sr.right - cr.right) }; });
  console.log(`HUB ${W}`, JSON.stringify(hub));
  await p.locator('[data-testid="hub-card-report"]').screenshot({ path: `${OUT}/g7-hub-${W}.png` });
  await ctx.close();
}
await br.close();
