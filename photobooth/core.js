
(()=>{
const $=s=>document.querySelector(s);
const T=window.PB_THEME,K=s=>"pb-"+T.id+"-"+s,EMOJI=T.emoji;
const SIZE=800;           // saved photo resolution
const gh=JSON.parse(localStorage.getItem("gb-gh")||"{}");
// magic link: ...guestbook/#r=owner/repo&t=TOKEN  -> stored on this device, then removed from the address bar
try{const h=new URLSearchParams(location.hash.slice(1));
  if(h.get("r")&&h.get("t")){gh.repo=h.get("r");gh.token=h.get("t");localStorage.setItem("gb-gh",JSON.stringify(gh));history.replaceState(null,"",location.pathname+location.search)}}catch(e){}
let syncing=false,syncErr="";
const b64u=t=>btoa(unescape(encodeURIComponent(t)));
async function ghPut(path,content,msg){
  const r=await fetch(`https://api.github.com/repos/${gh.repo}/contents/${path}`,{method:"PUT",
    headers:{Authorization:"Bearer "+gh.token,Accept:"application/vnd.github+json","Content-Type":"application/json"},
    body:JSON.stringify({message:msg,content})});
  if(r.ok||r.status===422)return true; // 422 = already exists
  const j=await r.json().catch(()=>({}));throw new Error(r.status===401||r.status===403||r.status===404?"check token/repo ("+r.status+")":(j.message||r.status));
}
function cloudStatus(){
  const el=$("#cloud");if(!el)return;
  if(!gh.repo||!gh.token){el.className="cloud";el.textContent="";return}
  const n=photos.filter(p=>!p.synced).length;
  if(syncErr){el.className="cloud err";el.textContent="☁ "+syncErr+(n?` · ${n} pending`:"")}
  else if(n){el.className="cloud";el.textContent=`☁ Uploading ${n}…`}
  else{el.className="cloud ok";el.textContent="☁ All photos backed up"}
}
async function syncAll(){
  if(syncing||!gh.repo||!gh.token){cloudStatus();return}
  syncing=true;syncErr="";cloudStatus();
  try{
    for(const p of photos.filter(x=>!x.synced)){
      const d=new Date(p.t).toISOString().slice(0,10),base=`photos/${T.id}/${d}/${p.id}`;
      await ghPut(base+".jpg",p.img.split(",")[1],`photo from ${p.name}`);
      await ghPut(base+".json",b64u(JSON.stringify({id:p.id,name:p.name,message:p.msg,time:new Date(p.t).toISOString(),event:settings.title},null,2)),`note from ${p.name}`);
      p.synced=true;await dbPut(p);cloudStatus();
    }
  }catch(e){syncErr=navigator.onLine?e.message:"offline"}
  syncing=false;cloudStatus();
}
addEventListener("online",syncAll);setInterval(syncAll,60000);
let facing="user",stream=null,photos=[],pendingImg=null,openId=null,z=1;
const settings=JSON.parse(localStorage.getItem(K("settings"))||JSON.stringify({title:T.title,date:T.date||""}));

/* ---------- IndexedDB ---------- */
const dbp=new Promise((res,rej)=>{const r=indexedDB.open("pb-"+T.id,1);r.onupgradeneeded=()=>r.result.createObjectStore("p",{keyPath:"id"});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const tx=async(m,f)=>{const d=await dbp;return new Promise((res,rej)=>{const t=d.transaction("p",m),s=t.objectStore("p"),q=f(s);t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error)})};
const dbAll=()=>tx("readonly",s=>s.getAll());
const dbPut=o=>tx("readwrite",s=>s.put(o));
const dbDel=id=>tx("readwrite",s=>s.delete(id));

/* ---------- helpers ---------- */
const esc=s=>s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove("on"),1800)};
const capHTML=p=>`<b>${esc(p.name||"Guest")}</b>${p.msg?`<span>${esc(p.msg)}</span>`:""}`;
function polEl(p,w){
  const d=document.createElement("div");d.className="pol";d.dataset.id=p.id;
  if(w)d.style.setProperty("--w",w+"px");
  d.innerHTML=`<img src="${p.img}" alt=""><div class="cap">${capHTML(p)}</div>`;
  return d;
}
function renderHeader(){
  $("#evTitle").textContent=settings.title;$("#evDate").textContent=settings.date||T.tagline;
  $("#nPhotos").textContent=photos.length;
  $("#nGuests").textContent=new Set(photos.map(p=>(p.name||"").trim().toLowerCase())).size;
  $("#empty").style.display=photos.length?"none":"block";
}

/* ---------- camera ---------- */
async function startCam(){
  stopCam();
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing,width:{ideal:1280},height:{ideal:1280}},audio:false});
    const v=$("#vid");v.srcObject=stream;v.classList.toggle("mirror",facing==="user");v.style.display="block";$("#fb").style.display="none";
    await v.play().catch(()=>{});
  }catch(e){
    $("#vid").style.display="none";$("#fb").style.display="flex";
    $("#fbMsg").textContent="Camera blocked — tap to pick a photo";
  }
}
function stopCam(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}}
function grab(){
  const v=$("#vid");
  if(!stream||!v.videoWidth)return null;
  const s=Math.min(v.videoWidth,v.videoHeight),c=document.createElement("canvas");c.width=c.height=SIZE;
  const x=c.getContext("2d");
  if(facing==="user"){x.translate(SIZE,0);x.scale(-1,1)}
  x.drawImage(v,(v.videoWidth-s)/2,(v.videoHeight-s)/2,s,s,0,0,SIZE,SIZE);
  applyFx(c);return c.toDataURL("image/jpeg",.85);
}
function fromFile(f){
  return new Promise(res=>{
    const img=new Image(),u=URL.createObjectURL(f);
    img.onload=()=>{const s=Math.min(img.width,img.height),c=document.createElement("canvas");c.width=c.height=SIZE;
      c.getContext("2d").drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,SIZE,SIZE);URL.revokeObjectURL(u);applyFx(c);res(c.toDataURL("image/jpeg",.85))};
    img.src=u;
  });
}
async function shoot(){
  let data=null;
  if(stream){data=grab();$("#flash").classList.remove("go");void $("#flash").offsetWidth;$("#flash").classList.add("go");
    try{navigator.vibrate&&navigator.vibrate(20)}catch(e){}
    await new Promise(r=>setTimeout(r,180));}
  else{$("#file").click();return}
  if(!data)return;
  openNote(data);
}
$("#file").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(f)openNote(await fromFile(f))};
$("#shutter").onclick=shoot;$("#snapBtn").onclick=shoot;
$("#flip").onclick=()=>{facing=facing==="user"?"environment":"user";startCam()};

