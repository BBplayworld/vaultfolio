# #107 핫픽스 판정 (PR #108, hotfix-107 aff6cca) — cto(COO) 2026-11-09

## 권고: 위임 머지 가 — 운영 저장 실패 2건 수정, qa PASS, main(00e19e7 v4.56)과 충돌 0
- 근거: 11/09 대표 결정 "핫픽스 팀 위임 머지"(위험 등급 무관, qa PASS·COO PASS·Vercel success·스모크 계획). risk:medium 유지.

## 머지 가능성
- `git merge-tree origin/main origin/hotfix-107` 충돌 0. hotfix 변경 6파일(crypto-tx-input·cash-tx-input·cash-tx-view·cash-tx-utils+테스트 2)과 4.56(#58·#103A, d9ef0d7..00e19e7) 변경 파일 교집합 0. 공용 맵·상수 확장 없음(C45 해당 없음).
- 머지 커밋 = aff6cca 기반 squash, Vercel preview success(qa 확인).

## COO 사용자 관점 점검
| 항목 | 판정 |
|---|---|
| 1 숫자 상식 | PASS — 전액 출금은 저장 전 차단·안내, 반영 입금 삭제는 1원 고정+다이얼로그로 사전 고지 |
| 2 부호·과대 항목 | PASS — 집계 로직 변경 0 |
| 3 라벨 | PASS(관찰) — USD 계좌 전액 차단 문구 "0원" 표기. 의미 전달됨, 후속 정리 |
| 4 다음 행동 | PASS — "반영을 끄고 기록하거나 출금액을 줄여 주세요" |
| 5 대표 지적 재발 | PASS — 스키마·저장 키·동기화·서버 전송 0, 투자 조언 0 |
| C43 표시 버전 | PASS — `[#4.57]` ≥ main 4.56 |

## qa 관찰 처리 (모두 머지 비차단)
- USD "0원" 문구: 사소, 데이터 영향 0 → 다음 릴리스 정리.
- USD 부동소수 잔액(0.00999…): 기존 차감 방식, 표시 $0.01·유효값 → 다음 릴리스 반올림.
- cashBalanceFloor ↔ issue-4.56 `CASH_FLOOR`(main엔 아직 없음) 중복, JPY 하한 차이(hotfix 0.01 / 4.56 1) → #103 ②③ 릴리스가 main 병합할 때 `CASH_FLOOR`로 통합.

## 후속 영향
- 열린 릴리스 issue-4.56(#103 ②③)은 squash 제목을 **`[#4.58]`**로 재배정(C43). 병합 시 crypto-tx-input.tsx 충돌 예상(merge-tree 확인) → developer 해소 + 통합.

## 운영 스모크 (머지 직후 qa)
1. 코인 직접입력 '즉시 반영' 저장 성공(토스트·보유 반영)
2. 현금 반영 전액 출금 → 저장 전 차단 문구, 잔액 불변 / 잔액-1원 출금 허용
3. 반영 입금 삭제로 0 이하 → 다이얼로그 "1원만 남아요", 잔액 1원·삭제 성공
이상 시 squash 커밋 revert(스키마 변경 0, 롤백 손실 없음).

## squash 제목
`[#4.57] 핫픽스 — 코인 즉시 반영 저장 차단·현금 0원 저장 실패(#107)`
