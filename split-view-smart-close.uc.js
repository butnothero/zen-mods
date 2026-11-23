// ==UserScript==
// @name           Split View Smart Close
// @description    One close button on inactive Split View; per-tab close on active Split View.
// @include        main
// ==/UserScript==

(() => {
  "use strict";

  const PREFIX = "[Split View Smart Close]";
  const STYLE_ID = "zen-split-smart-close-style";
  const CLASS = "zen-split-smart-close";
  const ACTIVE = "data-zen-split-smart-active";

  if (window.__zenSplitSmartClose) return;
  window.__zenSplitSmartClose = true;

  function findGroups() {
    return [...document.querySelectorAll('tab-group[split-view-group]')];
  }

  function tabsIn(group) {
    return [...(group.tabs || [])].filter(tab => tab?.localName === "tab");
  }

  function active(group) {
    // Check membership of the actually selected browser tab, not hover and
    // not selected tabs belonging to a different workspace.
    return window.gBrowser?.selectedTab?.group === group;
  }

  function closeGroup(group) {
    if (active(group)) return;
    const tabs = tabsIn(group);
    for (const tab of tabs) {
      if (!tab.isConnected || tab.closing) continue;
      try {
        window.gBrowser.removeTab(tab, { animate: false });
      } catch (error) {
        console.error(PREFIX, "Failed closing tab", error);
      }
    }
  }

  function addButton(group) {
    if ([...group.children].some(el => el.classList?.contains(CLASS))) return;
    const button = document.createXULElement("toolbarbutton");
    button.classList.add(CLASS);
    button.setAttribute("label", "×");
    button.setAttribute("tooltiptext", "Закрыть все вкладки Split View");
    button.setAttribute("aria-label", "Закрыть все вкладки Split View");

    // Keep the click from selecting either tab or expanding the folder.
    for (const type of ["pointerdown", "mousedown", "mouseup", "dblclick"]) {
      button.addEventListener(type, event => event.stopPropagation());
    }
    button.addEventListener("click", event => {
      event.stopPropagation();
      event.preventDefault();
      if (event.button === 0) closeGroup(group);
    });
    button.addEventListener("command", event => {
      event.preventDefault();
      event.stopPropagation();
    });
    group.appendChild(button);
  }

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      'tab-group[split-view-group] { position: relative; }',
      'tab-group[split-view-group]:not([' + ACTIVE + '="true"]) .tab-close-button {',
      '  visibility: hidden !important; pointer-events: none !important;',
      '}',
      'tab-group[split-view-group] > .' + CLASS + ' {',
      '  -moz-appearance: none !important; appearance: none !important;',
      '  display: flex !important; align-items: center; justify-content: center;',
      '  position: absolute !important; inset-inline-end: 3px; top: 50%;',
      '  transform: translateY(-50%); z-index: 30;',
      '  box-sizing: border-box; width: 22px; min-width: 22px; height: 22px;',
      '  padding: 0 !important; margin: 0 !important;',
      '  background: transparent; border: none; border-radius: 4px;',
      '  color: inherit; font-size: 18px; line-height: 1;',
      '  opacity: 0; visibility: hidden; pointer-events: none;',
      '}',
      'tab-group[split-view-group]:not([' + ACTIVE + '="true"]):hover > .' + CLASS + ',',
      'tab-group[split-view-group]:not([' + ACTIVE + '="true"]) > .' + CLASS + ':focus-visible {',
      '  opacity: 1; visibility: visible; pointer-events: auto;',
      '}',
      'tab-group[split-view-group] > .' + CLASS + ':hover {',
      '  background: var(--toolbarbutton-hover-background, rgba(128,128,128,.2));',
      '}',
      'tab-group[split-view-group][' + ACTIVE + '="true"] > .' + CLASS + ' {',
      '  display: none !important;',
      '}'
    ].join("\n");
    document.documentElement.appendChild(style);
  }

  let scheduled = false;
  function update() {
    scheduled = false;
    try {
      addStyles();
      for (const group of findGroups()) {
        group.setAttribute(ACTIVE, String(active(group)));
        addButton(group);
      }
    } catch (error) {
      console.error(PREFIX, "Update failed", error);
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(update);
  }

  function start() {
    const container = document.getElementById("tabbrowser-tabs");
    if (!container) {
      console.warn(PREFIX, "Tab container not found");
      return;
    }
    const observer = new MutationObserver(records => {
      if (records.some(record => record.type === "attributes" ||
        [...record.addedNodes, ...record.removedNodes].some(
          node => node.localName === "tab" || node.localName === "tab-group"
        ))) schedule();
    });
    observer.observe(container, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["selected", "split-view-group"]
    });
    for (const event of ["TabSelect", "TabOpen", "TabClose", "TabGroupCreate", "TabGroupRemove"]) {
      window.addEventListener(event, schedule, true);
    }
    update();
    console.info(PREFIX, "0.1.0 loaded");
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
