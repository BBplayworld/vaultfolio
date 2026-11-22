import csv,sys,re
D='/home/user/vaultfolio/.memory/issues/5.137-263-invest-tab/data/'
FED='https://www.federalreserve.gov'
ev={}
for line in open(sys.argv[1],encoding='utf-8'):
    p=[x.strip() for x in line.split('|')]
    ev[p[0]]=dict(pm=p[1],date=p[2],name=p[3],cat=p[4],fact=p[5],url=p[6])
# 기존 41건 → 해(시작 연도)
A=[('E08',1990),('E09',1994),('E10',1994),('E11',1997),('E12',1998),('E13',2000),('E14',2001),('E17',2003),('E18',2003),
   ('E19',2004),('E20',2008),('R01',2008),('E21',2010),('R02',2010),('E22',2011),('R03',2012),('E23',2013),('R04',2014),
   ('E24',2015),('E25',2015),('E26',2016),('R05',2017),('E27',2018),('E28',2018),('E29',2019),('R06',2019),('E30',2020),('R07',2020),
   ('E31',2022),('R08',2022),('R09',2022),('E32',2023),('E33',2024),('E34',2025),('R10',2025)]
REG={'E08':'글로벌','E10':'글로벌','E11':'글로벌','E12':'글로벌','E13':'미국','E14':'미국','E17':'글로벌','E18':'글로벌','E20':'미국','E21':'글로벌',
     'E22':'미국','E24':'글로벌','E26':'글로벌','E27':'글로벌','E30':'글로벌','E31':'글로벌','E32':'미국','E33':'글로벌','E34':'미국'}
rows=[]
for i,y in A:
    e=ev[i]
    rows.append(dict(year=y,date=e['date'],id='Y-'+i,linked_id=i,name=e['name'],category=e['cat'],region=REG.get(i,'미국'),fact=e['fact'],
        source_url=e['url'],grade='1차',quote='기존 정본(spec 5절·r4-ceo 3절, qa 원문 대조 대상)',wiki_ref='',rule='A',status='확정',note=''))
