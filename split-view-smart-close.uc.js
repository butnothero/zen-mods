// ==UserScript==
// @name           Split View Smart Close
// @description    One close control for inactive Split View without affecting tab layout.
// @include        main
// ==/UserScript==

(() => {
  "use strict";
  const PREFIX = "[Split View Smart Close]";
  const STYLE_ID = "zen-split-smart-close-style";
  const BUTTON_ID = "zen-split-smart-close-overlay";
  const INACTIVE = "data-zen-smart-close-inactive";
  if (window.__zenSplitSmartClose) return;
  window.__zenSplitSmartClose = true;

  let hovered = null;
  let button = null;
  let scheduled = false;

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

  function hide() {
    button?.style.setProperty("display", "none", "important");
  }

  function closeAll(group) {
    if (!group?.isConnected || isActive(group)) return;
    const members = tabs(group);
    hovered = null;
    hide();
    // Snapshot before closing: Zen can dissolve a split group mid-operation.
    for (const tab of members) {
      if (!tab.isConnected || tab.closing) continue;
      try {
        window.gBrowser.removeTab(tab, { animate: false });
      } catch (error) {
        console.error(PREFIX, "Failed to close tab", error);
      }
    }
  }

  function injectCSS() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      /* Zen sets visibility: visible !important on tab-close-button hover.
         Higher specificity and display:none override that native rule. */
      '#tabbrowser-tabs tab-group[split-view-group][' + INACTIVE + '="true"] > .tab-group-container > .tabbrowser-tab .tab-close-button {',
      '  display: none !important; visibility: hidden !important;',
      '  pointer-events: none !important;',
      '}',
      '#' + BUTTON_ID + ' {',
      '  appearance: none !important; -moz-appearance: none !important;',
      '  position: fixed !important; z-index: 2147483647 !important;',
      '  display: none; align-items: center; justify-content: center;',
      '  box-sizing: border-box; width: 24px !important;',
      '  min-width: 24px !important; height: 24px !important;',
      '  min-height: 24px !important; padding: 0 !important;',
      '  margin: 0 !important; border: 0 !important;',
      '  border-radius: 5px !important; font-size: 18px !important;',
      '  line-height: 1 !important; color: inherit !important;',
      '  background: var(--toolbarbutton-hover-background, rgba(120,120,120,.20)) !important;',
      '  cursor: pointer;',
      '}',
      '#' + BUTTON_ID + ':hover {',
      '  background: var(--toolbarbutton-active-background, rgba(120,120,120,.35)) !important;',
      '}'
    ].join("\n");
    document.documentElement.appendChild(style);
  }

  function addOverlay() {
    if (button?.isConnected) return;
    button = document.createXULElement("toolbarbutton");
    button.id = BUTTON_ID;
    button.setAttribute("label", "×");
    button.setAttribute("tooltiptext", "Закрыть все вкладки Split View");
    button.setAttribute("aria-label", "Закрыть все вкладки Split View");
    // Never append children to tab-group: that changes Zen's flex layout
    // and can trigger a move/reflow while clicking split-view tabs.
    document.documentElement.appendChild(button);

    for (const name of ["pointerdown", "mousedown", "mouseup", "dblclick", "command"]) {
      button.addEventListener(name, event => {
        event.preventDefault();
        event.stopPropagation();
      }, true);
    }
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      if (event.button === 0) closeAll(hovered);
    }, true);
  }

  function position(group) {
    const content = group.querySelector(":scope > .tab-group-container") || group;
    const rect = content.getBoundingClientRect();
    if (rect.width < 35 || rect.height < 18) {
      hide();
      return;
    }
    button.style.setProperty("left", Math.round(rect.right - 27) + "px", "important");
    button.style.setProperty("top", Math.round(rect.top + (rect.height - 24) / 2) + "px", "important");
    button.style.setProperty("display", "flex", "important");
  }

  function refresh() {
    scheduled = false;
    try {
      for (const group of groups()) {
        const next = String(!isActive(group));
        if (group.getAttribute(INACTIVE) !== next) {
          group.setAttribute(INACTIVE, next);
        }
      }
      if (!hovered?.isConnected || isActive(hovered) || !hovered.matches(":hover")) {
        hovered = null;
        hide();
      } else {
        position(hovered);
      }
    } catch (error) {
      console.error(PREFIX, "Refresh failed", error);
    }
  }

  function schedule() {
    if (!scheduled) {
      scheduled = true;
      window.requestAnimationFrame(refresh);
    }
  }

  function onPointerMove(event) {
    if (button?.contains(event.target)) return;
    const group = event.target?.closest?.('tab-group[split-view-group]');
    if (group && !isActive(group)) {
      hovered = group;
      position(group);
    } else {
      hovered = null;
      hide();
    }
  }

  function start() {
    const container = document.getElementById("tabbrowser-tabs");
    if (!container) {
      console.warn(PREFIX, "Tab container missing");
      return;
    }
    injectCSS();
    addOverlay();
    container.addEventListener("pointermove", onPointerMove, true);
    container.addEventListener("pointerleave", () => {
      hovered = null;
      hide();
    }, true);
    for (const event of ["TabSelect", "TabOpen", "TabClose", "TabGroupCreate", "TabGroupRemove"]) {
      window.addEventListener(event, schedule, true);
    }
    const observer = new MutationObserver(schedule);
    observer.observe(container, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["selected", "hasactivetab", "split-view-group"]
    });
    refresh();
    console.info(PREFIX, "0.2.0 loaded");
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();