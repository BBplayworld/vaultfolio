const L=require('./lib.js');const SH='/home/user/vaultfolio-4.56'.length&&'/home/user/vaultfolio/.memory/issues/4.56-103-cross-asset-flow/screenshots/';
const J=JSON.stringify;
const R={proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined};
const bal=(d)=>J({cash:d.cash.map(c=>c.id+':'+c.balance),loans:d.loans.map(c=>c.id+':'+c.balance),ctx:d.cashTransactions.length,ltx:d.loanTransactions.length,tx:d.transactions.length});
async function step(name,fn){try{console.log('\n## '+name);await fn();}catch(e){console.log('!! ERR',name,e.message.split('\n')[0]);}}
(async()=>{const b=await L.chromium.launch(R);
const A=(o)=>L.mk(o);
await step('F1 현금 하한(KRW): 잔액 800000, 80만 매수 전액',async()=>{
 const {ctx,p}=await L.open(b,{asset:A({cash:[{id:'a',type:'bank',name:'증권 예수금',balance:800000,currency:'KRW'}]})});
 const o=await L.trade(p,{kind:'stock',id:'s1',type:'buy',qty:10,price:80000,link:'증권 예수금',submit:false,shot:SH+'4.58-qa-F1-zero-375.png'});console.log(J(o));
 const d=await p.locator('[role=dialog]').last().getByRole('button',{name:/매수 기록/}).click();await p.waitForTimeout(800);
 console.log(' toast',J(await p.locator('[data-sonner-toast]').allTextContents()),'저장 후',bal(await L.data(p)));await ctx.close();});
await step('F2 현금 하한: 잔액 800001 → 1원 남김 허용',async()=>{
 const {ctx,p}=await L.open(b,{asset:A({cash:[{id:'a',type:'bank',name:'증권 예수금',balance:800001,currency:'KRW'}]})});
 const o=await L.trade(p,{kind:'stock',id:'s1',type:'buy',qty:10,price:80000,link:'증권 예수금'});console.log(J(o),bal(await L.data(p)));await ctx.close();});
await step('F3 대출 하한 0원: 대출 300000, 매도 300000 상환',async()=>{
 const {ctx,p}=await L.open(b,{asset:A({loans:[{id:'l',type:'credit',name:'신용대출',balance:300000,interestRate:3,startDate:'2025-01-01'}]})});
 const o=await L.trade(p,{kind:'stock',id:'s1',type:'sell',qty:5,price:60000,link:'신용대출',shot:SH+'4.58-qa-F3-loan0-375.png'});console.log(J(o),bal(await L.data(p)));await ctx.close();});
await step('F3b 대출 초과 상환 차단: 대출 300000, 매도 400000',async()=>{
 const {ctx,p}=await L.open(b,{asset:A({loans:[{id:'l',type:'credit',name:'신용대출',balance:300000,interestRate:3,startDate:'2025-01-01'}]})});
 const o=await L.trade(p,{kind:'stock',id:'s1',type:'sell',qty:5,price:80000,link:'신용대출',shot:SH+'4.58-qa-F3b-loan-over-375.png'});console.log(J(o),bal(await L.data(p)));await ctx.close();});
await step('G1 지난달 날짜: 행 숨김, 복귀 시 연결 안 함',async()=>{
 const {ctx,p}=await L.open(b,{});const pm=L.kst(-12);
 const o=await L.trade(p,{kind:'stock',id:'s1',type:'buy',qty:1,price:80000,link:'증권 예수금',date:pm,submit:false,shot:SH+'4.58-qa-G1-pastdate-375.png'});console.log(' 지난달('+pm+') 행 수',J(o.rowCount),'(link 시도 불가=0이면 숨김)');
 await p.locator('[role=dialog]').last().locator('input[type=date]').fill(L.T);await p.waitForTimeout(500);
 console.log(' 이번달 복귀 행 수',await p.locator('[data-testid=account-link-row]').count(),'선택값',await p.locator('[data-testid=account-link-select]').innerText());await ctx.close();});
await step('H1 USD 주식: 후보=달러 계좌만(대출 없음)',async()=>{
 const {ctx,p}=await L.open(b,{});
 const o=await L.trade(p,{kind:'stock',id:'s2',type:'buy',qty:2,price:200,link:'__peek',submit:false});console.log(J(o));
 await p.locator('[data-testid=account-link-select]').click();await p.getByRole('option',{name:'달러 계좌'}).click();await p.waitForTimeout(600);
 console.log(' preview',J(await p.locator('[data-testid=cash-link-preview]').allTextContents()));await p.screenshot({path:SH+'4.58-qa-H1-usd-375.png'});
 await p.locator('[role=dialog]').last().getByRole('button',{name:/매수 기록/}).click();await p.waitForTimeout(900);
 console.log(' toast',J(await p.locator('[data-sonner-toast]').allTextContents()),(await L.data(p)).cash.map(c=>c.id+':'+c.balance).join(),(await L.data(p)).cashTransactions.map(t=>t.currency+t.amount).join());await ctx.close();});
await step('H2 JPY 주식 후보',async()=>{
 const {ctx,p}=await L.open(b,{});
 const o=await L.trade(p,{kind:'stock',id:'s3',type:'buy',qty:10,price:1000,link:'엔화 계좌',submit:false});console.log(J(o));await p.screenshot({path:SH+'4.58-qa-H2-jpy-375.png'});await ctx.close();});
await step('J1 [회귀①] JPY 현금 전액 연결 매수 → zero 차단',async()=>{
 const {ctx,p}=await L.open(b,{});
 const o=await L.trade(p,{kind:'stock',id:'s3',type:'buy',qty:10,price:10000,link:'엔화 계좌',shot:SH+'4.58-qa-J1-jpy-zero-375.png'});console.log(J(o),bal(await L.data(p)));await ctx.close();});
await step('J1b JPY 잔액-1엔 남기는 매수는 허용(¥100,000→¥1)',async()=>{
 const {ctx,p}=await L.open(b,{});
 const o=await L.trade(p,{kind:'stock',id:'s3',type:'buy',qty:1,price:99999,link:'엔화 계좌',shot:SH+'4.58-qa-J1b-jpy-leave1-375.png'});console.log(J(o),bal(await L.data(p)));await ctx.close();});
await b.close();})();
