const L=require('./lib.js');const SH='/home/user/vaultfolio/.memory/issues/4.56-103-cross-asset-flow/screenshots/';
const J=JSON.stringify;const R={proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined};
async function step(name,fn){try{console.log('\n## '+name);await fn();}catch(e){console.log('!! ERR',name,e.message.split('\n')[0]);}}
const gaps=(p)=>p.evaluate(()=>{const row=document.querySelector('[data-testid=account-link-row]');const out=[];let el=row;const form=row.parentElement;const kids=[...form.children].filter(k=>k.getBoundingClientRect().height>0||true);
 const i=kids.indexOf(row);for(let j=i;j<Math.min(kids.length,i+3);j++){const r=kids[j].getBoundingClientRect();out.push({tag:kids[j].tagName+(kids[j].getAttribute('data-testid')?'#'+kids[j].getAttribute('data-testid'):''),top:Math.round(r.top*10)/10,h:Math.round(r.height*10)/10});}
 const g=[];for(let j=1;j<out.length;j++)g.push(Math.round((out[j].top-(out[j-1].top+out[j-1].h))*10)/10);return {out,gapsPx:g,warn:!!document.querySelector('[data-testid=cash-tx-resync-warning]')};});
(async()=>{const b=await L.chromium.launch(R);
for(const [nm,ls] of [['W0 경고 접힘(맞춘 기록 없음)',{}],['W1 경고 표시(오늘 맞춘 현금)',{secretasset_asset_refresh:{categories:{cash:new Date().toISOString()}}}]])
await step(nm,async()=>{
 for(const dark of [false,true]){
 const {ctx,p}=await L.open(b,{ls,dark});
 const o=await L.trade(p,{kind:'stock',id:'s1',type:'buy',qty:10,price:80000,link:'증권 예수금',submit:false,shot:SH+`4.58-qa-${nm.slice(0,2)}-375-${dark?'dark':'light'}.png`});
 console.log(dark?' dark':' light','alerts',J(o.alerts),'resync',o.resync,J(await gaps(p)));
 if(!dark&&nm.startsWith('W1')){console.log(' 경고문구:',await p.locator('[data-testid=cash-tx-resync-warning]').innerText());
  // 저장 가능
  await p.locator('[role=dialog]').last().getByRole('button',{name:/매수 기록/}).click();await p.waitForTimeout(900);console.log(' 저장 toast',J(await p.locator('[data-sonner-toast]').allTextContents()));}
 await ctx.close();}});
await step('W2 연결 안 함 선택 시 경고 접힘(렌더 0)·간격',async()=>{
 const {ctx,p}=await L.open(b,{ls:{secretasset_asset_refresh:{categories:{cash:new Date().toISOString()}}}});
 await L.trade(p,{kind:'stock',id:'s1',type:'buy',qty:10,price:80000,link:'증권 예수금',submit:false});
 await p.locator('[data-testid=account-link-select]').click();await p.getByRole('option',{name:'연결 안 함'}).click();await p.waitForTimeout(500);
 console.log(J(await gaps(p)));await ctx.close();});
await step('P1 320 미리보기 2줄 분리(긴 계좌명·큰 금액)',async()=>{
 for(const [w,dark] of [[320,false],[320,true],[375,false],[1280,false]]){
 const base=L.mk();base.cash=base.cash.map(c=>c.id==='a'?{...c,name:'한국투자증권 종합위탁 예수금 계좌',balance:1234567890}:c);
 const {ctx,p}=await L.open(b,{w,dark,asset:base});
 const o=await L.trade(p,{kind:'stock',id:'s1',type:'buy',qty:10,price:8000000,link:'한국투자증권 종합위탁 예수금 계좌',submit:false,shot:SH+`4.58-qa-P1-preview-${w}-${dark?'dark':'light'}.png`});
 const m=await p.evaluate(()=>{const pe=document.querySelector('[data-testid=cash-link-preview]');const sp=pe.querySelector('span.whitespace-nowrap');const lh=parseFloat(getComputedStyle(pe).lineHeight);
  return {text:pe.innerText,h:Math.round(pe.getBoundingClientRect().height),lineH:lh,lines:Math.round(pe.getBoundingClientRect().height/lh),nowrapRects:sp.getClientRects().length,nowrapW:Math.round(sp.getBoundingClientRect().width),pW:Math.round(pe.getBoundingClientRect().width),hscroll:document.documentElement.scrollWidth>innerWidth,overflowSp:sp.getBoundingClientRect().right>pe.getBoundingClientRect().right+1};});
 console.log(' w',w,dark?'dark':'light',J(m));await ctx.close();}});
await b.close();})();
