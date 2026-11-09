# Schneider 곡선 적합 (Graphics Gems) — 폴리곤 → 3차 베지어
import numpy as np, math
def bz(ctrl,t):
  t=np.asarray(t)[:,None]; p0,p1,p2,p3=ctrl
  return (1-t)**3*p0+3*(1-t)**2*t*p1+3*(1-t)*t**2*p2+t**3*p3
def bzd(ctrl,t):
  t=np.asarray(t)[:,None]; p0,p1,p2,p3=ctrl
  return 3*(1-t)**2*(p1-p0)+6*(1-t)*t*(p2-p1)+3*t**2*(p3-p2)
def bzdd(ctrl,t):
  t=np.asarray(t)[:,None]; p0,p1,p2,p3=ctrl
  return 6*(1-t)*(p2-2*p1+p0)+6*t*(p3-2*p2+p1)
def chord(P):
  d=np.r_[0,np.cumsum(np.linalg.norm(np.diff(P,axis=0),axis=1))]; return d/d[-1]
def gen(P,u,t1,t2):
  p0,p3=P[0],P[-1]
  A1=np.outer(3*(1-u)**2*u,t1); A2=np.outer(3*(1-u)*u**2,t2)
  C=np.zeros((2,2)); X=np.zeros(2)
  for i in range(len(P)):
    C[0,0]+=A1[i]@A1[i]; C[0,1]+=A1[i]@A2[i]; C[1,1]+=A2[i]@A2[i]
    tmp=P[i]-bz((p0,p0,p3,p3),[u[i]])[0]
    X[0]+=A1[i]@tmp; X[1]+=A2[i]@tmp
  C[1,0]=C[0,1]; det=np.linalg.det(C)
  seg=np.linalg.norm(p3-p0)
  if abs(det)>1e-12:
    a1=(X[0]*C[1,1]-C[0,1]*X[1])/det; a2=(C[0,0]*X[1]-C[1,0]*X[0])/det
  else: a1=a2=seg/3
  if a1<1e-6*seg or a2<1e-6*seg: a1=a2=seg/3
  return np.array([p0,p0+t1*a1,p3+t2*a2,p3])
def reparam(ctrl,P,u):
  q=bz(ctrl,u)-P; q1=bzd(ctrl,u); q2=bzdd(ctrl,u)
  num=(q*q1).sum(1); den=(q1*q1).sum(1)+(q*q2).sum(1)
  return np.clip(u-np.where(den!=0,num/den,0),0,1)
def maxerr(ctrl,P,u):
  d=np.linalg.norm(bz(ctrl,u)-P,axis=1); i=int(d.argmax()); return d[i],i
def unit(v): return v/np.linalg.norm(v)
def fit(P,t1,t2,err):
  if len(P)==2:
    d=np.linalg.norm(P[1]-P[0])/3; return [np.array([P[0],P[0]+t1*d,P[1]+t2*d,P[1]])]
  u=chord(P); c=gen(P,u,t1,t2); e,i=maxerr(c,P,u)
  if e<err: return [c]
  if e<err*4:
    for _ in range(20):
      u=reparam(c,P,u); c=gen(P,u,t1,t2); e,i=maxerr(c,P,u)
      if e<err: return [c]
  i=max(1,min(len(P)-2,i))
  tc=unit(P[i-1]-P[i+1])
  return fit(P[:i+1],t1,tc,err)+fit(P[i:],-tc,t2,err)
def ring_to_path(coords,err=0.02,corner=35):
  P=np.array(coords[:-1]) if np.allclose(coords[0],coords[-1]) else np.array(coords)
  n=len(P)
  # 코너 탐지
  ang=[]
  for i in range(n):
    a=unit(P[i]-P[i-1]); b=unit(P[(i+1)%n]-P[i]); ang.append(math.degrees(math.acos(np.clip(a@b,-1,1))))
  corners=[i for i in range(n) if ang[i]>corner]
  if not corners: corners=[0]
  out=[]
  start=corners[0]
  order=corners+[corners[0]+n]
  segs=[]
  for a,b in zip(order[:-1],order[1:]):
    idx=[k%n for k in range(a,b+1)]; Q=P[idx]
    if len(Q)<3:
      segs.append(('L',Q[-1])); continue
    # 직선 판정
    uu=unit(Q[-1]-Q[0]); R=Q-Q[0]; d=np.abs(uu[0]*R[:,1]-uu[1]*R[:,0]).max()
    if d<err: segs.append(('L',Q[-1])); continue
    t1=unit(Q[1]-Q[0]) if len(Q)<5 else unit(Q[2]-Q[0]); t2=unit(Q[-2]-Q[-1]) if len(Q)<5 else unit(Q[-3]-Q[-1])
    for c in fit(Q,t1,t2,err): segs.append(('C',c))
  f=lambda v: (f"{v:.2f}").rstrip('0').rstrip('.') if abs(v)>=0.005 else '0'
  s=f"M{f(P[start][0])} {f(P[start][1])}"
  for kind,v in segs:
    if kind=='L': s+=f"L{f(v[0])} {f(v[1])}"
    else: s+=f"C{f(v[1][0])} {f(v[1][1])} {f(v[2][0])} {f(v[2][1])} {f(v[3][0])} {f(v[3][1])}"
  return s+'Z'
