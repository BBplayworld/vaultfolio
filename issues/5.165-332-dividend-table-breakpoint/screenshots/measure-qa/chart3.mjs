import { launch, enterDemo, DIV_STOCKS } from "./lib.mjs";
const b = await launch();
for (const wait of [1200, 4000]) for (let i = 0; i < 3; i++) {
  const c = await b.newContext({ viewport: { width: 390, height: 1000 }, deviceScaleFactor: 1, reducedMotion: "reduce", colorScheme: "dark" });
  const q = await c.newPage(); await enterDemo(q, { stocks: DIV_STOCKS });
  await q.getByRole("radio", { name: "성과" }).first().click(); await q.waitForTimeout(800);
  await q.getByText("배당", { exact: true }).first().click(); await q.waitForSelector('[data-testid="dividend-stock-row"]'); await q.waitForTimeout(wait);
  const t = `${process.env.TAG}-${wait}-${i}`;
  await q.screenshot({ path: `${process.env.SHOTS}/${t}-full.png`, fullPage: true });
  await q.screenshot({ path: `${process.env.SHOTS}/${t}-view.png` });
  await q.waitForTimeout(2000); await q.screenshot({ path: `${process.env.SHOTS}/${t}-view2.png` });
  await c.close();
}
await b.close();
