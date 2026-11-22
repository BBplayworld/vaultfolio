# 1962~1989 해별 이슈 초안 CSV 생성 (C6, #267)
import csv, json, sys
G = json.load(open('/home/user/vf-5139/src/lib/invest/data/market-history.generated.json'))
D = '/home/user/vaultfolio/.memory/issues/5.137-263-invest-tab/data/'
OUT = '/home/user/vaultfolio/.memory/issues/5.139-267-invest-r2/data/years-1962-1989.csv'
F = 'https://www.federalreserve.gov/monetarypolicy/files/'
def ropa(d): return F + 'fomcropa%s.pdf' % d
def tr(d): return F + 'FOMC%smeeting.pdf' % d
ev = {e['id']: e for e in G['events']}
REG = {'E01': '미국', 'E02': '글로벌', 'E03': '글로벌', 'E04': '미국', 'E05': '글로벌', 'E06': '미국'}
rows = []
for i, y in [('E01', 1971), ('E02', 1973), ('E03', 1979), ('E04', 1979), ('E05', 1985), ('E06', 1987)]:
    e = ev[i]
    rows.append(dict(year=y, date=e['date'], id='Y-' + i, linked_id=i, name=e['name'], category=e['cat'], region=REG[i], fact=e['fact'],
                     source_url=' ; '.join(e['urls']), grade='1차', quote='기존 정본(5.137 spec 5절, qa 원문 대조 완료분)', rule='A', status='확정', note=''))
