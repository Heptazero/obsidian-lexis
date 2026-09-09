import type { TFile } from "obsidian";

export type Language = "zh" | "en";
export type HighlightStyle = "wavy" | "underline" | "background";
export type InlineClassificationMode = "heading" | "file";
export type EmptyNotePreset = "blank" | "occ";
export type CardFront = "note" | "cloze";
export type AnnotationImageLocation = "obsidian" | "custom";
export type ReviewContentMode = "notes" | "syntax" | "both";
export type ReviewScopeMode = "vocab" | "folder" | "hub" | "tag" | "current";
export type ClozeReviewMode = "separate" | "combined";
export type ReviewSortKey = "due" | "wordCount" | "modified" | "created" | "frequency" | "random";
export type ReviewSortDirection = "asc" | "desc";

export interface ReviewCardState {
  s?: number | null;
  d?: number | null;
  due?: string | null;
  last?: string | null;
  reps?: number | null;
  lapses?: number | null;
  history?: ReviewHistoryEvent[];
}

export interface ReviewOptions {
  scope?: ReviewScopeMode;
  folder?: string;
  hub?: string;
  tag?: string;
  file?: string;
  content?: ReviewContentMode;
  clozeMode?: ClozeReviewMode;
  sortBy?: ReviewSortKey;
  sortDirection?: ReviewSortDirection;
}

export interface SyntaxReviewCard {
  id: string;
  memberIds: string[];
  kind: "inline" | "bidirectional" | "block" | "cloze";
  front: string;
  back: string;
  line: number;
}

export interface ReviewItem {
  type: "note" | "syntax";
  file: TFile;
  card: ReviewCardState;
  syntax?: SyntaxReviewCard;
}

export interface ReviewStateSnapshot {
  note?: ReviewCardState | null;
  syntax?: Record<string, ReviewCardState | null>;
}

export interface DictionarySetting {
  folder: string;
  template: string;
  highlight?: boolean;
  color?: string;
  opacity?: number;
}

export interface TagRule {
  tag: string;
  color?: string;
  style?: HighlightStyle | "";
  opacity?: number;
}

export interface ReviewHistoryEvent {
  date: string;
  s: number;
  grade: number;
  retention: number;
}

export interface LexisSettings {
  legacySettingsImported?: boolean;
  language: Language;
  vocabTags: string;
  includeAliases: boolean;
  aliasSources: string;
  inlineEntriesEnabled: boolean;
  inlineEntryDelimiter: string;
  inlineClassificationMode: InlineClassificationMode;
  inlineCategoryColors: Record<string, string>;
  inlineCategoryOpacity: Record<string, number>;
  inlineCategoryHighlight: Record<string, boolean>;
  inlineFileColors: Record<string, string>;
  inlineFileOpacity: Record<string, number>;
  inlineFileHighlight: Record<string, boolean>;
  inlineSourceHighlight: Record<string, boolean>;
  inlineCollapsedGroups: Record<string, boolean>;
  inlineCategoryOrder: string[];
  inlineFileOrder: string[];
  inlineCategoryOrderByParent: Record<string, string[]>;
  enableHighlight: boolean;
  enableLivePreview: boolean;
  highlightStyle: HighlightStyle;
  highlightColor: string;
  highlightOpacity: number;
  popoverWidth: number;
  popoverMaxHeight: number;
  popoverFontSize: number;
  hoverDelayMs: number;
  fadeByMemory: boolean;
  fadeFloor: number;
  hoverFeedback: boolean;
  hoverFeedbackDays: number;
  retireCandidateDays: number;
  tagRules: TagRule[];
  showRelated: boolean;
  showOccurrences: boolean;
  includePdfOccurrences: boolean;
  occurrenceLimit: number;
  occurrenceFolders: string;
  requestRetention: number;
  newPerDay: number;
  maxReviewsPerSession: number;
  reviewLog: Record<string, number>;
  reviewHistory: Record<string, ReviewHistoryEvent[]>;
  syntaxCardStates: Record<string, ReviewCardState>;
  showReviewMetadata: boolean;
  flashcardInlineTemplate: string;
  flashcardBidirectionalTemplate: string;
  flashcardBlockTemplate: string;
  flashcardClozeTemplate: string;
  newWordTemplate: string;
  emptyNotePreset: EmptyNotePreset;
  occurrenceTemplate: string;
  annotationHeading: string;
  annotationImageLocation: AnnotationImageLocation;
  annotationImageFolder: string;
  cardFront: CardFront;
  reviewBottomSpace: number;
  lastReviewHub: string;
  bridgeEnabled: boolean;
  bridgePort: number;
  bridgeToken: string;
  selectionPill: boolean;
  lastSelectionFolder: string;
  enablePdfHighlight: boolean;
  dicts: DictionarySetting[];
  vocabFolders: string;
  excludeTags: string;
  vocabFolder?: string;
  excludeTag?: string;
  tagRulesText?: string;
}

export interface HeadingRef {
  name: string;
  level: number;
  line: number;
}

export interface LexisEntry {
  display: string;
  file: TFile;
  isAlias: boolean;
  tags: Set<string>;
  archived?: boolean;
  retired?: boolean;
  pinned?: boolean;
  cardS?: number | null;
  inline?: boolean;
  annotation?: string;
  category?: string;
  categories?: string[];
  headingPath?: HeadingRef[];
  line?: number;
}

export interface InlineCategoryOccurrence {
  id: string;
  name: string;
  level: number;
  line: number;
  file: TFile;
  count: number;
}

export interface LexisStats {
  words: number;
  aliases: number;
  inlineEntries: number;
  due: number;
}

export interface BridgeWord {
  key: string;
  word: string;
  alias: boolean;
  inline: boolean;
  tags: string[];
  file?: string;
  color: string;
  opacity: number;
  visible: boolean;
  wstyle: HighlightStyle;
}
