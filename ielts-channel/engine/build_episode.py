"""build_episode.py  <episode.json> <workdir>
Narration (Kokoro, voice af_heart) + timing -> workdir/timeline.json, workdir/audio/sNN.wav, workdir/subtitles.srt"""
import json, re, os, sys, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

EP = json.load(open(sys.argv[1])); WD = sys.argv[2]; os.makedirs(f'{WD}/audio', exist_ok=True)
MODELS = os.environ.get('KOKORO_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models'))
SR = 24000; SPEED = EP['voice']['speed']; VOICE = EP['voice']['name']
k = Kokoro(f'{MODELS}/kokoro-v1.0.onnx', f'{MODELS}/voices-v1.0.bin')
SPEECH_FIX = [tuple(x) for x in EP.get('speech_fix', [])] + [("“", ""), ("”", ""), ("can't", "can not")]
def speech(t):
    for a, b in SPEECH_FIX: t = t.replace(a, b)
    return t.replace('’', "'")

def synth(text):
    s, sr = k.create(speech(text), voice=VOICE, speed=SPEED, lang='en-us')
    s = np.asarray(s, dtype=np.float32)
    # trim silence
    idx = np.where(np.abs(s) > 0.008)[0]
    if len(idx): s = s[max(0, idx[0] - 600): idx[-1] + 1500]
    return s

def sil(sec): return np.zeros(int(SR * sec), dtype=np.float32)

def words_of(text): return text.split(' ')
def syl(w):
    w = re.sub(r'[^a-z]', '', w.lower())
    if not w: return 1
    n = len(re.findall(r'[aeiouy]+', w))
    if w.endswith('e') and not w.endswith(('le', 'ee')) and n > 1: n -= 1
    return max(1, n)
def weight(w): return syl(w) * 1.0 + 0.35 + 0.08 * len(re.sub(r'[^\w]', '', w))

def pauses(a, thr=0.012, min_len=0.11):
    """internal silence runs (start,end) in seconds inside a trimmed clip"""
    fr = int(SR * 0.01); n = len(a) // fr
    env = np.array([np.abs(a[i*fr:(i+1)*fr]).mean() for i in range(n)])
    runs = []; i = 0
    while i < n:
        if env[i] < thr:
            j = i
            while j < n and env[j] < thr: j += 1
            if (j - i) * 0.01 >= min_len and i > 8 and j < n - 8: runs.append((i * 0.01, j * 0.01))
            i = j
        else: i += 1
    return runs

def word_starts(ws, a, t0):
    """start time of each word of a sentence whose audio is `a`, beginning at t0 (seconds)"""
    d = len(a) / SR
    commas = [i for i, w in enumerate(ws) if w.endswith((',', ';')) and i < len(ws) - 1]
    runs = pauses(a)
    segs = []  # (first_word, last_word_exclusive, t_start, t_end)
    if commas and len(runs) >= len(commas):
        best = sorted(sorted(runs, key=lambda r: r[1] - r[0], reverse=True)[:len(commas)])
        bounds = [0.0]; cut = []
        for (rs, re_), ci in zip(best, commas): cut.append((ci + 1, rs, re_))
        prev_w, prev_t = 0, 0.0
        for nw, rs, re_ in cut:
            segs.append((prev_w, nw, prev_t, rs)); prev_w, prev_t = nw, re_
        segs.append((prev_w, len(ws), prev_t, d))
    else:
        segs.append((0, len(ws), 0.0, d))
    out = [0.0] * len(ws)
    for a_, b_, ts, te in segs:
        wt = np.array([weight(w) for w in ws[a_:b_]]); wt = wt / wt.sum()
        st = ts + np.concatenate([[0], np.cumsum(wt)[:-1]]) * (te - ts)
        for k, j in enumerate(range(a_, b_)): out[j] = float(st[k])
    return [round(t0 + x, 3) for x in out]