/* ---------- note sheet ---------- */
function openNote(img){
  pendingImg=img;
  $("#noteThumb").innerHTML="";
  $("#noteThumb").appendChild(polEl({id:"tmp",img,name:"",msg:""},110));
  $("#nm").value=localStorage.getItem(K("lastname"))||"";$("#msg").value="";$("#cc").textContent=0;
  $("#noteOv").classList.add("on");
}
$("#emo").innerHTML=EMOJI.map(e=>`<button type="button">${e}</button>`).join("");
$("#emo").onclick=e=>{if(e.target.tagName!=="BUTTON")return;const m=$("#msg");if(m.value.length<138)m.value+=e.target.textContent;$("#cc").textContent=m.value.length;m.focus()};
$("#msg").oninput=e=>$("#cc").textContent=e.target.value.length;
$("#retake").onclick=()=>{$("#noteOv").classList.remove("on");pendingImg=null};
$("#post").onclick=async()=>{
  const name=$("#nm").value.trim()||"Guest",msg=$("#msg").value.trim();
  localStorage.setItem(K("lastname"),name);
  const p={id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),img:pendingImg,name,msg,t:Date.now(),synced:false,
    x:.12+Math.random()*.76,y:.56+Math.random()*.28,r:(Math.random()*20-10)};
  $("#noteOv").classList.remove("on");pendingImg=null;
  photos.push(p);await dbPut(p);renderHeader();printOut(p);renderGrid();syncAll();burst();
};