# 신규 행: (year,date,id,linked,name,cat,region,fact,url,grade,quote,wiki,rule,note)
N=[
(1991,'1991년 1월','Y1991-1','E08','걸프전(1991)','전쟁·지정학','글로벌','1월 다국적군이 걸프전에서 이라크와 싸웠어요.',FED+'/monetarypolicy/files/fomcropa19910206.pdf','1차',
 '"The early successes of the Allied forces in the Gulf war ... the dollar began to decline in the latter half of January"','https://en.wikipedia.org/wiki/Gulf_War','A2','E08(1990-08 침공)의 이어짐. 공습 시작일(1월 17일)은 위키로만 확인 → 화면엔 월까지'),
(1991,'1991년 8월','Y1991-2','','소련 쿠데타 시도','전쟁·지정학','글로벌','소련에서 쿠데타 시도가 있었어요.',FED+'/monetarypolicy/files/fomcropa19910820.pdf','1차',
 '"the uncertain outcome of the coup attempt in the Soviet Union that had begun a few days before the meeting"(8월 20일 회의)','https://en.wikipedia.org/wiki/1991_Soviet_coup_attempt','B',''),
(1992,'1992년 9월','Y1992-1','','유럽 통화 위기','금융위기','글로벌','9월 중순 유럽 외환시장에 큰 혼란이 있었어요.',FED+'/monetarypolicy/files/fomcropa19921006.pdf','1차',
 '"In mid-September ... turmoil in European currency markets prompted some safe-haven buying of dollars"','https://en.wikipedia.org/wiki/Black_Wednesday','B','영국 ERM 탈퇴(9월 16일)는 위키로만 확인 → 문장에 쓰지 않음'),
(1993,'1993년 7~8월','Y1993-1','','유럽 환율 변동폭 확대','금리·통화 정책','글로벌','유럽 환율조정장치가 통화 변동 허용 폭을 넓혔어요.',FED+'/fomc/MINUTES/1993/19930817min.htm','1차',
 '"a widening of the margins within which participating currencies are allowed to fluctuate"(Exchange Rate Mechanism, 7월 7일~8월 17일 회의 사이)','https://en.wikipedia.org/wiki/European_Exchange_Rate_Mechanism','B',''),
(1995,'1995년 1월 31일','Y1995-1','E10','멕시코 지원 발표','금융위기','글로벌','미국 대통령이 멕시코 금융 안정 지원 계획을 발표했어요.',FED+'/fomc/minutes/19960130.htm','1차',
 '"the Multilateral Program to Restore Financial Stability in Mexico, announced by President Clinton on January 31, 1995"','','A2','E10(1994-12)의 이어짐. E10 사실 1줄(1995년 1월 지원)과 같은 사건'),
(1996,'1996년 1월 31일','Y1996-1','','연준 인하(1996)','금리·통화 정책','미국','연준이 목표를 5.5%에서 5.25%로 내렸어요.',FED+'/monetarypolicy/openmarket_archive.htm','1차',
 '1996 표 "January 31 ... 25 5.25", 1995 "December 19 ... 25 5.50"; 의사록 19960130 "some slight easing in reserve conditions"','','C','규칙 B 사건을 1차에서 찾지 못해 대체. r4-ceo 3절(금리 전환점 사건 기각)에 따라 그림 사건 점 대상 아님 — 연도 목록 전용, CEO 판정 필요'),
(1997,'1997년 12월','Y1997-K','E11','한국 IMF 지원 합의','금융위기','한국','한국이 IMF와 자금 지원 양해각서를 맺었어요.','https://ko.wikipedia.org/w/index.php?oldid=42680365','wiki_only',
 'ko 위키 "대한민국의 IMF 구제금융 요청(1997년 12월 3일~2001년 8월 23일)은 ... IMF로부터 자금을 지원받는 양해각서를 체결한 사건". 연준 19971216 의사록은 "financial turmoil ... more recently in Korea"까지만','https://ko.wikipedia.org/w/index.php?oldid=42680365','K','E11(아시아 외환위기)의 한국 쪽. 1차(기획재정부·한은) 미열람 → 날짜 월까지'),
(1999,'1999년 1월 1일','Y1999-1','','유로화 도입','금리·통화 정책','글로벌','유럽 단일 통화인 유로가 도입됐어요.',FED+'/fomc/minutes/19981222.htm','1차',
 '"German marks will automatically be converted to euros when that currency is introduced on January 1, 1999"','https://en.wikipedia.org/wiki/Euro','B',''),
(2002,'2001년 12월~2002년 1월','Y2002-1','','아르헨티나 페소 하락','금융위기','글로벌','아르헨티나 페소 가치가 내려갔어요.',FED+'/fomc/minutes/20020130.htm','1차',
 '"the exchange value of the dollar increased slightly ... in part because of the depreciation of the Argentine peso"(12월 11일~1월 29일 회의 사이)','https://en.wikipedia.org/wiki/Argentine_Great_Depression_(1998%E2%80%932002)','B','고정환율 폐지(2002년 1월)는 위키로만 확인 → 문장에 쓰지 않음. E13(2000~2002) 범위 안'),
(2003,'2003년 3월','Y2003-K','E16','카드 사태','금융위기','한국','정부가 신용카드사 종합대책을 발표했어요.','https://ko.wikipedia.org/w/index.php?oldid=41980050','wiki_only',
 'ko 위키 "2003년 3월 17일 금융정책회의에서는 \'신용카드사 종합대책\'을 발표" · "LG카드는 ... 2003년 부도위기"','https://ko.wikipedia.org/w/index.php?oldid=41980050','K','E16(보류, r3-data-ceo 4절)과 같은 사건. 위키 문서에 각주 출처 없음 → 1차(금융위원회) 확인 전 화면 사용 보류 권고'),
(2004,'2004년 9~11월','Y2004-1','','고유가(2004)','에너지','글로벌','원유 가격이 올랐고 멕시코만 석유 시설이 허리케인 피해를 입었어요.',FED+'/fomc/minutes/20041110.htm','1차',
 '"restraint imparted on real incomes and consumer confidence from higher oil prices" · "hurricane-related damage to oil infrastructure in the Gulf of Mexico"; 20040921 "the high level of crude oil prices"','','B',''),
(2005,'2005년 여름','Y2005-1','','위안화 절상(2005)','금리·통화 정책','글로벌','중국 인민은행이 환율 제도를 바꾸고 위안화를 2.1% 올렸어요.',FED+'/fomc/minutes/20050809.htm','1차',
 '"The People\'s Bank of China announced a change to its exchange-rate regime, including an immediate 2.1 percent appreciation of the renminbi"(6월 30일~8월 9일 회의 사이)','https://en.wikipedia.org/wiki/Renminbi','B','발표일 7월 21일은 위키로만 확인 → 화면엔 "여름"(E24 관행)'),
(2006,'2006년 6월 29일','Y2006-1','E19','연준 인상(2006)','금리·통화 정책','미국','연준이 목표를 0.25%p 올려 5.25%로 정했어요.',FED+'/fomc/minutes/20060629.htm','1차',
 '"raising the target for the federal funds rate 25 basis points, to 5-1/4 percent, at this meeting"','','A2','E19(2004~2006 연속 인상)의 마지막 결정. 2006년 미국·글로벌 B 사건 1차 미발견'),
(2007,'2007년 8월','Y2007-1','','서브프라임 사태','금융위기','미국','은행 간 자금시장이 불안해졌고 연준이 유동성을 공급했어요.',FED+'/fomc/minutes/20070918.htm','1차',
 '"Unsecured bank funding markets showed signs of stress" · "On August 10, the Federal Reserve issued a statement announcing that it was providing liquidity"; "deteriorating conditions in the subprime mortgage market"','','B',''),
(2009,'2009년 5월 7일','Y2009-1','','은행 스트레스 테스트','금융위기','미국','연준 등이 대형 은행지주 19곳의 자본 평가 결과를 발표했어요.',FED+'/newsevents/pressreleases/bcreg20090507a.htm','1차',
 '"Federal Reserve, OCC, and FDIC release results of the Supervisory Capital Assessment Program" · "the nation\'s 19 largest bank holding companies"','','B',''),
(2010,'2010년 11월','Y2010-K','','연평도 포격','전쟁·지정학','한국','북한이 연평도를 포격했어요.','https://ko.wikipedia.org/w/index.php?oldid=42361272','wiki_only',
 'ko 위키 "2010년 11월 23일 오후 2시 30분 경, 조선민주주의인민공화국이 ... 대연평도를 향해 포격"','https://ko.wikipedia.org/w/index.php?oldid=42361272','K','1차(국방부) 미열람 → 날짜 월까지'),
(2012,'2012년 8~9월','Y2012-1','','ECB 국채 매입 계획','금리·통화 정책','글로벌','유럽중앙은행이 국채를 더 사들이는 계획을 내놨어요.',FED+'/monetarypolicy/fomcminutes20120913.htm','1차',
 '"the European Central Bank (ECB) outlined a plan to make additional sovereign bond purchases"(8월 1일~9월 12일 회의 사이)','https://en.wikipedia.org/wiki/Outright_Monetary_Transactions','B',''),
(2013,'2013년 1~3월','Y2013-1','','키프로스 구제금융','금융위기','글로벌','키프로스가 지원을 받으려 예금 과세안을 내놨어요.',FED+'/monetarypolicy/fomcminutes20130320.htm','1차',
 '"the proposal in Cyprus to tax insured, along with uninsured, deposits as part of the country\'s effort to secure an aid package from the euro area and the IMF"','','B',''),
(2014,'2014년 10~12월','Y2014-1','','유가 하락(2014)','에너지','글로벌','세계 원유 가격이 계속 내렸어요.',FED+'/monetarypolicy/fomcminutes20141217.htm','1차',
 '"Oil prices continued to decline"(10월 29일~12월 16일 회의 사이)','','B',''),
(2017,'2017년 8~9월','Y2017-1','','북한 긴장(2017)','전쟁·지정학','한국','북한과 관련된 지정학적 긴장이 높아졌어요.',FED+'/monetarypolicy/fomcminutes20170920.htm','1차',
 '"rising geopolitical tensions related to North Korea"(7월 26일~9월 19일 회의 사이)','','B',''),
(2019,'2019년 5월','Y2019-1','E27','미중 관세(2019)','전쟁·지정학','글로벌','5월 초 미국이 중국산 수입품 관세 인상을 발표했어요.',FED+'/monetarypolicy/fomcminutes20190619.htm','1차',
 '"the announcement of higher tariffs on Chinese imports in early May"','','A2','E27(2018 미중 무역분쟁)의 이어짐'),
(2021,'2021년 11~12월','Y2021-1','E30','오미크론 변이','팬데믹','글로벌','오미크론 변이가 나타났고 여러 나라가 입국을 제한했어요.',FED+'/monetarypolicy/fomcminutes20211215.htm','1차',
 '"the detection and rapid spread of the Omicron variant prompted new international travel restrictions in many foreign economies"','','B','E30(코로나19)과 같은 팬데믹의 변이'),
(2026,'2026년 2~3월','Y2026-1','','중동 분쟁(2026)','전쟁·지정학','글로벌','중동에서 분쟁이 시작됐고 원유 선물 가격이 크게 올랐어요.',FED+'/monetarypolicy/fomcminutes20260318.htm','1차',
 '"The conflict in the Middle East—which started later in the period—resulted in sharp increases in energy prices" · "prices for crude oil increased about 50 percent over the period"(1월 28일~3월 17일 회의 사이); 4월 성명 "recent increase in global energy prices"; 6월 성명 "the conflict in the Middle East"','','B','진행 중(2026). 9·10월 성명은 "geopolitical developments"로만 적음 — 종료 여부 미확인'),
]
K=['year','date','id','linked_id','name','category','region','fact','source_url','grade','quote','wiki_ref','rule','note']
for n in N:
    d=dict(zip(K,n)); d['status']='진행 중' if d['year']==2026 else '확정'; rows.append(d)
