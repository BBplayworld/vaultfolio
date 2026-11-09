const { chromium } = require('/opt/node-tools/node_modules/playwright');
const S=process.argv[2]; const W=Number(process.argv[3]||375); const TH=process.argv[4]||'light';
const HOST='https://secretasset-git-issue-467-bbplayworlds-projects.vercel.app';
(async()=>{
const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:W,height:800}});
await ctx.addCookies([{name:'theme_mode', value:TH, url:HOST}]);
const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,120)));
await p.addInitScript(()=>{ localStorage.setItem('secretasset_tutorial_status', JSON.stringify({1:"skipped",2:"skipped",3:"skipped",4:"skipped",5:"skipped"})); });
await p.goto(HOST+'/?demo=1',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(6000);
await p.evaluate(()=>{ const a=JSON.parse(localStorage.getItem('secretasset_asset_data')); a.crypto=[]; a.cryptoTransactions=[]; localStorage.setItem('secretasset_asset_data', JSON.stringify(a));
  const m=JSON.parse(localStorage.getItem('secretasset_monthly_snapshots')); for(const s of m){ if(s.breakdown){ s.netAsset-=s.breakdown.crypto; s.breakdown.crypto=0; } } localStorage.setItem('secretasset_monthly_snapshots', JSON.stringify(m)); });
await p.goto(HOST+'/',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
await p.locator('text=성과').first().click(); await p.waitForTimeout(900);
await p.locator('text=/결산$/').first().click(); await p.waitForTimeout(1500);
await p.locator('[data-testid=monthly-log-button]').click(); await p.waitForTimeout(900);
const r = await p.evaluate(()=>{ const t=document.querySelector('[data-testid=monthly-log-table]'); const th=t.querySelector('thead th');
  return { sw:t.scrollWidth, cw:t.clientWidth, monthCol: th.getBoundingClientRect().width, heads:[...t.querySelectorAll('thead th')].map(h=>h.innerText.replace(/\s+/g,'')),
    rows:[...t.querySelectorAll('tbody tr')].map(r=>r.innerText.replace(/\s+/g,' ')), badge:[...t.querySelectorAll("tbody th span")].map(s=>s.className.slice(0,40)+"="+s.getBoundingClientRect().width.toFixed(1)+":"+s.innerText.replace(/\s+/g," ")), ellipsis:[...t.querySelectorAll('td,th')].some(c=>c.scrollWidth>c.clientWidth+1) }; });
console.log(JSON.stringify(r));
await p.screenshot({path:`${S}/four-w${W}-${TH}.png`});
console.log('pageerrors', errs); await b.close(); })();
