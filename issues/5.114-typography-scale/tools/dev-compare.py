import json,glob,os,collections,sys
B,A=sys.argv[1],sys.argv[2]
W=[int(x) for x in (sys.argv[3] if len(sys.argv)>3 else '360,390,430,768,1024,1280,1440').split(',')]
names=sorted({os.path.basename(f).rsplit('-',1)[0] for f in glob.glob(A+'/*.json')})
tot=collections.Counter(); dec=collections.defaultdict(lambda: collections.defaultdict(set)); inc=collections.Counter()
for s in names:
    for w in W:
        try: b=json.load(open(f'{B}/{s}-{w}.json')); a=json.load(open(f'{A}/{s}-{w}.json'))
        except Exception as e: print(s,w,'missing'); continue
        idx=collections.defaultdict(list)
        for n in b['blocks']: idx[n['t']].append(n)
        used=collections.Counter(); wraps=[]
        for n in a['blocks']:
            l=idx.get(n['t'])
            if not l or used[n['t']]>=len(l): continue
            o=l[used[n['t']]]; used[n['t']]+=1
            if n['lines']>o['lines']: wraps.append(f"'{n['t'][:22]}'({o['fs']:g}→{n['fs']:g},{o['lines']}→{n['lines']}줄)")
        # 노드 단위: 넘침·잘림·크기 감소
        nidx=collections.defaultdict(list)
        for n in b['nodes']:
            if not n['svg']: nidx[n['t']].append(n)
        used=collections.Counter(); over=[]; clip=[]
        for n in a['nodes']:
            if n['svg']: continue
            l=nidx.get(n['t']); o=None
            if l and used[n['t']]<len(l): o=l[used[n['t']]]; used[n['t']]+=1
            if n['over'] and not (o and o['over']): over.append(n['t'][:16])
            if n['clip'] and o is not None and not o['clip']: clip.append(n['t'][:16])
            if o is not None:
                if n['fs']<o['fs']-0.01: dec[w][(o['fs'],n['fs'],n['cls'][:70])].add(f"{s}:{n['t'][:14]}")
                elif n['fs']>o['fs']+0.01: inc[w]+=1
        newcoll=[c for c in a['coll'] if c not in b['coll']]
        dh=a['docH']-b['docH']
        flag=wraps or over or clip or newcoll or a['docW']>a['vw'] or (w<700 and abs(dh)>30)
        tot[(w,'wrap')]+=len(wraps); tot[(w,'over')]+=len(over); tot[(w,'clip')]+=len(clip); tot[(w,'coll')]+=len(newcoll); tot[(w,'docover')]+=int(a['docW']>a['vw'])
        if flag: print(f"{s:22s}{w:5d} H{dh:+d}"+(f" | 줄밀림 {'; '.join(wraps[:8])}" if wraps else '')+(f" | 넘침 {over[:6]}" if over else '')+(f" | 새잘림 {clip[:6]}" if clip else '')+(f" | 새겹침 {newcoll[:4]}" if newcoll else '')+(" | 문서넘침" if a['docW']>a['vw'] else ''))
print('합계',{f"{k[0]}:{k[1]}":v for k,v in sorted(tot.items()) if v})
if '--dec' in sys.argv:
    for w in W:
        print('== 감소',w,'(증가 노드',inc[w],')')
        for (o,n,c),ex in sorted(dec[w].items(),key=lambda x:-len(x[1])):
            print(f"  {o:g}→{n:g} ×{len(ex)} [{c}] 예: {sorted(ex)[:3]}")
