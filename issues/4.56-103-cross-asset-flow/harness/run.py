import json, os, subprocess, sys, shutil
H = os.path.dirname(os.path.abspath(__file__))
SP = os.path.dirname(H)
NEW = "/home/user/vaultfolio-4.56"; OLD = SP + "/oldmain"
W = H + "/work"; shutil.rmtree(W, ignore_errors=True); os.makedirs(W)
for t in (NEW, OLD): shutil.copy(H + "/zz-device.test.ts", t + "/src/lib/__tests__/zz-device.test.ts")
SERVER = W + "/server.json"
fails = []
n = [0]
def run(dev, tree, op, args=None, src=None):
    """dev: 장치 이름(A/B/C), tree: new|old, src: 저장소 파일을 다른 장치에서 복사할 때"""
    n[0] += 1
    sin = W + f"/{dev}.json"
    if src: shutil.copy(W + f"/{src}.json", sin)
    out = W + f"/step{n[0]}.out.json"
    step = dict(op=op, args=args or {}, server=SERVER, storageIn=sin, storageOut=sin, out=out)
    sp = W + f"/step{n[0]}.json"; json.dump(step, open(sp, "w"))
    r = subprocess.run(["npx", "vitest", "run", "src/lib/__tests__/zz-device.test.ts"], cwd=NEW if tree == "new" else OLD, env={**os.environ, "H_STEP": sp}, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stdout[-2500:], r.stderr[-1500:]); raise SystemExit(f"step {op} failed")
    return json.load(open(out))
def reset_server(): json.dump({"version": 0}, open(SERVER, "w"))
def norm(x):
    if isinstance(x, dict): return {k: (sorted(v) if k in ("tx", "cryptoTx", "cashTx", "loanTx") else v) for k, v in x.items()}
    return x
def eq(name, got, want):
    want = norm(want); got = norm(got)
    ok = got == want
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"\n   got  {got}\n   want {want}"))
    if not ok: fails.append(name)

STOCK = dict(id="s1", category="domestic", name="삼성", ticker="005930", quantity=100, averagePrice=90000, currentPrice=100000, currency="KRW", purchaseDate="2025-01-01")
SEED = dict(realEstate=[], stocks=[STOCK], crypto=[dict(id="c1", symbol="BTC", name="비트코인", quantity=1, averagePrice=40000000, currentPrice=50000000, purchaseDate="2025-01-01")],
    cash=[dict(id="a", type="bank", name="주거래", balance=100000000, currency="KRW")], loans=[dict(id="l", type="credit", name="신용", balance=50000000, interestRate=3, startDate="2025-01-01")],
    yearlyNetAssets=[], transactions=[], cashTransactions=[], loanTransactions=[], cryptoTransactions=[], lastUpdated="2026-11-01T00:00:00.000Z", nickname="")
def tx(id, type, q, p): return dict(id=id, stockId="s1", ticker="005930", stockName="삼성", type=type, quantity=q, price=p, currency="KRW", date="2026-11-10", reflected=True, createdAt="2026-11-10T00:00:00.000Z")
TR = [dict(kind="stock", tx=tx("tx_a1", "buy", 10, 100000), link=dict(kind="cash", cashId="a")),
      dict(kind="stock", tx=tx("tx_a2", "sell", 2, 100000), link=dict(kind="loan", loanId="l")),
      dict(kind="crypto", tx=dict(id="crtx_a3", cryptoId="c1", symbol="BTC", name="비트코인", type="buy", quantity=0.01, price=50000000, date="2026-11-10", reflected=True, createdAt="2026-11-10T00:00:00.000Z"), link=dict(kind="cash", cashId="a"))]
LINKED = dict(tx=["tx_a1", "tx_a2"], cryptoTx=["crtx_a3"], cashTx=["ctx_link_tx_a1", "ctx_link_crtx_a3"], loanTx=["ltx_link_tx_a2"], cash=[["a", 98500000]], loans=[["l", 49800000]])
S = lambda r: {k: sorted(v) if k in ("tx", "cryptoTx", "cashTx", "loanTx") else v for k, v in r["summary"].items()}

