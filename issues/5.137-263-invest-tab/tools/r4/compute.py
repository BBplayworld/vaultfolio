# #263 R4 재현 스크립트 — data/r4-*.csv 수기 계산값을 qa가 독립 재계산한다.
# 사용: python3 -I compute.py <issues/5.137-263-invest-tab/data 경로>
# 금리차는 월 단위(r4-spread-monthly.csv)로 판정한다(R4 CEO 판정). 결과를 r4-*.csv·CEO 판정 2절 표와 대조할 것.
import csv
import os
import sys

D = sys.argv[1]


def rd(name):
    with open(os.path.join(D, name), encoding='utf-8') as fh:
        return list(csv.DictReader(fh))


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


# 지수 연말값 (S&P = Damodaran 수준, 나스닥100·코스피 = 위키)
lv = {'SPX': {}, 'NDX': {}, 'KOSPI': {}}
for r in rd('spx-level-damodaran.csv'):
    lv['SPX'][int(r['year'])] = float(r['spx_close_damodaran'])
for r in rd('index-annual-wiki.csv'):
    if r['index'] in ('NDX', 'KOSPI') and num(r['close']) is not None:
        lv[r['index']][int(r['year'])] = float(r['close'])
ret = {k: {y: v[y] / v[y - 1] - 1 for y in v if y - 1 in v} for k, v in lv.items()}
FIRST = {k: min(ret[k]) for k in ret}  # 표시 시작 연도(SPX 1961, NDX 1986, KOSPI 1982)
LAST = max(lv['SPX'])


def zigzag(L, th=0.15):
    """spec 4-3: 연말값 지그재그, 문턱 15%. (고점, 바닥) 목록."""
    ys = sorted(L)
    eps, peak, trough, dd = [], ys[0], None, False
    for y in ys[1:]:
        v = L[y]
        if not dd:
            if v >= L[peak]:
                peak = y
            elif v / L[peak] - 1 < -th:
                dd, trough = True, y
        else:
            if v < L[trough]:
                trough = y
            elif v / L[trough] - 1 > th:
                eps.append((peak, trough))
                dd, peak = False, y
    if dd:
        eps.append((peak, trough))
    return eps


ra = {int(r['year']): r for r in rd('rates-annual.csv')}
mu = {int(r['year']): r for r in rd('macro-us-annual.csv')}
rec = rd('recessions-us.csv')
NBER_START = {int(r['recession_start_month'][:4]) for r in rec}
NBER_TROUGH = {int(r['trough_month'][:4]) for r in rec}
EPS = 1e-9


def col(tbl, y, c):
    return num(tbl.get(y, {}).get(c))


def direction(a, b):
    if a is None or b is None:
        return None
    d = b - a
    if d >= 0.25 - EPS:
        return 'up'
    if d <= -0.25 + EPS:
        return 'down'
    return 'flat'


def fed_dir(y):
    return direction(col(ra, y - 1, 'fed_target_end'), col(ra, y, 'fed_target_end')) if y >= 1983 else None


def bok_dir(y):
    return direction(col(ra, y - 1, 'bok_base_end'), col(ra, y, 'bok_base_end')) if y >= 2000 else None


# 금리차 월 단위(CEO R4 판정 ③): 그해 1~12월 중 월평균 금리차(spread_10y2y_avg·spread_10y3m_avg)가 0 미만인 달이 1개 이상.
# 정본 데이터 r4-spread-monthly.csv(연준 H.15 월평균). 월 값이 하나도 없는 해는 None(자료 없음).
_sp = {}
for _r in rd('r4-spread-monthly.csv'):
    _sp[_r['month']] = _r


def neg_spread(y, which):
    col_name = 'spread_10y2y_avg' if which == '2y' else 'spread_10y3m_avg'
    vals = [num(_sp.get('%d-%02d' % (y, m), {}).get(col_name)) for m in range(1, 13)]
    vals = [v for v in vals if v is not None]
    if not vals:
        return None
    return any(v < 0 for v in vals)


def d_end(tbl, c, y):
    a, b = col(tbl, y - 1, c), col(tbl, y, c)
    return None if a is None or b is None else b - a


