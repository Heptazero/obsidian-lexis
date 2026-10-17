# MarginNote certification and online updates

Verified against official guidance on 2026-10-09. This package has **not** been submitted, certified or listed. Its `cert_key` is empty; do not invent a signature or claim that online updates are enabled.

## Current route

MarginNote's [December 2025 certification announcement](https://bbs.marginnote.com.cn/t/topic/65971) applies to MN 4.2.3+. Send the `.mnaddon` and optional description by Chinese-community private message to **Randa**, the announcement's author. The official estimate is two working days; approval depends on normal operation and absence of malicious behavior. That estimate is not a guaranteed release date.

The [earlier official publishing/update guide](https://bbs.marginnote.com.cn/t/topic/8042) describes server/CloudKit update distribution for certified addons and resubmission for later versions. Ask the current contact to confirm online-update distribution and directory visibility separately; certification alone must not be represented as automatic catalog inclusion. No fee or exhaustive current store-listing criteria were found in these two guides.

Do not write or replace files inside the installed addon directory at runtime: the newer announcement explicitly says that this invalidates certification. Lexis stores preferences in NSUserDefaults, edits only its managed native cards, and does not implement a self-modifying updater.

## Before submission

- Keep addon ID `com.heptazero.lexis.marginnote` stable. Candidate version: `0.2.1`.
- Confirm on a real iPad: install/upgrade, title-link popup, target-vault return, folder grouping, scope removal/restoration, user-comment preservation, native color binding, selection-menu shortcut appearance/position/cancel/confirm, background/rotation cleanup, and retained-file permission on auto-check.
- Attach only the `.mnaddon`, never the personal dictionary JSON, vault data, credentials or native preferences.
- If certification requires deleting/reinstalling the old addon, check preference retention first. Cards live in the MN study-set database, but device-local settings/bookmarks must not be assumed to survive uninstall without testing.
- Public posting, emails/private messages and submission need the user's separate authorization. None have been sent.

## Submission description

Lexis MN connects a local Obsidian Lexis vocabulary to MarginNote's native Title Link dictionary. It imports ordinary and inline entries with aliases, groups cards by source folders, updates owned cards without overwriting user comments, and opens the corresponding Obsidian note. Users can select an export scope and map original term colors to MN palette colors. Selecting text in MN opens an explicitly confirmed Obsidian add-entry draft.

There is no analytics, account service, remote-code loading or network upload. The addon reads only the user-selected JSON or clipboard on an explicit paste action, and updates Lexis-owned cards in the current study set. Original notes, FSRS schedules and encounter data are not imported into the addon. Preferences and file bookmarks are device-local. Request official certification and, if supported, official online-update delivery for later versions.
