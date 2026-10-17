# Lexis — Markdown Reading Glossary and Automatic Highlighter for Obsidian

[简体中文](./README.zh-CN.md)

**Lexis turns ordinary Markdown notes into a personal reading glossary for Obsidian.** Build a dictionary of characters, aliases, places, terminology, or any names you want to recognize while reading. Lexis highlights them automatically and shows the original note on hover.

Novel reading is the clearest example: one Markdown note can hold a whole cast, including aliases, places, objects, and factions. Their names are highlighted in Markdown, PDF, and supported EPUB readers; hovering shows the short explanation without leaving the page. The same mechanism works for papers, technical notes, and any personal terminology.

If some entries later need deliberate memorization, the same notes can optionally become FSRS cards. Review is a secondary layer, not a requirement for using the dictionary, highlights, or hover cards.

Your vault remains the database. Lexis needs no account, hosted service, or proprietary dictionary format.

## One Markdown glossary for everyday reading

| If you want… | Lexis provides… |
| --- | --- |
| A character and worldbuilding glossary for novels | Keep recurring names, aliases, places, and factions in ordinary notes or one compact cast list; highlight them automatically and read their explanations on hover |
| A pure-Markdown personal dictionary | One note per entry, several entries in one note, aliases, folders, tags, and index-note links |
| Automatic highlighting and hover definitions | Matching terms are highlighted throughout supported Obsidian reading surfaces; hover opens the original Markdown note |
| The same dictionary while reading elsewhere | PDF, EPUB, browser, Zotero, Canvas, and Excalidraw integrations use the Obsidian vault as their source of truth |
| Optional review after reading | Reuse selected entries as FSRS cards without copying them into a second database |

## Common questions

### Can Obsidian highlight character names and show character notes while I read a novel?

Yes. Put one character in each Markdown note, or keep an entire cast in one inline-entry note. Lexis recognizes names and aliases, highlights them in Markdown, selectable PDFs, and compatible EPUB readers, and shows the entry on hover. You can keep different novels in separate dictionaries and enable only the dictionaries you currently need. Spaced repetition is optional.

### Can I build a personal dictionary in Obsidian using only Markdown?

Yes. A dictionary can be a folder of ordinary notes, a tag, an individual note, an index note's direct links, or several inline entries inside one note. Lexis does not lock definitions into JSON or a proprietary database.

### Can Obsidian automatically highlight every occurrence of my dictionary terms?

Yes. Lexis matches titles and aliases across supported views, highlights them in context, and opens the source note in a hover card. Each dictionary can be shown or hidden independently.

### Can I use the same Obsidian dictionary in PDFs, EPUBs, websites, and Zotero?

Yes. Lexis supports Obsidian's built-in PDF viewer and compatible EPUB readers; the optional Lexis Web and Lexis for Zotero companions reuse the same local Markdown dictionary. Documents must have selectable text.

### Can a Markdown dictionary also work as a spaced-repetition deck?

Yes. Lexis includes FSRS review for whole notes, question-and-answer syntax, and cloze cards. Review is optional: automatic highlighting and hover definitions work without turning every entry into a card.

## Core workflows

### Store entries as files or inside a note

- **One file per entry.** Point Lexis at one or more folders. Each note title becomes an entry; frontmatter aliases are indexed too.
- **Many entries in one file.** Mark a note with `lexis-inline: true`, then write `Name / Alias=> annotation`. Spaces around `/` are optional, the delimiter is configurable, and `\/` writes a literal slash. Inline entries take precedence when a legacy delimiter still matches flashcard syntax. This is useful for recurring characters, places, objects, and factions in a novel without creating hundreds of tiny files.

```md
---
lexis-inline: true
---

## Characters
Yalda / Yal {captain}:: A painter who appears under several names.
Otto:: Keeps the notebook everyone else forgets.
```

Entry colors make people or concepts easier to recognize without tying meaning to a raw color. Under *Inline entries → Entry colors*, one row may contain aliases such as `captain / commander / ENTJ`; spaces around `/` are optional and every name resolves to the same color. Use the preferred name at the end of an inline entry, such as `{captain}`. Typing `{` or placing the cursor inside `{}` opens fuzzy suggestions from existing entry colors; names used in notes but missing from the rules are listed at the top of the Entry colors settings. A one-file entry uses `lexis-color: captain` in frontmatter. You may also write a hex color directly, such as `{#8b5cf6}` or `lexis-color: "#8b5cf6"`. Entry colors override category, tag, dictionary, and global colors.

Inline entries can be grouped by file or heading. Heading groups may follow the nearest heading or a fixed level from H1 to H6. With H2 selected, nested headings such as H3 and H4 inherit their nearest H2 group, which is useful for global categories such as characters and settings. In an inline note, typing the configured heading marker and a space opens fuzzy suggestions collected from headings at that level across all inline notes.

### Read with the same lexicon everywhere

Lexis highlights known entries and shows their notes on hover in:

