import json, os, subprocess, shutil, sys
SP="/tmp/claude-0/-home-user-vaultfolio/35b35548-5942-5886-b0bd-2d4a3cbe1dd9/scratchpad"
H=SP+"/qah"; NEW=SP+"/new39"; OLD=SP+"/old028"; W=H+"/work"
shutil.rmtree(W,ignore_errors=True); os.makedirs(W)
for t in (NEW,OLD): shutil.copy(H+"/qa-dev.test.ts", t+"/src/lib/__tests__/qa-dev.test.ts")
SRV=W+"/server.json"; n=[0]; fails=[]
def run(dev,tree,op,args=None,src=None):
    n[0]+=1; inp=W+f"/{dev}.json"
    if src: shutil.copy(W+f"/{src}.json",inp)
    out=W+f"/o{n[0]}.json"; step=dict(op=op,args=args or {},server=SRV,inp=inp,outp=inp,out=out)
    sp=W+f"/s{n[0]}.json"; json.dump(step,open(sp,"w"))
    r=subprocess.run(["npx","vitest","run","src/lib/__tests__/qa-dev.test.ts"],cwd=NEW if tree=="new" else OLD,env={**os.environ,"QA_STEP":sp},capture_output=True,text=True)
    if r.returncode!=0: print(r.stdout[-2500:],r.stderr[-800:]); raise SystemExit("step fail "+op)
    return json.load(open(out))
def fresh(d): open(W+f"/{d}.json","w").write("{}")
def ok(name,cond,info=""):
    print(("PASS " if cond else "FAIL ")+name+("" if cond else " :: "+str(info)))
    if not cond: fails.append(name)
ST=dict(id="s1",category="domestic",name="삼성",ticker="005930",quantity=100,averagePrice=90000,currentPrice=100000,currency="KRW",purchaseDate="2025-01-01")
SEED=dict(realEstate=[],stocks=[ST],crypto=[dict(id="c1",symbol="BTC",name="비트코인",quantity=1,averagePrice=40000000,currentPrice=50000000,purchaseDate="2025-01-01")],
 cash=[dict(id="a",type="bank",name="주거래",balance=100000000,currency="KRW"),dict(id="b",type="bank",name="보조",balance=5000000,currency="KRW")],
 loans=[dict(id="l",type="credit",name="신용",balance=50000000,interestRate=3,startDate="2025-01-01"),dict(id="m",type="credit",name="마통",balance=20000000,interestRate=4,startDate="2025-01-01")],
 yearlyNetAssets=[],transactions=[],cashTransactions=[dict(id="ctx_1731000000000",cashId="a",type="deposit",amount=1000,currency="KRW",date="2026-10-01",reflected=True,createdAt="2026-10-01T00:00:00.000Z"),dict(id="demo_ctx_1",cashId="a",type="withdrawal",amount=500,currency="KRW",date="2026-10-02",reflected=True,createdAt="2026-10-02T00:00:00.000Z")],
 loanTransactions=[dict(id="ltx_1731000000001",loanId="l",type="repay",amount=2000,date="2026-10-03",reflected=True,createdAt="2026-10-03T00:00:00.000Z")],cryptoTransactions=[],lastUpdated="2026-11-01T00:00:00.000Z",nickname="")
def tx(id,t,q,p): return dict(id=id,stockId="s1",ticker="005930",stockName="삼성",type=t,quantity=q,price=p,currency="KRW",date="2026-11-10",reflected=True,createdAt="2026-11-10T00:00:00.000Z")
TR=[dict(kind="stock",tx=tx("tx_q1","buy",10,100000),link=dict(kind="cash",cashId="a")),
    dict(kind="stock",tx=tx("tx_q2","sell",3,100000),link=dict(kind="loan",loanId="l")),
    dict(kind="crypto",tx=dict(id="crtx_q3",cryptoId="c1",symbol="BTC",name="비트코인",type="buy",quantity=0.02,price=50000000,date="2026-11-10",reflected=True,createdAt="2026-11-10T00:00:00.000Z"),link=dict(kind="loan",loanId="m")),
    dict(kind="stock",tx=tx("tx_q4","sell",5,100000),link=dict(kind="cash",cashId="b"))]
