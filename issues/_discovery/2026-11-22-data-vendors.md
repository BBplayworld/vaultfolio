# 시세 데이터 공급자 교체 — 견적 조사 (business-pm)

작성 2026-11-22 · 근거 `2026-11-22-kis-terms.md`(KIS 고객 약관 제5조③ 위반), DECISIONS 11-22(기한부 유지·벤더 교체·#263은 벤더 확정 후 한 그림) · **외부 연락 0건, 공개 정보와 문의 초안까지만**
**열람 한계**: twelvedata.com·eodhd.com·data.krx.co.kr·segye.com이 이 세션에서 막혀 **원문을 못 열었다. 아래 값은 모두 웹 검색 발췌(원문 미열람)**이고, 금액은 공개 페이지 표기값이다. 법률 자문이 아니다.

## 1. 우리가 필요한 것 (main 코드 기준)
| # | 데이터 | 현재 KIS 호출·캐시 | 필요 깊이 | 지연 허용 |
|---|---|---|---|---|
| ① | 국내 주식·ETF 현재가 + 분류 | `/api/finance?type=stock` 요청당 3종목, **1시간 슬롯 캐시**(Redis+CDN, 휴장일 고정), 분류 90일 캐시 | — | **이미 최대 1시간 지연**으로 운영 중 → 15~20분 지연 OK. 종가(EOD)만이면 장중 변화가 안 보임(대표 판단) |
| ① | 국내 과거 종가·차트 | `/profit`(일별 종가, 다음 정시까지 캐시), `/price-history`(1y·5y, CDN 6시간) | 일봉 5년 | EOD OK |
| ① | 국내 배당 | `/dividend`(예탁원 TR, 정상 30일·CDN 6시간) | 일정·금액 | 일 단위 OK |
| ② | 미국 주식·ETF 현재가·과거 종가 | 위와 같은 경로(해외 TR) | 일봉 5년 | 15분 지연 OK |
| ③ | 지수 코스피·코스닥·S&P 500·나스닥100 | `/market-index`(다음 정시까지), 시장 알림 Cron | 현재 + **#263: 수십 년 월봉·연봉** | EOD OK |
| ④ | 환율 | 한국은행으로 교체 확정 → **제외** | | |
- 규모: 활성 약 30명, 월 신규 17~40, 개인 기기 앱 화면 표시. 캐시를 사용자 전원이 공유 → **불특정 다수 표시 = 외부 표시(external display)**. 원자료 다운로드·API 재판매는 없다.
- 호출량 추정: 고유 종목 수 × 시간 슬롯(국내 약 11·미국 약 7/영업일). 고유 종목 200개 가정 시 하루 수천 건 — 모든 후보의 최저 상업 플랜 한도 안(추정, 고유 종목 수는 Redis 확인 필요).

## 2. 후보별 비교
| 후보 | 커버(국내/미국/지수/배당) | 과거 깊이 | 외부 표시·재배포 | 지수 회사 권리 | 월 비용(공개값) | 위험 |
|---|---|---|---|---|---|---|
| **EODHD** | KO·KQ 주식·ETF / 미국 / 지수 다수(GSPC 1957~ 표기) / 배당·분할 | 미국 수십 년, 국내 시작일 미확인 | 개인 플랜은 표시 불가, **상업 Single-company 월 $399**부터(Enterprise $2,499) | 지수 별도 조건 가능(미확인) | **$399** | 국내 지연·EOD 여부, 코스피 지수 권리 미확인 |
| **Twelve Data** | KRX·KOSDAQ = **EOD만**(Pro 등급) / 미국 / KS11·NDX 페이지 있음 / 배당 | 미확인 | Business **Venture $149·$299·$499**부터 외부 표시, 재배포는 Enterprise($1,099)·추가 계약. **미국 외 가격 데이터 상업 이용은 승인 필요** | 미확인 | **$149~$499**(+한국 승인) | 국내 장중 시세 없음, 페이지마다 가격 다름 |
| Tiingo | 미국만 | 미국 수십 년 | 플랜은 내부용, **표시 재배포 월 $200(스타트업)** | 지수 없음 | $200 | 국내·지수 불가 → 조합 전용 |
| Intrinio | 미국만 | — | Startup 월 $333(앱 표시 허용, 원자료 재배포는 Enterprise). Bronze 가격은 표시 무료·사용자당 요금 없음 표기 | 지수 별도 상품 | $333~ | 국내 불가, 가격 출처 상충 |
| FMP | 글로벌(국내 범위 미확인) | — | 표시는 별도 Data Display and Licensing Agreement | 미확인 | 비공개 | 견적 전 판단 불가 |
| Massive(구 Polygon) | 미국만 | 지수 2023-02~ | Business(상업 표시) | 산출 회사 권리 | 지수 $2,500 | 비싸고 이력 짧음 → 제외 |
| Alpha Vantage | 글로벌 | — | 기본 비상업, 상업은 문의 | — | 비공개 | 근거 약함 |
| Xignite | 글로벌 | — | 지연 데이터 공개 웹 표시 OK(일반론), 스타트업 무료 프로그램(2020 조건: 외부 투자 $20M 미만) | 지수는 분배 계약·요금 별도인 경우 있음 | 비공개 | 프로그램 현존 여부 미확인 |
| **코스콤**(국내) | 국내 전부(정식 경로, 다음·네이버 사례) | 전부 | "시세 라이선스 계약" 선행. **법인(스타트업)만 — 개인·개인사업자 불가** | KRX 지수 포함 가능(미확인) | 비공개 | **법인 요건이 관문** |
| KRX Data Marketplace | 국내 과거 일괄 구매 | 전부 | 목적 심사, 오픈 API는 제3자 제공 금지 | 코스피·코스닥 자체 | 상품별(로그인), 26년 과거 데이터 가격 인상 보도 | 현재가 아님, 과거·지수 보완용 |
| FnGuide·인포맥스 | 국내 | 전부 | 기관 대상, 공개 조건 없음 | — | 비공개 | 소규모 부적합 가능성 큼 |
| ICE·LSEG | 글로벌(ICE는 KRX EOD) | 전부 | 기업 계약 | 포함 가능 | 비공개(고가 추정) | 작은 서비스 비현실적 |
| 지수 직접 S&P DJI / Nasdaq GIDS | 지수만 | 전부 | 웹·앱 표시 라이선스 | 직접 | S&P 비공개 / Nasdaq 구 요금 지연 외부 월 $1,000 | 2024-08부터 Nasdaq EOD·과거 수신자 직접 라이선스 |

## 3. 조합안 (월, 공개값 기준·한국 승인·지수 권리 추가 비용 제외)
| 안 | 구성 | 월 비용 | 장점 | 남는 문제 |
|---|---|---|---|---|
| **A. 단일 벤더 EODHD** | 상업 Single-company | **$399**(약 55만 원) | 국내·미국·배당·지수 한 계약, 개발 경로 1개 | 국내 지연 수준·코스피/S&P/나스닥100 표시 권리 서면 확인 필요 |
| B. Twelve Data | Venture + 한국 상업 승인 | **$149~$499**(약 21만~70만 원) | 가장 쌈 | **국내가 EOD만** → 장중 국내 평가액 정지, 배당 범위 미확인 |
| C. 국내 코스콤 + 미국 Tiingo/Intrinio + 지수 직접 | 코스콤(비공개) + $200~333 + Nasdaq $1,000~·S&P 비공개 | **최소 $1,200 + 코스콤**(약 170만 원+) | 권리 가장 깨끗 | 법인 필요, 계약 3~4건, 사용자 100명 전엔 과함 |
- 공통 절감: 벤더가 지수 권리를 덮지 못하면 **지수 3기능을 끄고(cto (d)) 지수 비용 0**. #263 지수 화면도 그 벤더 권리 확인 전엔 가데이터 유지.

## 4. 권고
1. **A(EODHD)와 B(Twelve Data) 두 곳에 같은 질문으로 견적을 받는다.** 판정 기준 = ① 국내 주식·ETF가 20분 이하 지연인지 ② 앱 외부 표시가 플랜에 포함되는지(서면) ③ 코스피·코스닥·S&P 500·나스닥100 월봉 수십 년을 우리 차트로 표시할 권리가 있는지 ④ 국내 배당.
2. ①~④를 다 만족하는 곳이 있으면 그 단일 벤더로 교체(월 $149~$399 예상). ③만 안 되면 지수 3기능을 끄고 나머지 교체.
3. 코스콤은 **법인 여부를 대표가 먼저 확인**한 뒤 국내 현재가가 A·B에서 안 풀릴 때만 연다. C안은 보류.
4. 교체 개발은 시세 경로 전부(현재가·종가·차트·배당·지수)라 risk:high 1건으로 묶는다(환율 교체는 별도 진행).

## 5. 대표 결정 필요
- ① 견적 메일 발송(아래 초안, 대표가 직접) ② 월 비용 상한(제안: $400) ③ 국내 장중 시세 없이 종가만(B안)도 허용하는가 ④ 법인 여부(코스콤 가능성)

## 6. 문의 메일 초안 (대표 발송용, [ ] 부분만 채움 · 개인정보·키 없음)
**(1) EODHD — sales@eodhistoricaldata.com / Twelve Data — 사이트 영업 문의 (영문, 공통)**
> Subject: Commercial license inquiry — small personal finance app (external display, delayed/EOD)
> Hello, we run a small Korean personal portfolio app ([서비스명]). Users enter their own holdings on their device; our server only fetches prices by ticker and caches them, and the app displays prices, past closes and charts to all users (external display, no raw data download or resale). Scale: about 30 monthly active users, 20–40 new per month, under 1,000 for the next year.
> Data we need: (1) Korea (KOSPI/KOSDAQ) stocks & ETFs — current price (15–20 min delayed OK), daily closes 5 years, dividends; (2) US stocks & ETFs — delayed price, daily closes 5 years; (3) indices KOSPI, KOSDAQ, S&P 500, Nasdaq-100 — daily latest and monthly/annual closes for as many decades as available, shown in our own charts.
> Questions: 1) Which plan covers external display for this use, and the monthly price? 2) Is Korea data intraday-delayed or end-of-day only, and does commercial use of Korea data need extra approval or exchange fees? 3) Are we allowed to display the four index values and derived returns in our app, or do we need separate licenses from S&P DJI / Nasdaq / KRX? 4) Earliest history date for each index and for Korean stocks. 5) Any attribution text or caching rules we must follow. Thank you.

