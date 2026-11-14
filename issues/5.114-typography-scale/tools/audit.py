import re,os,sys,collections,json
SZ=r'(?:xs|sm|base|lg|xl|[2-9]xl|\[[0-9.]+(?:px|rem|em)\])'
pat=re.compile(r'(?<![\w-])((?:[a-z0-9\[\]@:<>=-]+:)*)text-('+SZ+r')(?:/[\w.\[\]]+)?(?![\w-])')
tot=collections.Counter(); byfile=collections.defaultdict(collections.Counter); area=collections.defaultdict(collections.Counter)
resp=collections.Counter(); respfile=collections.defaultdict(set)
rows=[]
def areaof(p):
    for k,v in [('views/home','홈'),('views/detail','상세'),('views/activity','성과'),('views/tax','세금'),('header-menu','더보기·설정'),('forms','입력폼'),('layout','레이아웃·네비'),('components/ui','ui프리미티브'),('config/theme','theme.ts토큰'),('preview','인증카드'),('tutorial','튜토리얼'),('trial','체험'),('pwa','PWA'),('ratio','ratio'),('guide','가이드')]:
        if k in p: return v
    return '기타'
for d,_,fs in os.walk('src'):
    for f in fs:
        if not f.endswith(('.tsx','.ts','.css')) or '.test.' in f or '__tests__' in d: continue
        p=os.path.join(d,f)
        for i,l in enumerate(open(p,encoding='utf8'),1):
            for m in pat.finditer(l):
                pre,s=m.group(1),m.group(2)
                tot[s]+=1; byfile[p][s]+=1; area[areaof(p)][s]+=1
                if pre:
                    resp[pre+s]+=1; respfile[pre+s].add(p)
                rows.append((p,i,pre,s))
print('files with any',len(byfile),'total occurrences',sum(tot.values()))
print('TOTAL',sorted(tot.items(),key=lambda x:-x[1]))
print('prefixed (responsive/variant) total',sum(resp.values()))
print(sorted(resp.items(),key=lambda x:-x[1])[:60])
for a,c in sorted(area.items(),key=lambda x:-sum(x[1].values())):
    print(a,sum(c.values()),dict(sorted(c.items(),key=lambda x:-x[1])))
print('TOPFILES')
for p,c in sorted(byfile.items(),key=lambda x:-sum(x[1].values()))[:45]:
    print(sum(c.values()),p.replace('src/app/(main)/_components/',''),dict(c))
json.dump(rows,open(sys.argv[1],'w'))
