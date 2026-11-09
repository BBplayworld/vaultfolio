const {chromium}=require('/opt/node-tools/node_modules/playwright');
const BASE='https://secretasset-git-issue-456-bbplayworlds-projects.vercel.app';
const HOST=new URL(BASE).hostname;
const kst=(d)=>new Date(Date.now()+9*3600e3+d*864e5).toISOString().slice(0,10);
const T=kst(0);
const M=1e6;
const mk=(o={})=>({realEstate:[],
 stocks:[{id:'s3',category:'foreign',name:'소니',ticker:'6758',quantity:10,averagePrice:3000,currentPrice:3500,currency:'JPY',purchaseDate:'2025-01-01'},{id:'s1',category:'domestic',name:'삼성전자',ticker:'005930',quantity:100,averagePrice:70000,currentPrice:80000,currency:'KRW',purchaseDate:'2025-01-01'},
  {id:'s2',category:'foreign',name:'애플',ticker:'AAPL',quantity:10,averagePrice:150,currentPrice:200,currency:'USD',purchaseDate:'2025-01-01'}],
 crypto:[{id:'c1',symbol:'BTC',name:'비트코인',quantity:1,averagePrice:40000000,currentPrice:50000000,purchaseDate:'2025-01-01'}],
 cash:[{id:'a',type:'bank',name:'증권 예수금',balance:10*M,currency:'KRW'},{id:'u',type:'bank',name:'달러 계좌',balance:5000,currency:'USD'},{id:'j',type:'bank',name:'엔화 계좌',balance:100000,currency:'JPY'}],
 loans:[{id:'l',type:'credit',name:'신용대출',balance:5*M,interestRate:3,startDate:'2025-01-01'}],
 yearlyNetAssets:[],transactions:[],cashTransactions:[],loanTransactions:[],cryptoTransactions:[],lastUpdated:new Date().toISOString(),nickname:'',...o});
async function open(b,{w=375,dark=false,asset=mk(),snaps=[],ls={}}={}){
 const ctx=await b.newContext({viewport:{width:w,height:w>=1024?900:812},deviceScaleFactor:1});
 await ctx.addCookies([{name:'theme_mode',value:dark?'dark':'light',domain:HOST,path:'/',secure:true}]);
 const reqs=[];
 await ctx.route('**/api/**',r=>{reqs.push(r.request().method()+' '+new URL(r.request().url()).pathname);r.abort()});
 await ctx.addInitScript(([a,sn,ls])=>{ if(sessionStorage.getItem('seeded'))return; sessionStorage.setItem('seeded','1');for(const k in ls)localStorage.setItem(k,JSON.stringify(ls[k]));
  localStorage.setItem('secretasset_tutorial_status',JSON.stringify({1:'done',2:'done',3:'done',4:'done',5:'done'}));
  localStorage.setItem('secretasset_asset_data',JSON.stringify(a));localStorage.setItem('secretasset_daily_snapshots',JSON.stringify(sn));
  localStorage.setItem('secretasset_onboarding_wizard_status','done');},[asset,snaps,ls]);
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(BASE+'/',{waitUntil:'domcontentloaded'});await p.waitForTimeout(4500);
 return {ctx,p,reqs,errs};}
const data=(p)=>p.evaluate(()=>JSON.parse(localStorage.getItem('secretasset_asset_data')));
module.exports={chromium,BASE,mk,open,data,T,kst,M};
module.exports.trade=async function(p,{kind='stock',id,type='buy',qty,price,link,date,shot,submit=true}){
 const ev=kind==='stock'?'trigger-add-trade':'trigger-add-crypto-tx';const key=kind==='stock'?'stockId':'cryptoId';
 await p.evaluate(([e,k,i])=>window.dispatchEvent(new CustomEvent(e,{detail:{[k]:i}})),[ev,key,id]);await p.waitForTimeout(900);
 const d=p.locator('[role=dialog]').last();
 if(type==='sell')await d.getByRole('button',{name:'매도',exact:true}).click();
 const ins=d.locator('input[inputmode=numeric], input[inputmode=decimal]');
 await ins.nth(0).fill(String(qty));await ins.nth(1).fill(String(price));
 if(date)await d.locator('input[type=date]').fill(date);
 await p.waitForTimeout(400);
 const out={};
 if(link){const row=d.locator('[data-testid=account-link-row]');out.rowCount=await row.count();
  if(out.rowCount){await d.locator('[data-testid=account-link-select]').click();await p.waitForTimeout(300);
   out.options=await p.locator('[role=option]').allTextContents();
   if(link!=='__peek'){await p.getByRole('option',{name:link,exact:true}).click();await p.waitForTimeout(700);}else await p.keyboard.press('Escape');}}
 else{out.rowCount=await d.locator('[data-testid=account-link-row]').count();}
 out.preview=await d.locator('[data-testid=cash-link-preview]').allTextContents().catch(()=>null);
 out.alerts=await d.locator('[role=alert]').allTextContents();
 out.resync=await d.locator('[data-testid*=resync-warning]').count();
 if(shot)await p.screenshot({path:shot});
 if(submit){await d.getByRole('button',{name:type==='buy'?/매수 기록/:/매도 기록/}).click();await p.waitForTimeout(900);
  out.toast=await p.locator('[data-sonner-toast]').allTextContents();out.dialogOpen=await p.locator('[role=dialog]').count();}
 return out;};
module.exports.toStockHistory=async function(p){
 await p.getByText('상세',{exact:true}).first().click();await p.waitForTimeout(800);
 await p.getByText('국내·해외 보유 종목').click();await p.waitForTimeout(1000);
 await p.getByRole('button',{name:'거래내역'}).first().click();await p.waitForTimeout(1000);};