/* ---------- board ---------- */
function polW(){return Math.max(110,Math.min(230,$("#board").clientWidth/4.3))}
function place(el,p){
  const b=$("#board"),w=polW(),h=w*1.24;
  const x=Math.min(Math.max(p.x*b.clientWidth-w/2,4),b.clientWidth-w-4);
  const bt=$("#booth").offsetTop+$("#booth").offsetHeight+26,ymax=b.clientHeight-h-112;
  const y=Math.min(Math.max(p.y*b.clientHeight-h/2,Math.min(bt,ymax),4),ymax);
  el.style.left=x+"px";el.style.top=y+"px";el.style.transform=`rotate(${p.r}deg)`;
}
function addToBoard(p,animate){
  const el=polEl(p,polW());el.style.zIndex=z++;place(el,p);
  $("#board").appendChild(el);bindDrag(el,p);return el;
}
function printOut(p){
  // animate: polaroid emerges from slot then settles to its spot
  const booth=$("#booth").getBoundingClientRect(),b=$("#board").getBoundingClientRect(),w=polW();
  const el=addToBoard(p);
  const tx=(booth.left+booth.width/2-w/2)-b.left,ty=booth.bottom-b.top-w*1.26+6;
  const fx=parseFloat(el.style.left),fy=parseFloat(el.style.top);
  el.style.zIndex=4;el.style.transition="none";
  el.style.left=tx+"px";el.style.top=(ty-w*1.2)+"px";el.style.transform="rotate(0)";el.style.clipPath="inset(0 0 0 0)";
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    el.style.transition="top 1.1s cubic-bezier(.3,.7,.3,1)";el.style.top=ty+"px";
    setTimeout(()=>{el.style.transition="left .8s cubic-bezier(.2,.8,.2,1),top .8s cubic-bezier(.2,.8,.2,1),transform .8s";
      el.style.zIndex=z++;el.style.left=fx+"px";el.style.top=fy+"px";el.style.transform=`rotate(${p.r}deg)`;
      setTimeout(()=>el.style.transition="",900)},1300);
  }));
}
function renderBoard(){
  document.querySelectorAll("#board .pol").forEach(e=>e.remove());
  photos.slice().sort((a,b)=>a.t-b.t).forEach(p=>addToBoard(p));
}
function bindDrag(el,p){
  const pts=new Map();let base=null,moved=false;
  const ang=()=>{const [a,b]=[...pts.values()];return Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI};
  const mid=()=>{const [a,b]=[...pts.values()];return{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};
  const rebase=()=>{ // restart gesture baseline from the current fingers
    base={x:el.offsetLeft,y:el.offsetTop,r:p.r};
    if(pts.size===1){const q=[...pts.values()][0];base.sx=q.x;base.sy=q.y}
    else if(pts.size>=2){base.a=ang();const m=mid();base.sx=m.x;base.sy=m.y}
  };
  el.addEventListener("pointerdown",e=>{
    el.setPointerCapture(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pts.size===1){moved=false;el.style.zIndex=z++;el.classList.add("drag");el.style.transition=""}
    else moved=true;
    rebase();
  });
  el.addEventListener("pointermove",e=>{
    if(!pts.has(e.pointerId))return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pts.size>=2){
      const m=mid();p.r=base.r+(ang()-base.a);
      el.style.left=base.x+(m.x-base.sx)+"px";el.style.top=base.y+(m.y-base.sy)+"px";el.style.transform=`rotate(${p.r}deg)`;
    }else{
      const q=pts.get(e.pointerId),dx=q.x-base.sx,dy=q.y-base.sy;
      if(Math.abs(dx)+Math.abs(dy)>6)moved=true;
      if(moved){el.style.left=base.x+dx+"px";el.style.top=base.y+dy+"px"}
    }
  });
  const end=e=>{
    if(!pts.has(e.pointerId))return;pts.delete(e.pointerId);
    if(pts.size>0){rebase();return}
    el.classList.remove("drag");
    if(!moved){openBig(p.id)}else{const b=$("#board"),w=el.offsetWidth,h=el.offsetHeight;
      p.x=(el.offsetLeft+w/2)/b.clientWidth;p.y=(el.offsetTop+h/2)/b.clientHeight;dbPut(p)}
  };
  el.addEventListener("pointerup",end);
  el.addEventListener("pointercancel",e=>{pts.delete(e.pointerId);if(!pts.size)el.classList.remove("drag")});
  // mouse/trackpad: scroll over a polaroid to spin it
  el.addEventListener("wheel",e=>{e.preventDefault();p.r+=e.deltaY*.25;el.style.transform=`rotate(${p.r}deg)`;clearTimeout(el._wt);el._wt=setTimeout(()=>dbPut(p),400)},{passive:false});
}

