// Runs on the Soul Studio page. Bridges window.postMessage <-> extension queue.
(() => {
  const call = m => new Promise(r => {
    try { chrome.runtime.sendMessage(m, res => r(res || { ok: false, error: chrome.runtime.lastError?.message })); }
    catch (e) { r({ ok: false, error: String(e) }); }
  });
  window.addEventListener('message', async e => {
    if (e.source !== window || !e.data || typeof e.data.soul !== 'string') return;
    const d = e.data;
    if (d.soul === 'ping') window.postMessage({ soulReply: 'pong' }, '*');
    else if (d.soul === 'send') {
      const r = await call({ type: 'push', prompts: d.prompts, replace: !!d.replace });
      window.postMessage({ soulReply: 'ack', ...r }, '*');
    } else if (d.soul === 'clear') {
      const r = await call({ type: 'clear' });
      window.postMessage({ soulReply: 'count', queued: 0, ...r }, '*');
    }
  });
  const poll = async () => {
    const r = await call({ type: 'status' });
    if (r.ok) window.postMessage({ soulReply: 'count', queued: r.queued, done: r.done }, '*');
  };
  setInterval(poll, 4000);
  setTimeout(poll, 500);
})();
