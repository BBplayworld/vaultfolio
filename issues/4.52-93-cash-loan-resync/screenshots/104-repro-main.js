const { chromium } = require('/opt/node-tools/node_modules/playwright');
const S=process.argv[2]; const DELAY=+process.argv[3]; const MODE=process.argv[4]; // 'during' | 'after'
(async()=>{
const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:375,height:800}});
const p = await ctx.newPage();
const data = {realEstate:[],stocks:[{id:"s1",category:"domestic",name:"삼성전자",ticker:"005930",quantity:10,averagePrice:50000,currentPrice:60000,currency:"KRW",purchaseDate:"2025-01-01",baseDate:"1999-01-01"}],crypto:[],cash:[{id:"c1",type:"bank",name:"테스트통장",balance:1000000,currency:"KRW"}],loans:[],yearlyNetAssets:[],transactions:[],cashTransactions:[],loanTransactions:[],cryptoTransactions:[],lastUpdated:"2026-11-01T00:00:00.000Z",nickname:""};
await p.addInitScript(d=>{ if(!localStorage.getItem('secretasset_asset_data')) {localStorage.setItem('secretasset_asset_data', JSON.stringify(d));
 localStorage.setItem('secretasset_tutorial_status', JSON.stringify({1:"skipped",2:"skipped",3:"skipped",4:"skipped",5:"skipped"}));} }, data);
const t0=Date.now(); const T=()=>((Date.now()-t0)/1000).toFixed(1)+'s';
await p.route('**/api/finance?type=stock*', async r=>{ console.log(T(),'stock req held'); await new Promise(s=>setTimeout(s,DELAY)); console.log(T(),'stock resp released'); r.continue(); });
const cash=async()=>JSON.parse(await p.evaluate(()=>localStorage.getItem('secretasset_asset_data'))).cash[0].balance;
await p.goto('https://www.secretasset.xyz/',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(1500);
if(MODE==='after') await p.waitForTimeout(DELAY+1500);
await p.click('text=상세');await p.waitForTimeout(500);await p.click('text=현금');await p.waitForTimeout(500);
await p.click('text=테스트통장 >> nth=-1');await p.waitForTimeout(500);
await p.click('button[title="수정"]');await p.waitForTimeout(800);
const inp=p.locator('input[inputmode], input').nth(1); 
await p.fill('input[value="1,000,000"], input[value="1000000"]','2500000').catch(async e=>{console.log('fill fallback');});
await p.click('button:has-text("수정")');
console.log(T(),'edited; storage cash=',await cash());
await p.waitForTimeout(800);
await p.screenshot({path:`${S}/repro-${MODE}-1-after-edit.png`});
console.log(T(),'UI text after edit:', (await p.locator('body').innerText()).match(/[\d,]+원/g)?.slice(0,3));
await p.waitForTimeout(DELAY+3000);
console.log(T(),'after response: storage cash=',await cash());
await p.screenshot({path:`${S}/repro-${MODE}-2-after-response.png`});
console.log(T(),'UI text:', (await p.locator('body').innerText()).match(/[\d,]+원/g)?.slice(0,3));
await b.close();})();
