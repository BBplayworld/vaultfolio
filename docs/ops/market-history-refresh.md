# 투자 탭 데이터 갱신 절차 (매년 1월 1회)

기준일은 데이터 마지막 연도에서 읽는다(하드코딩 0). 갱신하지 않으면 `{LAST}년 말까지` 표기가 그대로 남는다(결함 아님).

1. **Damodaran**: `histretSP.xls` 1월 갱신본 → `data/market-history/spx-level-damodaran.csv`에 연말 값 +1행(공개 데이터셋에는 넣지 않는다).
2. **위키 리비전**: 위키백과 「S&P 500」·「Nasdaq-100」·「코스피」의 영구 리비전 ID를 새로 고정하고 `index-annual.csv` +1행(`rev_id` 갱신). 나스닥 2003·2004 차이 문구 재확인.
3. **연준**: H.15 릴리스 페이지의 `FRB_h15_xml.zip`(DDP는 2027-03-31 종료, 같은 `H15_data.xml`)을 내려받아 `rates-monthly.csv`(10년물 월말·연준 목표)와 `macro-us-annual.csv`(10년·2년·3개월물 연말, 금리차)를 갱신하고
   `node scripts/market-history/verify-h15.mjs <H15_data.xml> <끝 연월>` 로 10년물 월말·연말 전 월 대조(불일치 0).
4. **NBER**: 데이터 페이지 `last updated` 확인, 바뀌면 `recessions-us.csv` 재대조.
5. **ECOS**: 사람이 웹 통계표(722Y001·817Y002·731Y006)를 엑셀로 내려받아 `data/market-history/ecos-raw/`(git 제외)에 두고 `kr-annual.csv`·월 기준금리·국고채 10년 월평균을 대조·갱신. Open API·내부 요청 자동 호출 금지. 출처 2줄 날짜(`KR_RECHECK_DATE`, `src/lib/invest/text.ts`)를 재대조일로 바꾼다.
6. 사건 추가는 기준(① 1차 출처 URL ② 날짜 정밀도 ③ 분류 7종 ④ 표시명 12자·사실 1줄 40자, 원인·해석 0)을 지키고 `events.csv`에만 쓴다.
7. **BLS(미 노동통계국, 2026 연평균 추가)**: 12월 CPI·실업률이 공표된 뒤에만 한다(보통 1월 중순). `bls.gov`는 환경에서 403이라 FRED 경유(출처 `BLS · FRED 경유`, FRED 로고·제휴 표현 0)로 FRED `fredgraph.csv?id=CPIAUCNS`·`id=UNRATENSA` 월값을 내려받아 `data/`에 두고(원자료 정본은 memory `issues/5.139-267-invest-r2/data/`), 같은 폴더 `tools/make-bls-annual.mjs`(월 12개 평균·전년 대비 %)로 만든 결과를 `data/market-history/macro-us-bls.csv`에 반영(2025처럼 공표 안 된 달이 있으면 빈 칸)하고, 원본 파일 시각·URL을 `public/datasets/market-history/README.md`에 갱신한다. 앱 런타임 API 호출 0. 미 정부 저작물(17 U.S.C. §105)이라 출처 줄에 `미 노동통계국(BLS)`과 시리즈 ID를 적는다. 원표 대조(불일치 0) 후 반영한다.
8. **2026 확정 순서**: ① 지수 연말값(1~3) ② 금리·NBER(3~4) ③ BLS(7, 공표 후) ④ 사건 추가(6) ⑤ 빌드·테스트. 각 출처는 리비전·내려받은 날짜를 고정해 기록한다. H.15 DDP 종료(2027-03-31) 뒤에는 3번의 `FRB_h15_xml.zip` 경로만 쓴다.
9. `node scripts/market-history/build.mjs` → `npx vitest run`(단언·드리프트) → AC3~AC7 재검사. 생성물은 손으로 고치지 않는다.
