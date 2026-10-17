# Card library ranking and presentation

Entry point: Review log → Reviewed. This is the active reviewed subset, initially sorted by review count descending. Suspended, archived and retired items are managed on Home rather than duplicated as filters here. A single search covers questions, file names/paths and Markdown heading paths. The scope picker uses the folders and tags configured in vocabulary settings, for both whole-note cards and syntax cards in those files. All sources also includes syntax cards outside configured vocabularies. Highlight visibility does not limit review browsing. No separate leaderboard view or storage is created.

## Fields

| Sort field | Source | Meaning |
| --- | --- | --- |
| Review count | Existing FSRS `reps` | Number recorded by the scheduler, not the number of surviving log entries |
| Estimated retention | FSRS retrievability using stability and elapsed local calendar days | Estimated probability now; not a measured familiarity score |
| Name | Note name or parsed question | Alphabetical browsing |
| Due | Existing FSRS `due` | Next scheduled review date |

The visible sort menu has only these four choices. Discovery dates, first recorded review and stability remain available in History record details, not through a library-row detail action. Stability is a scheduler parameter in days, not another familiarity percentage.

- Every field has an independent ascending/descending direction. Missing or invalid values remain last in either direction and display `—`, never invented as 0%. An explicitly recorded zero review count remains zero.
- Numeric sorting adds result-position numbers only to cards with known values. Equal values use stable name/path/line ordering. These numbers are positions in the current filtered results, not stored ranks.
- There is no With memory curves filter. Curves are drawn from scheduler data, not from the presence of a Markdown code block. Normal reviewed cards can draw a curve; legacy reviewed records with missing dates/stability remain visible with unknown metrics instead of being silently hidden.
- Each list rebuild uses one local date for all metrics. Retention ranking refreshes when the panel is opened/refreshed or controls change; it is not a continuously measured score. Existing live curve Today updates remain owned by their curve components.

## Display

- History, Unreviewed and Reviewed use one type-filter toolbar directly below the view header. Unreviewed and Reviewed share the same state/history eligibility rules; Unreviewed excludes suspended/archived items. Rows share a flat, keyboard-accessible content component rather than theme buttons with fixed heights. Hover and selected rows use the theme's `--background-modifier-hover`; idle rows are transparent.
- Syntax titles in all three tabs and record details go through native MarkdownRenderer with their complete question/source path. Note names remain literal. Markdown lists, emphasis, code, links and formulas are not truncated as source strings. Malformed question Markdown caused by a conflicting card delimiter is a parser issue, not repaired by inventing missing formatting.
- Unreviewed and Reviewed use `renderReviewCardRow`, including in card mode. Scoped rules stretch the title to the row's left edge and reset title container margins/padding, paragraph indentation and native Markdown wrapper margins without changing global note typography or trimming note content. The complete path lives in More, not a repeated line under the question. Only Reviewed shows review-count/retention metrics, numeric ranking, sort and direction; Unreviewed uses stable name order because those memory fields do not exist yet.
- Rows initially show only the question/name. Click or Enter/Space reveals the parsed Markdown answer below it; a second activation retracts it. Whole-note cards load their note content only when revealed. More contains only the source path; the View details action and its callbacks have been removed from both list tabs. A right-hand arrow opens the original note through the selected native leaf and positions syntax cards at their source line. These buttons and Markdown links do not toggle the answer.
- List/Cards is one button showing the current mode with a bidirectional-arrow icon. The separate ascending/descending button is icon-only, with a translated accessible label and tooltip. Sort and mode controls are right-aligned. Cards adds the existing memory curve; note content and syntax answers remain click-to-reveal rather than being repeated in another preview.
- Results initially show 100 rows; Load more adds another 100. Only previews near the viewport are queued; at most two Markdown renders run at a time in that panel, including across filter/view changes. Older queued work is discarded when rebuilding. In-flight native rendering cannot be aborted, but is allowed to settle without mounting a curve after removal, then its component unloads.
- ReviewRenderQueue owns its IntersectionObserver, queue and components; titles and card bodies share its two-job limit, including across tab/filter rebuilds. Retracting an answer removes its queued work and unloads its settled component immediately. Detached in-flight work can settle but cannot replace a reopened answer; its component then unloads. Switching modes discards body work and closing the view unloads the queue. One unreadable note is displayed as a failed preview without blocking later work.
- Native internal links reuse ReviewNavigation, the current-page/new-tab setting and native Back navigation; they are not dispatched to the operating system. Preview content is excluded from Lexis's own Markdown highlighting to avoid nested highlight/encounter side effects. Reading/ranking does not grade or change FSRS state.
- Sort, direction, mode, search and configured source are part of the existing native log-view state. Classification and dictionary scope cannot be active together. Old Hub grouping becomes source-note grouping. Old library tabs normalize to reviewed; removed status/curve/category filters reset so no invisible filter can hide cards. Removed sort fields reset to review count. A removed vocabulary source resets to All cards. The generic selection model remains reusable; discovery dates are not fabricated and no learning-data migration occurs.

## Plan storage and synchronization

Named plans are `reviewPlans` in the installed plugin's `data.json`, saved via the existing settings save boundary. In the user's current vault this is `.obsidian/plugins/lexis/data.json`; `encounterFolder` only relocates encounter snapshots and does not relocate plans/configuration. Plan names, sources and content mode are saved, not only a view-state selection. Today targets and goal histories are separate fields in the same configuration file.

Settings load during plugin startup and saves replace the whole settings object. There is currently no live reload or field-level merge for an externally synchronized `data.json`. Therefore file synchronization alone does not guarantee that an already-running second device displays or preserves a newly edited plan. The Mac ignore file does not exclude Lexis data, but the phone's configuration directory, file contents and sync status have not been inspected. This UI change does not relocate, merge or overwrite personal plan data.

## Checks

`tests/review-library-ranking.test.mjs` checks separate metrics, real date decay, ascending/descending, missing values, curve eligibility, legacy view-state normalization and data immutability. `tests/review-library-preview.test.mjs` checks viewport gating, two-job limits across resets, cleanup and source failures. The isolated settings-layout fixture checks both list tabs, paragraph-indent overrides, lazy reveal/retraction, current-leaf source arrows, metadata isolation, pending-note close/reopen cleanup and responsive day/night layout. Unit/build/isolated-browser checks do not prove native Obsidian/mobile behavior; real clicking remains user-operated.
