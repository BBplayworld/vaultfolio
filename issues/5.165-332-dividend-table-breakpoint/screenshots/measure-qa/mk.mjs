import { launch, enter, sig } from "./h.mjs";
const b = await launch(); const { p } = await enter(b, "http://localhost:4651", 359);
const reqs = []; p.on("response", (r) => { if (r.url().includes("/api/")) reqs.push(r.status() + " " + r.url().replace(/^.*\/api/, "/api").slice(0, 90)); });
await p.evaluate(() => { location.hash = "#activity/change-market"; }); await p.waitForTimeout(6000);
console.log((await p.evaluate(() => document.querySelector("main")?.innerText ?? document.body.innerText)).replace(/\s+/g, " ").slice(0, 700));
console.log([...new Set(reqs)].join("\n")); console.log(JSON.stringify(await sig(p)).slice(0, 300));
await b.close();
