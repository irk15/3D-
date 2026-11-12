// Prints every topic (id, French title, items) from ../index.html as JSON, in app order.
const fs=require('fs'),path=require('path');
const s=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const m=s.match(/const D=\{[\s\S]*?\n\};/);
const D=eval('('+m[0].slice(8,-1)+')');
const out=[];
for(const e of ['EE','EO'])for(const x of ['A','B'])for(const t of D[e][x])
  out.push({id:t.id,fr:t.fr,items:t.items.map(i=>({fr:i.fr,en:i.en,ex:i.ex}))});
process.stdout.write(JSON.stringify(out));
