# Card library and temporary priority

## Entry points

- Open **Lexis: Review log**, then **Card library**. Notes are vocabulary files; syntax cards are found in all Markdown files, including files outside vocabulary folders.
- Search by question, file path or inherited heading path. The heading input has fuzzy suggestions. Filter all, unreviewed, reviewed, suspended, or archived/retired cards. Note/syntax selection remains shared with the log.
- Classification is presentation only: dictionary, folder, tag, source note, or heading. There is no second dictionary-range filter. Groups start collapsed; use one group or the adjacent expand/collapse icon. Cards in overlapping dictionaries appear in each matching group.
- Sort by name, discovery date (either direction), first recorded review, or due date. Unknown dates sort last. Lists render 100 rows at a time.
- In review, **… → Lower priority temporarily** advances past this card without grading it. Suspend remains in the same menu. A card's library details can lower or reset its priority.
- Source navigation follows the existing current-page/new-tab preference. The log serializes its tab and filters for native navigation history; it does not create a separate global back button.

## Priority is not FSRS scheduling

Initial weight is 0.25. With a seven-day penalty half-life:

`weight = 1 - (1 - initial) × 2^(-elapsedDays / 7)`

Weights are 25%, 62.5%, and 81.25% at day 0, 7, and 14. Existing eligible-card order is adjusted with:

`adjustedRank = originalRank + (1 - weight) × eligibleCount`

This gradually returns a card to its chosen order; sorting only by weight would leave it behind all normal-weight cards indefinitely. Eligibility, already-reviewed-today checks, FSRS state and daily/session limits are unchanged. A combined cloze uses its least-penalized member; lowering a combined card updates all its member keys.

## Dates and identity

- **First discovered:** first observation by the new catalog, not the time a delimiter was typed. Existing cards in the initial baseline deliberately have `null`, not an invented timestamp.
- **Added to Lexis:** existing exact creation records for notes created through Lexis.
- **File created:** filesystem metadata for a whole file, not a syntax card's creation date.
- **First recorded review:** earliest retained grading event. Legacy histories cannot prove the absolute first review.
- Syntax identity keeps the existing path/kind/question/answer/duplicate-ordinal hash. Adding or changing headings does not change identity. Editing the question or answer creates a new identity; this change does not invent an identity migration or discard old FSRS histories.
- Heading paths support ATX and Setext headings, exclude frontmatter/fences/comments, and require no extra classification syntax.

## Storage and ownership

These are logical learning fields. They are serialized in device-owned snapshots in the configured visible [learning data folder](learning-storage.md), not the hidden plugin configuration:

```json
{
  "reviewCatalogInitialized": true,
  "reviewCardMeta": {
    "syntax:syntax-example": { "filePath": "Books/example.md", "discoveredAt": null }
  },
  "reviewPriorities": {
    "syntax:syntax-example": { "at": "2026-10-13T00:00:00.000Z", "initial": 0.25 }
  }
}
```

The catalog owns lazy discovery, incremental metadata events, timers and cleanup. Startup only registers listeners; it does not scan notes or save catalog settings. The first card-list request scans all Markdown, at most 16 files concurrently, yielding between batches. Concurrent requests share that scan; later requests reuse parsed cards. Metadata bursts re-read only the changed file. Changing syntax templates invalidates the next request; renames migrate discovery/priority/suspension references even before the first scan. Discovery writes are batched during scans, and unchanged catalogs are not saved. Deleted/removed cards lose only catalog metadata and priority records; retained review history remains historical evidence. The first library load still needs to read the vault; this change introduces no persistent content cache or new data format.

## Verification boundary

Unit tests cover decay, order restoration, write failure isolation, headings, unknown baseline dates, incremental discovery, rename/delete, filters and multiline quote formatting. Isolated Chrome fixtures cover narrow/wide light/dark layouts, grouped-cloze actions, and formula capture across separate script worlds. They do not prove native Obsidian history or phone touch behavior.
