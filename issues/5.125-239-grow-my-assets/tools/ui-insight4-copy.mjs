// #239 인사이트 4종 — cto 판정 문구(몫은 N%예요, 결산 3갈래, 도움말 4문장)의 조각 폭·줄 수 실측. 코드 수정 0.
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const b = await chromium.launch({ proxy });
for (const W of [320, 336, 360, 390, 430, 768, 1024, 1280]) {
  const ctx = await b.newContext(ctxOpt(W, "dark")); const p = await ctx.newPage(); await p.goto(`${PV}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(6500);
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(4500);
  console.log(`COPY ${W}`, JSON.stringify(await p.evaluate(() => { const q = (e) => Math.round(e.getBoundingClientRect().width * 10) / 10; const blk = document.querySelector('[data-testid="grow-block"]'); const sum = blk.querySelector('[data-testid="grow-summary"]');
    const V = (t) => `<span class="font-semibold text-foreground">${t}</span>`; const nw = (t, m) => `<span data-m="${m}" style="white-space:nowrap">${t}</span>`;
    const S = { div: [`올해 예상 배당 중`, `오래 둘 자산 몫은 ${V("100%")}예요`], up: [`올해 내 주식에서 불어난 돈 중`, `오래 둘 자산 몫은 ${V("100%")}예요`], down: [`올해 내 주식에서 줄어든 돈 중`, `오래 둘 자산 몫은 ${V("100%")}예요`], mix: [`올해는 불어난 쪽과 줄어든 쪽이 섞여 있어`, `몫을 비율로 나타내지 않아요`] };
    const box = document.createElement("div"); box.className = "text-sm text-muted-foreground"; box.style.cssText = "margin-top:8px;display:flex;flex-direction:column;row-gap:2px"; sum.appendChild(box);
    const out = { cont: q(sum), fs: getComputedStyle(box).fontSize };
    for (const [k, parts] of Object.entries(S)) { const el = document.createElement("p"); el.style.lineHeight = "1.43"; el.innerHTML = parts.map((t, i) => nw(t, `${k}${i}`)).join(" "); box.appendChild(el); const ws = parts.map((_, i) => q(el.querySelector(`[data-m="${k}${i}"]`))); out[k] = { w: ws, one: Math.round(ws[0] + ws[1] + 4), lines: new Set([...el.querySelectorAll("[data-m]")].map((x) => Math.round(x.getBoundingClientRect().top))).size, h: Math.round(el.getBoundingClientRect().height) }; }
    // 실제로 보일 조합(배당 + 결산 1개)만 남기고 캡처
    box.children[2].remove(); box.children[2].remove(); out.shownH = Math.round(box.getBoundingClientRect().height); return out; })));
  await p.locator('[data-testid="grow-summary"]').screenshot({ path: `${OUT}/insight4-copy-summary-${W}-dark.png` });
  if ([320, 390, 1280].includes(W)) { await p.evaluate(() => scrollTo(0, 0)); await p.locator('[data-testid="grow-hint"] button').click(); await p.waitForTimeout(700);
    console.log(`HINT ${W}`, JSON.stringify(await p.evaluate(() => { const pop = [...document.querySelectorAll('[data-slot="popover-content"]')].pop(); const ps = pop.querySelectorAll("p"); ps[0].textContent = "정한 날의 내 기록과 지금의 내 기록을 나란히 보여 줘요."; const body = ps[1].parentElement;
      body.innerHTML = ["정한 날은 지금 이름표를 붙인 날이에요. 가격과 수량은 그날의 내 기록과 지금의 내 기록을 나란히 놓은 거예요. 액면분할이 있었거나 계좌를 더 등록해도 달라져요.", "매매 건수는 이 앱의 거래 기록에 남긴 것만 세요. 보유 수량을 직접 고치거나 스크린샷으로 맞춘 변화는 건수에 들어가지 않아요.", "배당은 올해 지급된 배당과 예상 배당을 합친 값이에요. 불어난 돈은 지금 가진 수량에 작년 마지막 가격부터의 변화를 곱한 값이에요. 올해 산 종목은 내 매입가부터 계산해요. 그사이 사고판 것은 반영하지 않아 올해 결산의 금액과 다를 수 있어요."].map((t) => `<p class="text-pretty break-keep">${t}</p>`).join("");
      const split = []; pop.querySelectorAll("p").forEach((el) => { const t = el.firstChild, full = el.textContent; for (const m of full.matchAll(/\S+/g)) { const rg = document.createRange(); rg.setStart(t, m.index); rg.setEnd(t, m.index + m[0].length); if (new Set([...rg.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size > 1) split.push(m[0]); } });
      const r = pop.getBoundingClientRect(); return { split, box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], bottom: Math.round(r.bottom), vh: innerHeight, paraLines: [...pop.querySelectorAll("p")].map((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight))) }; })));
    await p.screenshot({ path: `${OUT}/insight4-copy-hint-${W}-dark.png` }); }
  await ctx.close(); }
await b.close();
