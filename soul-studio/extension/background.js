// Single owner of the prompt queue so the studio page and the Higgsfield tab never race.
let lock = Promise.resolve();
function withLock(fn) {
  const p = lock.then(fn);
  lock = p.catch(() => {});
  return p;
}
const get = () => new Promise(r => chrome.storage.local.get({ soulQueue: [], soulDone: 0 }, r));
const set = o => new Promise(r => chrome.storage.local.set(o, r));

chrome.runtime.onMessage.addListener((msg, _s, send) => {
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
