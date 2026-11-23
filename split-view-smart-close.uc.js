// ==UserScript==
// @name           Split View Smart Close
// @description    One native close icon for inactive Split Views, per-tab icons when active.
// @include        main
// ==/UserScript==

(() => {
  "use strict";

  const PREFIX = "[Split View Smart Close]";
  const STYLE_ID = "zen-split-smart-close-style";
  const INACTIVE = "data-zen-smart-close-inactive";
  const LAST = "data-zen-smart-close-last";

  if (window.__zenSplitSmartClose) return;
  window.__zenSplitSmartClose = true;

  const groups = () =>
    [...document.querySelectorAll('tab-group[split-view-group]')];

  const tabs = group =>
    [...(group?.tabs || [])].filter(tab => tab?.localName === "tab");

  function isActive(group) {
    if (!group?.isConnected) return false;
    return group.hasAttribute("hasactivetab") ||
      window.gBrowser?.selectedTab?.group === group ||
      tabs(group).some(tab => tab.selected);
  }

  function installCSS() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      // Zen uses visibility: visible !important, so override with matching
      // specificity; no extra XUL children and no absolute overlay.
      '#tabbrowser-tabs tab-group[split-view-group][' + INACTIVE + '="true"] .tab-group-container > .tabbrowser-tab:not([' + LAST + ']) .tab-close-button {',
      '  visibility: hidden !important; pointer-events: none !important;',
      '}',
      '#tabbrowser-tabs tab-group[split-view-group][' + INACTIVE + '="true"] .tab-group-container > .tabbrowser-tab[' + LAST + '] .tab-close-button {',
      '  display: block !important; visibility: hidden !important;',
      '  pointer-events: none !important;',
      '}',
      '#tabbrowser-tabs tab-group[split-view-group][' + INACTIVE + '="true"]:hover .tab-group-container > .tabbrowser-tab[' + LAST + '] .tab-close-button {',
      '  visibility: visible !important; pointer-events: auto !important;',
      '}'
    ].join("\n");
    document.documentElement.appendChild(style);
  }

  function updateGroups() {
    for (const group of groups()) {
      const members = tabs(group);
      const inactive = !isActive(group);
      if (group.getAttribute(INACTIVE) !== String(inactive)) {
        group.setAttribute(INACTIVE, String(inactive));
      }
      const last = members.at(-1);
      for (const tab of members) {
        if (tab === last && !tab.hasAttribute(LAST)) {
          tab.setAttribute(LAST, "");
        } else if (tab !== last && tab.hasAttribute(LAST)) {
          tab.removeAttribute(LAST);
        }
      }
    }
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      updateGroups();
    });
  }

  function resolveClose(event) {
    const path = event.composedPath?.() || [];
    const button = path.find(node =>
      node?.classList?.contains("tab-close-button"));
    if (!button) return null;

    const tab = path.find(node => node?.localName === "tab");
    if (!tab?.hasAttribute(LAST)) return null;
    const group = tab.group;
    if (!group?.hasAttribute("split-view-group") || isActive(group)) return null;
    return group;
  }

  function closeAll(group) {
    const members = tabs(group);
    // Closing the first tab can dissolve its split-view group; take a copy.
    for (const tab of members) {
      if (!tab.isConnected || tab.closing) continue;
      try {
        window.gBrowser.removeTab(tab, { animate: false });
      } catch (error) {
        console.error(PREFIX, "Could not close tab", error);
      }
    }
  }

  function interceptClose(event) {
    if (event.type === "click" && event.button !== 0) return;
    const group = resolveClose(event);
    if (!group) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    // The native button may fire both click and command. After closing tabs
    // its DOM is detached, so a subsequent event cannot close anything else.
    closeAll(group);
  }

  function start() {
    const container = document.getElementById("tabbrowser-tabs");
    if (!container) {
      console.warn(PREFIX, "Tab container unavailable");
      return;
    }
    installCSS();

    // Capture before the standard tab close handler, keeping the browser's
    // built-in close icon and its original tab layout.
    container.addEventListener("click", interceptClose, true);
    container.addEventListener("command", interceptClose, true);

    for (const name of ["TabSelect", "TabOpen", "TabClose", "TabGroupCreate", "TabGroupRemove"]) {
      window.addEventListener(name, schedule, true);
    }
    const observer = new MutationObserver(schedule);
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hasactivetab", "selected", "split-view-group"]
    });
    updateGroups();
    console.info(PREFIX, "0.3.0 loaded");
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();