// Single owner of the prompt queue so the studio page and the Higgsfield tab never race.
let lock = Promise.resolve();
function withLock(fn) {
  const p = lock.then(fn);
  lock = p.catch(() => {});
  return p;
}
const get = () => new Promise(r => chrome.storage.local.get({ soulQueue: [], soulDone: 0 }, r));
const set = o => new Promise(r => chrome.storage.local.set(o, r));


// ---- trusted (real) mouse/keyboard input through the debugger API ----
const attached = new Set();
const dbg = (tabId, method, params = {}) => new Promise((res, rej) =>
  chrome.debugger.sendCommand({ tabId }, method, params, r => chrome.runtime.lastError ? rej(new Error(chrome.runtime.lastError.message)) : res(r)));
chrome.debugger.onDetach.addListener(s => attached.delete(s.tabId));
async function cdp(tabId, msg) {
  if (msg.op === 'attach') {
    if (!attached.has(tabId)) {
      await new Promise((res, rej) => chrome.debugger.attach({ tabId }, '1.3', () => chrome.runtime.lastError ? rej(new Error(chrome.runtime.lastError.message)) : res()));
      attached.add(tabId);
    }
    return { ok: true };
  }
  if (msg.op === 'detach') {
    if (attached.has(tabId)) { await new Promise(r => chrome.debugger.detach({ tabId }, () => r())); attached.delete(tabId); }
    return { ok: true };
  }
  if (!attached.has(tabId)) return { ok: false, error: 'not attached' };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  if (msg.op === 'click') {
    const { x, y } = msg;
    await dbg(tabId, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await dbg(tabId, 'Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await sleep(60);
    await dbg(tabId, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    return { ok: true };
  }
  if (msg.op === 'wipe') {   // Ctrl+A then Backspace
    await dbg(tabId, 'Input.dispatchKeyEvent', { type: 'rawKeyDown', modifiers: 2, key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, commands: ['selectAll'] });
    await dbg(tabId, 'Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 2, key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 });
    await sleep(120);
    await dbg(tabId, 'Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8, commands: ['deleteBackward'] });
    await dbg(tabId, 'Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    return { ok: true };
  }
  if (msg.op === 'type') {
    await dbg(tabId, 'Input.insertText', { text: msg.text });
    return { ok: true };
  }
  return { ok: false, error: 'unknown op' };
}

chrome.runtime.onMessage.addListener((msg, sender, send) => {
  if (msg.type === 'cdp') {
    cdp(sender.tab && sender.tab.id, msg).then(send, e => send({ ok: false, error: String(e.message || e) }));
    return true;
  }
  withLock(async () => {
    const { soulQueue, soulDone } = await get();
    switch (msg.type) {
      case 'push': {
        const add = (msg.prompts || []).map(s => String(s).trim()).filter(Boolean);
        const q = msg.replace ? add : soulQueue.concat(add);
        await set({ soulQueue: q });
        return { ok: true, count: add.length, queued: q.length };
      }
      case 'pop': {
        if (!soulQueue.length) return { ok: true, prompt: null, queued: 0 };
        const prompt = soulQueue[0];
        await set({ soulQueue: soulQueue.slice(1), soulDone: soulDone + 1 });
        return { ok: true, prompt, queued: soulQueue.length - 1 };
      }
      case 'requeue': {
        await set({ soulQueue: [msg.prompt].concat(soulQueue), soulDone: Math.max(0, soulDone - 1) });
        return { ok: true };
      }
      case 'clear':
        await set({ soulQueue: [] });
        return { ok: true, queued: 0 };
      case 'status':
        return { ok: true, queued: soulQueue.length, done: soulDone };
      case 'resetDone':
        await set({ soulDone: 0 });
        return { ok: true };
    }
    return { ok: false };
  }).then(send, e => send({ ok: false, error: String(e) }));
  return true;
});
