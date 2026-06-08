/**
 * Content script for Split View Sync Reload Extension.
 * Tracks modifier keys and updates the background Service Worker.
 */

let lastState = { shift: false, ctrl: false, alt: false, meta: false };
let blurTimeout = null;

function getModifierState(e) {
  return {
    shift: e ? e.shiftKey : false,
    ctrl: e ? e.ctrlKey : false,
    alt: e ? e.altKey : false,
    meta: e ? e.metaKey : false
  };
}

function sendState(state) {
  if (
    state.shift !== lastState.shift ||
    state.ctrl !== lastState.ctrl ||
    state.alt !== lastState.alt ||
    state.meta !== lastState.meta
  ) {
    lastState = state;
    chrome.runtime.sendMessage({ type: 'MODIFIER_STATE', state }).catch(() => {
      // Ignore errors when background is temporarily unreachable
    });
  }
}

// Listen to keydown and keyup to track modifier state changes
window.addEventListener('keydown', (e) => {
  // If we had a pending blur timeout, clear it because the page is interacting
  if (blurTimeout) {
    clearTimeout(blurTimeout);
    blurTimeout = null;
  }
  sendState(getModifierState(e));
}, { passive: true });

window.addEventListener('keyup', (e) => {
  sendState(getModifierState(e));
}, { passive: true });

// Handle blur (focus lost) with a delay.
// This ensures that if the user holds a modifier key (e.g. Shift) and clicks the
// reload button in the browser UI, the modifier state is not cleared instantly
// before the navigation is processed in background.js.
window.addEventListener('blur', () => {
  if (blurTimeout) clearTimeout(blurTimeout);
  blurTimeout = setTimeout(() => {
    sendState({ shift: false, ctrl: false, alt: false, meta: false });
  }, 500); // 500ms delay to bridge the time between blur and navigation start
}, { passive: true });

window.addEventListener('focus', () => {
  if (blurTimeout) {
    clearTimeout(blurTimeout);
    blurTimeout = null;
  }
}, { passive: true });

// Also handle visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (blurTimeout) clearTimeout(blurTimeout);
    sendState({ shift: false, ctrl: false, alt: false, meta: false });
  }
}, { passive: true });
