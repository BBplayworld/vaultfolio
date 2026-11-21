// #261 UI 목업: HTML 목업 → Playwright 스크린샷. 실행: NODE_PATH=/root/node-tools/node_modules node mock-261.js
// 글꼴은 샌드박스 한글 폰트(WenQuanYi)라 실제 Pretendard보다 글자 폭이 같거나 넓다(보수적 측정).
const { chromium } = require("playwright");
const path = require("path");
const OUT = path.join(__dirname, "..", "screenshots");

const TOKENS = {
  light: { bg: "oklch(0.96 0.004 250)", fg: "oklch(0.136 0.0097 18)", card: "oklch(1 0 0)", mf: "oklch(0.45 0 0)", border: "oklch(0.91 0 0)", primary: "oklch(0.585 0.233 277)", ring: "oklch(0.7 0 0 / .5)" },
  dark: { bg: "oklch(0.16 0.010 265)", fg: "oklch(0.965 0.004 265)", card: "oklch(0.225 0.012 265)", mf: "oklch(0.74 0.016 265)", border: "oklch(1 0 0 / 10%)", primary: "oklch(0.704 0.040 256.788)", ring: "oklch(0.7 0 0 / .5)" },
};
const LINKS = [["year-end", "올해 자산 결산"], ["net-worth", "월말 순자산 정리"], ["stock-ratio", "주식 비중 한 번에 보기"]];

