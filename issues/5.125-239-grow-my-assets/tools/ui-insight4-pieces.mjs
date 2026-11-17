// #239 인사이트 4종 — nowrap 조각별 자연 폭(14·15·16px)과 결산 문장 꼬리 포함 줄 수 실측(C130 표). 코드 수정 0.
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const b = await chromium.launch({ proxy });
for (const W of [320, 360, 390, 430, 768, 1024, 1280]) {
  const ctx = await b.newContext(ctxOpt(W, "dark")); const p = await ctx.newPage(); await p.goto(`${PV}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(6500);
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(4500);
  console.log(`PIECES ${W}`, JSON.stringify(await p.evaluate(() => { const blk = document.querySelector('[data-testid="grow-block"]'); const sum = blk.querySelector('[data-testid="grow-summary"]'); const V = (t) => `<span class="font-semibold text-foreground">${t}</span>`;
    const probe = document.createElement("div"); probe.className = "text-sm text-muted-foreground tabular-nums"; probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap"; blk.appendChild(probe);
    const m = (html) => { probe.innerHTML = `<span>${html}</span>`; return Math.round(probe.firstChild.getBoundingClientRect().width * 10) / 10; };
    const pieces = { "이름표 ① 오래 두기로 한 지 11년 11개월": m("오래 두기로 한 지 11년 11개월"), "이름표 ① 마지막 점검 11년 11개월 전": m("마지막 점검 11년 11개월 전"), "이름표 ③ 내가 정한 주기 12개월이 지났어요": m("내가 정한 주기 12개월이 지났어요"), "가격 정한 날 가격 대비 +12345.6%": m(`정한 날 가격 대비 ${V("+12345.6%")}`), "수량 같음 정한 뒤 수량 그대로 11년 11개월": m("정한 뒤 수량 그대로 11년 11개월"), "수량 앞 정한 날 1,234.568주": m("정한 날 1,234.568주"), "수량 뒤 → 지금 12,345.679주": m("→ 지금 12,345.679주"), "매매 이 앱에 기록한 매매 최근 3개월 999건": m(`이 앱에 기록한 매매 최근 3개월 ${V("999건")}`), "배당 앞 올해 예상 배당 중": m("올해 예상 배당 중"), "몫 오래 둘 자산 몫은 100%예요": m(`오래 둘 자산 몫은 ${V("100%")}예요`), "결산 앞 올해 내 주식에서 불어난 돈 중": m("올해 내 주식에서 불어난 돈 중"), "꼬리 (기준 가격이 없는 99종목 제외)": m("(기준 가격이 없는 99종목 제외)"), "섞임 앞 올해는 불어난 쪽과 줄어든 쪽이 섞여 있어": m("올해는 불어난 쪽과 줄어든 쪽이 섞여 있어"), "섞임 뒤 몫을 비율로 나타내지 않아요": m("몫을 비율로 나타내지 않아요") };
    const fs = getComputedStyle(probe).fontSize; probe.remove();
    const box = document.createElement("div"); box.className = "text-sm text-muted-foreground"; box.style.cssText = "margin-top:8px;display:flex;flex-direction:column;row-gap:2px"; sum.appendChild(box); const nw = (t) => `<span data-m style="white-space:nowrap">${t}</span>`;
    const mk = (parts) => { const el = document.createElement("p"); el.style.lineHeight = "1.43"; el.innerHTML = parts.map(nw).join(" "); box.appendChild(el); return { lines: new Set([...el.querySelectorAll("[data-m]")].map((x) => Math.round(x.getBoundingClientRect().top))).size, h: Math.round(el.getBoundingClientRect().height) }; };
    const div = mk(["올해 예상 배당 중", `오래 둘 자산 몫은 ${V("100%")}예요`]); const set = mk(["올해 내 주식에서 불어난 돈 중", `오래 둘 자산 몫은 ${V("100%")}예요`, "(기준 가격이 없는 99종목 제외)"]);
    const mixEl = document.createElement("p"); mixEl.className = "text-pretty break-keep"; mixEl.style.lineHeight = "1.43"; mixEl.textContent = "올해는 불어난 쪽과 줄어든 쪽이 섞여 있어 몫을 비율로 나타내지 않아요 (기준 가격이 없는 99종목 제외)"; box.appendChild(mixEl); const mixH = Math.round(mixEl.getBoundingClientRect().height); mixEl.remove();
    return { fs, cont: Math.round(sum.getBoundingClientRect().width), rowCont: Math.round(blk.querySelector('[data-testid="grow-row-open"]').getBoundingClientRect().width), pieces, div, set, mixLines: Math.round(mixH / 20), boxH: Math.round(box.getBoundingClientRect().height) }; })));
  await p.locator('[data-testid="grow-summary"]').screenshot({ path: `${OUT}/insight4-tail-summary-${W}-dark.png` }); await ctx.close(); }
await b.close();
