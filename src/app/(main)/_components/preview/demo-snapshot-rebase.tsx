"use client";

/**
 * 체험(#59)·미리보기 데모의 스냅샷을 실시간 시세 수준으로 맞춘다(4.94 R1). 화면 없음.
 * 대상: 체험 모드이거나 preview 배포이면서 주식·코인 id가 모두 `demo_`인 데이터만. 운영 사용자 데이터에는 아무것도 하지 않는다.
 * 기준(baseline)은 마운트 후 처음 읽은 스냅샷 — 이후 시세가 변할 때마다 baseline에서 다시 계산한다(누적 곱셈 없음).
 * 저장 대상은 체험은 메모리 Storage, preview는 그 브라우저 localStorage의 데모 스냅샷뿐.
 * 데모 이름표(#239)의 정한 날 가격도 같은 이유로 종목별 실시간 배율만큼 옮긴다 — 시드 그대로인 항목만, 동기화 신호 없음.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useAssetData, computeNetAsset } from "@/contexts/asset-data-context";
import { readDailySnapshots, readMonthlySnapshots } from "@/lib/asset/snapshot-storage";
import { STORAGE_KEYS } from "@/lib/local-storage";
import { isPreviewEnv } from "@/lib/cloud-sync/config";
import { isTrialMode } from "@/lib/trial/trial-mode";
import { pickRebaseRef, priceByLabelKey, rebaseDemoLabelPrices, rebaseDemoRows, rebaseRatio } from "@/lib/preview/demo-live-rebase";
import { loadDemoPayload } from "@/lib/preview/demo-inject";
import { parseStockLabels, readStockLabelsState, writeStockLabels, type StockLabels } from "@/lib/asset/stock-labels";
import type { DailyAssetSnapshot, MonthlyAssetSnapshot, Stock } from "@/types/asset";

const kstToday = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];

export function DemoSnapshotRebase() {
  const { assetData, exchangeRates, bumpSnapshotVersion } = useAssetData();
  const base = useRef<{ daily: DailyAssetSnapshot[]; monthly: MonthlyAssetSnapshot[]; ref: { stocks: number; crypto: number } } | null>(null);
  const applied = useRef({ ks: 1, kc: 1 });

  const eligible = useMemo(() => {
    if (!isTrialMode() && !isPreviewEnv()) return false;
    const held = [...assetData.stocks, ...assetData.crypto];
    return held.length > 0 && held.every((a) => a.id.startsWith("demo_"));
  }, [assetData.stocks, assetData.crypto]);
  const live = useMemo(() => computeNetAsset(assetData, exchangeRates), [assetData, exchangeRates]);

  useEffect(() => {
    if (!eligible) return;
    const today = kstToday();
    if (!base.current) {
      const daily = readDailySnapshots();
      const ref = pickRebaseRef(daily, today);
      if (!ref) return;
      base.current = { daily, monthly: readMonthlySnapshots(), ref };
    }
    const { daily, monthly, ref } = base.current;
    const ks = rebaseRatio(live.stockValue, ref.stocks);
    const kc = rebaseRatio(live.cryptoValue, ref.crypto);
    if (Math.abs(ks - applied.current.ks) < 0.002 && Math.abs(kc - applied.current.kc) < 0.002) return;
    applied.current = { ks, kc };
    try {
      // 앱이 오늘자로 새로 쓴 기록(날짜·월 기록일이 baseline과 다름)은 건드리지 않는다
      const merge = <T extends { date?: string }>(cur: T[], orig: T[], scaled: T[], key: (r: T) => string) => {
        const map = new Map(orig.map((r, i) => [key(r), { r, s: scaled[i] }]));
        return cur.map((r) => { const hit = map.get(key(r)); return hit && hit.r.date === r.date ? hit.s : r; });
      };
      const curDaily = readDailySnapshots();
      const curMonthly = readMonthlySnapshots();
      localStorage.setItem(STORAGE_KEYS.dailySnapshots, JSON.stringify(merge(curDaily, daily, rebaseDemoRows(daily, ref, ks, kc), (r) => r.date!)));
      localStorage.setItem(STORAGE_KEYS.monthlySnapshots, JSON.stringify(merge(curMonthly, monthly, rebaseDemoRows(monthly, ref, ks, kc), (r) => r.month)));
      bumpSnapshotVersion();
    } catch { /* 저장 실패 시 JSON 수준 유지 — 데모 표시만 영향 */ }
  }, [eligible, live.stockValue, live.cryptoValue, bumpSnapshotVersion]);

  // 데모 이름표 정한 날 가격 — 시드는 처음 한 번만 읽고(동적 import), 시세가 바뀔 때마다 시드에서 다시 계산한다
  const [labelSeed, setLabelSeed] = useState<{ labels: StockLabels; prices: Map<string, number> } | null>(null);
  useEffect(() => {
    if (!eligible || labelSeed) return;
    let alive = true;
    loadDemoPayload().then((payload) => {
      const labels = parseStockLabels(payload.stockLabels);
      const stocks = (payload.assetData as { stocks?: Stock[] } | undefined)?.stocks ?? [];
      if (alive && labels) setLabelSeed({ labels, prices: priceByLabelKey(stocks) });
    }).catch(() => { /* 시드 없음 — 표시만 영향 */ });
    return () => { alive = false; };
  }, [eligible, labelSeed]);
  useEffect(() => {
    if (!eligible || !labelSeed) return;
    const cur = readStockLabelsState();
    if (cur.state !== "ok") return;
    const next = rebaseDemoLabelPrices(cur.value, labelSeed.labels, labelSeed.prices, priceByLabelKey(assetData.stocks));
    if (next === cur.value) return;
    try {
      writeStockLabels(next);
      bumpSnapshotVersion();
    } catch { /* 저장 실패 시 시드 값 유지 — 데모 표시만 영향 */ }
  }, [eligible, labelSeed, assetData.stocks, bumpSnapshotVersion]);

  return null;
}
