import sys
from r6 import lock, geo
sel=(float(sys.argv[1]),int(sys.argv[2])) if len(sys.argv)>2 else None
out=sys.argv[3] if len(sys.argv)>3 else 'grid.html'
bg='oklch(0.16 0.010 265)'; fg='#8b95a1'; col='#F2F3F6'
Hs=[17.6,16.8,16.4,16.0]; Ts=[50,90,100,110]
lab=lambda t:'+0' if t==50 else f'+{(t-50)*13/1833:.2f}px'
hdr='<tr><td></td>'+''.join(f'<td style="color:{fg};padding:6px 10px;font:600 11px sans-serif">{"사양 " if t==50 else ""}자간 +{t}/2048em<br><span style="font-weight:400">글자 사이 {lab(t)} (13px)</span></td>' for t in Ts)+'</tr>'
rows=[]
for H in Hs:
  g=geo(H); cells=''
  for T in Ts:
    svg,_=lock(H,T,col); is_sel=sel and abs(sel[0]-H)<1e-6 and sel[1]==T; is_spec=(H==17.6 and T==50)
    st='outline:1.5px solid #f59e0b;outline-offset:-4px;border-radius:8px' if is_sel else ('outline:1px dashed #6b7684;outline-offset:-4px;border-radius:8px' if is_spec else '')
    cells+=f'<td style="padding:14px 12px;{st}">{svg}</td>'
  rows.append(f'<tr><td style="color:{fg};padding:6px 10px;font:600 11px sans-serif">{"사양 " if H==17.6 else ""}S 잉크 {H}px<br><span style="font-weight:400">간격 {g["gap"]:.2f}px</span></td>{cells}</tr>')
big=''
for H,T,name in [(17.6,50,'사양 제안본 S 17.6 · 자간 +50')]+([(sel[0],sel[1],f'채택 S {sel[0]} · 자간 +{sel[1]}')] if sel else []):
  svg,_=lock(H,T,col,3); big+=f'<div style="display:flex;align-items:center;gap:14px;margin:12px 0">{svg}<span style="color:{fg};font:11px sans-serif">{name} (3배)</span></div>'
title='R6 대표 피드백 — 자간 후보 × S 크기 후보, 375 실제 크기(워드마크 13px), DPR3 · 점선 = 사양 제안본'+(' · 주황 = 채택' if sel else '')
html=f'<body style="margin:0;background:{bg};padding:12px"><div style="color:{fg};font:700 12px sans-serif;margin:0 0 6px 10px">{title}</div><table cellspacing=0>{hdr}{"".join(rows)}</table><div style="padding:6px 10px">{big}</div></body>'
open(out,'w').write(html)
