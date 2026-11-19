// #249 2단 목업 보조 — 인앱(Threads iOS UA) 390 첫 화면 A/B/C(ui-designer, 2026-11-19). 코드 수정 0.
import { readFileSync } from "node:fs";
import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5131-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const lib = readFileSync(new URL("./mock-s2-lib.js", import.meta.url), "utf8");
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Barcelona 323.0.0.29.104 (iPhone15,2; iOS 17_4; ko_KR; ko; scale=3.00; 1179x2556; 581853397)";
const br = await chromium.launch({ proxy }); const items = [];
for (const v of ["A", "B", "C"]) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: true, hasTouch: true, userAgent: UA });
  const p = await ctx.newPage();
  await p.goto(`${PV}/?ga-optout=1`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(1500);
  await p.goto(`${PV}/`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(6500);
  await p.addScriptTag({ content: lib }); await p.evaluate(() => s2.hideGate());
  const m = v === "C" ? await p.evaluate(() => s2.measure()) : await p.evaluate((x) => s2[x](), v); await p.waitForTimeout(1000);
  console.log(v, JSON.stringify({ state: await p.evaluate(() => document.querySelector('[data-testid="welcome-cta-slot"]').dataset.state), tappable: m.tappable, trial: m.trialPrimary, chip: m.chip, slot: m.slot }));
  items.push({ v, b64: (await p.screenshot()).toString("base64") }); await ctx.close();
}
const ctx = await br.newContext({ viewport: { width: 1290, height: 900 }, colorScheme: "dark" }); const p = await ctx.newPage();
await p.setContent(`<body style="margin:0;background:#0b0c11;font-family:system-ui,'Noto Sans KR',sans-serif;color:#e6c35c;width:1290px"><div style="padding:16px 24px 4px;font-size:14px;font-weight:700">인앱(Threads iOS UA) 390 첫 화면 — 등록 칸은 외부 브라우저 안내(현행 #60)라 A·B·C 모두 등록 버튼 없음</div><div style="display:grid;grid-template-columns:repeat(3,390px);gap:24px;padding:12px 24px 24px">${items.map((i) => `<div><div style="font-size:13px;margin-bottom:6px">${{ A: "A 둘러보기 먼저", B: "B 주식 1개 먼저(인앱은 외부 안내가 위로)", C: "C 현행" }[i.v]}</div><img src="data:image/png;base64,${i.b64}" style="width:390px;display:block;outline:1px solid #2a2d36"></div>`).join("")}</div></body>`);
await p.waitForTimeout(300); const b = await p.locator("body").boundingBox(); await p.setViewportSize({ width: 1290, height: Math.ceil(b.height) });
await p.screenshot({ path: `${OUT}/s2-inapp-390.png`, fullPage: true }); await br.close();
