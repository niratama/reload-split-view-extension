/**
 * Popup page script for Split View Sync Reload Extension.
 * Queries current tab splitViewId and updates UI state dynamically.
 */

document.addEventListener('DOMContentLoaded', () => {
  const extensionToggle = document.getElementById('extension-toggle');
  const btnOptions = document.getElementById('btn-options');
  const splitStateBox = document.getElementById('split-state-box');
  const stateIcon = document.getElementById('state-icon');
  const stateText = document.getElementById('state-text');
  const stateSubtext = document.getElementById('state-subtext');

  // 1. Open settings page when clicking cog icon
  btnOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // 2. Load and bind enabled toggle
  chrome.storage.sync.get('enabled', (items) => {
    extensionToggle.checked = items.enabled !== false; // default to true
  });

  extensionToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ enabled: extensionToggle.checked });
  });

  // 3. Inspect active tab and update Split View status
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError || !tabs || tabs.length === 0) {
      updateUIStatus(false, '取得失敗', '現在のタブ情報を取得できません');
      return;
    }

    const currentTab = tabs[0];
    const splitViewId = currentTab.splitViewId;

    // Check splitViewId (undefined, -1, 'none' are considered single view)
    const isInSplitView = splitViewId !== undefined && 
                          splitViewId !== -1 && 
                          splitViewId !== 'none';

    if (isInSplitView) {
      updateUIStatus(true, '分割ビュー連動中', `共通ID: ${splitViewId}`);
    } else {
      updateUIStatus(false, '通常表示 (非連動)', '分割ビューではありません');
    }
  });

  function updateUIStatus(isActive, text, subtext) {
    if (isActive) {
      splitStateBox.className = 'state-box active';
      stateIcon.textContent = '🔗';
      stateText.textContent = text;
      stateSubtext.textContent = subtext;
    } else {
      splitStateBox.className = 'state-box inactive';
      stateIcon.textContent = '⏸️';
      stateText.textContent = text;
      stateSubtext.textContent = subtext;
    }
  }
});
