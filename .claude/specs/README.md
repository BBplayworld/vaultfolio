# .claude/specs/ — 기능 명세

**무엇을·왜 만드는가**를 구현 전에 확정하는 곳. 코드가 아니라 **의도**를 기록한다.

## 문서 계층

| 계층 | 위치 | 답하는 질문 |
| --- | --- | --- |
| 규칙 | [CLAUDE.md](../../CLAUDE.md) | 항상 지켜야 할 것은? |
| 사실 | [`_knowledge/`](../_knowledge/) | 지금 코드가 어떻게 되어 있나? |
| **의도** | **`specs/`** | **이번에 무엇을 왜 만드나?** |
| 절차 | [`skills/`](../skills/) | 어떻게 작업하나? |

> 코드를 읽으면 알 수 있는 것 = `_knowledge/`
> 코드를 읽어도 알 수 없는 것(왜 이렇게 정했나·무엇을 일부러 안 했나) = `specs/`
> 다음에 또 할 행동의 순서 = `skills/`

**기존 기능의 현행 사양은 여기 없다.** [qa-full-test-plan.md](../_knowledge/qa-full-test-plan.md)의 `F-*` 매트릭스가 그 역할을 한다(기능별 핵심·엣지·회귀). specs는 **앞으로의 변경**만 다룬다.

---

## 명세를 쓸지 판정 (하나라도 해당 → 명세 필수)

- [ ] `src/types/asset.ts`의 `assetDataSchema` 또는 자산 5종 스키마 필드 추가·변경
- [ ] `src/lib/local-storage.ts` `STORAGE_KEYS`에 신규 키 추가
- [ ] 공유 토큰 pack/unpack 직렬화 포맷 변경 (R3)
- [ ] cloud-sync payload·`getComparablePayloadString` 변경 (R14)
- [ ] `one-time-migrations.ts`에 마이그레이션 추가
- [ ] 새 자산 타입·카테고리 ([dev-rules.md](../_knowledge/dev-rules.md) 6단계 체크리스트 발동)
- [ ] 새 API 라우트 또는 외부 API 연동 추가
- [ ] 2개 이상 화면(탭/뷰)에 **새 기능**이 생김

**하나도 해당 없으면 명세 없이 바로 진행한다.** 오타·색상·문구·단일 컴포넌트 수정·스키마 무관 버그 픽스는 기존대로 `/diagnose` → `/refactor-scope`.

**파일 수는 기준이 아니다.** 기존 동작 개선·규칙 통일·리팩토링은 10개 파일을 건드려도 명세 대상이 아니다(이미 `refactor-scope`가 영향 범위를 통제한다). 판정의 축은 **"새로운 데이터나 기능이 생기는가"** 이지 변경 규모가 아니다.

<details>
<summary>소급 판정 예시 (기준 보정 근거)</summary>

| 과거 작업 | 판정 | 근거 |
| --- | --- | --- |
| 백업 리마인더 | 명세 ✅ | `STORAGE_KEYS` 2개 신규 + `clearAssetData` keepKeys 정책 판단 필요 |
| 성적표 이력화 | 명세 ✅ | 스냅샷 타입에 `grade` 필드 추가(저장 포맷 변경) |
| InfoHint `summary` 필수화 | 명세 ❌ | 6개 파일을 고쳤지만 새 데이터·기능 없음. 규칙 통일 |
| 상세 탭 연환산 수익률 | 명세 ❌ | 4개 파일이지만 기존 필드로 계산만 추가, 저장 무영향 |
| 홈 전일 대비 기준 불일치 | 명세 ❌ | 단일 파일 버그 픽스 |

</details>

과한 프로세스는 실패다. 판정은 추측이 아니라 **코드를 실제로 열어** 한다.

---

## 추적 ID

`[#4.x]`는 커밋 여러 개가 공유하는 **이터레이션 단위**다(예: `[#4.12]` = 6개 커밋). 명세도 같은 입도 — **1 이터레이션 = 1 명세**.

```
S-4.19 ─┬─ .claude/specs/4.19-deposit-maturity.md   ← 의도·수용기준
        ├─ 브랜치  issue-4.19-deposit-maturity       (기존 규칙 그대로)
        ├─ 커밋    [#4.19] ...                       (기존 규칙 그대로, N개가 1 ID 공유)
        ├─ changelog.md  "### … (issue-4.19)"        (기존 규칙 그대로)
        └─ qa-full-test-plan.md  F-*  /  (회귀 시) R{n}
```

- 새로 도입한 것은 문서 표기용 `S-` 접두사뿐. **브랜치·커밋에는 쓰지 않는다.**
- `F-*`는 기능(영속), `S-*`는 변경 이터레이션(1회성). N:M이며 연결선은 명세 §6이 만든다.
- 번호는 `4.` 뒤 정수 순차 증가. `git log`로 최신 번호를 확인해 다음 번호를 쓴다.

---

## 워크플로

```
/spec  →  plan 모드 + /refactor-scope  →  구현  →  /spec-check  →  /qa-full-test
  ↑ 판정 통과 시에만                                  ↑ 명세가 있을 때만
```

버그 픽스 경로는 변경 없음: `/diagnose` → `/refactor-scope` → 구현.

상태: `초안` → `승인` → `구현중` → `완료`
완료 후에도 파일을 남긴다 (`~/.claude/plans/`와 달리 삭제하지 않음 — 이력 보존이 목적).

---

## 인덱스

| ID | 기능 | 상태 | 브랜치 | F-* |
| --- | --- | --- | --- | --- |
| [S-4.18](./4.18-asset-report-card.md) | 자산 성적표(5축 별점·트로피) | 완료 | `issue-4.18-award` | F-REPORT |
| [S-4.19](./4.19-deposit-maturity.md) | 예적금 만기일·금리 | 초안 | `issue-4.19-deposit-maturity` | F-CASH(예정) |
| [S-4.20](./4.20-upbit-crypto-price.md) | 업비트 코인 시세 자동 갱신 | 완료 | `issue-4.20-upbit-crypto-price` | F-CRYPTO |
| [S-4.21](./4.21-realestate-transaction-price.md) | 부동산 실거래가 연동 | 승인 | `issue-4.21-realestate-price` | F-REALESTATE(예정) |
| [S-4.22](./4.22-cash-transactions.md) | 현금 입출금 거래내역(소득·저축 유입) | 완료 | `issue-4.19` | F-CASH-TX |
| [S-4.23](./4.23-tax-calendar.md) | 세금 신고 안내(자산 기반 월별 캘린더) | 승인 | `issue-4.20` | F-TAX(예정) |
| [S-4.24](./4.24-loan-transactions.md) | 대출 상환/추가 대출(마이너스통장) 거래내역 | 완료 | `issue-4.24-loan-transactions` | F-LOAN-TX |
| [S-4.25](./4.25-crypto-transactions.md) | 암호화폐 매수/매도 거래내역 | 완료 | `issue-4.21` | F-CRYPTO-TX(예정) |
| [S-4.29](./4.29-onboarding-wizard.md) | 스크린샷 일괄 온보딩 마법사 | 완료 | `issue-4.29-onboarding-wizard` | F-ONBOARD-WIZARD |
| [S-4.30](./4.30-asset-refresh-fab.md) | 자산 최신화(FAB 통합 카드 화면·병합형 갱신) | 구현중 | `issue-4.30-asset-refresh-fab` | F-ASSET-REFRESH |
