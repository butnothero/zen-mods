// ==UserScript==
// @name           Folder State Persistence
// @description    Restores Zen folder expansion without saving startup collapses.
// @include        main
// ==/UserScript==

(() => {
  "use strict";

  const VERSION = "0.3.0";
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

  function findFolderInEvent(event) {
    const path = event.composedPath?.() || [];
    return path.find(node => node?.isZenFolder && node.id) || null;
  }

  function isFolderToggle(event, group) {
    // Ignore clicks on tabs *inside* a folder. Only the folder's heading
    // is an explicit request to expand/collapse it.
    const path = event.composedPath?.() || [];
    const index = path.indexOf(group);
    return index >= 0 && path.slice(0, index).some(node =>
      node?.classList?.contains("tab-group-label-container") ||
      node?.classList?.contains("tab-group-label") ||
      node?.localName === "tab-group-label"
    );
  }

  function recordState(group) {
    if (!group?.isZenFolder || group.isLiveFolder || !group.id) {
      return;
    }
    const collapsed = !!group.collapsed;
    if (state[group.id] !== collapsed) {
      state[group.id] = collapsed;
      scheduleSave();
      console.info(PREFIX, "saved", group.label || group.id, collapsed);
    }
    manualOverrides.add(group.id);
  }

  function markInteraction(event) {
    const group = findFolderInEvent(event);
    if (!group || !isFolderToggle(event, group)) {
      return;
    }
    recentActions.set(group.id, Date.now());
    // A browser's toggle handler may run after our capture handler;
    // sample the final property after it has handled the input.
    for (const delay of [0, 80, 300, 700]) {
      setTimeout(() => {
        if (group.isConnected) {
          recordState(group);
        }
      }, delay);
    }
  }

  function onGroupChange(event) {
    const group = event.target;
    if (!group?.isZenFolder || group.isLiveFolder || !group.id) {
      return;
    }
    // Ignore automatic session restoration events, but capture updates
    // caused by an explicit folder-heading click/keyboard action.
    const lastInput = recentActions.get(group.id) || 0;
    if (Date.now() - lastInput < USER_ACTION_WINDOW_MS) {
      setTimeout(() => recordState(group), 0);
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
  document.addEventListener("click", markInteraction, true);
  document.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      markInteraction(event);
    }
  }, true);
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
