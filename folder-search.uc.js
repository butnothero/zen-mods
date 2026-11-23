// ==UserScript==
// @name           Folder Search
// @description    Arc-like folder tab search without timestamps.
// @include        main
// ==/UserScript==

(() => {
  "use strict";
  const PREFIX = "[Folder Search]";
  const STYLE_ID = "zen-personal-folder-search-css";
  const POPUP_ID = "zen-folder-tabs-popup";
  const LIST_ID = "zen-folder-tabs-list";
  const INPUT_ID = "zen-personal-folder-search-input";
  const HEADER_ID = "zen-personal-folder-search-header";
  const HOVER_DELAY = 350;

  if (window.__zenPersonalFolderSearch) return;
  window.__zenPersonalFolderSearch = true;

  let hoveredFolder = null;
  let hoveredLabel = null;
  let hoverTimer = null;
  let expandedPopup = false;
  let expandedKeyHandler = null;
  let lastRenderedFolderId = null;

  const popup = () => document.getElementById(POPUP_ID);
  const list = () => document.getElementById(LIST_ID);
  const input = () => document.getElementById(INPUT_ID);

  function addSearchHeader() {
    const parentList = list()?.parentElement;
    if (!parentList || document.getElementById(HEADER_ID)) return;
    const header = document.createElement("div");
    header.id = HEADER_ID;
    const icon = document.createElement("img");
    icon.className = "zen-personal-folder-search-icon";
    icon.src = "chrome://global/skin/icons/search-glass.svg";
    const search = document.createElement("input");
    search.id = INPUT_ID;
    search.setAttribute("type", "search");
    search.setAttribute("autocomplete", "off");
    search.setAttribute("spellcheck", "false");
    search.setAttribute("aria-label", "Поиск вкладок в папке");
    search.setAttribute("placeholder", "Поиск вкладок...");
    search.addEventListener("input", applyFilter);
    search.addEventListener("keydown", event => {
      if (["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) {
        event.stopPropagation();
        const items = [...(list()?.children || [])].filter(item => item.classList.contains("folders-tabs-list-item") && !item.hidden);
        if (event.key === "Enter") {
          event.preventDefault();
          (items.find(item => item.hasAttribute("selected")) || items[0])?.click();
          return;
        }
        if (!items.length) return;
        event.preventDefault();
        let i = items.findIndex(item => item.hasAttribute("selected"));
        i = (i + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        for (const item of items) item.removeAttribute("selected");
        items[i].setAttribute("selected", "true");
        items[i].scrollIntoView({ block: "nearest" });
      }
    });
    header.append(icon, search);
    // A sibling of #zen-folder-tabs-list survives Zen\'s replaceChildren().
    parentList.insertBefore(header, list());
  }

  function clearHoverTimer() {
    if (hoverTimer !== null) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
  }

  function folderOfLabel(label) {
    const group = label?.closest?.("tab-group");
    return group?.isZenFolder && !group.isLiveFolder ? group : null;
  }

  function folderForPopup() {
    const panel = popup();
    const anchor = panel?.anchorNode || panel?.triggerNode;
    const fromAnchor = folderOfLabel(anchor);
    if (fromAnchor) return fromAnchor;

    const opened = document.querySelector(
      ".tab-group-label-container[open], .tab-group-label-container[open='true']"
    );
    return folderOfLabel(opened) || hoveredFolder;
  }

  function folderTabs(group) {
    // Preserve DOM order, including tabs belonging to a split-view group.
    return [...(group?.tabs || [])].filter(tab =>
      tab?.isConnected && tab.id && !tab.hasAttribute("zen-empty-tab")
    );
  }

  function createItem(tab, parentList) {
    const item = document.createElement("div");
    item.className = "folders-tabs-list-item zen-personal-folder-search-item";
    const content = document.createElement("div");
    content.className = "folders-tabs-list-item-content";
    const icon = document.createElement("img");
    icon.className = "folders-tabs-list-item-icon";
    icon.alt = "";
    try {
      icon.src = window.gBrowser?.getIcon(tab) ||
        "chrome://global/skin/icons/defaultFavicon.svg";
    } catch (_) {
      icon.src = "chrome://global/skin/icons/defaultFavicon.svg";
    }

    const labels = document.createElement("div");
    labels.className = "folders-tabs-list-item-labels";
    const title = document.createElement("div");
    title.className = "folders-tabs-list-item-label";
    title.textContent = tab.label || tab.getAttribute("label") || "Новая вкладка";
    labels.appendChild(title);
    content.append(icon, labels);
    item.appendChild(content);

    let host = "";
    try {
      host = new URL(tab.linkedBrowser?.currentURI?.spec || "").hostname;
    } catch (_) {}
    item.dataset.label = ((tab.label || "") + " " + host).toLocaleLowerCase();
    if (tab.selected) item.setAttribute("selected", "true");

    item.addEventListener("mouseenter", () => {
      for (const sibling of parentList.children) {
        sibling.removeAttribute("selected");
      }
      item.setAttribute("selected", "true");
    });
    item.addEventListener("click", () => {
      if (tab.isConnected) window.gBrowser.selectedTab = tab;
      popup()?.hidePopup();
    });
    return item;
  }

  function applyFilter() {
    const needle = (input()?.value || "").trim().toLocaleLowerCase();
    let visible = 0;
    for (const item of list()?.children || []) {
      if (item.id === HEADER_ID) continue;
      item.hidden = !item.dataset.label?.includes(needle);
      if (!item.hidden) visible++;
    }
    const noResults = document.getElementById("zen-folder-tabs-search-no-results");
    if (noResults) noResults.hidden = visible !== 0;
  }

  function render(group) {
    if (!group || !list()) return;
    const parentList = list();
    const fragment = document.createDocumentFragment();
    for (const tab of folderTabs(group)) {
      fragment.appendChild(createItem(tab, parentList));
    }
    parentList.replaceChildren(fragment);
    addSearchHeader();
    lastRenderedFolderId = group.id;
    applyFilter();
  }

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      '#zen-folder-tabs-popup > .tabs-list-header { display: none !important; }',
      '#zen-folder-tabs-popup #' + HEADER_ID + ' {',
      '  display: flex !important; visibility: visible !important; position: relative !important; z-index: 4 !important;',
      '  align-items: center !important; flex-direction: row !important;',
      '  min-height: 48px !important; flex-shrink: 0 !important; box-sizing: border-box !important;',
      '  padding: 8px 12px !important; gap: 9px !important;',
      '  background: var(--arrowpanel-background, var(--toolbar-bgcolor, #28282a)) !important;',
      '  border-bottom: 1px solid color-mix(in srgb, currentColor, transparent 88%) !important;',
      '}',
      '#zen-folder-tabs-popup #' + HEADER_ID + ' .zen-personal-folder-search-icon {',
      '  width: 16px !important; height: 16px !important; flex-shrink: 0 !important;',
      '  opacity: .6;',
      '}',
      '#zen-folder-tabs-popup #' + INPUT_ID + ' {',
      '  display: block !important; visibility: visible !important;',
      '  min-width: 0 !important; width: 100% !important; flex: 1 !important;',
      '  background: transparent !important; color: inherit !important;',
      '  border: none !important; outline: none !important;',
      '  font: inherit !important; padding: 4px 0 !important;',
      '}',
      '#zen-folder-tabs-popup .tab-list-item-secondary-label {',
      '  display: none !important;',
      '}',
      '#zen-folder-tabs-popup .zen-personal-folder-search-item {',
      '  min-height: 36px !important;',
      '}',
      '#zen-folder-tabs-popup .zen-personal-folder-search-item .folders-tabs-list-item-labels {',
      '  min-width: 0;',
      '}',
      '#zen-folder-tabs-popup .zen-personal-folder-search-item .folders-tabs-list-item-label {',
      '  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
      '}'
    ].join("\n");
    document.documentElement.appendChild(style);
  }

  function arrowNavigation(event) {
    if (!expandedPopup) return;
    const items = [...(list()?.children || [])].filter(item => item.classList.contains("folders-tabs-list-item") && !item.hidden);
    if (event.key === "Escape") {
      popup()?.hidePopup();
      return;
    }
    if (event.key === "Enter") {
      const target = items.find(item => item.hasAttribute("selected")) || items[0];
      if (target) {
        event.preventDefault();
        target.click();
      }
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (!items.length) return;
    event.preventDefault();
    let index = items.findIndex(item => item.hasAttribute("selected"));
    index = (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    for (const item of items) item.removeAttribute("selected");
    items[index].setAttribute("selected", "true");
    items[index].scrollIntoView({ block: "nearest" });
  }

  function showExpandedFolderSearch(group, label) {
    if (!group.isConnected || group.collapsed || !popup() || !folderTabs(group).length) return;
    // Expanded folders are ignored by Zen's built-in hover listener. Use
    // the same popup, list and search input instead of inserting another panel.
    const panel = popup();
    if (panel.state === "open" || panel.state === "showing") return;
    const search = input();
    if (search) {
      search.value = "";
      search.placeholder = "Поиск в " + (group.label || "папке") + "...";
    }
    hoveredFolder = group;
    expandedPopup = true;
    label.setAttribute("open", "true");
    render(group);
    if (input()) input().placeholder = "Поиск в " + (group.label || "папке") + "...";
    const right = window.gZenVerticalTabsManager?._prefsRightSide;
    panel.openPopup(label, {
      position: right ? "topleft topright" : "topright topleft",
      x: right ? -10 : 10,
      y: -90
    });
    document.addEventListener("keydown", arrowNavigation, true);
    expandedKeyHandler = arrowNavigation;
    panel.addEventListener("popupshown", () => search?.focus(), { once: true });
  }

  function onMouseEnter(event) {
    const label = event.target;
    const group = folderOfLabel(label);
    if (!group) return;
    hoveredLabel = label;
    hoveredFolder = group;
    clearHoverTimer();

    // Zen already opens a search popup for collapsed folders.
    if (group.collapsed) return;
    hoverTimer = setTimeout(
      () => showExpandedFolderSearch(group, label),
      HOVER_DELAY
    );
  }

  function onMouseLeave(event) {
    if (event.target !== hoveredLabel) return;
    clearHoverTimer();
    hoveredLabel = null;
  }

  function start() {
    const panel = popup();
    if (!panel) {
      console.warn(PREFIX, "Zen folder popup not found");
      return;
    }
    addStyles();
    addSearchHeader();

    // Zen populates the list using replaceChildren() BEFORE opening the
    // popup. popupshowing/popupshown are not sufficient for this lifecycle.
    // Watch the actual native list replacement and re-render all folder tabs.
    const nativeList = list();
    if (nativeList) {
      const listObserver = new MutationObserver(records => {
        if (!records.some(record => record.type === "childList")) return;
        const first = nativeList.firstElementChild;
        // Ignore our own render to avoid an observer feedback loop.
        if (!first || first.classList?.contains("zen-personal-folder-search-item")) return;
        const group = folderForPopup();
        if (group) {
          render(group);
          if (input()) {
            input().value = "";
            input().placeholder = "Поиск в " + (group.label || "папке") + "...";
          }
        }
      });
      listObserver.observe(nativeList, { childList: true });
    }

    // Native Zen handles search filtering/keyboard navigation for collapsed
    // folders. Rebuild the list once the panel starts opening so visible
    // tabs are included and no timestamps are rendered.
    panel.addEventListener("popupshowing", () => {
      if (input()) input().value = "";
      const group = folderForPopup();
      if (group) {
        render(group);
        const search = input();
        if (search) {
          search.placeholder = "Поиск в " + (group.label || "папке") + "...";
        }
      }
    });
    panel.addEventListener("popupshown", () => {
      setTimeout(() => input()?.focus(), 0);
    });
    panel.addEventListener("popuphidden", () => {
      clearHoverTimer();
      if (hoveredLabel) hoveredLabel.removeAttribute("open");
      if (expandedKeyHandler) {
        document.removeEventListener("keydown", expandedKeyHandler, true);
        expandedKeyHandler = null;
      }
      expandedPopup = false;
      lastRenderedFolderId = null;
      if (input()) input().value = "";
    });

    // Use delegated mouseenter: newly restored folders also work.
    const tabstrip = document.getElementById("tabbrowser-tabs");
    if (tabstrip) {
      tabstrip.addEventListener("mouseover", event => {
        const label = event.target?.closest?.(".tab-group-label-container");
        if (label && label !== hoveredLabel) onMouseEnter({ target: label });
      }, true);
      tabstrip.addEventListener("mouseout", event => {
        if (hoveredLabel && !hoveredLabel.contains(event.relatedTarget)) {
          onMouseLeave({ target: hoveredLabel });
        }
      }, true);
    }
    console.info(PREFIX, "0.1.3 loaded");
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();