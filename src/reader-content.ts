"use strict";

import type { App, Component as ObsidianComponent, TFile as ObsidianTFile } from "obsidian";
import { maskSyntaxAnswers } from "./flashcard-syntax";
import type { LexisEntry, LexisSettings } from "./types";

interface ReaderContentDependencies {
  boundedSource: (value: string) => string;
  Component: typeof ObsidianComponent;
  renderLexisMarkdown: (app: App, markdown: string, element: HTMLElement, sourcePath: string, component: ObsidianComponent) => Promise<void>;
}

function createReaderContent({ boundedSource, Component, renderLexisMarkdown }: ReaderContentDependencies): PropertyDescriptorMap {
  class ReaderContent {
    declare app: App;
    declare settings: LexisSettings;

    boldMatchesInPlace(el: HTMLElement, word: string): void {
      const re = new RegExp(boundedSource(word), "ig");
      const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const targets: Text[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) if (node.nodeType === Node.TEXT_NODE) targets.push(node as Text);
      for (const target of targets) {
        const text = target.nodeValue || "";
        re.lastIndex = 0;
        if (!re.test(text)) continue;
        re.lastIndex = 0;
        const fragment = createFragment();
        let last = 0;
        let match = re.exec(text);
        while (match) {
          if (match.index > last) fragment.appendChild(el.ownerDocument.createTextNode(text.slice(last, match.index)));
          const bold = el.createEl("b");
          bold.textContent = match[0];
          fragment.appendChild(bold);
          last = match.index + match[0].length;
          if (match[0].length === 0) re.lastIndex++;
          match = re.exec(text);
        }
        if (last < text.length) fragment.appendChild(el.ownerDocument.createTextNode(text.slice(last)));
        target.parentNode?.replaceChild(fragment, target);
      }
    }

    async renderSentence(el: HTMLElement, sentence: string, word: string, comp?: ObsidianComponent | null): Promise<void> {
      el.empty();
      const useComp = comp || new Component();
      if (!comp) useComp.load();
      await renderLexisMarkdown(this.app, sentence, el, "", useComp);
      this.boldMatchesInPlace(el, word);
    }

    compactSections(markdown: string): string {
      return markdown.replace(/^#{2,6}[ \t].*\n(?:[ \t]*\n)*(?=#{1,6}[ \t]|$)/gm, "").trim();
    }

    stripForPreview(content: string): string {
      return content.replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/```dataviewjs[\s\S]*?```/g, "").replace(/```dataview[\s\S]*?```/g, "").replace(/```(?:lexis|rel)\b[\s\S]*?```/g, "").trim();
    }

    async renderNoteInto(el: HTMLElement, file: ObsidianTFile, comp: ObsidianComponent, keepLexis = false, maskAnswers = false): Promise<void> {
      const raw = await this.app.vault.cachedRead(file);
      let stripped = raw.replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/```dataviewjs[\s\S]*?```/g, "").replace(/```dataview[\s\S]*?```/g, "");
      if (!keepLexis) stripped = stripped.replace(/```(?:lexis|rel)\b[\s\S]*?```/g, "");
      if (maskAnswers) stripped = maskSyntaxAnswers(stripped, {
        inline: this.settings.flashcardInlineTemplate,
        bidirectional: this.settings.flashcardBidirectionalTemplate,
        block: this.settings.flashcardBlockTemplate,
        cloze: this.settings.flashcardClozeTemplate,
      });
      const markdown = this.compactSections(stripped.trim()) || "*(空)*";
      el.empty();
      await renderLexisMarkdown(this.app, markdown, el, file.path, comp);
      const headings = el.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6");
      const emptyHeadings: HTMLElement[] = [];
      for (let index = 0; index < headings.length; index++) {
        const heading = headings[index];
        const next = headings[index + 1] || null;
        let sibling = heading.nextElementSibling;
        let hasContent = false;
        while (sibling && sibling !== next) {
          if ((sibling.textContent || "").trim() || sibling.querySelector(".lexis-section-title,.lexis-curve,.lexis-related,.lexis-occ,.lexis-occ-details,img,svg,video,iframe")) { hasContent = true; break; }
          sibling = sibling.nextElementSibling;
        }
        if (!hasContent) emptyHeadings.push(heading);
      }
      for (const heading of emptyHeadings) heading.remove();
    }

    async renderInlineEntryInto(el: HTMLElement, entry: LexisEntry, comp: ObsidianComponent): Promise<void> {
      el.empty();
      const content = el.createDiv({ cls: "lexis-inline-annotation" });
      await renderLexisMarkdown(this.app, entry.annotation || "*(无批注)*", content, entry.file.path, comp);
    }
  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(ReaderContent.prototype);
  return descriptors;
}

export { createReaderContent };
