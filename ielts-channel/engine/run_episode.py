#!/usr/bin/env python3
"""run_episode.py <episodes/epNNN-*.json> [--out out/epNNN] [--workers N] [--skip-render]
Full pipeline: narration -> timeline -> parallel frame render -> concat -> mix -> final mp4 + thumbnail + srt + chapters + youtube.json"""
import argparse, json, os, subprocess, sys, shutil, concurrent.futures as cf
HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser(); ap.add_argument('episode'); ap.add_argument('--out'); ap.add_argument('--workers', type=int, default=os.cpu_count() or 2)
ap.add_argument('--skip-render', action='store_true', help='reuse existing scene mp4s'); a = ap.parse_args()
EP = json.load(open(a.episode)); out = os.path.abspath(a.out or f"out/{EP['id']}"); os.makedirs(out, exist_ok=True)
def run(*c, **k): print('+', ' '.join(map(str, c))[:200], flush=True); subprocess.run(list(map(str, c)), check=True, **k)

if not a.skip_render:
    run(sys.executable, f'{HERE}/build_episode.py', a.episode, out)
TL = json.load(open(f'{out}/timeline.json')); sc = TL['scenes']; total = TL['total']
if not a.skip_render:
    # balance frames across workers (longest scene first)
    bins = [[0, []] for _ in range(a.workers)]
    for i in sorted(range(len(sc)), key=lambda i: -sc[i]['dur']):
        b = min(bins, key=lambda b: b[0]); b[0] += sc[i]['dur']; b[1].append(i)
    with cf.ThreadPoolExecutor(a.workers) as ex:
        fs = [ex.submit(run, 'node', f'{HERE}/render.js', out, ','.join(map(str, b[1]))) for b in bins if b[1]]
        for f in fs: f.result()
# join scenes
with open(f'{out}/list.txt', 'w') as f:
    for i in range(len(sc)): f.write(f"file 'scenes/s{i}.mp4'\n")
run('ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', f'{out}/list.txt', '-c', 'copy', f'{out}/video_only.mp4')
run(sys.executable, f'{HERE}/mix.py', out)
run('ffmpeg', '-v', 'error', '-y', '-i', f'{out}/video_only.mp4', '-i', f'{out}/audio/mix.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', f'{out}/video.mp4')

# thumbnail
t = open(f'{HERE}/thumb_template.html', encoding='utf-8').read()
th = EP['thumb']; t = t.replace('{{KICKER}}', th['kicker']).replace('{{LEFT}}', th['left']).replace('{{RIGHT}}', th['right'])
open(f'{HERE}/_thumb_tmp.html', 'w', encoding='utf-8').write(t)
shot = r"""const p=require('puppeteer-core'),fs=require('fs');(async()=>{const c=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].find(x=>fs.existsSync(x));
const b=await p.launch({executablePath:process.env.CHROME_PATH||c,args:['--no-sandbox','--disable-gpu'],headless:'new'});const pg=await b.newPage();await pg.setViewport({width:1280,height:720});
await pg.goto('file://'+process.argv[2]);await pg.evaluate(()=>document.fonts.ready);await pg.screenshot({path:process.argv[3],type:'jpeg',quality:92});await b.close()})()"""
open(f'{HERE}/_shot.js', 'w').write(shot)
run('node', f'{HERE}/_shot.js', f'{HERE}/_thumb_tmp.html', f'{out}/thumbnail.jpg')
os.remove(f'{HERE}/_thumb_tmp.html'); os.remove(f'{HERE}/_shot.js')

# chapters + youtube.json
def mmss(x): return f"{int(x // 60)}:{int(x % 60):02d}"
noun = EP['meta']['noun']
S = lambda i: sc[i]['start']
chap = [(0, 'Intro'), (S(1), 'The task'), (S(2), f'Band 6 {noun}'), (S(5), f'Band 8 {noun}'), (S(8), f'4 upgrades to steal'), (S(9), 'Your turn: rewrite a sentence'), (S(10), 'Cheat sheet')]
chapters = '\n'.join(f'{mmss(s)} {n}' for s, n in chap)
open(f'{out}/chapters.txt', 'w').write(chapters + '\n')
yt = EP['youtube']; task_no = '1' if EP['task_type'] == 'letter' else '2'
base_tags = ['IELTS', 'IELTS writing', 'IELTS general training', f'IELTS task {task_no}', 'band 6 vs band 8', 'IELTS band 8', 'IELTS writing tips', 'IELTS preparation', 'CLB 9']
what = 'letter' if noun == 'letter' else 'essay'
desc = (f"Same task. Same topic. Very different scores. Hear an IELTS General Training Task {task_no} {what} ({yt['topic'].lower()}) written at Band 6 and at Band 8, and see exactly what changes.\n\n"
        "You will get:\n• The full task and both sample answers, read aloud with highlighted words\n• What an examiner notices in each answer\n• 4 upgrades you can copy into your own writing\n• A \"Your turn\" challenge, plus a cheat sheet you can screenshot\n\n"
        f"CHAPTERS\n{chapters}\n\nSample answers are written for study purposes and are not official IELTS scores.\n\n#IELTS #IELTSWriting #IELTSTask{task_no} #Band8")
title = yt.get('title') or f"IELTS Task {task_no} {what.title()}: Band 6 vs Band 8 ({yt['topic']}) | General Training Writing"
json.dump({'title': title[:100], 'description': desc, 'tags': base_tags + yt.get('tags', []), 'categoryId': '27', 'madeForKids': False, 'privacyStatus': 'private'}, open(f'{out}/youtube.json', 'w'), indent=1, ensure_ascii=False)
shutil.copy(f'{out}/subtitles.srt', f'{out}/captions_en.srt') if os.path.exists(f'{out}/subtitles.srt') else None
print('DONE', out, 'duration', round(total, 1))