# (year,date,id,linked,name,cat,region,fact,url,quote,rule,status,note)
N = [
(1962,'1962년 5월','Y1962-1','','주가 급락(1962)','시장 급락','미국','5월 말 미국 주식시장이 크게 떨어졌어요.',ropa('19620619'),
 '"The sharp stock market break at the end of May was followed by additional declines in the first part of June." (5/29 회의 기록 "In recognition of the sharp decline in the stock market")','B','확정',''),
(1962,'1962년 10월','Y1962-2','','쿠바 위기','전쟁·지정학','글로벌','쿠바의 공격용 무기 배치를 둘러싼 위기가 있었어요.',ropa('19621023'),
 '"crisis that had developed due to the build-up of offensive military weapons in Cuba"','B','확정','표시명에 미사일은 원문에 없어 쓰지 않음'),
(1963,'1963년 11월','Y1963-1','','케네디 대통령 사망','전쟁·지정학','미국','케네디 미국 대통령이 숨졌어요.',ropa('19631126'),
 '"This meeting was held by telephone on the first business day following the death of President Kennedy"','B','분류 확인','7종 중 가장 가까운 전쟁·지정학. CEO 분류 판정 필요(아니면 빈 해). 7월 이자평형세는 제안(proposed)이라 제외'),
(1964,'1964년 8월','Y1964-1','','동남아 군사 충돌','전쟁·지정학','글로벌','동남아시아에서 군사 충돌이 있었어요.',ropa('19640818'),
 '"in reaction to the military incident in Southeast Asia and the renewed fighting on Cyprus"','B','확정','원문이 장소를 동남아시아로만 적어 통킹만 이름은 쓰지 않음'),
(1964,'1964년 11월','Y1964-2','','파운드 위기(1964)','금융위기','글로벌','영국이 파운드화 압력 속에 할인율을 5%에서 7%로 올렸어요.',ropa('19641124'),
 '"the Bank of England had raised its discount rate from 5 to 7 per cent in another of a series of actions taken in response to heavy pressure on sterling"','B','확정',''),
(1965,'1965년 7월 28일','Y1965-1','','베트남전 확대','전쟁·지정학','미국','미국 대통령이 베트남 군사 활동 확대 계획을 발표했어요.',ropa('19650810'),
 '"a Presidential announcement on July 28 of a planned enlargement of U.S. military efforts in Viet Nam"','B','확정','1월~ 파운드 압력은 지속 상태라 사건 아님'),
(1966,'1966년 1~2월','Y1966-1','','북베트남 폭격 재개','전쟁·지정학','미국','북베트남 폭격이 다시 시작됐어요.',ropa('19660208'),
 '"Contributing to the advances were the resumption of bombing in North Vietnam"(1/11~2/8 회의 사이)','B','확정',''),
(1966,'1966년 5~7월','Y1966-2','','주택금융 경색','금융위기','미국','주택담보대출 시장이 큰 압박을 받았어요.',ropa('19660726'),
 '"The recent decline reflected acute pressures in mortgage markets ... Nevertheless, mortgage markets continued under great strain."','B','확정',''),
(1967,'1967년 6월','Y1967-1','','중동 전쟁(1967)','전쟁·지정학','글로벌','6월 초 중동에서 전쟁이 벌어졌어요.',ropa('19670620'),
 '"Conditions in some foreign exchange markets had been unsettled as a result of the Middle-East hostilities in early June."','B','확정',''),
(1967,'1967년 11월 18일','Y1967-2','','파운드 평가절하','금리·통화 정책','글로벌','영국이 파운드화의 공식 가치를 내렸어요.',ropa('19671212'),
 '"the devaluation of sterling on November 18"; 11/27 회의 "Following the British devaluation"','B','확정',''),
(1968,'1968년 1월 1일','Y1968-1','','국제수지 대책','금리·통화 정책','미국','미국 대통령이 국제수지 개선 계획을 발표했어요.',ropa('19680109'),
 '"On January 1, 1968, the President announced a new program which was ... designed to bring our balance of payments to--or close to--equilibrium"','B','분류 확인','정부 대책 발표를 금리·통화 정책으로 본 첫 사례(E01 닉슨 쇼크와 같은 기준). CEO 확인'),
(1968,'1968년 3월 14일','Y1968-2','','금 투기 위기','금융위기','글로벌','런던 금시장에 투기가 몰렸고 영국이 시장을 임시로 닫았어요.',ropa('19680314'),
 '"speculative demands for gold in London and other foreign markets had swelled to massive proportions. On the day of this meeting, the British authorities had temporarily closed the London gold market"','B','확정','3/17 금 이중가격제(4/30 기록 "two-market system for gold on March 17")는 같은 사건이라 따로 두지 않음'),
(1969,'1969년 8월 8일','Y1969-1','','프랑 평가절하','금리·통화 정책','글로벌','프랑스가 프랑화의 가치를 내린다고 발표했어요.',ropa('19690909'),
 '"Following the announcement of the devaluation of the French franc on August 8"','B','확정',''),
(1969,'1969년 10월 24일','Y1969-2','','마르크 평가절상','금리·통화 정책','글로벌','독일이 마르크화 공식 가치를 9.3% 올린다고 발표했어요.',ropa('19691028'),
 '"On October 24 the German Government announced that, effective October 27, the official parity of the mark would be revalued upward by 9.3 per cent"','B','확정',''),
(1970,'1970년 4~5월','Y1970-1','','주가 급락(1970)','시장 급락','미국','4월 초부터 미국 주가가 크게 계속 내렸어요.',ropa('19700526'),
 '"Common stock prices had dropped sharply and continuously since early April"','B','확정','원문의 하락 폭(약 4분의 1)은 지수 숫자라 쓰지 않음'),
(1970,'1970년 6월','Y1970-2','','펜센트럴 지급불능','금융위기','미국','철도회사 펜센트럴이 지급불능을 밝혔고 기업어음을 못 갚았어요.',ropa('19700623') + ' ; ' + F + 'fomcmod19700623.pdf',
 'ROPA "a major railroad corporation indicated that it was insolvent and was unable to pay off maturing commercial paper"; 의사 기록(MOD) "the failure of efforts to rescue the Penn Central railroad from insolvency"','B','확정','회사 이름은 같은 날 의사 기록(MOD)에서 확인'),
(1972,'1972년 6월 23일','Y1972-1','','파운드 변동환율','금리·통화 정책','글로벌','영국이 파운드화 환율을 시장에 맡기기로 했어요.',ropa('19720718'),
 '"early on June 23 it announced that the rate for sterling would be allowed to float"','B','확정',''),
(1974,'1974년 3월','Y1974-1','E02','원유 금수 해제','에너지','글로벌','아랍 산유국의 대미 원유 수출 금지가 끝났어요.',ropa('19740319'),
 '"termination of the Arab embargo on oil shipments to the United States--reported on March 18"','A2','확정','E02(1973-10 금수)의 이어짐 → 그해 B 미적용. 5월 프랭클린 내셔널 은행(19740521)은 후보로만 남김'),
(1975,'1975년 8~9월','Y1975-1','','뉴욕시 재정위기','금융위기','미국','뉴욕시가 재정 위기를 겪었고 9월 9일 주 정부 지원책이 제정됐어요.',ropa('19750916'),
 '"widespread concern about possible repercussions of New York City\'s financial crisis; on September 9 a State program to assist the City was enacted"','B','확정','2월 원유 수입 부과금·1월 에너지 세제안은 세금·제안이라 제외'),
(1976,'1976년 3월 15일','Y1976-1','','프랑 공동변동 이탈','금리·통화 정책','글로벌','프랑과 유럽 통화 사이 고정 변동폭 유지가 멈췄어요.',ropa('19760316'),
 '"on March 15 efforts to maintain fixed margins between the French franc and certain other European currencies were abandoned, and the franc depreciated"','B','확정',''),
(1976,'1976년 8월 31일','Y1976-2','','멕시코 페소 절하','금리·통화 정책','글로벌','멕시코가 페소화의 가치를 내렸어요.',ropa('19760921'),
 '"Following the devaluation of the peso on August 31, 1976"','B','확정','1994 멕시코 페소 위기(E10)와 다른 사건'),
(1977,'1977년 1월','Y1977-1','','천연가스 부족','에너지','미국','1월 한파 속에 산업용 천연가스가 모자랐어요.',ropa('19770215'),
 '"The index fell in January because of the severe winter weather and also, after midmonth, because of shortages of natural gas for industrial uses."','B','확정',''),
(1978,'1978년 11월 1일','Y1978-1','','달러 방어 대책','금리·통화 정책','미국','미국 정부가 외환시장 달러 대책을 시행했어요.',ropa('19781121'),
 '"On November 1 a broad Government program was put in place to strengthen the dollar in foreign exchange markets"','B','분류 확인','정부 대책 안에 연준 조치가 들어 있음(연준 자체 결정만인 사건은 아님). CEO 확인. 1~3월 석탄 파업은 노사 분규라 7종 밖'),
(1978,'1978년 12월 17일','Y1978-2','','OPEC 유가 인상','에너지','글로벌','OPEC이 예상보다 큰 이듬해 유가 인상을 발표했어요.',ropa('19790206'),
 '"the OPEC announcement on December 17 of a larger-than-anticipated increase in oil prices for 1979"','B','확정','원문은 1979년 2월 기록. E03(1979년 6월 OPEC)과 다른 결정'),
(1980,'1980년 3월 14일','Y1980-1','','물가 대책(1980)','금리·통화 정책','미국','미국 대통령이 재정·에너지·신용 대책을 묶어 발표했어요.',ropa('19800318'),
 '"On March 14 the President announced a broad program involving fiscal, energy, credit, and other measures that were designed to help curb inflationary forces"','B','분류 확인','Y1968-1과 같은 기준. 은 가격 사태·이란-이라크 전쟁은 1차에서 못 찾음'),
(1981,'1981년 1~2월','Y1981-1','','유가 통제 해제','에너지','미국','미국의 원유 가격 통제가 풀렸어요.',ropa('19810331'),
 '"prices of energy items surged, reflecting in large part the effects of decontrol of oil prices"(1~2월 물가 설명)','B','확정','해제일(1월 28일)은 원문에 없어 월 범위로 씀. 4~6월 석탄 파업은 7종 밖'),
(1982,'1982년 5월','Y1982-1','','드라이스데일 사태','금융위기','미국','국채 딜러 드라이스데일과 채권 금융사들에 문제가 생겼어요.',tr('19820518'),
 '"the situation involving Drysdale Government Securities and its affiliates, and creditor banks and brokerage houses in New York"','B','확정','7/1 회의 "The Drysdale and Comark episodes"'),
(1982,'1982년 8월','Y1982-2','','멕시코 외채 위기','금융위기','글로벌','멕시코가 대외 자금 조달에 큰 어려움을 겪었어요.',ropa('19821005') + ' ; ' + ropa('19820824'),
 '"the acute external financing difficulties of Mexico"; 8/24 "ongoing discussions with the Government of Mexico regarding short-term financing arrangements"','B','확정',''),
(1984,'1984년 4~5월','Y1984-1','','페르시아만 분쟁','전쟁·지정학','글로벌','페르시아만 지역에서 무력 충돌이 있었어요.',ropa('19840522'),
 '"labor unrest in some European countries and conflict in the Persian Gulf area"(3/27~5/22 회의 사이)','B','확정',''),
(1984,'1984년 5월','Y1984-2','','콘티넨털 일리노이','금융위기','미국','미국 당국이 콘티넨털 일리노이 은행 사태에 대응했어요.',tr('19840522'),
 '"the Continental Illinois situation" · "the prompt action by the U.S. authorities on Continental Illinois"','B','확정',''),
(1986,'1986년 1~2월','Y1986-1','','유가 급락(1986)','에너지','글로벌','연초 원유 가격이 크게 내렸어요.',ropa('19860401'),
 '"Price developments thus far in 1986 had been dominated by sharp declines in oil prices. Energy prices fell substantially over the first two months of the year"','B','확정',''),
(1989,'1989년 8~10월','Y1989-1','','저축대부조합 정리','금융위기','미국','정리신탁공사가 부실 저축대부조합에 자금을 넣었어요.',ropa('19891003'),
 '"insolvent institutions were receiving funds from the Resolution Trust Corporation (RTC)"','B','확정','근거법(FIRREA) 이름은 원문 미확인 → 쓰지 않음'),
(1989,'1989년 10월 13일','Y1989-2','','주가 급락(1989)','시장 급락','미국','10월 13일 미국 주가가 가파르게 떨어졌어요.',ropa('19891114'),
 '"For a few days after the steep drop in stock prices on October 13, while financial markets remained highly sensitive and volatile"','B','확정','12월 동유럽 정세(19891219)는 그해 2건 상한으로 후보만'),
]
for t in N:
    y,date,i,ln,name,cat,reg,fact,url,q,rule,st,note = t
    rows.append(dict(year=y,date=date,id=i,linked_id=ln,name=name,category=cat,region=reg,fact=fact,source_url=url,grade='1차',quote=q,rule=rule,status=st,note=note))
