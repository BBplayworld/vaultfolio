from sym import *
import json,sys
FINAL=dict(BASE); FINAL.update(dict(ang=30,hs=3.6,yt=8.9,yb=22.6,xr_t=23.05,xl_u=8.85,xr_l=23.35,xl_b=8.6,tcut=-18.3,gang=-18.3,gap=1.2,Wv=4.2,Wh=3.6))
def make(over={},fitted=True):
  o=dict(FINAL); o.update(over); p=build(o); c=cut(p,o)
  return (topath_fit(c) if fitted else topath(c)), c, o
if __name__=='__main__':
  d,c,o=make(json.loads(sys.argv[1]) if len(sys.argv)>1 else {})
  print(d); print(len(d), c.bounds, o['_gc'], o['_s'])