def base():
    reset_server()
    for d in "ABC": open(W + f"/{d}.json", "w").write("{}")
    run("A", "new", "seed", {"data": SEED}); r = run("A", "new", "newLinked", {"trades": TR, "today": "2026-11-12"})
    eq("A 연결 저장 3건(신)", S(run("A", "new", "dump")), LINKED)
    run("A", "new", "push")
    run("B", "old", "pull", src="A") if False else None

# 시나리오 ⒜: 구 B가 다른 항목만 편집
base(); run("B", "old", "dump", src="C") if False else None
shutil.copy(W + "/A.json", W + "/B.json")  # B는 A의 초기 상태에서 시작(같은 동기화 기준 필요 -> 서버에서 pull)
open(W + "/B.json", "w").write("{}")
r = run("B", "old", "pull"); eq("⒜ B(구) pull 후 짝 id·잔액", S(r), LINKED)
run("B", "old", "editOther", {"text": "구B 메모"}); pr = run("B", "old", "push"); eq("⒜ B push ok", pr["result"]["status"], "ok")
open(W + "/C.json", "w").write("{}")
r = run("C", "new", "pull"); eq("⒜ 새 기기 C pull: 짝 id·잔액 유지(D1 재발 없음)", S(r), LINKED)

# 시나리오 ⒝: 구 B가 연결 거래만 삭제
base(); open(W + "/B.json", "w").write("{}")
run("B", "old", "pull"); run("B", "old", "deleteTradeOnly", {"txId": "tx_a1"}); run("B", "old", "push")
r = run("A", "new", "pull"); w = dict(LINKED, tx=["tx_a2"]); eq("⒝ A pull: 짝 기록·잔액 잔존(손실 0), 거래만 삭제", S(r), w)
open(W + "/C.json", "w").write("{}"); eq("⒝ 새 기기 C pull 동일", S(run("C", "new", "pull")), w)

# 시나리오 ⒞: 구 B가 짝 기록만 삭제 -> 신 A 거래 삭제 시 거래만
base(); open(W + "/B.json", "w").write("{}")
run("B", "old", "pull"); run("B", "old", "deleteLinkRecOnly", {"recId": "ctx_link_tx_a1"}); run("B", "old", "push")
r = run("A", "new", "pull"); w = dict(LINKED, cashTx=["ctx_link_crtx_a3"], cash=[["a", 99500000]]); eq("⒞ A pull: 짝 기록 삭제·잔액 구규칙 역가감", S(r), w)
r = run("A", "new", "newDeleteRevert", {"txId": "tx_a1"}); eq("⒞ A 거래 삭제: 되돌림 계획 없음(거래만 삭제)", r["result"]["plan"], None)
eq("⒞ 이후 상태", S(r), dict(w, tx=["tx_a2"]))

# 시나리오 ⒟: B가 같은 계좌 잔액 편집(A가 먼저 push -> B 충돌 -> pull -> push). 기대(선기재): 원격 우선, 기록 수 감소 0, 최종 잔액 = A 값
base(); open(W + "/B.json", "w").write("{}")
run("B", "old", "pull")
T4 = [dict(kind="stock", tx=dict(tx("tx_a4", "buy", 2, 100000), date="2026-11-11"), link=dict(kind="cash", cashId="a"))]
run("A", "new", "newLinked", {"trades": T4, "today": "2026-11-12"}); run("A", "new", "push")
run("B", "old", "editBalance", {"balance": 90000000}); pr = run("B", "old", "push"); eq("⒟ B 충돌", pr["result"]["status"], "conflict")
r = run("B", "old", "pull"); pr = run("B", "old", "push")
want = dict(tx=["tx_a1", "tx_a2", "tx_a4"], cryptoTx=["crtx_a3"], cashTx=["ctx_link_crtx_a3", "ctx_link_tx_a1", "ctx_link_tx_a4"], loanTx=["ltx_link_tx_a2"], cash=[["a", 98300000]], loans=[["l", 49800000]])
eq("⒟ B pull 후 최종(원격 우선, 기록 수 감소 0, 잔액=A값)", S(r), want)
open(W + "/C.json", "w").write("{}"); eq("⒟ 서버 사본→C pull: 짝 id 존재", S(run("C", "new", "pull")), want)