# 같은 해 데이터
def rd(f): return list(csv.DictReader(open(D+f,encoding='utf-8')))
rate={int(r['year']):r for r in rd('rates-annual.csv')}
mac={int(r['year']):r for r in rd('macro-us-annual.csv')}
idx={}
for r in rd('index-annual-wiki.csv'): idx[(int(r['year']),r['index'])]=r['ret_pct']
def fv(y):
    r=rate.get(y,{}); rg=r.get('fed_target_end_range') or ''; v=r.get('fed_target_end') or ''
    return (rg or v), (float(v) if v else None)
def dirn(a,b):
    if a is None or b is None: return '자료 없음'
    d=b-a; return '거의 그대로' if abs(d)<0.25-1e-9 else ('올라감' if d>0 else '내려감')
def num(x): return float(x) if x not in (None,'') else None
yd={}
for y in range(1990,2027):
    r=rate.get(y,{}); s,v=fv(y); _,pv=fv(y-1)
    kb=num(r.get('bok_base_end')); pkb=num(rate.get(y-1,{}).get('bok_base_end'))
    rec=mac.get(y,{}).get('recession_months_nber','')
    if y==2026: rec='미확정'
    yd[y]=dict(fed_end=s,fed_dir=dirn(pv,v),fed_moves=f"인상 {r.get('fed_hikes','')}·인하 {r.get('fed_cuts','')}",
        us10y_end=r.get('us10y_end',''),us_recession_months=rec,
        kr_base_end=r.get('bok_base_end',''),kr_dir=('자료 없음' if y<2000 else dirn(pkb,kb)),
        spx_ret=idx.get((y,'SPX'),''),ndx_ret=idx.get((y,'NDX'),''),kospi_ret=idx.get((y,'KOSPI'),''),
        data_basis=('2026-10-30 기준(진행 중) · 연준 10월 28일 성명 3.75~4% 확인 · 지수 등락 없음(2025년 말 기준)' if y==2026 else '연말'))
rows.sort(key=lambda d:(d['year'],d['id']))
H=K+['status','fed_end','fed_dir','fed_moves','us10y_end','us_recession_months','kr_base_end','kr_dir','spx_ret','ndx_ret','kospi_ret','data_basis']
w=csv.DictWriter(open(sys.argv[2],'w',encoding='utf-8',newline=''),fieldnames=H)
w.writeheader()
for d in rows: d.update(yd[d['year']]); w.writerow(d)
print(len(rows),'rows')
