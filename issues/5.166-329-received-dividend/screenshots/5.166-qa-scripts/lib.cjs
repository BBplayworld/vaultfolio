const path = require("path");
const { execSync } = require("child_process");
const root = execSync("npm root -g", { encoding: "utf8" }).trim();
const { chromium } = require(path.join(root, "playwright"));
const BASE = process.env.BASE || "http://localhost:3566";
const YEAR = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 4);
async function launch() { return chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }); }
async function mockDividend(page) {
  await page.route("**/api/finance/dividend**", (route) => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ data: [
      { payoutDate: `${YEAR}-02-15`, amountPerShare: 361, currency: "KRW" },
      { payoutDate: `${YEAR}-05-15`, amountPerShare: 361, currency: "KRW" },
      { payoutDate: `${YEAR}-12-28`, amountPerShare: 361, currency: "KRW", isEstimated: true },
    ] }) }));
}
module.exports = { chromium, BASE, YEAR, launch, mockDividend };