# 시나리오 ⒠: A 삭제 되돌림 + B 동시 편집
base(); open(W + "/B.json", "w").write("{}")
run("B", "old", "pull")
run("A", "new", "newDeleteRevert", {"txId": "tx_a2"}); run("A", "new", "push")
run("B", "old", "editOther", {"text": "동시 편집"}); pr = run("B", "old", "push"); eq("⒠ B 충돌", pr["result"]["status"], "conflict")
r = run("B", "old", "pull"); pr = run("B", "old", "push")
want = dict(LINKED, tx=["tx_a1"], loanTx=[], loans=[["l", 50000000]])
eq("⒠ 최종: A 되돌림 유지(거래·짝 기록 부활 0), 대출 잔액=A값", S(r), want)
open(W + "/C.json", "w").write("{}"); eq("⒠ 서버 사본→C pull 동일", S(run("C", "new", "pull")), want)
r = run("A", "new", "pull"); eq("⒠ A pull 동일(신 A 삭제 되돌림 후 구 B push 일치)", S(r), want)

# 백업 4칸: 교체/병합 x 신->구, 구->신
base(); shutil.copy(W + "/A.json", W + "/A0.json")
run("A", "new", "export", {"out": W + "/backup_new.json"})
for mode, name in (("importReplace", "교체"), ("importMerge", "병합")):
    open(W + "/B.json", "w").write("{}")
    if mode == "importMerge": run("B", "old", "seed", {"data": SEED})
    r = run("B", "old", mode, {"file": W + "/backup_new.json"}); eq(f"백업 신->구 {name}: 짝 id·잔액 보존", S(r), LINKED)
# 구->신: 연결 없는 기록 + 기존 id
OLDDATA = dict(SEED, cashTransactions=[dict(id="ctx_1731_ab", cashId="a", type="deposit", amount=100000, currency="KRW", date="2026-11-01", reflected=True, createdAt="x")])
open(W + "/B.json", "w").write("{}"); run("B", "old", "seed", {"data": OLDDATA}); run("B", "old", "export", {"out": W + "/backup_old.json"})
for mode, name in (("importReplace", "교체"), ("importMerge", "병합")):
    open(W + "/A.json", "w").write("{}")
    if mode == "importMerge": run("A", "new", "seed", {"data": SEED})
    r = run("A", "new", mode, {"file": W + "/backup_old.json"}); eq(f"백업 구->신 {name}: 연결 없는 기록 그대로(_link_ 없음)", S(r)["cashTx"], ["ctx_1731_ab"])

# 공유 토큰 왕복(신): 연결 풀림, 합계 동일
shutil.copy(W + "/A0.json", W + "/A.json"); r = run("A", "new", "token")
d = r["result"]["data"]
eq("토큰: 기록·잔액 같고 id 재생성(연결 풀림)", (len(d["cashTx"]), len(d["loanTx"]), [c["balance"] for c in d["cash"]], [l["balance"] for l in d["loans"]], any("_link_" in c["id"] for c in d["cashTx"] + d["loanTx"])), (2, 1, [98500000], [49800000], False))

# 롤백: main(구) 코드로 신 데이터 로드 -> 재저장 -> 신 코드 재로드
shutil.copy(W + "/A0.json", W + "/B.json"); r = run("B", "old", "reserialize"); eq("롤백: 구 코드 재저장 후 짝 id·잔액 유지", S(r), LINKED)
shutil.copy(W + "/B.json", W + "/A.json"); eq("롤백 왕복: 신 코드 재로드 동일", S(run("A", "new", "dump")), LINKED)
r = run("B", "old", "deleteLinkRecOnly", {"recId": "ctx_link_tx_a1"}, src="A"); run("B", "old", "reserialize")
shutil.copy(W + "/B.json", W + "/A.json"); r = run("A", "new", "newDeleteRevert", {"txId": "tx_a1"}); eq("롤백 편집(짝 삭제) 후 신 코드 재배포: 되돌림 없음", r["result"]["plan"], None)

for t in (NEW, OLD): os.remove(t + "/src/lib/__tests__/zz-device.test.ts")
print("\nFAILS:", fails)
