const L=require('./lib.js');const SH='/home/user/vaultfolio/.memory/issues/4.56-103-cross-asset-flow/screenshots/';
const J=(x)=>JSON.stringify(x);
const S=(d)=>J({cash:d.cash.map(c=>c.id+':'+c.balance),loans:d.loans.map(c=>c.id+':'+c.balance),ctx:d.cashTransactions.map(t=>t.id.slice(0,22)+'/'+t.type+'/'+t.amount),ltx:d.loanTransactions.map(t=>t.id.slice(0,22)+'/'+t.type+'/'+t.amount),tx:d.transactions.length,crtx:(d.cryptoTransactions||[]).length,s1:d.stocks.find(s=>s.id==='s1')?.quantity,c1:d.crypto[0]?.quantity});
const R={proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined};
async function step(name,fn){try{console.log('\n## '+name);await fn();}catch(e){console.log('!! ERR',name,e.message.split('\n')[0]);}}
(async()=>{const b=await L.chromium.launch(R);
// D1 주식 매수(현금) 삭제
await step('D5 코인 연결 후 삭제',async()=>{
 const {ctx,p}=await L.open(b,{});const d0=await L.data(p);
 await L.trade(p,{kind:'crypto',id:'c1',type:'buy',qty:0.01,price:50000000,link:'증권 예수금'});console.log(' saved',S(await L.data(p)));
 await p.getByText('상세',{exact:true}).first().click();await p.waitForTimeout(800);await p.getByText('보유 코인').click();await p.waitForTimeout(1000);
 await p.locator('button:has-text("비트코인")').first().click();await p.waitForTimeout(1000);
  await p.getByRole('button',{name:'매수/매도 내역'}).first().click();await p.waitForTimeout(1000);
 await p.locator('button[title=삭제]').first().click();await p.waitForTimeout(700);
 console.log(' dialog:',(await p.evaluate(()=>document.body.innerText)).split('\n').filter(l=>/연결된|롤백|삭제/.test(l)).join(' | '));
 await p.screenshot({path:SH+'4.58-qa-D5-delete-dialog-375.png'});
 await p.getByRole('button',{name:'삭제',exact:true}).last().click();await p.waitForTimeout(900);
 console.log(' toast:',J(await p.locator('[data-sonner-toast]').allTextContents()));
 const d2=await L.data(p);console.log(' after',S(d2),'시작',S(d0));await ctx.close();});
await b.close();})();
