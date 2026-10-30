# Dictionary collections

A dictionary is a named, dynamic set of Markdown files. Its source rules are a union:

- `folder`: all Markdown descendants, with exact folder boundaries.
- `tag`: notes carrying that tag (case-insensitive, as in existing Lexis tag handling).
- `file`: one Markdown file, including its syntax cards.
- `links`: existing Markdown targets directly linked by one Hub; no recursion, embeds, PDFs, missing targets, or the Hub itself.

Multiple dictionaries may include the same note. Names and order are presentation; the persisted dictionary ID is stable. Moving a source in Obsidian updates matching source paths without changing that ID. Metadata changes invalidate the membership snapshot; changing a Hub schedules an index refresh.

## Review and library

Plans and one-off review select dictionary IDs. `null` means all configured dictionaries, including future additions; `[]` means none. A missing selected ID does not broaden the scope. Content modes (notes, syntax, note-with-masks, both) remain separate from membership.

Review unions file paths before parsing cards. Card identity, FSRS state, history, suspension and temporary priority remain attached to the original note or syntax card, never to its dictionary. Successful reviews today are shared across entry points.

Reviewed and unreviewed pages share search, dictionary scope, classification and display controls. Dictionary scope and classification are mutually exclusive: choosing a classification resets to All cards, while choosing one or more dictionaries returns to the flat view. This avoids a hidden intersection between two independent selectors. A card may appear under several dictionary or tag groups but keeps one identity. Source-note classification creates one group per Markdown file. The removed legacy Hub grouping is normalized to source-note classification, so it cannot produce a misleading Unclassified bucket. Counts and pagination refer to unique cards before grouping.

## Highlighting and capture

Any enabled dictionary can make a shared term visible in Obsidian. Among enabled memberships, style precedence is exact file, Hub link, tag, then the longest matching folder; equal specificity uses dictionary order. Existing term/inline/tag style overrides still apply. Review membership is independent of highlight switches.

Browser words carry their dictionary IDs and names. Site switches remain local to the browser; overlapping memberships use any enabled dictionary. Previous site-folder switches are consulted until a named switch is changed. Capture destinations stay in `styleConfig.dicts` for browser/Zotero clients; they are not the membership model.

The new-entry folder is automatically filled when choosing a folder source and follows edits to that source until manually changed. Clearing it explicitly keeps capture disabled. It must lie inside an included folder source. An index file is not a write destination. A tag/file/index-link collection can add a folder source to offer capture. Templater folder templates continue to take precedence when configured. Path fields use text inputs with inline fuzzy suggestions, not separate search widgets. Add and save actions use labeled plus/check icons.

## Storage and migration

Dictionary definitions remain in the plugin configuration; review plans and learning records use the visible [learning data folder](learning-storage.md). Loading older settings converts folder/tag rows and plan source rules once. A previously independent plan rule gets its own dictionary if no identical dictionary exists. Such migrated plan-only dictionaries start with highlighting off. Old MarginNote folder/tag selections become dictionary IDs; inline-file selections stay unchanged.

Dictionary migration preserves appearance, templates, plan IDs/names/content, daily targets and card IDs. Learning storage has its own one-time conversion and retention rules; see the linked storage document.

## Verification

`tests/dictionary-collections.test.mjs` covers union membership, overlaps, path boundaries, Hub resolution, Unicode paths, source renames, enabled-style precedence, one-way migration, unchanged learning state, shared syntax identities and grouping. `tests/browser-config.test.mjs` covers independent site visibility for overlapping memberships.

The isolated settings-layout fixtures exercise dictionary drafts, save/cancel, automatic `#` recognition and shared review controls at 380/720/1100 pixels in light/dark themes. Native Obsidian, phone touch and installed browser-extension acceptance remain user-operated.
