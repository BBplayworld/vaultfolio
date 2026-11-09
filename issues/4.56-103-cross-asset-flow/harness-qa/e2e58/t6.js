const L=require('./lib.js');const SH='/home/user/vaultfolio/.memory/issues/4.56-103-cross-asset-flow/screenshots/';
const J=JSON.stringify;const R={proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined};
(async()=>{const b=await L.chromium.launch(R);
const cases=[['수십만',500000,'증권 예수금',2,80000],['수백만',5000000,'증권 예수금',10,80000],['억',123456789,'증권 예수금',10,8000000],['10억',1234567890,'한국투자증권 종합위탁 예수금 계좌',10,8000000]];
for(const w of [320,375])for(const [lab,bal,name,q,pr] of cases){
 const base=L.mk();base.cash=base.cash.map(c=>c.id==='a'?{...c,name,balance:bal}:c);
 const {ctx,p}=await L.open(b,{w,asset:base});
 await L.trade(p,{kind:'stock',id:'s1',type:'buy',qty:q,price:pr,link:name,submit:false});
 const row=p.locator('[data-testid=account-link-row]');await row.scrollIntoViewIfNeeded();
 const m=await p.evaluate(()=>{const pe=document.querySelector('[data-testid=cash-link-preview]');const sp=pe.querySelector('span.whitespace-nowrap');const lh=parseFloat(getComputedStyle(pe).lineHeight);
  return {t:pe.innerText.slice(-34),lines:Math.round(pe.getBoundingClientRect().height/lh),spW:Math.round(sp.getBoundingClientRect().width),pW:Math.round(pe.getBoundingClientRect().width),clipped:sp.getBoundingClientRect().right>pe.getBoundingClientRect().right+1};});
 console.log(w,lab,J(m));
 if(w===320)await row.screenshot({path:SH+`4.58-qa-P2-preview-${lab}-320.png`});
 await ctx.close();}
await b.close();})();
