import numpy as np
from PIL import Image
N=1024; R=np.random.default_rng(11); OUT='/tmp/claude-0/-home-claude/21a3197f-a775-59ef-a322-b355a02c4a98/scratchpad/house/tex/'
fx=np.fft.fftfreq(N)[:,None]; fy=np.fft.fftfreq(N)[None,:]; F=np.sqrt(fx**2+fy**2)+1e-9
def noise(beta, aniso=(1,1)):
    w=np.fft.fft2(R.standard_normal((N,N))); Fa=np.sqrt((fx*aniso[0])**2+(fy*aniso[1])**2)+1e-9; w/=Fa**beta; w[0,0]=0
    n=np.real(np.fft.ifft2(w)); return (n-n.min())/(n.max()-n.min())
def blur(a,s): g=np.exp(-(F*N)**2/(2*(N/(2*np.pi*s))**2)); return np.real(np.fft.ifft2(np.fft.fft2(a)*g))
def nrm(h,k):
    dx=(np.roll(h,-1,1)-np.roll(h,1,1))*k; dy=(np.roll(h,-1,0)-np.roll(h,1,0))*k
    n=np.dstack([-dx,dy,np.ones_like(h)]); n/=np.linalg.norm(n,axis=2,keepdims=True); return n*.5+.5
def save(name, rgb, h, k, rough):
    Image.fromarray(np.clip(rgb*255,0,255).astype(np.uint8)).save(OUT+name+'_a.jpg',quality=88)
    Image.fromarray(np.clip(nrm(h,k)*255,0,255).astype(np.uint8)).save(OUT+name+'_n.jpg',quality=90)
    orm=np.dstack([np.ones((N,N)), rough, np.zeros((N,N))]); Image.fromarray(np.clip(orm*255,0,255).astype(np.uint8)).save(OUT+name+'_r.jpg',quality=90)
yy,xx=np.mgrid[0:N,0:N]
def C(r,g,b): return np.dstack([np.broadcast_to(np.asarray(v,dtype=float),(N,N)) for v in (r,g,b)])
# ---- oak planks: 1024px = 2 m, planks 0.19 m wide (97px), random lengths ----
pw=97; row=yy//pw; grain=noise(1.7,(1,9)); fine=noise(1.0,(1,14))
off=R.uniform(0,N,200)[row%200]; L=R.uniform(380,900,200)[row%200]; seg=((xx+off)//L).astype(int); pid=(row*37+seg*13)%997
tone=R.uniform(.82,1.12,997)[pid]; hue=R.uniform(-.03,.03,997)[pid]
base=C(.62+hue,.45+hue*.6,.30)*tone[...,None]
g=(grain*.65+fine*.35); rgb=base*(.78+.38*g[...,None]); knots=blur((R.random((N,N))>.99999).astype(float),5); rgb*=1-np.clip(knots*25,0,.35)[...,None]
gapY=(yy%pw<2); gapX=(((xx+off)%L)<2); gap=(gapY|gapX); rgb[gap]*=.35
h=g*.25-gap*1.0; save('oak',rgb,blur(h,.6),2.0,np.clip(.42+.12*(1-g)+gap*.3,0,1))
# ---- walnut (furniture), no planks ----
g=noise(1.8,(1,12))*.7+noise(1.0,(1,20))*.3; rgb=C(.36,.22,.14)*(.72+.5*g[...,None]); save('walnut',rgb,g*.2,1.4,.38+.1*(1-g))
# ---- white Calacatta-style marble ----
n1=noise(1.9); n2=noise(1.4); v=np.abs(np.sin((xx*.004+yy*.0022+n1*6.0)*3.1)); vein=np.clip(1-v*18,0,1)**1.5; v2=np.clip(1-np.abs(np.sin((xx*.0013-yy*.003+n2*5)*4))*30,0,1)
rgb=C(.93,.92,.9)*(.97+.03*noise(1.2)[...,None]); rgb=rgb*(1-vein[...,None]*np.array([.45,.47,.5]))*(1-v2[...,None]*.25); rgb[...,0]+=vein*.05
save('marble',rgb,vein*.05,1,np.full((N,N),.12))
# ---- linen fabric ----
wv=(np.sin(xx*np.pi/2.0)*.5+.5)*.5+(np.sin(yy*np.pi/2.0)*.5+.5)*.5; slub=noise(.8,(1,30)); g=wv*.6+slub*.4; rgb=C(.86,.83,.78)*(.85+.2*g[...,None]); save('linen',rgb,g*.6,2.5,np.full((N,N),.9))
# ---- travertine (deck, 1024px = 2 m, tiles 0.6 m) ----
t=307; jd=np.minimum(np.minimum(xx%t,t-xx%t),np.minimum(yy%t,t-yy%t)); n=noise(1.6,(1,4)); pits=blur((R.random((N,N))>.997).astype(float),1.2)
rgb=C(.86,.79,.68)*(.88+.18*n[...,None]); rgb*=1-np.clip(pits*6,0,.35)[...,None]; rgb[jd<2]*=.7
save('travertine',rgb,n*.2-pits*2-(jd<2)*1.0,1.5,np.clip(.7-pits*.3,0,1))
# ---- dark slate tile (bathroom, tiles 0.5 m = 256px) ----
t=256; jd=np.minimum(np.minimum(xx%t,t-xx%t),np.minimum(yy%t,t-yy%t)); n=noise(1.3); tid=(yy//t)*4+(xx//t); tone=R.uniform(.85,1.1,16)[tid]
rgb=C(.2,.21,.22)*(.8+.4*n[...,None])*tone[...,None]; rgb[jd<2]=[.6,.6,.6]
save('slate',rgb,n*.3-(jd<2)*1.0,1.8,np.clip(.55+.2*n,0,1))
# ---- fine plaster (interior walls) ----
n=noise(1.0)*.5+noise(.5)*.5; rgb=C(.95,.94,.92)*(.97+.03*noise(1.6)[...,None]); save('plaster',rgb,blur(n,1.0),1.4,np.full((N,N),.85))
print('done')
