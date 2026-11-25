(()=>{
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
document.documentElement.classList.remove('no-js');
const hdr=$('.hdr'),dock=$('.dock'),reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;

/* header + dock */
let lastY=scrollY,acc=0;
const onScroll=()=>{
  const y=scrollY;
  hdr.classList.toggle('scrolled',y>12);
  if(dock){const d=y-lastY;acc=(Math.sign(d)===Math.sign(acc))?acc+d:d;
    if(y<80||acc<-24)dock.classList.remove('hide');else if(acc>40)dock.classList.add('hide');}
  lastY=y;
};
addEventListener('scroll',onScroll,{passive:true});onScroll();

/* mobile nav */
const mb=$('.menu-btn'),mn=$('.mnav');
if(mb){mb.addEventListener('click',()=>{const o=mb.getAttribute('aria-expanded')!=='true';
  mb.setAttribute('aria-expanded',o);mn.classList.toggle('open',o);hdr.classList.toggle('open',o);
  document.body.style.overflow=o?'hidden':'';});
  $$('a',mn).forEach(a=>a.addEventListener('click',()=>{mb.click();}));}

/* reveal */
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{threshold:.12,rootMargin:'0px 0px -6% 0px'});
$$('.rv').forEach(el=>io.observe(el));

/* hero parallax */
const st=$('.bowl-stage');
if(st&&!reduce&&matchMedia('(pointer:fine)').matches){
  addEventListener('pointermove',e=>{st.style.setProperty('--mx',(e.clientX/innerWidth-.5).toFixed(3));st.style.setProperty('--my',(e.clientY/innerHeight-.5).toFixed(3));},{passive:true});
}

/* rails */
$$('.railwrap').forEach(w=>{
  const r=$('.rail',w),bar=$('.prog i',w),prev=$('[data-prev]',w),next=$('[data-next]',w);
  const upd=()=>{const m=r.scrollWidth-r.clientWidth;const p=m>0?r.scrollLeft/m:1;
    bar.style.transform=`scaleX(${Math.max(.08,p)})`;bar.style.width='100%';
    prev.disabled=r.scrollLeft<4;next.disabled=r.scrollLeft>m-4;};
  const step=()=>r.querySelector('.dish').getBoundingClientRect().width+24;
  prev.onclick=()=>r.scrollBy({left:-step(),behavior:'smooth'});
  next.onclick=()=>r.scrollBy({left:step(),behavior:'smooth'});
  r.addEventListener('scroll',upd,{passive:true});addEventListener('resize',upd);upd();
});

/* order sheet */
const sheet=$('.sheet');
const setSheet=o=>{document.body.classList.toggle('sheet-open',o);if(sheet){sheet.setAttribute('aria-hidden',!o);if(o)$('.x',sheet).focus();}};
$$('[data-order]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();setSheet(true);}));
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>setSheet(false)));
addEventListener('keydown',e=>{if(e.key==='Escape')setSheet(false);});

/* maps (click to load) */
$$('[data-map]').forEach(b=>b.addEventListener('click',()=>{
  const box=b.closest('.lphoto');const f=document.createElement('iframe');
  f.src=b.dataset.map;f.loading='lazy';f.title=b.dataset.title||'Map';f.referrerPolicy='no-referrer-when-downgrade';
  box.appendChild(f);b.remove();}));

/* menu page */
const mroot=$('#menu-root');
if(mroot){
  const tabs=$$('.mtabs button'),panels=$$('[data-panel]'),q=$('#q'),veg=$('#veg');
  const cats=$('.cats');
  const show=name=>{
    tabs.forEach(t=>t.setAttribute('aria-selected',t.dataset.tab===name));
    panels.forEach(p=>p.hidden=p.dataset.panel!==name);
    $$('[data-for]',cats).forEach(a=>a.hidden=a.dataset.for!==name);
    history.replaceState(null,'','#'+name);
    filter();spy();
  };
  const filter=()=>{
    const t=(q.value||'').trim().toLowerCase(),v=veg.getAttribute('aria-pressed')==='true';
    let any=false;
    $$('.mcat').forEach(c=>{
      let n=0;
      $$('.mi',c).forEach(i=>{
        const ok=(!t||i.dataset.s.includes(t))&&(!v||i.dataset.v==='1');
        i.hidden=!ok;if(ok)n++;
      });
      c.dataset.empty=n?'':'1';
      c.hidden=!n&&(t||v);
      if(n&&!c.closest('[hidden]'))any=true;
    });
    $('#empty').hidden=any;
  };
  let tmr;q.addEventListener('input',()=>{clearTimeout(tmr);tmr=setTimeout(filter,90);});
  veg.addEventListener('click',()=>{veg.setAttribute('aria-pressed',veg.getAttribute('aria-pressed')!=='true');filter();});
  tabs.forEach(t=>t.addEventListener('click',()=>{show(t.dataset.tab);scrollTo({top:$('#menu-start').offsetTop-140,behavior:reduce?'auto':'smooth'});}));
  function spy(){
    const vis=$$('.mcat').filter(c=>!c.hidden&&!c.closest('[hidden]'));
    const y=scrollY+190;let cur=vis[0];
    vis.forEach(c=>{if(c.offsetTop+c.closest('[data-panel]').offsetTop<=y)cur=c;});
    $$('a',cats).forEach(a=>{const on=cur&&a.getAttribute('href')==='#'+cur.id;a.classList.toggle('on',on);
      if(on&&a.offsetParent)cats.scrollTo({left:a.offsetLeft-24,behavior:'auto'});});
  }
  addEventListener('scroll',()=>{clearTimeout(spy.t);spy.t=setTimeout(spy,40);},{passive:true});
  $$('a',cats).forEach(a=>a.addEventListener('click',e=>{
    e.preventDefault();const c=$(a.getAttribute('href'));
    const p=c.closest('[data-panel]');if(p.hidden)show(p.dataset.panel);
    scrollTo({top:c.getBoundingClientRect().top+scrollY-150,behavior:reduce?'auto':'smooth'});}));
  const h=location.hash.slice(1);show(['food','platters','drinks'].includes(h)?h:'food');
}
})();
