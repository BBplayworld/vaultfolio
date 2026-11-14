# 푸시 키 유출 대응 절차 (운영)

기준: origin/main 코드(`src/lib/push/prefix.ts`·`crypto.ts`·`send.ts`·`cron-run.ts`, `src/lib/cache-storage.ts`), 2026-11-14. 이 문서에는 비밀값을 쓰지 않는다. 점검 근거: `issues/4.91-179-market-push/5.110-push-data-security-check.md` M2.

## 0. 공통
- 역할: **[대표]** = Vercel·Upstash 콘솔 작업(값 생성·등록·삭제), **[팀]** = 확인·코드·공지·기록. 새 값은 대표가 직접 생성하고 채팅·이슈·메모리에 붙여 넣지 않는다.
- Production 범위에만 새 값을 넣고 Preview 값과 다르게 유지한다(M1 분리 유지). Vercel 환경 변수는 **변경 후 재배포해야 반영**된다.
- 값 생성: PUSH_STORE_KEY = 무작위 32바이트 base64 (`openssl rand -base64 32`, 코드는 32바이트가 아니면 미설정 취급 -> 구독 503). CRON_SECRET = 충분히 긴 무작위 문자열. VAPID = `npx web-push generate-vapid-keys`.
- Redis(Upstash) 키 패턴 (운영 접두어 `push:prod:`, 코드는 `VERCEL_ENV`로 계산):
  - `push:prod:sub:{id}` 구독 1건 (id = HMAC 64자 hex, 값 = 암호화 blob + 종류·조건)
  - `push:prod:all` 전체 id 집합, `push:prod:topic:{알림종류}` 종류별 id 집합
  - `push:prod:sent:{종류}:{날짜}` 중복 발송 플래그(3일), `push:prod:testlock:{id}` preview 전용 잠금(운영엔 없음)
  - 한도 카운터 `rl:push-subscribe:*`는 구독 데이터가 아니므로 삭제 대상 아님
- 삭제 방법(코드에 일괄 삭제 기능 없음 -> **Upstash 콘솔 CLI**, [대표]): `SCAN 0 MATCH push:prod:* COUNT 1000`을 커서가 0이 될 때까지 반복해 나온 키를 `DEL`. 반드시 `push:prod:` 접두어만, **`push:preview:`·`push:dev:`·그 외 키(share·csync·finance)는 건드리지 않는다.** 삭제 후 `SCAN`으로 0건 확인.

## 1. PUSH_STORE_KEY 유출 (구독 endpoint·keys 복호화 가능, 단 발송에는 VAPID 개인키도 필요)
1. [대표] Vercel Production에 새 PUSH_STORE_KEY 등록(Preview와 다른 값).
2. [대표] Production 재배포(Redeploy). [팀] preview/prod 빌드 상태 확인.
3. [대표] Upstash에서 `push:prod:*` 전체 삭제(위 0장). 이유: 옛 키로 만든 blob은 새 키로 복호화 실패(`openSecret` null)라 어차피 쓸 수 없고, 유출 키로 읽히는 옛 blob을 남기지 않기 위함. 3번 이후 신규 구독만 새 키로 저장된다.
4. [팀] 영향 정리·필요 시 공지, 사고 기록(발견 시각·조치 시각·삭제 건수, 값 제외)을 HISTORY에 남김.
- 영향: 서버 구독이 모두 사라진다. 앱 로컬 설정이 "켜짐"인 사용자는 **다음 앱 실행 때 `reconcilePush`가 기기 구독으로 서버에 자동 재등록**한다(별도 조작 불필요). 앱을 한동안 열지 않는 사용자는 그동안 알림을 못 받고, 열어야 재개된다. 앱 삭제·설정 초기화한 사용자는 직접 다시 켜야 한다. 자산 데이터는 영향 없음(서버에 없음).
- 확인: 발송 cron(운영) 로그의 건수가 0 -> 점차 증가, 구독 API가 200(503 `not-configured`면 키 형식 오류), 테스트 기기에서 앱 실행 후 `push:prod:all` 건수 증가(Upstash `SCARD push:prod:all`).

## 2. VAPID 키 유출 (개인키 = `VAPID_PRIVATE_KEY`, 공개키 = `NEXT_PUBLIC_VAPID_PUBLIC_KEY`)
1. [대표] 새 키쌍 생성. Production에 `VAPID_PRIVATE_KEY`·`NEXT_PUBLIC_VAPID_PUBLIC_KEY`를 **한 쌍으로 함께** 교체(`NEXT_PUBLIC_*`은 빌드 시 번들에 박히므로 재배포 필수). `VAPID_SUBJECT`는 유지.
2. [대표] Production 재배포.
3. [대표] `push:prod:*` 삭제(0장). 옛 키 구독은 새 서명이면 푸시 서비스가 거부하므로 의미가 없고, 고아가 남지 않게 정리.
4. [팀] **재구독 안내 필요**: 브라우저 구독은 옛 공개키에 묶여 있다. 현재 `reconcilePush`는 기존 기기 구독이 있으면 그대로 재사용하므로(키 불일치 감지 없음) 앱 실행만으로는 새 키 구독으로 바뀌지 않는다. 안내: "설정에서 알림을 끄고 다시 켜기"(끄기 때 기기 구독 해제 -> 켜기 때 새 키로 구독). 전체 공지가 필요한 사안이므로 사용자 안내 문구는 팀이 초안 작성(투자 조언·금액 문구 금지). 개선 후보 이슈: 공개키 변경 감지 시 자동 재구독(코드 변경이므로 별도 이슈).
- 영향: **사용자가 알림을 다시 켜야 한다.** 그 전까지 알림 없음.
- 확인: 새 구독 후 발송 cron 로그에 `status`(401/403 연속이면 키쌍 불일치), 클라이언트 번들의 공개키가 새 값인지(preview 또는 운영 번들 검색, 값 자체는 기록하지 않음), `SCARD push:prod:all` 증가.
- 참고: 발송 실패 중 410/404만 구독이 자동 삭제된다. 401/403은 삭제되지 않으므로 3번 정리를 생략하지 않는다.

## 3. CRON_SECRET 유출 (외부에서 운영 발송 cron 호출 시도 가능, 키 정보는 아님)
1. [대표] Vercel Production에 새 CRON_SECRET 등록. Vercel Cron은 이 값을 `Authorization: Bearer`로 자동 전송한다.
2. [대표] Production 재배포. 구독 데이터 삭제는 불필요.
3. [팀] 유출 기간의 비정상 호출 여부를 Vercel 로그에서 확인(발송 플래그 `sent:*`가 날짜당 1회 보호하므로 중복 발송은 제한됨).
- 영향: 사용자 조치 없음. 알림 재구독 불필요.
- 확인: 옛 값으로 호출 시 401, 다음 정기 cron이 성공(로그 건수·상태), `CRON_SECRET` 미설정이면 401로 막힘(코드 동작).

## 4. L3 개인정보 처리방침 재확인 (2026-11-14)
`git grep -i -E "개인정보|처리방침|privacy"` (origin/main, src·public·docs·README): **처리방침 페이지·링크 0건.** 일치 항목은 문서 문장 1건(`docs/seed-issues/4.xx-03-channel-operations.md`)과 PWA 가이드 일러스트의 "개인정보" 텍스트 라벨 1건뿐이다. 앱 안 처리방침 링크·페이지는 없으며 저장소 밖 문서가 있는지는 대표 확인 필요.