def build_karaoke(blocks, flags, lead=0.5, tail=0.9, sgap=0.38, bgap=0.75):
    audio = [sil(lead)]; t = lead
    out_blocks = []; word_times = []; widx = 0
    for bi, block in enumerate(blocks):
        ob = []
        for si, sent in enumerate(block):
            a = synth(sent); d = len(a) / SR
            ws = words_of(sent)
            starts = word_starts(ws, a, t)
            ob.append({"text": sent, "words": ws, "first": widx})
            for j in range(len(ws)): word_times.append(starts[j])
            widx += len(ws)
            audio.append(a); t += d
            gap = bgap if si == len(block) - 1 else sgap
            audio.append(sil(gap)); t += gap
        out_blocks.append(ob)
    audio.append(sil(tail)); t += tail
    # flags -> word ranges
    fl = []
    for phrase, title, body in flags:
        found = False
        for b in out_blocks:
            for s in b:
                pw = phrase.split(' ')
                for i in range(len(s["words"]) - len(pw) + 1):
                    norm = lambda L: [x.rstrip(',.;') for x in L]
                    if norm(s["words"][i:i + len(pw)]) == norm(pw):
                        fl.append({"a": s["first"] + i, "b": s["first"] + i + len(pw) - 1, "title": title, "body": body}); found = True; break
                if found: break
            if found: break
        assert found, phrase
    return np.concatenate(audio), t, {"blocks": out_blocks, "times": word_times, "flags": fl, "total": widx}

def build_lines(lines, lead=0.5, tail=1.0, gap=0.5):
    """lines: list of strings, or ('pause', seconds) tuples -> start times of each item"""
    audio = [sil(lead)]; t = lead; starts = []
    for ln in lines:
        if isinstance(ln, tuple):
            starts.append(round(t, 3)); audio.append(sil(ln[1])); t += ln[1]; continue
        a = synth(ln); starts.append(round(t, 3)); audio.append(a); t += len(a) / SR
        audio.append(sil(gap)); t += gap
    audio.append(sil(tail)); t += tail
    return np.concatenate(audio), t, starts


def sec_audio(n, audio, dur, **kw):
    sf.write(f'{WD}/audio/s{n:02d}.wav', audio, SR)
    return {"kind": kw.pop('kind'), "dur": round(dur, 3), **kw}

scenes = []
def add(kind, audio, dur, **kw):
    scenes.append(sec_audio(len(scenes), audio, dur, kind=kind, **kw))

B6, B8 = EP['band6'], EP['band8']; UP = EP['upgrades']; YT = EP['your_turn']; META = EP['meta']; noun = META['noun']
a, d, st = build_lines(EP['title_lines'], lead=0.8, tail=0.9); add("title", a, d, starts=st)
a, d, kd = build_karaoke(EP['task'], [], lead=0.6); add("task", a, d, kd=kd)
a, d, st = build_lines(["First, the Band 6 answer."], lead=0.5, tail=0.5); add("lead", a, d, band=6, starts=st)
a, d, kd = build_karaoke(B6['blocks'], B6['flags']); add("letter", a, d, band=6, kd=kd)
a, d, st = build_lines(B6['verdict_speech'], lead=0.6, tail=1.0); add("verdict", a, d, band=6, items=B6['verdict'], starts=st)
a, d, st = build_lines(["Now, the Band 8 answer."], lead=0.5, tail=0.5); add("lead", a, d, band=8, starts=st)
a, d, kd = build_karaoke(B8['blocks'], B8['flags']); add("letter", a, d, band=8, kd=kd)
a, d, st = build_lines(B8['verdict_speech'], lead=0.6, tail=1.0); add("verdict", a, d, band=8, items=B8['verdict'], starts=st)
a, d, st = build_lines(["Here are four upgrades you can steal."] + [u['speech'] for u in UP], lead=0.6, tail=1.0, gap=0.7)
add("compare", a, d, rows=[[u['label'], u['band6'], u['band8']] for u in UP], starts=st)
P = float(YT.get('pause', 10))
lines = ["Now, your turn.", f"Here is a Band 6 sentence. {YT['q']}", "Pause the video, and rewrite it at Band 8.", ("pause", P),
         "Here is one possible answer.", YT['ans'], "Share your own version in the comments."]