**(2) 코스콤 시장데이터영업팀 — fintechdata@koscom.co.kr (국문)**
> 제목: [서비스명] 시세 라이선스 문의 — 소규모 자산 관리 앱 화면 표시
> 안녕하세요. 사용자가 본인 기기에 보유 종목을 기록하는 개인 자산 관리 앱입니다. 서버는 종목코드로 시세만 조회·캐시하고, 앱 화면에 현재가·과거 종가·차트·배당을 모든 사용자에게 표시합니다(원자료 다운로드·재판매 없음). 규모는 월 활성 약 30명, 월 신규 20~40명입니다.
> 필요: 국내 주식·ETF 지연 시세(20분 지연 가능), 일별 종가 5년, 배당, 코스피·코스닥 지수(현재·과거 월말값 수십 년).
> 문의: ① 이 형태에 맞는 계약 종류(일반 정보이용계약 등)와 월 이용료, 지연 시세 요금 차이 ② 법인이 아닌 [개인사업자/법인 설립 예정]도 계약 가능한지 ③ 코스피·코스닥 지수 표시가 같은 계약에 포함되는지 ④ 출처 표기·캐시 보관 조건. 감사합니다.

**(3) S&P DJI(index_services@spglobal.com) / Nasdaq Index Data Sales (영문, 벤더 회신이 '지수는 직접 라이선스'일 때만)**
> Subject: Index display license inquiry — S&P 500 / Nasdaq-100, small app
> We are a small personal finance app (~30 monthly users). We'd like to show [S&P 500 / Nasdaq-100] end-of-day level and monthly/annual closes since [연도] in our own charts, with attribution, no data download. Which license fits (delayed/EOD display, derived returns), what is the fee for under 1,000 users, and can we receive the data via a licensed vendor ([벤더명])?