const css = (t, w) => `
*{box-sizing:border-box;margin:0}
body{font-family:"Pretendard","Noto Sans KR","WenQuanYi Zen Hei",sans-serif;background:${t.bg};color:${t.fg};-webkit-font-smoothing:antialiased;word-break:keep-all}
.col{width:100%;max-width:${w >= 1024 ? 672 : 480}px;margin:0 auto;padding:8px 12px 40px}
.guide .col{max-width:480px;padding:${w >= 640 ? 48 : 16}px 12px 40px;display:flex;flex-direction:column;gap:20px}
.root{display:flex;flex-direction:column;gap:${w >= 768 ? 24 : 16}px}
.wr{padding:8px 0;display:flex;flex-direction:column;gap:20px;width:100%}
h1.hero{font-size:${w >= 768 ? 40 : 36}px;font-weight:700;text-align:center;letter-spacing:-.025em;line-height:1.1;text-wrap:balance}
.sub{font-size:${w >= 768 ? 18 : 16}px;color:${t.mf};text-align:center;line-height:1.625;text-wrap:pretty}
.trust{font-size:14px;color:${t.mf};text-align:center;line-height:1.625}.trust .nw{white-space:nowrap}.trust i{margin:0 6px;opacity:.5;font-style:normal}
.ph{border-radius:12px;background:${t.card};padding:16px;min-height:216px;box-shadow:0 1px 2px #0001;font-size:13px;color:${t.mf};display:flex;align-items:center;justify-content:center;text-align:center}
.ph2{min-height:160px;background:transparent;border:1px dashed ${t.border}}
.note{font-size:11px;text-align:center;color:${t.mf}}
/* RootGuideLinks */
.gl{display:flex;flex-direction:column;align-items:center}
.gl-label{font-size:12px;font-weight:600;color:${t.mf};line-height:1;margin-bottom:2px}
.gl-row{display:flex;flex-wrap:wrap;justify-content:center;column-gap:0}
.gl a{display:inline-flex;align-items:center;min-height:40px;padding:0 8px;font-size:14px;color:${t.mf};text-decoration:none;border-radius:6px;white-space:nowrap}
.gl a span{text-decoration:underline;text-underline-offset:4px;text-decoration-color:color-mix(in oklab,${t.mf} 40%,transparent)}
.gl a:hover{color:${t.fg}}
footer{margin-top:16px;padding:16px 0;border-top:1px solid ${t.border};text-align:center}
footer p{font-size:14px;color:${t.mf};line-height:1.5}footer p+p{font-size:${w >= 768 ? 14 : 12}px;margin-top:4px;opacity:${t === TOKENS.dark ? .6 : 1}}
/* guide */
.gh{display:flex;align-items:center;gap:6px;height:40px;font-size:14px;font-weight:600}.gh b{display:inline-block;width:22px;height:22px;border-radius:6px;background:#5b6fbf}
h1.g{font-size:${w >= 768 ? 24 : 20}px;font-weight:700;line-height:1.375;text-wrap:balance}
.gs{margin-top:8px;font-size:14px;line-height:1.625;color:${t.mf};text-wrap:pretty}
ol{list-style:none;padding:0;display:flex;flex-direction:column;gap:20px}
ol li+li{border-top:1px solid ${t.border};padding-top:20px}
.n{font-size:11px;font-weight:600;color:${t.primary};font-variant-numeric:tabular-nums}
h2{font-size:16px;font-weight:600;line-height:1.375;margin-top:4px;text-wrap:balance}
.bd{font-size:14px;line-height:1.75;color:color-mix(in oklab,${t.fg} 90%,transparent);margin-top:6px;text-wrap:pretty}
.il{display:block;min-height:40px;padding:8px 0;font-size:14px;font-weight:500;text-decoration:underline;text-underline-offset:4px;color:${t === TOKENS.dark ? t.primary : t.fg}}
.fact{border-radius:12px;background:${t.card};padding:16px;${t === TOKENS.dark ? "box-shadow:0 1px 2px #0006;border:1px solid " + t.border : ""}}
.fact ul{list-style:none;padding:0;margin-top:8px;display:flex;flex-direction:column;gap:8px}
.fact li{font-size:14px;line-height:1.625;color:${t.mf};text-wrap:pretty}
.btn{display:flex;align-items:center;justify-content:center;height:44px;border-radius:8px;font-size:14px;font-weight:600}
.btn.p{background:#5b6fbf;color:#fff}.btn.s{background:${t === TOKENS.dark ? "oklch(0.31 0.014 265)" : "oklch(0.97 0 0)"};color:${t.fg}}
.other{display:flex;flex-direction:column}
.other h3{font-size:14px;font-weight:600;margin-bottom:4px}
.other a{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;padding:10px 0;border-top:1px solid ${t.border};font-size:14px;font-weight:500;color:${t.fg};text-decoration:none;line-height:1.4}
.other a svg{flex:none;width:16px;height:16px;color:${t.mf}}
.brand{margin-top:8px;text-align:center;font-size:14px;color:${t.mf}}
`;
const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
const links = () => `<nav aria-label="가이드" data-testid="root-guide-links" class="gl"><span aria-hidden="true" class="gl-label">가이드</span><div class="gl-row">${LINKS.map(([s, l]) => `<a href="/guide/${s}" data-testid="root-guide-link-${s}"><span>${l}</span></a>`).join("")}</div></nav>`;
const hero = `<section data-testid="welcome-hero" style="text-align:center"><h1 class="hero">나만의 비밀 자산 금고</h1><p class="sub" style="margin-top:8px">흩어진 자산을 한 화면에서 정리해 보세요.</p></section>`;
const trust = `<div data-testid="welcome-trust" class="trust"><span class="nw">로그인 없음<i>·</i></span><span class="nw">자산은 내 기기에 저장<i>·</i></span><span class="nw">원하면 암호화 동기화</span></div>`;
const footer = `<footer><p>© 2026 시크릿에셋. All rights reserved.</p><p>본 서비스는 개인 자산 관리 목적으로 제공되며, 투자 조언을 포함하지 않습니다.</p></footer>`;