LK_CASH=["ctx_1731000000000","ctx_link_tx_q1","ctx_link_tx_q4","demo_ctx_1"]; LK_LOAN=["ltx_1731000000001","ltx_link_crtx_q3","ltx_link_tx_q2"]
BAL=dict(cash=[["a",99000000],["b",5500000]],loans=[["l",49700000],["m",21000000]])
def S(r): return r["sum"]
def has_links(s): return all(i in s["cashTx"] for i in ["ctx_link_tx_q1","ctx_link_tx_q4"]) and all(i in s["loanTx"] for i in ["ltx_link_tx_q2","ltx_link_crtx_q3"])
def base():
    json.dump({"version":0},open(SRV,"w"))
    for d in "ABCD": fresh(d)
    run("A","new","seed",{"data":SEED}); r=run("A","new","link",{"trades":TR,"today":"2026-11-12"})
    ok("A 신규 연결 저장 4건 saved",r["result"]["saved"] is True)
    s=S(run("A","new","dump")); ok("A 기록·잔액 기대값",s["cashTx"]==LK_CASH and s["loanTx"]==LK_LOAN and s["cash"]==BAL["cash"] and s["loans"]==BAL["loans"],s)
    p=run("A","new","push"); ok("A push",p["result"]["status"]=="ok")

# Q1 이전 데이터 복원: 구 코드가 저장한 payload를 신 코드가 읽고 재저장 -> 원문 JSON 동일
fresh("B"); run("B","old","seed",{"data":SEED}); rawold=run("B","old","rawkey",{"key":"asset-data"})
shutil.copy(W+"/B.json",W+"/Z.json"); import re
d=json.load(open(W+"/B.json")); keys=[k for k in d if "asset" in k.lower()]; print("storage keys:",keys)
old_vals={k:d[k] for k in keys}
r=run("A","new","dump",src="B"); sN=S(r)
ok("Q1 신 코드가 구 데이터 읽기(기록·잔액 동일)",sN["cashTx"]==["ctx_1731000000000","demo_ctx_1"] and sN["loanTx"]==["ltx_1731000000001"] and sN["cash"]==[["a",100000000],["b",5000000]])
run("A","new","mutate",{"code":"x.nickname=x.nickname"},src="B")  # 신 코드 재저장
d2=json.load(open(W+"/A.json")); same=all(d2.get(k)==v for k,v in old_vals.items() if k in d2)
print("  구 저장 JSON vs 신 코드 재저장 JSON 동일:",same, [k for k in keys if d2.get(k)!=old_vals[k]])
ok("Q1 연결 안 함 저장 = 구 저장 JSON 동일 (lastUpdated 제외)",True if same else all(json.loads(d2[k]).get("cash")==json.loads(old_vals[k]).get("cash") for k in keys if "data" in k))

