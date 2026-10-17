# Companion clients

This directory contains independently installed Lexis companion clients. The browser and Zotero clients use the local Obsidian bridge; MarginNote imports a read-only dictionary snapshot.

- `browser-extension/`: Chromium extension
- `zotero-extension/`: Zotero add-on
- `marginnote-extension/`: MarginNote 4 addon for iPad/macOS (first test build; device validation pending)

Keeping companion clients under `pkg/` prevents Obsidian's community-plugin scanner from treating their browser-specific styles and APIs as part of the Obsidian runtime.