const SCENES = {
  "root-pre": () => `<div class="col"><div class="root" data-first-paint><div class="wr">${hero}${trust}</div>${links()}</div></div>`,
  "welcome": () => `<div class="col"><div class="root"><div class="wr">${hero}${trust}<div class="ph">[기존] 예시 순자산·시작 버튼 슬롯 (diff 0)</div></div><div class="ph ph2">[기존] 주식 미리보기·설치 박스 (diff 0)</div><p class="note">실제 자산을 입력하면 이 화면이 내 포트폴리오로 채워집니다.</p>${links()}${footer}</div></div>`,
  "guide": () => `<div class="guide"><div class="col">
<header class="gh"><b></b>시크릿에셋</header>
<div id="top"><h1 class="g" data-testid="guide-title">올해 자산 결산하는 법</h1><p class="gs">한 해 동안 달라진 순자산에는 내가 넣은 돈과 <span style="white-space:nowrap">시세·환율</span> 등으로 움직인 돈이 섞여 있어요. 둘을 나누면 무엇으로 달라졌는지 보여요.</p></div>
<ol id="steps">
<li><span class="n">01</span><h2>기준 정하기</h2><p class="bd">출발점은 작년 말 순자산이에요. 작년 말 값이 없으면 올해 처음 기록한 날을 출발점으로 삼고, 그날 이후를 결산으로 봐요.</p></li>
<li><span class="n">02</span><h2>지금 순자산 구하기</h2><p class="bd">같은 날 모은 자산 합계에서 대출 잔액을 빼요. 해외 자산은 같은 날 환율로 바꿔 더해요.</p><a class="il" href="#">순자산 구하는 순서는 월말 순자산 정리하는 법</a></li>
<li><span class="n">03</span><h2>올해 넣은 돈 구하기</h2><p class="bd">올해 계좌에 넣은 돈에서 꺼낸 돈을 빼면 넣은 돈이에요. 주식을 사고팔거나 대출을 갚는 건 자산 사이의 이동이라 넣은 돈에 넣지 않아요.</p></li>
<li><span class="n">04</span><h2>나머지 보기</h2><p class="bd">지금과 기준의 차이에서 넣은 돈을 빼면 나머지가 나와요. 나머지는 <span style="white-space:nowrap">시세·환율</span>과 그 밖의 변화예요. 대출 이자와 받은 배당·이자, 적지 못한 입출금도 여기에 섞여요. 잘잘못이나 성과를 가리는 숫자가 아니에요.</p></li>
</ol>
<section class="fact" id="fact"><h2 style="margin-top:0">시크릿에셋으로 하면</h2><ul>
<li>지난 연도 순자산을 직접 넣으면 성과 &gt; 자산 변화의 '연'에서 올해 전체 변화를 바로 비교해요.</li>
<li>넣은 돈과 불어난 돈은 월 기록이 쌓인 달부터 나눠져요. 그 전 기간은 '월 기록 전 기간' 한 줄로 합쳐 보여 줘요.</li>
<li>넣은 돈은 입금에서 출금을 뺀 금액, 불어난 돈은 시세 변동·평가 갱신·환율 효과예요. 빠져나간 돈은 추정한 대출 이자와, 늘어난 대출 중 자산에 남지 않은 몫이에요.</li>
<li>받은 배당은 계좌 잔액에 들어 있어 넣은 돈 또는 기록 안 된 변화에 포함돼요. 설명되지 않는 부분은 '기록 안 된 변화'로 따로 보여 줘요.</li>
<li>작년 말 값이 없으면 처음 기록한 날 이후로 결산하고, 7일이 지나야 보여요.</li>
<li>지난해 순자산이 기록돼 있으면 1월 10일까지는 지난해 결산을 보여 줘요.</li>
<li>입력한 자산은 서버로 보내지 않고 내 기기에만 저장돼요. [LOCAL_SAVE_COPY 원문 import]</li></ul></section>
<div style="display:flex;flex-direction:column;gap:8px" id="cta"><div class="btn p">예시 데이터로 둘러보기</div><div class="btn s">캡처로 내 비중 보기</div></div>
<nav aria-label="다른 가이드" class="other" id="other"><h3>다른 가이드</h3>
<a href="#" data-testid="guide-other-link-stock-ratio"><span>여러 증권사 주식 비중 한 번에 보기</span>${CHEV}</a>
<a href="#" data-testid="guide-other-link-net-worth"><span>월말 순자산 정리하는 법</span>${CHEV}</a></nav>
<p class="brand">안전한 자산 관리, 시크릿에셋</p></div></div>`,
};

