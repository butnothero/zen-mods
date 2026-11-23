// ==UserScript==
// @name           Folder State Persistence
// @description    Preserve collapsed folders and visible active tabs, including split-view references.
// @include        main
// ==/UserScript==

(() => {
  "use strict";
  const PREFIX = "[Folder State Persistence]";
  const VERSION = "0.4.0";
  const PREF = "extensions.zenmods.folder-state-persistence.v2";
  const OLD_PREF = "extensions.zenmods.folder-state-persistence.v1";
  const RESTORE_DELAYS = [2000, 4500, 8000, 13000];
  const WATCH_INTERVAL = 1500;
  const SAVE_DEBOUNCE = 250;

  if (window.__zenFolderStatePersistence) return;
  window.__zenFolderStatePersistence = true;

  const services = typeof Services !== "undefined" ? Services : window.Services;
  if (!services) {
    console.error(PREFIX, "Services not available");
    return;
  }

  function decode(pref) {
    try {
      const raw = JSON.parse(services.prefs.getStringPref(pref, "{}"));
      return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    } catch (err) {
      console.warn(PREFIX, "Invalid stored state:", pref, err);
      return {};
    }
  }

  // Unlike v0.3, storage includes the identities of visible tabs, not merely
  // whether a folder is collapsed. v1 is only used as a migration fallback.
  let stored = decode(PREF);
  const legacy = decode(OLD_PREF);
  const initialized = new Set();
  const manualOverrides = new Set();
  let restoration = true;
  let saveTimer = null;
  let lastJSON = JSON.stringify(stored);

  function groups() {
    return [...(window.gBrowser?.tabGroups || [])].filter(
      g => g?.isZenFolder && !g.isLiveFolder && g.id
    );
  }

  function validState(value) {
    return value && typeof value === "object" &&
      typeof value.collapsed === "boolean" && Array.isArray(value.activeTabIds);
  }

  function snapshot(group) {
    const tabs = (group.activeTabs || []).filter(tab => tab?.id);
    return {
      collapsed: !!group.collapsed,
      activeTabIds: tabs.map(tab => tab.id),
      // Informational, used to validate split membership at restoration.
      splitViewGroups: [...new Map(tabs.filter(tab =>
        tab.group?.hasAttribute("split-view-group")
      ).map(tab => [tab.group.id, {
        id: tab.group.id,
        tabIds: (tab.group.tabs || []).map(member => member.id).filter(Boolean)
      }])).values()]
    };
  }

  function save() {
    saveTimer = null;
    const json = JSON.stringify(stored);
    if (json === lastJSON) return;
    try {
      services.prefs.setStringPref(PREF, json);
      lastJSON = json;
    } catch (err) {
      console.error(PREFIX, "Save failed", err);
    }
  }

  function scheduleSave() {
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(save, SAVE_DEBOUNCE);
  }

  // Watch current real state (not the requested collapsed state) so that
  // ordinary tab selections and split-view activation are also captured.
  function capture() {
    if (restoration) return;
    let changed = false;
    for (const group of groups()) {
      const next = snapshot(group);
      if (JSON.stringify(stored[group.id]) !== JSON.stringify(next)) {
        stored[group.id] = next;
        changed = true;
      }
    }
    if (changed) scheduleSave();
  }

  function lookupTab(id) {
    return window.gBrowser?.tabs?.find(tab => tab.id === id && tab.isConnected);
  }

  function restoreGroup(group) {
    if (manualOverrides.has(group.id)) return;
    const desired = stored[group.id];
    if (!validState(desired)) return;
    const tabs = desired.activeTabIds.map(lookupTab).filter(Boolean);
    // Do not touch a group while its tabs are still restoring. In particular
    // never recreate or move a split-view group.
    if (tabs.length !== desired.activeTabIds.length) return;
    if (!tabs.every(tab => group.tabs.includes(tab))) return;

    // Restore the normal expansion state. The active-tab display remains
    // a separate concern; a collapsed folder can still have visible tabs.
    if (group.collapsed !== desired.collapsed) {
      group.collapsed = desired.collapsed;
    }
    if (!desired.collapsed || !tabs.length) return;

    // Avoid reprocessing groups already showing the requested tabs.
    const current = (group.activeTabs || []).map(tab => tab.id);
    if (group.hasAttribute("has-active") &&
        current.length === tabs.length &&
        current.every(id => desired.activeTabIds.includes(id))) return;

    // Zen's animateSelect reads folder-active for ordinary tabs, and the
    // selected state for split-view descendants. Only tag tabs that are
    // still in this folder; do not modify split-view membership.
    for (const tab of tabs) {
      if (!tab.group?.hasAttribute("split-view-group")) {
        tab.setAttribute("folder-active", "true");
      }
    }
    const manager = window.gZenFolders;
    if (typeof manager?.animateSelect === "function") {
      Promise.resolve()
        .then(() => manager.animateSelect(group))
        .catch(err => console.warn(PREFIX, "Zen could not restore active tabs in", group.label, err));
    } else {
      console.warn(PREFIX, "Zen animateSelect unavailable");
    }
  }

  function restore() {
    for (const group of groups()) {
      if (validState(stored[group.id])) {
        try {
          restoreGroup(group);
        } catch (err) {
          console.warn(PREFIX, "Restore failed for", group.label, err);
        }
      }
    }
  }

  function markManual(event) {
    const path = event.composedPath?.() || [];
    const folder = path.find(node => node?.isZenFolder && node.id);
    if (!folder || !path.some(node =>
      node?.classList?.contains("tab-group-label-container"))) return;
    manualOverrides.add(folder.id);
  }
  document.addEventListener("click", markManual, true);

  function start() {
    // On first install, take a baseline from the current session. This
    // deliberately avoids using v1's collapsed-only data to force groups.
    if (!Object.values(stored).some(validState)) {
      for (const group of groups()) {
        stored[group.id] = snapshot(group);
      }
      scheduleSave();
      console.info(PREFIX, "Created initial snapshot; restart once to test restoration");
    } else {
      for (const delay of RESTORE_DELAYS) setTimeout(restore, delay);
    }
    setTimeout(() => {
      restoration = false;
      capture();
      console.info(PREFIX, VERSION, "ready:", groups().length, "folders; saved:", Object.keys(stored).length);
    }, RESTORE_DELAYS.at(-1) + 700);
    window.setInterval(capture, WATCH_INTERVAL);
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
  window.addEventListener("unload", () => {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      save();
    }
  }, { once: true });
  console.info(PREFIX, VERSION, "loaded");
})();
