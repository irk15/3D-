(function () {
  var d = document, root = d.documentElement, win = window;
  root.classList.add('js');
  var reduce = win.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- header + progress ---------- */
  var header = d.querySelector('.site-header');
  var prog = d.querySelector('.progress');
  var dock = d.querySelector('.dock');
  var heroBg = d.querySelector('.hero-bg');
  var lastY = win.scrollY, ticking = false;

  function onScroll() {
    var y = win.scrollY;
    header.classList.toggle('scrolled', y > 40);
    if (heroBg && !reduce && y < win.innerHeight * 1.2) heroBg.style.transform = 'scale(1.06) translate3d(0,' + (y * 0.16).toFixed(1) + 'px,0)';
    if (prog) {
      var h = root.scrollHeight - win.innerHeight;
      prog.style.setProperty('--p', h > 0 ? Math.min(1, y / h) : 0);
    }
    // dock: hide while scrolling down, show on scroll up / near the end
    if (dock) {
      var delta = y - lastY;
      var nearEnd = root.scrollHeight - (y + win.innerHeight) < 120;
      if (Math.abs(delta) > 8) {
        dock.classList.toggle('hide', delta > 0 && y > 200 && !nearEnd);
        lastY = y;
      }
      if (nearEnd || y < 120) dock.classList.remove('hide');
    }
    ticking = false;
  }
  win.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; win.requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* ---------- current page state (dock) ---------- */
  var page = d.body.getAttribute('data-page');
  d.querySelectorAll('.dock a[data-p]').forEach(function (a) {
    if (a.getAttribute('data-p') === page) a.setAttribute('aria-current', 'page');
  });

  /* ---------- mobile menu ---------- */
  var burger = d.querySelector('.burger'), nav = d.getElementById('nav');
  function setMenu(open) {
    nav.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    d.body.style.overflow = open ? 'hidden' : '';
    if (dock) dock.style.visibility = open ? 'hidden' : '';
  }
  burger.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
  nav.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) setMenu(false); });
  win.addEventListener('resize', function () { if (win.innerWidth > 1180) setMenu(false); });

  /* ---------- reveal + stagger ---------- */
  d.querySelectorAll('.dish-grid > .dish, .gallery > .g, .cake-row > .cake-card').forEach(function (el, i) {
    el.style.setProperty('--d', ((i % 4) * 0.08) + 's');
  });
  var items = d.querySelectorAll('.reveal');
  if ('IntersectionObserver' in win && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    items.forEach(function (el) { io.observe(el); });
  } else { items.forEach(function (el) { el.classList.add('in'); }); }

  /* ---------- carousel dots (phones) ---------- */
  d.querySelectorAll('.dish-grid, .cake-row').forEach(function (track) {
    var kids = Array.prototype.slice.call(track.children);
    if (kids.length < 2) return;
    var dots = d.createElement('div');
    dots.className = 'dots'; dots.setAttribute('aria-hidden', 'true');
    kids.forEach(function () { dots.appendChild(d.createElement('i')); });
    track.parentNode.insertBefore(dots, track.nextSibling);
    var dl = dots.children;
    function sync() {
      var tl = track.getBoundingClientRect().left, best = 0, bd = 1e9;
      kids.forEach(function (k, i) {
        var dist = Math.abs(k.getBoundingClientRect().left - tl - 10);
        if (dist < bd) { bd = dist; best = i; }
      });
      for (var i = 0; i < dl.length; i++) dl[i].classList.toggle('on', i === best);
    }
    track.addEventListener('scroll', function () { win.requestAnimationFrame(sync); }, { passive: true });
    sync();
  });


  /* ---------- statement: words fill in as you scroll ---------- */
  d.querySelectorAll('[data-fill]').forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', words.join(' '));
    el.innerHTML = words.map(function (w) { return '<span class="w" aria-hidden="true">' + w.replace(/&/g, '&amp;') + '</span>'; }).join(' ');
    var spans = el.querySelectorAll('.w'), n = spans.length, ticking2 = false;
    function fill() {
      var r = el.getBoundingClientRect(), vh = win.innerHeight;
      var p = (vh * 0.82 - r.top) / (r.height + vh * 0.18);
      var on = Math.max(0, Math.min(n, Math.round(p * n * 1.15)));
      for (var i = 0; i < n; i++) spans[i].classList.toggle('on', i < on);
      ticking2 = false;
    }
    win.addEventListener('scroll', function () { if (!ticking2) { ticking2 = true; win.requestAnimationFrame(fill); } }, { passive: true });
    win.addEventListener('resize', fill); fill();
  });

  /* ---------- rails: arrows + mouse drag ---------- */
  var fine = win.matchMedia('(hover:hover) and (pointer:fine)').matches;
  d.querySelectorAll('.rail').forEach(function (rail) {
    var ctl = d.createElement('div'); ctl.className = 'rail-ctl';
    var arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    ctl.innerHTML = '<div class="rail-bar" aria-hidden="true"><i></i></div><div class="btns"><button class="prev" aria-label="Previous">' + arrow + '</button><button class="next" aria-label="Next">' + arrow + '</button></div>';
    var fill = ctl.querySelector('.rail-bar i');
    rail.parentNode.insertBefore(ctl, rail.nextSibling);
    var pv = ctl.querySelector('.prev'), nx = ctl.querySelector('.next');
    function step() { var k = rail.children[0]; return k ? k.getBoundingClientRect().width + 16 : 300; }
    function upd() { var mx = rail.scrollWidth - rail.clientWidth; ctl.style.setProperty('--f', Math.max(.12, mx > 0 ? (rail.scrollLeft + rail.clientWidth * .35) / (mx + rail.clientWidth * .35) : 1).toFixed(3)); fill.parentNode.style.setProperty('--f', ctl.style.getPropertyValue('--f')); pv.disabled = rail.scrollLeft < 8; nx.disabled = rail.scrollLeft > rail.scrollWidth - rail.clientWidth - 8; }
    pv.addEventListener('click', function () { rail.scrollBy({ left: -step() * 2, behavior: reduce ? 'auto' : 'smooth' }); });
    nx.addEventListener('click', function () { rail.scrollBy({ left: step() * 2, behavior: reduce ? 'auto' : 'smooth' }); });
    rail.addEventListener('scroll', function () { win.requestAnimationFrame(upd); }, { passive: true });
    win.addEventListener('resize', upd); upd();
    if (!fine) return;
    var down = false, sx = 0, sl = 0, moved = 0;
    rail.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; down = true; moved = 0; sx = e.clientX; sl = rail.scrollLeft; });
    win.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx));
      if (moved > 6) { rail.classList.add('drag'); rail.scrollLeft = sl - dx; }
    });
    win.addEventListener('pointerup', function () { if (!down) return; down = false; setTimeout(function () { rail.classList.remove('drag'); }, 0); });
    rail.addEventListener('click', function (e) { if (moved > 6) { e.stopPropagation(); e.preventDefault(); moved = 0; } }, true);
  });

  /* ---------- cursor + index preview (mouse only) ---------- */
  if (fine && !reduce) {
    var cur = d.createElement('div'); cur.className = 'cursor'; cur.setAttribute('aria-hidden', 'true'); d.body.appendChild(cur);
    var pvEl = d.createElement('div'); pvEl.className = 'pv'; pvEl.setAttribute('aria-hidden', 'true'); d.body.appendChild(pvEl);
    var idx = d.querySelector('[data-index]'), pvImgs = {};
    if (idx) idx.querySelectorAll('a').forEach(function (a) {
      var im = d.createElement('img'); im.alt = ''; im.src = a.getAttribute('data-img'); pvEl.appendChild(im); pvImgs[a.getAttribute('href')] = im;
    });
    var mx = -200, my = -200, cx = -200, cy = -200, px = -200, py = -200, mode = '', raf = 0;
    function loop() {
      cx += (mx - cx) * 0.22; cy += (my - cy) * 0.22; px += (mx - px) * 0.12; py += (my - py) * 0.12;
      cur.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0) scale(' + (mode ? 1 : 0.3) + ')';
      pvEl.style.transform = 'translate3d(' + (px + 28) + 'px,' + (py - 150) + 'px,0) rotate(' + ((mx - px) * 0.05).toFixed(2) + 'deg) scale(' + (pvEl.classList.contains('on') ? 1 : 0.8) + ')';
      raf = win.requestAnimationFrame(loop);
    }
    loop();
    d.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      var t = e.target, m = '';
      if (t.closest) {
        if (t.closest('.rail')) m = 'Drag';
        if (t.closest('img[data-lightbox]')) m = 'View';
      }
      if (m !== mode) { mode = m; cur.textContent = m; cur.classList.toggle('on', !!m); }
      var a = t.closest && t.closest('[data-index] a');
      var on = !!a;
      pvEl.classList.toggle('on', on);
      if (a) { var key = a.getAttribute('href'); for (var k in pvImgs) pvImgs[k].classList.toggle('on', k === key); }
    }, { passive: true });
    d.addEventListener('mouseleave', function () { mode = ''; cur.classList.remove('on'); pvEl.classList.remove('on'); });
  }


  /* ---------- hot table: dish explorer ---------- */
  d.querySelectorAll('[data-dexp]').forEach(function (list) {
    var items = Array.prototype.slice.call(list.querySelectorAll('li'));
    var wide = function () { return win.matchMedia('(min-width:861px)').matches; };
    function pick(li, toggle) {
      var was = li.classList.contains('on');
      items.forEach(function (x) { x.classList.remove('on'); x.querySelector('button').setAttribute('aria-expanded', 'false'); });
      if (toggle && was && !wide()) return;
      li.classList.add('on'); li.querySelector('button').setAttribute('aria-expanded', 'true');
    }
    items.forEach(function (li) {
      var b = li.querySelector('button');
      b.addEventListener('click', function () { pick(li, true); });
      b.addEventListener('focus', function () { if (wide()) pick(li); });
      if (fine) b.addEventListener('mouseenter', function () { if (wide()) pick(li); });
    });
  });

  /* ---------- lightbox with swipe + arrows ---------- */
  var lb = d.getElementById('lightbox'), lbImg = lb.querySelector('img');
  var prev = lb.querySelector('.lb-prev'), next = lb.querySelector('.lb-next'), count = lb.querySelector('.lb-count');
  var group = [], idx = 0;
  function show(i) {
    idx = (i + group.length) % group.length;
    var im = group[idx];
    lbImg.src = im.currentSrc || im.src; lbImg.alt = im.alt;
    var many = group.length > 1;
    prev.hidden = next.hidden = count.hidden = !many;
    count.textContent = (idx + 1) + ' / ' + group.length;
  }
  function openLb(t) {
    var scope = t.closest('.gallery, .dish-grid, .cake-row, .mosaic, .tiles') || t.parentNode;
    group = Array.prototype.slice.call(scope.querySelectorAll('img[data-lightbox]'));
    if (!group.length) group = [t];
    show(Math.max(0, group.indexOf(t)));
    lb.hidden = false; d.body.style.overflow = 'hidden';
    lb.querySelector('.lb-close').focus({ preventScroll: true });
  }
  function closeLb() { lb.hidden = true; lbImg.removeAttribute('src'); d.body.style.overflow = ''; }
  d.addEventListener('click', function (e) {
    var t = e.target;
    if (t.matches && t.matches('img[data-lightbox]')) { openLb(t); }
    else if (t === lb || t.classList.contains('lb-close')) { closeLb(); }
    else if (t === prev) { show(idx - 1); }
    else if (t === next) { show(idx + 1); }
  });
  d.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (!lb.hidden) closeLb(); setMenu(false); }
    if (!lb.hidden && e.key === 'ArrowLeft') show(idx - 1);
    if (!lb.hidden && e.key === 'ArrowRight') show(idx + 1);
  });
  var sx = 0, sy = 0, tracking = false;
  lb.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { tracking = false; return; }
    tracking = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY;
  }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    if (!tracking) return; tracking = false;
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3 && group.length > 1) { show(idx + (dx < 0 ? 1 : -1)); }
    else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.3) { closeLb(); }
  }, { passive: true });

  /* ---------- catering menu filter ---------- */
  var chips = d.querySelectorAll('.chip');
  if (chips.length) {
    var secs = d.querySelectorAll('.menu-sec');
    var bar = d.querySelector('.chips');
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        chips.forEach(function (x) { x.classList.toggle('is-on', x === c); x.setAttribute('aria-pressed', x === c); });
        var cat = c.getAttribute('data-cat');
        secs.forEach(function (s) { s.hidden = !(cat === 'all' || s.getAttribute('data-cat') === cat); s.classList.add('in'); });
        c.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
        if (win.innerWidth <= 760 && bar) {
          var grid = d.querySelector('.menu-grid');
          var top = grid.getBoundingClientRect().top + win.scrollY - 130;
          if (win.scrollY > top) win.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
        }
      });
    });
  }
})();
