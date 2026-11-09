const { chromium } = require('/opt/node-tools/node_modules/playwright');
const S=process.argv[2]; const SCEN=process.argv[3]; // edit | delete | fail
const HOST='https://secretasset-git-issue-452-bbplayworlds-projects.vercel.app';
(async()=>{
const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:375,height:800}});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,100)));
const data = {realEstate:[],stocks:[{id:"s1",category:"domestic",name:"삼성전자",ticker:"005930",quantity:10,averagePrice:50000,currentPrice:60000,currency:"KRW",purchaseDate:"2025-01-01",baseDate:"1999-01-01"}],crypto:[],cash:[{id:"c1",type:"bank",name:"테스트통장",balance:1000000,currency:"KRW"}],loans:[],yearlyNetAssets:[],transactions:[],cashTransactions:[],loanTransactions:[],cryptoTransactions:[],lastUpdated:"2026-11-01T00:00:00.000Z",nickname:""};
await p.addInitScript(d=>{ if(!localStorage.getItem('secretasset_asset_data')) {localStorage.setItem('secretasset_asset_data', JSON.stringify(d));
 localStorage.setItem('secretasset_tutorial_status', JSON.stringify({1:"skipped",2:"skipped",3:"skipped",4:"skipped",5:"skipped"}));} }, data);
p.on('dialog',d=>d.accept());
const t0=Date.now(); const T=()=>((Date.now()-t0)/1000).toFixed(1)+'s';
let released=false;
await p.route('**/api/finance?type=stock*', async r=>{ console.log(T(),'stock req held'); await new Promise(s=>setTimeout(s,12000)); released=true; console.log(T(),'released');
  if(SCEN==='fail') return r.fulfill({status:500,body:'{"error":"x"}',contentType:'application/json'}); r.continue(); });
const st=async()=>JSON.parse(await p.evaluate(()=>localStorage.getItem('secretasset_asset_data')));
const show=async l=>{const d=await st(); console.log(T(),l,'cash=',d.cash[0]?.balance,'stocks=',d.stocks.map(s=>s.name+':'+s.currentPrice+':'+s.baseDate).join(','),'released=',released);};
await p.goto(HOST+'/',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2000);
await p.screenshot({path:`${S}/pv-${SCEN}-0.png`});
await p.click('text=상세');await p.waitForTimeout(500);
if(SCEN==='delete'){
 await p.click('text=주식 >> nth=0');await p.waitForTimeout(800);
 await p.screenshot({path:`${S}/pv-${SCEN}-stocktab.png`});
 console.log((await p.locator('button[title]').evaluateAll(e=>e.map(x=>x.title))).join('|'));
 await p.evaluate(()=>document.querySelector('button[title="삭제"]').click());await p.waitForTimeout(800);console.log('dlg',await p.locator('[role=alertdialog],[role=dialog]').allInnerTexts());
 await p.screenshot({path:`${S}/pv-${SCEN}-confirm.png`});
 console.log((await p.locator('button').allInnerTexts()).join('|'));
 await p.waitForTimeout(800);
} else {
 await p.click('text=현금');await p.waitForTimeout(500);
 await p.click('text=테스트통장 >> nth=-1');await p.waitForTimeout(500);
 await p.click('button[title="수정"]');await p.waitForTimeout(800);
 await p.fill('input[value="1,000,000"], input[value="1000000"]','2500000');
 await p.click('button:has-text("수정")');await p.waitForTimeout(800);
}
await show('after user edit (response pending)');
await p.waitForTimeout(16000);
await show('after response');
await p.screenshot({path:`${S}/pv-${SCEN}-end.png`});
console.log('pageerrors',errs);
await b.close();})();
