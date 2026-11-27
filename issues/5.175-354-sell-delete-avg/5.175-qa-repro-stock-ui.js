const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const SHOT = process.argv[2]; const W = +process.argv[3] || 375; const CASE = process.argv[4] || '1';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: W, height: 900 }, timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
  await ctx.route('**/*', (r) => { const u = r.request().url(); if (!u.startsWith('http://localhost:4375') || u.includes('/api/')) return r.abort(); return r.continue(); });
  const data = { realEstate: [], stocks: [{ id: 's1', category: 'domestic', name: '삼성전자', ticker: '005930', quantity: 10, averagePrice: 100, currentPrice: 150, currency: 'KRW', purchaseDate: '2026-01-01', baseDate: '2099-01-01' }],
    crypto: [], cash: [], loans: [], yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [], lastUpdated: '2026-11-27T00:00:00Z', nickname: '' };
  await ctx.addInitScript((d) => { if (!localStorage.getItem('__qa_seeded')) { localStorage.setItem('secretasset_asset_data', JSON.stringify(d)); localStorage.setItem('__qa_seeded', '1'); } }, data);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const store = async () => JSON.parse(await p.evaluate(() => localStorage.getItem('secretasset_asset_data')));
  const s = (n) => p.screenshot({ path: `${SHOT}/5175-${W}-stock${CASE}-${n}.png`, fullPage: false });
  const pos = async (label) => { const st = (await store()).stocks[0]; console.log(label, JSON.stringify({ q: st.quantity, avg: st.averagePrice, src: st.positionSource })); };
  await p.goto('http://localhost:4375/#detail/stocks'); await p.waitForTimeout(2500);
  await s('00-list');
  await pos('시작');
  await p.getByRole('button', { name: '거래내역' }).first().click(); await p.waitForTimeout(1200);
  const trade = async (type, qty, price, tag) => {
    await p.getByRole('button', { name: /거래 입력/ }).first().click(); await p.waitForTimeout(700);
    if (await p.getByText('직접 입력', { exact: true }).count()) { await p.getByText('직접 입력', { exact: true }).click(); await p.waitForTimeout(400); }
    const dlg = p.getByRole('dialog');
    await dlg.getByRole('button', { name: type, exact: true }).click();
    if (qty === 'all') await dlg.getByRole('button', { name: '전량' }).click();
    else await dlg.locator('label:has-text("수량")').first().locator('xpath=..').locator('input').first().fill(String(qty));
    await dlg.locator('label:has-text("체결 단가")').first().locator('xpath=ancestor::div[contains(@class,"space-y")][1]').locator('input[type=text],input[inputmode]').first().fill(String(price)).catch(async () => {
      await dlg.locator('label:has-text("체결 단가")').first().locator('xpath=../..').locator('input').first().fill(String(price)); });
    await p.waitForTimeout(400);
    await s(tag + '-form');
    await dlg.getByRole('button', { name: type + ' 기록' }).click(); await p.waitForTimeout(1200);
    if (await p.getByRole('dialog').count()) { await s(tag + '-after-submit'); console.log('dialog remains:', (await p.getByRole('dialog').first().innerText()).replace(/\n/g,' | ').slice(0,400)); }
  };
  if (CASE === '2') { await trade('매수', 10, 120, '01-buy'); await pos('매수 후'); }
  if (CASE === '3') { await trade('매도', 4, 130, '02-sell'); await pos('일부 매도 후'); } else { await trade('매도', 'all', 130, '02-sell'); await pos('전량 매도 후'); }
  await s('03-trades-after-sell');
  // 매도 삭제: 첫 줄(최신)이 매도
  await p.getByRole('button', { name: '거래 삭제' }).first().click(); await p.waitForTimeout(700);
  await s('04-delete-confirm');
  console.log('확인창:', (await p.getByRole('dialog').first().innerText()).replace(/\n/g,' | '));
  await p.getByTestId('tx-delete-confirm-ok').click().catch(async () => { await p.getByRole('dialog').getByRole('button', { name: /삭제/ }).first().click(); });
  await p.waitForTimeout(1200);
  await pos('매도 삭제 후');
  await p.goto('http://localhost:4375/#detail/stocks'); await p.waitForTimeout(2000);
  await s('05-detail-after-delete');
  console.log('상세:', (await p.locator('body').innerText()).replace(/\n/g,' | ').slice(0,420));
  console.log('ERR', errs);
  await b.close();
})();
