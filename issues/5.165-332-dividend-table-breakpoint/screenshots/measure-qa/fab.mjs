import { launch, enter } from "./h.mjs";
import fs from "fs";
const b = await launch(); const { p, ctx } = await enter(b, "http://localhost:4651", 359, { h: 800 });
const data = await p.evaluate(() => { const o = {}; for (const k of Object.keys(localStorage)) o[k] = localStorage.getItem(k); return o; });
fs.writeFileSync(process.argv[2] + "/demo-ls.json", JSON.stringify(data));
await ctx.close();
const c2 = await b.newContext({ viewport: { width: 359, height: 800 }, colorScheme: "dark", reducedMotion: "reduce" });
await c2.addCookies([{ name: "theme_mode", value: "dark", url: "http://localhost:4651" }]);
await c2.addInitScript((d) => { if (!localStorage.getItem("secretasset_asset_data")) for (const k in d) localStorage.setItem(k, d[k]); }, data);
const q = await c2.newPage(); await q.clock.setFixedTime(new Date("2026-11-26T03:00:00Z"));
await q.goto("http://localhost:4651/", { waitUntil: "networkidle" }).catch(() => {}); await q.waitForTimeout(2000);
const dump = async (t) => { await q.waitForTimeout(1000); console.log("##", t, (await q.evaluate(() => [...document.querySelectorAll("button,[role=radio],[role=tab],[role=combobox],input")].filter((e) => e.getClientRects().length).map((e) => (e.getAttribute("data-testid") ? "[" + e.getAttribute("data-testid") + "]" : "") + (e.innerText || e.getAttribute("aria-label") || e.getAttribute("placeholder") || "").replace(/\s+/g, " ").slice(0, 22)).join(" ¦ "))).slice(-900)); };
await dump("home");
for (const st of process.argv.slice(3)) { try { const [k, v] = st.split("="); if (k === "al") await q.locator(`[aria-label="${v}"]`).last().click({ timeout: 4000 }); else if (k === "t") await q.getByText(v, { exact: true }).last().click({ timeout: 4000 }); else if (k === "b") await q.getByRole("button", { name: v }).last().click({ timeout: 4000 }); else if (k === "opt") { await q.getByRole("option").nth(+v).click({ timeout: 4000 }); } else if (k === "cb") await q.getByRole("combobox").nth(+v).click({ timeout: 4000 }); } catch (e) { console.log("FAIL", st, String(e).slice(0, 90)); } await dump(st); }
await q.screenshot({ path: process.argv[2] + "/x-fab.png" });
await b.close();