a, d, st = build_lines(lines, lead=0.6, tail=1.6, gap=0.6); add("turn", a, d, starts=st, pause=P, q=YT['q'], ans=YT['ans'])
a, d, st = build_lines(["Here is your cheat sheet.", "Screenshot it, save this video, and come back to practise."], lead=0.6, tail=7.0, gap=0.6)
add("cheat", a, d, starts=st, rows=[[u['label'], u['band6'], u['band8']] for u in UP], phrases=EP['phrase_bank'])
a, d, st = build_lines([f"Practise one upgrade in your next {noun}.", "And follow, for a new Band 6 versus Band 8 comparison, every day."], lead=0.6, tail=1.8)
add("outro", a, d, starts=st)

c = 0.0
for s in scenes: s["start"] = round(c, 3); c += s["dur"]
json.dump({"total": round(c, 3), "meta": META, "scenes": scenes}, open(f'{WD}/timeline.json', 'w'), indent=1)

# ---- subtitles (SRT): one cue per sentence for karaoke scenes, one per spoken line otherwise
def ts(x):
    h = int(x // 3600); m = int(x % 3600 // 60); s = x % 60
    return f"{h:02d}:{m:02d}:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}"
cues = []
def spoken(sc):
    k_ = sc['kind']
    if k_ in ('letter', 'task'):
        kd = sc['kd']; T_ = kd['times']
        for b in kd['blocks']:
            for s_ in b:
                i0 = s_['first']; i1 = i0 + len(s_['words'])
                end = T_[i1] if i1 < len(T_) else None
                yield T_[i0], end, s_['text']
    return
for sc in scenes:
    S = sc['start']
    if sc['kind'] in ('letter', 'task'):
        allc = list(spoken(sc))
        for j, (a_, e_, tx) in enumerate(allc):
            e_ = e_ if e_ is not None else sc['dur'] - 0.3
            cues.append((S + a_, S + min(e_, a_ + 0.5 + 0.45 * len(tx.split())), tx))
SCRIPT_LINES = {  # non-karaoke scenes: text spoken at each start index
    'title': EP['title_lines'], 'lead': None,
}
for sc in scenes:
    S = sc['start']; k_ = sc['kind']; st = sc['starts'] if 'starts' in sc else []
    txt = None
    if k_ == 'title': txt = EP['title_lines']
    elif k_ == 'lead': txt = [f"First, the Band 6 answer." if sc['band'] == 6 else "Now, the Band 8 answer."]
    elif k_ == 'verdict': txt = (B6 if sc['band'] == 6 else B8)['verdict_speech']
    elif k_ == 'compare': txt = ["Here are four upgrades you can steal."] + [u['speech'] for u in UP]
    elif k_ == 'turn': txt = ["Now, your turn.", f"Here is a Band 6 sentence. {YT['q']}", "Pause the video, and rewrite it at Band 8.", None, "Here is one possible answer.", YT['ans'], "Share your own version in the comments."]
    elif k_ == 'cheat': txt = ["Here is your cheat sheet.", "Screenshot it, save this video, and come back to practise."]
    elif k_ == 'outro': txt = [f"Practise one upgrade in your next {noun}.", "And follow, for a new Band 6 versus Band 8 comparison, every day."]
    if not txt: continue
    for j, tx in enumerate(txt):
        if tx is None: continue
        a_ = S + st[j]; nxt = S + st[j + 1] if j + 1 < len(st) else S + sc['dur'] - 0.2
        cues.append((a_, min(nxt - 0.1, a_ + 0.6 + 0.42 * len(tx.split())), tx))
cues.sort()
with open(f'{WD}/subtitles.srt', 'w', encoding='utf-8') as f:
    for n, (a_, e_, tx) in enumerate(cues, 1):
        f.write(f"{n}\n{ts(a_)} --> {ts(max(e_, a_ + 0.8))}\n{tx}\n\n")
print([(s['kind'], s['dur']) for s in scenes], 'total', round(c, 1), 'cues', len(cues))