for y in (1983, 1988):
    rows.append(dict(year=y,date='',id='Y%d-0' % y,linked_id='',name='—',category='',region='',fact='',source_url='',grade='',quote='',rule='',status='빈 해',
        note={1983:'1차에서 7종 사건 못 찾음(유가 하락은 상태 서술, OPEC 3월 인하는 원문 미발견)',1988:'1차에서 7종 사건 못 찾음(가뭄은 7종 밖)'}[y]))
# 같은 해 데이터 열
r = G['rate']['us']; v = r['v']; fy, fm = map(int, r['from'].split('-'))
def fed_end(y):
    k = y*12+11 - (fy*12+fm-1)
    return v[k] if 0 <= k < len(v) else None
def ret(key, y):
    ix = G['idx'][key]; c = ix['close']; j = y - ix['start']
    if j < 1 or j >= len(c) or c[j] is None or c[j-1] is None: return ''
    return '%.2f' % ((c[j]/c[j-1]-1)*100)
uy = {u['y']: u for u in G['usYear']}
def recm(y):
    n = 0
    for rc in G['rec']:
        s = int(rc['s'][:4])*12+int(rc['s'][5:])-1; e = int(rc['e'][:4])*12+int(rc['e'][5:])-1
        n += sum(1 for m in range(y*12, y*12+12) if s <= m <= e)
    return n
