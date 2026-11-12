#!/usr/bin/env python3
"""Pre-records the TEF Écrire & Parler cards with natural female neural voices (Microsoft Edge voices via edge-tts, free).
For every topic it writes ONE gapless-friendly mp3 episode:  word (FR) · pause · meaning (EN) · pause · example (FR) · pause
and audio/cues.json with the start/end second of every part, so the app can play single cards or run hands-free.
Run by .github/workflows/tef-learn-audio.yml. Set TEF_FAKE=1 to build with beeps (pipeline test only)."""
import asyncio, hashlib, html, json, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'audio')
CACHE = os.environ.get('TEF_CACHE') or os.path.join(tempfile.gettempdir(), 'tef-clips')
FAKE = os.environ.get('TEF_FAKE') == '1'
SR = 24000
FR_PREF = ['fr-FR-VivienneMultilingualNeural', 'fr-FR-DeniseNeural', 'fr-CA-SylvieNeural']
EN_PREF = ['en-US-AvaMultilingualNeural', 'en-US-JennyNeural', 'en-US-AriaNeural']
RATE = {'fr': '-8%', 'en': '-2%'}
GAP = {'fr': 0.9, 'en': 1.1, 'ex': 1.9}   # silence after each part, seconds

def clean(t, lang):
    t = html.unescape(re.sub(r'<[^>]+>', '', t))
    t = re.sub(r'\s*\((?:nm|nf|nmpl|nfpl|nm/nf|nf/nm|v|adj|loc|pl)\)', '', t)
    t = t.replace('qqch', 'quelque chose').replace('qqn', "quelqu'un")
    t = re.sub(r'\bvs\b', 'versus' if lang == 'en' else 'contre', t)
    t = t.replace(' + ', ' plus ' if lang == 'en' else ' plus ')
    t = re.sub(r'\s*/\s*', ', or ' if lang == 'en' else ', ', t)
    t = t.replace('…', '...').replace('  ', ' ')
    return t.strip()

def load():
    raw = subprocess.check_output(['node', os.path.join(HERE, 'extract.js')])
    return json.loads(raw)

async def pick_voices():
    if FAKE: return 'fake', 'fake'
    import edge_tts
    have = {v['ShortName'] for v in await edge_tts.list_voices()}
    pick = lambda pref: next(v for v in pref if v in have)
    return pick(FR_PREF), pick(EN_PREF)

async def tts(text, voice, rate, path):
    if FAKE:
        d = max(0.5, len(text) * 0.06)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'sine=f=440:d={d}', '-ar', str(SR), '-ac', '1', path], check=True)
        return
    import edge_tts
    for n in range(5):
        try:
            await edge_tts.Communicate(text, voice, rate=rate).save(path)
            if os.path.getsize(path) > 500: return
        except Exception as e:
            print('retry', n, e, file=sys.stderr)
        await asyncio.sleep(1.5 * (n + 1))
    raise RuntimeError('tts failed: ' + text)

def pcm(path):
    return subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ar', str(SR), '-ac', '1', '-'], check=True, capture_output=True).stdout

def silence(sec): return b'\x00\x00' * int(SR * sec)

async def main():
    os.makedirs(CACHE, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    topics = load()
    fr_v, en_v = await pick_voices()
    jobs = {}
    for t in topics:
        for i in t['items']:
            for kind, src, lang, voice in (('fr', 'fr', 'fr', fr_v), ('en', 'en', 'en', en_v), ('ex', 'ex', 'fr', fr_v)):
                txt = clean(i[src], lang)
                h = hashlib.sha1(f'{voice}|{RATE[lang]}|{txt}'.encode()).hexdigest()[:16]
                i[kind + '_h'] = h
                jobs[h] = (txt, voice, RATE[lang])
    version = hashlib.sha1(json.dumps([sorted(jobs), GAP, SR], sort_keys=True).encode()).hexdigest()[:12]
    cpath = os.path.join(OUT, 'cues.json')
    if os.path.exists(cpath):
        try:
            old = json.load(open(cpath))
            if old.get('v') == version and all(os.path.exists(os.path.join(OUT, x['f'])) for x in old['topics'].values()):
                print('audio up to date'); return
        except Exception: pass
    todo = [(h, v) for h, v in jobs.items() if not os.path.exists(os.path.join(CACHE, h + '.mp3'))]
    print(f'{len(jobs)} clips, {len(todo)} to record, voices: {fr_v} / {en_v}')
    sem = asyncio.Semaphore(8); done = 0
    async def run(h, v):
        nonlocal done
        async with sem:
            await tts(v[0], v[1], v[2], os.path.join(CACHE, h + '.mp3'))
        done += 1
        if done % 100 == 0: print(done, '/', len(todo), flush=True)
    await asyncio.gather(*(run(h, jobs[h]) for h, _ in todo))
    cues = {'v': version, 'voices': [fr_v, en_v], 'topics': {}}
    for t in topics:
        buf = bytearray(); rows = []; pos = 0.0
        def put(h, gap):
            nonlocal pos
            d = pcm(os.path.join(CACHE, h + '.mp3'))
            s = pos; buf.extend(d); pos += len(d) / 2 / SR
            e = pos; buf.extend(silence(gap)); pos += gap
            return round(s, 2), round(e, 2)
        for oi, i in enumerate(t['items']):
            a = put(i['fr_h'], GAP['fr']); b = put(i['en_h'], GAP['en']); c = put(i['ex_h'], GAP['ex'])
            rows.append([oi, a[0], a[1], b[0], b[1], c[0], c[1]])
        f = t['id'] + '.mp3'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '48k', os.path.join(OUT, f)], input=bytes(buf), check=True)
        cues['topics'][t['id']] = {'f': f, 'd': round(pos, 1), 'c': rows}
        print(t['id'], round(pos / 60, 1), 'min')
    json.dump(cues, open(cpath, 'w'), separators=(',', ':'))

asyncio.run(main())