- Obsidian Markdown, Live Preview, Canvas nodes and edge labels, and the built-in PDF viewer
- compatible epub.js-based EPUB readers
- Chromium browsers through **Lexis Web**
- Zotero Reader through **Lexis for Zotero**

Selected text can be added to a dictionary, saved as an occurrence, or attached as an alias. Obsidian remains the source of truth; the browser and Zotero companions communicate with it over an authenticated loopback-only bridge.

Each Obsidian dictionary has its own highlight switch. Lexis Web keeps a separate visibility profile for each website: open the extension popup to show or hide dictionaries on the current site. Browser choices do not overwrite Obsidian settings, and the current page updates immediately.
<img width="727" height="465" alt="image" src="https://github.com/user-attachments/assets/d274dd14-7bd7-4003-9da6-3a7f8db02b06" />

### Optional: review selected entries

Lexis works as a complete reading glossary without review. If a few entries are worth deliberate practice, they can reuse the same Markdown notes and dictionary structure:

<details>
<summary>Review features</summary>

- FSRS spaced repetition with note and occurrence-cloze cards
- dictionaries combine folders, tags, individual files, and an index file's direct valid links; choose whole notes, syntax cards, or both
- choose one or all answers on multi-cloze cards, and suspend cards without deleting notes or highlights
- daily minimum and full goals, deduplicated completions, and a seven-day chart linked to the review log
- saved review plans select one or more dictionaries; overlapping cards share one schedule and are reviewed once
- reviewed and unreviewed lists share dictionary filters and grouping by dictionary, folder, tag, index links, source file, or heading
- session progress: green completed, red retry, and neutral remaining; undo and skip
- a collapsible long-term review heatmap
- highlights that fade as memory stability grows
- real reading encounters that can pull a distant review closer
- retirement candidates based on long absence, with the final decision always left to you

</details>

## Install

### Obsidian

