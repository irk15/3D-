// Runs on higgsfield.ai. Pulls prompts from the queue, types them into the
// Soul 2.0 prompt box, clicks Generate, waits, repeats.
(() => {
  if (window.__soulBot) return;
  window.__soulBot = true;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const call = m => new Promise(r => {
    try { chrome.runtime.sendMessage(m, res => r(res || { ok: false })); } catch (e) { r({ ok: false }); }
  });
  const S = { run: false, gap: 30, submitted: 0 };
  try { S.gap = +localStorage.getItem('soulGap') || 30; } catch (e) {}

  /* ---------- finding things on the page ---------- */
  const visible = el => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 40 && r.height > 16 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  function findComposer() {
    const c = [...document.querySelectorAll('textarea,[contenteditable="true"],[contenteditable=""],[role="textbox"]')]
      .filter(el => visible(el) && !el.closest('#soulbot'));
    if (!c.length) return null;
    const score = el => {
      const hint = (el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.getAttribute('data-placeholder') || '').toLowerCase();
      const r = el.getBoundingClientRect();
      return (/describe|prompt|imagine|scene|idea|create/.test(hint) ? 1e6 : 0) + r.width * r.height;
    };
    return c.sort((a, b) => score(b) - score(a))[0];
  }
  function findGenerate() {
    const b = [...document.querySelectorAll('button,[role="button"]')]
      .filter(el => visible(el) && !el.closest('#soulbot'))
      .filter(el => /^\s*generate\b/i.test((el.innerText || '') + ' ') || /^generate/i.test(el.getAttribute('aria-label') || ''));
    if (!b.length) return null;
    // prefer submit-type, then the one nearest the bottom of the viewport
    b.sort((x, y) => (y.type === 'submit') - (x.type === 'submit') || y.getBoundingClientRect().top - x.getBoundingClientRect().top);
    return b[0];
  }
  const isDisabled = el => el.disabled || el.getAttribute('aria-disabled') === 'true' || el.dataset.disabled === 'true';

  /* ---------- typing and clicking ---------- */
  function setText(el, text) {
    el.focus();
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      document.execCommand('selectAll', false, null);
      if (!document.execCommand('insertText', false, text)) {
        el.textContent = text;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      }
    }
  }
  const readText = el => (el.value !== undefined ? el.value : el.innerText || '').trim();
  function press(el) {
    const r = el.getBoundingClientRect(), o = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, view: window };
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(t =>
      el.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, o)));
  }

  /* ---------- panel ---------- */
  const box = document.createElement('div');
  box.id = 'soulbot';
  box.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647;width:236px;background:#101012;color:#eee;font:12px/1.4 system-ui,sans-serif;border:1px solid #3a3a42;border-radius:12px;padding:10px 12px;box-shadow:0 8px 30px #0009';
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <b style="color:#c9a2ff">Soul Bridge</b><span id="sb-st" style="color:#888">idle</span></div>
    <div>Queue <b id="sb-q">0</b> &middot; Sent <b id="sb-d">0</b></div>
    <div style="margin:6px 0;display:flex;gap:6px;align-items:center">Gap <input id="sb-gap" type="number" min="5" max="600" style="width:54px;background:#1b1b1f;color:#eee;border:1px solid #333;border-radius:6px;padding:2px 4px"> sec</div>
    <div style="display:flex;gap:6px">
      <button id="sb-go" style="flex:1;padding:6px;border:0;border-radius:8px;background:#c9a2ff;color:#111;font-weight:700;cursor:pointer">Start</button>
      <button id="sb-clr" style="padding:6px 8px;border:1px solid #444;border-radius:8px;background:none;color:#ccc;cursor:pointer">Clear</button></div>
    <div id="sb-log" style="margin-top:6px;color:#8a8a92;min-height:16px"></div>`;
  document.documentElement.appendChild(box);
  const $ = id => box.querySelector('#' + id);
  const log = m => { $('sb-log').textContent = m; };
  const state = m => { $('sb-st').textContent = m; };
  $('sb-gap').value = S.gap;
  $('sb-gap').onchange = e => { S.gap = Math.max(5, +e.target.value || 30); try { localStorage.setItem('soulGap', S.gap); } catch (x) {} };
  $('sb-go').onclick = () => { S.run = !S.run; $('sb-go').textContent = S.run ? 'Pause' : 'Start'; state(S.run ? 'running' : 'paused'); if (S.run) loop(); };
  $('sb-clr').onclick = async () => { await call({ type: 'clear' }); refresh(); log('queue cleared'); };
  async function refresh() {
    const r = await call({ type: 'status' });
    if (r.ok) { $('sb-q').textContent = r.queued; $('sb-d').textContent = r.done; }
    return r;
  }
  setInterval(refresh, 2500); refresh();

  /* ---------- main loop ---------- */
  let looping = false;
  const outOfCredits = () => /not enough credits|insufficient credits|out of credits|no credits left/i.test(document.body.innerText || '');

  async function submitOne() {
    const comp = findComposer(), btn = findGenerate();
    if (!comp) { log('prompt box not found'); return 'wait'; }
    if (!btn) { log('Generate button not found'); return 'wait'; }
    if (isDisabled(btn)) { log('Generate busy, waiting'); return 'wait'; }
    const { prompt } = await call({ type: 'pop' });
    if (!prompt) { log('queue empty'); return 'empty'; }

    for (let attempt = 0; attempt < 3; attempt++) {
      setText(comp, prompt);
      await sleep(700);
      if (readText(comp) !== prompt.trim()) { await sleep(500); continue; }
      const b = findGenerate();
      if (!b || isDisabled(b)) { await sleep(1000); continue; }
      press(b);
      await sleep(2500);
      const after = readText(comp);
      if (after !== prompt.trim() || isDisabled(findGenerate() || b)) {
        S.submitted++; log('sent #' + S.submitted); return 'ok';
      }
      // page may keep the prompt after submit; accept if a click went through the second time
      if (attempt === 2) { S.submitted++; log('sent #' + S.submitted + ' (unverified)'); return 'ok'; }
    }
    await call({ type: 'requeue', prompt });
    log('could not submit, paused');
    return 'fail';
  }

  async function loop() {
    if (looping) return;
    looping = true;
    while (S.run) {
      if (outOfCredits()) { S.run = false; $('sb-go').textContent = 'Start'; state('no credits'); log('out of credits, stopped'); break; }
      const r = await submitOne();
      refresh();
      if (r === 'fail') { S.run = false; $('sb-go').textContent = 'Start'; state('stopped'); break; }
      if (r === 'ok') {
        const wait = S.gap * (0.9 + Math.random() * 0.25) * 1000;
        const end = Date.now() + wait;
        while (S.run && Date.now() < end) { state('next in ' + Math.ceil((end - Date.now()) / 1000) + 's'); await sleep(500); }
        if (S.run) state('running');
      } else await sleep(r === 'empty' ? 3000 : 2000);
    }
    looping = false;
  }
})();
