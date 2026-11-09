const L=require('./lib.js');const SH='/home/user/vaultfolio/.memory/issues/4.56-103-cross-asset-flow/screenshots/';
const J=JSON.stringify;const R={proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined};
const iso=new Date().toISOString();
async function step(name,fn){try{console.log('\n## '+name);await fn();}catch(e){console.log('!! ERR',name,e.message.split('\n')[0]);}}
const cashHist=async(p,name)=>{await p.getByText('상세',{exact:true}).first().click();await p.waitForTimeout(800);await p.getByText('현금성 자산').first().click();await p.waitForTimeout(900);
 await p.locator(`button:has-text("${name}")`).first().click();await p.waitForTimeout(700);await p.getByRole('button',{name:'입출금 내역'}).click();await p.waitForTimeout(800);};
(async()=>{const b=await L.chromium.launch(R);
await step('K1 [회귀②-a] JPY 연결 거래 삭제 다이얼로그 꼬리(¥1)',async()=>{
 const base=L.mk();base.cash=base.cash.map(c=>c.id==='j'?{...c,balance:200}:c);
 base.transactions=[{id:'t_j',stockId:'s3',ticker:'6758',stockName:'소니',type:'sell',quantity:1,price:1000,currency:'JPY',date:L.T,reflected:true,createdAt:iso}];
 base.stocks=base.stocks.map(s=>s.id==='s3'?{...s,quantity:9}:s);
 base.cashTransactions=[{id:'ctx_link_t_j',cashId:'j',type:'deposit',amount:1000,currency:'JPY',date:L.T,reflected:true,createdAt:iso}];
 const {ctx,p}=await L.open(b,{asset:base});
 await p.getByText('상세',{exact:true}).first().click();await p.waitForTimeout(800);await p.getByText('국내·해외 보유 종목').click();await p.waitForTimeout(1000);await p.locator('button:has-text("소니")').first().click();await p.waitForTimeout(800);await p.getByRole('button',{name:'거래내역'}).last().click();await p.waitForTimeout(900);await p.locator('button[title=삭제]').first().click();await p.waitForTimeout(700);
 console.log(' dialog:',(await p.locator('[role=dialog],[role=alertdialog]').last().innerText()).split('\n').filter(l=>/연결/.test(l)).join(' | '));
 await p.screenshot({path:SH+'4.58-qa-K1-jpy-delete-dialog-375.png'});
 await p.getByRole('button',{name:'삭제 + 롤백'}).click();await p.waitForTimeout(900);
 const d=await L.data(p);console.log(' toast',J(await p.locator('[data-sonner-toast]').allTextContents()),'j잔액',d.cash.find(c=>c.id==='j').balance,'ctx',d.cashTransactions.length);await ctx.close();});
for(const [cur,nm,bal0,amt] of [['JPY','엔화 계좌',500,1000],['KRW','증권 예수금',300,1000]])
await step(`K2 [회귀②-b/v4.57] ${cur} 반영 입금 기록 삭제 하한`,async()=>{
 const base=L.mk();base.cash=base.cash.map(c=>c.name===nm?{...c,balance:bal0}:c);const cid=base.cash.find(c=>c.name===nm).id;
 base.cashTransactions=[{id:'ctx_x1',cashId:cid,type:'deposit',amount:amt,currency:cur,date:L.T,reflected:true,reflectedAt:iso,reflectionId:'r1',createdAt:iso}];
 const {ctx,p}=await L.open(b,{asset:base});
 await cashHist(p,nm);await p.locator('button[title=삭제]').first().click();await p.waitForTimeout(700);
 console.log(' dialog:',(await p.evaluate(()=>document.body.innerText)).split('\n').filter(l=>/→|부족|되돌/.test(l)).join(' | '));
 await p.screenshot({path:SH+`4.58-qa-K2-${cur}-delete-375.png`});
 await p.getByRole('button',{name:'삭제',exact:true}).last().click();await p.waitForTimeout(900);
 const d=await L.data(p);console.log(' toast',J(await p.locator('[data-sonner-toast]').allTextContents()),'잔액',d.cash.find(c=>c.id===cid).balance,'기록',d.cashTransactions.length);await ctx.close();});
await step('K3 [v4.57 회귀] 현금 전액 출금 차단 / 전액-1 허용',async()=>{
 const base=L.mk();base.cash=[{id:'a',type:'bank',name:'생활비',balance:3000000,currency:'KRW'}];
 for(const amt of [3000000,2999999]){
  const {ctx,p}=await L.open(b,{asset:JSON.parse(JSON.stringify(base))});
  await p.evaluate(()=>window.dispatchEvent(new CustomEvent('trigger-add-cash-tx',{detail:{cashId:'a'}})));await p.waitForTimeout(900);
  const d=p.locator('[role=dialog]').last();await d.getByRole('button',{name:'출금',exact:true}).click();
  await d.locator('input').first().fill(String(amt));await p.waitForTimeout(400);
  console.log(' amt',amt,'폼 텍스트:',(await d.innerText()).split('\n').filter(l=>/부족|0원|남|1원|초과/.test(l)).join(' | '));
  await p.screenshot({path:SH+`4.58-qa-K3-cash-wd-${amt}-375.png`});
  await d.getByRole('button',{name:/출금 기록/}).click();await p.waitForTimeout(900);
  const dd=await L.data(p);console.log('  toast',J(await p.locator('[data-sonner-toast]').allTextContents()),'잔액',dd.cash[0].balance,'기록',dd.cashTransactions.length);await ctx.close();}});
await b.close();})();