/* ---------- enlarged ---------- */
function openBig(id){
  const p=photos.find(x=>x.id===id);if(!p)return;openId=id;
  const h=$("#bigHold");h.innerHTML="";h.appendChild(polEl(p));$("#big").classList.add("on");
}
$("#closeBig").onclick=()=>$("#big").classList.remove("on");
$("#big").onclick=e=>{if(e.target.id==="big")$("#big").classList.remove("on")};
$("#del").onclick=async()=>{
  if(!confirm("Delete this photo from the guest book?"))return;
  await dbDel(openId);photos=photos.filter(p=>p.id!==openId);
  document.querySelector(`#board .pol[data-id="${openId}"]`)?.remove();
  $("#big").classList.remove("on");renderHeader();renderGrid();toast("Deleted");
};
$("#saveCard").onclick=()=>{const p=photos.find(x=>x.id===openId);if(p)saveCard(p)};

/* ---------- photo card (canvas PNG) ---------- */
function wrap(x,t,maxW){const words=t.split(/\s+/),lines=[];let cur="";
  for(const w of words){const test=cur?cur+" "+w:w;if(x.measureText(test).width>maxW&&cur){lines.push(cur);cur=w}else cur=test}
  if(cur)lines.push(cur);return lines}
function cardCanvas(p){
  return new Promise(res=>{
    const img=new Image();img.onload=async()=>{
      try{await document.fonts.load("40px "+T.card.fontLoad)}catch(e){}
      const W=1000,pad=14,ph=W-pad*2,capH=215,H=pad+ph+capH;
      const c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d");
      x.fillStyle=T.card.paper;x.fillRect(0,0,W,H);
      x.drawImage(img,pad,pad,ph,ph);
      x.fillStyle=T.card.ink;x.textBaseline="top";
      const fam=T.card.font;
      x.font=`bold 54px ${fam}`;
      const n=p.name;let lines=[];
      x.font=`48px ${fam}`;
      const full=n+(p.msg?" — "+p.msg:"");
      lines=wrap(x,full,ph);
      let fs=48;while(lines.length>3&&fs>32){fs-=4;x.font=`${fs}px ${fam}`;lines=wrap(x,full,ph)}
      lines.slice(0,5).forEach((l,i)=>x.fillText(l,pad,pad+ph+20+i*(fs*1.2)));
      x.font=`30px ${fam}`;x.fillStyle=T.card.sub;x.textAlign="right";
      x.fillText(settings.title,W-pad-4,H-40);
      if(T.card.deco)T.card.deco(x,W,H,pad,ph);
      res(c)};img.src=p.img;
  });
}
async function saveCard(p){
  const c=await cardCanvas(p);
  c.toBlob(async b=>{
    const file=new File([b],`guestbook-${p.name.replace(/\W+/g,"_")}.png`,{type:"image/png"});
    if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file]});return}catch(e){if(e.name==="AbortError")return}}
    const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=file.name;document.body.appendChild(a);a.click();a.remove();toast("Photo card saved");
  },"image/png");
}

/* ---------- album ---------- */
function renderGrid(){
  const g=$("#grid");g.innerHTML="";
  photos.slice().sort((a,b)=>b.t-a.t).forEach(p=>{
    const t=document.createElement("div");t.className="tile";
    t.innerHTML=`<img src="${p.img}" alt=""><div class="who">${esc(p.name)}</div>`;
    t.onclick=()=>openBig(p.id);g.appendChild(t);
  });
}
$("#dlAll").onclick=async()=>{
  if(!photos.length)return toast("No photos yet");
  toast("Preparing cards…");
  for(const p of photos){const c=await cardCanvas(p);const b=await new Promise(r=>c.toBlob(r,"image/png"));
    const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`guestbook-${p.name.replace(/\W+/g,"_")}-${p.id}.png`;document.body.appendChild(a);a.click();a.remove();await new Promise(r=>setTimeout(r,250))}
};

