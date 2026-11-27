#!/bin/bash
Q=/tmp/claude-0/-home-user-vaultfolio/35b35548-5942-5886-b0bd-2d4a3cbe1dd9/scratchpad/qa5166
cd $Q/app
m() { local name="$1" file="$2" expr="$3"; local base=$(basename "$file")
  cp "$Q/orig/$base" "$file"; sed -i -E "$expr" "$file"
  if cmp -s "$Q/orig/$base" "$file"; then echo "[$name] 변이 미적용(패턴 불일치)"; return; fi
  local res=$(npx vitest run src/lib/__tests__/data-safety-5166.test.ts "src/app/(main)/_components/__tests__/dividend-received-5166.test.tsx" 2>&1)
  echo "[$name] $(echo "$res" | grep -E "Tests " | tr -s ' ') :: $(echo "$res" | grep -E "^ *(×|FAIL)" | sed -E 's/^ *//' | cut -c1-110 | sort -u | head -6 | tr '\n' ';')"
  cp "$Q/orig/$base" "$file"; }
m "M1 재-push 결선 제거" src/lib/cloud-sync/sync-client.ts 's/mergedAdditions \|\| stockLabelsRepush \|\| cashTxTagsRepush/mergedAdditions || stockLabelsRepush/'
m "M2 재-push 비교에서 조인 제거" src/lib/asset/cash-tx-tags.ts 's/repush: merge && !sameCashTxTags\(joinCashTxTags\(merged, ids\), joinCashTxTags\(incoming, ids\)\)/repush: merge \&\& !sameCashTxTags(merged, incoming)/'
m "M3 필드 없는 수신이 로컬을 지움" src/lib/asset/cash-tx-tags.ts 's/if \(!merge \|\| local.state !== "ok"\) return \{ repush: false \};/clearCashTxTags(); return { repush: false };/'
m "M4 수신 병합 대신 교체" src/lib/asset/cash-tx-tags.ts 's/const merged = local.value \? mergeCashTxTags\(local.value, incoming\) : incoming;/const merged = incoming;/'
m "M5 내보내기 조인 제거" src/lib/asset/cash-tx-tags.ts 's/const joined = joinCashTxTags\(r.value, live\);/const joined = r.value;/'
m "M6 모르는 v 수용" src/lib/asset/cash-tx-tags.ts 's/if \(!isObj\(value\) \|\| value.v !== 1\) return null;/if (!isObj(value)) return null;/'
m "M7 손상 로컬을 pull이 덮음" src/lib/asset/cash-tx-tags.ts 's/if \(!merge\) writeCashTxTags\(incoming\);/writeCashTxTags(incoming);/'
m "M8 위험 키·접두 검사 제거" src/lib/asset/cash-tx-tags.ts 's/const item = TX_ID.test\(k\) \? parseItem\(v\) : null;/const item = parseItem(v);/'
m "M9 거래 삭제 시 표시 제거 누락" src/contexts/asset-data-context.tsx 's/if \(ok\) removeCashTxTags\(\[txId\]\); \/\/ 분류 표시\(#329\)도 함께 제거//'
m "M10 전체 삭제 clear 누락" "src/app/(main)/_components/header-menu/settings-page.tsx" 's/^ *clearCashTxTags\(\);.*$//'
m "M11 clearAssetData 뒤 표시도 삭제(키 접두 변경)" src/lib/asset/asset-storage.ts 's/cashTxTagsRepush = applyIncomingCashTxTags\(p.cashTxTags, \{ merge: mergeStockLabels, live: validated.cashTransactions \?\? \[\] \}\).repush;/cashTxTagsRepush = applyIncomingCashTxTags(p.cashTxTags, { merge: mergeStockLabels, live: [] }).repush;/'
m "M12 export에 표시 누락" src/lib/asset/asset-storage.ts 's/, \.\.\.\(cashTxTags \? \{ cashTxTags \} : \{\}\) \};/ };/'
m "M13 맵에 금액 저장" src/lib/asset/cash-tx-tags.ts 's/const item: CashTxTag = \{ kind: "dividend",/const item: CashTxTag = { kind: "dividend", amount: 1,/'
m "M14 합계에 출금 포함" src/lib/finance/received-dividend.ts 's/t\.type !== "deposit"/false/'
m "M15 저장 순서: 표시 쓰기 실패 무시" src/contexts/asset-data-context.tsx 's/^        return false;$/        \/\/ swallowed/'
