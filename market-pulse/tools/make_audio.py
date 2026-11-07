#!/usr/bin/env python3
"""Builds natural-sounding mp3s (Microsoft neural voices via edge-tts) for every text the app can read aloud.
Reads the same Google Sheet as the app, writes market-pulse/audio/*.mp3 and audio/manifest.json.
The text strings and the hash MUST match app.js (briefingItems, speakBtn texts, fnv)."""
import asyncio, csv, io, json, os, re, sys, urllib.parse, urllib.request
import edge_tts

SHEET_ID = '1cc_zmf_p3mglIllH_WwkfY4TxylMsrUbhyolLoiA19M'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'audio')
VOICES = {'en': 'en-IN-PrabhatNeural', 'hi': 'hi-IN-MadhurNeural'}
RATE = '-4%'
T = {
    'en': {'brand': 'Bharat Market Pulse', 'keyNumbers': 'Key numbers.', 'weekAhead': 'The week ahead.', 'percent': 'percent'},
    'hi': {'brand': 'भारत मार्केट पल्स', 'keyNumbers': 'मुख्य आँकड़े।', 'weekAhead': 'आने वाला हफ्ता।', 'percent': 'प्रतिशत'},
}

def fetch(tab):
    url = 'https://docs.google.com/spreadsheets/d/%s/gviz/tq?tqx=out:csv&headers=1&sheet=%s' % (SHEET_ID, urllib.parse.quote(tab))
    raw = urllib.request.urlopen(url, timeout=60).read().decode('utf-8')
    return [dict(r) for r in csv.DictReader(io.StringIO(raw))]

def norm(s): return ' '.join((s or '').split())

def fnv(s):
    s = norm(s); h = 0x811c9dc5
    b = s.encode('utf-16-le')
    for i in range(0, len(b), 2):
        h ^= b[i] | (b[i + 1] << 8); h = (h * 0x01000193) & 0xFFFFFFFF
    return '%x-%d' % (h, len(b) // 2)

def texts_for(lang, D):
    t = T[lang]
    def L(o, k): return (o.get(k + '_hi') if lang == 'hi' and o.get(k + '_hi') else '') or o.get(k + '_en') or o.get(k) or ''
    meta = {r['key']: r for r in D['Meta']}
    def M(k):
        r = meta.get(k)
        return '' if not r else ((r.get('value_hi') if lang == 'hi' and r.get('value_hi') else r.get('value_en')) or '')
    out = [t['brand'] + '.', M('today_in_one_line')]
    ps = [p for p in D['Pulse'] if p.get('key') in ('nifty', 'sensex', 'brent', 'usdinr')]
    if ps: out.append(t['keyNumbers'] + ' ' + ' '.join(L(p, 'label') + ': ' + (p.get('value') or '') + '.' for p in ps))
    for b in D['Brief']: out.append(L(b, 'headline') + '. ' + L(b, 'summary'))
    sc = []
    for o in D['Outlook']:
        try: p = max(0, int(float(o.get('probability_pct') or 0)))
        except ValueError: p = 0
        if p > 0: sc.append((p, o))
    for p, s in sc: out.append('%d %s. %s. %s' % (p, t['percent'], L(s, 'scenario'), L(s, 'what')))
    if sc: out.append(t['weekAhead'] + ' ' + ' '.join('%d %s: %s. %s' % (p, t['percent'], L(s, 'scenario'), L(s, 'what')) for p, s in sc) + ' ' + M('outlook_note'))
    for r in D['Impacts']: out.append(L(r, 'entity') + '. ' + L(r, 'driver'))
    d = M('disclaimer'); m = re.match(r'^.*?[.।](\s|$)', d)
    out.append((m.group(0).strip() if m else d))
    return [x for x in out if norm(x)]

async def synth(text, lang, path):
    await edge_tts.Communicate(norm(text), VOICES[lang], rate=RATE).save(path)

async def main():
    D = {tab: fetch(tab) for tab in ('Brief', 'Impacts', 'Outlook', 'Pulse', 'Meta')}
    updated = next((r.get('value_en') for r in D['Meta'] if r.get('key') == 'updated_at'), '')
    os.makedirs(OUT, exist_ok=True)
    old = {}
    try: old = json.load(open(os.path.join(OUT, 'manifest.json'))).get('items', {})
    except Exception: pass
    items = {}; todo = []
    for lang in ('en', 'hi'):
        for text in texts_for(lang, D):
            key = lang + '-' + fnv(text); fn = key + '.mp3'
            if key in items: continue
            items[key] = fn
            if not (key in old and os.path.exists(os.path.join(OUT, fn))): todo.append((text, lang, os.path.join(OUT, fn)))
    print('generating %d new clips, reusing %d' % (len(todo), len(items) - len(todo)))
    sem = asyncio.Semaphore(4)
    async def run(a):
        async with sem:
            for attempt in range(3):
                try: await synth(*a); return
                except Exception as e:
                    print('retry', e, file=sys.stderr); await asyncio.sleep(2)
            raise SystemExit('failed: ' + a[0][:40])
    await asyncio.gather(*(run(a) for a in todo))
    for f in os.listdir(OUT):
        if f.endswith('.mp3') and f not in items.values(): os.remove(os.path.join(OUT, f))
    json.dump({'updated_at': updated, 'voices': VOICES, 'items': items}, open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False, indent=0)

asyncio.run(main())
