const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const SHOT = process.argv[2]; const W = +process.argv[3] || 375;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: W, height: 900 }, timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
  await ctx.route('**/*', (r) => { const u = r.request().url(); if (!u.startsWith('http://localhost:4375') || u.includes('/api/')) return r.abort(); return r.continue(); });
  const data = { realEstate: [], stocks: [{ id: 's1', category: 'domestic', name: '삼성전자', ticker: '005930', quantity: 0, averagePrice: 0, currentPrice: 150, currency: 'KRW', purchaseDate: '2026-01-01', baseDate: '2099-01-01', positionSource: 'computed' }],
    crypto: [{ id: 'k1', name: '비트코인', symbol: 'BTC', quantity: 10, averagePrice: 100, currentPrice: 150, purchaseDate: '2026-01-01', baseDate: '2099-01-01' }],
    cash: [], loans: [{ id: 'l1', type: 'credit', name: '신용대출A', balance: 0, interestRate: 5, startDate: '2025-01-01' }], yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [], lastUpdated: '2026-11-27T00:00:00Z', nickname: '' };
  await ctx.addInitScript((d) => { if (!localStorage.getItem('__qa_seeded')) { localStorage.setItem('secretasset_asset_data', JSON.stringify(d)); localStorage.setItem('__qa_seeded', '1'); } }, data);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const store = async () => JSON.parse(await p.evaluate(() => localStorage.getItem('secretasset_asset_data')));
  const s = (n, full = false) => p.screenshot({ path: `${SHOT}/5175-${W}-coin-${n}.png`, fullPage: full });
  const pos = async (l) => { const d = await store(); const c = d.crypto.find((x) => x.id === 'k1'); console.log(l, JSON.stringify({ q: c.quantity, avg: c.averagePrice, tx: (d.cryptoTransactions || []).length })); };
  await p.goto('http://localhost:4375/#detail/crypto'); await p.waitForTimeout(2500);
  await p.locator('[data-testid="detail-list-box-crypto"] button').filter({ hasText: '비트코인' }).first().click(); await p.waitForTimeout(400);
  await p.getByRole('button', { name: /내역/ }).first().click(); await p.waitForTimeout(1200);
  const sell = async (qty, tag) => {
    await p.getByRole('button', { name: /매수\/매도 기록/ }).click(); await p.waitForTimeout(600);
    const dlg = p.getByRole('dialog');
    await dlg.getByRole('button', { name: '매도', exact: true }).click();
    if (qty === 'all') await dlg.getByRole('button', { name: '전량' }).click();
    else await dlg.locator('label:has-text("수량")').locator('xpath=..').locator('input').first().fill(String(qty));
    await dlg.locator('label:has-text("체결 단가")').locator('xpath=..').locator('input').first().fill('130');
    await p.waitForTimeout(300);
    await dlg.getByRole('button', { name: '매도 기록' }).click(); await p.waitForTimeout(1500);
    const open = await p.getByRole('dialog').count();
    const toasts = await p.locator('[data-sonner-toast]').allInnerTexts();
    console.log(tag, '제출 후 다이얼로그 열림=', open > 0, '토스트=', JSON.stringify(toasts));
    await s(tag);
    if (open) { await p.getByRole('dialog').getByRole('button', { name: '취소' }).click(); await p.waitForTimeout(500); }
  };
  await sell('all', '01-fullsell-submit'); await pos('전량 매도 제출 후 저장');
  await p.goto('http://localhost:4375/#detail/crypto'); await p.waitForTimeout(1800);
  await s('02-detail-after-fullsell', true);
  console.log('상세(코인):', (await p.locator('body').innerText()).replace(/\n/g, ' | ').slice(0, 300));
  // 통제군: 일부 매도 4 → 삭제
  await p.locator('[data-testid="detail-list-box-crypto"] button').filter({ hasText: '비트코인' }).first().click(); await p.waitForTimeout(400);
  await p.getByRole('button', { name: /내역/ }).first().click(); await p.waitForTimeout(1200);
  await sell(4, '03-partial-submit'); await pos('일부 매도 4 후');
  await p.getByRole('button', { name: '거래 삭제' }).first().click(); await p.waitForTimeout(600);
  await s('04-partial-delete-confirm');
  console.log('확인창:', (await p.locator('div.fixed.inset-0').last().innerText()).replace(/\n/g, ' | '));
  await p.locator('div.fixed.inset-0').last().getByRole('button', { name: '삭제' }).click(); await p.waitForTimeout(1200);
  await pos('일부 매도 삭제 후');
  // 통제군: 주식 0주 행·대출 완납 구역
  await p.goto('http://localhost:4375/#detail/stocks'); await p.waitForTimeout(1800); await s('05-stock-zero-row', true);
  console.log('주식 0주:', (await p.locator('body').innerText()).replace(/\n/g, ' | ').slice(0, 260));
  await p.goto('http://localhost:4375/#detail/loans'); await p.waitForTimeout(1800); await s('06-loan-paidoff', true);
  console.log('대출:', (await p.locator('body').innerText()).replace(/\n/g, ' | ').slice(0, 260));
  console.log('ERR', errs);
  await b.close();
})();
