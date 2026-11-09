const L=require('./lib.js');const SH='/home/user/vaultfolio/.memory/issues/4.56-103-cross-asset-flow/screenshots/';
const sum=(d)=>({cash:d.cash.map(c=>c.id+':'+c.balance),loans:d.loans.map(c=>c.id+':'+c.balance),ctx:d.cashTransactions.map(t=>t.id+'/'+t.type+'/'+t.amount),ltx:d.loanTransactions.map(t=>t.id+'/'+t.type+'/'+t.amount),tx:d.transactions.map(t=>t.id+'/'+t.type+'/'+t.quantity),ctxs:(d.cryptoTransactions||[]).map(t=>t.id+'/'+t.type),stocks:d.stocks.map(s=>s.id+':'+s.quantity),crypto:d.crypto.map(s=>s.id+':'+s.quantity)});
(async()=>{const b=await L.chromium.launch({proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined});
const cases=[
 ['E1 주식 매수 x 현금',{kind:'stock',id:'s1',type:'buy',qty:10,price:80000,link:'증권 예수금'}],
 ['E2 주식 매도 x 현금',{kind:'stock',id:'s1',type:'sell',qty:5,price:80000,link:'증권 예수금'}],
 ['E3 주식 매수 x 대출',{kind:'stock',id:'s1',type:'buy',qty:10,price:80000,link:'신용대출'}],
 ['E4 주식 매도 x 대출(상환)',{kind:'stock',id:'s1',type:'sell',qty:5,price:80000,link:'신용대출'}],
 ['E5 코인 매수 x 현금',{kind:'crypto',id:'c1',type:'buy',qty:0.01,price:50000000,link:'증권 예수금'}],
 ['E6 코인 매도 x 현금',{kind:'crypto',id:'c1',type:'sell',qty:0.01,price:50000000,link:'증권 예수금'}],
 ['E7 코인 매수 x 대출',{kind:'crypto',id:'c1',type:'buy',qty:0.01,price:50000000,link:'신용대출'}],
 ['E8 코인 매도 x 대출',{kind:'crypto',id:'c1',type:'sell',qty:0.01,price:50000000,link:'신용대출'}],
 ['E9 연결 없이 코인 저장(#107 회귀)',{kind:'crypto',id:'c1',type:'buy',qty:0.01,price:50000000}],
 ['E10 연결 없이 주식 저장',{kind:'stock',id:'s1',type:'buy',qty:1,price:80000}],
];
for(const [name,c] of cases){
 const {ctx,p,reqs,errs}=await L.open(b,{});
 const before=await L.data(p);
 const o=await L.trade(p,{...c,shot:SH+'4.58-qa-'+name.slice(0,2)+'-form-375.png'});
 const after=await L.data(p);
 console.log('\n##',name,JSON.stringify(o),'\n BEFORE',JSON.stringify(sum(before)),'\n AFTER ',JSON.stringify(sum(after)),'\n reqs',JSON.stringify(reqs.filter(r=>!r.includes('/api/quotes'))),errs.length?'ERRS '+errs:'');
 await ctx.close();}
await b.close();})();
