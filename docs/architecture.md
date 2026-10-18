# Architecture

Keep state with the component that creates and disposes it. Split code by the reason it changes, not just by line count. A module should expose the operations its caller needs, without depending on the entire plugin API.

## Reader boundaries

| Module | Owns | Receives from its host |
| --- | --- | --- |
| `reader-workspace.ts` | Routing workspace events to reader actions | Reader actions and adapter lifecycle methods |
| `workspace-documents.ts` | Open documents, DOM listeners, workspace subscriptions | Workspace access and event callbacks |
| `reader-hover.ts` | Pending open/close timers and hover targets | Current popover, show and remove actions |
| `epub-highlights.ts` | Chapter bindings and their lifecycle | Highlight mode, text rendering and selection/pointer actions |
| `epub-surfaces.ts` | Reader discovery and intermediate-document observers | Chapter and prune callbacks |
| `epub-document-events.ts` | Stable-selection timer and chapter event callbacks | Selection and pointer actions |
| `reader-frame-geometry.ts` | Coordinate conversion, without mutable state | Documents, elements and rectangles |

The entry point creates these services. It does not store EPUB chapter maps or hover timer IDs. EPUB is no longer installed as methods on the plugin prototype. PDF highlighting does not install EPUB methods as a side effect.

`EpubHighlights` exposes `start(document)`, `rescan()` and `dispose()`. Settings remain live: a rescan reads the current highlight mode rather than a constructor-time copy. A chapter binds selection before rendering, so a rendering failure does not remove selection handling.

`ReaderHover` cancels timers through the same window that created them. Closing a pop-out removes its DOM listeners immediately. Plugin unload removes the remaining listeners, workspace subscriptions and pending timers. Starting an existing workspace session again does not duplicate callbacks.

## Review catalog lifecycle

`ReviewCatalog.start()` registers listeners without enumerating or reading notes. Startup metadata notifications do not trigger parsing. The first explicit `cards()` request shares one bounded full-vault scan across consumers; reopening the library reuses parsed cards. Subsequent metadata bursts coalesce per file, and changed syntax settings invalidate the catalog on the next request. Syntax cards outside dictionary folders remain supported.

The catalog batches discovery writes during initialization and saves only changed metadata. `flush()` waits for existing work and writes; it never starts a scan or rewrites unchanged settings. Queued renames and deletes finish before pruning obsolete catalog keys. Failed file reads remain retryable, and unload prevents in-flight reads from applying new state. Existing review history and FSRS state retain their format and contents.

## Shared logic and platform adapters

Share term matching, review calculations and card behavior when their semantics are the same. Keep DOM discovery, hit testing and coordinates specific to each reader. Browser, EPUB and PDF do not have interchangeable DOM environments.

Validate data at storage and integration boundaries. Do not scatter silent fallback chains through internal code. Resource cleanup is part of ownership, not optional defensive behavior.

Unload must also work when initialization fails. Encounter buffers and hover timing are ready when the plugin instance is created, before settings load or integrations register. The MarginNote protocol is registered at the end of initialization and released through Obsidian's registration lifecycle. A conflicting handler is reported, never silently replaced.

## Remaining debt

Dictionary membership is resolved by `dictionary-sources.ts`, not reconstructed by each consumer. Highlighting, review, library filters/groups, browser membership and MarginNote exports use that resolver. `dictionary-migration.ts` owns the one-way settings conversion; capture folders remain separate write destinations. See [Dictionary collections](dictionary-collections.md).

Highlight metadata events use the resolver's shared single-file source scores to decide whether an index refresh is needed. They preserve the published membership snapshot and coalesce changes through the existing rebuild timer. Each rebuild resolves one fresh file snapshot for both dictionary and inline indexing. Link-based dictionaries also refresh after changes to potential targets or aliases, so formerly unresolved links can become members without a manual rebuild.

The whole plugin is not yet service-based. Dictionary, review, bridge and some reader UI methods still use runtime prototype composition and share plugin state. `plugin-base.ts` still declares a broad API; `main.ts` still contains commands and settings migration. These should be moved when their ownership can be defined and their behavior tested, rather than hidden behind forwarding-only wrappers.

The 500-line source limit is a guardrail, not proof of low coupling. `main.js` is generated and is not a handwritten source module.

## Checks

- `npm run typecheck` and `npm run lint`: contracts and static checks.
- `npm test`: scheduling, storage, matching, reader lifecycle and source-size checks.
- `npm run test:epub`: real Lexis matching/interaction code in isolated EPUB DOM fixtures, including the three-layer Annotator structure.
- `npm run test:pdf-layout`: PDF placement at multiple scales.
- `npm run test:popover-editor`: editing and save-conflict regressions.

Lifecycle tests use public methods and observable callbacks rather than reading private chapter maps. Automated fixtures do not establish visual or touch compatibility in the user's real Obsidian, Windows or iPad. Those checks remain user-operated.

`tests/plugin-lifecycle.test.mjs` executes the composed entry point with simulated native hosts and visual services. It covers early initialization failure, ordinary enable/disable cycles, protocol collisions and failure after registration; it does not constitute a real Obsidian startup check.
