import sys,json
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
F='../font/pkg/package/dist/public/static/'
out={}
for w in ['SemiBold','Bold','ExtraBold']:
  f=TTFont(F+f'Pretendard-{w}.otf'); gs=f.getGlyphSet(); cmap=f.getBestCmap()
  d=[]
  for ch in '시크릿에셋':
    g=cmap[ord(ch)]; bp=BoundsPen(gs); gs[g].draw(bp)
    sp=SVGPathPen(gs); tp=TransformPen(sp,(1,0,0,-1,0,0)); gs[g].draw(tp)
    d.append(dict(ch=ch,adv=gs[g].width,bounds=bp.bounds,path=sp.getCommands()))
  out[w]=d
  print(w,[(x['ch'],x['adv'],x['bounds']) for x in d])
json.dump(out,open('glyphs.json','w'))
# --- 확정 워드마크용: Pretendard Variable wght 750 인스턴스 (npm pretendard 1.3.9 dist/public/variable/PretendardVariable.ttf, OFL 1.1)
from fontTools.varLib.instancer import instantiateVariableFont
for wt in [700,750]:
  f=instantiateVariableFont(TTFont('../font/pkg/package/dist/public/variable/PretendardVariable.ttf'),{'wght':wt})
  gs=f.getGlyphSet(); cmap=f.getBestCmap(); d=[]
  for ch in '시크릿에셋':
    g=cmap[ord(ch)]; bp=BoundsPen(gs); gs[g].draw(bp); sp=SVGPathPen(gs); gs[g].draw(TransformPen(sp,(1,0,0,-1,0,0)))
    d.append(dict(ch=ch,adv=gs[g].width,bounds=[round(v) for v in bp.bounds],path=sp.getCommands()))
  out[f'V{wt}']=d
json.dump(out,open('glyphs.json','w'))
# 순서: python3 glyphs.py → python3 final.py (sym.py·fit.py·wm.py·final_sym.py 사용, shapely 필요)
