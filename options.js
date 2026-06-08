/**
 * Options page script for Split View Sync Reload Extension.
 * Handles configuration loading/saving and the interactive keyboard tester.
 */

// DOM Elements
const enabledCheckbox = document.getElementById('extension-enabled');
const shiftCheckbox = document.getElementById('mod-shift');
const ctrlCheckbox = document.getElementById('mod-ctrl');
const altCheckbox = document.getElementById('mod-alt');
const metaCheckbox = document.getElementById('mod-meta');
const saveStatus = document.getElementById('save-status');

const keyShift = document.getElementById('key-shift');
const keyCtrl = document.getElementById('key-ctrl');
const keyAlt = document.getElementById('key-alt');
const keyMeta = document.getElementById('key-meta');

// Load settings from storage
function loadSettings() {
  chrome.storage.sync.get(['enabled', 'modifiers'], (items) => {
    // Enable/Disable flag
    enabledCheckbox.checked = items.enabled !== false; // default to true

    // Modifier keys (default: shift is true, others false)
    const modifiers = items.modifiers || {};
    shiftCheckbox.checked = modifiers.shift !== false; // default true
    ctrlCheckbox.checked = !!modifiers.ctrl;          // default false
    altCheckbox.checked = !!modifiers.alt;            // default false
    metaCheckbox.checked = !!modifiers.meta;          // default false
  });
}

// Save settings to storage
function saveSettings() {
  const settings = {
    enabled: enabledCheckbox.checked,
    modifiers: {
      shift: shiftCheckbox.checked,
      ctrl: ctrlCheckbox.checked,
      alt: altCheckbox.checked,
      meta: metaCheckbox.checked
    }
  };

  chrome.storage.sync.set(settings, () => {
    // Show visual status feedback
    saveStatus.textContent = '設定を保存しました。';
    saveStatus.classList.add('saved');

    // Reset feedback text after a delay
    setTimeout(() => {
      saveStatus.textContent = '設定は自動的に保存されます。';
      saveStatus.classList.remove('saved');
    }, 1500);
  });
}

// Setup change event listeners on all settings controls
[enabledCheckbox, shiftCheckbox, ctrlCheckbox, altCheckbox, metaCheckbox].forEach((el) => {
  el.addEventListener('change', saveSettings);
});

// Load settings on init
document.addEventListener('DOMContentLoaded', loadSettings);

// --- KEYBOARD TESTER LOGIC ---

function updateKeyIndicators(e) {
  // Prevent default key behaviors (like F5 reload or Ctrl+S) inside the options page 
  // ONLY if they are modifier events, to let user test them cleanly.
  if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
    e.preventDefault();
  }

  // Toggle active class depending on key states
  if (e.shiftKey) keyShift.classList.add('active');
  else keyShift.classList.remove('active');

  if (e.ctrlKey) keyCtrl.classList.add('active');
  else keyCtrl.classList.remove('active');

  if (e.altKey) keyAlt.classList.add('active');
  else keyAlt.classList.remove('active');

  if (e.metaKey) keyMeta.classList.add('active');
  else keyMeta.classList.remove('active');
}

function clearIndicators() {
  keyShift.classList.remove('active');
  keyCtrl.classList.remove('active');
  keyAlt.classList.remove('active');
  keyMeta.classList.remove('active');
}

// Add event listeners for key tracking in this tab
window.addEventListener('keydown', updateKeyIndicators);
window.addEventListener('keyup', updateKeyIndicators);

// Reset when window loses focus to prevent key states getting stuck active
window.addEventListener('blur', clearIndicators);
window.addEventListener('focus', clearIndicators);
