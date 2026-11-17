"use client";

/**
 * hooks/use-stock-labels.ts
 * 주식 이름표·점검 기록(#239) 읽기·저장 훅 — 허브 카드와 불리기 화면이 함께 쓴다.
 *  - 값은 매번 저장소에서 읽는다(모듈 캐시 없음 — 체험 모드 격리). 마운트와 assetData 변경(동기화 pull·가져오기 뒤) 때 다시 읽는다
 *  - 저장 직후 notifyAssetUserEdit()를 직접 부른다. 이름표는 saveData를 거치지 않아 동기화 push 신호가 저절로 나가지 않는다
 *  - GA는 category만 보낸다(종목·개수·종류·주기 미전송). 체험 중 전송 차단은 track 안에서 처리된다
 */

import { useEffect, useMemo, useState } from "react";
import { notifyAssetUserEdit, useAssetData } from "@/contexts/asset-data-context";
import { track } from "@/lib/analytics/ga";
import {
  countValidLabels, emptyStockLabels, markStockChecked, readStockLabels, setStockLabel, setStockLabelCycle, writeStockLabels,
  type StockLabelBase, type StockLabelCycleMonths, type StockLabelKind, type StockLabels,
} from "@/lib/asset/stock-labels";

export interface StockLabelActionDeps {
  /** 동기화 push 신호 */
  notify: () => void;
  /** GA category 전송 */
  track: (category: "grow_label" | "grow_check") => void;
  now: () => string;
}

/**
 * 저장 동작(훅과 분리한 순수 조립 — 테스트 대상). 각 동작은 저장했으면 새 값을, 바뀐 게 없거나 쓰기에 실패했으면 null을 돌려준다.
 * 저장소의 지금 값에 편집을 얹어 쓴다(다른 탭·pull이 바꾼 값을 화면 state로 덮지 않게).
 */
export function stockLabelActions({ notify, track: send, now }: StockLabelActionDeps) {
  const commit = (edit: (cur: StockLabels) => StockLabels): { before: StockLabels; after: StockLabels } | null => {
    const before = readStockLabels();
    const after = edit(before);
    if (after === before) return null;
    try {
      writeStockLabels(after);
    } catch {
      return null;
    }
    notify();
    return { before, after };
  };
  return {
    /** base = 붙이는 순간의 기준값(화면이 grow-rows.buildLabelBase로 만들어 넘긴다 — 저장 모듈은 자산을 읽지 않는다) */
    setLabel(ticker: string, label: StockLabelKind | null, base?: StockLabelBase): StockLabels | null {
      const r = commit((cur) => setStockLabel(cur, ticker, label, now(), base));
      // 주 지표 — 저장소의 유효 이름표가 0개 → 1개가 된 저장 직후 1회(별도 플래그 키 없음)
      if (r && countValidLabels(r.before) === 0 && countValidLabels(r.after) > 0) send("grow_label");
      return r?.after ?? null;
    },
    markChecked(ticker: string): StockLabels | null {
      const r = commit((cur) => markStockChecked(cur, ticker, now()));
      if (r) send("grow_check");
      return r?.after ?? null;
    },
    setCycle(months: StockLabelCycleMonths): StockLabels | null {
      return commit((cur) => setStockLabelCycle(cur, months, now()))?.after ?? null;
    },
  };
}

export function useStockLabels() {
  const { assetData } = useAssetData();
  const [labels, setLabels] = useState<StockLabels>(emptyStockLabels);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLabels(readStockLabels());
    setReady(true);
  }, [assetData]);

  const actions = useMemo(() => {
    const a = stockLabelActions({
      notify: notifyAssetUserEdit,
      track: (category) => track("feature_use", { category }),
      now: () => new Date().toISOString(),
    });
    const show = (next: StockLabels | null) => { if (next) setLabels(next); };
    return {
      setLabel: (ticker: string, label: StockLabelKind | null, base?: StockLabelBase) => show(a.setLabel(ticker, label, base)),
      markChecked: (ticker: string) => show(a.markChecked(ticker)),
      setCycle: (months: StockLabelCycleMonths) => show(a.setCycle(months)),
    };
  }, []);

  return { labels, ready, ...actions };
}
