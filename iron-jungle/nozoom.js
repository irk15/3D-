// Stops phones from zooming the page while playing (double tap, pinch). iOS Safari ignores
// user-scalable=no, so the gestures have to be cancelled here as well.
const stop = e => { if (e.cancelable) e.preventDefault(); };
const opts = { passive: false };
for (const type of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick']) document.addEventListener(type, stop, opts);
// pinch with two or more fingers
document.addEventListener('touchmove', e => { if (e.touches.length > 1 || (e.scale && e.scale !== 1)) stop(e); }, opts);
// game area and on-screen controls: cancel the browser's own tap handling (pointer events still arrive)
const isUi = t => t.closest?.('#menu, button, input, a');
document.addEventListener('touchstart', e => { if (!isUi(e.target)) stop(e); }, opts);
// quick second tap on the menu background or text
document.addEventListener('touchend', e => { if (!e.target.closest?.('button, input, a')) stop(e); }, opts);
