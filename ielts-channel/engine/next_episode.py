#!/usr/bin/env python3
"""Prints the path of the next unpublished episode (lowest filename not in state/published.json); exits 3 if the queue is empty."""
import glob, json, os, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pub = json.load(open(f'{root}/state/published.json')) if os.path.exists(f'{root}/state/published.json') else {}
for p in sorted(glob.glob(f'{root}/episodes/*.json')):
    if json.load(open(p))['id'] not in pub: print(os.path.relpath(p, root)); sys.exit(0)
print('QUEUE EMPTY', file=sys.stderr); sys.exit(3)
