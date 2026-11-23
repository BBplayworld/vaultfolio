import json,random,math
# V1' = 보유 수량 고정 × 종목별 1년 일봉(원화 환산: 오늘 환율 고정 — 앱 getMultiplier와 동일)
def v1(holds, series, fx, now_price=None):
    """holds:[{t,qty,cur}] series:{t:[(d,c)]} -> dict. 날짜 합집합, 결측은 직전 종가 이월(앞쪽 결측은 첫 값 역채움 없이 제외)"""
    dates=sorted({d for t in series for d,_ in series[t]})
    val=[]
    for d in dates:
        s=0;ok=True
        for h in holds:
            ser=dict(series[h['t']]);last=None
            for dd in dates:
                if dd>d:break
                if dd in ser:last=ser[dd]
            if last is None: ok=False;break   # 상장 전 → 그날은 계산 제외(1년 미만 종목 처리 후보 A)
            s+=h['qty']*last*(fx if h['cur']=='USD' else 1)
        if ok: val.append((d,s))
    pk=max(val,key=lambda x:x[1]);now=val[-1]
    return dict(days=len(val),peak_d=pk[0],peak=pk[1],now=now[1],dd=(now[1]/pk[1]-1)*100)

real=json.load(open('ph-005930.json'))['points']
dates=[p['d'] for p in real]
d=json.load(open('/home/user/vf-5143/src/lib/preview/demo-data.json'))['assetData']['stocks']
fx=1450  # 가정(데모 환율 미확정)
random.seed(7)
def synth(last,n):
    x=[last];
    for _ in range(n-1): x.append(x[-1]/(1+random.gauss(0.0006,0.018)))
    return list(reversed(x))
series={};holds=[]
for s in d:
    t=s['ticker'];holds.append(dict(t=t,qty=s['quantity'],cur=s['currency']))
    if t=='005930': series[t]=[(p['d'],p['c']) for p in real]
    else: series[t]=list(zip(dates,synth(s['currentPrice']*(1 if s['currency']=='USD' else 1),len(dates))))
# 데모 현재가(보유 단가)와 실제 삼성 종가가 다르므로 삼성은 실데이터 그대로
r=v1(holds,series,fx);print('demo-all',r)
only=[h for h in holds if h['t']=='005930'];print('samsung-real-only',v1(only,series,fx))
# 해외만 / 국내만
print('us-only',v1([h for h in holds if h['cur']=='USD'],series,fx))
# 1년 미만 상장: NVDA 첫 120일 결측
s2=dict(series);s2['NVDA']=series['NVDA'][120:]
print('nvda-listed-120d-late(제외 처리)',v1(holds,s2,fx))
# 결측일(휴장) 이월: 해외 종목 10% 날짜 삭제
s3=dict(series)
for t in('AAPL','NVDA'): s3[t]=[x for i,x in enumerate(series[t]) if i%10!=3]
print('us-holiday-gaps',v1(holds,s3,fx))
# 환율 영향: USD 비중 -> 환율 +-5%
for f in (1380,1450,1520): print('fx',f,v1(holds,series,f)['dd'])
# 시나리오(합성 단일종목 일봉 30일)
A=[100+ (20*i/10 if i<=10 else 20-24*(i-10)/20) for i in range(31)]  # 100→120(d10)→96(d30)
B=[50+(5*i/12 if i<=12 else 5-5*(i-12)/18) for i in range(31)]
def dd(x,peak): return (x/peak-1)*100
out=[]
# S1 고점 뒤 추가 매수(d20, 10→20주)
q=[10 if i<20 else 20 for i in range(31)]
N=[q[i]*A[i] for i in range(31)];print('S1 N',round(dd(N[-1],max(N)),1),'V1',round(dd(20*A[-1],20*max(A)),1),'peakN',max(N))
# S2 d20 절반 매도(20→10)
q=[20 if i<20 else 10 for i in range(31)];N=[q[i]*A[i] for i in range(31)];print('S2 N',round(dd(N[-1],max(N)),1),'V1',round(dd(10*A[-1],10*max(A)),1))
# S3 입금 후 신규종목 B 매수(d25, 100주) + A 20주 보유
N=[20*A[i]+(100*B[i] if i>=25 else 0) for i in range(31)]
V=[20*A[i]+100*B[i] for i in range(31)]
print('S3 N',round(dd(N[-1],max(N)),1),'V1',round(dd(V[-1],max(V)),1),'Nmax',max(N),'Vmax',max(V),'peakdayN',N.index(max(N)),'peakdayV',V.index(max(V)))
# S4 평단 수정 d28 (100→90), 수량 20 고정
val=[20*A[i] for i in range(31)];cost=[2000 if i<28 else 1800 for i in range(31)]
pnl=[val[i]-cost[i] for i in range(31)];k=pnl.index(max(pnl))
print('S4 N',round(dd(val[-1],max(val)),1),'V1',round(dd(val[-1],max(val)),1),'P pnl peak',max(pnl),'now',pnl[-1],'P%',round((pnl[-1]-max(pnl))/val[k]*100,1))
# S2 P(pnl 보정) : 매도 시 cost 비례 감소
q=[20 if i<20 else 10 for i in range(31)];cost=[q[i]*100 for i in range(31)];pnl=[q[i]*A[i]-cost[i] for i in range(31)];k=pnl.index(max(pnl))
print('S2 P pnl peak',max(pnl),'now',pnl[-1],'(비례 원가 가정) ')
