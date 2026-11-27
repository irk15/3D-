#!/usr/bin/env python3
"""upload_youtube.py <out/epNNN> [--privacy private|unlisted|public] [--publish-at ISO8601] [--dry-run]
Uploads video.mp4 + thumbnail + English captions with title/description/tags from youtube.json.
Env: YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN. Prints the video id; also writes it to $GITHUB_OUTPUT as video_id."""
import argparse, json, os, sys
ap = argparse.ArgumentParser(); ap.add_argument('dir'); ap.add_argument('--privacy'); ap.add_argument('--publish-at'); ap.add_argument('--dry-run', action='store_true'); a = ap.parse_args()
d = a.dir; meta = json.load(open(f'{d}/youtube.json'))
privacy = a.privacy or os.environ.get('YT_PRIVACY') or meta.get('privacyStatus', 'private')
body = {'snippet': {'title': meta['title'], 'description': meta['description'], 'tags': meta['tags'], 'categoryId': meta.get('categoryId', '27'), 'defaultLanguage': 'en', 'defaultAudioLanguage': 'en'},
        'status': {'privacyStatus': privacy, 'selfDeclaredMadeForKids': bool(meta.get('madeForKids', False)), 'embeddable': True, 'publicStatsViewable': True}}
if a.publish_at: body['status']['privacyStatus'] = 'private'; body['status']['publishAt'] = a.publish_at
# YouTube limits: title 100 chars, description 5000 bytes, tags ~500 chars total
assert len(body['snippet']['title']) <= 100, 'title too long'
assert len(body['snippet']['description'].encode()) <= 5000, 'description too long'
assert sum(len(t) + 1 for t in body['snippet']['tags']) <= 480, 'tags too long'
for f in ('video.mp4', 'thumbnail.jpg', 'captions_en.srt'): assert os.path.exists(f'{d}/{f}'), f'missing {f}'
print('Title      :', body['snippet']['title']); print('Privacy    :', body['status']['privacyStatus']); print('Video size :', round(os.path.getsize(f'{d}/video.mp4') / 1e6, 1), 'MB')
if a.dry_run: print('DRY RUN: nothing uploaded.'); sys.exit(0)

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError
creds = Credentials(None, refresh_token=os.environ['YT_REFRESH_TOKEN'], token_uri='https://oauth2.googleapis.com/token',
                    client_id=os.environ['YT_CLIENT_ID'], client_secret=os.environ['YT_CLIENT_SECRET'], scopes=['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.force-ssl'])
creds.refresh(Request())
yt = build('youtube', 'v3', credentials=creds, cache_discovery=False)
req = yt.videos().insert(part='snippet,status', body=body, media_body=MediaFileUpload(f'{d}/video.mp4', mimetype='video/mp4', chunksize=8 * 1024 * 1024, resumable=True), notifySubscribers=True)
resp = None
while resp is None:
    st, resp = req.next_chunk()
    if st: print(f'  uploaded {int(st.progress() * 100)}%', flush=True)
vid = resp['id']; print('VIDEO ID:', vid, f'https://youtu.be/{vid}')
if os.environ.get('GITHUB_OUTPUT'): open(os.environ['GITHUB_OUTPUT'], 'a').write(f'video_id={vid}\n')
# thumbnail (needs a phone-verified channel) and captions: failures here must not lose the upload
try: yt.thumbnails().set(videoId=vid, media_body=MediaFileUpload(f'{d}/thumbnail.jpg', mimetype='image/jpeg')).execute(); print('thumbnail set')
except HttpError as e: print('WARNING thumbnail failed:', e)
try:
    yt.captions().insert(part='snippet', body={'snippet': {'videoId': vid, 'language': 'en', 'name': 'English', 'isDraft': False}},
                         media_body=MediaFileUpload(f'{d}/captions_en.srt', mimetype='application/octet-stream')).execute(); print('captions uploaded')
except HttpError as e: print('WARNING captions failed:', e)