def flag(v, f):
    return None if v is None else f(v)


US = {
    '연준 금리 올라감': lambda y: flag(fed_dir(y), lambda d: d == 'up'),
    '10년-2년 마이너스(월평균<0인 달 ≥1)': lambda y: neg_spread(y, '2y'),
    '10년-3개월 마이너스(월평균<0인 달 ≥1)': lambda y: neg_spread(y, '3m'),
    'NBER 침체 시작': lambda y: y in NBER_START,
    '10년물 1%p 넘게 오름': lambda y: flag(d_end(mu, 'us10y_end', y), lambda d: d >= 1 - EPS),
}
KR = {
    '한국 금리 올라감': lambda y: flag(bok_dir(y), lambda d: d == 'up'),
    '국고채10년 1%p 넘게 오름': lambda y: flag(d_end(ra, 'kr10y_end', y), lambda d: d >= 1 - EPS),
}
US_RISE = {
    '연준 금리 내려감': lambda y: flag(fed_dir(y), lambda d: d == 'down'),
    '연준 금리 올라감': lambda y: flag(fed_dir(y), lambda d: d == 'up'),
    '연준 금리 거의 그대로': lambda y: flag(fed_dir(y), lambda d: d == 'flat'),
    'NBER 침체가 끝난 해': lambda y: y in NBER_TROUGH,
    '10년물 1%p 넘게 내림': lambda y: flag(d_end(mu, 'us10y_end', y), lambda d: d <= -1 + EPS),
}
KR_RISE = {
    '한국 금리 내려감': lambda y: flag(bok_dir(y), lambda d: d == 'down'),
    '한국 금리 올라감': lambda y: flag(bok_dir(y), lambda d: d == 'up'),
    '국고채10년 1%p 넘게 내림': lambda y: flag(d_end(ra, 'kr10y_end', y), lambda d: d <= -1 + EPS),
}

for k in ('SPX', 'NDX', 'KOSPI'):
    eps = zigzag(lv[k])
    peaks = {p for p, _ in eps}
    print(f'== {k} 크게 빠진 때 {len(eps)}건:', [(p, t, round((lv[k][t] / lv[k][p] - 1) * 100, 2)) for p, t in eps])
    conds = US if k != 'KOSPI' else KR
    for p, _ in eps:
        print('  고점', p, {n: f(p) for n, f in conds.items()})
    # 기준선: 결과를 알 수 있는 해(다음 해 값이 있는 해)만
    for n, f in conds.items():
        ys = [y for y in range(FIRST[k], LAST) if y + 1 in ret[k] and f(y) is not None]
        c = [y for y in ys if f(y)]
        o2 = [y for y in c if y in peaks]
        o1 = [y for y in c if ret[k][y + 1] < -0.15]
        b2 = sum(1 for y in ys if y in peaks)
        b1 = sum(1 for y in ys if ret[k][y + 1] < -0.15)
        print(f'  기준선 {n}: {ys[0] if ys else "-"}~{ys[-1] if ys else "-"} {len(ys)}년 중 조건 {len(c)}년 {c}'
              f' | 고점 {len(o2)} {o2} (전체 {b2}) | 다음 해 -15% {len(o1)} {o1} (전체 {b1})')
    rise = [y for y in sorted(ret[k]) if ret[k][y] > 0.20]
    print(f'  크게 오른 해(>+20%) {len(rise)}건:', rise)
    print(f'  (참고 >+25%) {sum(1 for y in ret[k] if ret[k][y] > 0.25)}건')
    for n, f in (US_RISE if k != 'KOSPI' else KR_RISE).items():
        ys = [y for y in sorted(ret[k]) if f(y) is not None]
        c = [y for y in ys if f(y)]
        r = [y for y in c if ret[k][y] > 0.20]
        base = sum(1 for y in ys if ret[k][y] > 0.20)
        print(f'  오른 해 기준선 {n}: {ys[0] if ys else "-"}~{ys[-1] if ys else "-"} {len(ys)}년 중 조건 {len(c)}년, 그중 +20% 넘게 {len(r)} {r} (전체 {base})')
