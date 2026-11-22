# #263 R4 금리차 월 단위 재계산 (연준 H.15 XML)
# 사용: python3 -I spread_monthly.py <H15_data.xml> <out.csv>
import csv
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict

SRC, OUT = sys.argv[1], sys.argv[2]
WANT = {
    'RIFLGFCY10_N.M': 'y10_avg', 'RIFLGFCY02_N.M': 'y2_avg', 'RIFLGFCM03_N.M': 'm3_avg',
    'RIFLGFCY10_N.B': 'y10_d', 'RIFLGFCY02_N.B': 'y2_d', 'RIFLGFCM03_N.B': 'm3_d',
}
data = {v: {} for v in WANT.values()}
cur = None
for ev, el in ET.iterparse(SRC, events=('start', 'end')):
    tag = el.tag.split('}')[-1]
    if ev == 'start' and tag == 'Series':
        cur = WANT.get(el.get('SERIES_NAME'))
    elif ev == 'end' and tag == 'Obs' and cur:
        v = el.get('OBS_VALUE')
        try:
            fv = float(v)
        except (TypeError, ValueError):
            fv = None
        # 결측(ND·-9999)·비정상 상태는 버린다
        if fv is not None and fv > -999 and el.get('OBS_STATUS') == 'A':
            data[cur][el.get('TIME_PERIOD')] = fv
        el.clear()
    elif ev == 'end' and tag == 'Series':
        cur = None
        el.clear()


def month_end(daily):
    out = {}
    for d in sorted(daily):
        out[d[:7]] = daily[d]  # 마지막 관측일 값이 남는다
    return out


avg = {k: {p[:7]: v for p, v in data[k].items()} for k in ('y10_avg', 'y2_avg', 'm3_avg')}
eom = {k: month_end(data[k + '_d']) for k in ('y10', 'y2', 'm3')}
months = sorted(set(avg['y10_avg']) | set(eom['y10']))
rows = []
for m in months:
    if m < '1976-01' or m > '2025-12':
        continue
    a10, a2, a3 = avg['y10_avg'].get(m), avg['y2_avg'].get(m), avg['m3_avg'].get(m)
    e10, e2, e3 = eom['y10'].get(m), eom['y2'].get(m), eom['m3'].get(m)
    f = lambda a, b: None if a is None or b is None else round(a - b, 2)
    rows.append({'month': m, 'us10y_avg': a10, 'us2y_avg': a2, 'us3m_avg': a3,
                 'spread_10y2y_avg': f(a10, a2), 'spread_10y3m_avg': f(a10, a3),
                 'us10y_eom': e10, 'us2y_eom': e2, 'us3m_eom': e3,
                 'spread_10y2y_eom': f(e10, e2), 'spread_10y3m_eom': f(e10, e3)})
with open(OUT, 'w', newline='', encoding='utf-8') as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0]))
    w.writeheader()
    for r in rows:
        w.writerow({k: ('' if v is None else v) for k, v in r.items()})

# 연도별 '마이너스인 달' 수 (월평균 기준, 보조로 월말)
yr = defaultdict(lambda: {'2a': [], '3a': [], '2e': [], '3e': []})
for r in rows:
    y = int(r['month'][:4])
    for key, c in (('2a', 'spread_10y2y_avg'), ('3a', 'spread_10y3m_avg'), ('2e', 'spread_10y2y_eom'), ('3e', 'spread_10y3m_eom')):
        if r[c] is not None:
            yr[y][key].append((r['month'], r[c]))


def neg(y, key):
    L = yr[y][key]
    return None if not L else [m for m, v in L if v < 0]


PEAKS = {'SPX': {1999, 2007, 2021}, 'NDX': {1999, 2007, 2021}}  # 1972는 자료 없음
FIRST = {'SPX': 1976, 'NDX': 1986}
for key, nm in (('2a', '10-2 월평균'), ('3a', '10-3개월 월평균'), ('2e', '10-2 월말'), ('3e', '10-3개월 월말')):
    print('==', nm)
    for p in (1999, 2007, 2021):
        n = neg(p, key)
        print(f'  고점 {p}: 마이너스 달 {len(n)} {n}')
        n0 = neg(p - 1, key)
        print(f'    (전년 {p-1}: {len(n0)} {n0[:3]}{"..." if n0 and len(n0) > 3 else ""})')
    for idx in ('SPX', 'NDX'):
        ys = [y for y in range(FIRST[idx], 2025) if neg(y, key) is not None]
        c = [y for y in ys if neg(y, key)]
        k = [y for y in c if y in PEAKS[idx]]
        b = [y for y in ys if y in PEAKS[idx]]
        print(f'  {idx} 기준선: {ys[0]}~{ys[-1]} {len(ys)}년 중 조건 {len(c)}년 {c} | 고점 {len(k)} {k} (전체 {len(b)})')
        # 24개월 창(그해 또는 전년)
        c2 = [y for y in ys if neg(y, key) or (neg(y - 1, key) or [])]
        k2 = [y for y in c2 if y in PEAKS[idx]]
        print(f'    24개월 창: 조건 {len(c2)}년 | 고점 {len(k2)} {k2}')
