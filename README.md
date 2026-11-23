# Zen Mods

A personal [Zen Browser](https://zen-browser.app/) mod collection, installed through [Sine](https://github.com/CosmoCreeper/Sine).

## Install

**Sine repository URL:**

```text
https://github.com/butnothero/zen-mods
```

1. Open Zen → Settings → Sine Mods.
2. Add the repository URL above as a new mod.
3. Allow unofficial JavaScript mods if Sine asks (review the code first).
4. Install or enable the mod, then restart Zen.

This repository is a **single Sine package** containing our mods. All executable files referenced by `theme.json` live at the repository root; additional scripts can be added to this same manifest in future.

## Included mods

### Folder State Persistence (experimental)

Remembers whether Zen tab folders are expanded or collapsed across complete browser restarts.

- Stores each folder's collapsed state by its Zen group ID.
- Restores folder states after the browser's delayed startup, with follow-up passes for session restoration.
- Does not open/close or move tabs and does not change styling (intended to coexist with Zia).
- Nested folders should work where Zen exposes them via `gBrowser.tabGroups`.

### Test

1. Enable this mod and restart Zen.
2. Expand some folders and collapse others.
3. Fully quit Zen and reopen it.
4. Verify that folder states are restored; repeat for multiple workspaces.

**This version has not been tested in a live Zen/Sine session.** Depending on the browser version, Zen may restore folders later than expected, and the script may need adjustments.

## Files

- `theme.json`: Sine manifest. Add new scripts to its `scripts` section.
- `folder-state.uc.js`: Folder State Persistence privileged browser script.

## Troubleshooting and reset

If Sine rejects the URL, check that your Sine version supports third-party GitHub mods and unofficial JS. Report the exact error.

To reset saved folder states, open `about:config` and reset `extensions.zenmods.folder-state-persistence.v1`.

JavaScript mods have browser privileges. Install only trusted code.

## Known limitations

- Simultaneous multiple windows are not yet tested.
- Stale folder IDs are not cleaned automatically.
- Folder state changes during early startup can be overridden by restoration.
