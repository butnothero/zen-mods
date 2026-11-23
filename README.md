# Zen Mods

Personal mods for [Zen Browser](https://zen-browser.app/) installed with [Sine](https://github.com/CosmoCreeper/Sine).

## Install

Install directly from this repository URL in **Zen → Settings → Sine Mods**:

```text
https://github.com/butnothero/zen-mods
```

Enable unofficial JavaScript mods only after reviewing the source, then restart Zen.

## Zen Personal Tweaks v0.5.2

This repository installs as **one Sine mod**, containing multiple JavaScript features. The existing Sine mod ID remains `folder-state-persistence` so updates do not require installing a second copy.

### Split View Smart Close (experimental)

v0.5.2 eliminates the floating overlay entirely. Inactive Split Views display only the native close button of the final tab on hover; that button closes the complete split group. Active Split Views retain normal per-tab buttons. No extra elements are inserted into the tab group. Restart Zen after updating to remove the earlier overlay script.

When a Split View is **inactive**, hovering over its group hides the individual tab close controls and shows **one × on the right**. Clicking that × closes **all tabs in that Split View**, not just one. When the currently selected tab belongs to that Split View, individual tab close controls work normally and the group × disappears.

This uses Zen's internal XUL tab-group structure. The behavior is not yet verified in a live Zen instance. Verify the behavior with a disposable Split View before relying on it. Closing multiple tabs can discard unsaved work, subject to Zen's normal tab close handling.

### Folder State Persistence v0.4.0 (experimental)

Remembers folder expansion and the identities of tabs shown within collapsed folders.

- Records `collapsed`, `activeTabIds`, and split-view group references by stable folder/tab IDs.
- Does **not** recreate/move tabs, split views or workspaces.
- Uses Zen's own `gZenFolders.animateSelect` to attempt restoring displayed tabs.
- Split-view references are captured, but display restoration is **best effort**: Zen currently handles selected split-view tabs differently. A split-view tab that was not selected at startup may remain hidden.
- Restoration may be affected by Zen's known `itemGroup.activeGroups is undefined` startup exception.
- Works alongside visual mods like Zia in principle; compatibility is not guaranteed.

### Test

1. Update the mod through Sine and restart Zen.
2. Wait about 15 seconds for startup.
3. Arrange the folders as you want (including partially collapsed GitLab, Wiki, Social/another split-view folder).
4. Wait a few seconds for the current state to be saved.
5. Verify saved snapshot in **Browser Console**:

   ```js
   JSON.parse(Services.prefs.getStringPref("extensions.zenmods.folder-state-persistence.v2", "{}"))
   ```

6. Quit Zen completely and reopen it; wait 15 seconds and compare.

Initial installation creates a new baseline in the `v2` preference; old `v1` collapsed-only values are not forced back onto folders. If the new preference does not exist immediately, wait for startup initialization.

### Troubleshooting

Search for `[Folder State Persistence]` in Browser Console.

The code uses internal browser APIs. This is not a verified, production-safe restore solution. If Zen throws `itemGroup.activeGroups is undefined`, the problem also exists in its session restore code and this mod may not be able to work around it.

To clear saved state, reset `extensions.zenmods.folder-state-persistence.v2` in `about:config`. Do not delete the Zen session files.

## Files

- `theme.json` — Sine manifest
- `folder-state.uc.js` — folder state persistence JavaScript
- `split-view-smart-close.uc.js` — Split View hover and close behavior
