import json, re
G=json.load(open('glyphs.json'))
def wordmark(weight='ExtraBold', kerns=(0,0,0,0), track=0):
  gl=G[weight]; x=0; parts=[]; minx=None; maxx=None; miny=1e9; maxy=-1e9
  for i,g in enumerate(gl):
    # bounds y-up -> y-down
    bx0,by0,bx1,by1=g['bounds']
    def shift(m):
      nums=m.group(0)
      return nums
    # translate path by x: parse numbers pairwise; SVGPathPen output uses absolute commands M L C Q H V Z
    path=g['path']
    toks=re.findall(r'[MLCQHVZ]|-?\d+\.?\d*',path)
    out=[];cmd=None;idx=0
    for t in toks:
      if t.isalpha(): cmd=t; out.append(t); idx=0; continue
      v=float(t)
      v=round(v)
      if cmd=='H' or (cmd in 'MLCQ' and idx%2==0): v+=x
      out.append(str(int(v)) if float(v).is_integer() else f'{v:g}'); idx+=1
    parts.append(' '.join(out).replace(' ,',','))
    gx0=x+bx0; gx1=x+bx1
    minx=gx0 if minx is None else min(minx,gx0); maxx=gx1 if maxx is None else max(maxx,gx1)
    miny=min(miny,-by1); maxy=max(maxy,-by0)
    if i<4: x+=g['adv']+track+kerns[i]
  d=''.join(parts)
  # compact: remove spaces before letters
  d=re.sub(r' ?([MLCQHVZ]) ?',r'\1',d)
  vb=(minx,miny,maxx-minx,maxy-miny)
  return d,vb
if __name__=='__main__':
  d,vb=wordmark(); print(vb, len(d))
