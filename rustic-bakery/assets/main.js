(function () {
  var d = document, root = d.documentElement, win = window;
  root.classList.add('js');
  var reduce = win.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- header + progress ---------- */
  var header = d.querySelector('.site-header');
  var prog = d.querySelector('.progress');
  var dock = d.querySelector('.dock');
  var lastY = win.scrollY, ticking = false;

  function onScroll() {
    var y = win.scrollY;
    header.classList.toggle('scrolled', y > 40);
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