(async () => {
  const b = await chromium.launch();
  const report = [];
  for (const theme of ["light", "dark"]) for (const w of [320, 390, 1280]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 });
    const pg = await ctx.newPage();
    const load = async (scene) => { await pg.setContent(`<!doctype html><meta charset=utf-8><style>${css(TOKENS[theme], w)}</style><body>${SCENES[scene]()}`); await pg.waitForTimeout(80); };
    const shot = async (name, sel, pad = 16) => {
      const el = await pg.$(sel); const bb = await el.boundingBox();
      const y = Math.max(0, bb.y - pad);
      await pg.screenshot({ path: path.join(OUT, `${name}-${w}-${theme}.png`), clip: { x: 0, y, width: w, height: Math.min(bb.height + pad * 2, 1400) }, fullPage: true });
    };
    // 루트 사전 조각 / 웰컴 — 히어로·신뢰 줄 좌표 비교(AC-7)
    await load("root-pre");
    const pre = await pg.evaluate(() => ["welcome-hero", "welcome-trust"].map((id) => { const r = document.querySelector(`[data-testid=${id}]`).getBoundingClientRect(); return [id, Math.round(r.top), Math.round(r.height)]; }));
    await pg.screenshot({ path: path.join(OUT, `root-pre-${w}-${theme}.png`), fullPage: false, clip: { x: 0, y: 0, width: w, height: w >= 1000 ? 420 : 460 } });
    const meas = await pg.evaluate(() => {
      const row = document.querySelector(".gl-row"); const as = [...row.querySelectorAll("a")];
      const tops = [...new Set(as.map((a) => Math.round(a.getBoundingClientRect().top)))];
      return { lines: tops.length, hs: as.map((a) => Math.round(a.getBoundingClientRect().height)), ws: as.map((a) => Math.round(a.getBoundingClientRect().width)), navH: Math.round(document.querySelector(".gl").getBoundingClientRect().height), scrollOver: document.documentElement.scrollWidth > innerWidth };
    });
    await load("welcome");
    const wel = await pg.evaluate(() => ["welcome-hero", "welcome-trust"].map((id) => { const r = document.querySelector(`[data-testid=${id}]`).getBoundingClientRect(); return [id, Math.round(r.top), Math.round(r.height)]; }));
    await pg.screenshot({ path: path.join(OUT, `welcome-bottom-${w}-${theme}.png`), fullPage: true, clip: { x: 0, y: Math.max(0, (await pg.evaluate(() => document.documentElement.scrollHeight)) - 520), width: w, height: 520 } });
    report.push({ theme, w, preHeroTrust: JSON.stringify(pre), welHeroTrust: JSON.stringify(wel), same: JSON.stringify(pre) === JSON.stringify(wel), ...meas });
    await load("guide");
    await shot("guide-top", "#top", 56);
    await shot("guide-steps", "#steps", 12);
    await pg.screenshot({ path: path.join(OUT, `guide-bottom-${w}-${theme}.png`), fullPage: true, clip: { x: 0, y: await pg.evaluate(() => document.querySelector("#fact").getBoundingClientRect().top + scrollY - 12), width: w, height: await pg.evaluate(() => document.documentElement.scrollHeight - (document.querySelector("#fact").getBoundingClientRect().top + scrollY) + 12) } });
    await ctx.close();
  }
  // 보유자 숨김(html[data-has-assets]) / JS 꺼짐 SSR
  const ctx = await b.newContext({ viewport: { width: 390, height: 600 }, javaScriptEnabled: false, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  await pg.setContent(`<!doctype html><meta charset=utf-8><style>${css(TOKENS.light, 390)}</style><body>${SCENES["root-pre"]()}`);
  await pg.screenshot({ path: path.join(OUT, "state-nojs-390-light.png"), clip: { x: 0, y: 0, width: 390, height: 460 } });
  await ctx.close();
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 300 }, deviceScaleFactor: 2 });
  const p2 = await ctx2.newPage();
  await p2.setContent(`<!doctype html><html data-has-assets><meta charset=utf-8><style>${css(TOKENS.light, 390)}[data-has-assets] [data-first-paint]{display:none}</style><body>${SCENES["root-pre"]()}<p style="padding:24px;font-size:13px;color:#666">보유자: 사전 조각(링크 줄 포함) display:none → 이 영역 아래는 홈 본 화면</p>`);
  report.push({ owner_hidden_nav_visible: await p2.evaluate(() => !!document.querySelector("[data-testid=root-guide-links]").offsetParent) });
  await p2.screenshot({ path: path.join(OUT, "state-owner-hidden-390-light.png") });
  await b.close();
  console.log(JSON.stringify(report, null, 1));
})();
