import math, numpy as np
from shapely.geometry import Polygon, LineString, box
from shapely.ops import unary_union
from shapely import affinity
def bez(p0,p1,p2,p3,n=200):
  t=np.linspace(0,1,n)[:,None]; p0,p1,p2,p3=map(np.array,(p0,p1,p2,p3))
  pts=(1-t)**3*p0+3*(1-t)**2*t*p1+3*(1-t)*t**2*p2+t**3*p3
  d=3*(1-t)**2*(p1-p0)+6*(1-t)*t*(p2-p1)+3*t**2*(p3-p2)
  return pts,d
def centerline(o):
  cy=o['cy']; a=math.radians(o['ang']); hs=o['hs']
  cu=(16-hs*math.cos(a), cy-hs*math.sin(a)); cd=(16+hs*math.cos(a), cy+hs*math.sin(a))
  Tt=(o['xr_t'],o['yt']); top=(o['xtop'],o['ytop']); UL=(o['xl_u'],o['yl_u'])
  LR=(o['xr_l'],o['yr_l']); bot=(o['xbot'],o['ybot']); Tb=(o['xl_b'],o['yb'])
  k=o['k']; ks=o['ks']
  segs=[]
  segs.append((Tt,(Tt[0],Tt[1]-k*(Tt[1]-top[1])),(top[0]+k*(Tt[0]-top[0]),top[1]),top))
  segs.append((top,(top[0]-k*(top[0]-UL[0]),top[1]),(UL[0],UL[1]-k*(UL[1]-top[1])),UL))
  segs.append((UL,(UL[0],UL[1]+ks*(cy-UL[1])),cu,(16,cy)))
  segs.append(((16,cy),cd,(LR[0],LR[1]-ks*(LR[1]-cy)),LR))
  segs.append((LR,(LR[0],LR[1]+k*(bot[1]-LR[1])),(bot[0]+k*(LR[0]-bot[0]),bot[1]),bot))
  segs.append((bot,(bot[0]-k*(bot[0]-Tb[0]),bot[1]),(Tb[0],Tb[1]+k*(bot[1]-Tb[1])),Tb))
  P=[];D=[]
  for s in segs:
    p,d=bez(*s); P.append(p[:-1]); D.append(d[:-1])
  P.append(p[-1:]); D.append(d[-1:])
  return np.vstack(P),np.vstack(D),segs
def width(d,o):
  phi=np.abs(np.arctan2(d[:,1],d[:,0]))  # 0..pi
  s=np.abs(np.sin(phi))
  full=math.sin(math.radians(o.get('fullAt',35)))
  t=np.clip(s/full,0,1)
  t=(1-np.cos(np.pi*t))/2
  return o['Wh']+(o['Wv']-o['Wh'])*t
def outline(o):
  P,D,segs=centerline(o)
  w=width(D,o)
  T=D/np.linalg.norm(D,axis=1)[:,None]; N=np.stack([-T[:,1],T[:,0]],1)
  L=P+N*(w/2)[:,None]; R=P-N*(w/2)[:,None]
  # extend ends straight by 3 units to allow angled terminal cuts
  e=3
  L0=L[0]-T[0]*e; R0=R[0]-T[0]*e; L1=L[-1]+T[-1]*e; R1=R[-1]+T[-1]*e
  LL=np.vstack([[L0],L,[L1]]); RR=np.vstack([[R0],R,[R1]])
  quads=[Polygon([LL[i],LL[i+1],RR[i+1],RR[i]]).buffer(0) for i in range(len(LL)-1)]
  poly=unary_union(quads).buffer(0.0005).buffer(-0.0005)
  # terminal cuts: half-planes through terminal centerline point at angle
  for idx,ang,keep_sign in [(0,o['tcut'],1),(-1,o['tcut'],-1)]:
    p=P[idx]; a=math.radians(ang); u=np.array([math.cos(a),math.sin(a)]); n=np.array([-u[1],u[0]])
    big=60
    # half-plane polygon on side where centerline goes (towards inside of glyph)
    inward=-T[idx] if idx==0 else T[idx]   # direction away from glyph
    inward=-inward
    if np.dot(n,inward)<0: n=-n
    hp=Polygon([p+u*big, p-u*big, p-u*big-n*big, p+u*big-n*big])  # 바깥쪽
    from shapely.geometry import Point
    poly=poly.difference(hp.intersection(Point(*p).buffer(4.6,64)))
  return poly,P,w
def normalize(poly,o):
  minx,miny,maxx,maxy=poly.bounds
  s=26.8/(maxy-miny)
  tx=16-(minx+maxx)/2*s; ty=2.6-miny*s
  poly=affinity.affine_transform(poly,[s,0,0,s,tx,ty])
  o['_gc']=(16*s+tx, o['cy']*s+ty); o['_s']=s
  return poly
def cut(poly,o):
  a=math.radians(o['gang']); u=np.array([math.cos(a),math.sin(a)]); n=np.array([-u[1],u[0]])
  c=np.array(o['_gc']) if '_gc' in o else np.array([16,o.get('gcy',16)])
  # find spine center after normalize: use given gcy
  g=o['gap']/2; big=60
  band=Polygon([c+u*big+n*g, c-u*big+n*g, c-u*big-n*g, c+u*big-n*g])
  return poly.difference(band)
def topath_fit(poly,err=0.02):
  from fit import ring_to_path
  polys=[poly] if poly.geom_type=='Polygon' else list(poly.geoms)
  return ''.join(ring_to_path(list(r.coords),err) for p in polys for r in [p.exterior]+list(p.interiors))
def topath(poly,tol=0.004):
  polys=[poly] if poly.geom_type=='Polygon' else list(poly.geoms)
  out=[]
  for p in polys:
    p=p.simplify(tol)
    for ring in [p.exterior]+list(p.interiors):
      c=list(ring.coords)[:-1]
      out.append('M'+' L'.join(f"{x:.2f} {y:.2f}" for x,y in c)+'Z')
  return ''.join(out)
BASE=dict(cy=15.5,ang=22,hs=3.9,xr_t=23.25,yt=9.68,xtop=16,ytop=5,xl_u=8.75,yl_u=9.68,
  xr_l=23.5,yr_l=21.88,xbot=16,ybot=27,xl_b=8.5,yb=21.88,k=0.56,ks=0.43,
  Wv=4.8,Wh=4.8,tcut=0,gang=-18.3,gap=1.1,gcy=15.5)
def build(o):
  poly,P,w=outline(o)
  r=o.get('round',0)
  if r: poly=poly.buffer(r,quad_segs=64).buffer(-r,quad_segs=64)
  poly=normalize(poly,o) if o.get('norm',True) else poly
  return poly
