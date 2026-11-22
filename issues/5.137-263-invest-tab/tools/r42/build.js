// r3.js·r41.js 를 함수 범위로 감싸 한 페이지에서 함께 쓰게 만든다(시안 전용, 코드 아님). 사용: node build.js
const fs = require('fs'), path = require('path');
const rd = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const strip = s => s.replace(/\nrender\(\);\s*$/, '\n');
let r3 = strip(rd('r3/r3.js')).split("Q.get('yr')").join("Q.get('ryr')");
let r41 = strip(rd('r41/r41.js'));
fs.writeFileSync(path.join(__dirname, 'gen-r3.js'), `window.R3=(function(){${r3}\nreturn {ST,cur,mainChart,headline,listHTML,tableHTML,srcHTML,tblSec,IDXSEL,TOP,readout,ovBtn,ovMenu,PH,fp};})();`);
fs.writeFileSync(path.join(__dirname, 'gen-r41.js'), `window.R41=(function(){${r41}\nreturn {ST,d,gridCard,periodCard,periodSVG,fixSE,Q,LAST};})();`);
