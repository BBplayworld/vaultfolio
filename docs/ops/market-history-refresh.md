# 투자 탭 데이터 갱신 절차 (매년 1월 1회)

기준일은 데이터 마지막 연도에서 읽는다(하드코딩 0). 갱신하지 않으면 `{LAST}년 말까지` 표기가 그대로 남는다(결함 아님).

1. **Damodaran**: `histretSP.xls` 1월 갱신본 → `data/market-history/spx-level-damodaran.csv`에 연말 값 +1행(공개 데이터셋에는 넣지 않는다).
2. **위키 리비전**: 위키백과 「S&P 500」·「Nasdaq-100」·「코스피」의 영구 리비전 ID를 새로 고정하고 `index-annual.csv` +1행(`rev_id` 갱신). 나스닥 2003·2004 차이 문구 재확인.
3. **연준**: H.15 릴리스 페이지의 `FRB_h15_xml.zip`(DDP는 2027-03-31 종료, 같은 `H15_data.xml`)을 내려받아 `rates-monthly.csv`(10년물 월말·연준 목표)와 `macro-us-annual.csv`(10년·2년·3개월물 연말, 금리차)를 갱신하고
   `node scripts/market-history/verify-h15.mjs <H15_data.xml> <끝 연월>` 로 10년물 월말·연말 전 월 대조(불일치 0).
4. **NBER**: 데이터 페이지 `last updated` 확인, 바뀌면 `recessions-us.csv` 재대조.
5. **ECOS**: 사람이 웹 통계표(722Y001·817Y002·731Y006)를 엑셀로 내려받아 `data/market-history/ecos-raw/`(git 제외)에 두고 `kr-annual.csv`·월 기준금리·국고채 10년 월평균을 대조·갱신. Open API·내부 요청 자동 호출 금지. 출처 2줄 날짜(`KR_RECHECK_DATE`, `src/lib/invest/text.ts`)를 재대조일로 바꾼다.
6. 사건 추가는 기준(① 1차 출처 URL ② 날짜 정밀도 ③ 분류 7종 ④ 표시명 12자·사실 1줄 40자, 원인·해석 0)을 지키고 `events.csv`에만 쓴다.
7. `node scripts/market-history/build.mjs` → `npx vitest run`(단언·드리프트) → AC3~AC7 재검사. 생성물은 손으로 고치지 않는다.
