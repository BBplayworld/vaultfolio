# R6 후보: 자간 T × S 잉크 높이 H (워드마크 13px 고정, 간격 = S 잉크 폭의 42.3% = 사양 5.5/13.0)
import json, sys
from final_sym import make
from wm import wordmark
SYM,_,_=make({'round':1.0,'gap':1.3})
KERN=(-15,-80,40,60)
INKW=25.8942-6.1058
GAPR=5.5/(INKW*17.6/26.8)
def geo(H,WH=13.0):
  s=H/26.8
  return dict(box=32*s, ml=-6.1058*s, gap=GAPR*INKW*s, wml=GAPR*INKW*s-(32-25.8942)*s, ink_w=INKW*s)
def lock(H,T,col,scale=1,WH=13.0,dy=0.25):
  WM,VB=wordmark('V750',KERN,T); vb=' '.join(str(round(v)) for v in VB)
  g=geo(H,WH); s=H/26.8
  wm_w=WH*VB[2]/VB[3]; wm_x=g['ink_w']+g['gap']; W=wm_x+wm_w
  return (f'<svg viewBox="0 0 {W:.3f} {H}" width="{W*scale:.3f}" height="{H*scale:.3f}" style="overflow:visible;display:block">'
   f'<svg x="{-6.1058*s:.3f}" y="{-2.6*s:.3f}" width="{g["box"]:.3f}" height="{g["box"]:.3f}" viewBox="0 0 32 32" overflow="visible"><path fill="{col}" d="{SYM}"/></svg>'
   f'<svg x="{wm_x:.3f}" y="{(H-WH)/2+dy:.3f}" width="{wm_w:.3f}" height="{WH}" viewBox="{vb}"><path fill="{col}" d="{WM}"/></svg></svg>'), W
if __name__=='__main__':
  for H in [17.6,16.8,16.4,16.0]:
    g=geo(H); L=H*15/13; gl=geo(L,15)
    print(f'H={H}: box {g["box"]:.3f} ml {g["ml"]:.3f} gap {g["gap"]:.3f} wml {g["wml"]:.3f} | lg H {L:.3f} box {gl["box"]:.3f} ml {gl["ml"]:.3f} gap {gl["gap"]:.3f} wml {gl["wml"]:.3f}')
  for T in [50,90,100,110,120]:
    WM,VB=wordmark('V750',KERN,T); print('T',T,'VB',VB,'w13',round(13*VB[2]/VB[3],2),'dpx',round((T-50)*13/1833,3))
