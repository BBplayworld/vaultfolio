const L=require('/home/user/vaultfolio/.memory/issues/4.56-103-cross-asset-flow/harness-qa/e2e58/lib.js');
const SH='/home/user/vaultfolio/.memory/issues/4.56-103-cross-asset-flow/screenshots/';
const R={proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined};
(async()=>{const b=await L.chromium.launch(R);
const cases=[['수십만',500000,'증권 예수금',2,80000],['수백만',5000000,'증권 예수금',10,80000],['억',123456789,'증권 예수금',10,8000000],['10억',1234567890,'한국투자증권 종합위탁 예수금 계좌',10,8000000]];
let fail=0;
for(const [w,dark] of [[320,false],[320,true],[375,false],[375,true],[1280,false],[1280,true]])for(const [lab,bal,name,q,pr] of cases){
 if((w!==320)&&(lab==='수십만'||lab==='수백만'))continue;
 const base=L.mk();base.cash=base.cash.map(c=>c.id==='a'?{...c,name,balance:bal}:c);
 const {ctx,p,errs}=await L.open(b,{w,dark,asset:base});
 await L.trade(p,{kind:'stock',id:'s1',type:'buy',qty:q,price:pr,link:name,submit:false});
 const row=p.locator('[data-testid=account-link-row]');await row.scrollIntoViewIfNeeded();
 const m=await p.evaluate(()=>{const pe=document.querySelector('[data-testid=cash-link-preview]');
  let clip=pe;const pr=pe.getBoundingClientRect();
  // 가장 가까운 overflow hidden 조상
  let a=pe.parentElement,ov=null;while(a){const o=getComputedStyle(a).overflowX;if(o!=='visible'){ov=a;break}a=a.parentElement}
  const ob=ov.getBoundingClientRect();
  const out={};for(const id of ['before','after']){const s=document.querySelector(`[data-testid=link-preview-${id}]`);const rs=[...s.getClientRects()];const r=s.getBoundingClientRect();
   out[id]={txt:s.textContent,rects:rs.length,w:Math.round(r.width),inside:r.right<=ob.right+0.5&&r.left>=ob.left-0.5,pRight:r.right<=pr.right+0.5};}
  const lh=parseFloat(getComputedStyle(pe).lineHeight);
  return {...out,lines:Math.round(pr.height/lh),pW:Math.round(pr.width),ovW:Math.round(ob.width),ovScroll:ov.scrollWidth>ov.clientWidth+1,docOver:document.documentElement.scrollWidth>window.innerWidth,tail:pe.innerText.replace(/\n/g,'|')};});
 const ok=m.before.rects===1&&m.after.rects===1&&m.before.inside&&m.after.inside&&m.before.pRight&&m.after.pRight&&!m.ovScroll&&!m.docOver&&!errs.length;
 if(!ok)fail++;
 console.log(w,dark?'dark':'light',lab,ok?'OK':'NG',JSON.stringify(m),errs.length?errs:'');
 await row.screenshot({path:SH+`4.58-qa-F4fix-${lab}-${w}-${dark?'dark':'light'}-row.png`});
 if(lab==='10억')await p.locator('[role=dialog]').last().screenshot({path:SH+`4.58-qa-F4fix-${lab}-${w}-${dark?'dark':'light'}-dialog.png`});
 await ctx.close();}
console.log('FAILS',fail);await b.close();})();