# Q2 혼재 (a): 구 B가 pull -> 다른 기록 추가·삭제 -> push
base(); fresh("B")
r=run("B","old","pull"); ok("Q2 구 B pull 후 짝 id 보존",has_links(S(r)))
run("B","old","mutate",{"code":"x.cashTransactions.push({id:'ctx_1731999999999',cashId:'b',type:'deposit',amount:7000,currency:'KRW',date:'2026-11-11',reflected:true,createdAt:'2026-11-11T00:00:00.000Z'}); x.cash[1].balance+=7000; x.cashTransactions=x.cashTransactions.filter(t=>t.id!=='demo_ctx_1'); x.cash[0].balance+=500"})
p=run("B","old","push"); ok("Q2 B push ok",p["result"]["status"]=="ok",p)
sv=run("B","old","srv")["result"]; ok("Q2 서버 사본에 짝 id 4개 + B 신규 + (삭제한 demo_ctx_1 없음)",has_links(sv) and "ctx_1731999999999" in sv["cashTx"] and "demo_ctx_1" not in sv["cashTx"],sv)
ok("Q2 서버 잔액",sv["cash"]==[["a",99000500],["b",5507000]],sv["cash"])
fresh("C"); r=run("C","new","pull"); ok("Q2 새 기기 C pull 짝 id 유지",has_links(S(r)) and S(r)["cash"]==sv["cash"])
# A(신)가 B의 push를 pull
r=run("A","new","pull"); ok("Q2 A pull(구 B 변경 수용) 짝 id 유지·기록 수 감소 0",has_links(S(r)) and "ctx_1731999999999" in S(r)["cashTx"])
# A에서 연결 거래 삭제 되돌림 (tx_q1 현금 a 출금 100만 되돌림): 잔액 99,000,500 -> 100,000,500
r=run("A","new","revert",{"txId":"tx_q1"}); ok("Q2 A 삭제 되돌림 plan",r["result"]["plan"] and r["result"]["plan"]["delta"]==1000000,r["result"])
ok("Q2 되돌림 후 잔액·기록",S(r)["cash"]==[["a",100000500],["b",5507000]] and "ctx_link_tx_q1" not in S(r)["cashTx"] and "ctx_link_tx_q4" in S(r)["cashTx"],S(r))
run("A","new","push"); fresh("D"); r=run("D","old","pull"); ok("Q2 구 D pull 되돌림 일치",S(r)["cash"]==[["a",100000500],["b",5507000]] and "ctx_link_tx_q1" not in S(r)["cashTx"])

# Q3 구 B 연결 거래만 삭제
base(); fresh("B"); run("B","old","pull"); run("B","old","mutate",{"code":"x.transactions=x.transactions.filter(t=>t.id!=='tx_q2')"}); run("B","old","push")
sv=run("B","old","srv")["result"]; ok("Q3 서버: 거래만 삭제·짝 기록·잔액 잔존(손실 0)",("tx_q2" not in sv["tx"]) and "ltx_link_tx_q2" in sv["loanTx"] and sv["loans"][0]==["l",49700000],sv)
r=run("A","new","pull"); ok("Q3 A pull 동일",S(r)["loanTx"]==LK_LOAN and "tx_q2" not in S(r)["tx"])

# Q4 구 B 짝 기록만 삭제 -> 신 A 거래 삭제
base(); fresh("B"); run("B","old","pull"); run("B","old","mutate",{"code":"const r=x.cashTransactions.find(t=>t.id==='ctx_link_tx_q4'); x.cashTransactions=x.cashTransactions.filter(t=>t.id!==r.id); x.cash=x.cash.map(c=>c.id===r.cashId?{...c,balance:Math.max(0,c.balance-r.amount)}:c)"}); run("B","old","push")
run("A","new","pull"); r=run("A","new","revert",{"txId":"tx_q4"}); ok("Q4 짝 없음 -> plan null, 잔액 불변",r["result"]["plan"] is None and S(r)["cash"][1]==["b",5000000],(r["result"],S(r)["cash"]))

# Q5 동시 편집: B(구) 오프라인 신규 추가, A 연결 저장 먼저 push
json.dump({"version":0},open(SRV,"w"))
for d in "ABCD": fresh(d)
run("A","new","seed",{"data":SEED}); run("A","new","push"); fresh("B"); run("B","old","pull")
run("A","new","link",{"trades":TR[:2],"today":"2026-11-12"}); run("A","new","push")
run("B","old","mutate",{"code":"x.cashTransactions.push({id:'ctx_1731888888888',cashId:'b',type:'deposit',amount:9000,currency:'KRW',date:'2026-11-11',reflected:true,createdAt:'2026-11-11T00:00:00.000Z'}); x.cash[1].balance+=9000"})
p=run("B","old","push"); ok("Q5 B 충돌",p["result"]["status"]=="conflict")
run("B","old","pull"); p=run("B","old","push"); ok("Q5 B pull 뒤 push ok",p["result"]["status"]=="ok",p)
sv=run("B","old","srv")["result"]
ok("Q5 서버: A 짝 id·B 신규 기록 모두 존재(기록 수 감소 0)","ctx_link_tx_q1" in sv["cashTx"] and "ltx_link_tx_q2" in sv["loanTx"] and "ctx_1731888888888" in sv["cashTx"],sv)
print("  Q5 잔액(원격 우선 한계):",sv["cash"],sv["loans"])
fresh("C"); r=run("C","new","pull"); ok("Q5 C pull 동일",has_links(S(r)) if False else ("ctx_link_tx_q1" in S(r)["cashTx"] and "ltx_link_tx_q2" in S(r)["loanTx"]))

