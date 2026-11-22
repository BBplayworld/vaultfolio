import csv,sys,re
BAN=['때문','덕분','로 인해','영향','촉발','여파','역전','신호','예고','기회','타이밍','유리','추천','수익','로그','지금 사면','→','↑','↓','가데이터','확인 중',
     '전조','조심','경고','과열','붐','기대','연착륙','반등','하세요','해서','사세요','파세요']
CATS={'금리·통화 정책','금융위기','시장 급락','전쟁·지정학','기술 거품','팬데믹','에너지'}
rows=list(csv.DictReader(open(sys.argv[1],encoding='utf-8')))
bad=0;longn=[]
for r in rows:
    f=r['fact'];n=r['name']
    hits=[b for b in BAN if b in f or b in n]
    e=[]
    if len(f)>40: e.append(f'사실 {len(f)}자')
    if not f.endswith('요.'): e.append('해요체 아님')
    if hits: e.append('금지어 '+','.join(hits))
    if r['category'] not in CATS: e.append('분류 밖')
    if r['grade'] not in ('1차','wiki_only'): e.append('등급')
    if len(n)>12: longn.append((r['id'],n,len(n)))
    if e: bad+=1; print('FAIL',r['id'],e,f)
yrs=sorted({int(r['year']) for r in rows})
miss=[y for y in range(1990,2027) if y not in yrs]
g=[r['grade'] for r in rows]
print(f'행 {len(rows)} · 사실 FAIL {bad} · 최대 사실 길이 {max(len(r["fact"]) for r in rows)}자')
print('표시명 12자 초과:',longn)
print('빠진 해:',miss,'· 채운 해',len(yrs),'/37')
print('1차',g.count('1차'),'wiki_only',g.count('wiki_only'))
from collections import Counter
print('규칙',Counter(r['rule'] for r in rows)); print('분류',Counter(r['category'] for r in rows)); print('지역',Counter(r['region'] for r in rows))
