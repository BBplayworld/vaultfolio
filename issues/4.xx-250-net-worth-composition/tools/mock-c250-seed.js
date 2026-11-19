// #250 목업 — 데모 금고를 상태별 '가짜 시드'로 바꾸는 주입(ui-designer, 2026-11-20). preview 브라우저 localStorage만 바꾼다. 코드 수정 0.
// window.c250seed(kind): kind = stocks | crypto | stocksCrypto | loan | stocksPhysical | stocksCash(상태 14) | stocksLoan(상태 15) | first(주식만, 기록 없음 = 첫 저장 당일)
// 스냅샷은 남긴 자산군만 더해 다시 쓴다(Hero 전일 대비가 빠진 자산군 때문에 큰 하락으로 보이지 않게). 상태 14·15는 기록에 현금·대출 0 → 저장 직후와 같은 '신규 현금/추가 대출'.
window.c250seed = (kind) => {
  const K = "secretasset_asset_data", ad = JSON.parse(localStorage.getItem(K));
  const has = { stocks: /stocks|first/i.test(kind), crypto: /crypto/i.test(kind), cash: kind === "stocksCash", loans: /loan/i.test(kind), physical: kind === "stocksPhysical" };
  if (kind === "loan") has.stocks = false;
  const out = { ...ad, realEstate: [], yearlyNetAssets: [],
    stocks: has.stocks ? ad.stocks : [], transactions: has.stocks ? ad.transactions : [],
    crypto: has.crypto ? ad.crypto : [], cryptoTransactions: has.crypto ? ad.cryptoTransactions : [],
    cash: has.cash ? ad.cash.slice(0, 1) : [], cashTransactions: [],
    loans: has.loans ? ad.loans : [], loanTransactions: [] };
  localStorage.setItem(K, JSON.stringify(out));
  const PHYS = "secretasset.physical_assets", physVal = 4200000;
  if (has.physical) localStorage.setItem(PHYS, JSON.stringify([{ id: "physical_1741000000000", type: "gold", name: "금 10돈", currentValue: physVal, purchasePrice: 3800000, purchaseDate: "2025-03-02" }]));
  else localStorage.removeItem(PHYS);
  const keepBefore = { stocks: has.stocks, crypto: has.crypto, cash: false, loans: kind === "loan", physical: has.physical };
  // C132: 데모 기록은 주식 평가가 어제와 같아 '변동 없음'이 되고, 같은 카드의 내 종목 줄(+4.0%)과 맞지 않는다 → 오늘 포함 일별 기록(Hero 기준 = 앱이 연 시점 기록)의 주식·코인을 1.2% 낮춰 오른 날로 둔다
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const fix = (rows) => rows.filter((r) => r.breakdown).map((r) => {
    const k = r.date && r.date <= today ? 0.988 : 1; const b = { ...r.breakdown, stocks: r.breakdown.stocks * k, crypto: r.breakdown.crypto * k }; const nb = { realEstate: 0, stocks: keepBefore.stocks ? b.stocks : 0, crypto: keepBefore.crypto ? b.crypto : 0, cash: 0, loans: keepBefore.loans ? b.loans : 0, tenantDeposit: 0, physical: keepBefore.physical ? physVal : 0 };
    const net = nb.stocks + nb.crypto + nb.cash + nb.physical - nb.loans; const { grade: _g, ...rest } = r;
    return { ...rest, netAsset: net, financialAsset: nb.stocks + nb.crypto + nb.cash, breakdown: nb, cost: r.cost ? { ...r.cost, realEstate: 0, stock: keepBefore.stocks ? r.cost.stock : 0, crypto: keepBefore.crypto ? r.cost.crypto : 0, physical: keepBefore.physical ? 3800000 : 0, total: (keepBefore.stocks ? r.cost.stock : 0) + (keepBefore.crypto ? r.cost.crypto : 0) + (keepBefore.physical ? 3800000 : 0) } : r.cost };
  });
  for (const k of ["secretasset_daily_snapshots", "secretasset_monthly_snapshots"]) {
    if (kind === "first") { localStorage.removeItem(k); continue; }
    localStorage.setItem(k, JSON.stringify(fix(JSON.parse(localStorage.getItem(k) || "[]"))));
  }
  localStorage.removeItem("secretasset_daily_archive");
  if (kind === "first") localStorage.removeItem("secretasset_last_visit_date");
  // Hero 기준 = 지난 접속일 기록. 오늘로 두면 앱이 연 시점에 오늘 기록을 다시 써서 늘 '변동 없음' → 어제 접속으로 둔다(C132 같은 카드 정합)
  else { const y = new Date(Date.now() + 9 * 3600e3 - 864e5).toISOString().slice(0, 10); localStorage.setItem("secretasset_last_visit_date", y); }
  return { stocks: out.stocks.length, crypto: out.crypto.length, cash: out.cash.length, loans: out.loans.length, physical: has.physical };
};
