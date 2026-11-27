#!/usr/bin/env python3
"""mark_published.py <episode id> <video id>  -> records it in state/published.json"""
import json, os, sys, datetime
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); p = f'{root}/state/published.json'
d = json.load(open(p)) if os.path.exists(p) else {}
d[sys.argv[1]] = {'video_id': sys.argv[2], 'date': datetime.date.today().isoformat()}
json.dump(d, open(p, 'w'), indent=1)
