import { launch, enter, sig } from "./h.mjs";
const b = await launch(); const { p, errs } = await enter(b, process.env.BASE || "http://localhost:4651", +(process.env.W || 359));
const dump = async (t) => { await p.waitForTimeout(1300); console.log("\n##", t, await p.evaluate(() => location.pathname + location.hash)); console.log((await p.evaluate(() => [...document.querySelectorAll("*")].filter((e) => e.getClientRects().length && (e.matches("button,[role=radio],[role=tab],a,[role=button],input,select") || getComputedStyle(e).cursor === "pointer") && !(e.parentElement && getComputedStyle(e.parentElement).cursor === "pointer" && !e.matches("button,a,[role=radio],[role=tab]"))).map((e) => (e.getAttribute("data-testid") ? "[" + e.getAttribute("data-testid") + "]" : "") + (e.innerText || e.getAttribute("aria-label") || e.getAttribute("placeholder") || "").replace(/\s+/g, " ").slice(0, 24)).join(" ¦ "))).slice(0, +(process.env.N || 1500))); const s = await sig(p); console.log("SIG", s.n, "hs", s.hScroll, [...new Set(s.items.map((x) => x.split(" => ")[0]))].join(" ## ")); };
for (const st of process.argv.slice(2)) {
  const [k, ...r] = st.split(":"); const v = r.join(":");
  try {
    if (k === "hash") await p.evaluate((h) => { location.hash = h; }, v);
    else if (k === "goto") await p.goto((process.env.BASE || "http://localhost:4651") + v, { waitUntil: "networkidle" }).catch(() => {});
    else if (k === "text") await p.getByText(v).first().click({ timeout: 5000 });
    else if (k === "tid") await p.getByTestId(v).first().click({ timeout: 5000 });
    else if (k === "btn") await p.getByRole("button", { name: v }).first().click({ timeout: 5000 });
    else if (k === "shot") { await p.screenshot({ path: v, fullPage: true }); continue; }
  } catch (e) { console.log("STEP FAIL", st, String(e).slice(0, 120)); }
  await dump(st);
}
console.log("errs", errs.length, [...new Set(errs)].slice(0, 4).join(" // ")); await b.close();
