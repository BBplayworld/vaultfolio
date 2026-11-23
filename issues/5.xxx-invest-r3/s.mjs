import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch();
for(const w of [390,320,1280]){const c=await b.newContext({viewport:{width:w,height:844}});const p=await c.newPage();
try{await p.goto('https://www.secretasset.xyz/?ga-optout=1',{timeout:30000});await p.goto('https://www.secretasset.xyz/?trial=1#invest',{timeout:30000});await p.waitForTimeout(4000);
const h=await p.evaluate(()=>document.documentElement.scrollHeight);console.log(w,h);
await p.screenshot({path:`screenshots/r3-${w}-full.png`,fullPage:true});}catch(e){console.log(w,'ERR',e.message.slice(0,100))}}
await b.close();
