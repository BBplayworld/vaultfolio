const L=require('./lib.js');const SH='/home/user/vaultfolio/.memory/issues/4.56-103-cross-asset-flow/screenshots/';
const J=JSON.stringify;const R={proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined};const M=1e6;const Y=L.kst(-1);
(async()=>{const b=await L.chromium.launch(R);
const asset=()=>L.mk({stocks:[{id:'s1',category:'domestic',name:'삼성전자',ticker:'005930',quantity:100,averagePrice:70000,currentPrice:80000,currency:'KRW',purchaseDate:Y}],crypto:[],cash:[{id:'a',type:'bank',name:'증권 예수금',balance:10*M,currency:'KRW'}],loans:[{id:'l',type:'credit',name:'신용대출',balance:5*M,interestRate:3,startDate:'2025-01-01'}]});
const snap={date:Y,netAsset:12*M,financialAsset:17*M,breakdown:{realEstate:0,stocks:7*M,crypto:0,cash:10*M,loans:5*M,tenantDeposit:0,physical:0},fx:{USD:1400,JPY:900},fxBase:{USD:0,JPY:0},cost:{total:7*M,stock:7*M,crypto:0,realEstate:0,physical:0}};
for(const [nm,c] of [['연결 매수(현금)',{type:'buy',qty:10,price:80000,link:'증권 예수금'}],['연결 매수(대출)',{type:'buy',qty:10,price:80000,link:'신용대출'}],['연결 안 함 매수',{type:'buy',qty:10,price:80000}]]){
 for(const w of [375,1280]){
 const {ctx,p}=await L.open(b,{w,asset:asset(),snaps:[snap]});
 await L.trade(p,{kind:'stock',id:'s1',...c});await p.waitForTimeout(500);
 await p.getByText('홈',{exact:true}).first().click().catch(()=>{});await p.waitForTimeout(800);
 const btn=p.locator('button[aria-label="변동 원인 보기"]');let open=false;if(await btn.count()){await btn.first().click();await p.waitForTimeout(600);open=true;}
 const r=await p.evaluate(()=>{const cap=document.querySelector('[data-testid="home-cause-offset-caption"]');const list=[...document.querySelectorAll('ul.max-w-xs li')].map(l=>l.textContent.replace(/\s+/g,' ').trim());return {cap:cap?.textContent||null,items:list,hscroll:document.documentElement.scrollWidth>innerWidth};});
 console.log(nm,w,'open',open,J(r));
 await p.screenshot({path:SH+`4.58-qa-N1-home-${nm.slice(0,5).replace(/[ ()]/g,'')}-${w}.png`});await ctx.close();}}
await b.close();})();
