const { chromium } = require('/opt/node-tools/node_modules/playwright');
const S=process.argv[2]; const W=Number(process.argv[3]||375); const TH=process.argv[4]||'dark';
const HOST='https://secretasset-git-issue-467-bbplayworlds-projects.vercel.app';
(async()=>{
const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:W,height:800}});
await ctx.addCookies([{name:'theme_mode', value:TH, url:'https://secretasset-git-issue-467-bbplayworlds-projects.vercel.app'}]);
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,120)));
await p.addInitScript(()=>{ localStorage.setItem('secretasset_tutorial_status', JSON.stringify({1:"skipped",2:"skipped",3:"skipped",4:"skipped",5:"skipped"})); });
await p.goto(HOST+'/?demo=1',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(6000);
await p.screenshot({path:`${S}/w${W}-${TH}-0-home.png`});
const nav = async (t)=>{ const l=p.locator(`text=${t}`).first(); await l.click({timeout:5000}); await p.waitForTimeout(900); };
try { await nav('성과'); } catch(e){ console.log('nav 성과 fail', e.message.slice(0,80)); }
try { await p.locator('text=/^9\/28 → 10\/28$|결산$/').first().click({timeout:5000}); await p.waitForTimeout(1500); } catch(e){ console.log('nav 자산 변화 fail', e.message.slice(0,400)); }
if (!(await p.locator('[data-testid=settlement-root]').count())) { try { await p.getByRole('radio', {name:'월'}).first().click({timeout:4000}); await p.waitForTimeout(1200);} catch(e){ console.log('월 탭 fail', e.message.slice(0,80)); } }
await p.screenshot({path:`${S}/w${W}-${TH}-1-settlement.png`, fullPage:true});
const btn = p.locator('[data-testid=monthly-log-button]');
console.log('button count', await btn.count());
if (await btn.count()) {
  console.log('button text', await btn.innerText());
  const bb = await btn.boundingBox(); console.log('button h', bb && bb.height);
  const order = await p.evaluate(()=>{ const q=s=>document.querySelector(`[data-testid=${s}]`); const a=q('composition-block'), m=q('monthly-log-button'), ai=q('settlement-ai-button');
    const pos=(x,y)=>x&&y? !!(x.compareDocumentPosition(y)&Node.DOCUMENT_POSITION_FOLLOWING):null; return {compBeforeLog:pos(a,m), logBeforeAi:pos(m,ai), hasComp:!!a}; });
  console.log('order', JSON.stringify(order));
  const ls0 = await p.evaluate(()=>JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k).length])));
  await btn.click(); await p.waitForTimeout(900);
  await p.screenshot({path:`${S}/w${W}-${TH}-2-sheet.png`});
  const info = await p.evaluate(()=>{ const t=document.querySelector('[data-testid=monthly-log-table]'); if(!t) return null;
    return { sw:t.scrollWidth, cw:t.clientWidth, rows:[...t.querySelectorAll('tbody tr')].map(r=>r.getAttribute('data-kind')+':'+r.innerText.replace(/\s+/g,' ')), heads:[...t.querySelectorAll('thead th')].map(h=>h.innerText.replace(/\s+/g,'')),
      cap: document.querySelector('[data-testid=monthly-log-caption]')?.innerText, legacy: !!document.querySelector('[data-testid=monthly-log-note-legacy]'), bodyOverflow: document.documentElement.scrollWidth > window.innerWidth }; });
  console.log('sheet', JSON.stringify(info, null, 1));
  const stick = await p.evaluate(()=>{ const t=document.querySelector('[data-testid=monthly-log-table]'); const m=t.querySelector('thead th'); const n=t.querySelector('[data-testid=monthly-log-head-netAsset]'); const a=[m.getBoundingClientRect().left,n.getBoundingClientRect().right]; t.scrollLeft=9999; const b=[m.getBoundingClientRect().left,n.getBoundingClientRect().right]; return {before:a, after:b, scrollLeft:t.scrollLeft, box:[t.getBoundingClientRect().left,t.getBoundingClientRect().right], sheetW: document.querySelector('[data-testid=monthly-log-sheet] > div')?.getBoundingClientRect().width}; });
  console.log('sticky', JSON.stringify(stick));
  await p.screenshot({path:`${S}/w${W}-${TH}-2b-scrolled.png`});
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  console.log('closed', await p.locator('[data-testid=monthly-log-sheet]').count()===0, 'focus', await p.evaluate(()=>document.activeElement?.getAttribute('data-testid')));
  const ls1 = await p.evaluate(()=>JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k).length])));
  console.log('localStorage same', ls0===ls1); if(ls0!==ls1){ const A=Object.fromEntries(JSON.parse(ls0)), B=Object.fromEntries(JSON.parse(ls1)); console.log('ls diff', JSON.stringify(Object.keys({...A,...B}).filter(k=>A[k]!==B[k]).map(k=>[k,A[k],B[k]]))); }
}
console.log('pageerrors',errs);
await b.close();})();
