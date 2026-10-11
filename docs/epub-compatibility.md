# EPUB compatibility

Checked on 2026-10-11. Included in Lexis 1.17.23.

| Reader | Implementation checked | Lexis integration |
| --- | --- | --- |
| ePub Reader 1.0.4 (caronchen) | Installed bundle; epub.js chapter iframes | Shared iframe discovery, highlighting and selection handlers |
| EPUB Marginalia 1.3.29 | Installed bundle; epub.js and `.epub-reader-area` | Same shared integration |
| EPUB Reader and Highlighter 0.5.3 | Official source for the issue #9 version; epub.js 0.3.93 | Same shared integration |
| Annotator 0.2.11 | Installed bundle and official source; wrapper → offline proxy (`patched-src`) → EPUB chapter | Observe both intermediate documents and the chapters; exclude annotation sidebar content |
| Weave EPUB Reader 0.6.55 | Installed bundle plus official Foliate service source | Use `foliate-view.renderer.getContents()` and `load` / `relocate` events; do not patch closed shadow roots |

## Behavior

- Chapter highlighting uses native DOM methods, not Obsidian-only helpers.
- Selection listeners bind before rendering and work with automatic highlighting disabled.
- Mouse release, keyboard selection and stable touch selections share the existing selection pill.
- Touch taps use the existing mobile action; scrolling and long presses are not taps.
- Pills and popovers appear in the Obsidian window, with nested iframe borders and scale included in their coordinates.
- Timers run in that window: EPUB sandboxes may prohibit timers inside the chapter.
- Navigation and closing a reader release old document listeners and pending selection timers.
- Foliate relocation does not rewrite an unchanged chapter. An explicit settings/index refresh still updates its highlights.

## Verification limits

`npm run test:epub` runs the actual Lexis engine, interactions and positioning in an isolated browser fixture. It covers direct chapter frames, two-layer and actual three-layer Annotator structures, delayed chapters, document rewriting, navigation, a Foliate-style closed shadow root and synthetic touch events. An annotation-menu listener that stops bubbling is tested alongside Lexis without clearing the selection. Unit tests cover listener cleanup and frame geometry. PDF and popover-editing regressions also run separately.

This is not an end-to-end test of the five plugins in real Obsidian, Windows or iPad. Reload Lexis and test highlighting, selection, chapter changes and mobile long presses in the reader you use. Third-party reader compatibility with the operating system remains outside Lexis's control.

## Sources

- [ePub Reader](https://github.com/caronchen/obsidian-epub-plugin)
- [EPUB Reader and Highlighter](https://github.com/okkio-31mon/epub-reader-highlighter/tree/0.5.3)
- [Annotator EPUB view](https://github.com/elias-sundqvist/obsidian-annotator/blob/master/src/defineEpubAnnotation.tsx)
- [Weave Foliate reader service](https://github.com/zhuzhige123/obsidian-weave-reader/blob/main/src/services/epub/FoliateReaderService.ts)