Install **Lexis** from *Settings → Community plugins → Browse*. For manual installation, download `main.js`, `manifest.json`, and `styles.css` from the [latest Obsidian release](https://github.com/Heptazero/obsidian-lexis/releases/latest) into `<vault>/.obsidian/plugins/lexis/`.

### Browser companion

1. Download [Lexis Web 1.2.4 for Chrome](https://github.com/Heptazero/obsidian-lexis/releases/download/browser-v1.2.4/lexis-web-1.2.4.zip) or [Lexis Web 1.2.4 for Firefox](https://github.com/Heptazero/obsidian-lexis/releases/download/browser-v1.2.4/lexis-web-firefox-1.2.4.zip).
2. Extract it, open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
3. Enable *Local bridge* in Lexis settings, then copy its port and access token into Lexis Web.

Chrome does not auto-update unpacked extensions. Replace the extracted folder with a newer browser release when needed.

### Zotero companion

1. [Download Lexis for Zotero 0.2.2 (`lexis-zotero-0.2.2.xpi`)](https://github.com/Heptazero/obsidian-lexis/releases/download/zotero-v0.2.2/lexis-zotero-0.2.2.xpi).
2. In Zotero, open *Tools → Plugins*, choose *Install Plugin From File*, and select the XPI.
3. Enter the same local bridge port and token in Lexis for Zotero.

After the first manual installation, Zotero can update the add-on from its update feed.

## Quick start

1. In *Settings → Lexis*, add one or more dictionary folders.
2. Read a Markdown, PDF, or EPUB document. Matching entries are highlighted; hover to open the card.
3. Select unfamiliar text and add it to a dictionary. Lexis can save the surrounding sentence as an occurrence.
4. Keep reading. Open **Lexis Home** only if you want to review selected entries or inspect long-unseen ones.

The interface language can be switched between Chinese and English in Lexis settings. Translations are kept together by message key in `src/i18n.ts`, so adding another language does not require searching through the UI code.

### Where data lives

Dictionary notes and FSRS fields stay in vault Markdown files. Lexis settings and review history stay in Obsidian's fixed `.obsidian/plugins/lexis/data.json`. Encounter history defaults to `.obsidian/plugins/lexis/encounters/`; *Settings → Lexis → Data storage → Encounter data folder* accepts a dedicated vault-relative **folder** path. Editing does nothing until the check button is pressed; the undo button discards the draft. The switch copies only the active encounter baseline and per-device, per-day `.jsonl` files, leaving old copies for manual cleanup. It does not move `data.json` or dictionary notes. Browser settings and its temporary dictionary cache live in the browser's extension storage.

## Note blocks

Use a `lexis` code block to render memory, relationship, and occurrence data inside an entry note:

- `curve` — retention curve
- `rel` — outgoing and incoming links grouped by heading
- `rel {{heading}}` — missing backlinks under that heading; replace the placeholder with the actual heading, without braces
- `occ` — unsaved occurrences
- `derived` — dictionary notes linking to this entry, regardless of heading; it does not infer word derivation
- blank — all applicable sections

Relation types come from heading text rather than a fixed list. Any Markdown heading level (`#` through `######`) works. For example:

`cold.md`:

````md
## Antonyms
[[warm]]

```lexis
rel
```
````

`warm.md`:

````md
```rel
Antonyms
```
````

The first note shows warm; the second automatically shows cold, which links to it. No reciprocal `[[cold]]` needs to be written. Antonyms is only an example for `{{heading}}`, not a reserved name. The block adds missing reverse links without repeating outgoing links already written in the note.

Use `lexis-home` for a compact home summary, or `lexis-heatmap` for the heatmap alone.

Daily goals are configured in *Settings → Lexis → Review → Review goals*. Today's target is fixed when the dashboard first opens; changes apply tomorrow. Each cloze counts separately, regardless of whether answers are shown individually or together. Only remembered cards count as completed, once per day, across review entry points.

Create saved plans on Lexis Home. A `lexis-home` block can show one plan by name:

````md
```lexis-home
plan: Mathematics
```
````

Without `plan:`, the block shows the combined plans, or the dictionary when no plans are saved. Goals, plans, and daily target snapshots are stored in the existing Lexis settings file; no extra data folder is created.

## Why a personal lexicon

Lexis starts from one claim: **vocabulary is infrastructure, not a study subject.** Every field brings its own terms, and the half-known ones are exactly those your eyes learn to skip.

- **A dictionary that is always present can become part of memory.** Clark and Chalmers' [extended-mind thesis](https://www.alice.id.tue.nl/references/clark-chalmers-1998.pdf) describes a trusted, constantly available external store functioning like recall. Lexis aims for those conditions: one lexicon, available by hover on every reading surface.
- **Highlighting supports noticing.** Research on textual enhancement finds that visually enhanced forms attract attention and can improve learning over unenhanced input ([eye-tracking study](https://www.cambridge.org/core/journals/applied-psycholinguistics/article/investigating-the-effects-of-prolonged-exposure-to-textual-enhancement-on-attention-and-learning-a-preposttest-measures-eyetracking-study/AC5C9DE823DEC3613B31C260393D32A8), [vocabulary and grammar study](https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/investigating-textual-enhancement-and-captions-in-l2-grammar-and-vocabulary/EF080D9AC64C7E2BFFB90AC799C38C69)). It does not remove the need to retrieve a memory.
- **Words are learned through re-encounter.** A lookup is an event; a word seen repeatedly in real context becomes knowledge. Global highlighting turns ordinary reading into a source of those encounters.
- **Noticing is not retention.** Lexis therefore separates attention from review. The highlighter gets the term noticed; [FSRS](https://github.com/open-spaced-repetition/fsrs4anki/wiki/ABC-of-FSRS) schedules retrieval practice.

Lexis does not promise faster reading or learning without effort.

## Why highlights fade, reviews move, and entries retire

- **Salience is scarce.** Repeated visual cues lose force—the same family of effects behind [banner blindness](https://en.wikipedia.org/wiki/Banner_blindness). As FSRS stability `S` grows, a highlight fades toward a configurable floor: `final opacity = base opacity × [1 - S/(S+20) × (1-fade floor)]`. A support should recede when the skill is internalized.
- **A hover can reveal friction.** [Testing-effect](https://en.wikipedia.org/wiki/Testing_effect) and [desirable-difficulty](https://en.wikipedia.org/wiki/Desirable_difficulty) research make retrieval attempts informative. A hover is noisy—it may mean curiosity, not forgetting—so Lexis may move a review date closer but never counts the hover as a review or changes a difficulty score.
- **Importance appears through use.** At add time, nobody knows whether an entry will become foundational or never appear again. Lexis surfaces long-unseen entries with evidence and lets you retire, keep, or master them; it never decides automatically.
- **A personal lexicon is an OED for one reader.** The [Oxford English Dictionary](https://en.wikipedia.org/wiki/Oxford_English_Dictionary) grew from dated, sourced citation slips. Lexis applies the same pattern to one person's reading history: definitions and occurrences accumulate from actual encounters.

## Privacy and architecture

- Dictionary data stays in ordinary Markdown files in your vault.
- Review state is stored in `lexis-*` frontmatter fields.
- The optional bridge listens only on a configurable loopback port and requires a token.
- The browser and Zotero companions do not become separate databases.
- Scanned PDFs without a text layer cannot be highlighted.
- Settings has top-right Reload and Check for updates actions. Checks contact GitHub only on click; a newer compatible release requires confirmation before downloading. Only the three plugin code assets are replaced, with rollback on failure. Development folders can reload but cannot self-update.

See the full [Lexis Privacy Policy](./PRIVACY.md).

## Development

The repository contains all three clients:

- Obsidian: `src/`, bundled to `main.js`
- Browser: `pkg/browser-extension/`
- Zotero: `pkg/zotero-extension/`

The Obsidian source is TypeScript. Run `npm install` once, then use `npm run typecheck`, `npm run build`, or `npm run dev`. Releases still contain the mobile-compatible `main.js`, `manifest.json`, and `styles.css` only.

Issues and contributions are welcome in the [GitHub repository](https://github.com/Heptazero/obsidian-lexis).
