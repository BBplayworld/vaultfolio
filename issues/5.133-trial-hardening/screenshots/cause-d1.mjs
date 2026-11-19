import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
const B = { "5133": "https://secretasset-git-issue-5133-bbplayworlds-projects.vercel.app", "5131": "https://secretasset-git-issue-5131-bbplayworlds-projects.vercel.app" };
const OUT = "/home/user/vaultfolio/.memory/issues/5.133-trial-hardening/screenshots/qa/";
const b = await chromium.launch();
const ver = process.argv[2] || "5133";
const U = B[ver];
const widths = (process.argv[3] || "480,496,500,520,560,640,768,1024,1280").split(",").map(Number);
const theme = process.argv[4] || "dark";
const measure = () => {
  const line = document.querySelector('[data-testid="home-cause-line"]');
  if (!line) return null;
  const mk = line.querySelector('[data-testid="home-cause-market"]');
  const kids = [...line.children];
  const lab = kids[0];
  const lr = line.getBoundingClientRect();
  const over = kids.filter((k) => getComputedStyle(k).display !== "none").some((k) => k.getBoundingClientRect().right > lr.right + 0.5);
  return {
    text: line.innerText.replace(/\s+/g, " "), W: Math.round(lr.width),
    mk: mk ? getComputedStyle(mk).display !== "none" : "없음",
    labelTrunc: lab.scrollWidth > lab.clientWidth + 1, labelW: Math.round(lab.getBoundingClientRect().width), labelNeed: lab.scrollWidth,
    overflowRight: over, docOverflowX: document.documentElement.scrollWidth > innerWidth,
    idx: document.querySelector('[data-testid="home-market-today"]')?.getAttribute("aria-label") || document.querySelector('[data-testid="home-market-today"]')?.innerText,
    aria: line.getAttribute("aria-label"),
  };
};
for (const w of widths) {
  const mobile = w < 769;
  const c = await b.newContext({ viewport: { width: w, height: 900 }, hasTouch: mobile, isMobile: mobile });
  await c.addCookies([{ name: "theme_mode", value: theme, url: U }]);
  const p = await c.newPage();
  const err = []; p.on("pageerror", (e) => err.push(e.message.slice(0, 100)));
  await p.goto(U + "/?ga-optout=1"); await p.waitForTimeout(1000);
  await p.goto(U + "/?demo=1"); await p.waitForTimeout(7000);
  const r0 = await p.evaluate(measure);
  console.log(ver, theme, w, "기본", JSON.stringify(r0), err.length ? "ERR " + err : "");
  if ([375, 520, 1280, 496].includes(w) && ver === "5133") void 0; // ({ path: `${OUT}qa-${w}-${theme}-home.png`, clip: { x: 0, y: 0, width: w, height: Math.min(700, 900) } });
  // 최장 라벨·큰 금액·외 N개 주입
  for (const [lab, amt, more] of [["보유자산 시세 하락","−9,999만원","외 3개"],["보유자산 시세 하락","−9,999만원","외 9개"],["임차보증금 증가","−9,999만원","외 9개"],["부동산 시세 하락","−9,999만원","외 9개"],["주식 시세 하락","−1,096만원","외 2개"],["주식 시세 상승","+2,345만원","외 3개"],["코인 시세 하락","−999만원","외 1개"],["환율 하락","−1,074만원","외 4개"],["실물 평가 상승","+1,234만원","외 2개"]]) {
    const r = await p.evaluate(([lab, amt, more, f]) => {
      const line = document.querySelector('[data-testid="home-cause-line"]');
      if (!line) return null;
      line.children[0].textContent = lab; line.children[1].textContent = amt;
      const m = line.querySelector('[data-testid="home-cause-more"]'); if (m) m.textContent = more;
      return new Function("return (" + f + ")()")();
    }, [lab, amt, more, measure.toString()]);
    console.log("   주입", lab, amt, more, "→ W", r?.W, "mk", r?.mk, "labelTrunc", r?.labelTrunc, `(${r?.labelW}/${r?.labelNeed})`, "overflow", r?.overflowRight, r?.docOverflowX);
    if (w === 496 && ver === "5133" && lab.startsWith("보유")) void 0; // ({ path: `${OUT}qa-496-${theme}-cause-inject.png`, clip: { x: 0, y: 0, width: w, height: 700 } });
  }
  await c.close();
}
await b.close();
