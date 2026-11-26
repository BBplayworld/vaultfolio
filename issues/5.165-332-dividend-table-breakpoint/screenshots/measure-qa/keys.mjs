import { launch, enter } from "./h.mjs";
const b = await launch(); const { p, errs } = await enter(b, "http://localhost:4651", 359);
console.log(await p.evaluate(() => { const d = JSON.parse(localStorage.getItem("secretasset_asset_data")); const o = {}; for (const k in d) o[k] = Array.isArray(d[k]) ? d[k].length + " " + JSON.stringify(d[k][0] ?? null).slice(0, 420) : JSON.stringify(d[k]).slice(0, 80); return JSON.stringify(o, null, 1) + "\nKEYS " + Object.keys(localStorage).join(",") + "\nSS " + Object.keys(sessionStorage).join(","); }));
console.log(errs.slice(0, 6).join("\n")); await b.close();
