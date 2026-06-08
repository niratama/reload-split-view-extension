/**
 * Background Service Worker for Split View Sync Reload Extension.
 * Coordinates synced reloads, prevents infinite loops, and checks modifier keys.
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  modifiers: {
    shift: true,  // Shift skips synced reload by default
    ctrl: false,
    alt: false,
    meta: false
  }
};

// Helper to get settings from sync storage
function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['enabled', 'modifiers'], (items) => {
      resolve({
        enabled: items.enabled !== undefined ? items.enabled : DEFAULT_SETTINGS.enabled,
        modifiers: {
          shift: items.modifiers?.shift !== undefined ? items.modifiers.shift : DEFAULT_SETTINGS.modifiers.shift,
          ctrl: items.modifiers?.ctrl !== undefined ? items.modifiers.ctrl : DEFAULT_SETTINGS.modifiers.ctrl,
          alt: items.modifiers?.alt !== undefined ? items.modifiers.alt : DEFAULT_SETTINGS.modifiers.alt,
          meta: items.modifiers?.meta !== undefined ? items.modifiers.meta : DEFAULT_SETTINGS.modifiers.meta
        }
      });
    });
  });
}

// Listen for modifier state messages from content scripts
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'MODIFIER_STATE' && sender.tab && sender.tab.id) {
    const tabId = sender.tab.id;
    const stateKey = `modifiers_${tabId}`;
    chrome.storage.session.set({ [stateKey]: message.state }).catch(() => {});
  }
});

// Clean up tab states from session storage when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  const modKey = `modifiers_${tabId}`;
  const reloadKey = `reload_${tabId}`;
  chrome.storage.session.remove([modKey, reloadKey]).catch(() => {});
});

// Listen to navigation events
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only monitor the main frame navigation
  if (details.frameId !== 0) return;

  const triggeredTabId = details.tabId;
  const reloadKey = `reload_${triggeredTabId}`;

  try {
    // 1. Check if this is an extension-initiated reload (loop prevention)
    const sessionData = await chrome.storage.session.get(reloadKey);
    if (sessionData[reloadKey]) {
      // Loop prevention triggered. Consume the flag and bypass further syncing.
      await chrome.storage.session.remove(reloadKey);
      console.log(`[Bypass] Intercepted synced reload for tab ${triggeredTabId} to prevent infinite loop.`);
      return;
    }

    // 2. Fetch current settings
    const settings = await getSettings();
    if (!settings.enabled) return;

    // 3. Check if any configured modifier keys are pressed in the current tab
    const modKey = `modifiers_${triggeredTabId}`;
    const modData = await chrome.storage.session.get(modKey);
    const activeModifiers = modData[modKey];

    if (activeModifiers) {
      let shouldBypass = false;
      for (const [key, isConfigured] of Object.entries(settings.modifiers)) {
        if (isConfigured && activeModifiers[key]) {
          console.log(`[Bypass] Synced reload bypassed due to modifier: ${key}`);
          shouldBypass = true;
          break;
        }
      }
      if (shouldBypass) {
        return;
      }
    }

    // 4. Retrieve the tab and check splitViewId
    chrome.tabs.get(triggeredTabId, (currentTab) => {
      if (chrome.runtime.lastError || !currentTab) {
        return;
      }

      // Check if tab is part of a split view (splitViewId is defined and not -1 / 'none')
      const hasSplitView = currentTab.splitViewId !== undefined && 
                           currentTab.splitViewId !== -1 && 
                           currentTab.splitViewId !== 'none';

      if (hasSplitView) {
        const targetSplitViewId = currentTab.splitViewId;

        // Query all tabs in the current window to find the split view partner
        chrome.tabs.query({ currentWindow: true }, (allTabs) => {
          allTabs.forEach(async (tab) => {
            if (tab.splitViewId === targetSplitViewId && tab.id !== triggeredTabId) {
              console.log(`[Sync] Reloading peer tab ${tab.id} in split view ${targetSplitViewId}.`);
              
              // Set the reload flag for the peer tab so its onBeforeNavigate listener will bypass it
              const peerReloadKey = `reload_${tab.id}`;
              await chrome.storage.session.set({ [peerReloadKey]: true });

              // Perform the reload
              chrome.tabs.reload(tab.id);
            }
          });
        });
      }
    });
  } catch (error) {
    console.error('[Error] Exception in onBeforeNavigate:', error);
  }
});