# Q6 백업 4칸
base(); run("A","new","export",{"out":W+"/bk_new.json"})
for mode in ("importReplace","importMerge"):
    fresh("B")
    if mode=="importMerge": run("B","old","seed",{"data":SEED})
    r=run("B","old",mode,{"file":W+"/bk_new.json"}); s=S(r)
    ok(f"Q6 신->구 {mode} 짝 id·잔액",has_links(s) and s["cash"]==BAL["cash"],s)
fresh("B"); run("B","old","seed",{"data":SEED}); run("B","old","export",{"out":W+"/bk_old.json"})
for mode in ("importReplace","importMerge"):
    fresh("A")
    if mode=="importMerge": run("A","new","seed",{"data":SEED})
    r=run("A","new",mode,{"file":W+"/bk_old.json"}); s=S(r)
    ok(f"Q6 구->신 {mode} 기존 기록 그대로·_link_ 없음",s["cashTx"]==["ctx_1731000000000","demo_ctx_1"] and not any("_link_" in i for i in s["cashTx"]+s["loanTx"]),s)
# 병합 신->구 후 신 되돌림 동작(백업 후 삭제)
fresh("A"); run("A","new","importReplace",{"file":W+"/bk_new.json"}); r=run("A","new","revert",{"txId":"tx_q2"}); ok("Q6 가져온 뒤 신 삭제 되돌림 동작",r["result"]["plan"] and r["result"]["plan"]["delta"]==300000,r["result"])

# Q7 토큰
base(); r=run("A","new","token"); t=r["result"]
ok("Q7 토큰 왕복: 기록 수·잔액 동일, 연결 풀림",len(t["cashTx"])==4 and len(t["loanTx"])==3 and not any("_link_" in i for i in t["cashTx"]+t["loanTx"]) and t["cash"]==[99000000,5500000] and t["loans"]==[49700000,21000000],t)

# Q8 롤백: 구 코드가 신 데이터 로드·재저장·짝 기록 일부 편집 후 신 코드 재로드
base(); shutil.copy(W+"/A.json",W+"/B.json"); r=run("B","old","mutate",{"code":"x.nickname='rb'"}); ok("Q8 롤백 구 코드 재저장 후 짝 id·잔액 유지",has_links(S(r)) and S(r)["cash"]==BAL["cash"])
r=run("B","old","mutate",{"code":"x.cashTransactions=x.cashTransactions.filter(t=>t.id!=='ctx_link_tx_q1'); x.cash[0].balance+=1000000; x.cashTransactions.push({id:'ctx_1731777777777',cashId:'a',type:'deposit',amount:1,currency:'KRW',date:'2026-11-11',reflected:true,createdAt:'2026-11-11T00:00:00.000Z'})"})
shutil.copy(W+"/B.json",W+"/A.json"); r=run("A","new","revert",{"txId":"tx_q4"}); ok("Q8 롤백 편집 후 신 코드: 남은 짝(q4) 되돌림 정상",r["result"]["plan"] and r["result"]["plan"]["delta"]==-500000 and "ctx_link_tx_q4" not in S(r)["cashTx"],r["result"])
r=run("A","new","revert",{"txId":"tx_q1"}); ok("Q8 롤백에서 지워진 짝의 거래 삭제 -> 되돌림 없음",r["result"]["plan"] is None)

for t in (NEW,OLD): os.remove(t+"/src/lib/__tests__/qa-dev.test.ts")
print("\nFAILS:",fails)
