(function () {
  var d = document, root = d.documentElement;
  root.classList.add('js');

  // header state
  var header = d.querySelector('.site-header');
  var prog = d.querySelector('.progress');
  function onScroll() {
    header.classList.toggle('scrolled', window.scrollY > 40);
    if (prog) { var h = root.scrollHeight - window.innerHeight; prog.style.setProperty('--p', h > 0 ? Math.min(1, window.scrollY / h) : 0); }
  }
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

  // mobile menu
  var burger = d.querySelector('.burger'), nav = d.getElementById('nav');
  function setMenu(open) {
    nav.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    d.body.style.overflow = open ? 'hidden' : '';
  }
  burger.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
  nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') setMenu(false); });

  // stagger children of grids
  d.querySelectorAll('.dish-grid > .dish, .gallery > .g, .cake-card').forEach(function (el, i) { el.style.setProperty('--d', ((i % 4) * 0.08) + 's'); });

  // reveal on scroll
  var items = d.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  } else { items.forEach(function (el) { el.classList.add('in'); }); }

  // hero parallax (subtle)
  var pbg = d.querySelector('.phero-bg img');
  if (pbg && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.addEventListener('scroll', function () {
      var y = Math.min(window.scrollY, 700);
      pbg.style.transform = 'translate3d(0,' + (y * 0.18) + 'px,0) scale(1.06)';
    }, { passive: true });
  }

  // lightbox
  var lb = d.getElementById('lightbox'), lbImg = lb.querySelector('img');
  function closeLb() { lb.hidden = true; lbImg.removeAttribute('src'); d.body.style.overflow = ''; }
  d.addEventListener('click', function (e) {
    var t = e.target;
    if (t.matches && t.matches('img[data-lightbox]')) {
      lbImg.src = t.currentSrc || t.src; lbImg.alt = t.alt; lb.hidden = false; d.body.style.overflow = 'hidden';
    } else if (t === lb || t.classList.contains('lb-close')) { closeLb(); }
  });
  d.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (!lb.hidden) closeLb(); setMenu(false); }
  });

  // catering menu filter
  var chips = d.querySelectorAll('.chip');
  if (chips.length) {
    var secs = d.querySelectorAll('.menu-sec');
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        chips.forEach(function (x) { x.classList.toggle('is-on', x === c); });
        var cat = c.getAttribute('data-cat');
        secs.forEach(function (s) { s.hidden = !(cat === 'all' || s.getAttribute('data-cat') === cat); s.classList.add('in'); });
      });
    });
  }
})();
