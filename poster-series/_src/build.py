#!/usr/bin/env python3
"""Assemble one poster page: head.html + kit.js + scenes/<folder>.js + tail.js -> ../<folder>/index.html
usage: python3 build.py <folder> "<Title>" <seed>      (run from poster-series/_src)"""
import sys,os,re,subprocess
folder,title,seed=sys.argv[1:4]
here=os.path.dirname(os.path.abspath(__file__)); rd=lambda p:open(os.path.join(here,p)).read()
head=rd('head.html').replace('@@TITLE@@',title+' — 3D Poster').replace('@@NAME@@',title).replace('@@SEED@@',seed)
html=head+rd('kit.js')+'\n'+rd('scenes/%s.js'%folder)+'\nkitFinish();\n'+rd('tail.js')
out=os.path.join(here,'..',folder); os.makedirs(out,exist_ok=True)
open(os.path.join(out,'index.html'),'w').write(html)
js=re.search(r'<script>\n(.*)</script>\n</body>',html,re.S).group(1)
open('/tmp/_chk.js','w').write(js.replace('"use strict";',''))
r=subprocess.run(['node','--check','/tmp/_chk.js'],capture_output=True,text=True)
print(folder,'syntax ok' if r.returncode==0 else r.stderr[:600])
