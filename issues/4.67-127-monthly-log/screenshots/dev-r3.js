const { chromium } = require('/opt/node-tools/node_modules/playwright');
const OUT=process.argv[2]; const W=Number(process.argv[3]||375); const TH=process.argv[4]||'light'; const SHOT=process.argv[5]||'';
const HOST='https://secretasset-git-issue-467-bbplayworlds-projects.vercel.app';
(async()=>{
const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:W,height:900}});
await ctx.addCookies([{name:'theme_mode', value:TH, url:HOST}]);
const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,160)));
await p.addInitScript(()=>{ localStorage.setItem('secretasset_tutorial_status', JSON.stringify({1:"skipped",2:"skipped",3:"skipped",4:"skipped",5:"skipped"})); });
await p.goto(HOST+'/?trial=1',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(7000);
await p.locator('text=성과').first().click(); await p.waitForTimeout(1200);
const tabs = await p.locator('text=/결산$/').count();
if (tabs) { await p.locator('text=/결산$/').first().click(); await p.waitForTimeout(1500); }
const blk = p.locator('[data-testid=monthly-log-block]');
const n = await blk.count();
if (!n) { console.log(JSON.stringify({found:false, tabs, errs, body:(await p.locator('body').innerText()).slice(0,600)})); await p.screenshot({path:`${OUT}/probe-${W}-${TH}.png`}); await b.close(); return; }
await blk.scrollIntoViewIfNeeded(); await p.waitForTimeout(700);
const r = await p.evaluate(()=>{
  const d=document.documentElement; const blk=document.querySelector('[data-testid=monthly-log-block]');
  const scrollers=[...blk.querySelectorAll('*')].filter(e=>/(auto|scroll)/.test(getComputedStyle(e).overflowX)).length;
  const rows=[...blk.querySelectorAll('[data-testid^=monthly-log-row-]')].map(r=>({id:r.dataset.testid, kind:r.dataset.kind, h:Math.round(r.getBoundingClientRect().height), t:r.innerText.replace(/\s+/g,' ').slice(0,140)}));
  const toggles=[...blk.querySelectorAll('[data-testid^=monthly-log-toggle-]')].map(t=>t.dataset.testid+':'+t.getAttribute('aria-expanded')+':'+Math.round(t.getBoundingClientRect().height));
  const deltas=[...blk.querySelectorAll('[data-testid^=monthly-log-delta-]')].map(e=>e.dataset.testid.slice(-7)+'='+(e.dataset.value??'first')+':'+(e.firstElementChild?getComputedStyle(e.firstElementChild).color:getComputedStyle(e).color));
  const groups=[...blk.querySelectorAll('[data-testid^=monthly-log-group-]')].filter(g=>!g.closest('[inert]')).map(g=>g.dataset.testid.slice(18)+'='+g.dataset.delta+' h'+Math.round(g.getBoundingClientRect().height));
  const nets=[...blk.querySelectorAll('[data-testid^=monthly-log-net-]')].map(e=>e.innerText);
  const keepAll=[...blk.querySelectorAll('p,span')].filter(e=>/[가-힣]/.test(e.innerText)&&e.children.length===0).map(e=>getComputedStyle(e).wordBreak+'|'+getComputedStyle(e).whiteSpace).reduce((a,k)=>(a[k]=(a[k]||0)+1,a),{});
  const ai=document.querySelector('[data-testid=settlement-ai-button]'); const comp=document.querySelector('[data-testid=composition-block]');
  const order=[comp, blk, ai].map(e=>e?Math.round(e.getBoundingClientRect().top+scrollY):null);
  return { sw:d.scrollWidth, cw:d.clientWidth, blkW:blk.scrollWidth+'/'+blk.clientWidth, scrollers, rows, toggles, deltas, groups, nets, keepAll, order, firstNowrap: (()=>{const e=blk.querySelector('[data-first]'); return e?getComputedStyle(e).whiteSpace:null;})(), more: !!blk.querySelector('[data-testid=monthly-log-more]'), dialogs: document.querySelectorAll('[role=dialog]').length, old: document.querySelectorAll('[data-testid=monthly-log-button],[data-testid=monthly-log-sheet]').length };
});
console.log(JSON.stringify(r));
if (SHOT) {
  const box = await blk.boundingBox();
  await p.evaluate((y)=>window.scrollTo(0, y-80), box.y + (await p.evaluate(()=>scrollY)));
  await p.mouse.move(1,1); await p.waitForTimeout(500);
  await p.screenshot({path:`${OUT}/${SHOT}`});
}
// 토글 동작
const t = p.locator('[data-testid^=monthly-log-toggle-]').nth(1);
if (await t.count()) { await t.click(); await p.waitForTimeout(400); console.log('toggle2 after click', await t.getAttribute('aria-expanded'));
  const id = await t.getAttribute('aria-controls'); const ph = await p.locator('#'+id).evaluate(e=>Math.round(e.getBoundingClientRect().height)); console.log('panel h', ph);
  await t.click(); await t.click(); await p.waitForTimeout(400); console.log('after 2 more', await t.getAttribute('aria-expanded')); }
// 월 화살표 이동 후 동일 노드
const same = await p.evaluate(()=>{ window.__blk=document.querySelector('[data-testid=monthly-log-block]'); return true; });
const prev = p.locator('[aria-label*="이전"]').first();
if (await prev.count() && await prev.isEnabled()) { await prev.click(); await p.waitForTimeout(800); console.log('same node after month move', await p.evaluate(()=>window.__blk===document.querySelector('[data-testid=monthly-log-block]'))); }
console.log('pageerrors', errs); await b.close(); })();
