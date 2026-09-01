# Lexis

[简体中文](./README.zh-CN.md)

Lexis is a local-first personal lexicon for Obsidian. Your notes are the database: no account, hosted service, or proprietary store is required.

## What it does

### Store entries as files or inside a note

- **One file per entry.** Point Lexis at one or more folders. Each note title becomes an entry; frontmatter aliases are indexed too.
- **Many entries in one file.** Mark a note with `lexis-inline: true`, then write `Name:: annotation`. This is useful for recurring characters, places, objects, and factions in a novel without creating hundreds of tiny files.

```md
---
lexis-inline: true
---

## Characters
Yalda:: A painter who appears under several names.
Otto:: Keeps the notebook everyone else forgets.
```

### Read with the same lexicon everywhere

Lexis highlights known entries and shows their notes on hover in:

- Obsidian Markdown, Live Preview, and the built-in PDF viewer
- compatible epub.js-based EPUB readers
- Chromium browsers through **Lexis Web**
- Zotero Reader through **Lexis for Zotero**

Selected text can be added to a dictionary, saved as an occurrence, or attached as an alias. Obsidian remains the source of truth; the browser and Zotero companions communicate with it over an authenticated loopback-only bridge.

Each Obsidian dictionary has its own highlight switch. Lexis Web keeps a separate visibility profile for each website: open the extension popup to show or hide dictionaries on the current site. Browser choices do not overwrite Obsidian settings, and the current page updates immediately.
<img width="727" height="465" alt="image" src="https://github.com/user-attachments/assets/d274dd14-7bd7-4003-9da6-3a7f8db02b06" />

### Review what still needs memory

- FSRS spaced repetition with note and occurrence-cloze cards
- due/new counts, review heatmap, undo, skip, and tag-filtered sessions
- highlights that fade as memory stability grows
- real reading encounters that can pull a distant review closer
- retirement candidates based on long absence, with the final decision always left to you

## Install

### Obsidian

Install **Lexis** from *Settings → Community plugins → Browse*. For manual installation, download `main.js`, `manifest.json`, and `styles.css` from the [latest Obsidian release](https://github.com/Heptazero/obsidian-lexis/releases/latest) into `<vault>/.obsidian/plugins/lexis/`.

### Browser companion

1. Download `lexis-web-*.zip` from the latest [`browser-v*` release](https://github.com/Heptazero/obsidian-lexis/releases?q=browser-v).
2. Extract it, open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
3. Enable *Local bridge* in Lexis settings, then copy its port and access token into Lexis Web.

Chrome does not auto-update unpacked extensions. Replace the extracted folder with a newer browser release when needed.

### Zotero companion

1. Download `lexis-zotero-*.xpi` from the latest [`zotero-v*` release](https://github.com/Heptazero/obsidian-lexis/releases?q=zotero-v).
2. In Zotero, open *Tools → Plugins*, choose *Install Plugin From File*, and select the XPI.
3. Enter the same local bridge port and token in Lexis for Zotero.

After the first manual installation, Zotero can update the add-on from its update feed.

## Quick start

1. In *Settings → Lexis*, add one or more dictionary folders.
2. Read a Markdown, PDF, or EPUB document. Matching entries are highlighted; hover to open the card.
3. Select unfamiliar text and add it to a dictionary. Lexis can save the surrounding sentence as an occurrence.
4. Open **Lexis Home** to review due entries or inspect retirement candidates.

The interface language can be switched between Chinese and English in Lexis settings. Translations are kept together by message key in `src/i18n.ts`, so adding another language does not require searching through the UI code.

## Note blocks

Use a `lexis` code block to render memory, relationship, and occurrence data inside an entry note:

- `curve` — retention curve
- `rel [type]` — typed bidirectional relations
- `occ` — unsaved occurrences
- `derived` — root-derived entries
- blank — all applicable sections

Use `lexis-home` for a compact home summary, or `lexis-heatmap` for the heatmap alone.

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

## Development

The repository contains all three clients:

- Obsidian: `src/`, bundled to `main.js`
- Browser: `pkg/browser-extension/`
- Zotero: `pkg/zotero-extension/`

The Obsidian source is TypeScript. Run `npm install` once, then use `npm run typecheck`, `npm run build`, or `npm run dev`. Releases still contain the mobile-compatible `main.js`, `manifest.json`, and `styles.css` only.

Issues and contributions are welcome in the [GitHub repository](https://github.com/Heptazero/obsidian-lexis).
