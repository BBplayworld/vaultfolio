const { chromium } = require('/opt/node-tools/node_modules/playwright');
const OUT=process.argv[2]; const W=Number(process.argv[3]||375); const TH=process.argv[4]||'light'; const SHOT=process.argv[5]||''; const MONTH=process.argv[6]||'';
const HOST='https://secretasset-git-issue-467-bbplayworlds-projects.vercel.app';
(async()=>{
const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:W,height:W>=1000?900:812}});
await ctx.addCookies([{name:'theme_mode', value:TH, url:HOST}]);
const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,160)));
await p.goto(HOST+'/?demo=1',{waitUntil:'domcontentloaded'});
await p.waitForSelector('html[data-demo-ready="1"]',{timeout:30000}).catch(()=>{});
await p.waitForTimeout(3000);
await p.locator('text=성과').first().click(); await p.waitForTimeout(1200);
for (const t of ['자산 변화','__card']) { const l= t==='__card' ? p.getByText(/결산$/).first() : p.getByText(t,{exact:true}); if (await l.count()) { await l.first().click(); await p.waitForTimeout(1000); } }
const mt = p.getByRole('tab',{name:/^월$/}); if (await mt.count()) { await mt.first().click(); await p.waitForTimeout(1500); }
if (MONTH) { const prev = p.locator(MONTH==='prev'?'[aria-label*="이전"]':'[aria-label*="다음"]').first(); if (await prev.count() && await prev.isEnabled()) { await prev.click(); await p.waitForTimeout(1200);} }
const blk = p.locator('[data-testid=monthly-log-block]');
if (!await blk.count()) { console.log(JSON.stringify({found:false, errs, body:(await p.locator('body').innerText()).slice(0,800)})); await p.screenshot({path:`${OUT}/probe-${W}-${TH}.png`}); await b.close(); return; }
const r = await p.evaluate(()=>{
  const q=(s)=>document.querySelector(`[data-testid=${s}]`)?.innerText.replace(/\s+/g,' ');
  const blk=document.querySelector('[data-testid=monthly-log-block]');
  const rows=[...blk.querySelectorAll('[data-testid^=monthly-log-row-]')].map(r=>r.innerText.replace(/\s+/g,' ').slice(0,120));
  const deltas=[...blk.querySelectorAll('[data-testid^=monthly-log-delta-]')].map(e=>e.dataset.testid.slice(-7)+'='+(e.dataset.value??'first')+' "'+e.innerText.replace(/\s+/g,' ')+'"');
  const groups=[...blk.querySelectorAll('[data-testid^=monthly-log-group-]')].filter(g=>!g.closest('[inert]')).map(g=>g.dataset.testid.slice(18)+' d='+g.dataset.delta+' "'+g.innerText.replace(/\s+/g,' ')+'"');
  const notes=[...blk.querySelectorAll('[data-testid^=monthly-log-panel-note-]')].filter(g=>!g.closest('[inert]')).map(e=>e.innerText);
  const spans=[...blk.querySelectorAll('[data-testid^=monthly-log-group-]')].filter(g=>!g.closest('[inert]')).map(g=>{const s=g.querySelectorAll('span'); const last=s[s.length-1]; return Math.round(last.getBoundingClientRect().right);});
  return { heroStart:q('change-hero-start'), heroEnd:q('change-hero-end'), heroDelta:q('change-hero-delta'), hero:q('change-hero')?.slice(0,200), rows, deltas, groups, notes, spanRights:spans, sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth };
});
console.log(JSON.stringify(r,null,1));
if (SHOT) {
  const box = await blk.boundingBox();
  await p.evaluate((y)=>window.scrollTo(0, y-80), box.y + (await p.evaluate(()=>scrollY)));
  await p.mouse.move(1,1); await p.waitForTimeout(600);
  await p.screenshot({path:`${OUT}/${SHOT}`});
}
console.log('pageerrors', errs); await b.close(); })();
