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
   - **2027-01 갱신 때 2025 빈 칸 확인**: 2025-10 월값(미 정부 업무 중단으로 미발표)이 BLS·FRED에 채워졌는지, BLS가 2025 공식 연평균을 공표했는지 확인한 뒤에만 채운다(추정·보간 금지). 채우면 `invest-bls.test.ts`·`BLS_GAP_NOTE`(text.ts)·겹쳐 보기 계단선 끝 해(2024)를 함께 고친다.
8. **2026 확정 순서**: ① 지수 연말값(1~3) ② 금리·NBER(3~4) ③ BLS(7, 공표 후) ④ 사건 추가(6) ⑤ 빌드·테스트. 각 출처는 리비전·내려받은 날짜를 고정해 기록한다. H.15 DDP 종료(2027-03-31) 뒤에는 3번의 `FRB_h15_xml.zip` 경로만 쓴다.
9. `node scripts/market-history/build.mjs` → `npx vitest run`(단언·드리프트) → AC3~AC7 재검사. 생성물은 손으로 고치지 않는다.
10. **가이드 `monthly-buying`(5.142 G2) 정적 문자열 갱신**: 마지막 해가 바뀌면 시작 해 5개(`마지막 해 −25·−20·−15·−10·−5`)와 `{L}년 말`이 달라진다. `src/app/guide/guide-copy.ts`의 `monthly-buying`의 description·summary(`2000·2005·2010·2015·2020년 말`·`2025년 말`)를 고치고, `lastModified`도 갱신한다. 두 지수 모두 자료가 있는 해여야 하며(나스닥100 1985~) 시작 해가 모자라면 표에서 빠진다. `guide.test.tsx`의 `monthly-buying` 정적 문자열 = 데이터 테스트가 갱신 누락을 실패로 막는다(각주 평균 기간 2.5·5.0·7.5·10.0·12.5는 그대로).
11. **원/달러(5.143 #280, 연준 G.5 EXKOUS)**: 12월 월 값이 확정된 뒤(보통 1월) FRED `fredgraph.csv?id=EXKOUS`를 내려받아 이슈 `data/`(memory `issues/5.141-270-invest-r3/data/EXKOUS.csv`)와 기존 행 차이 0을 확인하고(과거 월 값이 고쳐졌으면 차이 행만 갱신·기록), 시리즈 페이지 Notes의 `Public Domain: Citation Requested`·제3자 저작권 표기 0을 다시 확인한다(바뀌었으면 중단). `tools/make-fx-annual.mjs <EXKOUS.csv> data/market-history/fx-krw-usd-annual.csv`로 연평균(12개월이 다 있는 해만, half-up 소수 1자리)을 만들고 README 출처 줄의 내려받은 날을 바꾼다. 축 범위(`fxAxis`)는 데이터에서 자동 계산되고 눈금 개수는 320·390 3개/1280 4개를 유지한다.
12. **가이드 `yield-spread-years`(5.143 G4) 정적 문자열 갱신**: 마지막 해가 바뀌면 `guide-copy.ts`의 description·summary(`1976~2025년`·14·10·36·28·35·27)를 `spreadYearRows` 값으로 고치고 `lastModified`도 갱신한다. `guide.test.tsx`의 `yield-spread-years` 정적 문자열 = 데이터 테스트가 누락을 막는다.
