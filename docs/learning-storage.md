# Learning data storage

## Location

Settings → General → Data storage provides one **Data folder** (default `Lexis-data`, relative to the vault). Existing visible encounter folders are reused. Hidden directories, absolute paths, note folders and directories containing unrelated plugin data are rejected.

```text
Lexis-data/
  macos--<device-id>.json                 # latest encounters, existing schema
  reviews/
    storage.json                         # schema marker, not learning history
    state--macos--<device-id>.json         # current review state and plans
    day-2026-10-29--macos--<device-id>.json # this device's history for that day
    state--ios--<device-id>.json
    day-2026-10-29--ios--<device-id>.json
```

`<device-id>` is generated once and kept in Obsidian's device-local storage. Each device writes its own snapshots. Each record carries a logical modification timestamp; synced snapshots are merged per record, not by replacing the entire collection. Deletions carry a tombstone so an unchanged stale device cannot restore a removed record. Concurrent edits of the same current-state record use a deterministic last-modification winner; this is not FSRS replay or a guarantee against filesystem failures.

`.obsidian/plugins/lexis/data.json` contains preferences and the visible directory pointer only. It contains no review events, histories, card states, plans, targets, discovery metadata, priorities or suspension records. Existing `lexis-*` review properties in Markdown notes stay in those notes; this change does not relocate or rewrite note frontmatter.

## Retention

**Detailed review history retention (days)** proposes 90; valid values are 1–3650. Existing users' history is migrated without age pruning; `reviewRetentionConfirmed` remains false until they explicitly confirm the setting. The setting displays an estimated event/curve-point cleanup count. New empty installations enable the default policy immediately. The interval includes today: 1 keeps only today, 90 keeps today and the preceding 89 calendar dates. Typing or pressing Enter never applies the policy; the check button confirms permanent cleanup.

After confirmation, expired daily files are validated and deleted at startup and during saves, including closed history files belonging to offline devices. The retained window applies to events, per-card curve history, daily counts and past daily goals. Each card also keeps at most 64 retained curve events, as before. Current schedules, lifetime review counts in the schedule, plans, priorities and suspended state are not age-pruned. Longer retention cannot restore deleted history. No backups or legacy-format sidecars are created.

## One-time migration

On the first updated load, existing learning fields are converted to schema 1 and read back for verification. Only after durable storage is available is `data.json` rewritten as configuration-only. Recognized hidden encounter snapshots are copied, verified and removed from their old directory. Arbitrary files are never recursively moved or deleted.

After a schema marker exists, legacy learning fields in a synced old `data.json` are **not** imported again. Unsupported schemas, missing data after migration, and invalid snapshots fail explicitly rather than falling back to empty progress. Subsequent writes verify that the schema marker still exists, preventing a running device from recreating an old directory after another device moved the data.

Update procedure: finish syncing the existing vault, stop reviewing on older clients, update every device, then sync the configuration **and** the visible data folder. Do not review with mixed old/new versions or downgrade after migration. New code cannot prevent an old binary from writing its obsolete format; it ignores that old state and warns when an old client rewrites the configuration.

Configuration sync applies the retention setting. If another device changes the data directory, writes pause with a request to finish syncing and reload; this avoids silently writing to the obsolete location. When changing the directory, close/stop reviewing on other devices first.

## Directory moves and scope

The undo/check controls remain. A confirmed move verifies the destination before committing the configuration pointer; exact copied originals are then removed. Failure before commit retains the original pointer and data and rolls back unchanged operation-created copies. Changed source files or failed cleanup are reported and retained rather than deleted speculatively.

This isolates learning JSON from plugin configuration and reduces whole-file sync conflicts. It does not fix OneDrive/EasySync themselves, merge arbitrary sync-conflict files, or resolve concurrent edits to Markdown note frontmatter. Real multi-device synchronization still requires acceptance on the user's devices.