## 출처(검색 발췌, 원문 미열람)
[Twelve Data 요금](https://twelvedata.com/pricing.md) · [Twelve Data 상업 이용](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage) · [Twelve Data KRX](https://support.twelvedata.com/en/articles/5749829-korea-exchange-krx) · [Twelve Data KOSDAQ](https://twelvedata.com/exchanges/XKOS) · [EODHD 상업 요금](https://eodhd.com/commercial-pricing) · [EODHD 상업 정의](https://eodhd.com/help/commercial) · [EODHD S&P](https://eodhd.com/lp/spglobal) · [EODHD KO](https://eodhd.com/exchange/KO?page=12) · [Tiingo IEX](https://api.tiingo.com/products/iex-api) · [Tiingo 재무](https://api.tiingo.com/products/fundamental-data-api) · [Intrinio 라이선스](https://help.intrinio.com/licensing-data-usage-requirements) · [Intrinio 가격 비교](https://multiples.vc/compare/intrinio-api-alternatives) · [Intrinio Bronze](https://intrinio.com/guides/stock-prices-bronze) · [FMP 표시](https://site.financialmodelingprep.com/insights/platform/can-you-use-fmp-data-in-a-public-app-website-or-client-dashboard) · [Alpha Vantage 약관](https://alphavantage.co/terms_of_service) · [Massive 사례](https://massive.com/blog/case-study-fey) · [Xignite 스타트업](https://website.xignite.com/startup) · [Xignite 지수](https://cmsstaging.xignite.com/wiki/164) · [코스콤 오픈API 절차](https://koscom.gitbook.io/open-api/how-to-use/procedure) · [KRX 정보이용정책](https://data.krx.co.kr/inc/datasale/Market%20Data%20Usage%20Polices_ko.pdf) · [KRX 오픈API](https://openapi.krx.co.kr/contents/OPP/INFO/OPPINFO005.jsp) · [세계일보 2026-05](https://www.segye.com/newsView/20260505509201) · [ICE KRX](https://developer.ice.com/fixed-income-data-services/catalog/korea-exchange-krx) · [S&P DJI 라이선스](https://www.spglobal.com/spdji/en/about-us/data-index-licensing) · [Nasdaq DN2024-5](https://www.nasdaqtrader.com/TraderNews.aspx?id=DN2024-5) · 앱 코드: `src/app/api/finance/{route,profit,price-history,dividend,market-index}`, `src/lib/finance/price-history.ts`(1y·5y)
