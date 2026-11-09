import json, os, re
from final_sym import make
from wm import wordmark
OUT='/home/user/vaultfolio/.memory/issues/4.66-125-nav-restructure/logo-final/'
os.makedirs(OUT,exist_ok=True)
DARK='#F2F3F6'; LIGHT='#111111'
SYM,c,o=make({'round':1.0,'gap':1.3})
SYM_S,c2,o2=make({'round':1.0,'gap':1.7})
KERN=(-15,-80,40,60); TRACK=50
WM,VB=wordmark('V750',KERN,TRACK)
json.dump(dict(sym=SYM,sym_small=SYM_S,wm=WM,vb=VB,gc=o['_gc'],bounds=c.bounds),open('final.json','w'))
hdr='<?xml version="1.0" encoding="UTF-8"?>\n'
def sym_svg(col,d,note):
  return hdr+f'<!-- 시크릿에셋 심볼 (#4.66 logo-spec): {note}. viewBox 32, 잉크 x 6.11~25.89 · y 2.6~29.4 (세로 중심 16) -->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><path fill="{col}" d="{d}"/></svg>\n'
open(OUT+'symbol-dark.svg','w').write(sym_svg(DARK,SYM,'다크 배경용 #F2F3F6, 틈 1.3'))
open(OUT+'symbol-light.svg','w').write(sym_svg(LIGHT,SYM,'라이트 배경용 #111111, 틈 1.3'))
open(OUT+'symbol-small.svg','w').write(sym_svg('currentColor',SYM_S,'저해상도 소형(1x·24px 이하·파비콘)용, 틈 1.7, currentColor'))
vb=' '.join(str(round(v)) for v in VB)
def wm_svg(col):
  return hdr+f'<!-- 시크릿에셋 워드마크 (#4.66 logo-spec): Pretendard Variable wght 750 아웃라인(SIL OFL 1.1), 자간 +50/2048em, 커닝 시크 -15·크릿 -80·릿에 +40·에셋 +60. viewBox = 잉크 경계(폰트 단위, y 아래로) -->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}"><path fill="{col}" d="{WM}"/></svg>\n'
open(OUT+'wordmark-dark.svg','w').write(wm_svg(DARK))
open(OUT+'wordmark-light.svg','w').write(wm_svg(LIGHT))
# 락업: 기준 단위 = S 잉크 높이 H. 375 기준 H=17.6px → 워드마크 잉크 높이 13px(0.739H), 잉크 간격 5.5px(0.3125H)
H=17.6; WH=13.0; GAP=5.5
s=H/26.8  # 심볼 viewBox 단위→px
sx0=6.1058*s  # 심볼 잉크 좌측(px, 박스 기준)
sym_box=32*s
ink_left=0
sym_x=-sx0
wm_x= (25.8942*s - sx0) + GAP
wm_w= WH*VB[2]/VB[3]
W=wm_x+wm_w; Ht=H
# 워드마크 세로: 잉크 중심 = 심볼 중심, 무게중심 보정 +0.25px
wm_y=(Ht-WH)/2+0.25
def lock_svg(col):
  return hdr+f'''<!-- 시크릿에셋 가로 락업 (#4.66 logo-spec). 375 헤더 실치수(px): S 잉크 {H}×{(25.8942-6.1058)*s:.2f}, 워드마크 잉크 높이 {WH}, 잉크 간격 {GAP}, 워드마크 +0.25 하향(무게중심) -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.2f} {Ht}" width="{W:.2f}" height="{Ht}">
<svg x="{sym_x:.3f}" y="{-2.6*s:.3f}" width="{sym_box:.3f}" height="{sym_box:.3f}" viewBox="0 0 32 32" overflow="visible"><path fill="{col}" d="{SYM}"/></svg>
<svg x="{wm_x:.3f}" y="{wm_y:.3f}" width="{wm_w:.3f}" height="{WH}" viewBox="{vb}"><path fill="{col}" d="{WM}"/></svg>
</svg>
'''
open(OUT+'lockup-dark.svg','w').write(lock_svg(DARK))
open(OUT+'lockup-light.svg','w').write(lock_svg(LIGHT))
# 앱 아이콘 제안 (대표 결정 대상): 512 타일, 기존 아이콘과 같은 차콜→검정 대각 그라데이션, S 잉크 높이 = 타일의 56%
def icon_svg(d):
  k=512*0.56/26.8; tx=256-16*k; ty=256-16*k
  return hdr+f'''<!-- 앱 아이콘·파비콘 통일 제안 (#4.66 logo-spec, 대표 결정 대상). 512 타일, maskable 안전영역(중앙 80%) 안에 S(잉크 높이 56%) -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs><linearGradient id="g" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3a3d42"/><stop offset="0.55" stop-color="#16171a"/><stop offset="1" stop-color="#050505"/></linearGradient></defs>
<rect width="512" height="512" fill="url(#g)"/>
<g transform="translate({tx:.2f} {ty:.2f}) scale({k:.4f})"><path fill="#FFFFFF" d="{d}"/></g>
</svg>
'''
open(OUT+'app-icon-proposal.svg','w').write(icon_svg(SYM))
def fav_svg(d):
  k=32*0.72/26.8; tx=16-16*k; ty=16-16*k
  return hdr+f'''<!-- 파비콘 제안 32px (#4.66 logo-spec, 대표 결정 대상): 순흑 타일 + 소형 심볼(틈 1.7), S 잉크 높이 72% -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><rect width="32" height="32" rx="0" fill="#000"/><g transform="translate({tx:.3f} {ty:.3f}) scale({k:.4f})"><path fill="#FFFFFF" d="{d}"/></g></svg>
'''
open(OUT+'favicon-proposal.svg','w').write(fav_svg(SYM_S))
print('W',W,'wm_x',wm_x,'wm_w',wm_w,'sym_box',sym_box, 'VB',VB, len(SYM), len(WM))
