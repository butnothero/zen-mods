// ==UserScript==
// @name           Folder State Persistence
// @description    Restores Zen folder expansion without saving startup collapses.
// @include        main
// ==/UserScript==

(() => {
  "use strict";

  const VERSION = "0.2.0";
  const PREF = "extensions.zenmods.folder-state-persistence.v1";
  const RESTORE_AT_MS = [0, 250, 1000, 2500, 5000, 9000, 15000];
  const USER_ACTION_WINDOW_MS = 2500;
  const STORAGE_DELAY_MS = 100;
  const PREFIX = "[Folder State Persistence]";

  if (window.__zenFolderStatePersistence) {
    return;
  }
  window.__zenFolderStatePersistence = true;

  // Services is a browser-chrome global. Some script loaders do not expose
  // it as an own property of window; avoid the old window.Services guard.
  const services = typeof Services !== "undefined" ? Services : window.Services;
  if (!services) {
    console.error(PREFIX, "Services unavailable; check Sine JS injection");
    return;
  }

  let state = {};
  try {
    const saved = JSON.parse(services.prefs.getStringPref(PREF, "{}"));
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      state = saved;
    }
  } catch (error) {
    console.warn(PREFIX, "Cannot parse saved folder state", error);
  }

  const recentActions = new Map();
  const manualOverrides = new Set();
  const timers = [];
  let restoring = true;
  let writeTimer = null;

  function folders() {
    try {
      return [...(window.gBrowser?.tabGroups || [])].filter(
        group => group?.isZenFolder && !group.isLiveFolder && !!group.id
      );
    } catch (_) {
      return [];
    }
  }

  function saveNow() {
    writeTimer = null;
    try {
      services.prefs.setStringPref(PREF, JSON.stringify(state));
    } catch (error) {
      console.error(PREFIX, "Cannot save folder state", error);
    }
  }

  function scheduleSave() {
    if (writeTimer !== null) {
      clearTimeout(writeTimer);
    }
    writeTimer = setTimeout(saveNow, STORAGE_DELAY_MS);
  }

  function markInteraction(event) {
    const target = event.target;
    if (!target?.closest) {
      return;
    }
    const folder = target.closest("tab-group");
    if (folder?.isZenFolder && folder.id) {
      recentActions.set(folder.id, Date.now());
    }
  }

  function recordState(group) {
    if (!group?.isZenFolder || group.isLiveFolder || !group.id) {
      return;
    }
    state[group.id] = !!group.collapsed;
    manualOverrides.add(group.id);
    scheduleSave();
  }

  function onGroupChange(event) {
    const group = event.target;
    if (!group?.isZenFolder || group.isLiveFolder || !group.id) {
      return;
    }
    // Zen fires these same events during session restore. During that phase
    // only record changes following a real UI interaction.
    const lastInput = recentActions.get(group.id) || 0;
    if (Date.now() - lastInput < USER_ACTION_WINDOW_MS) {
      recordState(group);
    }
  }

  function restorePass() {
    for (const folder of folders()) {
      if (manualOverrides.has(folder.id)) {
        continue;
      }
      const desired = state[folder.id];
      if (typeof desired === "boolean" && folder.collapsed !== desired) {
        folder.collapsed = desired;
      }
    }
  }

  function finishRestore() {
    restoring = false;
    // Do not overwrite previously saved values with startup state.
    // Only initialize never-seen folders; existing entries are user-owned.
    let changed = false;
    for (const folder of folders()) {
      if (!Object.hasOwn(state, folder.id)) {
        state[folder.id] = !!folder.collapsed;
        changed = true;
      }
    }
    if (changed) {
      scheduleSave();
    }
    console.info(PREFIX, VERSION, "active; saved folder states:", Object.keys(state).length);
  }

  function begin() {
    for (const [index, delay] of RESTORE_AT_MS.entries()) {
      timers.push(setTimeout(() => {
        restorePass();
        if (index === RESTORE_AT_MS.length - 1) {
          finishRestore();
        }
      }, delay));
    }
  }

  // Retain last explicit UI state even during startup. Only observe actual
  // folder toggles, not window shutdown or removal of tab group DOM nodes.
  document.addEventListener("pointerdown", markInteraction, true);
  document.addEventListener("keydown", markInteraction, true);
  window.addEventListener("TabGroupExpand", onGroupChange, true);
  window.addEventListener("TabGroupCollapse", onGroupChange, true);

  // Persist pending user changes before quitting; never snapshot all groups
  // during unload because Zen may already have collapsed them.
  window.addEventListener("unload", () => {
    for (const timer of timers) {
      clearTimeout(timer);
    }
    if (writeTimer !== null) {
      clearTimeout(writeTimer);
      saveNow();
    }
  }, { once: true });

  // Begin immediately: folder groups may arrive after delayed startup.
  // Subsequent passes cover late session restoration and workspace setup.
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", begin, { once: true });
  } else {
    begin();
  }
  console.info(PREFIX, VERSION, "loaded");
})();
