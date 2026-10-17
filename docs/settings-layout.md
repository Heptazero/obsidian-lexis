# Settings layout

Settings have six default tabs. Keep each complete task in one collapsible section; use static subheadings within it instead of nesting incidental disclosures.

| Tab | Sections |
| --- | --- |
| General | Language/status bar, data storage |
| Vocabulary | Dictionaries, inline entries, inclusion/colors, new-entry templates |
| Appearance | Highlighting, hover/selection, sources/notes |
| Review | Goals, syntax, scheduling, suspension, reading feedback |
| Integrations | Browser/Zotero bridge, MarginNote export |
| Other | Mobile behavior, live syntax guide |

## Ownership

- Vocabulary controls membership, aliases and per-source colors. Appearance controls the common highlight appearance. Existing tag overrides remain in inclusion/colors with their data and precedence unchanged; the highlight page no longer duplicates that editor.
- Hover and selection share interaction controls. Source search scope, PDF inclusion, display limit, occurrence format and note heading all belong to sources/notes.
- New-entry templates belong to Vocabulary. Hover width/height remain direct resize preferences; Obsidian hover text follows its text-size variable instead of a separate slider. Note images follow Obsidian attachment placement. Existing images are not moved.
- MarginNote export owns folder, scope, automatic export and manual export in one disclosure. Export scope no longer follows Obsidian highlight visibility. Ignored tags, archived and mastered entries remain excluded. MN's import file and automatic update check belong to MN; this is a file snapshot workflow, not instantaneous background sync.
- Browser/Zotero bridge behavior, port and token are unchanged.

## Navigation and hierarchy

- Tabs have no six-dot handle. Hold the tab itself for 320ms to reorder it; movement before the hold remains ordinary scrolling. Alt+left/right offers keyboard ordering. A normal click activates the tab.
- Right-side pencil edits the selected tab. Built-in tabs can be renamed; custom tabs can also be deleted there. Deleting a custom tab returns its sections to their default tabs and never deletes settings. The trailing plus creates a custom tab and stays after every sortable tab, including while the last item is dragged. Primary section menus can move sections to any default or custom tab. Stable ids keep translated or renamed labels independent of routing.
- One chevron button toggles expand-all/collapse-all for the visible tab or matching search results. Its icon and tooltip follow manual folds, tab switches and search; no results disable it. All complete function sections start collapsed. Inline taxonomy and its color/classification editors retain their existing domain-specific fold preferences.
- Primary frames are unfilled; static subheadings have no disclosure arrow or extra body indentation. Shared solid-triangle arrows use .45em by .55em dimensions, proportional to heading text. Touch targets do not shrink with icons.
- Section and row reordering continue to share settings-sortable.ts. Cross-tab routing does not rebuild controls, so unconfirmed folder drafts survive. Canceling a drag restores its position without saving.
- settingsActiveTab, settingsTabOrder, settingsTabNames, settingsCustomTabs, settingsTabAssignments, settingsGroupOrder and settingsSectionOrder preserve layout. Opening the settings page never saves configuration.
- Global fuzzy search spans all tabs without searching input values or credentials. It temporarily opens original controls; clearing restores folds, drafts and the selected tab. Temporary search/drag expansion uses setSettingsSectionOpen() to avoid preference writes.

## Live syntax guide

- Other / Syntax guide starts with concrete note examples. Every note shows code above its actual rendered result at all screen sizes; there is no two-column layout. Copy buttons copy runnable code, never the sample filename or placeholder template.
- Eight sections cover complete entry, curve, heading-filtered backlinks, occurrences, all backlinks, home, named plan and heatmap. The two reference sections each show two notes and two real outputs (ten outputs total). `cold.md` writes a heading and `[[warm]]`; its `lexis rel` view shows warm. `warm.md` uses `rel` with that heading and shows cold automatically, with no reciprocal link written into its source.
- The generic template `rel` / `{{标题}}` (English `{{heading}}`) labels the replaceable heading. Antonyms is only a concrete sample, not a reserved heading. Runnable code and copied code contain the actual heading without braces. Every Markdown heading level is supported.
- Legacy `lexis derived` means all incoming links from dictionary notes, not linguistic derivation; it ignores the link's heading. Both Obsidian and bridge output call it backlinks. The command remains unchanged for existing notes.
- settings-manual-preview.ts provides explicit synthetic files, source Markdown, resolved links and learning data; it does not inherit a live plugin, vault, token or dashboard. Production render methods and the actual heading parser are rebound to that adapter, rather than inventing reciprocal relation results.
- Preview actions are inert. Internal details are opened for readability. Example data are clearly labeled; no note or learning record is read or written.
- Previews render only after the guide opens, including opening it through search or expand-all. Components, dashboard timers and DOM listeners unload on settings hide/rebuild or plugin unload.
- Code-block names remain stable. Relation names follow user headings; inline/review delimiters remain configurable in their existing sections.

## Verification

- npm test: complete default tab coverage, stable custom names/routing, scoped order, fuzzy search, isolated preview data, attachment defaults and independent export scope.
- npm run test:settings-layout: isolated Chrome at 380/720/1100px in light/dark, including search/restoration, drafts, routing, rename/add, expand/collapse, tab hold/cancel, proportional arrows and real view-renderer output.
- npm run typecheck, npm run lint and npm run build; handwritten source stays within 500 lines.
- The fixture simplifies Obsidian controls and Markdown rendering. It does not prove real theme appearance, native iPad gestures or the complete Obsidian runtime. Those checks remain user-operated.
