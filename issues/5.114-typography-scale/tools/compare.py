import json,glob,os,collections,sys
B,A=sys.argv[1],sys.argv[2]
W=[360,390,430,768,1024,1280,1440]
names=sorted({os.path.basename(f).rsplit('-',1)[0] for f in glob.glob(A+'/*.json')})
tot=collections.Counter(); totc=collections.Counter(); toth=collections.Counter()
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
            if n['lines']>o['lines']: wraps.append(f"'{n['t'][:24]}'({o['fs']:g}→{n['fs']:g}px,{o['lines']}→{n['lines']}줄)")
        newcoll=[c for c in a['coll'] if c not in b['coll']]
        bc=[n['t'][:20] for n in b['blocks'] if n['clipX']]; ac=[n['t'][:20] for n in a['blocks'] if n['clipX']]
        newclip=[t for t in ac if t not in bc]
        over=a['docW']>a['vw']
        tot[w]+=len(wraps); totc[w]+=len(newcoll); toth[w]+=a['docH']-b['docH']
        print(f"{s:22s}{w:5d} H {b['docH']}→{a['docH']} ({a['docH']-b['docH']:+d})"+(f" | 줄밀림{len(wraps)}: "+'; '.join(wraps[:10]) if wraps else '')+(f" | 새 겹침{len(newcoll)}: {newcoll[:5]}" if newcoll else '')+(f" | 새 잘림: {newclip[:5]}" if newclip else '')+(" | 가로넘침" if over else '')+(f" | 기존겹침{len(b['coll'])}" if b['coll'] else ''))
print('폭별 줄밀림',dict(tot)); print('폭별 새 겹침',dict(totc)); print('폭별 높이 증가 합',dict(toth))