/* ---------- tabs & settings ---------- */
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".tabs button").forEach(x=>x.classList.toggle("on",x===b));
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("on",v.id==="v-"+b.dataset.t));
  if(b.dataset.t==="book"){startCam();setTimeout(renderBoard,0)}else stopCam();
});
$("#cloud").onclick=()=>$("#evTitle").click();
$("#evTitle").onclick=()=>{$("#sTitle").value=settings.title;$("#sDate").value=settings.date;$("#sRepo").value=gh.repo||"";$("#sTok").value="";$("#sTok").placeholder=gh.token?"Token saved on this device (leave blank to keep)":"GitHub token (stays on this device)";$("#setOv").classList.add("on")};
$("#copyLink").onclick=async()=>{
  if(!gh.repo||!gh.token)return toast("Save repo + token first");
  const u=location.origin+location.pathname+"#r="+encodeURIComponent(gh.repo).replace("%2F","/")+"&t="+encodeURIComponent(gh.token);
  try{await navigator.clipboard.writeText(u);toast("Guest link copied")}catch(e){prompt("Copy this link",u)}
};
$("#sCancel").onclick=()=>$("#setOv").classList.remove("on");
$("#sSave").onclick=()=>{settings.title=$("#sTitle").value.trim()||settings.title;settings.date=$("#sDate").value.trim();
  localStorage.setItem(K("settings"),JSON.stringify(settings));gh.repo=$("#sRepo").value.trim().replace(/^https?:\/\/github.com\//,"").replace(/\/$/,"");if($("#sTok").value.trim())gh.token=$("#sTok").value.trim();localStorage.setItem("gb-gh",JSON.stringify(gh));renderHeader();syncAll();$("#setOv").classList.remove("on")};
$("#fb").onclick=()=>$("#file").click();
addEventListener("resize",()=>{if($("#v-book").classList.contains("on"))renderBoard()});
document.addEventListener("visibilitychange",()=>{if(document.hidden)stopCam();else if($("#v-book").classList.contains("on"))startCam()});

/* ---------- filters ---------- */
const FILTERS=T.filters;let curF=localStorage.getItem(K("filter"))||FILTERS[0].id;
const curFilter=()=>FILTERS.find(f=>f.id===curF)||FILTERS[0];
const cssOf=f=>`brightness(${f.b??1}) contrast(${f.c??1}) saturate(${f.s??1}) sepia(${f.sep||0}) grayscale(${f.gray||0}) hue-rotate(${f.hue||0}deg)`;
function applyPreview(){
  const f=curFilter(),t=f.tint;
  $("#vid").style.filter=cssOf(f);
  $("#tintov").style.background=t?`rgba(${t[0]},${t[1]},${t[2]},${t[3]})`:"transparent";
  $("#tintov").style.mixBlendMode=f.blend||"normal";
  $("#vigov").style.opacity=f.vig||0;
  document.querySelectorAll("#filters button").forEach(b=>b.classList.toggle("on",b.dataset.f===curF));
}
(function buildChips(){
  const w=$("#filters");
  FILTERS.forEach(f=>{const b=document.createElement("button");b.dataset.f=f.id;b.innerHTML=(f.icon?`<i>${f.icon}</i>`:"")+f.name;
    b.onclick=()=>{curF=f.id;localStorage.setItem(K("filter"),f.id);applyPreview();b.scrollIntoView({inline:"center",block:"nearest",behavior:"smooth"})};w.appendChild(b)});
  applyPreview();
})();
const clamp=v=>v<0?0:v>255?255:v;
function applyFx(c){
  const f=curFilter(),x=c.getContext("2d"),S=c.width,id=x.getImageData(0,0,S,S),d=id.data;
  const b=f.b??1,ct=f.c??1,sa=f.s??1,sep=f.sep||0,gr=f.gray||0,hue=(f.hue||0)*Math.PI/180,t=f.tint,al=t?t[3]:0,bl=f.blend||"normal",vig=f.vig||0,gn=f.grain||0;
  if(b===1&&ct===1&&sa===1&&!sep&&!gr&&!hue&&!al&&!vig&&!gn)return;
  const cs=Math.cos(hue),sn=Math.sin(hue);
  const H=[.213+cs*.787-sn*.213,.715-cs*.715-sn*.715,.072-cs*.072+sn*.928,.213-cs*.213+sn*.143,.715+cs*.285+sn*.14,.072-cs*.072-sn*.283,.213-cs*.213-sn*.787,.715-cs*.715+sn*.715,.072+cs*.928+sn*.072];
  const Sa=[.213+.787*sa,.715-.715*sa,.072-.072*sa,.213-.213*sa,.715+.285*sa,.072-.072*sa,.213-.213*sa,.715-.715*sa,.072+.928*sa];
  const q=1-sep,Se=[.393+.607*q,.769-.769*q,.189-.189*q,.349-.349*q,.686+.314*q,.168-.168*q,.272-.272*q,.534-.534*q,.131+.869*q];
  const g=1-gr,Gr=[.2126+.7874*g,.7152-.7152*g,.0722-.0722*g,.2126-.2126*g,.7152+.2848*g,.0722-.0722*g,.2126-.2126*g,.7152-.7152*g,.0722+.9278*g];
  const mul=(m,r,g2,b2)=>[clamp(m[0]*r+m[1]*g2+m[2]*b2),clamp(m[3]*r+m[4]*g2+m[5]*b2),clamp(m[6]*r+m[7]*g2+m[8]*b2)];
  const cx=S/2,maxd=Math.SQRT2*S/2;
  for(let i=0,p=0;i<d.length;i+=4,p++){
    let r=clamp(d[i]*b),g2=clamp(d[i+1]*b),b2=clamp(d[i+2]*b);
    r=clamp((r-127.5)*ct+127.5);g2=clamp((g2-127.5)*ct+127.5);b2=clamp((b2-127.5)*ct+127.5);
    if(sa!==1)[r,g2,b2]=mul(Sa,r,g2,b2);
    if(sep)[r,g2,b2]=mul(Se,r,g2,b2);
    if(gr)[r,g2,b2]=mul(Gr,r,g2,b2);
    if(hue)[r,g2,b2]=mul(H,r,g2,b2);
    if(al){
      let tr=t[0],tg=t[1],tb=t[2];
      if(bl==="screen"){tr=255-(255-r)*(255-tr)/255;tg=255-(255-g2)*(255-tg)/255;tb=255-(255-b2)*(255-tb)/255}
      else if(bl==="multiply"){tr=r*tr/255;tg=g2*tg/255;tb=b2*tb/255}
      r=r*(1-al)+tr*al;g2=g2*(1-al)+tg*al;b2=b2*(1-al)+tb*al;
    }
    if(vig){const px=p%S,py=(p/S)|0,dd=Math.hypot(px-cx,py-cx)/maxd,k=dd>.52?Math.pow((dd-.52)/.48,1.4)*.9*vig:0;r*=1-k;g2*=1-k;b2*=1-k}
    if(gn){const n=(Math.random()-.5)*gn*255;r+=n;g2+=n;b2+=n}
    d[i]=clamp(r);d[i+1]=clamp(g2);d[i+2]=clamp(b2);
  }
  x.putImageData(id,0,0);
}

/* ---------- confetti ---------- */
let parts=[],fxRaf=0;
function burst(){
  const cv=$("#fx"),x=cv.getContext("2d"),dpr=Math.min(2,devicePixelRatio||1);
  cv.width=innerWidth*dpr;cv.height=innerHeight*dpr;
  const bo=$("#booth").getBoundingClientRect(),C=T.confetti,ox=bo.left+bo.width/2,oy=bo.bottom;
  for(let i=0;i<C.count;i++){
    const a=-Math.PI/2+(Math.random()-.5)*Math.PI*1.25,sp=6+Math.random()*13;
    parts.push({x:ox,y:oy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:Math.random()*6.28,vr:(Math.random()-.5)*.35,s:6+Math.random()*9,
      c:C.colors[(Math.random()*C.colors.length)|0],sh:C.shapes[(Math.random()*C.shapes.length)|0],life:1,sw:Math.random()*6});
  }
  if(!fxRaf)fxRaf=requestAnimationFrame(function loop(){
    x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,cv.width,cv.height);x.scale(dpr,dpr);
    parts=parts.filter(p=>p.life>0&&p.y<innerHeight+30);
    for(const p of parts){
      p.vy+=C.gravity;p.vx*=.985;p.vy*=.985;p.x+=p.vx+Math.sin(p.sw+=.1)*.8;p.y+=p.vy;p.r+=p.vr;p.life-=.0065;
      x.save();x.globalAlpha=Math.max(0,Math.min(1,p.life*1.6));x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;
      if(p.sh==="rect")x.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);
      else if(p.sh==="circle"){x.beginPath();x.arc(0,0,p.s/2.2,0,6.3);x.fill()}
      else if(p.sh==="petal"){x.beginPath();x.ellipse(0,0,p.s*.7,p.s*.38,0,0,6.3);x.fill()}
      else{x.font=`${p.s*1.9}px sans-serif`;x.textAlign="center";x.textBaseline="middle";x.fillText(p.sh==="star"?"✦":p.sh==="heart"?"♥":p.sh,0,0)}
      x.restore();
    }
    if(parts.length)fxRaf=requestAnimationFrame(loop);else{fxRaf=0;x.clearRect(0,0,cv.width,cv.height)}
  });
}

/* ---------- init ---------- */
(async()=>{photos=await dbAll();renderHeader();renderBoard();renderGrid();startCam();syncAll()})();
})();
