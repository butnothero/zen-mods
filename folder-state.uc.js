// ==UserScript==
// @name           Folder State Persistence
// @description    Remembers Zen folder collapsed states across restarts.
// @include        main
// ==/UserScript==

(() => {
  "use strict";

  const PREF = "extensions.zenmods.folder-state-persistence.v1";
  const RESTORE_DELAYS = [0, 1000, 3000];
  const STARTUP_TIMEOUT_MS = 20000;
  const SAVE_DELAY_MS = 150;

  // This script runs with browser-chrome privileges. It intentionally
  // touches only Zen tab groups, not tabs or session data.
  if (!window.gBrowser || !window.Services || window.__zenFolderStatePersistence) {
    return;
  }
  window.__zenFolderStatePersistence = true;

  let ready = false;
  let saveTimer = null;
  let stored = readState();

  function readState() {
    try {
      const value = JSON.parse(Services.prefs.getStringPref(PREF, "{}"));
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return value;
      }
    } catch (error) {
      console.warn("[Folder State Persistence] Invalid saved state", error);
    }
    return {};
  }

  function folders() {
    return [...(gBrowser.tabGroups || [])].filter(
      group => group?.isZenFolder && !group.isLiveFolder && !!group.id
    );
  }

  function restore() {
    for (const group of folders()) {
      if (typeof stored[group.id] !== "boolean") {
        continue;
      }
      if (group.collapsed !== stored[group.id]) {
        group.collapsed = stored[group.id];
      }
    }
  }

  function persist() {
    saveTimer = null;
    if (!ready) {
      return;
    }
    const next = { ...stored };
    for (const group of folders()) {
      next[group.id] = !!group.collapsed;
    }
    stored = next;
    try {
      Services.prefs.setStringPref(PREF, JSON.stringify(stored));
    } catch (error) {
      console.error("[Folder State Persistence] Failed to save state", error);
    }
  }

  function queueSave(event) {
    if (!ready) {
      return;
    }
    if (event && !event.target?.isZenFolder) {
      return;
    }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, SAVE_DELAY_MS);
  }

  function begin() {
    if (ready) {
      return;
    }
    // Zen can initialize and then rearrange restored folders asynchronously.
    // Keep writes disabled until the final restore pass, otherwise the initial
    // all-collapsed state would overwrite the preferences from the last run.
    RESTORE_DELAYS.forEach((delay, index) => {
      setTimeout(() => {
        restore();
        if (index === RESTORE_DELAYS.length - 1) {
          ready = true;
          queueSave();
        }
      }, delay);
    });
  }

  window.addEventListener("TabGroupExpand", queueSave, true);
  window.addEventListener("TabGroupCollapse", queueSave, true);
  window.addEventListener("TabGroupCreate", queueSave, true);
  window.addEventListener("TabGroupRemoved", queueSave, true);

  window.addEventListener(
    "unload",
    () => {
      if (saveTimer !== null) {
        clearTimeout(saveTimer);
      }
      persist();
    },
    { once: true }
  );

  // Sine scripts may execute before Firefox finishes restoring the session.
  if (window.gBrowserInit?.delayedStartupFinished) {
    begin();
  } else {
    const observer = (subject, topic) => {
      if (topic !== "browser-delayed-startup-finished" || subject !== window) {
        return;
      }
      Services.obs.removeObserver(observer, "browser-delayed-startup-finished");
      clearTimeout(fallback);
      begin();
    };
    Services.obs.addObserver(observer, "browser-delayed-startup-finished");
    const fallback = setTimeout(() => {
      Services.obs.removeObserver(observer, "browser-delayed-startup-finished");
      begin();
    }, STARTUP_TIMEOUT_MS);
  }
})();
