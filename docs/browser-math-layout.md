# Browser hover-card math

The browser displays Obsidian's final MathJax HTML; it does not typeset formulas again.

## Clipped glyphs (2026-10-15)

MathJax 4 positions and clips glyphs using its own font metrics. The bridge previously exported the HTML and stylesheet but left font URLs pointing at Obsidian's `/lib/mathjax/…`. Those fonts cannot be resolved on the browser page. An adopted stylesheet inside a ShadowRoot also does not register its `@font-face` rules as document fonts. Fallback glyphs consequently extend outside their calculated clipping area: the lower halves disappear even when the card has plenty of room.

- `src/bridge-math-css.ts` embeds app-local WOFF/WOFF2 bytes into the exported CSS. It caches concurrent font reads, bounds them to three seconds and retries failures. It never reads arbitrary vault or external URLs.
- `bridge-render-api.ts` awaits that CSS for ordinary entries, inline entries and occurrences containing MathJax output.
- `content-core.js` registers embedded fonts through `FontFace` / `document.fonts`. Private `Lexis-…` family names avoid collisions with the host page's MathJax fonts. Unchanged fonts are reused.
- Card height, scrolling, resize handles and MathJax glyph clipping rules are unchanged.

## Verification

`npm run test:browser-math-layout` uses the installed Obsidian MathJax bundle and offline font files in a fresh headless Chrome profile. Native-reference fonts have separate names so they cannot conceal missing fonts in the shadow card. It reproduces incorrect legacy glyph geometry and compares the fix against native fractions, subscripts, superscripts, roots and matrices at 12/20/32 px.

On macOS the fixture finds the newest Obsidian update archive; `OBSIDIAN_ASAR` and `CHROME_BIN` can override its inputs. No user browser tabs or clicks are used. The fixture screenshot is `/tmp/lexis-browser-math-layout.png` (fixed card left, native reference upper right, legacy failure lower right).

Real acceptance is separate: reload Lexis in Obsidian, reload the local browser extension, refresh the web page, then hover a fractional formula. Firefox and the user's actual browser page still require manual acceptance. No public release is implied by a passing build.
