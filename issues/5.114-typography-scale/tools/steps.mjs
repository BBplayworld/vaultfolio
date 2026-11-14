export default [
  ["fab", async ({ p, check, esc, click }) => {
    await click('[aria-label="자산 업데이트"]'); await check("fab-hub");
    await click(p.getByRole("button", { name: /보유 현황 업데이트/ })); await check("fab-holdings");
    await click('[data-testid="fab-holdings-row-stock"]'); await check("fab-stock-update");
    await esc(3);
    await click('[aria-label="자산 업데이트"]'); await click(p.getByRole("button", { name: /보유 현황 업데이트/ })); await click('[data-testid="fab-holdings-row-real-estate"]'); await check("fab-realestate-update"); await esc(3);
    await click('[aria-label="자산 업데이트"]'); await click(p.getByRole("button", { name: /보유 현황 업데이트/ })); await click('[data-testid="fab-holdings-row-cash"]'); await check("fab-cash-update"); await esc(3);
    await click('[aria-label="자산 업데이트"]'); await click(p.getByRole("button", { name: /보유 현황 업데이트/ })); await click('[data-testid="fab-asset-physical"]'); await check("fab-physical"); await esc(3);
    await click('[aria-label="자산 업데이트"]'); await click(p.getByRole("button", { name: /매수\/매도 거래 기록/ })); await check("fab-trade");
    await click(p.getByRole("button", { name: /주식 매수·매도 기록/ })); await check("fab-trade-stock");
    await esc(4);
  }],
  ["more", async ({ p, check, esc, click, hash }) => {
    await hash("#more");
    await click('[data-testid="more-row-share-sync"]'); await check("more-share-sync");
    await click(p.getByRole("button", { name: /간편 공유/ })); await check("more-share-simple"); await esc(3);
    await click('[data-testid="more-row-share-sync"]'); await click(p.getByRole("button", { name: /기기 동기화/ })); await check("more-sync"); await esc(3);
    await click(p.getByRole("button", { name: /의견·요청/ })); await check("more-feedback"); await esc(2);
    await click(p.getByRole("button", { name: /앱 가이드/ })); await check("more-guide");
    await click(p.getByRole("button", { name: /앱 가이드 보기/ })); await check("more-app-guide"); await esc(3);
    await click(p.getByRole("button", { name: /앱 가이드/ })); await click('[data-testid="more-whats-new"]'); await check("more-whats-new"); await esc(3);
  }],
  ["settings", async ({ p, check, esc, click, hash }) => {
    await hash("#settings");
    await click(p.getByRole("button", { name: /앱 잠금 설정/ })); await check("set-lock"); await esc(2);
    await click('[data-testid="settings-row-notify-targets"]', { force: true }); await check("set-notify-targets"); await esc(2);
    await click('[data-testid="settings-row-delete-all"]'); await check("set-delete-all"); await esc(2);
  }],
  ["share-card", async ({ p, check, esc, click, hash }) => {
    await hash("");
    await click('[data-testid="top-bar-share-card"]'); await p.waitForTimeout(2000); await check("share-card"); await esc(2);
  }],
  ["detail", async ({ p, check, esc, click, hash }) => {
    await hash("#detail/stocks");
    await click('[data-testid="detail-list-box-stocks"] [data-testid^="stock-row-"]');
    await click(p.locator('[data-testid="detail-list-box-stocks"] button:has(svg.lucide-pencil)')); await check("detail-stock-edit"); await esc(2);
    await click(p.locator('[data-testid="detail-list-box-stocks"] button:has(svg.lucide-trash-2)')); await check("detail-stock-delete"); await esc(2);
    await click(p.getByRole("combobox")); await check("detail-sort-select"); await esc(1);
  }],
];
