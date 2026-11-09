const { chromium } = require('/opt/node-tools/node_modules/playwright');
const S=process.argv[2]; const HOST='https://secretasset-git-issue-467-bbplayworlds-projects.vercel.app';
(async()=>{ const b=await chromium.launch();
for (const TH of ['light','dark']) { const ctx=await b.newContext({viewport:{width:375,height:800}});
await ctx.addCookies([{name:'theme_mode',value:TH,url:HOST}]);
const p=await ctx.newPage();
await p.addInitScript(()=>{localStorage.setItem('secretasset_tutorial_status',JSON.stringify({1:"skipped",2:"skipped",3:"skipped",4:"skipped",5:"skipped"}));});
await p.goto(HOST+'/?demo=1',{waitUntil:'domcontentloaded'});await p.waitForTimeout(6000);
await p.goto(HOST+'/',{waitUntil:'domcontentloaded'});await p.waitForTimeout(5000);
await p.locator('text=성과').first().click();await p.waitForTimeout(900);
await p.locator('text=/결산$/').first().click();await p.waitForTimeout(1500);
await p.locator('[data-testid=monthly-log-button]').click();await p.waitForTimeout(900);
const t='[data-testid=monthly-log-table]';
const r=await p.evaluate((t)=>{const e=document.querySelector(t);const th=e.querySelector('thead th');return{sw:e.scrollWidth,cw:e.clientWidth,month:th.getBoundingClientRect().width,rows:[...e.querySelectorAll('tbody tr')].map(r=>r.innerText.replace(/\s+/g,' ')),legacy:[...e.querySelectorAll('tbody th')].map(h=>h.innerText.replace(/\s+/g,' ')+'|h='+h.getBoundingClientRect().height.toFixed(0)),
 lines:getComputedStyle(e.querySelector('tbody td')).borderBottomColor+' '+getComputedStyle(e.querySelector('tbody th')).borderRightColor}},t);
console.log(TH,JSON.stringify(r));
await p.screenshot({path:`${S}/ui-re-w375-${TH}-1-left.png`});
await p.evaluate((t)=>{const e=document.querySelector(t);e.scrollLeft=e.scrollWidth;},t);await p.waitForTimeout(400);
await p.screenshot({path:`${S}/ui-re-w375-${TH}-2-scrolled.png`});
await ctx.close();}
await b.close();})();