for row in rows:
    y = row['year']; a = fed_end(y); b = fed_end(y-1)
    row['fed_end'] = '' if a is None else ('%.2f' % a)
    row['fed_dir'] = '자료 없음' if a is None or b is None else ('올라감' if a-b >= 0.25 else '내려감' if a-b <= -0.25 else '거의 그대로')
    row['us10y_end'] = uy.get(y, {}).get('y10', '')
    row['us_recession_months'] = recm(y)
    row['spx_ret'] = ret('spx', y); row['ndx_ret'] = ret('ndx', y)
    row['data_basis'] = '연말(지수 S&P 500만, 나스닥100 1986~)'
rows.sort(key=lambda r: (r['year'], r['id']))
cols = ['year','date','id','linked_id','name','category','region','fact','source_url','grade','quote','rule','status','note','fed_end','fed_dir','us10y_end','us_recession_months','spx_ret','ndx_ret','data_basis']
with open(OUT, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=cols); w.writeheader()
    for row in rows: w.writerow({k: row.get(k, '') for k in cols})
# 검사
BAN = ['때문','덕분','로 인해','영향','촉발','여파','역전','신호','예고','기회','타이밍','유리','추천','수익','로그','지금 사면','→','↑','↓','전조','조심','경고','과열','붐','기대','연착륙','반등','해서','하세요']
CATS = {'금리·통화 정책','금융위기','시장 급락','전쟁·지정학','기술 거품','팬데믹','에너지'}
for row in rows:
    if row['status'] == '빈 해': continue
    f = row['fact']; bad = [b for b in BAN if b in f or b in row['name']]
    probs = []
    if len(f) > 40: probs.append('사실 %d자' % len(f))
    if not f.endswith('요.'): probs.append('어미')
    if len(row['name']) > 12: probs.append('이름 %d자' % len(row['name']))
    if row['category'] not in CATS: probs.append('분류')
    if bad: probs.append('금지어 %s' % bad)
    if probs: print(row['id'], probs, f)
yrs = sorted({r['year'] for r in rows if r['status'] != '빈 해'})
print('행', len(rows), '사건 행', sum(1 for r in rows if r['status']!='빈 해'), '신규', sum(1 for r in rows if r['rule'] in ('B','A2')), '해', len(yrs), '빈 해', [y for y in range(1962,1990) if y not in yrs])
