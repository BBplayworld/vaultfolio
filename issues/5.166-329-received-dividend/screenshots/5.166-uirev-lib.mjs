import { createRequire } from "node:module";
const require = createRequire("/opt/node22/lib/node_modules/noop.js");
let pw; try { pw = require("playwright"); } catch { pw = require("playwright-core"); }
export const chromium = pw.chromium;
export const BASE = "http://localhost:3480";
export const SHOTS = "/tmp/claude-0/-home-user-vaultfolio/35b35548-5942-5886-b0bd-2d4a3cbe1dd9/scratchpad/uirev5166/shots";
export const YEAR = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 4);
export async function launch() { return chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }); }
export async function mockDividend(page) {
  await page.route("**/api/finance/dividend**", (route) => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ data: [
      { payoutDate: `${YEAR}-02-15`, amountPerShare: 361, currency: "KRW" },
      { payoutDate: `${YEAR}-05-15`, amountPerShare: 361, currency: "KRW" },
      { payoutDate: `${YEAR}-11-15`, amountPerShare: 361, currency: "KRW" },
      { payoutDate: `${YEAR}-12-28`, amountPerShare: 361, currency: "KRW", isEstimated: true },
    ] }) }));
}
// 어절 중간 줄바꿈 검사: 요소 안 텍스트의 각 어절(공백 구분)이 한 줄에 있는지
export const wordBreakFn = `(el) => {
  const bad = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) { const t = n.textContent; const re = /\\S+/g; let m;
    while ((m = re.exec(t))) { const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
      const tops = new Set([...r.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top))); if (tops.size > 1) bad.push(m[0]); } }
  const r = document.createRange(); r.selectNodeContents(el); const lines = new Set([...r.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top)));
  return { text: el.textContent.trim(), lines: lines.size, bad };
}`;
