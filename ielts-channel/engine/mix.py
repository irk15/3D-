import json, numpy as np, soundfile as sf, subprocess
SR=24000
import sys, os; WD=sys.argv[1]
J=json.load(open(f'{WD}/timeline.json')); T=J['scenes']; total=J['total']
# voice
parts=[sf.read(f'{WD}/audio/s{i:02d}.wav')[0].astype(np.float32) for i in range(len(T))]
voice=np.concatenate(parts); N=int(round(total*SR)); voice=np.pad(voice,(0,max(0,N-len(voice))))[:N]
t=np.arange(N)/SR
# ---- ambient pad
chords=[[130.81,164.81,196.0,246.94,293.66],[110.0,164.81,196.0,246.94,261.63],[87.31,130.81,164.81,196.0,220.0],[98.0,146.83,220.0,246.94,329.63]]
CL=10.0; XF=3.5
pad=np.zeros(N,dtype=np.float32)
nch=int(np.ceil(total/CL))+1
for k in range(nch):
    f=chords[k%len(chords)]; t0=k*CL-XF/2; t1=(k+1)*CL+XF/2
    i0=max(0,int(t0*SR)); i1=min(N,int(t1*SR))
    if i1<=i0: continue
    tt=np.arange(i0,i1)/SR; env=np.ones_like(tt)
    a=np.clip((tt-t0)/XF,0,1); r=np.clip((t1-tt)/XF,0,1); env=np.sin(a*np.pi/2)*np.sin(r*np.pi/2)
    s=np.zeros_like(tt)
    for j,fr in enumerate(f):
        for dt in (-0.0018,0.0018):
            ph=2*np.pi*fr*(1+dt)*tt+j*1.3
            s+= (np.sin(ph)+0.28*np.sin(2*ph)+0.1*np.sin(3*ph))*(1.0/(1+0.12*j))
    s*=0.5+0.5*(0.75+0.25*np.sin(2*np.pi*0.11*tt+k))
    pad[i0:i1]+=(s*env).astype(np.float32)
# soft reverb via noise IR
rng=np.random.default_rng(7); L=int(1.8*SR); ir=rng.standard_normal(L)*np.exp(-np.arange(L)/(0.45*SR)); ir[0]=0
nfft=1<<int(np.ceil(np.log2(N+L)))
wet=np.fft.irfft(np.fft.rfft(pad,nfft)*np.fft.rfft(ir,nfft),nfft)[:N].astype(np.float32)
pad=pad*0.55+wet*0.45*0.012
# lowpass ~1800Hz (one-pole x2)
def lp(x,fc):
    a=np.exp(-2*np.pi*fc/SR); y=np.zeros_like(x); acc=0.0
    # vectorised via lfilter-like using cumulative approach in chunks
    from scipy.signal import lfilter
    return lfilter([1-a],[1,-a],x).astype(np.float32)
pad=lp(lp(pad,1800),2400)
pad/= (np.abs(pad).max()+1e-9)
# ducking from voice envelope
env=lp(np.abs(voice),4.0); env=env/(np.percentile(env,95)+1e-9)
duck=1-0.55*np.clip(env,0,1)
fade=np.clip(t/2.5,0,1)*np.clip((total-t)/3.0,0,1)
vrms=np.sqrt(np.mean(voice**2)+1e-12)
music=pad*duck*fade
music*=vrms*10**(-17/20)/(np.sqrt(np.mean(music**2))+1e-9)
# ---- sfx
sfx=np.zeros(N,dtype=np.float32)
def put(at,x):
    i=int(at*SR); 
    if i<0 or i>=N: return
    e=min(N,i+len(x)); sfx[i:e]+=x[:e-i]
def bell(f,dur=0.9,amp=1.0):
    tt=np.arange(int(dur*SR))/SR
    return (amp*(np.sin(2*np.pi*f*tt)+0.35*np.sin(2*np.pi*f*2.01*tt)+0.12*np.sin(2*np.pi*f*3.02*tt))*np.exp(-tt*5.2)*np.minimum(1,tt/0.004)).astype(np.float32)
def thud(f=300,dur=0.4,amp=1.0):
    tt=np.arange(int(dur*SR))/SR
    return (amp*np.sin(2*np.pi*f*tt*(1-0.15*tt/dur))*np.exp(-tt*9)).astype(np.float32)
def tick():
    tt=np.arange(int(0.05*SR))/SR; return (np.sin(2*np.pi*1100*tt)*np.exp(-tt*80)).astype(np.float32)
for sc in T:
    S=sc['start']
    if sc['kind']=='letter':
        for f in sc['kd']['flags']: put(S+sc['kd']['times'][f['b']]+0.05, bell(1318.5 if sc['band']==8 else 987.77, 0.8, 0.9 if sc['band']==8 else 0.7) if sc['band']==8 else thud(330,0.35,0.8))
    elif sc['kind']=='verdict':
        for k,it in enumerate(sc['items']): put(S+sc['starts'][k]+0.15, bell(1568,0.8,0.8) if it[0]=='ok' else thud(280,0.35,0.8))
    elif sc['kind']=='compare':
        for k in range(len(sc['rows'])): put(S+sc['starts'][k+1]+0.5, bell(1318.5,0.7,0.8))
    elif sc['kind']=='turn':
        tp=sc['starts'][3]
        for s in range(int(sc['pause'])): put(S+tp+s, tick()*0.8)
        put(S+tp+sc['pause'], bell(1568,1.2,1.0)); put(S+tp+sc['pause']+0.18, bell(2093,1.2,0.7))
    elif sc['kind']=='cheat':
        for j in range(4): put(S+sc['starts'][0]+0.15+0.28*j+0.1, bell(1174.7+j*80,0.6,0.55))
    elif sc['kind']=='lead':
        put(S+0.15, bell(659.25 if sc['band']==6 else 880,1.4,1.0))
    elif sc['kind']=='title':
        put(S+0.6, bell(880,1.6,0.9)); put(S+0.75, bell(1318.5,1.6,0.6))
sfx*=vrms*10**(-15/20)/(np.abs(sfx).max()+1e-9)*0.5
mix=voice+music+sfx
mix/= max(1.0,np.abs(mix).max()/0.95)
sf.write(f'{WD}/audio/mix.wav',mix,SR)
print('voice rms dB',20*np.log10(vrms),'music rms dB',20*np.log10(np.sqrt(np.mean(music**2))),'peak',np.abs(mix).max())
