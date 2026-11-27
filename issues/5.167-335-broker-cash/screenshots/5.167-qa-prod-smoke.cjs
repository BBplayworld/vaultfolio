// v5.165 운영 스모크 1회: 테스트 브라우저 localStorage에 데모 모양 데이터만, 금고·동기화 미설정
const fs = require('fs');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const BASE = 'https://www.secretasset.xyz';
const SH = '/home/user/vaultfolio/.memory/issues/5.167-335-broker-cash/screenshots/5.167-qa-prod-';
const d = JSON.parse(fs.readFileSync('/tmp/claude-0/-home-user-vaultfolio/35b35548-5942-5886-b0bd-2d4a3cbe1dd9/scratchpad/q5167/fx-rules2.json'));
d.secretasset_stock_display_currency = 'KRW';
d['secretasset.physical_assets'] = JSON.stringify([{ id: 'p1', type: 'other', name: '한정판 기계식 시계 컬렉션 세트', currentValue: 1234567890, purchasePrice: 1111111111, purchaseDate: '2024-01-01' }, { id: 'p2', type: 'gold', name: '골드바', currentValue: 4900000, purchasePrice: 4000000, purchaseDate: '2024-01-01' }]);
const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 19);
const L = (k, v) => console.log(`[${kst()}]`, k, typeof v === 'string' ? v : JSON.stringify(v));
const W = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let docs = 0; const blocked = [], nonGet = [], pe = [], cerr = [];
  const mk = async (w, theme) => {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
    await ctx.addCookies([{ name: 'theme_mode', value: theme, url: BASE }]);
    const p = await ctx.newPage();
    p.on('pageerror', e => pe.push(String(e).slice(0, 200)));
    p.on('console', m => { if (m.type() === 'error') cerr.push(m.text().slice(0, 140)); });
    p.on('request', r => { if (r.resourceType() === 'document') docs++; if (r.method() !== 'GET') nonGet.push(r.method() + ' ' + r.url().slice(0, 90)); });
    p.on('response', r => { if (r.status() === 403 || r.headers()['x-vercel-mitigated']) blocked.push(r.status() + ' ' + r.url().slice(0, 90)); });
    return { ctx, p };
  };
  const stop = async (why) => { L('STOP', why); L('blocked', blocked); await b.close(); process.exit(2); };
  const first = async (p) => { const r = await p.goto(BASE + '/?ga-optout=1', { waitUntil: 'domcontentloaded', timeout: 60000 }); const s = { s: r.status(), mit: r.headers()['x-vercel-mitigated'] || null }; if (s.s !== 200 || s.mit) await stop('first ' + JSON.stringify(s)); await W(3000); return s; };
  const seed = async (p, o) => { await p.evaluate(o => { const keep = Object.fromEntries(Object.keys(localStorage).filter(k => /ga|optout/i.test(k)).map(k => [k, localStorage.getItem(k)])); localStorage.clear(); for (const k in keep) localStorage.setItem(k, keep[k]); for (const k in o) localStorage.setItem(k, o[k]); }, o); await p.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 }); await W(1500); };
  const toDetail = async (p, tab) => { await p.locator('button:visible', { hasText: '상세' }).first().click(); await W(800); await p.locator(':visible', { hasText: new RegExp(`^${tab}$`) }).last().click(); await W(1500); };
  const openBlock = async (p) => { const t = p.locator('[data-testid=broker-totals-toggle]'); if (!(await t.count())) return false; if ((await t.getAttribute('aria-expanded')) !== 'true') { await t.click(); await W(600); } return true; };
  const rows = (p) => p.evaluate(() => { const hit = (a, b) => a.right > b.left + 0.5 && a.left < b.right - 0.5 && a.bottom > b.top + 0.5 && a.top < b.bottom - 0.5; return { docOv: document.documentElement.scrollWidth - document.documentElement.clientWidth, rows: [...document.querySelectorAll('[data-testid=broker-row]')].map(r => { const c = r.querySelector('[data-testid=broker-row-cash]'); const btn = r.querySelector('[data-testid=broker-row-resync]'); const v = r.querySelector('[data-testid=broker-row-value]'); const rr = r.getBoundingClientRect(); const right = v?.parentElement.getBoundingClientRect(); return { b: r.dataset.broker, cash: c?.textContent ?? null, ov: r.scrollWidth - r.clientWidth, cashHit: c && right ? hit(c.getBoundingClientRect(), right) || (btn ? hit(c.getBoundingClientRect(), btn.getBoundingClientRect()) : false) : null, btn: btn ? { w: Math.round(btn.getBoundingClientRect().width), h: Math.round(btn.getBoundingClientRect().height), spill: Math.round(btn.getBoundingClientRect().right - rr.right) } : null }; }) }; });
  const cat = async (p, label) => { await p.locator('[data-testid=stock-category-row] button', { hasText: new RegExp(`^${label}`) }).first().click(); await W(800); };
  const fab = async (p, kind) => { await p.locator('button:visible', { hasText: '자산 업데이트' }).last().click(); await W(700); await p.locator('button:visible', { hasText: '보유 현황 업데이트' }).last().click(); await W(800); await p.locator('button:visible', { hasText: new RegExp(`^${kind}`) }).last().click(); await W(800); };
  const listOpts = (p) => p.evaluate(() => { const c = document.querySelector('[role=listbox]'); return { groups: [...c.querySelectorAll('[role=group]')].map(g => [g.querySelector('[data-slot=select-label]')?.textContent || g.firstElementChild?.textContent, g.querySelectorAll('[role=option]').length]), total: c.querySelectorAll('[role=option]').length, gita: [...c.querySelectorAll('[role=option]')].filter(o => o.textContent.trim() === '기타').length, ov: Math.round(c.getBoundingClientRect().right - innerWidth) }; });
  const news = async (p) => { await p.locator('#tool-menu-trigger').click({ timeout: 10000 }); await W(800); await p.locator(':visible', { hasText: /^앱 가이드 · 새 소식$/ }).last().click(); await W(1000); const c = p.locator('[role=dialog] button:visible, [role=dialog] [role=tab]:visible', { hasText: /^새 소식/ }); if (await c.count()) { await c.first().click(); await W(1000); } return p.evaluate(() => { const dl = [...document.querySelectorAll('[role=dialog]')].pop(); const t = dl?.innerText || ''; return { has: t.includes('증권사 현금도 증권사 이름으로'), hasBody: t.includes('그 증권사 현금이 함께 보여요'), head: t.replace(/\s+/g, ' ').slice(0, 160) }; }); };

  // A: 일반(데모 모양 데이터) 375 다크
  const A = await mk(375, 'dark');
  L('A first', await first(A.p));
  L('A optout', await A.p.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => /ga|optout/i.test(k)).map(k => [k, localStorage.getItem(k)]))));
  await seed(A.p, d);
  await A.p.evaluate(() => { location.hash = '#more'; }); await W(1500); await A.p.getByText('설정', { exact: true }).last().click(); await W(1200);
  L('C144 version', await A.p.evaluate(() => (document.body.innerText.match(/v\d+\.\d+/g) || []).slice(0, 3)));
  await A.p.evaluate(() => { location.hash = ''; }); await W(1200);
  await toDetail(A.p, '주식'); L('A block', await openBlock(A.p));
  L('A 전체 KRW 375', await rows(A.p)); await A.p.locator('[data-testid=broker-totals]').screenshot({ path: SH + 'broker-375-dark.png' }).catch(e => L('shot', String(e).slice(0, 80)));
  await A.p.setViewportSize({ width: 360, height: 900 }); await W(900); L('A 전체 360', await rows(A.p)); await A.p.screenshot({ path: SH + 'broker-360-dark.png' });
  await A.p.setViewportSize({ width: 1280, height: 900 }); await W(1000); L('A 전체 1280', await rows(A.p)); await A.p.locator('[data-testid=broker-totals]').screenshot({ path: SH + 'broker-1280-dark.png' }).catch(() => {});
  await A.p.setViewportSize({ width: 375, height: 900 }); await W(700);
  await cat(A.p, '국내'); await openBlock(A.p); L('A 국내', await rows(A.p)); await A.p.screenshot({ path: SH + 'domestic-375-dark.png' });
  // 실물 360
  await A.p.setViewportSize({ width: 360, height: 900 }); await A.p.locator('button:visible', { hasText: '상세' }).first().click().catch(() => {}); await W(500);
  await A.p.locator(':visible', { hasText: /^실물 자산$/ }).last().click(); await W(1200);
  L('A 실물 360', await A.p.evaluate(() => ({ docOv: document.documentElement.scrollWidth - document.documentElement.clientWidth, cards: [...document.querySelectorAll('[data-testid^=physical-card-]')].map(card => { const meta = card.querySelector('.text-primary.tabular-nums')?.closest('span.text-sm'); const pt = card.querySelector('[data-testid=profit-text]'); if (!meta || !pt) return card.dataset.testid + ' NOSEL'; const rr = pt.parentElement.getBoundingClientRect(); let hit = 0; for (const el of [meta, ...meta.querySelectorAll('span')]) for (const rc of el.getClientRects()) { const x = Math.min(rc.right, rr.right) - Math.max(rc.left, rr.left); const y = Math.min(rc.bottom, rr.bottom) - Math.max(rc.top, rr.top); if (x > 0.5 && y > 0.5) hit = Math.max(hit, Math.round(x)); } return card.dataset.testid.slice(14) + ' hit' + hit; }) })));
  await A.p.screenshot({ path: SH + 'phys-360-dark.png' });
  // 새 소식(일반)
  await A.p.setViewportSize({ width: 375, height: 900 }); await W(500);
  L('A news', await news(A.p)); await A.p.screenshot({ path: SH + 'news-375-dark.png' }); await A.p.keyboard.press('Escape'); await W(400); await A.p.keyboard.press('Escape'); await W(400);
  // 현금 입력 Select
  await fab(A.p, '현금성 자산'); await A.p.locator('button:visible', { hasText: '직접 입력' }).first().click(); await W(800);
  if (!(await A.p.locator('[role=combobox]:visible', { hasText: /금융기관/ }).count())) { await A.p.locator('button:visible', { hasText: '새 계좌 추가' }).first().click(); await W(800); }
  await A.p.locator('[role=combobox]:visible', { hasText: /금융기관/ }).first().click(); await W(600);
  L('A cash select', await listOpts(A.p)); await A.p.screenshot({ path: SH + 'cash-select-375-dark.png' });
  await A.p.keyboard.press('Escape'); await W(300); await A.p.keyboard.press('Escape'); await W(300); await A.p.keyboard.press('Escape'); await W(500);
  // 대출 입력 Select
  await fab(A.p, '대출'); const di = A.p.locator('button:visible', { hasText: '직접 입력' }); if (await di.count()) { await di.first().click(); await W(800); }
  if (!(await A.p.locator('[role=combobox]:visible', { hasText: /금융기관|기관/ }).count())) { const add = A.p.locator('button:visible', { hasText: /새 대출 추가|대출 추가|추가/ }); if (await add.count()) { await add.first().click(); await W(800); } }
  const lt = A.p.locator('[role=combobox]:visible', { hasText: /금융기관|기관/ }).first();
  if (await lt.count()) { await lt.click(); await W(600); L('A loan select', await listOpts(A.p)); await A.p.screenshot({ path: SH + 'loan-select-375-dark.png' }); } else L('A loan select', 'NOTFOUND');
  await A.p.keyboard.press('Escape'); await W(300); await A.p.keyboard.press('Escape'); await W(300); await A.p.keyboard.press('Escape'); await W(500);
  // 달러 보기
  await A.p.evaluate(() => localStorage.setItem('secretasset_stock_display_currency', 'USD')); await A.p.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 }); await W(1500);
  await toDetail(A.p, '주식'); await openBlock(A.p); L('A 전체 USD', await rows(A.p)); await A.p.screenshot({ path: SH + 'usd-375-dark.png' });
  // B: 체험 1280 라이트
  const B = await mk(1280, 'light');
  L('B first', await first(B.p));
  await B.p.getByText('직접 둘러보기').first().click(); await W(3500);
  L('B news(trial)', await news(B.p)); await B.p.screenshot({ path: SH + 'news-trial-1280-light.png' });
  L('docs', docs); L('nonGET', nonGet); L('blocked', blocked); L('pageerror', pe); L('console err', [...new Set(cerr)].slice(0, 6));
  await b.close();
})().catch(e => { console.error('FAIL', String(e).slice(0, 500)); process.exit(1); });
