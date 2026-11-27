"use client";

/**
 * hooks/use-cash-tx-tags.ts
 * 현금 거래 분류 표시(#329 받은 배당 기록) 읽기 훅 — 현금 거래내역 배지와 성과 › 배당 칩이 함께 쓴다.
 *  - 값은 매번 저장소에서 읽는다(모듈 캐시 없음 — 체험 모드 격리). 마운트와 assetData 변경(저장·삭제·동기화 pull·가져오기 뒤) 때 다시 읽는다
 *  - 돌려주는 값은 살아 있는 현금 거래와 조인한 배당 표시뿐이다(거래가 사라진 항목·모르는 분류는 빠진다)
 *  - 쓰기는 이 훅에 없다. 저장은 컨텍스트의 addCashTransaction·addCashTransactionWithBalance(tag 인자)가 거래와 함께 한다
 */

import { useEffect, useState } from "react";
import { useAssetData } from "@/contexts/asset-data-context";
import { readDividendTags, type DividendTag } from "@/lib/asset/cash-tx-tags";

export function useDividendTags(): Record<string, DividendTag> {
  const { assetData } = useAssetData();
  const [tags, setTags] = useState<Record<string, DividendTag>>({});

  useEffect(() => {
    setTags(readDividendTags(assetData.cashTransactions ?? []));
  }, [assetData]);

  return tags;
}
