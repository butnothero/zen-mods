# Folder State Persistence

Experimental Sine JavaScript mod for Zen Browser. Remembers which tab folders are expanded or collapsed after a full browser restart.

## Behaviour

- Saves `collapsed` state by Zen folder ID in a Firefox preference, not in tab content.
- Restores states after delayed browser startup with repeated passes to accommodate Zen session restoration.
- Works with nested folders if Zen exposes them in `gBrowser.tabGroups`.
- Does not style folders and is designed to coexist with Zia.

## Installation

This folder includes a Sine-compatible `theme.json`. Try installing via Sine using this GitHub subdirectory:

`https://github.com/butnothero/zen-mods/tree/main/mods/folder-state-persistence`

**Note:** Not all Sine versions accept monorepo subdirectory links. If it rejects this address, install the folder as a separate repository or manually place the JS via your Sine user-script installation mechanism.

Enable unofficial JavaScript only if you trust this code: it executes with privileged browser access.

## Testing

1. Restart Zen after enabling the mod.
2. Expand one folder and collapse another; use a nested folder if available.
3. Quit Zen entirely (not just close a window), then reopen it.
4. Confirm each folder retains its prior state.
5. Repeat with multiple workspaces.

This is an **untested integration**. Firefox/Zen private APIs can change and a late Zen session restore may override these timed attempts. Report the Zen and Sine versions if it fails.

## Storage

Firefox preference: `extensions.zenmods.folder-state-persistence.v1`

To reset, open `about:config` and reset this preference.

## Limitations

- The mod does not remove stale IDs of folders that were deleted.
- Changes made during the first few seconds of startup can be overridden by restoration.
- Open windows share the same preference; simultaneous multi-window use has not been tested.
