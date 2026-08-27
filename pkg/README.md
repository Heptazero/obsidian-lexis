# Companion clients

This directory contains the browser and Zotero clients. They share Lexis data through the local Obsidian bridge, but are built and installed independently from the Obsidian plugin.

- `browser-extension/`: Chromium extension
- `zotero-extension/`: Zotero add-on

Keeping companion clients under `pkg/` prevents Obsidian's community-plugin scanner from treating their browser-specific styles and APIs as part of the Obsidian runtime.
