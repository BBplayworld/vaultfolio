"use client";

/**
 * hooks/use-stock-labels.ts
 * 주식 이름표·점검 기록(#239) 읽기·저장 훅 — 허브 카드와 불리기 화면이 함께 쓴다.
 *  - 값은 매번 저장소에서 읽는다(모듈 캐시 없음 — 체험 모드 격리). 마운트와 assetData 변경(동기화 pull·가져오기 뒤) 때 다시 읽는다
 *  - 저장 직후 notifyAssetUserEdit()를 직접 부른다. 이름표는 saveData를 거치지 않아 동기화 push 신호가 저절로 나가지 않는다
 *  - GA는 category만 보낸다(종목·개수·종류·주기·조건 값·메모 미전송). 체험 중 전송 차단은 track 안에서 처리된다
 *    grow_label(·정함) = 유효 이름표 0→1, grow_check(·점검) = 점검 기록 1건 생성, grow_plan(·조건) = 다시 볼 조건 0→1
 *    — 이 셋은 **주식 키만** 본다(#242). 주식 외(코인·부동산·실물)는 grow_other_label(·주식 외 정함) = 이 기기의 저장으로 주식 외 유효 이름표 0→1 하나로만 잰다
 */

import { useEffect, useMemo, useState } from "react";
import { notifyAssetUserEdit, useAssetData } from "@/contexts/asset-data-context";
import { track } from "@/lib/analytics/ga";
import {
  countStockPlans as countPlans, countValidLabels, countValidOtherLabels, emptyStockLabels, labelKeyKind, readStockLabels, recordReview, setStockLabel, setStockLabelCycle, setStockPlan, writeStockLabels,
  type StockLabelBase, type StockLabelCycleMonths, type StockLabelKind, type StockLabelPlan, type StockLabels, type StockReviewChoice, type StockReviewHit,
} from "@/lib/asset/stock-labels";

export interface StockLabelActionDeps {
  /** 동기화 push 신호 */
  notify: () => void;
  /** GA category 전송 */
  track: (category: "grow_label" | "grow_check" | "grow_plan" | "grow_other_label") => void;
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
  // 정함 지표 2개 — 주식 키 0→1은 ·정함, 주식 외 키 0→1은 ·주식 외 정함(이 기기에서 누른 저장에만. 동기화로 받은 항목은 이 경로를 거치지 않는다)
  const sendLabeled = (r: { before: StockLabels; after: StockLabels }) => {
    if (countValidLabels(r.before) === 0 && countValidLabels(r.after) > 0) send("grow_label");
    if (countValidOtherLabels(r.before) === 0 && countValidOtherLabels(r.after) > 0) send("grow_other_label");
  };
  return {
    /** base = 붙이는 순간의 기준값(화면이 grow-rows.buildLabelBase로 만들어 넘긴다 — 저장 모듈은 자산을 읽지 않는다) */
    setLabel(ticker: string, label: StockLabelKind | null, base?: StockLabelBase): StockLabels | null {
      const r = commit((cur) => setStockLabel(cur, ticker, label, now(), base));
      // 주 지표 — 저장소의 유효 이름표가 0개 → 1개가 된 저장 직후 1회(별도 플래그 키 없음)
      if (r) sendLabeled(r);
      return r?.after ?? null;
    },
    /**
     * 점검 한 장의 선택 — 기록·이름표·점검 시각을 한 번의 쓰기로(recordReview). snap = 그때 시세·산 날부터 %(화면이 행 값으로 넘긴다).
     * 첫 결정(이름표 없음 → 오래 둘·점검할)은 기록 없이 이름표만 쓴다
     */
    record(ticker: string, choice: StockReviewChoice, snap: { price: number; rate: number } | null, base?: StockLabelBase, hit?: StockReviewHit): StockLabels | null {
      const r = commit((cur) => recordReview(cur, ticker, choice, now(), snap, base, hit));
      if (!r) return null;
      sendLabeled(r);
      // ·점검은 주식 기록만(코인·부동산·실물 점검은 섞지 않는다)
      if (labelKeyKind(ticker) === "stock" && (r.after.reviews?.length ?? 0) > 0 && r.after.reviews !== r.before.reviews) send("grow_check");
      return r.after;
    },
    /** 다시 볼 조건·메모 — 저장소의 조건이 0개 → 1개가 된 저장 직후 1회 grow_plan(값·메모는 보내지 않는다) */
    setPlan(ticker: string, plan: Pick<StockLabelPlan, "down" | "up" | "months" | "memo">): StockLabels | null {
      const r = commit((cur) => setStockPlan(cur, ticker, plan, now()));
      if (r && countPlans(r.before) === 0 && countPlans(r.after) > 0) send("grow_plan");
      return r?.after ?? null;
    },
    setCycle(months: StockLabelCycleMonths): StockLabels | null {
      return commit((cur) => setStockLabelCycle(cur, months, now()))?.after ?? null;
    },
  };
}

/** 저장소 값과 읽기 완료 여부 — 자산 데이터가 바뀔 때(동기화 수신 포함) 다시 읽는다 */
function useStockLabelsState() {
  const { assetData } = useAssetData();
  const [labels, setLabels] = useState<StockLabels>(emptyStockLabels);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLabels(readStockLabels());
    setReady(true);
  }, [assetData]);

  return { labels, ready, setLabels };
}

/** 읽기 전용(#245) — 상세·주식 행 표시·종목 한 장 머리·홈 팁처럼 결정을 읽기만 하는 화면용. 쓰기·GA 결선이 없다 */
export function useStockLabelsRead(): { labels: StockLabels; ready: boolean } {
  const { labels, ready } = useStockLabelsState();
  return { labels, ready };
}

export function useStockLabels() {
  const { labels, ready, setLabels } = useStockLabelsState();

  const actions = useMemo(() => {
    const a = stockLabelActions({
      notify: notifyAssetUserEdit,
      track: (category) => track("feature_use", { category }),
      now: () => new Date().toISOString(),
    });
    const show = (next: StockLabels | null) => { if (next) setLabels(next); };
    return {
      setLabel: (ticker: string, label: StockLabelKind | null, base?: StockLabelBase) => show(a.setLabel(ticker, label, base)),
      record: (ticker: string, choice: StockReviewChoice, snap: { price: number; rate: number } | null, base?: StockLabelBase, hit?: StockReviewHit) => show(a.record(ticker, choice, snap, base, hit)),
      setPlan: (ticker: string, plan: Pick<StockLabelPlan, "down" | "up" | "months" | "memo">) => show(a.setPlan(ticker, plan)),
      setCycle: (months: StockLabelCycleMonths) => show(a.setCycle(months)),
    };
  }, [setLabels]);

  return { labels, ready, ...actions };
}
