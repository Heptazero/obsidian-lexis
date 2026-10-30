/* Generated from TypeScript source. Edit src/, not main.js. */
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => main_default
});
module.exports = __toCommonJS(main_exports);
var obsidian8 = __toESM(require("obsidian"));
var import_obsidian47 = require("obsidian");

// src/constants.ts
var LEXIS_REVIEW_VIEW = "lexis-review-view";
var LEXIS_HOME_VIEW = "lexis-home-view";
var LEXIS_LOG_VIEW = "lexis-log-view";
var LEXIS_BRIDGE_DEFAULT_PORT = 12345;

// src/inline-entry-parser.ts
var DEFAULT_INLINE_ENTRY_DELIMITER = "=>";
function splitInlineAliases(value, delimiter) {
  const token = String(delimiter || "/").trim() || "/";
  const parts = [];
  let current = "";
  for (let index = 0; index < value.length; ) {
    if (value[index] === "\\" && value.slice(index + 1, index + 1 + token.length) === token) {
      current += token;
      index += token.length + 1;
      continue;
    }
    if (value.slice(index, index + token.length) === token) {
      parts.push(current.trim());
      current = "";
      index += token.length;
      continue;
    }
    current += value[index];
    index++;
  }
  parts.push(current.trim());
  const seen = /* @__PURE__ */ new Set();
  return parts.filter((part) => {
    const key = part.toLowerCase();
    if (!part || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function parseInlineEntries(content, file, syntax) {
  const entryDelimiter = String(syntax.entryDelimiter || DEFAULT_INLINE_ENTRY_DELIMITER).trim() || DEFAULT_INLINE_ENTRY_DELIMITER;
  const lines = String(content || "").split(/\r?\n/);
  let firstContentLine = 0;
  if (lines[0]?.trim() === "---") {
    const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
    if (end >= 0) firstContentLine = end + 1;
  }
  const entries = [];
  const headingStack = [];
  let inFence = false;
  for (let lineNo = firstContentLine; lineNo < lines.length; lineNo++) {
    const line = lines[lineNo];
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const heading = /^\s*(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      headingStack.length = level;
      headingStack[level - 1] = { name: heading[2].trim(), level, line: lineNo };
      continue;
    }
    const at = line.indexOf(entryDelimiter);
    if (at < 0) continue;
    const left = line.slice(0, at).trim().replace(/^[-*+]\s+/, "");
    const annotation = line.slice(at + entryDelimiter.length).trim();
    if (!left || /^#/.test(left) || left.toLowerCase() === "color") continue;
    const colorMatch = /\s+\{([^{}\n]+)\}\s*$/.exec(left);
    const colorToken = colorMatch?.[1].trim() || "";
    const names = colorMatch ? left.slice(0, colorMatch.index).trim() : left;
    const [display, ...aliases] = splitInlineAliases(names, syntax.aliasDelimiter);
    if (!display) continue;
    const headingPath = headingStack.filter(Boolean).map((item) => ({ ...item }));
    const categoryPath = headingPath.map((item) => item.name);
    entries.push({
      display,
      aliases,
      file,
      isAlias: false,
      tags: /* @__PURE__ */ new Set(),
      inline: true,
      annotation,
      colorToken,
      category: categoryPath[categoryPath.length - 1] || "",
      categoryPath,
      headingPath,
      line: lineNo
    });
  }
  return entries;
}

// src/default-settings.ts
var DEFAULT_SETTINGS = {
  language: "zh",
  marginNoteExportFolder: "Lexis-export",
  marginNoteAutoExport: false,
  marginNoteSources: null,
  marginNoteFollowVisibility: false,
  statusBarVisible: true,
  statusBarExpanded: false,
  vocabTags: "",
  includeAliases: true,
  aliasSources: "",
  inlineEntriesEnabled: true,
  inlineEntryDelimiter: DEFAULT_INLINE_ENTRY_DELIMITER,
  inlineAliasDelimiter: "/",
  inlineClassificationMode: "heading",
  inlineHeadingLevel: 2,
  inlineCategoryColors: {},
  inlineCategoryOpacity: {},
  inlineCategoryHighlight: {},
  inlineFileColors: {},
  inlineFileOpacity: {},
  inlineFileHighlight: {},
  inlineSourceHighlight: {},
  inlineCollapsedGroups: {},
  inlineSettingsCollapsed: { "entry-colors": true, classification: true },
  inlineCategoryOrder: [],
  inlineFileOrder: [],
  inlineCategoryOrderByParent: {},
  settingsSectionOrder: [],
  settingsActiveTab: "general",
  settingsTabOrder: [],
  settingsTabAssignments: {},
  settingsGroupOrder: {},
  settingsTabNames: {},
  settingsCustomTabs: [],
  enableHighlight: true,
  highlightMode: "automatic",
  enableLivePreview: true,
  highlightStyle: "wavy",
  highlightColor: "",
  highlightOpacity: 1,
  popoverWidth: 460,
  popoverMaxHeight: 420,
  popoverFontSize: 0,
  popoverEditMode: "inline",
  hoverDelayMs: 250,
  clickHighlightToOpen: true,
  mobileTapAction: "popover",
  fadeByMemory: true,
  fadeFloor: 0.25,
  hoverFeedback: true,
  hoverFeedbackDays: 3,
  retireCandidateDays: 90,
  dataFolder: "",
  reviewEventsRetentionDays: 90,
  reviewRetentionConfirmed: false,
  homeRetireCollapsed: true,
  homeSuspendedCollapsed: true,
  homeArchivedCollapsed: true,
  entryColors: [],
  tagRules: [],
  showRelated: true,
  showOccurrences: true,
  includePdfOccurrences: true,
  occurrenceLimit: 6,
  occurrenceFolders: "",
  requestRetention: 0.9,
  newPerDay: 20,
  maxReviewsPerSession: 200,
  reviewDailyGoal: 30,
  reviewMinimumGoal: 10,
  reviewPlans: [],
  reviewDailyTargets: {},
  reviewGoalHistory: {},
  reviewLog: {},
  reviewHistory: {},
  reviewEvents: [],
  reviewAddedAt: {},
  reviewCardMeta: {},
  reviewCatalogInitialized: false,
  reviewPriorities: {},
  syntaxCardStates: {},
  suspendedReviewItems: {},
  showReviewMetadata: false,
  flashcardInlineTemplate: "{{question}}::{{answer}}",
  flashcardBidirectionalTemplate: "{{sideA}}:::{{sideB}}",
  flashcardBlockTemplate: "{{question}}??\n{{answer}}",
  flashcardClozeTemplate: "=={{answer}}==",
  newWordTemplate: "template/\u5355\u8BCD\u6A21\u677F.md",
  emptyNotePreset: "blank",
  occurrenceTemplate: "#### \u51FA\u5904\n> {{sentence}}{{sourceSuffix}}",
  annotationHeading: "",
  annotationImageLocation: "obsidian",
  annotationImageFolder: "",
  cardFront: "note",
  reviewBottomSpace: 70,
  reviewLinkMode: "current",
  lastReviewLinkSource: "",
  lastReviewHub: "",
  bridgeEnabled: false,
  bridgePort: LEXIS_BRIDGE_DEFAULT_PORT,
  bridgeToken: "",
  selectionPill: true,
  selectionPillOrder: "add-dictionary-alias",
  selectionPillOffsetX: 0,
  selectionPillOffsetY: 0,
  selectionPillScale: 1,
  lastSelectionFolder: "",
  enablePdfHighlight: true
};

// src/dictionary-sources.ts
var sourcePath = (value) => value.trim().normalize("NFC").replace(/^\/+|\/+$/g, "");
var sourceLabel = (source) => source.kind === "tag" ? `#${source.value}` : source.kind === "links" ? `\u2197 ${source.value}` : source.value;
var sourceKey = (source) => `${source.kind}:${source.value}`;
function dictionarySources(dictionary) {
  const sources2 = dictionary.sources ?? [
    ...dictionary.folder ? [{ kind: "folder", value: dictionary.folder }] : [],
    ...(dictionary.tag || "").split(/[,，;；\s]+/).filter(Boolean).map((value) => ({ kind: "tag", value }))
  ];
  const unique = /* @__PURE__ */ new Map();
  for (const source of sources2) {
    const value = source.kind === "tag" ? source.value.trim().replace(/^#/, "").toLowerCase() : sourcePath(source.value);
    if (value)
      unique.set(`${source.kind}:${value}`, { kind: source.kind, value });
  }
  return [...unique.values()];
}
var dictionaryId = (dictionary) => dictionary.id || dictionarySources(dictionary).map(sourceKey).join("|");
var dictionaryName = (dictionary) => dictionary.name?.trim() || dictionarySources(dictionary).map(sourceLabel).join(" + ");
function dictionarySourceScore(source, filePath, tags) {
  const path = filePath.normalize("NFC");
  if (source.kind === "file") return path === source.value ? 1e5 : 0;
  if (source.kind === "folder") return path.startsWith(`${source.value}/`) ? source.value.length : 0;
  if (source.kind === "tag") return tags?.has(source.value) ? 1e4 : 0;
  return 0;
}
function renameDictionaryPaths(dictionaries, before, after) {
  const oldPath = sourcePath(before), newPath = sourcePath(after);
  let changed = false;
  const rename = (value) => {
    const normalized3 = sourcePath(value);
    if (normalized3 !== oldPath && !normalized3.startsWith(`${oldPath}/`)) return value;
    changed = true;
    return newPath + normalized3.slice(oldPath.length);
  };
  for (const row of dictionaries) {
    row.folder = rename(row.folder);
    row.template = rename(row.template);
    for (const source of row.sources || []) if (source.kind !== "tag") source.value = rename(source.value);
  }
  return changed;
}
function linkedMarkdownFiles(app, sourcePath2) {
  const source = app.vault.getFileByPath(sourcePath2);
  if (!source)
    return [];
  const files = /* @__PURE__ */ new Map();
  for (const link of app.metadataCache.getFileCache(source)?.links || []) {
    const file = app.metadataCache.getFirstLinkpathDest(link.link, source.path);
    if (file?.extension === "md" && file.path !== source.path)
      files.set(file.path, file);
  }
  return [...files.values()];
}
function resolveDictionaries(app, dictionaries, getTags, files = app.vault.getMarkdownFiles()) {
  const paths = /* @__PURE__ */ new Map();
  const specificity = /* @__PURE__ */ new Map();
  const byFile = /* @__PURE__ */ new Map();
  const tags = /* @__PURE__ */ new Map();
  for (const dictionary of dictionaries) {
    const included = /* @__PURE__ */ new Set();
    const scores = /* @__PURE__ */ new Map();
    const include = (path, score) => {
      included.add(path);
      scores.set(path, Math.max(scores.get(path) || 0, score));
    };
    for (const source of dictionarySources(dictionary)) {
      if (source.kind === "links")
        for (const file of linkedMarkdownFiles(app, source.value))
          include(file.path, 5e4);
      else
        for (const file of files) {
          if (source.kind === "tag" && !tags.has(file.path))
            tags.set(file.path, getTags(file));
          const score = dictionarySourceScore(source, file.path, tags.get(file.path));
          if (score) include(file.path, score);
        }
    }
    paths.set(dictionaryId(dictionary), included);
    specificity.set(dictionary, scores);
    for (const path of included) {
      const rows = byFile.get(path) || [];
      rows.push(dictionary);
      byFile.set(path, rows);
    }
  }
  return { paths, byFile, specificity, files };
}
function preferredDictionary(snapshot, path) {
  const matches = snapshot.byFile.get(path) || [];
  const enabled = matches.filter((row) => row.highlight !== false);
  let best = null, score = -1;
  for (const row of enabled.length ? enabled : matches) {
    const candidate = snapshot.specificity.get(row)?.get(path) || 0;
    if (candidate > score) {
      best = row;
      score = candidate;
    }
  }
  return best;
}

// src/dictionary-migration.ts
function migrateDictionaryCollections(settings) {
  let changed = false;
  const configuredTags = new Set(settings.dicts.flatMap((row) => dictionarySources(row).filter((source) => source.kind === "tag").map((source) => source.value)));
  for (const source of dictionarySources({ folder: "", template: "", tag: settings.vocabTags || "" })) {
    if (!configuredTags.has(source.value)) {
      settings.dicts.push({ folder: "", template: "", sources: [source] });
      configuredTags.add(source.value);
    }
  }
  if (settings.vocabTags) {
    settings.vocabTags = "";
    changed = true;
  }
  const ids = /* @__PURE__ */ new Set();
  const stableId2 = (row, index) => {
    let hash = 2166136261;
    for (const character of `${index}:${dictionaryId(row)}`)
      hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return `dictionary-${(hash >>> 0).toString(36)}`;
  };
  for (const [index, row] of settings.dicts.entries()) {
    if (!row.sources) {
      row.sources = dictionarySources(row);
      changed = true;
    }
    if (!row.id || ids.has(row.id)) {
      row.id = stableId2(row, index);
      changed = true;
    }
    ids.add(row.id);
    if (row.tag !== void 0) {
      delete row.tag;
      changed = true;
    }
  }
  const findOrAdd = (source) => {
    source = dictionarySources({ folder: "", template: "", sources: [source] })[0];
    if (!source) return "";
    const existing = settings.dicts.find((row2) => {
      const sources2 = dictionarySources(row2);
      return sources2.length === 1 && sourceKey(sources2[0]) === sourceKey(source);
    });
    if (existing)
      return existing.id;
    const row = { folder: source.kind === "folder" ? source.value : "", template: "", sources: [source], highlight: false };
    row.id = stableId2(row, settings.dicts.length);
    settings.dicts.push(row);
    changed = true;
    return row.id;
  };
  for (const plan of settings.reviewPlans || []) {
    if (plan.dictionaryIds !== void 0 || plan.scope !== void 0)
      continue;
    let all = false;
    const selected = /* @__PURE__ */ new Set();
    for (const source of plan.sources || []) {
      if (source.scope === "vocab" && !source.value) {
        all = true;
        continue;
      }
      const id = findOrAdd({ kind: source.scope === "vocab" ? "folder" : source.scope, value: source.value });
      if (id) selected.add(id);
    }
    plan.dictionaryIds = all ? null : [...selected];
    delete plan.sources;
    changed = true;
  }
  if (Array.isArray(settings.marginNoteSources)) {
    settings.marginNoteSources = settings.marginNoteSources.flatMap((id) => {
      const match = /^(folder|tag):(.*)$/.exec(id);
      if (!match)
        return id;
      changed = true;
      const dictionary = findOrAdd({ kind: match[1], value: match[2] });
      return dictionary ? [`dictionary:${dictionary}`] : [];
    });
  }
  return changed;
}

// src/fsrs.ts
var WEIGHTS = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 46e-4, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
var DECAY = -0.5;
var FACTOR = Math.pow(0.9, 1 / DECAY) - 1;
var MAX_INTERVAL = 36500;
var FSRS = {
  clampD: (difficulty) => Math.min(10, Math.max(1, difficulty)),
  initStability: (grade) => Math.max(0.1, WEIGHTS[grade - 1]),
  initDifficulty(grade) {
    return FSRS.clampD(WEIGHTS[4] - Math.exp(WEIGHTS[5] * (grade - 1)) + 1);
  },
  linearDamping: (delta, difficulty) => delta * (10 - difficulty) / 9,
  meanReversion: (initial, current) => WEIGHTS[7] * initial + (1 - WEIGHTS[7]) * current,
  nextDifficulty(difficulty, grade) {
    const delta = -WEIGHTS[6] * (grade - 3);
    const next = difficulty + FSRS.linearDamping(delta, difficulty);
    return FSRS.clampD(FSRS.meanReversion(FSRS.initDifficulty(4), next));
  },
  retrievability(elapsedDays, stability) {
    return Math.pow(1 + FACTOR * elapsedDays / stability, DECAY);
  },
  nextRecallStability(difficulty, stability, retrievability, grade) {
    const hardPenalty = grade === 2 ? WEIGHTS[15] : 1;
    const easyBonus = grade === 4 ? WEIGHTS[16] : 1;
    return stability * (1 + Math.exp(WEIGHTS[8]) * (11 - difficulty) * Math.pow(stability, -WEIGHTS[9]) * (Math.exp((1 - retrievability) * WEIGHTS[10]) - 1) * hardPenalty * easyBonus);
  },
  nextForgetStability(difficulty, stability, retrievability) {
    return WEIGHTS[11] * Math.pow(difficulty, -WEIGHTS[12]) * (Math.pow(stability + 1, WEIGHTS[13]) - 1) * Math.exp((1 - retrievability) * WEIGHTS[14]);
  },
  nextInterval(stability, retention) {
    const interval = stability / FACTOR * (Math.pow(retention, 1 / DECAY) - 1);
    return Math.min(MAX_INTERVAL, Math.max(1, Math.round(interval)));
  }
};

// src/home-view.ts
var import_obsidian7 = require("obsidian");

// src/review-dashboard-view.ts
var import_obsidian5 = require("obsidian");

// src/review-log-data.ts
function migrateReviewEvents(history) {
  const events = [];
  for (const [key, entries] of Object.entries(history)) {
    if (!Array.isArray(entries)) continue;
    const syntax = key.startsWith("syntax:");
    entries.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || !Number.isFinite(entry.grade)) return;
      events.push({
        id: `legacy:${key}:${index}`,
        date: entry.date,
        timestamp: `${entry.date}T00:00:00`,
        precision: "day",
        type: syntax ? "syntax" : "note",
        filePath: syntax ? "" : key,
        label: syntax ? "" : key.split("/").pop()?.replace(/\.md$/i, "") || key,
        memberKeys: [key],
        grade: entry.grade,
        retention: entry.retention
      });
    });
  }
  return events.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}
function weekStart(date) {
  const parsed = /* @__PURE__ */ new Date(`${date}T12:00:00`);
  parsed.setDate(parsed.getDate() - (parsed.getDay() + 6) % 7);
  return localDate(parsed);
}
function addDays(date, days) {
  const parsed = /* @__PURE__ */ new Date(`${date}T12:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return localDate(parsed);
}
function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function firstAttemptSuccess(events) {
  const seen = /* @__PURE__ */ new Set();
  let correct = 0;
  for (const event of events) {
    const key = `${event.date}:${event.memberKeys.join("|")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (event.grade > 1) correct++;
  }
  return { correct, total: seen.size };
}

// src/review-item.ts
var noteSuspensionKey = (path) => `note:${path}`;
var syntaxSuspensionKey = (id) => `syntax:${id}`;
var reviewGroupState = (states) => {
  if (!states.length || states.some((state) => state.s == null || !Number.isFinite(Number(state.s)))) return {};
  return [...states].sort((left, right) => String(left.due || "").localeCompare(String(right.due || "")))[0];
};
var reviewItemKeys = (item) => item.type === "note" ? [item.file.path] : (item.syntax?.memberIds || []).map((id) => `syntax:${id}`);
var restrictReviewItem = (item, allowed) => {
  if (item.type === "note") return allowed.has(item.file.path) ? item : null;
  const ids = (item.syntax?.memberIds || []).filter((id) => allowed.has(`syntax:${id}`));
  if (!ids.length || !item.syntax) return null;
  const members = item.syntax.members?.filter((member) => ids.includes(member.id));
  if (members?.length) return itemForMembers(item, members, members.length === 1 ? members[0].front : item.syntax.combinedFront || item.syntax.front);
  return { ...item, syntax: { ...item.syntax, memberIds: ids } };
};
var reviewItemSuspensionKeys = (item) => item.type === "note" ? [noteSuspensionKey(item.file.path)] : (item.syntax?.memberIds || []).map(syntaxSuspensionKey);
var itemForMembers = (item, members, front) => ({
  ...item,
  card: members.length === 1 ? { ...members[0].card } : reviewGroupState(members.map((member) => member.card)),
  syntax: item.syntax ? {
    ...item.syntax,
    id: members.length === 1 ? members[0].id : item.syntax.id,
    memberIds: members.map((member) => member.id),
    members,
    front,
    clozeAnswer: members.length === 1 ? members[0].answer : void 0,
    clozeIndex: members.length === 1 ? members[0].clozeIndex : void 0
  } : void 0
});
var chooseClozeRevealMode = (item, mode) => {
  const syntax = item.syntax;
  const members = syntax?.kind === "cloze" ? syntax.members || [] : [];
  if (members.length < 2) return { current: item, remaining: [] };
  if (mode === "all") {
    return { current: itemForMembers(item, members, syntax?.combinedFront || syntax?.front || ""), remaining: [] };
  }
  const [current, ...rest] = members;
  return {
    current: itemForMembers(item, [current], current.front),
    remaining: rest.map((member) => itemForMembers(item, [member], member.front))
  };
};

// src/review-progress.ts
function latestReviewGrades(events, date) {
  const grades = /* @__PURE__ */ new Map();
  const ordered = events.filter((event) => event.date === date).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  for (const event of ordered) for (const key of event.memberKeys) grades.set(key, event.grade);
  return grades;
}
function progressForKeys(keys, grades) {
  const unique = new Set(keys);
  let completed = 0, retry = 0;
  for (const key of unique) {
    const grade = grades.get(key);
    if (grade && grade > 1) completed++;
    else if (grade === 1) retry++;
  }
  return { completed, retry, remaining: unique.size - completed - retry, total: unique.size };
}
function sessionReviewProgress(queue, pos, events, date, suspended = {}, practiceGrades) {
  const active = (key) => !suspended[key.startsWith("syntax:") ? key : `note:${key}`];
  const all = new Set(queue.flatMap(reviewItemKeys).filter(active));
  const pending = new Set(queue.slice(pos).flatMap(reviewItemKeys).filter(active));
  const grades = practiceGrades ?? latestReviewGrades(events, date);
  let retry = 0;
  for (const key of pending) if (grades.get(key) === 1) retry++;
  return { total: all.size, completed: all.size - pending.size, retry, remaining: pending.size - retry };
}
function completedOnDate(events, date, allowed) {
  const grades = latestReviewGrades(events, date);
  return [...grades].filter(([key, grade]) => grade > 1 && (!allowed || allowed.has(key))).length;
}

// src/review-batch.ts
var reviewRounds = (options) => options.mode === "cram" ? Math.max(1, Math.floor(Number(options.rounds) || 1)) : 1;
function takeReviewBatch(items, count) {
  const keys = [...new Set(items.flatMap(reviewItemKeys))];
  const size = count == null ? keys.length : Math.max(0, Math.floor(count));
  const selectedKeys = new Set(keys.slice(0, size)), remainingKeys = new Set(keys.slice(size));
  const restrict = (allowed) => items.map((item) => restrictReviewItem(item, allowed)).filter((item) => !!item);
  return { selected: restrict(selectedKeys), remaining: restrict(remainingKeys) };
}
function practiceCounts(settings, planId, date) {
  const progress = planId ? settings.reviewPracticeProgress?.[planId] : void 0;
  return progress?.date === date ? progress.counts : {};
}
var ReviewBatch = class {
  constructor(pool, options, counts = {}) {
    this.grades = {};
    this.round = 1;
    const target = options.targetKeys ? new Set(options.targetKeys) : null;
    const eligible = target ? pool.map((item) => restrictReviewItem(item, target)).filter((item) => !!item) : pool;
    const size = options.dailyCardLimit == null ? options.batchSize : Math.min(options.dailyCardLimit, options.batchSize ?? Infinity);
    this.items = takeReviewBatch(eligible, size).selected;
    const selected = new Set(this.items.flatMap(reviewItemKeys));
    this.remaining = pool.map((item) => restrictReviewItem(item, new Set(reviewItemKeys(item).filter((key) => !selected.has(key))))).filter((item) => !!item);
    this.counts = { ...counts };
    this.rounds = reviewRounds(options);
    const minimum = Math.min(...this.items.flatMap(reviewItemKeys).map((key) => this.counts[key] || 0));
    if (Number.isFinite(minimum)) this.round = Math.min(this.rounds, minimum + 1);
  }
  queue(suspended = {}) {
    const allowed = new Set(this.items.flatMap(reviewItemKeys).filter((key) => (this.counts[key] || 0) < this.rounds && !suspended[key.startsWith("syntax:") ? key : `note:${key}`]));
    return this.items.map((item) => restrictReviewItem(item, allowed)).filter((item) => !!item);
  }
  nextRound(suspended = {}) {
    const next = this.queue(suspended);
    if (next.length) {
      this.round++;
      for (const key of Object.keys(this.grades)) delete this.grades[key];
    }
    return next;
  }
  async grade(item, grade, host, options, date) {
    const keys = reviewItemKeys(item), previous = options.planId ? host.settings.reviewPracticeProgress?.[options.planId] : void 0;
    const select = (values) => Object.fromEntries(keys.map((key) => [key, values[key] || 0]));
    const snapshot = {
      counts: select(this.counts),
      grades: select(this.grades),
      replaceStore: previous?.date !== date,
      stored: previous ? { date: previous.date, counts: previous.date === date ? select(previous.counts) : { ...previous.counts } } : void 0
    };
    for (const key of keys) {
      this.grades[key] = grade;
      if (grade > 1) this.counts[key] = (this.counts[key] || 0) + 1;
    }
    if (options.planId && grade > 1) {
      const store = host.settings.reviewPracticeProgress ||= {};
      const counts = { ...practiceCounts(host.settings, options.planId, date) };
      for (const key of reviewItemKeys(item)) counts[key] = (counts[key] || 0) + 1;
      store[options.planId] = { date, counts };
      try {
        await host.saveSettings();
      } catch (error) {
        this.restore(snapshot);
        if (previous) store[options.planId] = previous;
        else delete store[options.planId];
        throw error;
      }
    }
    host.reviewDashboard?.refresh();
    return snapshot;
  }
  restore(snapshot) {
    for (const [key, count] of Object.entries(snapshot.counts)) {
      if (count) this.counts[key] = count;
      else delete this.counts[key];
    }
    for (const [key, grade] of Object.entries(snapshot.grades)) {
      if (grade) this.grades[key] = grade;
      else delete this.grades[key];
    }
  }
};
function restorePracticeStore(store, id, snapshot) {
  if (!snapshot.stored) {
    delete store[id];
    return;
  }
  if (snapshot.replaceStore) {
    store[id] = snapshot.stored;
    return;
  }
  const counts = { ...store[id]?.counts };
  for (const [key, count] of Object.entries(snapshot.stored.counts)) {
    if (count) counts[key] = count;
    else delete counts[key];
  }
  store[id] = { date: snapshot.stored.date, counts };
}
function renamePracticeKey(settings, before, after) {
  if (before === after) return false;
  let changed = false;
  for (const progress of Object.values(settings.reviewPracticeProgress || {})) if (progress.counts[before] != null) {
    progress.counts[after] = Math.max(progress.counts[after] || 0, progress.counts[before]);
    delete progress.counts[before];
    changed = true;
  }
  for (const target of Object.values(settings.reviewDailyTargets || {})) if (target.keys.includes(before)) {
    target.keys = [...new Set(target.keys.map((key) => key === before ? after : key))];
    changed = true;
  }
  return changed;
}

// src/review-setup-model.ts
function reviewRange(options) {
  if (options.scope) {
    const { scope } = options;
    if (scope === "current") return { scope, file: options.file };
    if (scope === "tag") return { scope, tag: options.tag };
    if (scope === "links") return { scope, linkSource: options.linkSource };
    return { scope, folder: options.folder };
  }
  return options.dictionaryIds !== void 0 ? { dictionaryIds: options.dictionaryIds } : options.sources ? { sources: options.sources } : { dictionaryIds: null };
}
function validReviewOptions(options) {
  const count = options.batchSize;
  if (count != null && (!Number.isInteger(count) || count < 1)) return false;
  if (options.mode === "cram" && (!Number.isInteger(options.rounds ?? 1) || (options.rounds ?? 1) < 1)) return false;
  if (!options.scope && options.dictionaryIds !== void 0) return options.dictionaryIds === null || options.dictionaryIds.length > 0;
  if (options.scope === "current") return !!options.file?.trim();
  if (options.scope === "folder") return !!options.folder?.trim();
  if (options.scope === "tag") return !!options.tag?.replace(/^#/, "").trim();
  if (options.scope === "links") return !!options.linkSource?.trim();
  return true;
}
var deadlineDays = (deadline, today) => {
  if (!deadline) return null;
  const value = Date.parse(`${deadline}T00:00:00Z`), now = Date.parse(`${today}T00:00:00Z`);
  return Number.isFinite(value) && Number.isFinite(now) ? Math.round((value - now) / 864e5) : null;
};
function planSelectionChanged(previous, next) {
  const selection = (plan) => ({ ...reviewRange(plan), content: plan.content, mode: plan.mode || "scheduled", batchSize: plan.batchSize, rounds: plan.rounds, sortBy: plan.sortBy, sortDirection: plan.sortDirection });
  return !previous || JSON.stringify(selection(previous)) !== JSON.stringify(selection(next));
}
function renameReviewPlanPaths(plans, before, after) {
  const oldPath = before.normalize("NFC"), newPath = after.normalize("NFC");
  let changed = false;
  const rename = (path) => {
    const value = path.normalize("NFC");
    if (value !== oldPath && !value.startsWith(`${oldPath}/`)) return path;
    changed = true;
    return newPath + value.slice(oldPath.length);
  };
  for (const plan of plans) {
    for (const key of ["file", "folder", "linkSource"]) if (plan[key]) plan[key] = rename(plan[key]);
    for (const source of plan.sources || []) if (source.scope !== "tag") source.value = rename(source.value);
  }
  return changed;
}
function draftReviewPlan(options) {
  return { id: crypto.randomUUID(), name: "", ...reviewRange(options), content: options.content || "syntax", mode: options.mode, batchSize: options.batchSize, rounds: options.rounds, sortBy: options.sortBy, sortDirection: options.sortDirection };
}

// src/review-dashboard-data.ts
var planOptions = (plan) => {
  if (!plan) return { dictionaryIds: null, content: "notes" };
  return {
    ...reviewRange(plan),
    content: plan.content,
    ...plan.mode ? { mode: plan.mode } : {},
    ...plan.sortBy ? { sortBy: plan.sortBy } : {},
    ...plan.sortDirection ? { sortDirection: plan.sortDirection } : {},
    ...plan.batchSize !== void 0 ? { batchSize: plan.batchSize } : {},
    ...plan.mode === "cram" ? { planId: plan.id, rounds: reviewRounds(plan) } : {}
  };
};
var isFresh = (card) => card.s == null || !Number.isFinite(Number(card.s));
var isDue = (card, date) => !isFresh(card) && (!card.due || String(card.due).slice(0, 10) <= date);
function inventory(items) {
  const result = /* @__PURE__ */ new Map();
  for (const item of items) {
    if (item.syntax?.members?.length) for (const member of item.syntax.members) result.set(`syntax:${member.id}`, member.card);
    else for (const key of reviewItemKeys(item)) result.set(key, item.card);
  }
  return result;
}
function createDailyTarget(items, settings, date, options = {}) {
  const grades = latestReviewGrades(settings.reviewEvents, date);
  const entries = [...inventory(items)];
  if (options.mode === "cram") {
    const keys2 = entries.map(([key]) => key).slice(0, options.batchSize ?? entries.length);
    return { date, keys: keys2, goal: keys2.length * reviewRounds(options), minimum: 0 };
  }
  const completed = entries.filter(([key]) => (grades.get(key) || 0) > 1).map(([key]) => key);
  const due = entries.filter(([key, card]) => isDue(card, date) || grades.get(key) === 1).map(([key]) => key);
  const fresh = entries.filter(([key, card]) => isFresh(card) && !grades.has(key)).map(([key]) => key).slice(0, Math.max(0, settings.newPerDay));
  const keys = [.../* @__PURE__ */ new Set([...completed, ...due, ...fresh])];
  const goal = Math.min(keys.length, Math.max(0, options.batchSize ?? settings.reviewDailyGoal));
  return { date, keys, goal, minimum: Math.min(goal, Math.max(0, settings.reviewMinimumGoal)) };
}
function dashboardSummary(items, settings, target, options) {
  const grades = latestReviewGrades(settings.reviewEvents, target.date);
  const entries = inventory(items);
  const keys = target.keys.filter((key) => entries.has(key));
  if (options.mode === "cram") {
    const counts = practiceCounts(settings, options.planId, target.date), rounds = reviewRounds(options);
    const completed = keys.reduce((sum, key) => sum + Math.min(rounds, counts[key] || 0), 0), goal2 = keys.length * rounds;
    return {
      date: target.date,
      goal: goal2,
      minimum: 0,
      completed,
      remaining: Math.max(0, goal2 - completed),
      retry: 0,
      due: 0,
      fresh: 0,
      total: entries.size,
      options: { ...options, targetKeys: keys, batchSize: null }
    };
  }
  const progress = progressForKeys(entries.keys(), grades);
  const goal = Math.min(target.goal, keys.length);
  const uncompleted = [...entries].filter(([key]) => (grades.get(key) || 0) <= 1);
  return {
    date: target.date,
    goal,
    minimum: Math.min(target.minimum, goal),
    completed: progress.completed,
    remaining: Math.max(0, goal - progress.completed),
    retry: progress.retry,
    due: uncompleted.filter(([, card]) => isDue(card, target.date)).length,
    fresh: uncompleted.filter(([, card]) => isFresh(card)).length,
    total: entries.size,
    options: { ...options, targetKeys: keys, dailyCardLimit: Math.max(0, goal - progress.completed) }
  };
}
function mergeReviewItems(groups) {
  const items = /* @__PURE__ */ new Map();
  for (const group of groups) for (const item of group) items.set(reviewItemKeys(item).join("|"), item);
  return [...items.values()];
}

// src/review-plan-editor.ts
var import_obsidian4 = require("obsidian");

// src/review-setup-controls.ts
var obsidian = __toESM(require("obsidian"));
var import_obsidian3 = require("obsidian");

// src/settings-choice.ts
var import_obsidian = require("obsidian");
function addCurrentChoice(setting, options, value, onChange) {
  const button = setting.controlEl.createEl("button", { cls: "lexis-current-choice", attr: { type: "button" } });
  const label = button.createSpan();
  const icon = button.createSpan({ cls: "lexis-current-choice-icon" });
  (0, import_obsidian.setIcon)(icon, options.length === 2 ? "arrow-left-right" : "chevron-down");
  if (options.length > 2) button.setAttribute("aria-haspopup", "menu");
  const render = () => {
    label.setText(options.find((option) => option.value === value)?.label || options[0]?.label || "");
    button.setAttribute("aria-label", `${setting.nameEl.textContent || ""}: ${label.textContent || ""}`);
  };
  const choose = async (next) => {
    if (next === value || button.disabled) return;
    const previous = value;
    value = next;
    render();
    button.disabled = true;
    try {
      await onChange(next);
    } catch (error) {
      value = previous;
      render();
      throw error;
    } finally {
      button.disabled = false;
    }
  };
  button.addEventListener("click", () => {
    if (options.length === 2) {
      void choose(options.find((option) => option.value !== value).value);
      return;
    }
    const menu = new import_obsidian.Menu();
    for (const option of options) menu.addItem((item) => item.setTitle(option.label).setChecked(option.value === value).onClick(() => choose(option.value)));
    const rect = button.getBoundingClientRect();
    menu.showAtPosition({ x: rect.left, y: rect.bottom });
  });
  render();
  if (options.length < 2) button.disabled = true;
}

// src/settings-suggest.ts
function createPathSuggest(obsidian9) {
  class PathSuggest extends obsidian9.AbstractInputSuggest {
    constructor(app, inputEl, getItems, onPick, options = {}) {
      super(app, inputEl);
      this.inputEl = inputEl;
      this.getItems = getItems;
      this.onPick = onPick;
      this.multi = !!options.multi;
      this.fuzzy = !!options.fuzzy;
      this.sep = options.sep || " ";
    }
    splitInput() {
      const value = this.inputEl?.value || "";
      const match = value.match(/[^\s,，;；]*$/);
      const token = match ? match[0] : "";
      return { before: value.slice(0, value.length - token.length), token };
    }
    getSuggestions(query) {
      let items = this.getItems();
      let normalizedQuery;
      if (this.multi) {
        const { token } = this.splitInput();
        normalizedQuery = token.toLowerCase();
        const chosen = new Set((this.inputEl?.value || "").toLowerCase().split(/[\s,，;；]+/).filter(Boolean));
        items = items.filter((item) => item.toLowerCase() === normalizedQuery || !chosen.has(item.toLowerCase()));
      } else normalizedQuery = (query || "").toLowerCase();
      const match = this.fuzzy && normalizedQuery ? obsidian9.prepareFuzzySearch(normalizedQuery) : null;
      return items.filter((item) => match ? !!match(item) : item.toLowerCase().includes(normalizedQuery)).slice(0, 50);
    }
    renderSuggestion(value, element) {
      element.setText(value);
    }
    selectSuggestion(value) {
      if (this.multi) {
        const { before } = this.splitInput();
        const nextValue = before + value + this.sep;
        this.inputEl.value = nextValue;
        this.onPick(nextValue);
        this.setValue(nextValue);
        this.inputEl.focus();
        return;
      }
      this.setValue(value);
      this.inputEl.value = value;
      this.close();
      this.onPick(value);
    }
  }
  return PathSuggest;
}

// src/dictionary-picker.ts
var import_obsidian2 = require("obsidian");
var DictionarySuggest = class extends import_obsidian2.AbstractInputSuggest {
  constructor(app, input, dictionaries, pick) {
    super(app, input);
    this.dictionaries = dictionaries;
    this.pick = pick;
  }
  getSuggestions(query) {
    const match = (0, import_obsidian2.prepareFuzzySearch)(query.trim());
    return this.dictionaries.filter((row) => !query.trim() || match(dictionaryName(row))).slice(0, 50);
  }
  renderSuggestion(row, element) {
    element.setText(dictionaryName(row));
  }
  selectSuggestion(row) {
    this.setValue("");
    this.close();
    this.pick(row);
  }
};
function mountDictionaryPicker(parent, app, dictionaries, initial, changed, t) {
  let selected = initial === null ? null : [...initial];
  const root = parent.createDiv({ cls: "lexis-dictionary-picker" });
  const allLabel = root.createEl("label", { cls: "lexis-dictionary-all" });
  const all = allLabel.createEl("input", { type: "checkbox" });
  allLabel.createSpan({ text: t("home.scopeAllDictionaries") });
  const chips = root.createDiv({ cls: "lexis-dictionary-chips" });
  const input = root.createEl("input", { attr: { type: "search", placeholder: t("collection.choose"), "aria-label": t("collection.choose") } });
  const notify = () => {
    render();
    changed(selected === null ? null : [...selected]);
  };
  const render = () => {
    all.checked = selected === null;
    chips.empty();
    for (const id of selected || []) {
      const row = dictionaries.find((row2) => dictionaryId(row2) === id);
      const chip = chips.createEl("button", { text: `${row ? dictionaryName(row) : t("collection.missing")} \xD7`, attr: { type: "button" } });
      chip.onclick = () => {
        selected = (selected || []).filter((value) => value !== id);
        notify();
      };
    }
  };
  all.onchange = () => {
    selected = all.checked ? null : [];
    notify();
  };
  const suggest = new DictionarySuggest(app, input, dictionaries, (row) => {
    selected = [.../* @__PURE__ */ new Set([...selected || [], dictionaryId(row)])];
    notify();
    input.value = "";
  });
  render();
  return () => suggest.close();
}

// src/review-setup-controls.ts
function mountReviewSetup(parent, app, host, options, changed, lockedFile, plan = false) {
  const root = parent.createDiv({ cls: "lexis-review-setup" }), t = (key) => host.t(key);
  const Suggest = createPathSuggest(obsidian);
  let cleanup;
  const clearBatch = () => {
    delete options.targetKeys;
    delete options.dailyCardLimit;
    delete options.planId;
    delete options.excludedKeys;
  };
  const render = () => {
    cleanup?.();
    root.empty();
    const range = new import_obsidian3.Setting(root).setName(t("setup.range"));
    if (lockedFile) range.setDesc(lockedFile);
    else {
      const kind = options.scope || "dictionary";
      addCurrentChoice(range, ["dictionary", "folder", "tag", "current", "links"].map((value) => ({ value, label: t(`setup.${value}`) })), kind, (value) => {
        clearBatch();
        delete options.dictionaryIds;
        delete options.scope;
        delete options.sources;
        delete options.file;
        delete options.folder;
        delete options.tag;
        delete options.linkSource;
        if (value === "dictionary") options.dictionaryIds = null;
        else options.scope = value;
        render();
        changed();
      });
      if (kind === "dictionary") cleanup = mountDictionaryPicker(root, app, host.settings.dicts, options.dictionaryIds ?? null, (ids) => {
        clearBatch();
        options.dictionaryIds = ids;
        changed();
      }, t);
      else {
        const property = kind === "current" ? "file" : kind === "links" ? "linkSource" : kind === "folder" ? "folder" : "tag";
        range.addText((input) => {
          const apply = (value) => {
            clearBatch();
            options[property] = value;
            input.setValue(value);
            changed();
          };
          input.setPlaceholder(t("dashboard.chooseSource")).setValue(options[property] || "").onChange(apply);
          const suggest = new Suggest(app, input.inputEl, () => {
            if (kind === "folder") return app.vault.getAllLoadedFiles().filter((file) => "children" in file).map((file) => file.path);
            if (kind === "tag") {
              const tags = /* @__PURE__ */ new Set();
              for (const file of app.vault.getMarkdownFiles()) {
                const cache = app.metadataCache.getFileCache(file);
                for (const tag of cache?.tags || []) tags.add(tag.tag);
                const raw = cache?.frontmatter?.tags;
                for (const tag of Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,;\s]+/) : []) if (typeof tag === "string") tags.add(`#${tag.replace(/^#/, "")}`);
              }
              return [...tags];
            }
            return app.vault.getMarkdownFiles().map((file) => file.path);
          }, apply, { fuzzy: true });
          cleanup = () => suggest.close();
        });
      }
    }
    addCurrentChoice(new import_obsidian3.Setting(root).setName(t("home.reviewContent")), ["notes", "context", "syntax", "both"].map((value) => ({ value, label: t(`home.content${value === "notes" ? "Notes" : value === "context" ? "Context" : value === "syntax" ? "Syntax" : "Both"}`) })), options.content || "syntax", (value) => {
      clearBatch();
      options.content = value;
      changed();
    });
    addCurrentChoice(new import_obsidian3.Setting(root).setName(t("setup.mode")).setDesc(t(options.mode === "cram" ? "setup.cramHint" : "setup.scheduledHint")), ["scheduled", "cram"].map((value) => ({ value, label: t(`setup.${value}`) })), options.mode || "scheduled", (value) => {
      options.mode = value;
      render();
      changed();
    });
    new import_obsidian3.Setting(root).setName(t(plan ? "setup.dailyCount" : "setup.count")).addText((input) => {
      input.inputEl.type = "number";
      input.inputEl.min = "1";
      input.inputEl.step = "1";
      input.setPlaceholder(t(plan && options.mode !== "cram" ? "setup.defaultGoal" : "setup.all")).setValue(options.batchSize == null ? "" : String(options.batchSize)).onChange((value) => {
        options.batchSize = value.trim() ? Number(value) : plan && options.mode !== "cram" ? void 0 : null;
        changed();
      });
    });
    if (options.mode === "cram") new import_obsidian3.Setting(root).setName(t("setup.rounds")).addText((input) => {
      input.inputEl.type = "number";
      input.inputEl.min = "1";
      input.inputEl.step = "1";
      input.setValue(String(options.rounds ?? 1)).onChange((value) => {
        options.rounds = Number(value);
        changed();
      });
    });
    const sort = root.createEl("details");
    sort.createEl("summary", { text: t("setup.sort") });
    addCurrentChoice(new import_obsidian3.Setting(sort).setName(t("home.sortBy")), [["due", "home.sortDue"], ["wordCount", "home.sortWordCount"], ["modified", "home.sortModified"], ["created", "home.sortCreated"], ["frequency", "home.frequency"], ["random", "home.random"]].map(([value, label]) => ({ value, label: t(label) })), options.sortBy || "due", (value) => {
      options.sortBy = value;
      changed();
    });
    addCurrentChoice(new import_obsidian3.Setting(sort).setName(t("home.sortDirection")), ["asc", "desc"].map((value) => ({ value, label: t(value === "asc" ? "home.ascending" : "home.descending") })), options.sortDirection || "asc", (value) => {
      options.sortDirection = value;
      changed();
    });
  };
  render();
  return () => {
    cleanup?.();
    root.remove();
  };
}

// src/data-folder.ts
var DEFAULT_DATA_FOLDER = "Lexis-data";
function dataFolder(input) {
  const value = input.trim().replaceAll("\\", "/").replace(/\/+$/, "") || DEFAULT_DATA_FOLDER;
  if (value.startsWith("/") || /^[A-Za-z]:/.test(value) || /\.jsonl?$/i.test(value) || value.split("/").some((part) => !part || part.startsWith("."))) {
    throw new Error("Use a visible vault-relative folder, not a hidden folder, file or absolute path.");
  }
  return value;
}

// src/review-plan-editor.ts
var ReviewPlanEditor = class extends import_obsidian4.Modal {
  constructor(app, plugin, plan) {
    super(app);
    this.plugin = plugin;
    this.cleanup = null;
    this.plan = plan ? structuredClone(plan) : { id: crypto.randomUUID(), name: "", dictionaryIds: null, content: "syntax", mode: "scheduled", rounds: 1 };
  }
  onOpen() {
    this.setTitle(this.plugin.t(this.plugin.settings.reviewPlans.some((plan) => plan.id === this.plan.id) ? "dashboard.editPlan" : "dashboard.addPlan"));
    const root = this.contentEl;
    root.empty();
    root.addClass("lexis-plan-editor");
    const t = (key) => this.plugin.t(key);
    new import_obsidian4.Setting(root).setName(t("dashboard.planName")).addText((input) => input.setValue(this.plan.name).onChange((value) => {
      this.plan.name = value;
    }));
    let save;
    this.cleanup = mountReviewSetup(root, this.app, this.plugin, this.plan, () => {
      save?.setDisabled(!validReviewOptions(this.plan));
    }, void 0, true);
    new import_obsidian4.Setting(root).setName(t("setup.deadline")).setDesc(t("setup.deadlineHint")).addText((input) => {
      input.inputEl.type = "date";
      input.setValue(this.plan.deadline || "").onChange((value) => {
        this.plan.deadline = value || void 0;
      });
    });
    const directory = this.plugin.settings.dataFolder || DEFAULT_DATA_FOLDER;
    root.createDiv({ cls: "lexis-dim", text: this.plugin.t("setup.storage", { path: `${directory}/reviews` }) });
    new import_obsidian4.Setting(root).addButton((button) => {
      save = button;
      button.setButtonText(t("dashboard.save")).setCta().setDisabled(!validReviewOptions(this.plan)).onClick(async () => {
        if (!validReviewOptions(this.plan)) {
          new import_obsidian4.Notice(t("setup.invalid"));
          return;
        }
        const index = this.plugin.settings.reviewPlans.findIndex((plan) => plan.id === this.plan.id);
        const previous = this.plugin.settings.reviewPlans[index];
        const targets2 = { ...this.plugin.settings.reviewDailyTargets };
        const { id, name, content, mode, batchSize, rounds, deadline, sortBy, sortDirection } = this.plan;
        const saved = { id, name: name.trim() || this.plan.file || this.plan.folder || this.plan.tag || this.plan.linkSource || t("home.scopeAllDictionaries"), content, mode, batchSize, rounds, deadline, sortBy, sortDirection, ...reviewRange(this.plan) };
        const changed = planSelectionChanged(previous, saved);
        if (index < 0) this.plugin.settings.reviewPlans.push(saved);
        else this.plugin.settings.reviewPlans[index] = saved;
        if (changed) {
          delete this.plugin.settings.reviewDailyTargets[this.plan.id];
          for (const id2 of Object.keys(this.plugin.settings.reviewDailyTargets)) if (id2.startsWith("global:")) delete this.plugin.settings.reviewDailyTargets[id2];
        }
        try {
          await this.plugin.saveSettings();
          this.plugin.reviewDashboard.refresh();
          this.close();
        } catch {
          if (previous) this.plugin.settings.reviewPlans[index] = previous;
          else this.plugin.settings.reviewPlans.pop();
          this.plugin.settings.reviewDailyTargets = targets2;
          new import_obsidian4.Notice(t("common.failed"));
        }
      });
    });
  }
  onClose() {
    this.cleanup?.();
    this.contentEl.empty();
  }
};

// src/review-dashboard-view.ts
var tFor = (plugin) => (key, vars) => plugin.t(key, vars);
function renderGoal(parent, value, goal, label) {
  const root = parent.createDiv({ cls: "lexis-dashboard-goal" });
  const caption = root.createDiv({ cls: "lexis-dashboard-goal-caption" });
  caption.createSpan({ text: label });
  caption.createSpan({ text: `${value} / ${goal}${goal > 0 && value >= goal ? " \u2713" : ""}` });
  const track = root.createDiv({ cls: "lexis-progress-track", attr: { role: "progressbar", "aria-label": label, "aria-valuemin": "0", "aria-valuemax": String(Math.max(1, goal)), "aria-valuenow": String(Math.min(value, goal)) } });
  track.createSpan({ cls: "lexis-progress-segment is-complete" }).setCssProps({ "--lexis-progress-width": `${goal ? Math.min(1, value / goal) * 100 : 0}%` });
}
function renderWeek(parent, plugin) {
  const t = tFor(plugin);
  const root = parent.createDiv({ cls: "lexis-dashboard-week" });
  root.createDiv({ cls: "lexis-dashboard-label", text: t("dashboard.week") });
  const today = localDate(/* @__PURE__ */ new Date());
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    return { date, count: completedOnDate(plugin.settings.reviewEvents, date), goal: plugin.settings.reviewGoalHistory[date]?.goal };
  });
  const maximum = Math.max(1, ...days.flatMap((day) => [day.count, day.goal || 0]));
  const chart = root.createDiv({ cls: "lexis-week-chart" });
  for (const day of days) {
    const label = t("dashboard.day", { date: day.date, count: day.count, goal: day.goal == null ? "" : ` / ${day.goal}` });
    const button = chart.createEl("button", { cls: `lexis-week-day${day.goal && day.count >= day.goal ? " is-complete" : ""}`, attr: { type: "button", title: label, "aria-label": label } });
    button.createEl("small", { text: String(day.count) });
    const column = button.createSpan({ cls: "lexis-week-column" });
    column.createSpan({ cls: "lexis-week-bar" }).setCssProps({ "--lexis-week-height": `${day.count / maximum * 100}%` });
    if (day.goal != null) column.createSpan({ cls: "lexis-week-goal" }).setCssProps({ "--lexis-week-height": `${day.goal / maximum * 100}%` });
    button.createSpan({ text: day.date.slice(5) });
    button.onclick = () => {
      void plugin.openReviewLog(day.date);
    };
  }
}
var RemovePlanModal = class extends import_obsidian5.Modal {
  constructor(plugin, plan) {
    super(plugin.app);
    this.plugin = plugin;
    this.plan = plan;
  }
  onOpen() {
    this.setTitle(this.plugin.t("dashboard.removePlan"));
    this.contentEl.createEl("p", { text: this.plugin.t("dashboard.removeConfirm", { name: this.plan.name }) });
    const actions = this.contentEl.createDiv({ cls: "lexis-plan-actions" });
    actions.createEl("button", { text: this.plugin.t("common.cancel") }).onclick = () => this.close();
    actions.createEl("button", { text: this.plugin.t("dashboard.removePlan"), cls: "mod-warning" }).onclick = () => {
      void (async () => {
        this.plugin.settings.reviewPlans = this.plugin.settings.reviewPlans.filter((plan) => plan.id !== this.plan.id);
        delete this.plugin.settings.reviewDailyTargets[this.plan.id];
        if (this.plugin.settings.reviewPracticeProgress) delete this.plugin.settings.reviewPracticeProgress[this.plan.id];
        await this.plugin.saveSettings();
        this.plugin.reviewDashboard.refresh();
        this.close();
      })();
    };
  }
};
function renderFolderTree(parent, items, planId, expanded, prefix = "") {
  const groups = /* @__PURE__ */ new Map();
  for (const item of items) {
    const folder = item.file.path.slice(0, item.file.path.lastIndexOf("/"));
    if (!folder || item.file.path.lastIndexOf("/") < 0) continue;
    const tail = prefix ? folder.slice(prefix.length + 1) : folder;
    const child = tail.split("/")[0];
    if (!child) continue;
    const path = prefix ? `${prefix}/${child}` : child;
    const group = groups.get(path) || [];
    group.push(item);
    groups.set(path, group);
  }
  for (const [path, members] of [...groups].sort(([left], [right]) => left.localeCompare(right))) {
    const nested = members.some((item) => item.file.path.slice(0, item.file.path.lastIndexOf("/")) !== path);
    if (!nested) {
      const row = parent.createDiv({ cls: "lexis-plan-folder-leaf" });
      row.createSpan({ text: path.split("/").pop() || path });
      row.createSpan({ cls: "lexis-dim", text: String(new Set(members.flatMap(reviewItemKeys)).size) });
      continue;
    }
    const root = parent.createEl("details", { cls: "lexis-plan-folder" });
    root.dataset.lexisExpand = `${planId}:${path}`;
    root.open = expanded.has(root.dataset.lexisExpand);
    const heading = root.createEl("summary");
    heading.createSpan({ text: path.split("/").pop() || path });
    heading.createSpan({ cls: "lexis-dim", text: String(new Set(members.flatMap(reviewItemKeys)).size) });
    const body = root.createDiv({ cls: "lexis-plan-folder-body" });
    let rendered = false;
    const renderChildren = () => {
      if (!root.open || rendered) return;
      rendered = true;
      renderFolderTree(body, members, planId, expanded, path);
    };
    root.addEventListener("toggle", renderChildren);
    renderChildren();
  }
}
function renderPlans(parent, plugin, plans, expanded) {
  const t = tFor(plugin);
  const section = parent.createDiv({ cls: "lexis-dashboard-plans" });
  const header = section.createDiv({ cls: "lexis-dashboard-header" });
  header.createEl("h4", { text: t("dashboard.plans") });
  header.createEl("button", { text: t("dashboard.addPlan"), attr: { type: "button" } }).onclick = () => new ReviewPlanEditor(plugin.app, plugin).open();
  if (!plans.length) section.createDiv({ cls: "lexis-dim", text: t("dashboard.noPlans") });
  for (const { plan, summary, items } of [...plans].sort((left, right) => (left.plan.deadline || "9999").localeCompare(right.plan.deadline || "9999"))) {
    const details = section.createEl("details", { cls: "lexis-plan-row" });
    details.dataset.lexisExpand = plan.id;
    details.open = expanded.has(plan.id);
    const heading = details.createEl("summary");
    const info = heading.createDiv({ cls: "lexis-plan-info" });
    info.createEl("strong", { text: plan.name });
    const days = deadlineDays(plan.deadline, summary.date);
    info.createSpan({ cls: "lexis-dim", text: days == null ? t("setup.longTerm") : days === 0 ? t("setup.dueToday") : t(days < 0 ? "setup.overdue" : "setup.daysLeft", { days: Math.abs(days) }) });
    info.createSpan({ cls: "lexis-dim", text: plan.mode === "cram" ? t("setup.practiceGoal", { count: summary.goal / reviewRounds(plan), rounds: reviewRounds(plan) }) : t("dashboard.counts", { total: summary.total, due: summary.due, fresh: summary.fresh }) });
    info.createSpan({ cls: "lexis-dim", text: t("dashboard.progress", { done: summary.completed, goal: summary.goal, left: summary.remaining }) });
    const start = heading.createEl("button", { text: summary.remaining ? t("dashboard.start") : "\u2713", attr: { type: "button", "aria-label": t("dashboard.start") } });
    start.disabled = !summary.remaining;
    start.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      void plugin.openReview(summary.options);
    };
    const menuButton = heading.createEl("button", { text: "\u22EF", attr: { type: "button", "aria-label": t("dashboard.editPlan") } });
    menuButton.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      new import_obsidian5.Menu().addItem((item) => item.setTitle(t("dashboard.editPlan")).setIcon("pencil").onClick(() => new ReviewPlanEditor(plugin.app, plugin, plan).open())).addItem((item) => item.setTitle(t("dashboard.removePlan")).setIcon("trash").onClick(() => new RemovePlanModal(plugin, plan).open())).showAtMouseEvent(event);
    };
    const body = details.createDiv({ cls: "lexis-plan-tree" });
    let rendered = false;
    const renderChildren = () => {
      if (details.open && !rendered) {
        rendered = true;
        renderFolderTree(body, items, plan.id, expanded);
      }
    };
    details.addEventListener("toggle", renderChildren);
    renderChildren();
  }
}
function mountReviewDashboard(parent, plugin, component, options = {}) {
  let stopped = false, generation = 0;
  let day = localDate(/* @__PURE__ */ new Date());
  const render = async () => {
    const id = ++generation;
    try {
      const data = await plugin.reviewDashboard.load();
      if (stopped || id !== generation) return;
      const t = tFor(plugin);
      const selected = options.planName ? data.plans.find(({ plan }) => plan.name === options.planName)?.summary : data.today;
      const expanded = new Set([...parent.querySelectorAll("details[data-lexis-expand]")].filter((element) => element.open).map((element) => element.dataset.lexisExpand || ""));
      parent.empty();
      parent.addClass("lexis-dashboard");
      if (!selected) {
        parent.createDiv({ cls: "lexis-dim", text: t("dashboard.planMissing", { name: options.planName || "" }) });
        return;
      }
      const top = parent.createDiv({ cls: "lexis-dashboard-top" });
      const today = top.createDiv({ cls: "lexis-dashboard-today" });
      today.createEl("h4", { text: options.planName || t("dashboard.today") });
      today.createDiv({ cls: "lexis-dashboard-main-count", text: selected.goal ? t("dashboard.progress", { done: selected.completed, goal: selected.goal, left: selected.remaining }) : t("dashboard.empty") });
      today.createDiv({ cls: "lexis-dim", text: selected.options.mode === "cram" ? t("setup.practice") : t("dashboard.counts", { total: selected.total, due: selected.due, fresh: selected.fresh }) });
      if (selected.options.mode !== "cram") renderGoal(today, selected.completed, selected.minimum, t("dashboard.minimum"));
      renderGoal(today, selected.completed, selected.goal, t("dashboard.goal"));
      const start = today.createEl("button", { cls: "mod-cta lexis-dashboard-start", text: selected.remaining ? t("dashboard.continue", { count: selected.remaining }) : t(selected.goal ? "dashboard.done" : "dashboard.empty") });
      start.disabled = !selected.remaining;
      start.onclick = () => {
        void plugin.openReview(selected.options);
      };
      renderWeek(top, plugin);
      if (!options.compact) renderPlans(parent, plugin, data.plans, expanded);
      else parent.createEl("button", { text: t("home.open") }).onclick = () => {
        void plugin.openHome();
      };
    } catch (error) {
      if (stopped || id !== generation) return;
      console.warn("[Lexis] Cannot load review dashboard", error);
      parent.empty();
      parent.createDiv({ cls: "lexis-dim", text: plugin.t("dashboard.failed") });
      parent.createEl("button", { text: plugin.t("dashboard.retry") }).onclick = () => {
        void render();
      };
    }
  };
  const unsubscribe = plugin.reviewDashboard.subscribe(() => {
    void render();
  });
  plugin.app.workspace.onLayoutReady(() => {
    if (!stopped) void render();
  });
  const timer = window.setInterval(() => {
    const date = localDate(/* @__PURE__ */ new Date());
    if (date !== day) {
      day = date;
      void render();
    }
  }, 6e4);
  const cleanup = () => {
    stopped = true;
    unsubscribe();
    window.clearInterval(timer);
  };
  component.register(cleanup);
  return cleanup;
}

// src/review-collection-controls.ts
var import_obsidian6 = require("obsidian");
function renderCollectionReview(parent, app, host, component) {
  const options = { dictionaryIds: null, content: "syntax", mode: "cram", batchSize: null, rounds: 1 };
  const t = (key) => host.t(key);
  let start;
  component.register(mountReviewSetup(parent, app, host, options, () => {
    start?.setDisabled(!validReviewOptions(options));
  }));
  const setting = new import_obsidian6.Setting(parent);
  setting.settingEl.addClass("lexis-review-start");
  setting.addButton((button) => button.setButtonText(t("setup.savePlan")).onClick(() => {
    if (validReviewOptions(options)) new ReviewPlanEditor(app, host, draftReviewPlan(options)).open();
  }));
  setting.addButton((button) => {
    start = button;
    button.setButtonText(t("home.start")).setCta().onClick(() => host.openReview(options));
  });
}

// src/home-view.ts
var LexisHomeView = class extends import_obsidian7.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.dashboardCleanup = null;
    this.dashboardComponent = null;
    this.sourceFilePath = "";
  }
  getViewType() {
    return LEXIS_HOME_VIEW;
  }
  getDisplayText() {
    return "Lexis";
  }
  getIcon() {
    return "graduation-cap";
  }
  async onOpen() {
    this.render();
  }
  render() {
    this.dashboardCleanup?.();
    if (this.dashboardComponent) this.removeChild(this.dashboardComponent);
    this.dashboardComponent = this.addChild(new import_obsidian7.Component());
    const container = this.contentEl;
    container.empty();
    container.addClass("lexis-home");
    container.createEl("h3", { text: "\u{1F4D5} Lexis" });
    const dashboard = container.createDiv();
    this.dashboardCleanup = mountReviewDashboard(dashboard, this.plugin, this.dashboardComponent);
    const history = container.createEl("details", { cls: "lexis-home-section" });
    history.createEl("summary", { text: this.plugin.t("dashboard.history") });
    let historyRendered = false;
    history.addEventListener("toggle", () => {
      if (history.open && !historyRendered) {
        historyRendered = true;
        this.plugin.renderHeatmap(history.createDiv({ cls: "lexis-hm-wrap" }));
      }
    });
    const custom = container.createEl("details", { cls: "lexis-home-section" });
    custom.createEl("summary", { text: this.plugin.t("dashboard.custom") });
    renderCollectionReview(custom, this.app, this.plugin, this.dashboardComponent);
    void this.renderSuspendedItems(container);
    this.renderArchivedItems(container);
    void this.renderRetireCandidates(container);
  }
  renderArchivedItems(container) {
    const files = this.plugin.collectArchivedFiles();
    const section = container.createEl("details", { cls: "lexis-home-section lexis-archived-section" });
    section.open = !this.plugin.settings.homeArchivedCollapsed;
    const summary = section.createEl("summary", { cls: "lexis-home-section-summary" });
    const summaryLabel = summary.createSpan({ text: `\u{1F4E6} ${this.plugin.t("home.archived")} (${files.length})` });
    const body = section.createDiv({ cls: "lexis-home-section-body" });
    section.addEventListener("toggle", () => {
      this.plugin.settings.homeArchivedCollapsed = !section.open;
      void this.plugin.saveSettings();
    });
    if (!files.length) {
      body.createDiv({ cls: "lexis-dim", text: this.plugin.t("home.noArchived") });
      return;
    }
    const rows = /* @__PURE__ */ new Map();
    for (const file of files) {
      const row = body.createDiv({ cls: "lexis-archive-row" });
      rows.set(file.path, row);
      const info = row.createDiv({ cls: "lexis-suspended-info" });
      const name = info.createEl("a", { text: file.basename, href: "#", cls: "lexis-suspended-name" });
      name.addEventListener("click", (event) => {
        event.preventDefault();
        void this.plugin.app.workspace.getLeaf(false).openFile(file);
      });
      info.createDiv({ cls: "lexis-suspended-meta", text: this.plugin.t("home.archivedMeta") });
      const restore = row.createEl("button", { text: this.plugin.t("home.restoreArchived") });
      restore.addEventListener("click", () => {
        void (async () => {
          restore.disabled = true;
          try {
            await this.plugin.setArchived(file, false);
            rows.delete(file.path);
            row.remove();
            summaryLabel.setText(`\u{1F4E6} ${this.plugin.t("home.archived")} (${rows.size})`);
            if (!rows.size) body.createDiv({ cls: "lexis-dim", text: this.plugin.t("home.noArchived") });
          } catch {
            restore.disabled = false;
          }
        })();
      });
    }
  }
  async renderSuspendedItems(container) {
    const section = container.createEl("details", { cls: "lexis-home-section lexis-suspended-section" });
    section.open = !this.plugin.settings.homeSuspendedCollapsed;
    const summary = section.createEl("summary", { cls: "lexis-home-section-summary" });
    const summaryLabel = summary.createSpan({ text: `\u23F8\uFE0F ${this.plugin.t("home.suspended")}` });
    const body = section.createDiv({ cls: "lexis-home-section-body" });
    section.addEventListener("toggle", () => {
      this.plugin.settings.homeSuspendedCollapsed = !section.open;
      void this.plugin.saveSettings();
    });
    body.setText(this.plugin.t("common.loading"));
    let entries = [];
    try {
      entries = await this.plugin.collectSuspendedReviewItems();
    } catch {
      entries = [];
    }
    if (!body.isConnected) return;
    body.empty();
    summaryLabel.setText(`\u23F8\uFE0F ${this.plugin.t("home.suspended")} (${entries.length})`);
    if (!entries.length) {
      body.createDiv({ cls: "lexis-dim", text: this.plugin.t("home.noSuspended") });
      return;
    }
    const rows = /* @__PURE__ */ new Map();
    const renderEmpty = () => {
      if (rows.size === 0 && body.isConnected) body.createDiv({ cls: "lexis-dim", text: this.plugin.t("home.noSuspended") });
    };
    for (const entry of entries) {
      const row = body.createDiv({ cls: "lexis-suspended-row" });
      rows.set(entry.key, row);
      const info = row.createDiv({ cls: "lexis-suspended-info" });
      const name = info.createEl("a", { text: entry.label, href: "#", cls: "lexis-suspended-name" });
      name.addEventListener("click", (event) => {
        event.preventDefault();
        void this.plugin.app.workspace.getLeaf(false).openFile(entry.file);
      });
      info.createDiv({
        cls: "lexis-suspended-meta",
        text: entry.type === "syntax" && entry.line != null ? `${this.plugin.t("home.suspendedSyntax")} \xB7 ${this.plugin.t("home.line", { line: entry.line + 1 })}` : this.plugin.t("home.suspendedNote")
      });
      const restore = row.createEl("button", { text: this.plugin.t("home.restoreSuspendedOne") });
      restore.addEventListener("click", () => {
        void (async () => {
          restore.disabled = true;
          try {
            await this.plugin.restoreSuspendedReviewItem(entry.key);
            rows.delete(entry.key);
            row.remove();
            summaryLabel.setText(`\u23F8\uFE0F ${this.plugin.t("home.suspended")} (${rows.size})`);
            renderEmpty();
          } catch {
            restore.disabled = false;
          }
        })();
      });
    }
  }
  async renderRetireCandidates(container) {
    const days = this.plugin.settings.retireCandidateDays ?? 90;
    const section = container.createEl("details", { cls: "lexis-home-section lexis-retire-section" });
    section.open = !this.plugin.settings.homeRetireCollapsed;
    const summary = section.createEl("summary", { cls: "lexis-home-section-summary", text: `\u{1F5D1}\uFE0F ${this.plugin.t("home.retire")}` });
    const wrapper = section.createDiv({ cls: "lexis-retire-wrap lexis-home-section-body" });
    section.addEventListener("toggle", () => {
      this.plugin.settings.homeRetireCollapsed = !section.open;
      void this.plugin.saveSettings();
    });
    new import_obsidian7.Setting(wrapper).setName(this.plugin.t("home.retireThreshold")).setDesc(this.plugin.t("home.retireThresholdDesc")).addSlider((slider) => slider.setLimits(14, 365, 1).setValue(days).onChange((value) => {
      this.plugin.settings.retireCandidateDays = value;
      void this.plugin.saveSettings();
      if (this.retireRenderTimer) window.clearTimeout(this.retireRenderTimer);
      this.retireRenderTimer = window.setTimeout(() => this.render(), 400);
    }));
    const list = wrapper.createDiv();
    list.setText(this.plugin.t("home.calculating"));
    let candidates;
    try {
      candidates = await this.plugin.buildRetireCandidates();
    } catch (error) {
      console.warn("[Lexis] Cannot calculate retirement candidates", error);
      if (list.isConnected) list.setText(this.plugin.t("home.encounterDataError"));
      return;
    }
    if (!list.isConnected) return;
    list.empty();
    if (!candidates.length) {
      list.createDiv({ cls: "lexis-dim", text: this.plugin.t("home.noCandidates") });
      return;
    }
    summary.setText(`\u{1F5D1}\uFE0F ${this.plugin.t("home.retire")} (${candidates.length})`);
    const selected = /* @__PURE__ */ new Set();
    const rows = /* @__PURE__ */ new Map();
    const removeRows = (paths) => {
      for (const path of paths) {
        rows.get(path)?.remove();
        rows.delete(path);
        selected.delete(path);
      }
    };
    for (const candidate of candidates) {
      const row = list.createDiv({ cls: "lexis-retire-row" });
      rows.set(candidate.file.path, row);
      const checkbox = row.createEl("input", { type: "checkbox", cls: "lexis-retire-cb" });
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) selected.add(candidate.file.path);
        else selected.delete(candidate.file.path);
      });
      const info = row.createDiv({ cls: "lexis-retire-info" });
      const name = info.createEl("a", { text: candidate.display, href: "#", cls: "lexis-retire-name" });
      name.addEventListener("click", (event) => {
        event.preventDefault();
        void this.plugin.app.workspace.getLeaf(false).openFile(candidate.file);
      });
      info.createDiv({
        cls: "lexis-retire-meta",
        text: this.plugin.t("home.candidateMeta", {
          created: candidate.created,
          last: candidate.lastEncounter,
          occurrences: candidate.occCount,
          days: candidate.sinceLast
        })
      });
      const buttons = row.createDiv({ cls: "lexis-retire-btns" });
      buttons.createEl("button", { text: `\u{1F5D1}\uFE0F ${this.plugin.t("home.evict")}` }).addEventListener("click", () => {
        void this.plugin.setRetired(candidate.file, true).then(() => removeRows([candidate.file.path]));
      });
      buttons.createEl("button", { text: `\u{1F4CC} ${this.plugin.t("home.keep")}` }).addEventListener("click", () => {
        void this.plugin.setPinned(candidate.file, true).then(() => removeRows([candidate.file.path]));
      });
      buttons.createEl("button", { text: `\u{1F4E6} ${this.plugin.t("home.mastered")}` }).addEventListener("click", () => {
        void this.plugin.setArchived(candidate.file, true).then(() => removeRows([candidate.file.path]));
      });
    }
    const bulk = wrapper.createDiv({ cls: "lexis-retire-bulk" });
    const runBulk = async (operation) => {
      const paths = [...selected];
      for (const path of paths) {
        const file = this.plugin.app.vault.getAbstractFileByPath(path);
        if (file instanceof import_obsidian7.TFile) await operation(file);
      }
      removeRows(paths);
    };
    bulk.createEl("button", { text: this.plugin.t("home.bulkEvict") }).addEventListener("click", () => {
      void runBulk((file) => this.plugin.setRetired(file, true));
    });
    bulk.createEl("button", { text: this.plugin.t("home.bulkKeep") }).addEventListener("click", () => {
      void runBulk((file) => this.plugin.setPinned(file, true));
    });
    bulk.createEl("button", { text: this.plugin.t("home.bulkMastered") }).addEventListener("click", () => {
      void runBulk((file) => this.plugin.setArchived(file, true));
    });
  }
  async onClose() {
    this.dashboardCleanup?.();
  }
};

// src/review-dashboard-i18n.ts
var dashboardMessages = {
  "dashboard.today": { zh: "\u4ECA\u65E5\u590D\u4E60", en: "Today's review" },
  "dashboard.progress": { zh: "\u5DF2\u5B8C\u6210 {done} / {goal} \xB7 \u8FD8\u5DEE {left} \u5F20", en: "{done} / {goal} completed \xB7 {left} left" },
  "dashboard.minimum": { zh: "\u6700\u4F4E\u76EE\u6807", en: "Minimum goal" },
  "dashboard.goal": { zh: "\u4ECA\u65E5\u76EE\u6807", en: "Daily goal" },
  "dashboard.continue": { zh: "\u7EE7\u7EED\u590D\u4E60 {count} \u5F20", en: "Review {count} cards" },
  "dashboard.done": { zh: "\u4ECA\u65E5\u76EE\u6807\u5DF2\u5B8C\u6210", en: "Today's goal is complete" },
  "dashboard.empty": { zh: "\u4ECA\u5929\u6CA1\u6709\u5F85\u590D\u4E60\u5361\u7247", en: "No cards to review today" },
  "dashboard.week": { zh: "\u5168\u5E93\u6700\u8FD1\u4E03\u5929", en: "Last seven days \xB7 all cards" },
  "dashboard.history": { zh: "\u957F\u671F\u8BB0\u5F55", en: "Long-term history" },
  "dashboard.day": { zh: "{date} \xB7 \u5B8C\u6210 {count} \u5F20{goal}", en: "{date} \xB7 {count} completed{goal}" },
  "dashboard.plans": { zh: "\u590D\u4E60\u8BA1\u5212", en: "Review plans" },
  "dashboard.addPlan": { zh: "\u6DFB\u52A0\u8BA1\u5212", en: "Add plan" },
  "dashboard.editPlan": { zh: "\u7F16\u8F91\u8BA1\u5212", en: "Edit plan" },
  "dashboard.planName": { zh: "\u8BA1\u5212\u540D\u79F0", en: "Plan name" },
  "dashboard.source": { zh: "\u6DFB\u52A0\u8303\u56F4", en: "Add source" },
  "dashboard.sources": { zh: "\u8303\u56F4\u5408\u5E76\u5E76\u53BB\u91CD\uFF1B\u6587\u4EF6\u5939\u5305\u542B\u5B50\u6587\u4EF6\u5939\u3002", en: "Sources are combined without duplicates; folders include subfolders." },
  "dashboard.chooseSource": { zh: "\u8F93\u5165\u5E76\u9009\u62E9\u2026", en: "Type and choose\u2026" },
  "dashboard.add": { zh: "\u6DFB\u52A0", en: "Add" },
  "dashboard.save": { zh: "\u4FDD\u5B58\u8BA1\u5212", en: "Save plan" },
  "dashboard.removePlan": { zh: "\u79FB\u9664\u8BA1\u5212", en: "Remove plan" },
  "dashboard.removeConfirm": { zh: "\u79FB\u9664\u201C{name}\u201D\uFF1F\u5361\u7247\u3001\u7B14\u8BB0\u548C\u590D\u4E60\u8BB0\u5F55\u90FD\u4F1A\u4FDD\u7559\u3002", en: "Remove \u201C{name}\u201D? Cards, notes and review history will be kept." },
  "dashboard.cancel": { zh: "\u53D6\u6D88", en: "Cancel" },
  "dashboard.start": { zh: "\u5F00\u59CB", en: "Review" },
  "dashboard.counts": { zh: "{total} \u5F20 \xB7 \u5230\u671F {due} \xB7 \u672A\u5B66 {fresh}", en: "{total} cards \xB7 {due} due \xB7 {fresh} new" },
  "dashboard.noPlans": { zh: "\u56FA\u5B9A\u5E38\u7528\u8303\u56F4\uFF0C\u6253\u5F00\u540E\u5373\u53EF\u5F00\u59CB\u3002", en: "Pin the sources you review regularly." },
  "dashboard.custom": { zh: "\u4E34\u65F6\u590D\u4E60", en: "Custom review" },
  "dashboard.goalSettings": { zh: "\u590D\u4E60\u76EE\u6807", en: "Review goals" },
  "dashboard.goalHint": { zh: "\u5F53\u5929\u9996\u6B21\u6253\u5F00\u65F6\u786E\u5B9A\u76EE\u6807\uFF1B\u4FEE\u6539\u4ECE\u660E\u5929\u751F\u6548\u3002", en: "The goal is fixed when first opened each day. Changes apply tomorrow." },
  "dashboard.countHint": { zh: "\u8BB0\u4F4F\u540E\u8BA1\u4E00\u6B21\u5B8C\u6210\uFF1B\u5FD8\u8BB0\u540E\u91CD\u8BD5\u4E0D\u91CD\u590D\u8BA1\u6570\u3002\u6BCF\u4E2A\u6316\u7A7A\u5355\u72EC\u8BA1\u4E00\u5F20\u3002", en: "Each remembered card counts once; retries do not add completions. Each cloze counts separately." },
  "dashboard.failed": { zh: "\u6682\u65F6\u65E0\u6CD5\u52A0\u8F7D\u590D\u4E60\u8BA1\u5212", en: "Unable to load review plans" },
  "dashboard.retry": { zh: "\u91CD\u8BD5", en: "Retry" },
  "dashboard.planMissing": { zh: "\u627E\u4E0D\u5230\u590D\u4E60\u8BA1\u5212\uFF1A{name}", en: "Review plan not found: {name}" },
  "review.progressBar": { zh: "\u5B8C\u6210 {done} / {total} \xB7 \u5F85\u91CD\u8BD5 {retry} \xB7 \u5269\u4F59 {left}", en: "{done} / {total} complete \xB7 {retry} retry \xB7 {left} remaining" }
};

// src/marginnote-i18n.ts
var marginNoteMessages = {
  "mn.title": { zh: "MarginNote", en: "MarginNote" },
  "mn.exportSection": { zh: "MarginNote \u5BFC\u51FA", en: "MarginNote export" },
  "mn.description": { zh: "\u5BFC\u51FA\u53EA\u8BFB\u8BCD\u5E93\uFF0C\u4F9B iPad / Mac \u7684 Lexis MN \u63D2\u4EF6\u5BFC\u5165\u3002\u539F\u7B14\u8BB0\u4E0D\u53D8\u3002", en: "Export a read-only dictionary for Lexis MN on iPad / Mac. Source notes stay unchanged." },
  "mn.folder": { zh: "\u8BCD\u5E93\u5BFC\u51FA\u6587\u4EF6\u5939", en: "Dictionary export folder" },
  "mn.folderDescription": { zh: "\u5E93\u5185\u6587\u4EF6\u5939\uFF1B\u70B9\u51FB\u52FE\u53F7\u786E\u8BA4\u3002\u53EA\u5199\u5165\u5176\u4E2D\u7684 lexis-marginnote.json\uFF0C\u4E0D\u79FB\u52A8\u73B0\u6709\u6570\u636E\u3002", en: "Vault-relative folder; confirm with the check button. Writes only lexis-marginnote.json and does not move existing data." },
  "mn.confirm": { zh: "\u786E\u8BA4\u8DEF\u5F84", en: "Confirm folder" },
  "mn.undo": { zh: "\u8FD8\u539F\u8F93\u5165", en: "Undo input" },
  "mn.scope": { zh: "\u5BFC\u51FA\u8303\u56F4", en: "Export scope" },
  "mn.capture": { zh: "\u4ECE MarginNote \u6DFB\u52A0\u8BCD\u6761", en: "Add a MarginNote selection" },
  "mn.captureWord": { zh: "\u8BCD\u6761", en: "Entry" },
  "mn.cancel": { zh: "\u53D6\u6D88", en: "Cancel" },
  "mn.captureInvalid": { zh: "\u8BF7\u8F93\u5165\u6709\u6548\u8BCD\u6761\uFF0C\u5E76\u9009\u62E9\u5DF2\u6709\u8BCD\u5178\u6587\u4EF6\u5939", en: "Enter a valid entry and choose a configured dictionary folder" },
  "mn.captureFailed": { zh: "\u6DFB\u52A0\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u8BCD\u5178\u6587\u4EF6\u662F\u5426\u53EF\u5199\u540E\u91CD\u8BD5", en: "Could not save; check dictionary file access and try again" },
  "mn.scopeAll": { zh: "\u5168\u90E8\u8BCD\u5E93\u6765\u6E90", en: "All dictionary sources" },
  "mn.followVisibility": { zh: "\u8DDF\u968F\u8BCD\u5178\u4E0E\u5185\u8054\u9AD8\u4EAE\u5F00\u5173", en: "Follow dictionary and inline visibility" },
  "mn.followVisibilityDescription": { zh: "\u5173\u95ED\u65F6\u72EC\u7ACB\u9009\u62E9\u5BFC\u51FA\u8303\u56F4\u3002\u5FFD\u7565\u6807\u7B7E\u3001\u5DF2\u5F52\u6863\u548C\u5DF2\u638C\u63E1\u59CB\u7EC8\u4E0D\u5BFC\u51FA\uFF1B\u5168\u5C40\u9AD8\u4EAE\u5F00\u5173\u4E0D\u5F71\u54CD MN\u3002", en: "When off, export scope is independent. Ignored tags, archived and retired entries are always excluded. The global highlight switch does not affect MN." },
  "mn.auto": { zh: "\u81EA\u52A8\u5BFC\u51FA", en: "Automatic export" },
  "mn.autoDescription": { zh: "Obsidian \u8FD0\u884C\u65F6\uFF0C\u8BCD\u5E93\u53D8\u52A8\u540E\u66F4\u65B0\u6587\u4EF6\u3002MN \u7684\u6587\u4EF6\u8BBF\u95EE\u6743\u9650\u53CA\u4E91\u540C\u6B65\u5EF6\u8FDF\u4ECD\u9700\u5B9E\u673A\u9A8C\u8BC1\u3002", en: "Updates the file after dictionary changes while Obsidian runs. MN file access and cloud-sync latency require device testing." },
  "mn.export": { zh: "\u5BFC\u51FA\u8BCD\u5E93", en: "Export dictionary" },
  "mn.exportCommand": { zh: "\u5BFC\u51FA MarginNote \u8BCD\u5E93", en: "Export MarginNote dictionary" },
  "mn.exported": { zh: "Lexis\uFF1A\u5DF2\u5BFC\u51FA {count} \u4E2A\u8BCD\u6761\u5230 {path}", en: "Lexis: exported {count} entries to {path}" },
  "mn.exportFailed": { zh: "Lexis\uFF1A\u8BCD\u5E93\u5BFC\u51FA\u5931\u8D25\uFF1A{error}", en: "Lexis: dictionary export failed: {error}" },
  "mn.otherSource": { zh: "\u8BE5\u6587\u4EF6\u5C5E\u4E8E\u53E6\u4E00\u4E2A\u5E93\uFF0C\u8BF7\u4F7F\u7528\u5176\u4ED6\u5BFC\u51FA\u6587\u4EF6\u5939", en: "This file belongs to another vault; choose another export folder" }
};

// src/settings-i18n.ts
var settingsMessages = {
  "settings.dataFolder": { zh: "\u6570\u636E\u6587\u4EF6\u5939", en: "Data folder" },
  "settings.dataFolderDesc": { zh: "\u76F8\u9047\u3001\u590D\u4E60\u72B6\u6001\u3001\u8BA1\u5212\u4E0E\u8FD1\u671F\u65E5\u5FD7\u4FDD\u5B58\u5728\u6B64\u3002\u4F7F\u7528\u5E93\u5185\u975E\u9690\u85CF\u7684\u4E13\u7528\u6587\u4EF6\u5939\uFF1B\u70B9\u52FE\u786E\u8BA4\u8FC1\u79FB\u3002", en: "Encounters, review state, plans and recent history live here. Use a visible, dedicated vault folder; confirm with the check button." },
  "settings.dataFolderConfirm": { zh: "\u786E\u8BA4\u8FC1\u79FB\u5B66\u4E60\u6570\u636E", en: "Confirm learning data move" },
  "settings.dataFolderSaved": { zh: "\u5B66\u4E60\u6570\u636E\u5DF2\u8FC1\u79FB", en: "Learning data moved" },
  "settings.dataFolderError": { zh: "\u6570\u636E\u64CD\u4F5C\u5931\u8D25\uFF1A{error}", en: "Data operation failed: {error}" },
  "settings.pluginDataPath": { zh: "\u63D2\u4EF6\u914D\u7F6E", en: "Plugin configuration" },
  "settings.pluginDataPathDesc": { zh: "{path} \u53EA\u4FDD\u5B58\u5916\u89C2\u3001\u5F00\u5173\u4E0E\u6570\u636E\u76EE\u5F55\uFF0C\u4E0D\u4FDD\u5B58\u5B66\u4E60\u8BB0\u5F55\u3002\u7B14\u8BB0\u81EA\u8EAB\u7684\u590D\u4E60\u5C5E\u6027\u4ECD\u7559\u5728\u7B14\u8BB0\u4E2D\u3002", en: "{path} holds preferences and the data folder, not learning records. Note-level review properties stay in the notes." },
  "settings.reviewRetention": { zh: "\u8BE6\u7EC6\u590D\u4E60\u8BB0\u5F55\u4FDD\u7559\u5929\u6570", en: "Review history retention (days)" },
  "settings.reviewRetentionPending": { zh: "\u5386\u53F2\u5DF2\u5B8C\u6574\u8FC1\u79FB\uFF0C\u81EA\u52A8\u6E05\u7406\u5C1A\u672A\u542F\u7528\u3002\u70B9\u52FE\u540E\u9884\u8BA1\u6C38\u4E45\u6E05\u7406 {events} \u6761\u8BC4\u5206\u8BB0\u5F55\u3001{points} \u4E2A\u66F2\u7EBF\u8282\u70B9\u53CA\u8FC7\u671F\u65E5\u7EDF\u8BA1\u3002\u5F53\u524D\u6392\u7A0B\u3001\u7D2F\u8BA1\u6B21\u6570\u4E0E\u8BA1\u5212\u4E0D\u53D8\u3002", en: "History was migrated without age pruning. Automatic cleanup is pending your confirmation. Confirming permanently removes an estimated {events} review events, {points} curve points and expired daily statistics, not current schedules, lifetime counts or plans." },
  "settings.reviewRetentionDesc": { zh: "\u9ED8\u8BA4 90 \u5929\uFF081\u20133650\uFF09\u3002\u70B9\u52FE\u540E\u6C38\u4E45\u6E05\u7406\u8FC7\u671F\u65E5\u5FD7\u548C\u66F2\u7EBF\u5386\u53F2\uFF1B\u5F53\u524D\u6392\u7A0B\u3001\u7D2F\u8BA1\u590D\u4E60\u6B21\u6570\u3001\u8BA1\u5212\u4E0E\u6401\u7F6E\u72B6\u6001\u4E0D\u53D8\u3002\u589E\u52A0\u5929\u6570\u4E0D\u80FD\u6062\u590D\u5DF2\u6E05\u7406\u7684\u8BB0\u5F55\u3002", en: "Default: 90 days (1\u20133650). Confirming permanently removes expired logs and curve history, not current schedules, lifetime review counts, plans or suspended cards. Increasing this cannot restore removed history." },
  "settings.reviewRetentionConfirm": { zh: "\u786E\u8BA4\u4FDD\u7559\u5929\u6570\u5E76\u6E05\u7406\u8FC7\u671F\u5386\u53F2", en: "Confirm retention and remove expired history" },
  "settings.reviewRetentionSaved": { zh: "\u4FDD\u7559\u5929\u6570\u5DF2\u4FDD\u5B58\uFF0C\u8FC7\u671F\u5386\u53F2\u5DF2\u6E05\u7406", en: "Retention saved; expired history removed" },
  "settings.inlineDelimiterDesc": { zh: "\u683C\u5F0F\uFF1A\u4E3B\u8BCD / \u522B\u540D{delimiter}\u6279\u6CE8\u3002", en: "Format: entry / alias{delimiter} annotation." },
  "settings.templateDisabledPlaceholder": { zh: "\u7559\u7A7A\u5173\u95ED", en: "Blank disables this syntax" },
  "settings.syntaxConflict": { zh: "\u4E0E\u5185\u8054\u8BCD\u6761\u89C4\u5219\u76F8\u540C\uFF1B\u5728\u5185\u8054\u8BCD\u6761\u6587\u4EF6\u4E2D\u4F18\u5148\u8BC6\u522B\u4E3A\u8BCD\u6761\uFF0C\u4E0D\u751F\u6210\u95EA\u5361\u3002\u4FEE\u6539\u4EFB\u4E00\u89C4\u5219\u5373\u53EF\u5206\u5F00\u3002", en: "This matches the inline-entry rule. Inline-entry files treat it as an entry, not a flashcard; change either rule to separate them." },
  "maintenance.reload": { zh: "\u91CD\u65B0\u52A0\u8F7D\u63D2\u4EF6", en: "Reload plugin" },
  "maintenance.check": { zh: "\u68C0\u67E5\u66F4\u65B0", en: "Check for updates" },
  "maintenance.unchecked": { zh: "{version} \xB7 \u672A\u68C0\u67E5", en: "{version} \xB7 Not checked" },
  "maintenance.checking": { zh: "\u68C0\u67E5\u4E2D\u2026", en: "Checking\u2026" },
  "maintenance.noUpdate": { zh: "{version} \xB7 \u6682\u65E0\u66F4\u65B0", en: "{version} \xB7 No update available" },
  "maintenance.pendingUpdate": { zh: "\u5F85\u66F4\u65B0\u81F3 {version}", en: "Update to {version} available" },
  "maintenance.installing": { zh: "\u66F4\u65B0\u4E2D\u2026", en: "Updating\u2026" },
  "maintenance.checkFailed": { zh: "\u68C0\u67E5\u5931\u8D25", en: "Check failed" },
  "maintenance.installFailed": { zh: "\u66F4\u65B0\u5931\u8D25", en: "Update failed" },
  "maintenance.reloaded": { zh: "Lexis \u5DF2\u91CD\u65B0\u52A0\u8F7D", en: "Lexis reloaded" },
  "maintenance.current": { zh: "\u672A\u53D1\u73B0\u66F4\u65B0\u7684\u53D1\u5E03\u7248", en: "No newer published version" },
  "maintenance.available": { zh: "\u53D1\u73B0 Lexis {version}", en: "Lexis {version} is available" },
  "maintenance.confirmDescription": { zh: "\u4E0B\u8F7D\u5E76\u66F4\u65B0\u540E\u91CD\u65B0\u52A0\u8F7D\u63D2\u4EF6\u3002\u8BBE\u7F6E\u3001\u7B14\u8BB0\u548C\u5B66\u4E60\u8BB0\u5F55\u4F1A\u4FDD\u7559\u3002", en: "Download the update and reload the plugin. Settings, notes and learning records are preserved." },
  "maintenance.install": { zh: "\u4E0B\u8F7D\u5E76\u66F4\u65B0", en: "Download and update" },
  "maintenance.cancel": { zh: "\u53D6\u6D88", en: "Cancel" },
  "maintenance.updated": { zh: "Lexis \u5DF2\u66F4\u65B0\u81F3 {version}", en: "Lexis updated to {version}" },
  "maintenance.failed": { zh: "Lexis\uFF1A{error}", en: "Lexis: {error}" },
  "maintenance.timeout": { zh: "\u8FDE\u63A5\u8D85\u65F6\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5", en: "Connection timed out. Try again later" },
  "maintenance.invalidRelease": { zh: "\u53D1\u5E03\u6587\u4EF6\u4E0D\u5B8C\u6574\u6216\u7248\u672C\u4E0D\u5339\u914D\uFF0C\u672A\u66F4\u65B0", en: "Release files are incomplete or inconsistent. Not updated" },
  "maintenance.incompatible": { zh: "\u65B0\u7248\u4E0D\u9002\u7528\u4E8E\u5F53\u524D Obsidian \u6216\u8BBE\u5907", en: "The new version is incompatible with this Obsidian version or device" },
  "maintenance.unsupported": { zh: "\u5F53\u524D Obsidian \u4E0D\u652F\u6301\u6B64\u52A0\u8F7D\u64CD\u4F5C", en: "This Obsidian version does not support this loading operation" },
  "maintenance.development": { zh: "\u5F00\u53D1\u76EE\u5F55\u4E0D\u81EA\u52A8\u66F4\u65B0\uFF0C\u8BF7\u5728\u6B63\u5F0F\u5B89\u88C5\u76EE\u5F55\u66F4\u65B0\uFF1B\u91CD\u65B0\u52A0\u8F7D\u4ECD\u53EF\u7528", en: "Automatic updates are disabled for development folders. Reload remains available" },
  "maintenance.loadFailed": { zh: "\u63D2\u4EF6\u91CD\u65B0\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u67E5\u770B\u63A7\u5236\u53F0", en: "Plugin reload failed. Check the console" },
  "maintenance.pendingData": { zh: "\u5B66\u4E60\u6570\u636E\u5C1A\u672A\u4FDD\u5B58\u5B8C\u6210\uFF0C\u6682\u4E0D\u91CD\u8F7D\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5", en: "Learning data has not finished saving. Reload canceled; try again later" },
  "maintenance.restoreFailed": { zh: "\u66F4\u65B0\u5931\u8D25\u4E14\u65E7\u4EE3\u7801\u672A\u80FD\u5B8C\u5168\u6062\u590D\uFF0C\u8BF7\u91CD\u65B0\u5B89\u88C5 Lexis\uFF1B\u5B66\u4E60\u6570\u636E\u672A\u5220\u9664", en: "Update failed and the old code could not be fully restored. Reinstall Lexis; learning data was not deleted" },
  "curve.showAll": { zh: "\u67E5\u770B\u5168\u90E8", en: "Show all" },
  "curve.showRecent": { zh: "\u6700\u8FD1 8 \u6B21", en: "Last 8 reviews" },
  "settings.reviewLinkMode": { zh: "\u590D\u4E60\u9875\u9762\u8DF3\u8F6C", en: "Review link navigation" },
  "settings.reviewLinkCurrent": { zh: "\u5F53\u524D\u9875\u9762", en: "Current page" },
  "settings.reviewLinkTab": { zh: "\u65B0\u6807\u7B7E\u9875", en: "New tab" },
  "settings.reviewLinkDesc": { zh: "\u5F53\u524D\u9875\u9762\u4FDD\u7559\u590D\u4E60\u8FDB\u5EA6\uFF0C\u53EF\u7528 Obsidian \u8FD4\u56DE\u6309\u94AE\u56DE\u5230\u5361\u7247\u3002", en: "Current-page navigation preserves your session. Use Obsidian's Back button to return." },
  "review.openLinkFailed": { zh: "\u65E0\u6CD5\u6253\u5F00\u7B14\u8BB0\u94FE\u63A5\uFF1A{error}", en: "Could not open note link: {error}" },
  "settings.tabStyle": { zh: "\u6837\u5F0F", en: "Appearance" },
  "settings.tabOther": { zh: "\u5176\u4ED6", en: "Other" },
  "settings.addTab": { zh: "\u65B0\u5EFA\u5206\u7C7B", en: "Add tab" },
  "settings.renameTab": { zh: "\u4FEE\u6539\u5206\u7C7B\u540D\u79F0", en: "Rename tab" },
  "settings.deleteTab": { zh: "\u5220\u9664\u8FD9\u4E2A\u5206\u7C7B", en: "Delete this tab" },
  "settings.deleteTabHint": { zh: "\u5176\u4E2D\u7684\u8BBE\u7F6E\u4F1A\u56DE\u5230\u9ED8\u8BA4\u5206\u7C7B\uFF0C\u4E0D\u4F1A\u5220\u9664\u8BBE\u7F6E\u3002", en: "Its settings return to their default tabs; no settings are deleted." },
  "settings.expandAll": { zh: "\u5168\u90E8\u5C55\u5F00", en: "Expand all" },
  "settings.collapseAll": { zh: "\u5168\u90E8\u6536\u8D77", en: "Collapse all" },
  "settings.vocabularyRules": { zh: "\u6536\u5F55\u4E0E\u989C\u8272\u89C4\u5219", en: "Inclusion and colors" },
  "settings.readingInteractions": { zh: "\u60AC\u6D6E\u4E0E\u5212\u8BCD", en: "Hover and selection" },
  "settings.sourcesAndNotes": { zh: "\u51FA\u5904\u4E0E\u5907\u6CE8", en: "Sources and notes" },
  "settings.newEntry": { zh: "\u65B0\u5EFA\u8BCD\u6761", en: "New entries" },
  "settings.syntaxManual": { zh: "\u8BED\u6CD5\u624B\u518C", en: "Syntax guide" },
  "manual.description": { zh: "\u793A\u4F8B\u6570\u636E\uFF0C\u4E0D\u4F1A\u4FEE\u6539\u7B14\u8BB0\u6216\u5B66\u4E60\u8BB0\u5F55\u3002", en: "Sample data. Your notes and learning records stay unchanged." },
  "manual.complete": { zh: "\u5B8C\u6574\u8BCD\u6761\u89C6\u56FE", en: "Complete entry view" },
  "manual.writing": { zh: "\u7B14\u8BB0\u5199\u6CD5", en: "In the note" },
  "manual.result": { zh: "\u6E32\u67D3\u6548\u679C", en: "Rendered result" },
  "manual.relationType": { zh: "\u53CD\u4E49\u8BCD", en: "Antonyms" },
  "manual.examplePlan": { zh: "\u6BCF\u65E5\u82F1\u8BED", en: "Daily English" },
  "manual.exampleHomeFile": { zh: "\u4E3B\u9875.md", en: "Home.md" },
  "manual.reviewedFile": { zh: "{file} \xB7 \u5DF2\u590D\u4E60 3 \u6B21", en: "{file} \xB7 reviewed 3 times" },
  "manual.curve": { zh: "\u8BB0\u5FC6\u66F2\u7EBF", en: "Memory curve" },
  "manual.relations": { zh: "\u6807\u9898\u4E0B\u7684\u53CD\u5411\u5F15\u7528", en: "Backlinks under a heading" },
  "manual.relationPlaceholder": { zh: "{{\u6807\u9898}}", en: "{{heading}}" },
  "manual.relationVariable": { zh: "{{\u6807\u9898}} = {example}\u3002\u53EF\u6362\u6210\u4EFB\u610F\u7EA7\u522B\u7684\u5B9E\u9645\u6807\u9898\uFF0C\u4E0D\u4FDD\u7559\u82B1\u62EC\u53F7\u3002", en: "{{heading}} = {example}. Replace it with your heading at any level; omit the braces." },
  "manual.relationFlow": { zh: "{from} \u5199\u5165\u53CC\u94FE \u2192 {to} \u6309\u6807\u9898\u627E\u56DE\u5F15\u7528\u5B83\u7684\u7B14\u8BB0\u3002\u65E0\u9700\u624B\u52A8\u8865\u5199\u53CD\u5411\u53CC\u94FE\u3002", en: "Link from {from} \u2192 find it in {to} by heading. No reciprocal link needs to be written." },
  "manual.occurrences": { zh: "\u51FA\u73B0\u8FC7\u7684\u5730\u65B9", en: "Occurrences" },
  "manual.derived": { zh: "\u53CD\u5411\u5F15\u7528\uFF08\u4E0D\u533A\u5206\u6807\u9898\uFF09", en: "Backlinks across all headings" },
  "manual.backlinksDescription": { zh: "\u5217\u51FA\u8BCD\u5178\u4E2D\u5F15\u7528\u5F53\u524D\u8BCD\u6761\u7684\u7B14\u8BB0\uFF0C\u4E0D\u6309\u6807\u9898\u7B5B\u9009\uFF1Bderived \u662F\u4FDD\u7559\u7684\u4EE3\u7801\u6307\u4EE4\uFF0C\u4E0D\u8868\u793A\u6784\u8BCD\u6D3E\u751F\u3002", en: "Lists dictionary notes linking here, regardless of heading. The retained command derived does not infer word derivation." },
  "relation.backlinks": { zh: "\u53CD\u5411\u5F15\u7528 ({count})", en: "Backlinks ({count})" },
  "relation.noBacklinks": { zh: "\u8FD8\u6CA1\u6709\u8BCD\u5178\u7B14\u8BB0\u5F15\u7528\u6B64\u8BCD\u6761", en: "No dictionary notes link here yet" },
  "manual.home": { zh: "\u4E3B\u9875\u6458\u8981", en: "Home summary" },
  "manual.plan": { zh: "\u6307\u5B9A\u590D\u4E60\u8BA1\u5212", en: "Named review plan" },
  "manual.heatmap": { zh: "\u590D\u4E60\u70ED\u529B\u56FE", en: "Review heatmap" },
  "manual.copy": { zh: "\u590D\u5236\u4EE3\u7801\u5757", en: "Copy code block" },
  "manual.copied": { zh: "\u5DF2\u590D\u5236", en: "Copied" },
  "manual.copyFailed": { zh: "\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u624B\u52A8\u9009\u62E9\u6E90\u7801\u590D\u5236", en: "Could not copy; select and copy the source manually" },
  "manual.failed": { zh: "\u793A\u4F8B\u65E0\u6CD5\u52A0\u8F7D", en: "Could not load this example" }
};

// src/review-library-i18n.ts
var reviewLibraryMessages = {
  "library.title": { zh: "\u5DF2\u80CC\u8FC7", en: "Reviewed" },
  "library.allStatuses": { zh: "\u5168\u90E8\u72B6\u6001", en: "All states" },
  "library.discovered": { zh: "\u9996\u6B21\u53D1\u73B0", en: "First discovered" },
  "library.firstReview": { zh: "\u9996\u6B21\u53EF\u67E5\u80CC\u8BF5", en: "First recorded review" },
  "library.reviewed": { zh: "\u80CC\u8FC7", en: "Reviewed" },
  "library.suspended": { zh: "\u6401\u7F6E", en: "Suspended" },
  "library.archived": { zh: "\u5F52\u6863 / \u6DD8\u6C70", en: "Archived / retired" },
  "library.category": { zh: "\u6240\u5728\u6807\u9898", en: "Heading path" },
  "library.expandGroups": { zh: "\u5C55\u5F00\u5168\u90E8\u5206\u7EC4", en: "Expand all groups" },
  "library.collapseGroups": { zh: "\u6536\u8D77\u5168\u90E8\u5206\u7EC4", en: "Collapse all groups" },
  "library.switchView": { zh: "\u5207\u6362\u5217\u8868 / \u5361\u7247", en: "Switch list / cards" },
  "library.sourcePath": { zh: "\u67E5\u770B\u8DEF\u5F84", en: "Show source path" },
  "library.search": { zh: "\u641C\u7D22\u5361\u7247\u3001\u6587\u4EF6\u6216\u6807\u9898", en: "Search cards, files or headings" },
  "library.sortName": { zh: "\u540D\u79F0", en: "Name" },
  "library.sortReps": { zh: "\u80CC\u8BF5\u6B21\u6570", en: "Review count" },
  "library.sortRetention": { zh: "\u9884\u8BA1\u4FDD\u7559\u7387", en: "Estimated retention" },
  "library.sortStability": { zh: "\u8BB0\u5FC6\u7A33\u5B9A\u6027", en: "Memory stability" },
  "library.asc": { zh: "\u5347\u5E8F \u2191", en: "Ascending \u2191" },
  "library.desc": { zh: "\u964D\u5E8F \u2193", en: "Descending \u2193" },
  "library.view.list": { zh: "\u5217\u8868", en: "List" },
  "library.view.cards": { zh: "\u5361\u7247", en: "Cards" },
  "library.repsValue": { zh: "\u590D\u4E60 {count} \u6B21", en: "{count} reviews" },
  "library.retentionValue": { zh: "\u9884\u8BA1 {value}", en: "Estimated {value}" },
  "library.stabilityValue": { zh: "\u7A33\u5B9A {value} \u5929", en: "Stability {value} days" },
  "library.retentionHint": { zh: "\u6839\u636E FSRS \u548C\u8DDD\u4E0A\u6B21\u590D\u4E60\u7684\u65F6\u95F4\u4F30\u8BA1\uFF0C\u5E76\u975E\u5B9E\u6D4B\u3002", en: "FSRS estimate based on time since review, not a measured score." },
  "library.stabilityHint": { zh: "FSRS \u7A33\u5B9A\u6027\u53C2\u6570\uFF0C\u4EE5\u5929\u8BA1\uFF1B\u4E0D\u662F\u719F\u6089\u5EA6\u767E\u5206\u6570\u3002", en: "FSRS stability in days, not a familiarity percentage." },
  "library.answer": { zh: "\u7B54\u6848", en: "Answer" },
  "library.noteContent": { zh: "\u7B14\u8BB0\u5185\u5BB9", en: "Note content" },
  "library.noAnswer": { zh: "\u6CA1\u6709\u53EF\u663E\u793A\u7684\u7B54\u6848", en: "No answer available" },
  "library.previewFailed": { zh: "\u65E0\u6CD5\u52A0\u8F7D\u9884\u89C8\uFF0C\u53EF\u6253\u5F00\u539F\u7B14\u8BB0\u67E5\u770B\u3002", en: "Could not load preview. Open the source note to read it." },
  "library.newest": { zh: "\u6700\u65B0\u53D1\u73B0", en: "Latest discovery" },
  "library.oldest": { zh: "\u6700\u65E9\u53D1\u73B0", en: "Earliest discovery" },
  "library.empty": { zh: "\u6CA1\u6709\u5339\u914D\u7684\u5361\u7247", en: "No matching cards" },
  "library.hint": { zh: "\u5DF2\u6709\u590D\u4E60\u72B6\u6001\u6216\u8BB0\u5F55\u7684\u5361\u7247\uFF1B\u6401\u7F6E\u548C\u5F52\u6863\u5728\u4E3B\u9875\u7BA1\u7406\u3002", en: "Cards with review states or records. Manage suspended and archived cards on Home." },
  "review.more": { zh: "\u66F4\u591A\u64CD\u4F5C", en: "More actions" },
  "review.lowerPriority": { zh: "\u6682\u65F6\u964D\u4F4E\u4F18\u5148\u7EA7", en: "Lower priority temporarily" },
  "review.resetPriority": { zh: "\u6062\u590D\u6B63\u5E38\u4F18\u5148\u7EA7", en: "Restore normal priority" },
  "review.priority": { zh: "\u5F53\u524D\u4F18\u5148\u7EA7", en: "Current priority" },
  "review.priorityHint": { zh: "\u53EA\u5F71\u54CD\u51FA\u9898\u987A\u5E8F\uFF1B\u521D\u59CB 25%\uFF0C\u6BCF 7 \u5929\u6D88\u9000\u4E00\u534A\u964D\u6743\u3002", en: "Affects ordering only. Starts at 25%; the penalty halves every 7 days." },
  "review.priorityFailed": { zh: "\u65E0\u6CD5\u4FDD\u5B58\u4F18\u5148\u7EA7\uFF1A{error}", en: "Could not save priority: {error}" },
  "library.reviewFile": { zh: "\u80CC\u5F53\u524D\u6587\u4EF6\u7684\u8BED\u6CD5\u5361\u7247", en: "Review this file's syntax cards" }
};

// src/dictionary-i18n.ts
var dictionaryMessages = {
  "collection.add": { zh: "\u6DFB\u52A0\u8BCD\u5178", en: "Add dictionary" },
  "collection.edit": { zh: "\u7F16\u8F91\u8BCD\u5178", en: "Edit dictionary" },
  "collection.name": { zh: "\u540D\u79F0", en: "Name" },
  "collection.sources": { zh: "\u6536\u5F55\u8303\u56F4", en: "Sources" },
  "collection.sourcesHint": { zh: "\u6765\u6E90\u53D6\u5E76\u96C6\uFF0C\u5141\u8BB8\u4E0E\u5176\u4ED6\u8BCD\u5178\u91CD\u53E0\uFF1B\u590D\u4E60\u65F6\u540C\u4E00\u5361\u7247\u53EA\u7B97\u4E00\u6B21\u3002", en: "Sources are combined. Dictionaries may overlap; a review card is counted once." },
  "collection.folder": { zh: "\u6587\u4EF6\u5939", en: "Folder" },
  "collection.tag": { zh: "\u6807\u7B7E", en: "Tag" },
  "collection.file": { zh: "\u5355\u4E2A\u6587\u4EF6", en: "Single file" },
  "collection.links": { zh: "\u76EE\u5F55\u6587\u4EF6\u5185\u53CC\u94FE", en: "Links in an index file" },
  "collection.fileHint": { zh: "\u53EA\u6536\u5F55\u8FD9\u7BC7\u7B14\u8BB0\u53CA\u5176\u4E2D\u7684\u95EA\u5361\uFF0C\u4E0D\u5305\u542B\u5B83\u94FE\u63A5\u5230\u7684\u5176\u4ED6\u7B14\u8BB0\u3002", en: "Includes this note and its flashcards, not other notes it links to." },
  "collection.linksHint": { zh: "\u6536\u5F55\u8BE5\u76EE\u5F55\u6587\u4EF6\u76F4\u63A5\u94FE\u63A5\u5230\u7684\u6709\u6548\u7B14\u8BB0\uFF0C\u4E0D\u5305\u542B\u76EE\u5F55\u6587\u4EF6\u81EA\u8EAB\uFF0C\u4E5F\u4E0D\u9012\u5F52\u3002", en: "Includes existing notes directly linked from the index, not the index itself or recursive links." },
  "collection.addSource": { zh: "\u6DFB\u52A0\u6765\u6E90", en: "Add source" },
  "collection.destination": { zh: "\u65B0\u8BCD\u4FDD\u5B58\u6587\u4EF6\u5939", en: "New-entry folder" },
  "collection.destinationHint": { zh: "\u9009\u62E9\u6587\u4EF6\u5939\u6765\u6E90\u540E\u81EA\u52A8\u586B\u5165\uFF0C\u53EF\u4FEE\u6539\uFF1B\u7559\u7A7A\u5219\u4E0D\u4F5C\u4E3A\u5212\u8BCD\u65B0\u5EFA\u76EE\u6807\u3002", en: "Filled from the selected folder source. Edit it or leave blank to omit capture." },
  "collection.save": { zh: "\u4FDD\u5B58", en: "Save" },
  "collection.invalid": { zh: "\u8BF7\u9009\u62E9\u5B58\u5728\u7684\u6765\u6E90\u3001\u6587\u4EF6\u5939\u6216\u6A21\u677F\u3002", en: "Choose existing sources, folders and templates." },
  "collection.choose": { zh: "\u641C\u7D22\u5E76\u6DFB\u52A0\u8BCD\u5178", en: "Find and add dictionaries" },
  "collection.missing": { zh: "\u5DF2\u5220\u9664\u7684\u8BCD\u5178", en: "Deleted dictionary" },
  "collection.empty": { zh: "\u672A\u8BBE\u7F6E\u6765\u6E90", en: "No sources" },
  "collection.group": { zh: "\u5206\u7C7B\u65B9\u5F0F", en: "Group by" },
  "collection.group.none": { zh: "\u4E0D\u5206\u7C7B", en: "None" },
  "collection.group.dictionary": { zh: "\u8BCD\u5178", en: "Dictionary" },
  "collection.group.folder": { zh: "\u6587\u4EF6\u5939", en: "Folder" },
  "collection.group.tag": { zh: "\u6807\u7B7E", en: "Tag" },
  "collection.group.hub": { zh: "\u5355\u7BC7\u7B14\u8BB0", en: "Source note" },
  "collection.group.file": { zh: "\u5355\u7BC7\u7B14\u8BB0", en: "Source note" },
  "collection.group.heading": { zh: "\u6240\u5728\u6807\u9898", en: "Heading" },
  "collection.ungrouped": { zh: "\u672A\u5206\u7C7B", en: "Ungrouped" }
};

// src/review-setup-i18n.ts
var reviewSetupMessages = {
  "command.review": { zh: "\u5F00\u59CB\u590D\u4E60", en: "Start review" },
  "command.reviewCurrentFile": { zh: "\u590D\u4E60\u5F53\u524D\u6587\u4EF6", en: "Review current file" },
  "setup.sort": { zh: "\u6392\u5E8F", en: "Order" },
  "setup.title": { zh: "\u5F00\u59CB\u590D\u4E60", en: "Start review" },
  "setup.range": { zh: "\u8303\u56F4", en: "Scope" },
  "setup.dictionary": { zh: "\u8BCD\u5178", en: "Dictionaries" },
  "setup.folder": { zh: "\u6587\u4EF6\u5939", en: "Folder" },
  "setup.tag": { zh: "\u6807\u7B7E", en: "Tag" },
  "setup.current": { zh: "\u5355\u4E2A\u6587\u4EF6", en: "Single file" },
  "setup.links": { zh: "\u76EE\u5F55\u6587\u4EF6\u5185\u53CC\u94FE", en: "Links in an index note" },
  "setup.mode": { zh: "\u6A21\u5F0F", en: "Mode" },
  "setup.scheduled": { zh: "\u6309\u6392\u671F\u590D\u4E60", en: "Scheduled review" },
  "setup.cram": { zh: "\u4E34\u65F6\u7A81\u51FB", en: "Practice all" },
  "setup.scheduledHint": { zh: "\u65B0\u5361\u548C\u5230\u671F\u5361\uFF1B\u6CBF\u7528\u6BCF\u65E5\u65B0\u5361\u4E0A\u9650\uFF0C\u8DF3\u8FC7\u4ECA\u5929\u5DF2\u5B8C\u6210\u7684\u5361\u3002", en: "New and due cards; follows the daily new-card limit and skips cards completed today." },
  "setup.cramHint": { zh: "\u5305\u542B\u672A\u5230\u671F\u548C\u4ECA\u5929\u80CC\u8FC7\u7684\u5361\uFF1B\u7EC3\u4E60\u4E0D\u6539\u53D8\u957F\u671F\u6392\u671F\u3002", en: "Includes future-due cards and cards reviewed today. Practice does not change long-term scheduling." },
  "setup.count": { zh: "\u672C\u6279\u6570\u91CF", en: "Batch size" },
  "setup.all": { zh: "\u5168\u90E8", en: "All" },
  "setup.rounds": { zh: "\u904D\u6570", en: "Rounds" },
  "setup.round": { zh: "\u7B2C {round} / {rounds} \u904D", en: "Round {round} / {rounds}" },
  "setup.practice": { zh: "\u7EC3\u4E60 \xB7 \u4E0D\u66F4\u65B0\u957F\u671F\u6392\u671F", en: "Practice \xB7 schedule unchanged" },
  "setup.practiceGoal": { zh: "{count} \u5F20 \xD7 {rounds} \u904D \xB7 \u7EC3\u4E60", en: "{count} cards \xD7 {rounds} rounds \xB7 practice" },
  "setup.repeat": { zh: "\u672C\u6279\u518D\u80CC\u4E00\u904D", en: "Repeat this batch" },
  "setup.remaining": { zh: "\u7EE7\u7EED\u5269\u4F59 {count} \u5F20", en: "Continue with {count} remaining" },
  "setup.savePlan": { zh: "\u4FDD\u5B58\u4E3A\u8BA1\u5212", en: "Save as plan" },
  "setup.dailyCount": { zh: "\u6BCF\u65E5\u76EE\u6807", en: "Daily target" },
  "setup.defaultGoal": { zh: "\u6CBF\u7528\u5168\u5C40\u76EE\u6807", en: "Use global target" },
  "setup.deadline": { zh: "\u622A\u6B62\u65E5\u671F\uFF08\u53EF\u9009\uFF09", en: "Deadline (optional)" },
  "setup.longTerm": { zh: "\u957F\u671F\u8BA1\u5212", en: "Ongoing plan" },
  "setup.daysLeft": { zh: "\u5269\u4F59 {days} \u5929", en: "{days} days left" },
  "setup.dueToday": { zh: "\u4ECA\u5929\u622A\u6B62", en: "Due today" },
  "setup.overdue": { zh: "\u5DF2\u903E\u671F {days} \u5929", en: "{days} days overdue" },
  "setup.deadlineHint": { zh: "\u7559\u7A7A\u4E3A\u957F\u671F\u8BA1\u5212\uFF1B\u622A\u6B62\u65E5\u671F\u53EA\u663E\u793A\u7D27\u6025\u7A0B\u5EA6\uFF0C\u4E0D\u6539\u52A8\u5361\u7247\u6392\u671F\u3002", en: "Leave empty for an ongoing plan. Deadlines indicate urgency without changing card schedules." },
  "setup.invalid": { zh: "\u8BF7\u9009\u62E9\u6709\u6548\u8303\u56F4\uFF0C\u6570\u91CF\u548C\u904D\u6570\u9700\u4E3A\u6B63\u6574\u6570\u3002", en: "Choose a valid scope; counts and rounds must be positive integers." },
  "setup.storage": { zh: "\u8BA1\u5212\u548C\u7EC3\u4E60\u8FDB\u5EA6\uFF1A{path}\u3002\u9700\u5728\u8BBE\u5907\u95F4\u540C\u6B65\u6B64\u6587\u4EF6\u5939\u3002", en: "Plans and practice progress: {path}. Sync this folder across devices." }
};

// src/selection-pill-i18n.ts
var selectionPillMessages = {
  "settings.pillPosition": { zh: "\u836F\u4E38\u4F4D\u7F6E\u4E0E\u5927\u5C0F", en: "Selection pill position and size" },
  "settings.pillSize": { zh: "\u836F\u4E38\u5927\u5C0F", en: "Pill size" },
  "settings.pillPositionDesc": { zh: "\u62D6\u52A8\u9884\u89C8\u836F\u4E38\uFF0C\u6216\u8C03\u6574\u50CF\u7D20\u504F\u79FB\u3002\u8D1F\u503C\u5411\u5DE6\uFF0F\u4E0A\uFF0C\u6B63\u503C\u5411\u53F3\uFF0F\u4E0B\uFF1B\u9760\u8FD1\u5C4F\u5E55\u8FB9\u7F18\u65F6\u81EA\u52A8\u6536\u56DE\u3002", en: "Drag the preview pill or adjust pixel offsets. Negative values move left/up, positive values right/down. The pill stays within screen edges." },
  "settings.pillPreviewText": { zh: "\u9009\u4E2D\u7684\u6587\u5B57", en: "Selected text" },
  "settings.pillDrag": { zh: "\u62D6\u52A8\u836F\u4E38", en: "Drag pill" },
  "settings.pillDragLabel": { zh: "\u62D6\u52A8\u8C03\u6574\u4F4D\u7F6E\uFF0C\u65B9\u5411\u952E\u5FAE\u8C03\uFF0CShift \u52A0\u901F", en: "Drag to reposition, or use arrow keys; hold Shift for larger steps" },
  "settings.pillOffsetX": { zh: "\u6A2A\u5411\u504F\u79FB (px)", en: "Horizontal offset (px)" },
  "settings.pillOffsetY": { zh: "\u7EB5\u5411\u504F\u79FB (px)", en: "Vertical offset (px)" },
  "settings.pillReset": { zh: "\u91CD\u7F6E\u4F4D\u7F6E\u4E0E\u5927\u5C0F", en: "Reset position and size" }
};

// src/i18n.ts
var MESSAGES = {
  ...dictionaryMessages,
  ...reviewSetupMessages,
  ...dashboardMessages,
  ...marginNoteMessages,
  ...settingsMessages,
  ...reviewLibraryMessages,
  ...selectionPillMessages,
  "language.name": { zh: "\u754C\u9762\u8BED\u8A00", en: "Interface language" },
  "language.zh": { zh: "\u4E2D\u6587", en: "\u4E2D\u6587" },
  "language.en": { zh: "English", en: "English" },
  "language.reload": { zh: "Lexis\uFF1A\u547D\u4EE4\u540D\u79F0\u5C06\u5728\u91CD\u8F7D\u63D2\u4EF6\u540E\u66F4\u65B0", en: "Lexis: command names update after reloading the plugin" },
  "common.all": { zh: "\u5168\u90E8", en: "All" },
  "common.default": { zh: "\u9ED8\u8BA4", en: "Default" },
  "common.delete": { zh: "\u5220\u9664", en: "Delete" },
  "common.refresh": { zh: "\u5237\u65B0", en: "Refresh" },
  "common.root": { zh: "\u6839\u76EE\u5F55", en: "Vault root" },
  "common.loading": { zh: "\u52A0\u8F7D\u4E2D\u2026", en: "Loading\u2026" },
  "common.searching": { zh: "\u641C\u7D22\u4E2D\u2026", en: "Searching\u2026" },
  "common.empty": { zh: "\u7A7A", en: "Empty" },
  "common.failed": { zh: "\u5931\u8D25", en: "Failed" },
  "common.cancel": { zh: "\u53D6\u6D88", en: "Cancel" },
  "common.save": { zh: "\u4FDD\u5B58", en: "Save" },
  "common.done": { zh: "\u5B8C\u6210", en: "Done" },
  "command.rebuild": { zh: "\u91CD\u5EFA\u8BCD\u6761\u7D22\u5F15", en: "Rebuild entry index" },
  "log.title": { zh: "\u590D\u4E60\u8BB0\u5F55", en: "Review log" },
  "log.history": { zh: "\u8BB0\u5F55", en: "History" },
  "log.unreviewed": { zh: "\u672A\u80CC\u8FC7", en: "Never reviewed" },
  "log.previousWeek": { zh: "\u4E0A\u4E00\u5468", en: "Previous week" },
  "log.nextWeek": { zh: "\u4E0B\u4E00\u5468", en: "Next week" },
  "log.today": { zh: "\u4ECA\u5929", en: "Today" },
  "log.notes": { zh: "\u7B14\u8BB0", en: "Notes" },
  "log.syntax": { zh: "\u95EA\u5361", en: "Flashcards" },
  "log.noDayCards": { zh: "\u8FD9\u5929\u6CA1\u6709\u53EF\u67E5\u7684\u5361\u7247", en: "No recorded cards for this day" },
  "log.dateOnly": { zh: "\u4EC5\u65E5\u671F", en: "Date only" },
  "log.unknownCard": { zh: "\u65E7\u5361\u7247", en: "Older card" },
  "log.dayStats": { zh: "\u5F53\u65E5\u6570\u636E", en: "Daily stats" },
  "log.actions": { zh: "\u4F5C\u7B54\u6B21\u6570", en: "Answers" },
  "log.weekActions": { zh: "\u672C\u5468\u4F5C\u7B54", en: "This week" },
  "log.unique": { zh: "\u53EF\u67E5\u5361\u7247", en: "Recorded cards" },
  "log.firstSuccess": { zh: "\u9996\u6B21\u4F5C\u7B54\u6210\u529F\u7387", en: "First-attempt recall" },
  "log.predicted": { zh: "\u4F5C\u7B54\u524D\u9884\u8BA1\u4FDD\u7559\u7387", en: "Predicted retention before review" },
  "log.statsHint": { zh: "\u6210\u529F\u7387\u6309\u5F53\u65E5\u6BCF\u5361\u9996\u6B21\u4F5C\u7B54\u8BA1\u7B97\uFF1B\u9884\u8BA1\u4FDD\u7559\u7387\u662F\u6A21\u578B\u9884\u6D4B\uFF0C\u4EC5\u7EDF\u8BA1\u65B0\u8BB0\u5F55\u3002", en: "Recall uses each card's first answer of the day. Predicted retention is model-based and uses new records only." },
  "log.legacyHint": { zh: "\u65E7\u8BB0\u5F55\u53EA\u6709\u65E5\u671F\u3001\u6BCF\u5361\u6700\u591A\u6700\u8FD1 64 \u6B21\uFF1B\u8F83\u65E9\u5361\u7247\u53EF\u80FD\u4E0D\u5B8C\u6574\u3002", en: "Older records have dates only and at most 64 events per card; earlier cards may be missing." },
  "log.added": { zh: "\u52A0\u5165 Lexis", en: "Added to Lexis" },
  "log.fileCreated": { zh: "\u6587\u4EF6\u521B\u5EFA\uFF08\u8FD1\u4F3C\uFF09", en: "File created (approx.)" },
  "log.firstReview": { zh: "\u9996\u6B21\u80CC\u8BF5", en: "First review" },
  "log.earliestReview": { zh: "\u6700\u65E9\u53EF\u67E5\u590D\u4E60", en: "Earliest recorded review" },
  "log.due": { zh: "\u4E0B\u6B21\u5230\u671F", en: "Next due" },
  "log.recent": { zh: "\u6700\u8FD1\u8BB0\u5F55", en: "Recent reviews" },
  "log.openSource": { zh: "\u6253\u5F00\u539F\u6587", en: "Open source" },
  "log.sourceMissing": { zh: "\u539F\u6587\u4EF6\u5DF2\u79FB\u52A8\u6216\u5220\u9664", en: "Source file moved or deleted" },
  "log.unknown": { zh: "\u672A\u8BB0\u5F55", en: "Not recorded" },
  "log.never": { zh: "\u5C1A\u672A\u80CC\u8BF5", en: "Not reviewed yet" },
  "log.search": { zh: "\u641C\u7D22\u5361\u7247\u6216\u6587\u4EF6", en: "Search cards or files" },
  "log.count": { zh: "{count} \u5F20", en: "{count} cards" },
  "log.more": { zh: "\u518D\u663E\u793A 100 \u5F20\uFF08\u8FD8\u5269 {count} \u5F20\uFF09", en: "Show 100 more ({count} remaining)" },
  "log.noUnreviewed": { zh: "\u6CA1\u6709\u5339\u914D\u7684\u672A\u80CC\u5361\u7247", en: "No matching unreviewed cards" },
  "log.unreviewedHint": { zh: "\u6309\u65E0\u590D\u4E60\u6392\u671F\u3001\u65E0\u53EF\u67E5\u8BB0\u5F55\u5224\u65AD\uFF1B\u65E7\u6570\u636E\u65E0\u6CD5\u8BC1\u660E\u7EDD\u5BF9\u4ECE\u672A\u80CC\u8FC7\u3002", en: "Based on no schedule and no recorded review; older data cannot prove a card was never reviewed." },
  "command.addSelection": { zh: "\u628A\u9009\u4E2D\u5185\u5BB9\u52A0\u5165 Lexis", en: "Add selection to Lexis" },
  "command.home": { zh: "\u5728\u4E2D\u95F4\u6253\u5F00 Lexis \u4E3B\u9875", en: "Open Lexis home in main area" },
  "command.homeSidebar": { zh: "\u5728\u4FA7\u8FB9\u680F\u6253\u5F00 Lexis \u4E3B\u9875", en: "Open Lexis home in sidebar" },
  "command.toggleHighlights": { zh: "\u5207\u6362\u5F53\u524D\u9875\u9762\u7684\u6240\u6709\u9AD8\u4EAE", en: "Toggle all highlights on current page" },
  "command.toggleStatusBar": { zh: "\u5207\u6362 Lexis \u72B6\u6001\u680F", en: "Toggle Lexis status bar" },
  "command.archive": { zh: "\u6807\u4E3A\u5DF2\u638C\u63E1\uFF08\u5F52\u6863\uFF09", en: "Mark as mastered (archive)" },
  "command.restore": { zh: "\u6062\u590D\uFF08\u53D6\u6D88\u5F52\u6863\uFF09", en: "Restore from archive" },
  "command.pin": { zh: "\u5207\u6362\u5E38\u9A7B\u72B6\u6001", en: "Toggle resident status" },
  "command.migrate": { zh: "\u8FC1\u79FB\uFF1A\u628A #\u719F\u6089 \u6279\u91CF\u6807\u4E3A\u5F52\u6863", en: "Migrate: archive entries tagged #\u719F\u6089" },
  "ribbon.home": { zh: "Lexis \u4E3B\u9875", en: "Lexis home" },
  "ribbon.review": { zh: "Lexis \u590D\u4E60", en: "Lexis review" },
  "status.toggleDetailsAria": { zh: "\u5C55\u5F00\u6216\u6536\u8D77 Lexis \u72B6\u6001", en: "Expand or collapse Lexis status" },
  "status.summary": { zh: "{words} \u8BCD{aliases}{inline}{due}{bridge}", en: "{words} entries{aliases}{inline}{due}{bridge}" },
  "status.aliases": { zh: " +{count} \u522B\u540D", en: " +{count} aliases" },
  "status.inline": { zh: " +{count} \u5185\u8054", en: " +{count} inline" },
  "notice.desktopBridge": { zh: "Lexis\uFF1A\u672C\u673A\u6865\u63A5\u4EC5\u652F\u6301\u684C\u9762\u7AEF", en: "Lexis: the local bridge is desktop-only" },
  "notice.bridgeFailed": { zh: "Lexis \u6865\u63A5\u542F\u52A8\u5931\u8D25\uFF1A{reason}", en: "Lexis bridge failed to start: {reason}" },
  "notice.portBusy": { zh: "\u7AEF\u53E3 {port} \u88AB\u5360\u7528", en: "Port {port} is already in use" },
  "notice.loadFailed": { zh: "Lexis \u52A0\u8F7D\u5931\u8D25\uFF1A{error}", en: "Lexis failed to load: {error}" },
  "notice.archived": { zh: "Lexis\uFF1A\u300C{word}\u300D\u5DF2\u5F52\u6863", en: "Lexis: archived \u201C{word}\u201D" },
  "notice.pinned": { zh: "Lexis\uFF1A\u300C{word}\u300D\u5DF2\u8BBE\u4E3A\u5E38\u9A7B", en: "Lexis: marked \u201C{word}\u201D as resident" },
  "notice.unpinned": { zh: "Lexis\uFF1A\u300C{word}\u300D\u5DF2\u53D6\u6D88\u5E38\u9A7B", en: "Lexis: removed resident status from \u201C{word}\u201D" },
  "notice.noFamiliar": { zh: "Lexis\uFF1A\u6CA1\u6709\u53EF\u8FC1\u79FB\u7684 #\u719F\u6089 \u8BCD\u6761", en: "Lexis: no entries tagged #\u719F\u6089 are eligible for migration" },
  "notice.migrated": { zh: "Lexis\uFF1A\u5DF2\u5F52\u6863 {count} \u4E2A #\u719F\u6089 \u8BCD\u6761", en: "Lexis: archived {count} entries tagged #\u719F\u6089" },
  "notice.indexBuilt": { zh: "Lexis\uFF1A\u5DF2\u4ECE {scope} \u8BC6\u522B {words} \u4E2A\u8BCD\u6761{aliases}{inline}", en: "Lexis: indexed {words} entries{aliases}{inline} from {scope}" },
  "notice.aliasCount": { zh: "\uFF08\u542B {count} \u4E2A\u522B\u540D\uFF09", en: " ({count} aliases)" },
  "notice.inlineCount": { zh: "\uFF0C\u53E6\u6709 {count} \u6761\u5185\u8054\u6761\u76EE", en: " and {count} inline entries" },
  "notice.scopeFolders": { zh: "{count} \u4E2A\u6587\u4EF6\u5939", en: "{count} folders" },
  "notice.scopeTags": { zh: "{count} \u4E2A\u6807\u7B7E", en: "{count} tags" },
  "notice.scopeEmpty": { zh: "\u7A7A\u8303\u56F4", en: "an empty scope" },
  "notice.selectWord": { zh: "Lexis\uFF1A\u8BF7\u5148\u9009\u4E2D\u5185\u5BB9", en: "Lexis: select some text first" },
  "notice.invalidWord": { zh: "Lexis\uFF1A\u65E0\u6548\u8BCD\u6761", en: "Lexis: invalid entry" },
  "notice.exists": { zh: "Lexis\uFF1A\u300C{word}\u300D\u5DF2\u5B58\u5728\uFF0C\u6B63\u5728\u6253\u5F00", en: "Lexis: \u201C{word}\u201D already exists; opening it" },
  "notice.existsNoOpen": { zh: "Lexis\uFF1A\u300C{word}\u300D\u5DF2\u5B58\u5728", en: "Lexis: \u201C{word}\u201D already exists" },
  "notice.addedPdf": { zh: "Lexis\uFF1A\u5DF2\u52A0\u5165\u300C{word}\u300D\u5E76\u9AD8\u4EAE", en: "Lexis: added and highlighted \u201C{word}\u201D" },
  "notice.created": { zh: "Lexis\uFF1A\u5DF2\u521B\u5EFA\u300C{word}\u300D", en: "Lexis: created \u201C{word}\u201D" },
  "notice.createFailed": { zh: "Lexis \u521B\u5EFA\u5931\u8D25\uFF1A{error}", en: "Lexis failed to create the entry: {error}" },
  "notice.aliasSelf": { zh: "Lexis\uFF1A\u300C{word}\u300D\u5C31\u662F\u8BE5\u8BCD\u6761\u672C\u8EAB", en: "Lexis: \u201C{word}\u201D is already this entry" },
  "notice.aliasAdded": { zh: "Lexis\uFF1A\u5DF2\u628A\u300C{alias}\u300D\u8BBE\u4E3A\u300C{word}\u300D\u7684\u522B\u540D", en: "Lexis: added \u201C{alias}\u201D as an alias of \u201C{word}\u201D" },
  "notice.aliasFailed": { zh: "Lexis \u6DFB\u52A0\u522B\u540D\u5931\u8D25\uFF1A{error}", en: "Lexis failed to add the alias: {error}" },
  "notice.bridgeRestarted": { zh: "Lexis\uFF1A\u6865\u63A5\u5DF2\u91CD\u542F", en: "Lexis: bridge restarted" },
  "notice.tokenCopied": { zh: "Lexis\uFF1A\u4EE4\u724C\u5DF2\u590D\u5236", en: "Lexis: token copied" },
  "notice.highlightsHidden": { zh: "Lexis\uFF1A\u5F53\u524D\u9875\u9762\u9AD8\u4EAE\u5DF2\u9690\u85CF", en: "Lexis: highlights hidden on this page" },
  "notice.highlightsShown": { zh: "Lexis\uFF1A\u5F53\u524D\u9875\u9762\u9AD8\u4EAE\u5DF2\u663E\u793A", en: "Lexis: highlights shown on this page" },
  "notice.moved": { zh: "Lexis\uFF1A\u5DF2\u79FB\u5230 {folder}", en: "Lexis: moved to {folder}" },
  "notice.moveFailed": { zh: "Lexis \u79FB\u52A8\u5931\u8D25\uFF1A{error}", en: "Lexis failed to move the entry: {error}" },
  "notice.noteAdded": { zh: "Lexis\uFF1A\u5DF2\u7ED9\u300C{word}\u300D\u6DFB\u52A0\u6279\u6CE8", en: "Lexis: added a note to \u201C{word}\u201D" },
  "notice.noteFailed": { zh: "Lexis \u6DFB\u52A0\u6279\u6CE8\u5931\u8D25\uFF1A{error}", en: "Lexis failed to add the note: {error}" },
  "notice.deleted": { zh: "Lexis\uFF1A\u5DF2\u5220\u9664\u300C{word}\u300D", en: "Lexis: deleted \u201C{word}\u201D" },
  "notice.deleteFailed": { zh: "Lexis \u5220\u9664\u5931\u8D25\uFF1A{error}", en: "Lexis failed to delete the entry: {error}" },
  "notice.occurrenceExists": { zh: "Lexis\uFF1A\u8FD9\u6761\u5DF2\u7ECF\u6536\u85CF", en: "Lexis: this occurrence is already saved" },
  "notice.occurrenceSaved": { zh: "Lexis\uFF1A\u5DF2\u6536\u85CF\u5230\u51FA\u5904", en: "Lexis: saved as an occurrence" },
  "notice.occurrenceFailed": { zh: "Lexis \u6536\u85CF\u5931\u8D25\uFF1A{error}", en: "Lexis failed to save the occurrence: {error}" },
  "menu.restore": { zh: "Lexis\uFF1A\u6062\u590D", en: "Lexis: Restore" },
  "menu.archive": { zh: "Lexis\uFF1A\u6807\u4E3A\u5DF2\u638C\u63E1\uFF08\u5F52\u6863\uFF09", en: "Lexis: Mark as mastered (archive)" },
  "menu.pin": { zh: "Lexis\uFF1A\u5E38\u9A7B", en: "Lexis: Mark as resident" },
  "menu.unpin": { zh: "Lexis\uFF1A\u53D6\u6D88\u5E38\u9A7B", en: "Lexis: Remove resident status" },
  "menu.addTo": { zh: "Lexis\uFF1A\u6DFB\u52A0\u201C{word}\u201D\u5230 {folder}", en: "Lexis: Add \u201C{word}\u201D to {folder}" },
  "menu.add": { zh: "Lexis\uFF1A\u6DFB\u52A0\u201C{word}\u201D", en: "Lexis: Add \u201C{word}\u201D" },
  "review.title": { zh: "Lexis \u590D\u4E60", en: "Lexis review" },
  "review.progress": { zh: "\u5DF2\u80CC {done} \xB7 \u5269 {left}", en: "Reviewed {done} \xB7 {left} left" },
  "review.undo": { zh: "\u64A4\u9500 (Z)", en: "Undo (Z)" },
  "review.skip": { zh: "\u8DF3\u8FC7 (S)", en: "Skip (S)" },
  "review.suspend": { zh: "\u6401\u7F6E", en: "Suspend" },
  "review.openSource": { zh: "\u5728\u5F53\u524D\u6807\u7B7E\u9875\u6253\u5F00\u539F\u6587", en: "Open source in current tab" },
  "curve.recentReviews": { zh: "\u6700\u8FD1\u590D\u4E60\uFF1A{dates}", en: "Recent reviews: {dates}" },
  "review.onlyTag": { zh: "\u53EA\u80CC #{tag}", en: "Review only #{tag}" },
  "review.show": { zh: "\u663E\u793A\u7B54\u6848 (\u7A7A\u683C)", en: "Show answer (Space)" },
  "review.showOne": { zh: "\u663E\u793A\u4E00\u4E2A", en: "Show one" },
  "review.showAll": { zh: "\u663E\u793A\u6240\u6709", en: "Show all" },
  "review.again": { zh: "\u91CD\u6765", en: "Again" },
  "review.hard": { zh: "\u8F83\u96BE", en: "Hard" },
  "review.good": { zh: "\u8BB0\u5F97", en: "Good" },
  "review.easy": { zh: "\u7B80\u5355", en: "Easy" },
  "review.renderFailed": { zh: "\u5185\u5BB9\u6E32\u67D3\u5931\u8D25\uFF1A{error}", en: "Failed to render content: {error}" },
  "review.revealFirst": { zh: "Lexis\uFF1A\u8BF7\u5148\u663E\u793A\u7B54\u6848", en: "Lexis: reveal the answer first" },
  "review.gradeFailed": { zh: "Lexis \u8BC4\u5206\u5931\u8D25\uFF1A{error}", en: "Lexis failed to save the rating: {error}" },
  "review.nothingUndo": { zh: "Lexis\uFF1A\u6CA1\u6709\u53EF\u64A4\u9500\u7684\u64CD\u4F5C", en: "Lexis: nothing to undo" },
  "review.undoFailed": { zh: "Lexis \u64A4\u9500\u5931\u8D25\uFF1A{error}", en: "Lexis failed to undo: {error}" },
  "review.suspendFailed": { zh: "Lexis \u6401\u7F6E\u5931\u8D25\uFF1A{error}", en: "Lexis failed to suspend: {error}" },
  "review.closeImage": { zh: "\u5173\u95ED\u5927\u56FE", en: "Close image" },
  "review.done": { zh: "\u672C\u8F6E\u5DF2\u590D\u4E60 {count} \u4E2A", en: "Reviewed {count} this session" },
  "review.noneDue": { zh: "\u6682\u65E0\u5230\u671F\u8BCD\u6761", en: "No entries are due" },
  "review.checkAgain": { zh: "\u91CD\u65B0\u68C0\u67E5", en: "Check again" },
  "interval.ltDay": { zh: "<1\u5929", en: "<1d" },
  "interval.days": { zh: "{count}\u5929", en: "{count}d" },
  "interval.months": { zh: "{count}\u4E2A\u6708", en: "{count}mo" },
  "interval.years": { zh: "{count}\u5E74", en: "{count}y" },
  "home.due": { zh: "\u5F85\u590D\u4E60 {count}", en: "Due {count}" },
  "home.new": { zh: "\u65B0\u8BCD {count}", en: "New {count}" },
  "home.total": { zh: "\u603B\u8BA1 {count}", en: "Total {count}" },
  "home.start": { zh: "\u5F00\u59CB\u590D\u4E60", en: "Start review" },
  "home.collection": { zh: "\u96C6\u5408", en: "Collection" },
  "home.reviewScope": { zh: "\u8303\u56F4", en: "Scope" },
  "home.scopeVocab": { zh: "Lexis \u8BCD\u5178", en: "Lexis dictionaries" },
  "home.scopeFolder": { zh: "\u6587\u4EF6\u5939", en: "Folder" },
  "home.scopeLinks": { zh: "\u6587\u4EF6\u53CC\u94FE", en: "File links" },
  "home.scopeTag": { zh: "\u6807\u7B7E", en: "Tag" },
  "home.scopeCurrent": { zh: "\u5F53\u524D\u7B14\u8BB0", en: "Current note" },
  "home.scopeAllFiles": { zh: "\u6574\u4E2A\u4ED3\u5E93", en: "Whole vault" },
  "home.reviewDictionary": { zh: "\u8BCD\u5178", en: "Dictionary" },
  "home.scopeAllDictionaries": { zh: "\u5168\u90E8\u8BCD\u5178", en: "All dictionaries" },
  "home.reviewFolder": { zh: "\u590D\u4E60\u6587\u4EF6\u5939", en: "Review folder" },
  "home.chooseFolder": { zh: "\u8F93\u5165\u540D\u79F0\u6216\u8DEF\u5F84\u641C\u7D22\u6587\u4EF6\u5939", en: "Search folders by name or path" },
  "home.reviewLinkSource": { zh: "\u6765\u6E90\u6587\u4EF6", en: "Source file" },
  "home.chooseMarkdownFile": { zh: "\u8F93\u5165\u540D\u79F0\u6216\u8DEF\u5F84\u641C\u7D22", en: "Search by name or path" },
  "home.reviewTag": { zh: "\u590D\u4E60\u6807\u7B7E", en: "Review tag" },
  "home.chooseTag": { zh: "\u9009\u62E9\u6807\u7B7E", en: "Choose a tag" },
  "home.currentNote": { zh: "\u5F53\u524D\u7B14\u8BB0", en: "Current note" },
  "home.noCurrentNote": { zh: "\u6CA1\u6709\u6253\u5F00 Markdown \u7B14\u8BB0", en: "No Markdown note is open" },
  "home.reviewContent": { zh: "\u5185\u5BB9", en: "Content" },
  "home.contentNotes": { zh: "\u7B14\u8BB0", en: "Notes" },
  "home.contentContext": { zh: "\u7B14\u8BB0\u5185\u5361\u7247", en: "Cards in note" },
  "home.contentSyntax": { zh: "\u8BED\u6CD5\u5361", en: "Syntax cards" },
  "home.contentBoth": { zh: "\u4E24\u8005", en: "Both" },
  "home.sortBy": { zh: "\u6392\u5E8F\u4F9D\u636E", en: "Sort by" },
  "home.sortDirection": { zh: "\u6392\u5E8F\u65B9\u5411", en: "Direction" },
  "home.sortDue": { zh: "\u5230\u671F\u65E5", en: "Due date" },
  "home.sortWordCount": { zh: "\u5B57\u6570", en: "Word count" },
  "home.sortModified": { zh: "\u4FEE\u6539\u65F6\u95F4", en: "Modified time" },
  "home.sortCreated": { zh: "\u521B\u5EFA\u65F6\u95F4", en: "Created time" },
  "home.ascending": { zh: "\u5347\u5E8F", en: "Ascending" },
  "home.descending": { zh: "\u964D\u5E8F", en: "Descending" },
  "home.frequency": { zh: "\u8BCD\u9891", en: "Frequency" },
  "home.random": { zh: "\u968F\u673A", en: "Random" },
  "home.open": { zh: "\u6253\u5F00\u4E3B\u9875", en: "Open home" },
  "home.openTitle": { zh: "\u70B9\u51FB\u6253\u5F00 Lexis \u4E3B\u9875", en: "Open Lexis home" },
  "home.retire": { zh: "\u6DD8\u6C70\u5019\u9009", en: "Retirement candidates" },
  "home.suspended": { zh: "\u5DF2\u6401\u7F6E", en: "Suspended" },
  "home.noSuspended": { zh: "\u6682\u65E0\u6401\u7F6E\u5361\u7247", en: "No suspended cards" },
  "home.restoreSuspendedOne": { zh: "\u53D6\u6D88\u6401\u7F6E", en: "Restore" },
  "home.suspendedNote": { zh: "\u7B14\u8BB0\u5361\u7247", en: "Note card" },
  "home.suspendedSyntax": { zh: "\u8BED\u6CD5\u5361", en: "Syntax card" },
  "home.line": { zh: "\u7B2C {line} \u884C", en: "Line {line}" },
  "home.archived": { zh: "\u5DF2\u5F52\u6863", en: "Archived" },
  "home.noArchived": { zh: "\u6682\u65E0\u5F52\u6863\u6761\u76EE", en: "No archived entries" },
  "home.restoreArchived": { zh: "\u6062\u590D", en: "Restore" },
  "home.archivedMeta": { zh: "\u5DF2\u505C\u6B62\u9AD8\u4EAE\u548C\u590D\u4E60\uFF1B\u4ECD\u53EF\u60AC\u6D6E\u67E5\u770B", en: "Highlighting and review paused; hover remains available" },
  "home.retireThreshold": { zh: "\u5165\u5E93/\u672A\u76F8\u9047\u5929\u6570\u9608\u503C", en: "Added / unseen threshold" },
  "home.retireThresholdDesc": { zh: "\u4E24\u9879\u5747\u8FBE\u5230\u6B64\u5929\u6570\u624D\u5165\u5217\u3002", en: "Both ages must reach this value." },
  "home.calculating": { zh: "\u8BA1\u7B97\u4E2D\u2026", en: "Calculating\u2026" },
  "home.noCandidates": { zh: "\u6682\u65E0\u5019\u9009", en: "No candidates" },
  "home.candidateMeta": { zh: "\u5165\u5E93 {created} \xB7 \u6700\u8FD1\u4E3B\u52A8\u76F8\u9047 {last} \xB7 \u51FA\u5904 {occurrences} \u6761 \xB7 \u672A\u76F8\u9047 {days} \u5929", en: "Added {created} \xB7 Last active encounter {last} \xB7 {occurrences} occurrences \xB7 unseen for {days} days" },
  "home.evict": { zh: "\u6DD8\u6C70", en: "Retire" },
  "home.keep": { zh: "\u7559\u4E0B", en: "Keep" },
  "home.mastered": { zh: "\u5DF2\u638C\u63E1", en: "Mastered" },
  "home.bulkEvict": { zh: "\u6279\u91CF\u6DD8\u6C70", en: "Retire selected" },
  "home.bulkKeep": { zh: "\u6279\u91CF\u7559\u4E0B", en: "Keep selected" },
  "home.bulkMastered": { zh: "\u6279\u91CF\u5DF2\u638C\u63E1", en: "Master selected" },
  "home.heatmapCaption": { zh: "\u8FD1 {weeks} \u5468 \xB7 \u5171 {count} \u6B21\u590D\u4E60", en: "Last {weeks} weeks \xB7 {count} reviews" },
  "home.heatmapDay": { zh: "{date}\uFF1A{count} \u6B21", en: "{date}: {count} reviews" },
  "popover.addOccurrence": { zh: "\u6536\u85CF\u5230\u51FA\u5904", en: "Save as occurrence" },
  "popover.addCurrentOccurrence": { zh: "+ \u51FA\u5904", en: "+ Source" },
  "popover.addCurrentOccurrenceTitle": { zh: "\u628A\u5F53\u524D\u53E5\u5B50\u6536\u85CF\u5230\u51FA\u5904", en: "Save the current sentence as a source" },
  "popover.occurrences": { zh: "\u51FA\u73B0\u8FC7\u7684\u5730\u65B9 ({count})", en: "Occurrences ({count})" },
  "popover.noOccurrences": { zh: "\u6CA1\u6709\u672A\u6536\u85CF\u7684\u65B0\u51FA\u5904", en: "No new unsaved occurrences" },
  "popover.addNote": { zh: "\u6DFB\u52A0\u6279\u6CE8", en: "Add note" },
  "popover.editEntry": { zh: "\u7F16\u8F91\u8BCD\u6761", en: "Edit entry" },
  "popover.editTitle": { zh: "\u7F16\u8F91\u300C{word}\u300D", en: "Edit '{word}'" },
  "popover.editHint": { zh: "\u7F16\u8F91\u6B63\u6587\uFF1B\u5C5E\u6027\u4F1A\u539F\u6837\u4FDD\u7559\u3002", en: "Edit the note body; properties are preserved." },
  "popover.editConflict": { zh: "\u6B63\u6587\u5DF2\u5728\u522B\u5904\u4FEE\u6539\u3002\u672A\u8986\u76D6\u6587\u4EF6\uFF0C\u8BF7\u5148\u590D\u5236\u5F53\u524D\u8349\u7A3F\u3002", en: "The body changed elsewhere. Nothing was overwritten; copy your draft first." },
  "popover.editSaved": { zh: "\u5DF2\u4FDD\u5B58\u300C{word}\u300D", en: "Saved '{word}'" },
  "popover.saving": { zh: "\u4FDD\u5B58\u4E2D\u2026", en: "Saving\u2026" },
  "popover.saved": { zh: "\u5DF2\u4FDD\u5B58", en: "Saved" },
  "popover.autosave": { zh: "\u81EA\u52A8\u4FDD\u5B58", en: "Auto-save" },
  "settings.popoverEditMode": { zh: "\u94C5\u7B14\u7F16\u8F91", en: "Pencil action" },
  "settings.popoverEditInline": { zh: "\u5361\u7247\u5185", en: "In card" },
  "settings.popoverEditWindow": { zh: "\u72EC\u7ACB\u7A97\u53E3", en: "Separate window" },
  "popover.addImage": { zh: "\u6DFB\u52A0\u56FE\u7247", en: "Add image" },
  "popover.notePlaceholder": { zh: "\u5199\u6279\u6CE8\uFF0C\u56DE\u8F66\u4FDD\u5B58\uFF0CEsc \u53D6\u6D88", en: "Write a note; Enter to save, Esc to cancel" },
  "popover.deleteEntry": { zh: "\u4ECE\u8BCD\u5E93\u4E2D\u5220\u9664", en: "Delete from dictionary" },
  "popover.deleteConfirm": { zh: "\u5220\u9664\u300C{word}\u300D\uFF1F", en: "Delete \u201C{word}\u201D?" },
  "popover.deleteTag": { zh: "\u5220\u9664\u6807\u7B7E", en: "Remove tag" },
  "popover.addTag": { zh: "+ \u6807\u7B7E", en: "+ Tag" },
  "popover.archive": { zh: "\u5F52\u6863", en: "Archive" },
  "popover.restore": { zh: "\u6062\u590D", en: "Restore" },
  "popover.archiveTitle": { zh: "\u9000\u51FA\u9AD8\u4EAE\u548C\u590D\u4E60\uFF1B\u4ECD\u53EF\u60AC\u505C\u67E5\u770B", en: "Stop highlighting and review; hover remains available" },
  "popover.restoreTitle": { zh: "\u91CD\u65B0\u52A0\u5165\u9AD8\u4EAE\u548C\u590D\u4E60", en: "Return to highlighting and review" },
  "popover.moveDictionary": { zh: "\u70B9\u51FB\u79FB\u5230\u5176\u4ED6\u8BCD\u5178", en: "Move to another dictionary" },
  "popover.readFailed": { zh: "\u8BFB\u53D6\u5931\u8D25\uFF1A{error}", en: "Failed to read: {error}" },
  "popover.resize": { zh: "\u62D6\u52A8\u8C03\u6574\u5361\u7247\u5927\u5C0F", en: "Drag to resize card" },
  "selection.openExisting": { zh: "\u5DF2\u6709\uFF0C\u6253\u5F00", en: "Open existing" },
  "selection.lookupExisting": { zh: "\u5DF2\u6709\uFF0C\u67E5\u8BE2", en: "Look up" },
  "selection.add": { zh: "\u52A0\u5165\u8BCD\u5E93", en: "Add to dictionary" },
  "selection.chooseDictionary": { zh: "\u9009\u62E9\u8BCD\u5178", en: "Choose dictionary" },
  "selection.alias": { zh: "\u8BBE\u4E3A\u522B\u540D", en: "Add as alias" },
  "selection.aliasSearch": { zh: "\u8F93\u5165\u539F\u5F62\u6216\u641C\u7D22\u5DF2\u6709\u8BCD\u6761", en: "Enter a headword or search entries" },
  "selection.aliasCreate": { zh: "\u65B0\u5EFA\u8BCD\u6761", en: "Create entry" },
  "selection.aliasExisting": { zh: "\u5F52\u5165\u300C{word}\u300D", en: "Use \u201C{word}\u201D" },
  "selection.aliasNoResults": { zh: "\u6CA1\u6709\u5339\u914D\u8BCD\u6761", en: "No matching entry" },
  "restore.title": { zh: "\u6062\u590D\u300C{word}\u300D", en: "Restore \u201C{word}\u201D" },
  "restore.question": { zh: "\u4FDD\u7559\u539F\u6709\u590D\u4E60\u8FDB\u5EA6\uFF0C\u8FD8\u662F\u91CD\u7F6E\u4E3A\u65B0\u8BCD\uFF1F", en: "Keep its review history or reset it as new?" },
  "restore.keep": { zh: "\u4FDD\u7559\u8FDB\u5EA6", en: "Keep progress" },
  "restore.reset": { zh: "\u91CD\u7F6E\u4E3A\u65B0\u8BCD", en: "Reset as new" },
  "restore.kept": { zh: "Lexis\uFF1A\u300C{word}\u300D\u5DF2\u6062\u590D\u5E76\u4FDD\u7559\u8FDB\u5EA6", en: "Lexis: restored \u201C{word}\u201D with its progress" },
  "restore.resetDone": { zh: "Lexis\uFF1A\u300C{word}\u300D\u5DF2\u6062\u590D\u4E3A\u65B0\u8BCD", en: "Lexis: restored \u201C{word}\u201D as new" },
  "settings.title": { zh: "Lexis \u8BBE\u7F6E", en: "Lexis settings" },
  "settings.search": { zh: "\u641C\u7D22\u6240\u6709\u8BBE\u7F6E", en: "Search all settings" },
  "settings.clearSearch": { zh: "\u6E05\u9664\u641C\u7D22", en: "Clear search" },
  "settings.noSearchResults": { zh: "\u6CA1\u6709\u5339\u914D\u7684\u8BBE\u7F6E", en: "No matching settings" },
  "settings.moveToTab": { zh: "\u79FB\u81F3\u300C{tab}\u300D", en: "Move to {tab}" },
  "settings.reorderMenu": { zh: "\u70B9\u51FB\u83DC\u5355\uFF1B\u62D6\u52A8\u6392\u5E8F\uFF0C\u89E6\u5C4F\u957F\u6309", en: "Click for menu; drag to reorder, long-press on touch" },
  "settings.tabGeneral": { zh: "\u5E38\u89C4", en: "General" },
  "settings.tabVocabulary": { zh: "\u8BCD\u5E93", en: "Vocabulary" },
  "settings.tabReading": { zh: "\u9605\u8BFB", en: "Reading" },
  "settings.tabReview": { zh: "\u590D\u4E60", en: "Review" },
  "settings.tabIntegrations": { zh: "\u8054\u52A8", en: "Integrations" },
  "settings.statusBar": { zh: "\u663E\u793A\u72B6\u6001\u680F\u5165\u53E3", en: "Show status bar item" },
  "settings.statusBarDesc": { zh: "\u5E73\u65F6\u53EA\u663E\u793A\u56FE\u6807\uFF0C\u70B9\u51FB\u53EF\u5C55\u5F00\u6216\u6536\u8D77\u7EDF\u8BA1\u3002\u9690\u85CF\u540E\u53EF\u7528\u547D\u4EE4\u9762\u677F\u6062\u590D\u3002", en: "Shows an icon by default; click it to expand or collapse statistics. Restore it from the command palette after hiding it." },
  "settings.dictionary": { zh: "\u8BCD\u5178\u4E0E\u8BCD\u5E93\u6765\u6E90", en: "Dictionaries and sources" },
  "settings.dictionaryDesc": { zh: "\u6BCF\u884C\u4E00\u4E2A\u6765\u6E90\uFF1B\u6587\u4EF6\u5939\u53EF\u8BBE\u6A21\u677F\uFF0C\u6807\u7B7E\u6765\u6E90\u53EA\u8D1F\u8D23\u6536\u5F55\u3002", en: "One source per row; folders can use templates, tags only collect entries." },
  "settings.folderPlaceholder": { zh: "\u6587\u4EF6\u5939\uFF0C\u6216\u8F93\u5165 #\u6807\u7B7E", en: "Folder, or enter #tag" },
  "settings.tagSourcePlaceholder": { zh: "\u6807\u7B7E\u6765\u6E90\u65E0\u9700\u6A21\u677F", en: "Tag sources do not use templates" },
  "settings.tagSource": { zh: "\u6807\u7B7E", en: "Tag" },
  "settings.addFolderSource": { zh: "\u6DFB\u52A0\u6587\u4EF6\u5939", en: "Add folder" },
  "settings.addTagSource": { zh: "\u6DFB\u52A0\u6807\u7B7E", en: "Add tag" },
  "settings.templatePlaceholder": { zh: "\u6A21\u677F\u8DEF\u5F84\uFF1B\u7559\u7A7A\u4E3A\u767D\u7EB8", en: "Template path; blank for an empty note" },
  "settings.templaterTemplate": { zh: "\u7531 Templater \u6587\u4EF6\u5939\u6A21\u677F\u63A5\u7BA1\uFF1A{path}", en: "Managed by the Templater folder template: {path}" },
  "settings.followGlobal": { zh: "\u8DDF\u968F\u5168\u5C40\u989C\u8272", en: "Use global color" },
  "settings.dictionaryColor": { zh: "\u8BCD\u5178\u989C\u8272", en: "Dictionary color" },
  "settings.dictionaryAppearance": { zh: "\u8BCD\u5178\u9AD8\u4EAE\u5916\u89C2", en: "Dictionary highlight appearance" },
  "settings.showDictionaryHighlight": { zh: "\u663E\u793A\u8FD9\u4E2A\u8BCD\u5178\u7684\u9AD8\u4EAE", en: "Show highlights for this dictionary" },
  "settings.resetGlobal": { zh: "\u6062\u590D\u5168\u5C40\u989C\u8272", en: "Reset to global color" },
  "settings.deleteDictionary": { zh: "\u5220\u9664\u8FD9\u4E2A\u8BCD\u5178", en: "Delete this dictionary" },
  "settings.addDictionary": { zh: "+ \u6DFB\u52A0\u8BCD\u5178", en: "+ Add dictionary" },
  "settings.reorder": { zh: "\u957F\u6309\u5E76\u62D6\u52A8\u6392\u5E8F", en: "Press and drag to reorder" },
  "settings.tagsAsEntries": { zh: "\u6309\u6807\u7B7E\u6536\u5F55", en: "Include by tag" },
  "settings.tagsAsEntriesDesc": { zh: "\u4E0E\u8BCD\u5178\u6587\u4EF6\u5939\u53D6\u5E76\u96C6\u3002", en: "Combined with dictionary folders." },
  "settings.includeAliases": { zh: "\u522B\u540D\u4E5F\u7B97\u8BCD\u6761", en: "Include aliases" },
  "settings.aliasProperties": { zh: "\u522B\u540D\u5C5E\u6027\u540D", en: "Alias properties" },
  "settings.aliasPropertiesDesc": { zh: "\u9664 aliases/alias \u5916\u7684\u5C5E\u6027\uFF0C\u9017\u53F7\u5206\u9694\u3002", en: "Additional properties beyond aliases/alias, comma-separated." },
  "settings.inline": { zh: "\u5185\u8054\u6761\u76EE\u5E93", en: "Inline entries" },
  "settings.inlineDesc": { zh: "\u8F7B\u91CF\u8BCD\u6761\uFF0C\u4E0D\u53C2\u4E0E\u590D\u4E60", en: "Lightweight entries, excluded from review" },
  "settings.enableInline": { zh: "\u542F\u7528\u5185\u8054\u6761\u76EE", en: "Enable inline entries" },
  "settings.enableInlineDesc": { zh: "\u7B14\u8BB0\u9700\u8BBE\u7F6E lexis-inline: true \u6216 #lexis-inline\u3002", en: "Notes require lexis-inline: true or #lexis-inline." },
  "settings.inlineDelimiter": { zh: "\u5185\u8054\u6761\u76EE\u5206\u9694\u7B26", en: "Inline delimiter" },
  "settings.inlineAliasDelimiter": { zh: "\u5185\u8054\u522B\u540D\u5206\u9694\u7B26", en: "Inline alias delimiter" },
  "settings.inlineAliasDelimiterDesc": { zh: "\u9ED8\u8BA4 /\uFF1B\u524D\u540E\u7A7A\u683C\u53EF\u7701\u7565\uFF0C\\/ \u8868\u793A\u5B57\u9762\u659C\u6760\u3002\u53D7\u201C\u522B\u540D\u4E5F\u7B97\u8BCD\u6761\u201D\u63A7\u5236\u3002", en: "Defaults to /; surrounding spaces are optional, and \\/ means a literal slash. Controlled by Include aliases." },
  "settings.noInlineCategories": { zh: "\u6682\u65E0\u5185\u8054\u5206\u7C7B\u3002", en: "No inline categories." },
  "settings.entryCount": { zh: "{count} \u6761", en: "{count} entries" },
  "settings.showHighlight": { zh: "\u663E\u793A\u9AD8\u4EAE\uFF1B\u5173\u95ED\u540E\u4ECD\u53EF\u60AC\u505C", en: "Show highlight; hover remains available when off" },
  "settings.showGroupHighlight": { zh: "\u542F\u7528\u8FD9\u4E00\u7EC4\uFF1B\u5173\u95ED\u540E\u5B50\u9879\u4E0D\u751F\u6548", en: "Enable this group; child rules are inactive when off" },
  "settings.showSubsetHighlight": { zh: "\u542F\u7528\u8FD9\u4E2A\u5B50\u96C6", en: "Enable this subset" },
  "settings.resetInlineStyle": { zh: "\u6062\u590D\u5168\u5C40\u989C\u8272\u548C\u900F\u660E\u5EA6", en: "Reset global color and opacity" },
  "settings.categoryAppearance": { zh: "\u201C{name}\u201D\u7684\u9AD8\u4EAE\u5916\u89C2", en: "Highlight appearance for \u201C{name}\u201D" },
  "settings.inlineClassification": { zh: "\u5206\u7C7B\u65B9\u5F0F", en: "Group by" },
  "settings.inlineClassificationSection": { zh: "\u5206\u7C7B\u4E0E\u6765\u6E90", en: "Classification and sources" },
  "settings.inlineClassificationDesc": { zh: "\u6309\u6807\u9898\u53EF\u8DE8\u6587\u4EF6\u5171\u4EAB\u5206\u7C7B\uFF1B\u6309\u6587\u4EF6\u5219\u6574\u4EFD\u6587\u4EF6\u5171\u4EAB\u989C\u8272\u3002", en: "Heading groups can span files, or use one color per source file." },
  "settings.classifyByHeading": { zh: "\u6807\u9898", en: "Heading" },
  "settings.classifyByFile": { zh: "\u6587\u4EF6", en: "File" },
  "settings.inlineHeadingLevel": { zh: "\u5206\u7C7B\u6807\u9898\u7EA7\u522B", en: "Heading level" },
  "settings.inlineHeadingLevelDesc": { zh: "\u56FA\u5B9A\u7EA7\u522B\u540E\uFF0C\u66F4\u6DF1\u6807\u9898\u7EE7\u627F\u8BE5\u5206\u7C7B\uFF1B\u8F93\u5165\u5BF9\u5E94\u7EA7\u522B\u6807\u9898\u65F6\uFF0C\u4F1A\u6A21\u7CCA\u641C\u7D22\u5168\u5E93\u540C\u7EA7\u6807\u9898\u3002", en: "Deeper headings inherit the selected level. Typing a heading at that level searches matching headings across the vault." },
  "settings.nearestHeading": { zh: "\u6700\u8FD1\u6807\u9898", en: "Nearest heading" },
  "settings.headingLevel": { zh: "{marks}\uFF08{level}\u7EA7\uFF09", en: "{marks} (level {level})" },
  "suggest.headingSources": { zh: "\u7528\u4E8E {count} \u4E2A\u5185\u8054\u6587\u4EF6", en: "Used in {count} inline files" },
  "settings.colorByHeading": { zh: "\u6309\u6807\u9898\u5206\u7C7B\u7740\u8272", en: "Color by heading" },
  "settings.colorByHeadingDesc": { zh: "\u5D4C\u5957\u6807\u9898\u7EE7\u627F\u4E0A\u7EA7\u3002", en: "Nested headings inherit from parents." },
  "settings.refreshCategories": { zh: "\u5237\u65B0\u5206\u7C7B", en: "Refresh categories" },
  "settings.highlight": { zh: "\u9AD8\u4EAE", en: "Highlights" },
  "settings.enableHighlight": { zh: "\u542F\u7528\u9AD8\u4EAE", en: "Enable highlights" },
  "settings.enableHighlightDesc": { zh: "\u5F00\u542F\u8BCD\u6761\u8BC6\u522B\uFF1B\u53EF\u4EE5\u81EA\u52A8\u9AD8\u4EAE\uFF0C\u4E5F\u53EF\u4EE5\u53EA\u5728\u624B\u52A8\u67E5\u8BE2\u65F6\u663E\u793A\u3002", en: "Enable entry lookup with automatic highlights or manual lookup only." },
  "settings.highlightScope": { zh: "\u663E\u793A\u4F4D\u7F6E", en: "Where to show" },
  "settings.highlightInteraction": { zh: "\u4EA4\u4E92", en: "Interaction" },
  "settings.highlightMode": { zh: "\u663E\u793A\u65B9\u5F0F", en: "Display mode" },
  "settings.highlightModeDesc": { zh: "\u624B\u52A8\u67E5\u8BE2\u4E0D\u94FA\u6EE1\u9AD8\u4EAE\uFF1B\u53CC\u51FB\u5DF2\u6709\u8BCD\u6761\uFF0C\u6216\u5212\u9009\u77ED\u8BED\u540E\u67E5\u8BE2\u3002", en: "Manual lookup keeps pages clean; double-click an entry or select a phrase to look it up." },
  "settings.highlightAutomatic": { zh: "\u81EA\u52A8\u9AD8\u4EAE", en: "Automatic" },
  "settings.highlightManual": { zh: "\u624B\u52A8\u67E5\u8BE2", en: "Manual lookup" },
  "settings.clickHighlightToOpen": { zh: "\u684C\u9762\u7AEF\u70B9\u51FB\u9AD8\u4EAE\u8DF3\u8F6C", en: "Open entries by clicking highlights on desktop" },
  "settings.clickHighlightToOpenDesc": { zh: "\u5173\u95ED\u540E\u4ECD\u53EF\u60AC\u6D6E\u67E5\u770B\u5361\u7247\uFF1B\u70B9\u51FB\u5361\u7247\u6807\u9898\u4ECD\u53EF\u6253\u5F00\u8BCD\u6761\u3002", en: "Hover cards remain available, and their titles can still open entries." },
  "settings.highlightAppearance": { zh: "\u6837\u5F0F", en: "Appearance" },
  "settings.highlightRules": { zh: "\u89C4\u5219", en: "Rules" },
  "settings.livePreview": { zh: "\u5B9E\u65F6\u9884\u89C8\u4E5F\u9AD8\u4EAE", en: "Highlight in Live Preview" },
  "settings.unsupported": { zh: "\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u3002", en: "Not supported in this environment." },
  "settings.selectionPill": { zh: "\u5212\u8BCD\u663E\u793A\u300C\u52A0\u5165\u8BCD\u5E93\u300D", en: "Show Add to Lexis on selection" },
  "settings.selectionPillOrder": { zh: "\u5F39\u4E38\u987A\u5E8F", en: "Selection pill order" },
  "settings.pdfHighlight": { zh: "PDF \u91CC\u4E5F\u9AD8\u4EAE", en: "Highlight in PDFs" },
  "settings.pdfHighlightDesc": { zh: "\u626B\u63CF\u7248 PDF \u4E0D\u652F\u6301\u3002", en: "Scanned PDFs are not supported." },
  "settings.highlightStyle": { zh: "\u9ED8\u8BA4\u9AD8\u4EAE\u7EBF\u578B", en: "Default highlight style" },
  "settings.wavy": { zh: "\u6CE2\u6D6A\u4E0B\u5212\u7EBF", en: "Wavy underline" },
  "settings.underline": { zh: "\u5B9E\u7EBF\u4E0B\u5212\u7EBF", en: "Underline" },
  "settings.background": { zh: "\u80CC\u666F\u8272", en: "Background" },
  "settings.highlightColor": { zh: "\u9ED8\u8BA4\u9AD8\u4EAE\u989C\u8272", en: "Default highlight color" },
  "settings.resetTheme": { zh: "\u6062\u590D\u4E3B\u9898\u8272", en: "Reset to theme color" },
  "settings.opacity": { zh: "\u900F\u660E\u5EA6", en: "Opacity" },
  "settings.fade": { zh: "\u6309\u8BB0\u5FC6\u5F3A\u5EA6\u6E10\u9690", en: "Fade with memory strength" },
  "settings.fadeDesc": { zh: "\u6700\u7EC8\u900F\u660E\u5EA6 = \u57FA\u7840\u900F\u660E\u5EA6 \xD7 [1 - S/(S+20) \xD7 (1-\u6E10\u9690\u4E0B\u9650)]\u3002S \u4E3A FSRS \u7A33\u5B9A\u5EA6\uFF1B\u65B0\u8BCD\u4FDD\u6301\u57FA\u7840\u900F\u660E\u5EA6\u3002", en: "Final opacity = base opacity \xD7 [1 - S/(S+20) \xD7 (1-fade floor)]. S is FSRS stability; new entries keep the base opacity." },
  "settings.fadeFloor": { zh: "\u6700\u4F4E\u900F\u660E\u5EA6", en: "Minimum opacity" },
  "settings.tagColors": { zh: "\u6309\u6807\u7B7E\u7740\u8272", en: "Color by tag" },
  "settings.entryColors": { zh: "\u8BCD\u6761\u989C\u8272", en: "Entry colors" },
  "settings.entryColorsDesc": { zh: "\u7528 / \u5206\u9694\u540C\u4E00\u79CD\u989C\u8272\u7684\u522B\u540D\uFF0C\u5982 \u8239\u957F / \u6307\u6325\u5B98 / ENTJ\u3002\u5185\u8054\u8BCD\u6761\u672B\u5C3E\u5199 {\u540D\u79F0}\uFF1B\u5355\u6587\u4EF6\u8BCD\u6761\u5199 lexis-color: \u540D\u79F0\u3002", en: "Separate aliases for the same color with /, such as captain / commander / ENTJ. End an inline entry with {name}, or set lexis-color: name in a note." },
  "settings.unconfiguredEntryColors": { zh: "\u6587\u4E2D\u4F7F\u7528\u4F46\u5C1A\u672A\u914D\u7F6E", en: "Used in notes but not configured" },
  "settings.addUnconfiguredEntryColor": { zh: "\u628A\u201C{name}\u201D\u6DFB\u52A0\u5230\u8BCD\u6761\u989C\u8272", en: "Add \u201C{name}\u201D to entry colors" },
  "settings.entryColorPlaceholder": { zh: "\u8239\u957F / \u6307\u6325\u5B98 / ENTJ", en: "captain / commander / ENTJ" },
  "settings.addEntryColor": { zh: "+ \u6DFB\u52A0\u8BCD\u6761\u989C\u8272", en: "+ Add entry color" },
  "settings.tagPlaceholder": { zh: "\u6807\u7B7E", en: "Tag" },
  "settings.addTagRule": { zh: "+ \u6DFB\u52A0\u6807\u7B7E\u89C4\u5219", en: "+ Add tag rule" },
  "settings.tagAppearance": { zh: "\u6807\u7B7E\u89C4\u5219\u5916\u89C2", en: "Tag rule appearance" },
  "settings.resetAppearance": { zh: "\u8DDF\u968F\u5168\u5C40", en: "Use global appearance" },
  "settings.popover": { zh: "\u60AC\u6D6E\u5361", en: "Hover card" },
  "settings.popoverPreview": { zh: "\u60AC\u6D6E\u5361\u9884\u89C8", en: "Hover card preview" },
  "settings.popoverFont": { zh: "\u5361\u7247\u5B57\u53F7", en: "Card font size" },
  "settings.hoverDelay": { zh: "\u60AC\u6D6E\u5EF6\u8FDF", en: "Hover delay" },
  "settings.hoverDelayDesc": { zh: "0 \u4E3A\u7ACB\u5373\u663E\u793A\u3002", en: "0 shows the card immediately." },
  "settings.mobileInteractions": { zh: "\u79FB\u52A8\u7AEF", en: "Mobile" },
  "settings.mobileSectionDesc": { zh: "\u8F7B\u70B9\u9AD8\u4EAE\u4E0E\u8BC4\u5206\u680F", en: "Highlight taps and rating bar" },
  "settings.mobileTapAction": { zh: "\u8F7B\u70B9\u9AD8\u4EAE", en: "Tap a highlight" },
  "settings.mobileTapDesc": { zh: "\u663E\u793A\u5361\u7247\u540E\uFF0C\u70B9\u6807\u9898\u53EF\u6253\u5F00\u8BCD\u6761\u3002", en: "After opening the card, tap its title to open the entry." },
  "settings.mobileTapPopover": { zh: "\u663E\u793A\u5361\u7247", en: "Show card" },
  "settings.mobileTapOpen": { zh: "\u76F4\u63A5\u8DF3\u8F6C", en: "Open note directly" },
  "settings.showRelated": { zh: "\u663E\u793A\u76F8\u5173\u8BCD", en: "Show related entries" },
  "settings.showOccurrences": { zh: "\u663E\u793A\u300C\u51FA\u73B0\u8FC7\u7684\u5730\u65B9\u300D", en: "Show occurrences" },
  "settings.showOccurrencesDesc": { zh: "\u5168\u6587\u641C\u7D22\uFF0C\u65E0\u9700\u53CC\u94FE\u3002", en: "Full-text search; links are not required." },
  "settings.pdfOccurrences": { zh: "PDF \u4E5F\u4F5C\u4E3A\u51FA\u5904", en: "Include PDFs as occurrences" },
  "settings.pdfOccurrencesDesc": { zh: "\u4EC5\u652F\u6301\u80FD\u590D\u5236\u6587\u5B57\u7684 PDF\u3002", en: "Only PDFs with selectable text are supported." },
  "settings.occurrenceLimit": { zh: "\u51FA\u5904\u6570\u91CF\u4E0A\u9650", en: "Occurrence limit" },
  "settings.occurrenceScope": { zh: "\u51FA\u5904\u641C\u7D22\u8303\u56F4", en: "Occurrence search scope" },
  "settings.occurrenceScopeDesc": { zh: "\u9017\u53F7\u5206\u9694\uFF1B\u7559\u7A7A\u4E3A\u5168\u5E93\u3002", en: "Comma-separated; blank searches the whole vault." },
  "settings.wholeVault": { zh: "\u7559\u7A7A=\u5168\u5E93", en: "Blank = whole vault" },
  "settings.selectionAdd": { zh: "\u5212\u8BCD\u6DFB\u52A0", en: "Add from selection" },
  "settings.emptyNotePreset": { zh: "\u65E0\u6A21\u677F\u65F6", en: "When no template is selected" },
  "settings.emptyNotePresetDesc": { zh: "\u4EC5\u7528\u4E8E\u6CA1\u6709\u9009\u62E9\u6A21\u677F\u6587\u4EF6\u7684\u8BCD\u5178\u3002", en: "Used only for dictionaries without a template file." },
  "settings.emptyNoteBlank": { zh: "\u7EAF\u7A7A\u767D", en: "Blank note" },
  "settings.emptyNoteOccurrences": { zh: "\u672B\u5C3E\u663E\u793A\u51FA\u5904\u9762\u677F", en: "Show occurrences panel at the end" },
  "settings.defaultTemplate": { zh: "\u9ED8\u8BA4\u6A21\u677F", en: "Default template" },
  "settings.defaultTemplateDesc": { zh: "\u4EC5\u7528\u4E8E\u672A\u5339\u914D\u8BCD\u5178\u65F6\uFF1B\u652F\u6301 {{word}}\u3001{{date}}\u3002", en: "Used only when no dictionary matches; supports {{word}} and {{date}}." },
  "settings.occurrenceTemplate": { zh: "\u81EA\u52A8\u51FA\u5904\u683C\u5F0F", en: "Automatic source format" },
  "settings.occurrenceTemplateDesc": { zh: "\u9996\u884C\u53EF\u5199 Markdown \u6807\u9898\uFF0C\u5176\u4F59\u5185\u5BB9\u6309\u6BCF\u6761\u51FA\u5904\u91CD\u590D\u3002\u652F\u6301 {{word}}\u3001{{sentence}}\u3001{{source}}\u3001{{sourceSuffix}}\u3001{{date}}\uFF1B\u7559\u7A7A\u4E0D\u5199\u51FA\u5904\u3002", en: "The first line may be a Markdown heading; the remaining lines repeat for each source. Supports {{word}}, {{sentence}}, {{source}}, {{sourceSuffix}}, and {{date}}. Leave blank to omit sources." },
  "settings.review": { zh: "\u590D\u4E60 (FSRS)", en: "Review (FSRS)" },
  "settings.flashcardInline": { zh: "\u884C\u5185\u95EE\u7B54\u8BED\u6CD5", en: "Inline Q&A syntax" },
  "settings.flashcardBidirectional": { zh: "\u53CC\u5411\u95EE\u7B54\u8BED\u6CD5", en: "Bidirectional Q&A syntax" },
  "settings.flashcardBlock": { zh: "\u5757\u7EA7\u95EE\u7B54\u8BED\u6CD5", en: "Block Q&A syntax" },
  "settings.flashcardCloze": { zh: "\u884C\u5185\u6316\u7A7A\u8BED\u6CD5", en: "Inline cloze syntax" },
  "settings.flashcardTemplateDesc": { zh: "\u4FDD\u7559\u53D8\u91CF\uFF1B\u7559\u7A7A\u5173\u95ED\u3002", en: "Keep the variables; leave blank to disable." },
  "settings.resetTemplate": { zh: "\u6062\u590D\u9ED8\u8BA4\u8BED\u6CD5", en: "Reset syntax" },
  "settings.retention": { zh: "\u76EE\u6807\u8BB0\u5FC6\u4FDD\u7559\u7387", en: "Desired retention" },
  "settings.retentionDesc": { zh: "\u8D8A\u9AD8\uFF0C\u590D\u4E60\u8D8A\u9891\u7E41\u3002", en: "Higher values schedule more reviews." },
  "settings.newLimit": { zh: "\u6BCF\u5929\u65B0\u8BCD\u4E0A\u9650", en: "New entries per day" },
  "settings.sessionLimit": { zh: "\u6BCF\u8F6E\u6700\u591A\u590D\u4E60", en: "Reviews per session" },
  "settings.suspendedCards": { zh: "\u6401\u7F6E\u5361\u7247", en: "Suspended cards" },
  "settings.suspendedCardsDesc": { zh: "\u5171 {count} \u5F20\uFF1B\u4E0D\u8FDB\u5165\u590D\u4E60\uFF0C\u4F46\u4FDD\u7559\u7B14\u8BB0\u548C\u9AD8\u4EAE\u3002", en: "{count} cards are excluded from review while notes and highlights remain." },
  "settings.restoreSuspended": { zh: "\u5168\u90E8\u6062\u590D", en: "Restore all" },
  "settings.suspendedRestored": { zh: "Lexis\uFF1A\u5DF2\u6062\u590D\u5168\u90E8\u6401\u7F6E\u5361\u7247", en: "Lexis: restored all suspended cards" },
  "settings.cardFront": { zh: "\u5361\u7247\u6B63\u9762", en: "Card front" },
  "settings.cardFrontDesc": { zh: "\u586B\u7A7A\u9700\u6709\u51FA\u5904\uFF0C\u5426\u5219\u663E\u793A\u5355\u8BCD\u3002", en: "Cloze requires an occurrence; otherwise the entry is shown." },
  "settings.noteCard": { zh: "\u8BCD\u6761 \u2192 \u6574\u7BC7", en: "Entry \u2192 note" },
  "settings.clozeCard": { zh: "\u51FA\u5904\u586B\u7A7A", en: "Occurrence cloze" },
  "settings.showReviewMetadata": { zh: "\u663E\u793A\u590D\u4E60\u5185\u90E8\u72B6\u6001", en: "Show internal review state" },
  "settings.showReviewMetadataDesc": { zh: "\u9ED8\u8BA4\u5728\u5C5E\u6027\u9762\u677F\u9690\u85CF\uFF0C\u6570\u636E\u4ECD\u4FDD\u5B58\u5728\u7B14\u8BB0\u4E2D\u3002", en: "Hidden from Properties by default; the data remains in the note." },
  "settings.ratingOffset": { zh: "\u79FB\u52A8\u7AEF\u8BC4\u5206\u680F\u5E95\u90E8\u4F4D\u7F6E", en: "Mobile rating bar position" },
  "settings.ratingOffsetDesc": { zh: "\u8BC4\u5206\u680F\u81EA\u52A8\u907F\u5F00\u5DE5\u5177\u680F\uFF0C\u5361\u7247\u5E95\u90E8\u7559\u767D\u4F1A\u540C\u6B65\u8C03\u6574\u3002", en: "Moves the rating bar above the toolbar and keeps matching space below the card." },
  "settings.openReview": { zh: "\u6253\u5F00\u590D\u4E60", en: "Open review" },
  "settings.hoverFeedback": { zh: "\u60AC\u505C\u56DE\u6D41", en: "Hover feedback" },
  "settings.hoverFeedbackDesc": { zh: "\u628A\u8F83\u8FDC\u7684\u5230\u671F\u65E5\u63D0\u524D\u5230\u4ECA\u5929\uFF0C\u4E0D\u8BA1\u4F5C\u590D\u4E60\u3002", en: "Pulls distant due dates to today without recording a review." },
  "settings.feedbackDays": { zh: "\u56DE\u6D41\u9608\u503C\uFF08\u5929\uFF09", en: "Feedback threshold (days)" },
  "settings.feedbackDaysDesc": { zh: "\u5230\u671F\u65E5\u8D85\u8FC7\u6B64\u5929\u6570\u624D\u63D0\u524D\u3002", en: "Only later due dates are pulled forward." },
  "settings.retireDays": { zh: "\u6DD8\u6C70\u5019\u9009\u9608\u503C\uFF08\u5929\uFF09", en: "Retirement threshold (days)" },
  "settings.retireDaysDesc": { zh: "\u5165\u5E93\u4E0E\u672A\u76F8\u9047\u5747\u8FBE\u5230\u6B64\u5929\u6570\u3002", en: "Both added and unseen ages must reach this value." },
  "settings.dataStorage": { zh: "\u6570\u636E\u5B58\u50A8", en: "Data storage" },
  "settings.encounterFolderUndo": { zh: "\u8FD8\u539F\u672A\u786E\u8BA4\u7684\u8DEF\u5F84", en: "Discard the unconfirmed path" },
  "home.encounterDataError": { zh: "\u76F8\u9047\u8BB0\u5F55\u8BFB\u53D6\u5931\u8D25\uFF0C\u6682\u4E0D\u8BA1\u7B97\u6DD8\u6C70\u5019\u9009\u3002", en: "Encounter history could not be read. Retirement candidates are unavailable." },
  "settings.bridge": { zh: "\u672C\u673A\u6865\u63A5", en: "Local bridge" },
  "settings.bridgeDesc": { zh: "\u4F9B\u6D4F\u89C8\u5668\u4E0E Zotero \u8FDE\u63A5", en: "Connects the browser and Zotero companions" },
  "settings.excludeTags": { zh: "\u4E0D\u9AD8\u4EAE\u7684\u6807\u7B7E", en: "Tags hidden from highlights" },
  "settings.excludeTagsDesc": { zh: "\u4ECD\u53C2\u4E0E\u590D\u4E60\uFF0C\u53EA\u5173\u95ED Obsidian\u3001\u6D4F\u89C8\u5668\u548C Zotero \u9AD8\u4EAE\u3002", en: "Entries remain in review; only Obsidian, browser, and Zotero highlights are hidden." },
  "settings.addExcludedTag": { zh: "\u8F93\u5165\u6807\u7B7E\u540E\u56DE\u8F66", en: "Type a tag and press Enter" },
  "settings.removeExcludedTag": { zh: "\u79FB\u9664 #{tag}", en: "Remove #{tag}" },
  "settings.annotationHeading": { zh: "\u6279\u6CE8\u5C0F\u8282\u6807\u9898", en: "Annotation heading" },
  "settings.annotationHeadingDesc": { zh: "\u652F\u6301\u201C\u6279\u6CE8\u201D\u6216\u201C## \u5F15\u7528\u201D\uFF1B\u7559\u7A7A\u4E3A\u201C#### \u6279\u6CE8\u201D\u3002", en: "Use plain text or a Markdown heading; blank uses \u201C#### \u6279\u6CE8\u201D." },
  "settings.annotationImageLocation": { zh: "\u6279\u6CE8\u56FE\u7247\u4F4D\u7F6E", en: "Annotation image location" },
  "settings.annotationImageLocationDesc": { zh: "\u8DDF\u968F Obsidian\uFF0C\u6216\u5355\u72EC\u6307\u5B9A\u6587\u4EF6\u5939\u3002", en: "Follow Obsidian or use a dedicated folder." },
  "settings.annotationImageObsidian": { zh: "\u8DDF\u968F Obsidian", en: "Follow Obsidian" },
  "settings.annotationImageCustom": { zh: "\u81EA\u5B9A\u4E49\u6587\u4EF6\u5939", en: "Custom folder" },
  "settings.annotationImageFolder": { zh: "\u6279\u6CE8\u56FE\u7247\u6587\u4EF6\u5939", en: "Annotation image folder" },
  "settings.annotationImageFolderDesc": { zh: "\u4EC5\u5728\u9009\u62E9\u81EA\u5B9A\u4E49\u4F4D\u7F6E\u65F6\u4F7F\u7528\u3002", en: "Used only for the custom location." },
  "settings.enableBridge": { zh: "\u542F\u7528\u672C\u673A\u6865\u63A5", en: "Enable local bridge" },
  "settings.port": { zh: "\u7AEF\u53E3", en: "Port" },
  "settings.portDesc": { zh: "\u4FEE\u6539\u540E\u70B9\u53F3\u4FA7\u91CD\u542F\u3002", en: "Restart the bridge after changing it." },
  "settings.restartBridge": { zh: "\u91CD\u542F\u6865\u63A5", en: "Restart bridge" },
  "settings.token": { zh: "\u8BBF\u95EE\u4EE4\u724C", en: "Access token" },
  "settings.tokenDesc": { zh: "\u6D4F\u89C8\u5668\u4E0E Zotero \u4F7F\u7528\u3002", en: "Used by the browser and Zotero companions." },
  "settings.tokenPending": { zh: "\uFF08\u542F\u7528\u540E\u751F\u6210\uFF09", en: "(generated when enabled)" },
  "settings.copyToken": { zh: "\u590D\u5236\u4EE4\u724C", en: "Copy token" },
  "settings.regenerateToken": { zh: "\u91CD\u65B0\u751F\u6210\uFF08\u4F34\u4FA3\u7AEF\u9700\u91CD\u586B\uFF09", en: "Regenerate (update companion apps)" },
  "settings.rebuild": { zh: "\u91CD\u5EFA\u7D22\u5F15", en: "Rebuild index" },
  "settings.rebuildNow": { zh: "\u7ACB\u5373\u91CD\u5EFA", en: "Rebuild now" },
  "settings.stats": { zh: "\u7D22\u5F15\uFF1A{words} \u8BCD\u6761 \xB7 {aliases} \u522B\u540D \xB7 {inline} \u5185\u8054 \xB7 {due} \u5F85\u590D\u4E60", en: "Index: {words} entries \xB7 {aliases} aliases \xB7 {inline} inline \xB7 {due} due" }
};
function createI18n(getLanguage) {
  const language = () => getLanguage() === "en" ? "en" : "zh";
  const t = (key, vars = {}) => {
    const pair = MESSAGES[key];
    let text = pair ? pair[language()] || pair.zh || key : key;
    for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value));
    return text;
  };
  return { t, language };
}

// src/curve.ts
function recentReviewDates(card, limit = 4) {
  const dates = (Array.isArray(card.history) ? card.history : []).map((event) => String(event?.date || "").slice(0, 10)).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));
  const lastDate = String(card.last || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(lastDate)) dates.push(lastDate);
  return [...new Set(dates)].sort().reverse().slice(0, Math.max(1, limit));
}
function buildCurveSVG(card, { requestRetention, nextInterval, retrievability, addDaysStr, daysBetween: daysBetween2, todayStr }, { limit = 8 } = {}) {
  const currentS = Number(card.s);
  if (!Number.isFinite(currentS) || currentS <= 0) return null;
  const today = todayStr();
  const eventsByDate = /* @__PURE__ */ new Map();
  for (const raw of Array.isArray(card.history) ? card.history : []) {
    const date = String(raw?.date || "").slice(0, 10);
    const s = Number(raw?.s);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today || !Number.isFinite(s) || s <= 0) continue;
    eventsByDate.set(date, { date, s, retention: raw.retention == null ? void 0 : Number(raw.retention) });
  }
  const lastDate = String(card.last || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(lastDate) && lastDate <= today) {
    const saved = eventsByDate.get(lastDate);
    eventsByDate.set(lastDate, { date: lastDate, s: currentS, retention: saved?.retention });
  }
  const history = [...eventsByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const events = limit > 0 ? history.slice(-limit) : history;
  if (!events.length) return null;
  const targetRetention = requestRetention || 0.9;
  const startDate = events[0].date;
  const fallbackDue = addDaysStr(events[events.length - 1].date, nextInterval(events[events.length - 1].s, targetRetention));
  const endDate = [String(card.due || "").slice(0, 10), addDaysStr(today, 1), fallbackDue].filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort().pop();
  const totalDays = Math.max(1, daysBetween2(startDate, endDate));
  const W = 420, H = 150, left = 34, right = 24, top = 10, bottom = 30;
  const plotW = W - left - right, plotH = H - top - bottom;
  const xDay = (day) => left + plotW * Math.max(0, Math.min(totalDays, day)) / totalDays;
  const xDate = (date) => xDay(daysBetween2(startDate, date));
  const y = (retention) => top + plotH * (1 - Math.max(0, Math.min(1, retention)));
  let path = "", forecast = "";
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const eventX = xDate(event.date);
    const before = Number.isFinite(event.retention) ? event.retention / 100 : 1;
    if (!path) path = `M${eventX.toFixed(1)} ${y(before).toFixed(1)} L${eventX.toFixed(1)} ${y(1).toFixed(1)}`;
    else path += ` L${eventX.toFixed(1)} ${y(1).toFixed(1)}`;
    const segmentEnd = i + 1 < events.length ? events[i + 1].date : endDate;
    const segmentDays = Math.max(0, daysBetween2(event.date, segmentEnd));
    const todayElapsed = Math.max(0, daysBetween2(event.date, today));
    const pastDays = Math.min(segmentDays, todayElapsed);
    const samples = Math.max(2, Math.min(48, pastDays * 2));
    for (let sample = 1; sample <= samples; sample++) {
      const elapsed = pastDays * sample / samples;
      const xx = xDay(daysBetween2(startDate, event.date) + elapsed);
      const retention = retrievability(elapsed, event.s);
      path += ` L${xx.toFixed(1)} ${y(retention).toFixed(1)}`;
    }
    if (segmentDays > pastDays) {
      forecast = `M${xDate(today).toFixed(1)} ${y(retrievability(todayElapsed, event.s)).toFixed(1)}`;
      for (let sample = 1; sample <= 32; sample++) {
        const elapsed = pastDays + (segmentDays - pastDays) * sample / 32;
        forecast += ` L${xDay(daysBetween2(startDate, event.date) + elapsed).toFixed(1)} ${y(retrievability(elapsed, event.s)).toFixed(1)}`;
      }
    }
  }
  const grid = [1, 0.75, 0.5, 0.25, 0].map((retention) => {
    const yy = y(retention).toFixed(1);
    return `<line x1="${left}" y1="${yy}" x2="${W - right}" y2="${yy}" stroke="var(--background-modifier-border)" stroke-width="1"/><text x="${left - 5}" y="${(+yy + 3.5).toFixed(1)}" text-anchor="end" fill="var(--text-muted)" font-size="9">${Math.round(retention * 100)}%</text>`;
  }).join("");
  const targetY = y(targetRetention).toFixed(1);
  const todayX = xDate(today);
  let lastLabelX = -Infinity;
  const reviewMarks = events.map((event) => {
    const xx = xDate(event.date);
    const before = Number.isFinite(event.retention) ? event.retention / 100 : null;
    const detail = before == null ? event.date : `${event.date} \xB7 ${Math.round(before * 100)}%`;
    const point = `<g data-curve-detail="${detail}" data-review-date="${event.date}" tabindex="0" role="button" aria-label="${detail}"><title>${detail}</title><circle cx="${xx.toFixed(1)}" cy="${y(before ?? 1).toFixed(1)}" r="9" fill="transparent"/><circle cx="${xx.toFixed(1)}" cy="${y(before ?? 1).toFixed(1)}" r="2.5" fill="var(--text-accent)"/></g>`;
    const label = xx - lastLabelX < 42 || Math.abs(xx - todayX) < 42 ? "" : `<text x="${xx.toFixed(1)}" y="${H - 7}" text-anchor="middle" fill="var(--text-muted)" font-size="9">${event.date.slice(5)}</text>`;
    if (label) lastLabelX = xx;
    return `<line x1="${xx.toFixed(1)}" y1="${top}" x2="${xx.toFixed(1)}" y2="${H - bottom}" stroke="var(--text-faint)" stroke-width="1" stroke-dasharray="2 3"/>${point}${label}`;
  }).join("");
  const latest = [...events].reverse().find((event) => event.date <= today) || events[0];
  const todayRetention = retrievability(Math.max(0, daysBetween2(latest.date, today)), latest.s);
  const todayPoint = today >= startDate && today <= endDate ? `<g data-curve-detail="Today \xB7 ~${Math.round(todayRetention * 100)}%" tabindex="0" role="button" aria-label="Today \xB7 ~${Math.round(todayRetention * 100)}%"><line x1="${todayX.toFixed(1)}" y1="${top}" x2="${todayX.toFixed(1)}" y2="${H - bottom}" stroke="var(--interactive-accent)" stroke-width="1"/><circle cx="${todayX.toFixed(1)}" cy="${y(todayRetention).toFixed(1)}" r="9" fill="transparent"/><circle cx="${todayX.toFixed(1)}" cy="${y(todayRetention).toFixed(1)}" r="3" fill="var(--interactive-accent)"/><text x="${todayX.toFixed(1)}" y="${H - 7}" text-anchor="middle" fill="var(--interactive-accent)" font-size="10">Today</text></g>` : "";
  const predicted = retrievability(daysBetween2(latest.date, endDate), latest.s);
  return `<svg data-curve-today="${today}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` + grid + `<line x1="${left}" y1="${top}" x2="${left}" y2="${H - bottom}" stroke="var(--text-muted)" stroke-width="1"/><line x1="${left}" y1="${H - bottom}" x2="${W - right}" y2="${H - bottom}" stroke="var(--text-muted)" stroke-width="1"/><line x1="${left}" y1="${targetY}" x2="${W - right}" y2="${targetY}" stroke="var(--text-faint)" stroke-dasharray="3 3" stroke-width="1"/><path class="lexis-curve-history-line" d="${path}" fill="none" stroke="var(--interactive-accent)" stroke-width="2"/><path class="lexis-curve-forecast" d="${forecast}" fill="none" stroke="var(--interactive-accent)" stroke-width="2" stroke-dasharray="4 4"/><g data-curve-detail="${endDate} \xB7 ~${Math.round(predicted * 100)}%" tabindex="0" role="button" aria-label="${endDate} \xB7 ~${Math.round(predicted * 100)}%"><title>${endDate} \xB7 ~${Math.round(predicted * 100)}%</title><circle cx="${xDate(endDate).toFixed(1)}" cy="${y(predicted).toFixed(1)}" r="9" fill="transparent"/><circle class="lexis-curve-prediction" cx="${xDate(endDate).toFixed(1)}" cy="${y(predicted).toFixed(1)}" r="3" fill="var(--background-primary)" stroke="var(--interactive-accent)"/></g>` + reviewMarks + todayPoint + `</svg>`;
}

// src/review-log-view.ts
var import_obsidian14 = require("obsidian");

// src/review-library.ts
var import_obsidian13 = require("obsidian");

// src/review-priority.ts
var PRIORITY_HALF_LIFE_DAYS = 7;
function effectivePriority(priority, now = Date.now()) {
  if (!priority) return 1;
  const timestamp = Date.parse(priority.at);
  if (!Number.isFinite(timestamp) || !Number.isFinite(priority.initial)) return 1;
  const days = Math.max(0, now - timestamp) / 864e5;
  return 1 - (1 - Math.max(0, Math.min(1, priority.initial))) * 2 ** (-days / PRIORITY_HALF_LIFE_DAYS);
}
function reviewItemPriority(item, priorities, now = Date.now()) {
  return Math.max(...reviewItemKeys(item).map((key) => effectivePriority(priorities?.[key], now)));
}
function lowerReviewPriority(settings, keys, at = (/* @__PURE__ */ new Date()).toISOString()) {
  settings.reviewPriorities ||= {};
  for (const key of keys) settings.reviewPriorities[key] = { at, initial: 0.25 };
}
function orderByReviewPriority(queue, priorities, now = Date.now()) {
  return queue.map((item, index) => ({ item, rank: index + (1 - reviewItemPriority(item, priorities, now)) * queue.length })).sort((left, right) => left.rank - right.rank).map(({ item }) => item);
}
async function changeReviewPriority(settings, keys, lower, save) {
  const previous = new Map(keys.map((key) => [key, settings.reviewPriorities?.[key]]));
  if (lower) lowerReviewPriority(settings, keys);
  else for (const key of keys) delete settings.reviewPriorities[key];
  const applied = new Map(keys.map((key) => [key, settings.reviewPriorities[key]]));
  try {
    await save();
  } catch (error) {
    for (const key of keys) {
      if (settings.reviewPriorities[key] !== applied.get(key)) continue;
      const before = previous.get(key);
      if (before) settings.reviewPriorities[key] = before;
      else delete settings.reviewPriorities[key];
    }
    throw error;
  }
}

// src/review-library-groups.ts
var libraryGroups = ["none", "dictionary", "folder", "tag", "file", "heading"];
function groupLibraryCards(cards, mode, dictionaries, app, getTags, ungrouped) {
  if (mode === "none")
    return [{ id: "all", label: "", cards }];
  const files = [...new Map(cards.map((card) => [card.file.path, card.file])).values()];
  const membership = mode === "dictionary" ? resolveDictionaries(app, dictionaries, getTags, files) : null;
  const tagsByFile = mode === "tag" ? new Map(files.map((file) => [file.path, getTags(file)])) : null;
  const groups = /* @__PURE__ */ new Map();
  const labelsFor = (card) => {
    const path = card.file.path;
    switch (mode) {
      case "dictionary":
        return (membership.byFile.get(path) || []).map((row) => [dictionaryId(row), dictionaryName(row)]);
      case "tag":
        return [...tagsByFile.get(path)].sort().map((tag) => [tag, `#${tag}`]);
      case "file":
        return [[path, path]];
      case "heading": {
        const heading = (card.headingPath || []).join(" / ");
        return [[heading, heading]];
      }
      default: {
        const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "/";
        return [[folder, folder]];
      }
    }
  };
  for (const card of cards) {
    const labels = labelsFor(card);
    for (const [id, label] of labels.length ? labels : [["", ungrouped]]) {
      const key = id || "ungrouped", group = groups.get(key) || { id: key, label: label || ungrouped, cards: [] };
      group.cards.push(card);
      groups.set(key, group);
    }
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

// src/review-library-model.ts
var librarySorts = ["name", "discovered", "firstReview", "due", "reps", "retention", "stability"];
var compactLibrarySorts = ["name", "reps", "retention", "due"];
var libraryStateOf = (host, card) => card.type === "note" ? host.readCard(card.file) : host.readSyntaxCardState(card.key.slice(7));
var dateValid = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
function normalizeLibraryState(saved = {}) {
  const legacy = saved.sort === "newest" || saved.sort === "oldest";
  const savedGroup = String(saved.groupBy || "");
  const groupBy = savedGroup === "hub" ? "file" : libraryGroups.find((value) => value === savedGroup) || "none";
  return {
    status: ["all", "unreviewed", "reviewed", "suspended", "archived"].includes(saved.status) ? saved.status : "all",
    sort: legacy ? "discovered" : librarySorts.some((key) => key === saved.sort) ? saved.sort : "name",
    direction: saved.direction === "asc" ? "asc" : saved.direction === "desc" || legacy && saved.sort === "newest" ? "desc" : "asc",
    view: saved.view === "cards" ? "cards" : "list",
    hasCurve: saved.hasCurve === true,
    query: typeof saved.query === "string" ? saved.query : "",
    category: typeof saved.category === "string" ? saved.category : "",
    groupBy
  };
}
function normalizeCompactLibraryState(saved = {}) {
  const state = normalizeLibraryState(saved);
  return {
    ...state,
    sort: compactLibrarySorts.some((key) => key === state.sort) ? state.sort : "reps",
    status: "all",
    hasCurve: false,
    category: ""
  };
}
function libraryMetrics(state, today = localDate(/* @__PURE__ */ new Date())) {
  const s = Number(state.s), count = Number(state.reps);
  const stability = Number.isFinite(s) && s > 0 ? s : null;
  const validHistory = (Array.isArray(state.history) ? state.history : []).map((event) => ({ date: String(event?.date || "").slice(0, 10), s: Number(event?.s) })).filter((event) => dateValid(event.date) && event.date <= today && Number.isFinite(event.s) && event.s > 0);
  const last = String(state.last || "").slice(0, 10);
  const validLast = dateValid(last) && last <= today;
  const reviewDates = validHistory.map((event) => event.date.slice(0, 10)).sort();
  const date = validLast ? last : reviewDates[reviewDates.length - 1];
  const elapsed = date ? Math.max(0, (Date.parse(today) - Date.parse(date)) / 864e5) : null;
  const retention = stability != null && elapsed != null ? FSRS.retrievability(elapsed, stability) : null;
  const reps = state.reps != null && Number.isInteger(count) && count >= 0 ? count : null;
  return { reps, stability, retention: Number.isFinite(retention) && retention != null ? retention : null, hasCurve: stability != null && !!date };
}
function selectLibraryCards(cards, host, input, today = localDate(/* @__PURE__ */ new Date()), reviewedOnly = false) {
  const state = normalizeLibraryState(input);
  const first = /* @__PURE__ */ new Map();
  for (const event of host.settings.reviewEvents) for (const key of event.memberKeys) {
    if (!first.has(key) || event.timestamp < first.get(key)) first.set(key, event.timestamp);
  }
  const metrics = /* @__PURE__ */ new Map();
  const result = cards.filter((card) => {
    const lifecycle = host.readLifecycle(card.file), scheduled = libraryStateOf(host, card);
    const archived = lifecycle.archived || lifecycle.retired;
    const suspended = !!host.settings.suspendedReviewItems[card.type === "note" ? `note:${card.key}` : card.key];
    const metric = libraryMetrics(scheduled, today);
    metrics.set(card.key, metric);
    const reviewed = first.has(card.key) || metric.stability != null || metric.reps != null && metric.reps > 0;
    if (reviewedOnly && (!reviewed || suspended || archived)) return false;
    if (state.status === "suspended" && !suspended) return false;
    if (state.status === "archived" && !archived) return false;
    if (state.status === "unreviewed" && (reviewed || suspended || archived)) return false;
    if (state.status === "reviewed" && !reviewed) return false;
    if (state.hasCurve && !metric.hasCurve) return false;
    if (state.category && !(card.headingPath || []).join(" / ").toLocaleLowerCase().includes(state.category.trim().toLocaleLowerCase())) return false;
    return !state.query || `${card.label} ${card.file.path} ${(card.headingPath || []).join(" / ")}`.toLocaleLowerCase().includes(state.query.trim().toLocaleLowerCase());
  });
  const value = (card) => {
    if (state.sort === "name") return card.label;
    if (state.sort === "reps" || state.sort === "retention" || state.sort === "stability") return metrics.get(card.key)[state.sort];
    if (state.sort === "firstReview") return first.get(card.key) || null;
    if (state.sort === "due") return libraryStateOf(host, card).due || null;
    return host.settings.reviewCardMeta?.[card.key]?.discoveredAt || null;
  };
  const values = new Map(result.map((card) => [card.key, value(card)]));
  return result.sort((left, right) => {
    const a = values.get(left.key), b = values.get(right.key);
    if (a != null && b == null) return -1;
    if (a == null && b != null) return 1;
    if (a != null && b != null && a !== b) {
      const compared = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
      return compared * (state.direction === "desc" ? -1 : 1);
    }
    return left.label.localeCompare(right.label) || left.file.path.localeCompare(right.file.path) || (left.line || 0) - (right.line || 0);
  });
}

// src/shared-utils.ts
var import_obsidian8 = require("obsidian");

// src/match-text.ts
var ASCII_WORD = /[A-Za-z0-9_]/;
var EAST_ASIAN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
var HORIZONTAL_SPACE = /[ \t\u00a0\u3000]/;
var OPTIONAL_MIXED_SPACE = "[ \\t\\u00a0\\u3000]*";
var escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
var isMixedScriptBoundary = (left, right) => ASCII_WORD.test(left) && EAST_ASIAN.test(right) || EAST_ASIAN.test(left) && ASCII_WORD.test(right);
function compactMixedScriptSpacing(value) {
  const characters = [...String(value || "")];
  let result = "";
  let previous = "";
  for (let index = 0; index < characters.length; ) {
    const character = characters[index];
    if (!HORIZONTAL_SPACE.test(character)) {
      result += character;
      previous = character;
      index++;
      continue;
    }
    let end = index + 1;
    while (end < characters.length && HORIZONTAL_SPACE.test(characters[end])) end++;
    const next = characters[end] || "";
    if (!isMixedScriptBoundary(previous, next)) result += characters.slice(index, end).join("");
    index = end;
  }
  return result;
}
function flexibleMixedScriptSource(value) {
  const characters = [...String(value || "")];
  let source = "";
  let previous = "";
  let boundaryAlreadyAdded = false;
  for (let index = 0; index < characters.length; ) {
    const character = characters[index];
    if (HORIZONTAL_SPACE.test(character)) {
      let end = index + 1;
      while (end < characters.length && HORIZONTAL_SPACE.test(characters[end])) end++;
      const next = characters[end] || "";
      boundaryAlreadyAdded = isMixedScriptBoundary(previous, next);
      source += boundaryAlreadyAdded ? OPTIONAL_MIXED_SPACE : escapeRe(characters.slice(index, end).join(""));
      index = end;
      continue;
    }
    if (!boundaryAlreadyAdded && previous && isMixedScriptBoundary(previous, character)) source += OPTIONAL_MIXED_SPACE;
    source += escapeRe(character);
    previous = character;
    boundaryAlreadyAdded = false;
    index++;
  }
  return source;
}
var boundedSource = (word) => {
  const leftBoundary = /^[A-Za-z0-9_]/.test(word) ? "\\b" : "";
  const rightBoundary = /[A-Za-z0-9_]$/.test(word) ? "\\b" : "";
  return leftBoundary + flexibleMixedScriptSource(word) + rightBoundary;
};

// src/shared-utils.ts
var escapeHtml = (value) => String(value == null ? "" : value).replace(
  /[&<>"]/g,
  (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] || character
);
var renderLexisMarkdown = (app, markdown, element, sourcePath2, component) => import_obsidian8.MarkdownRenderer.render(app, String(markdown == null ? "" : markdown).replace(/\u00a0/g, " "), element, sourcePath2, component);
var round2 = (value) => Math.round(value * 100) / 100;
function cssColorToHex(color, document2) {
  if (!color) return "#888888";
  if (/^#[0-9a-fA-F]{6}$/.test(color.trim())) return color.trim();
  const temporary = document2.body.createDiv();
  temporary.setCssStyles({ color });
  const rgb = temporary.win.getComputedStyle(temporary).color;
  temporary.remove();
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
  if (!match) return "#888888";
  return `#${[match[1], match[2], match[3]].map((value) => (+value).toString(16).padStart(2, "0")).join("")}`;
}
function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function todayString() {
  return formatDate(/* @__PURE__ */ new Date());
}
function parseDate(value) {
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}
function addDaysString(base, days) {
  const date = base ? parseDate(base) : /* @__PURE__ */ new Date();
  date.setDate(date.getDate() + days);
  return formatDate(date);
}
function daysBetween(from, to) {
  return Math.max(0, Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 864e5));
}

// src/curve-controls.ts
function localDay() {
  const now = /* @__PURE__ */ new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function attachCurveControls(root, refresh) {
  const document2 = root.ownerDocument, window2 = document2.defaultView;
  let timer = 0, active = true, refreshing = false;
  const activate = (event) => {
    const target = event.target;
    const control = target.closest?.("[data-curve-toggle], [data-curve-detail]");
    if (!control || !root.contains(control)) return;
    const view = control.closest(".lexis-curve-view");
    event.preventDefault();
    event.stopPropagation();
    if (control.hasAttribute("data-curve-toggle")) {
      const expanded = control.getAttribute("aria-expanded") !== "true";
      control.setAttribute("aria-expanded", String(expanded));
      control.textContent = expanded ? control.dataset.recentLabel : control.dataset.allLabel;
      view.querySelector(".lexis-curve-recent").hidden = expanded;
      view.querySelector(".lexis-curve-all").hidden = !expanded;
    } else view.querySelector(".lexis-curve-info").textContent = control.dataset.curveDetail;
  };
  const keydown = (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target.closest("[data-curve-detail]")) activate(event);
  };
  const schedule = () => {
    window2.clearTimeout(timer);
    const tomorrow = /* @__PURE__ */ new Date();
    tomorrow.setHours(24, 0, 0, 100);
    timer = window2.setTimeout(() => {
      void update();
    }, Math.max(100, tomorrow.getTime() - Date.now()));
  };
  const update = async () => {
    if (!active || !refresh || refreshing) return;
    const dates = [...root.querySelectorAll("svg[data-curve-today]")];
    if (root.isConnected && dates.some((svg) => svg.dataset.curveToday !== localDay())) {
      refreshing = true;
      try {
        await refresh();
      } catch (error) {
        console.warn("[Lexis] Cannot refresh Today marker", error);
      } finally {
        refreshing = false;
      }
    }
    if (active) schedule();
  };
  const wake = () => {
    void update();
  };
  root.addEventListener("click", activate);
  root.addEventListener("keydown", keydown);
  if (refresh) {
    document2.addEventListener("visibilitychange", wake);
    window2.addEventListener("focus", wake);
    schedule();
  }
  return () => {
    active = false;
    window2.clearTimeout(timer);
    root.removeEventListener("click", activate);
    root.removeEventListener("keydown", keydown);
    document2.removeEventListener("visibilitychange", wake);
    window2.removeEventListener("focus", wake);
  };
}

// src/curve-view.ts
var escape = (text) => text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
function buildCurveViewHtml(card, build, t) {
  const recent = build(card, 8);
  if (!recent) return "";
  const all = recentReviewDates(card, Number.MAX_SAFE_INTEGER).length > 8 ? build(card, 0) : null;
  const button = all ? `<button type="button" data-curve-toggle aria-expanded="false" data-all-label="${escape(t("curve.showAll"))}" data-recent-label="${escape(t("curve.showRecent"))}">${escape(t("curve.showAll"))}</button>` : "";
  return `<div class="lexis-curve-view">${button}<div class="lexis-curve-panel lexis-curve-recent">${recent}</div>` + (all ? `<div class="lexis-curve-panel lexis-curve-all" hidden>${all}</div>` : "") + `<div class="lexis-curve-info" aria-live="polite"></div></div>`;
}
function mountCurveView(container, component, readCard, build, t) {
  const view = container.createDiv();
  const draw = () => {
    const expanded = view.querySelector("[data-curve-toggle]")?.getAttribute("aria-expanded") === "true";
    const parsed = new DOMParser().parseFromString(buildCurveViewHtml(readCard(), build, t), "text/html");
    view.replaceChildren(...Array.from(parsed.body.childNodes, (node) => container.ownerDocument.importNode(node, true)));
    if (expanded) view.querySelector("[data-curve-toggle]")?.click();
  };
  draw();
  component.register(attachCurveControls(view, draw));
}

// src/review-navigation.ts
var import_obsidian9 = require("obsidian");
async function openReviewFile(host, file, subpath = "", forceTab = false) {
  host.saveSession();
  const leaf = forceTab || host.mode() === "tab" ? host.app.workspace.getLeaf("tab") : host.leaf;
  await leaf.openFile(file, { active: true, eState: subpath ? { subpath } : void 0 });
  await host.app.workspace.revealLeaf(leaf);
  return leaf;
}
async function openReviewCardSource(host, card, forceTab = false) {
  const leaf = await openReviewFile(host, card.file, "", forceTab);
  const editor = leaf.view.editor;
  if (editor && card.line != null) {
    const position = { line: card.line, ch: 0 };
    editor.setCursor(position);
    editor.scrollIntoView({ from: position, to: position }, true);
  }
}
function internalReviewLink(element) {
  const link = element.closest("a.internal-link, [data-lexis-review-link]");
  if (!link) return null;
  return link.getAttribute("data-href") || link.getAttribute("data-lexis-review-link") || link.getAttribute("href") || "";
}
var ReviewNavigation = class {
  constructor(host, component, container) {
    this.host = host;
    component.registerDomEvent(container, "click", (event) => {
      const target = event.composedPath().find((node) => node?.nodeType === 1);
      if (!target) return;
      const link = internalReviewLink(target);
      if (link == null) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void this.openLink(link, event.metaKey || event.ctrlKey).catch((error) => host.failed(error));
    }, { capture: true });
  }
  async openFile(file, subpath = "", forceTab = false) {
    return openReviewFile(this.host, file, subpath, forceTab);
  }
  async openLink(link, forceTab = false) {
    if (/^[a-z][a-z\d+.-]*:/i.test(link)) throw new Error("Invalid internal note link");
    const { path, subpath } = (0, import_obsidian9.parseLinktext)(link);
    const sourcePath2 = this.host.sourcePath();
    const file = this.host.app.metadataCache.getFirstLinkpathDest(path || sourcePath2, sourcePath2);
    if (file) {
      await this.openFile(file, subpath, forceTab);
      return;
    }
    this.host.saveSession();
    if (!forceTab && this.host.mode() !== "tab") this.host.app.workspace.setActiveLeaf(this.host.leaf, { focus: true });
    await this.host.app.workspace.openLinkText(link, sourcePath2, forceTab || this.host.mode() === "tab" ? "tab" : false);
  }
};

// src/review-render-queue.ts
var import_obsidian10 = require("obsidian");
var ReviewRenderQueue = class {
  constructor(root) {
    this.root = root;
    this.waiting = /* @__PURE__ */ new Map();
    this.queue = [];
    this.components = /* @__PURE__ */ new Map();
    this.rendering = /* @__PURE__ */ new Set();
    this.active = true;
    const Observer = root.ownerDocument.defaultView.IntersectionObserver;
    this.observer = Observer ? new Observer((entries) => {
      for (const entry of entries) if (entry.isIntersecting) {
        const element = entry.target, job = this.waiting.get(element);
        if (!job) continue;
        this.waiting.delete(element);
        this.observer.unobserve(element);
        this.queue.push(job);
      }
      this.drain();
    }, { rootMargin: "120px" }) : null;
  }
  add(element, render, failed) {
    if (!this.active) return;
    for (const [target, component] of this.components) if (!target.isConnected && !this.rendering.has(target)) {
      component.unload();
      this.components.delete(target);
    }
    const job = { element, render, failed };
    if (this.observer) {
      this.waiting.set(element, job);
      this.observer.observe(element);
    } else {
      this.queue.push(job);
      this.drain();
    }
  }
  remove(element) {
    this.waiting.delete(element);
    this.observer?.unobserve(element);
    this.queue = this.queue.filter((job) => job.element !== element);
    if (!this.rendering.has(element)) {
      this.components.get(element)?.unload();
      this.components.delete(element);
    }
  }
  reset() {
    this.observer?.disconnect();
    this.waiting.clear();
    this.queue = [];
    for (const [element, component] of this.components) if (!this.rendering.has(element)) {
      component.unload();
      this.components.delete(element);
    }
  }
  dispose() {
    this.active = false;
    this.reset();
  }
  current(element) {
    return this.active && element.isConnected && this.root.contains(element);
  }
  drain() {
    while (this.active && this.rendering.size < 2 && this.queue.length) {
      const job = this.queue.shift();
      if (!this.current(job.element)) continue;
      this.rendering.add(job.element);
      void this.run(job).finally(() => {
        this.rendering.delete(job.element);
        this.drain();
      });
    }
  }
  async run(job) {
    const component = new import_obsidian10.Component();
    component.load();
    this.components.set(job.element, component);
    try {
      job.element.empty();
      await job.render(component, () => this.current(job.element));
    } catch (error) {
      if (this.current(job.element)) job.failed(error);
    } finally {
      if (!this.current(job.element)) {
        component.unload();
        this.components.delete(job.element);
      }
    }
  }
};

// src/review-card-display.ts
var LIST_ITEM_PREFIX = /^\s*(?:(?:>\s*)*)(?:(?:[-+*]|\d+[.)])\s+)(?:\[[ xX]\]\s+)?/;
function displayedSyntaxFront(markdown, kind) {
  if (kind !== "inline" && kind !== "bidirectional") return markdown;
  return markdown.replace(LIST_ITEM_PREFIX, "");
}

// src/review-library-preview.ts
var LibraryPreviews = class {
  constructor(root, host, navigation, queue = new ReviewRenderQueue(root)) {
    this.host = host;
    this.navigation = navigation;
    this.queue = queue;
  }
  add(element, card, bodyHandledByRow = false) {
    element.setText(this.host.t("common.loading"));
    this.queue.add(element, (component, current) => this.render(element, card, component, current, bodyHandledByRow), (error) => {
      element.setText(this.host.t("library.previewFailed"));
      console.warn("[Lexis] Cannot render card library preview", card.key, error);
    });
  }
  dispose() {
    this.queue.dispose();
  }
  reset() {
    this.queue.reset();
  }
  async render(element, card, component, current, bodyHandledByRow) {
    if (this.navigation) new ReviewNavigation({ ...this.navigation, app: this.host.app, sourcePath: () => card.file.path }, component, element);
    if (!bodyHandledByRow && card.type === "note") await this.host.renderNoteInto(element.createDiv({ cls: "lexis-library-preview-content" }), card.file, component);
    else if (!bodyHandledByRow) {
      const content = element.createDiv({ cls: "lexis-library-preview-content" });
      await renderLexisMarkdown(this.host.app, displayedSyntaxFront(card.syntax?.front || card.label, card.syntax?.kind), content, card.file.path, component);
      if (!current()) return;
      if (card.syntax?.back) {
        const answer = element.createEl("details", { cls: "lexis-library-answer" });
        answer.createEl("summary", { text: this.host.t("library.answer") });
        await renderLexisMarkdown(this.host.app, card.syntax.back, answer.createDiv(), card.file.path, component);
      }
    }
    if (!current()) return;
    const state = libraryStateOf(this.host, card);
    if (this.host.buildCurveSVG(state)) {
      const curve = element.createDiv({ cls: "lexis-curve" });
      mountCurveView(curve, component, () => libraryStateOf(this.host, card), this.host.buildCurveSVG.bind(this.host), this.host.t.bind(this.host));
    }
  }
};

// src/review-card-row.ts
var import_obsidian11 = require("obsidian");

// src/review-log-rows.ts
function createReviewRow(parent, activate, selected = false) {
  const row = parent.createDiv({ cls: `lexis-log-row${selected ? " is-active" : ""}`, attr: { role: "button", tabindex: "0" } });
  row.onclick = (event) => {
    if (event.target.closest("a,button,input,textarea,summary")) return;
    const selection = row.ownerDocument.getSelection();
    if (selection && !selection.isCollapsed && row.contains(selection.anchorNode)) return;
    activate();
  };
  row.onkeydown = (event) => {
    if (event.target === row && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      activate();
    }
  };
  return row;
}
function renderReviewTitle(row, card, host, queue, navigation, rank = "") {
  const title = row.createDiv({ cls: "lexis-log-row-title" });
  if (rank) title.createSpan({ cls: "lexis-log-row-rank", text: rank });
  const content = title.createDiv({ cls: "lexis-log-row-content" });
  if (card.type === "note") {
    content.setText(card.label);
    return;
  }
  const front = displayedSyntaxFront(card.syntax?.front || card.label, card.syntax?.kind);
  renderReviewMarkdown(content, front, card, host, queue, navigation);
}
function renderReviewMarkdown(content, markdown, card, host, queue, navigation) {
  content.addClass("markdown-rendered");
  content.setText(host.t("common.loading"));
  queue.add(content, async (component) => {
    if (navigation) new ReviewNavigation({ ...navigation, app: host.app, sourcePath: () => card.file?.path || "" }, component, content);
    await renderLexisMarkdown(host.app, markdown, content, card.file?.path || "", component);
  }, (error) => {
    content.setText(host.t("library.previewFailed"));
    console.warn("[Lexis] Cannot render review title", card.key, error);
  });
}

// src/review-card-row.ts
var answerId = 0;
function renderReviewCardRow(entry, card, host, queue, navigation, options = {}) {
  const id = `lexis-row-answer-${++answerId}`;
  let answer = null;
  const toggle = () => {
    if (answer) {
      answer.remove();
      queue.remove(answer);
      answer = null;
      row.setAttribute("aria-expanded", "false");
      row.classList.remove("is-active");
      return;
    }
    answer = entry.createDiv({ cls: "lexis-log-row-content lexis-library-row-answer", attr: { id, role: "region", "aria-label": host.t(card.type === "note" ? "library.noteContent" : "library.answer") } });
    entry.insertBefore(answer, row.nextSibling);
    row.setAttribute("aria-expanded", "true");
    row.classList.add("is-active");
    if (card.type === "syntax") renderReviewMarkdown(answer, card.syntax?.back || host.t("library.noAnswer"), card, host, queue, navigation);
    else {
      const target = answer;
      target.setText(host.t("common.loading"));
      queue.add(target, async (component) => {
        if (navigation) new ReviewNavigation({ ...navigation, app: host.app, sourcePath: () => card.file.path }, component, target);
        await host.renderNoteInto(target, card.file, component);
      }, () => target.setText(host.t("library.previewFailed")));
    }
  };
  const row = createReviewRow(entry, toggle);
  row.addClass("lexis-library-row");
  row.setAttribute("aria-expanded", "false");
  row.setAttribute("aria-controls", id);
  renderReviewTitle(row.createDiv({ cls: "lexis-library-question" }), card, host, queue, navigation, options.rank);
  const side = row.createDiv({ cls: "lexis-library-row-side" });
  options.metrics?.(side);
  const actions = side.createDiv({ cls: "lexis-library-row-actions" });
  const more = actions.createEl("button", { cls: "clickable-icon lexis-library-more", attr: { title: host.t("library.sourcePath"), "aria-label": host.t("library.sourcePath") } });
  (0, import_obsidian11.setIcon)(more, "ellipsis");
  more.onclick = (event) => {
    const menu = new import_obsidian11.Menu();
    menu.addItem((item) => item.setTitle(card.file.path).setDisabled(true));
    menu.showAtMouseEvent(event);
  };
  const open = actions.createEl("button", { cls: "clickable-icon lexis-library-open", attr: { title: host.t("log.openSource"), "aria-label": host.t("log.openSource") } });
  (0, import_obsidian11.setIcon)(open, "arrow-right");
  open.disabled = !navigation;
  open.onclick = (event) => {
    if (!navigation) return;
    void openReviewCardSource({ ...navigation, app: host.app, sourcePath: () => card.file.path }, card, event.metaKey || event.ctrlKey).catch((error) => navigation.failed(error));
  };
  return row;
}

// src/review-library-toolbar.ts
var import_obsidian12 = require("obsidian");
var sortLabels = { name: "library.sortName", reps: "library.sortReps", retention: "library.sortRetention", due: "log.due" };
function renderLibraryToolbar(root, host, state, changed, { reviewed = true, groupsExpanded, toggleGroups } = {}) {
  const toolbar = root.createDiv({ cls: "lexis-library-toolbar" });
  const search = toolbar.createEl("input", { cls: "lexis-log-search", attr: { type: "search", placeholder: host.t("library.search"), "aria-label": host.t("library.search") } });
  search.value = state.query;
  search.oninput = () => {
    state.query = search.value;
    changed();
  };
  const controls = toolbar.createDiv({ cls: "lexis-library-controls" });
  const scope = controls.createDiv({ cls: "lexis-library-scope" });
  const order = controls.createDiv({ cls: "lexis-library-order" });
  const redraw = (groupChanged = false) => {
    changed(groupChanged);
    options();
  };
  function options() {
    scope.empty();
    order.empty();
    const group = scope.createEl("button", { text: `${host.t(`collection.group.${state.groupBy || "none"}`)} \u25BE`, attr: { "data-library-group": "", title: host.t("collection.group") } });
    group.onclick = (event) => {
      const menu = new import_obsidian12.Menu();
      for (const value of libraryGroups)
        menu.addItem((item) => item.setTitle(host.t(`collection.group.${value}`)).setChecked(state.groupBy === value).onClick(() => {
          if (state.groupBy === value) return;
          state.groupBy = value;
          redraw(true);
        }));
      menu.showAtMouseEvent(event);
    };
    if (state.groupBy !== "none" && toggleGroups) {
      const expanded = groupsExpanded?.() === true;
      const label = host.t(expanded ? "library.collapseGroups" : "library.expandGroups");
      const toggle = scope.createEl("button", { cls: "clickable-icon", attr: { "data-library-groups-toggle": expanded ? "collapse" : "expand", "aria-label": label, title: label } });
      (0, import_obsidian12.setIcon)(toggle, expanded ? "chevrons-down-up" : "chevrons-up-down");
      toggle.onclick = () => {
        toggleGroups();
        options();
      };
    }
    if (reviewed) {
      const sort = order.createEl("button", { text: `${host.t(sortLabels[compactLibrarySorts.find((value) => value === state.sort) || "reps"])} \u25BE`, attr: { "data-library-sort": "" } });
      sort.onclick = (event) => {
        const menu = new import_obsidian12.Menu();
        for (const value of compactLibrarySorts) menu.addItem((item) => item.setTitle(host.t(sortLabels[value])).setChecked(state.sort === value).onClick(() => {
          state.sort = value;
          redraw();
        }));
        menu.showAtMouseEvent(event);
      };
      const directionLabel = host.t(state.direction === "desc" ? "library.desc" : "library.asc");
      const direction = order.createEl("button", { cls: "clickable-icon", attr: { "data-library-direction": "", "aria-label": directionLabel, title: directionLabel } });
      (0, import_obsidian12.setIcon)(direction, state.direction === "desc" ? "arrow-down" : "arrow-up");
      direction.onclick = () => {
        state.direction = state.direction === "desc" ? "asc" : "desc";
        redraw();
      };
    }
    const mode = order.createEl("button", { attr: { "data-library-view": state.view, "aria-label": host.t("library.switchView") } });
    mode.createSpan({ text: host.t(`library.view.${state.view}`) });
    (0, import_obsidian12.setIcon)(mode.createSpan({ cls: "lexis-library-switch" }), "arrow-left-right");
    mode.onclick = () => {
      state.view = state.view === "cards" ? "list" : "cards";
      redraw();
    };
  }
  options();
  return options;
}

// src/review-library.ts
function renderLibraryMetrics(container, host, metrics, compact = false) {
  const line = container.createDiv({ cls: "lexis-library-metrics" });
  line.createSpan({ text: host.t("library.repsValue", { count: metrics.reps ?? "\u2014" }) });
  line.createSpan({ text: host.t("library.retentionValue", { value: metrics.retention == null ? "\u2014" : `${Math.round(metrics.retention * 100)}%` }), attr: { title: host.t("library.retentionHint") } });
  if (!compact) line.createSpan({ text: host.t("library.stabilityValue", { value: metrics.stability == null ? "\u2014" : String(Math.round(metrics.stability * 10) / 10) }), attr: { title: host.t("library.stabilityHint") } });
}
function renderCardLibrary(root, cards, host, state, type, navigation, sharedRendering, reviewedOnly = false, unreviewedOnly = false) {
  Object.assign(state, normalizeCompactLibraryState(state));
  const rendering = sharedRendering || new ReviewRenderQueue(root);
  const openGroups = /* @__PURE__ */ new Set();
  let allGroupsExpanded = false;
  const refreshToolbar = renderLibraryToolbar(root, host, state, (groupChanged = false) => {
    if (groupChanged) {
      openGroups.clear();
      allGroupsExpanded = false;
    }
    count = 100;
    rows();
  }, {
    reviewed: !unreviewedOnly,
    groupsExpanded: () => allGroupsExpanded,
    toggleGroups: () => {
      allGroupsExpanded = !allGroupsExpanded;
      openGroups.clear();
      list.querySelectorAll(".lexis-library-group").forEach((section) => {
        section.open = allGroupsExpanded;
        if (section.open && section.dataset.groupId) openGroups.add(section.dataset.groupId);
      });
    }
  });
  const list = root.createDiv({ cls: `lexis-log-unreviewed${unreviewedOnly ? " is-unreviewed" : ""}` });
  const previews = new LibraryPreviews(list, host, navigation, rendering);
  let count = 100;
  function rows() {
    previews.reset();
    list.empty();
    const today = localDate(/* @__PURE__ */ new Date());
    const scoped = cards.filter((card) => type === "all" || card.type === type);
    const selectionState = unreviewedOnly ? { ...state, status: "unreviewed", sort: "name", direction: "asc" } : state;
    const matches = selectLibraryCards(scoped, host, selectionState, today, reviewedOnly);
    list.createDiv({ cls: "lexis-log-count", text: host.t("log.count", { count: matches.length }) });
    if (!matches.length) list.createDiv({ cls: "lexis-log-empty", text: host.t("library.empty") });
    const visible = matches.slice(0, count), ranks = new Map(matches.map((card, index) => [card.key, index]));
    for (const group of groupLibraryCards(visible, state.groupBy || "none", host.settings.dicts, host.app, host.getTags.bind(host), host.t("collection.ungrouped"))) {
      let parent = list;
      if (state.groupBy && state.groupBy !== "none") {
        const section = list.createEl("details", { cls: "lexis-library-group", attr: { "data-group-id": group.id } });
        section.open = allGroupsExpanded || openGroups.has(group.id);
        section.createEl("summary", { text: `${group.label} \xB7 ${group.cards.length}` });
        parent = section.createDiv();
        section.addEventListener("toggle", () => {
          if (section.open) openGroups.add(group.id);
          else openGroups.delete(group.id);
          const sections = [...list.querySelectorAll(".lexis-library-group")];
          allGroupsExpanded = sections.length > 0 && sections.every((item) => item.open);
          refreshToolbar();
        });
      }
      const entries = parent.createDiv({ cls: `lexis-library-entries${state.view === "cards" ? " is-cards" : ""}` });
      for (const card of group.cards) {
        const index = ranks.get(card.key);
        const metric = libraryMetrics(libraryStateOf(host, card), today);
        const entry = entries.createDiv({ cls: "lexis-library-entry" });
        renderReviewCardRow(entry, card, host, rendering, navigation, {
          rank: index == null ? "" : `${index + 1}. `,
          metrics: unreviewedOnly ? void 0 : (side) => renderLibraryMetrics(side, host, metric, true)
        });
        if (state.view === "cards") previews.add(entry.createDiv({ cls: "lexis-library-preview" }), card, true);
      }
    }
    if (matches.length > count) {
      const more = list.createEl("button", { text: host.t("log.more", { count: matches.length - count }) });
      more.onclick = () => {
        count += 100;
        rows();
      };
    }
  }
  rows();
  return () => {
    if (sharedRendering) rendering.reset();
    else previews.dispose();
  };
}
function renderLibraryPriority(host, container, card) {
  const priority = container.createDiv({ cls: "lexis-library-priority" });
  const value = effectivePriority(host.settings.reviewPriorities?.[card.key]);
  priority.createSpan({ text: `${host.t("review.priority")} \xB7 ${Math.round(value * 100)}%` });
  priority.createDiv({ cls: "lexis-log-note", text: host.t("review.priorityHint") });
  const button = priority.createEl("button", { text: host.t(value < 1 ? "review.resetPriority" : "review.lowerPriority") });
  button.onclick = async () => {
    button.disabled = true;
    try {
      await changeReviewPriority(host.settings, [card.key], value >= 1, () => host.saveSettings());
      priority.remove();
      renderLibraryPriority(host, container, card);
    } catch (error) {
      button.disabled = false;
      new import_obsidian13.Notice(host.t("review.priorityFailed", { error: error instanceof Error ? error.message : "Unknown error" }));
    }
  };
}

// src/review-log-view.ts
var dateOf = (event) => event.date;
var dateTime = (timestamp, precise) => {
  if (!precise) return timestamp.slice(0, 10);
  const value = new Date(timestamp);
  return `${localDate(value)} ${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
};
var LexisLogView = class extends import_obsidian14.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.navigation = true;
    this.day = localDate(/* @__PURE__ */ new Date());
    this.tab = "history";
    this.library = normalizeCompactLibraryState({ sort: "reps", direction: "desc" });
    this.filter = "all";
    this.cards = [];
    this.syntaxByKey = /* @__PURE__ */ new Map();
    this.selectedKey = "";
    this.refreshId = 0;
    this.libraryCleanup = null;
    this.rendering = null;
  }
  getViewType() {
    return LEXIS_LOG_VIEW;
  }
  getDisplayText() {
    return this.plugin.t("log.title");
  }
  getIcon() {
    return "calendar-days";
  }
  setDay(day) {
    this.day = day;
    this.tab = "history";
    void this.refresh();
  }
  async onOpen() {
    await this.refresh();
  }
  async onClose() {
    this.refreshId++;
    this.libraryCleanup?.();
    this.rendering?.dispose();
    this.rendering = null;
  }
  getState() {
    return { day: this.day, tab: this.tab, filter: this.filter, library: { ...this.library } };
  }
  async setState(state, result) {
    const saved = state;
    if (saved) {
      if (typeof saved.day === "string") this.day = saved.day;
      if (saved.tab === "library") this.tab = "reviewed";
      else if (typeof saved.tab === "string" && ["history", "unreviewed", "reviewed"].includes(saved.tab)) this.tab = saved.tab;
      if (typeof saved.filter === "string" && ["all", "note", "syntax"].includes(saved.filter)) this.filter = saved.filter;
      const library = saved.library;
      if (library) this.library = normalizeCompactLibraryState({ ...this.library, ...library });
    }
    await super.setState(state, result);
    await this.refresh();
  }
  async refresh() {
    this.libraryCleanup?.();
    this.libraryCleanup = null;
    this.rendering?.reset();
    const request = ++this.refreshId;
    if (this.tab !== "history") {
      this.contentEl.empty();
      this.contentEl.createDiv({ cls: "lexis-log-loading", text: this.plugin.t("common.loading") });
      await this.collectCards();
      if (request !== this.refreshId) return;
    } else if (this.dayEvents().some((event) => event.type === "syntax") && !this.syntaxByKey.size) {
      this.contentEl.empty();
      this.contentEl.createDiv({ cls: "lexis-log-loading", text: this.plugin.t("common.loading") });
      await this.collectCards();
      if (request !== this.refreshId) return;
    }
    this.render();
  }
  async collectCards() {
    const cards = await this.plugin.reviewCatalog.cards();
    this.cards = cards.sort((left, right) => left.label.localeCompare(right.label));
    this.syntaxByKey = new Map(cards.filter((card) => card.type === "syntax").map((card) => [card.key, card]));
  }
  dayEvents() {
    return this.plugin.settings.reviewEvents.filter((event) => dateOf(event) === this.day && (this.filter === "all" || event.type === this.filter));
  }
  render() {
    this.libraryCleanup?.();
    this.libraryCleanup = null;
    this.rendering?.reset();
    const root = this.contentEl;
    root.empty();
    root.addClass("lexis-log");
    this.rendering ||= new ReviewRenderQueue(root);
    const header = root.createDiv({ cls: "lexis-log-header" });
    header.createEl("h2", { text: this.plugin.t("log.title") });
    const tabs = header.createDiv({ cls: "lexis-segments" });
    for (const [key, label] of [["history", "log.history"], ["unreviewed", "log.unreviewed"], ["reviewed", "library.title"]]) {
      const button = tabs.createEl("button", { cls: `lexis-segment${this.tab === key ? " is-active" : ""}`, text: this.plugin.t(label) });
      button.setAttribute("aria-pressed", String(this.tab === key));
      if (key === "reviewed") button.setAttribute("title", this.plugin.t("library.hint"));
      button.onclick = () => {
        this.tab = key;
        this.selectedKey = "";
        void this.refresh();
      };
    }
    const filters = root.createDiv({ cls: "lexis-log-filters" });
    this.renderFilter(filters);
    if (this.tab === "history") this.renderHistory(root, filters);
    else if (this.tab === "reviewed") {
      this.libraryCleanup = renderCardLibrary(root, this.cards, this.plugin, this.library, this.filter, this.navigationHost(), this.rendering, true);
    } else this.renderUnreviewed(root);
  }
  navigationHost() {
    return {
      leaf: this.leaf,
      mode: () => this.plugin.settings.reviewLinkMode || "current",
      saveSession: () => this.app.workspace.requestSaveLayout(),
      failed: (error) => new import_obsidian14.Notice(this.plugin.t("review.openLinkFailed", { error: error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error" }))
    };
  }
  renderHistory(root, filters) {
    const week = weekStart(this.day);
    const nav = filters.createDiv({ cls: "lexis-log-week-nav" });
    const previous = nav.createEl("button", { text: "\u2039", attr: { "aria-label": this.plugin.t("log.previousWeek") } });
    previous.onclick = () => this.setDay(addDays(this.day, -7));
    nav.createSpan({ text: `${week} \u2014 ${addDays(week, 6)}` });
    const today = nav.createEl("button", { text: this.plugin.t("log.today") });
    today.onclick = () => this.setDay(localDate(/* @__PURE__ */ new Date()));
    const next = nav.createEl("button", { text: "\u203A", attr: { "aria-label": this.plugin.t("log.nextWeek") } });
    next.disabled = addDays(week, 7) > localDate(/* @__PURE__ */ new Date());
    next.onclick = () => this.setDay(addDays(this.day, 7));
    const days = root.createDiv({ cls: "lexis-log-days" });
    const names = this.plugin.settings.language === "en" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["\u5468\u4E00", "\u5468\u4E8C", "\u5468\u4E09", "\u5468\u56DB", "\u5468\u4E94", "\u5468\u516D", "\u5468\u65E5"];
    for (let index = 0; index < 7; index++) {
      const date = addDays(week, index);
      const count = this.plugin.settings.reviewLog[date] || 0;
      const button = days.createEl("button", { cls: `lexis-log-day${this.day === date ? " is-active" : ""}` });
      button.setAttribute("aria-pressed", String(this.day === date));
      button.createSpan({ text: names[index] });
      button.createEl("strong", { text: date.slice(8) });
      button.createEl("small", { text: String(count) });
      button.disabled = date > localDate(/* @__PURE__ */ new Date());
      button.onclick = () => this.setDay(date);
    }
    const events = this.dayEvents().sort((left, right) => right.timestamp.localeCompare(left.timestamp));
    const columns = root.createDiv({ cls: "lexis-log-columns" });
    const list = columns.createDiv({ cls: "lexis-log-list" });
    const listHeader = list.createDiv({ cls: "lexis-log-list-header" });
    listHeader.createEl("h3", { text: this.day });
    if (!events.length) list.createDiv({ cls: "lexis-log-empty", text: this.plugin.t("log.noDayCards") });
    for (const event of events) {
      const source = this.eventCard(event);
      const row = createReviewRow(list, () => {
        const scroll = this.contentEl.scrollTop;
        this.selectedKey = event.id;
        this.render();
        this.contentEl.scrollTop = scroll;
      }, event.id === this.selectedKey);
      renderReviewTitle(row, source || { label: event.label || this.plugin.t("log.unknownCard"), type: event.type }, this.plugin, this.rendering, this.navigationHost());
      row.createSpan({ cls: "lexis-log-row-meta", text: `${this.plugin.t(`review.${["", "again", "hard", "good", "easy"][event.grade] || "again"}`)} \xB7 ${event.precision === "time" ? dateTime(event.timestamp, true).slice(11) : this.plugin.t("log.dateOnly")}${event.type === "syntax" ? ` \xB7 ${source?.file.basename || event.filePath}` : ""}` });
      if (event.id === this.selectedKey && this.contentEl.clientWidth < 700) this.renderCardDetail(list, source, event);
    }
    const side = columns.createDiv({ cls: "lexis-log-side" });
    this.renderStats(side, events);
    const selected = events.find((event) => event.id === this.selectedKey);
    if (selected && this.contentEl.clientWidth >= 700) this.renderCardDetail(side, this.eventCard(selected), selected);
    if (events.some((event) => event.precision === "day") || this.filter === "all" && (this.plugin.settings.reviewLog[this.day] || 0) > events.length) {
      list.createDiv({ cls: "lexis-log-note", text: this.plugin.t("log.legacyHint") });
    }
  }
  renderFilter(host) {
    const group = host.createDiv({ cls: "lexis-segments lexis-log-types" });
    for (const [key, label] of [["all", "common.all"], ["note", "log.notes"], ["syntax", "log.syntax"]]) {
      const button = group.createEl("button", { cls: `lexis-segment${this.filter === key ? " is-active" : ""}`, text: this.plugin.t(label) });
      button.setAttribute("aria-pressed", String(this.filter === key));
      button.onclick = () => {
        this.filter = key;
        void this.refresh();
      };
    }
  }
  renderStats(host, events) {
    const exact = events.filter((event) => event.precision === "time");
    const result = firstAttemptSuccess([...exact].reverse());
    const first = /* @__PURE__ */ new Map();
    for (const event of [...exact].reverse()) {
      const key = event.memberKeys.join("|");
      if (!first.has(key)) first.set(key, event);
    }
    const predicted = [...first.values()].filter((event) => Number.isFinite(event.retention) && event.retention > 0);
    host.createEl("h3", { text: this.plugin.t("log.dayStats") });
    const count = this.filter === "all" ? this.plugin.settings.reviewLog[this.day] || 0 : events.length;
    const monday = weekStart(this.day);
    const weekActions = Array.from({ length: 7 }, (_, index) => this.plugin.settings.reviewLog[addDays(monday, index)] || 0).reduce((sum, value) => sum + value, 0);
    this.stat(host, "log.actions", String(count));
    this.stat(host, "log.weekActions", String(weekActions));
    this.stat(host, "log.unique", String(new Set(events.map((event) => event.memberKeys.join("|"))).size));
    this.stat(host, "log.firstSuccess", result.total ? `${Math.round(result.correct / result.total * 100)}%` : "\u2014");
    this.stat(host, "log.predicted", predicted.length ? `${Math.round(predicted.reduce((sum, event) => sum + event.retention, 0) / predicted.length)}%` : "\u2014");
    host.createDiv({ cls: "lexis-log-note", text: this.plugin.t("log.statsHint") });
  }
  stat(host, label, value) {
    const line = host.createDiv({ cls: "lexis-log-stat" });
    line.createSpan({ text: this.plugin.t(label) });
    line.createEl("strong", { text: value });
  }
  eventCard(event) {
    if (event.type === "syntax") {
      const indexed = this.syntaxByKey.get(event.memberKeys[0]);
      if (indexed) return indexed;
      const file2 = this.app.vault.getFileByPath(event.filePath);
      return file2 ? { key: event.memberKeys[0], file: file2, label: event.label, type: "syntax", line: event.line } : null;
    }
    const file = this.app.vault.getFileByPath(event.filePath);
    return file ? { key: event.memberKeys[0], file, label: file.basename, type: "note" } : null;
  }
  renderCardDetail(host, card, event) {
    const detail = host.createDiv({ cls: "lexis-log-detail" });
    renderReviewTitle(detail.createEl("h3"), card || { label: event?.label || this.plugin.t("log.unknownCard"), type: event?.type || "note" }, this.plugin, this.rendering, this.navigationHost());
    if (!card) {
      detail.createDiv({ text: this.plugin.t("log.sourceMissing") });
      return;
    }
    if (card.headingPath?.length) this.stat(detail, "library.category", card.headingPath.join(" / "));
    const discovered = this.plugin.settings.reviewCardMeta?.[card.key]?.discoveredAt;
    this.stat(detail, "library.discovered", discovered ? dateTime(discovered, true) : this.plugin.t("log.unknown"));
    const added = this.plugin.settings.reviewAddedAt[card.key];
    if (added) this.stat(detail, "log.added", dateTime(added, true));
    else if (card.type === "note") this.stat(detail, "log.fileCreated", dateTime(new Date(card.file.stat.ctime).toISOString(), false));
    else this.stat(detail, "log.added", this.plugin.t("log.unknown"));
    const history = this.plugin.settings.reviewEvents.filter((item) => item.memberKeys.includes(card.key)).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    const earliest = history[0];
    this.stat(detail, "library.firstReview", earliest ? dateTime(earliest.timestamp, earliest.precision === "time") : this.plugin.t("log.never"));
    const state = card.type === "note" ? this.plugin.readCard(card.file) : this.plugin.readSyntaxCardState(card.key.slice(7));
    renderLibraryMetrics(detail, this.plugin, libraryMetrics(state));
    if (state.due) this.stat(detail, "log.due", state.due);
    const recent = history.slice(-5).reverse();
    if (recent.length) {
      detail.createEl("h4", { text: this.plugin.t("log.recent") });
      for (const item of recent) detail.createDiv({ cls: "lexis-log-recent", text: `${dateTime(item.timestamp, item.precision === "time")} \xB7 ${this.plugin.t(`review.${["", "again", "hard", "good", "easy"][item.grade] || "again"}`)}` });
    }
    const open = detail.createEl("button", { text: this.plugin.t("log.openSource") });
    open.onclick = () => {
      void this.openSource(card);
    };
    renderLibraryPriority(this.plugin, detail, card);
  }
  async openSource(card) {
    await openReviewCardSource({ ...this.navigationHost(), app: this.app, sourcePath: () => card.file.path }, card);
  }
  renderUnreviewed(root) {
    this.libraryCleanup = renderCardLibrary(root, this.cards, this.plugin, this.library, this.filter, this.navigationHost(), this.rendering, false, true);
  }
};

// src/review-catalog.ts
var import_obsidian15 = require("obsidian");

// src/review-heading-path.ts
function reviewHeadingPaths(lines) {
  const stack = [];
  return lines.map((line, index) => {
    const atx = /^ {0,3}(#{1,6})[ \t]+(.+?)\s*$/.exec(line);
    const previous = lines[index - 1] || "";
    const setext = previous.trim() && !/^ {0,3}(?:#{1,6}(?:\s|$)|>|[-+*]\s|\d+[.)]\s)/.test(previous) && /^ {0,3}(=+|-+)\s*$/.exec(line);
    const level = atx ? atx[1].length : setext ? setext[1][0] === "=" ? 1 : 2 : 0;
    const title = atx ? atx[2].replace(/[ \t]+#+[ \t]*$/, "").trim() : setext ? lines[index - 1].trim() : "";
    if (level) {
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      stack.push({ level, title });
    }
    return stack.map((heading) => heading.title);
  });
}

// src/flashcard-code-mask.ts
function maskInlineCode(lines) {
  const source = lines.join("\n"), runs = [...source.matchAll(/`+/g)];
  const next = /* @__PURE__ */ new Map(), closing = new Array(runs.length);
  for (let index = runs.length - 1; index >= 0; index--) {
    const size = runs[index][0].length;
    closing[index] = next.get(size) ?? -1;
    next.set(size, index);
  }
  const spans = [];
  for (let index = 0; index < runs.length; index++) {
    const start = runs[index].index;
    let backslashes = 0;
    for (let cursor2 = start - 1; cursor2 >= 0 && source[cursor2] === "\\"; cursor2--) backslashes++;
    if (backslashes % 2) continue;
    const end = closing[index];
    if (end < 0 || /\n[ \t\r]*\n/.test(source.slice(start, runs[end].index))) continue;
    spans.push([start, runs[end].index + runs[end][0].length]);
    index = end;
  }
  let cursor = 0, result = "";
  for (const [start, end] of spans) {
    result += source.slice(cursor, start) + source.slice(start, end).replace(/[^\r\n]/g, "\0");
    cursor = end;
  }
  return (result + source.slice(cursor)).split("\n");
}
function maskExcludedLines(markdown) {
  const lines = markdown.split("\n");
  let fence2 = "", indented = false, frontmatter = lines[0]?.trim() === "---", comment = false;
  return lines.map((line, index) => {
    const trimmed = line.trim();
    if (frontmatter) {
      if (index > 0 && trimmed === "---") frontmatter = false;
      return "";
    }
    const block = line.replace(/^ {0,3}(?:>[ \t]?)* {0,3}/, "");
    if (fence2) {
      const close = /^(`{3,}|~{3,})[ \t\r]*$/.exec(block);
      if (close && close[1][0] === fence2[0] && close[1].length >= fence2.length) fence2 = "";
      return "";
    }
    if (/^( {4}|\t)/.test(line) && (indented || index === 0 || !lines[index - 1].trim())) {
      indented = true;
      return "";
    }
    if (indented && !trimmed) return "";
    indented = false;
    const opening = /^(`{3,}|~{3,})/.exec(block);
    if (opening) {
      fence2 = opening[1];
      return "";
    }
    if (comment) {
      if (line.includes("-->")) comment = false;
      return "";
    }
    const commentStart = line.indexOf("<!--");
    if (commentStart >= 0) {
      if (!line.slice(commentStart + 4).includes("-->")) comment = true;
      return line.slice(0, commentStart);
    }
    return line;
  });
}

// src/flashcard-syntax.ts
var PLACEHOLDERS = {
  question: "{{question}}",
  answer: "{{answer}}",
  sideA: "{{sideA}}",
  sideB: "{{sideB}}"
};
var ANSWER_MASK_OPEN = '<span class="lexis-rv-answer-mask">';
var ANSWER_MASK_CLOSE = "</span>";
var hasQuestion = (value) => !!value.trim() && !/^(?:#{1,6}|[-+*]|\d+[.)])$/.test(value.trim());
var hashText = (value) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};
var stableId = (filePath, kind, front, back, occurrence = 0) => `syntax-${hashText([filePath, kind, front.trim(), back.trim(), occurrence].join(""))}`;
var betweenVariables = (template, left, right) => {
  const leftIndex = template.indexOf(left);
  const rightIndex = template.indexOf(right, leftIndex + left.length);
  if (leftIndex < 0 || rightIndex < 0 || rightIndex < leftIndex) return "";
  return template.slice(leftIndex + left.length, rightIndex);
};
var inlineQuestionDelimiter = (template) => betweenVariables(template || "", PLACEHOLDERS.question, PLACEHOLDERS.answer).trim();
var inlineEntryConflictsWithFlashcard = (entryDelimiter, template) => {
  const entry = String(entryDelimiter || "").trim();
  return !!entry && entry === inlineQuestionDelimiter(template);
};
var wrapAnswer = (value) => `${ANSWER_MASK_OPEN}${value}${ANSWER_MASK_CLOSE}`;
var delimiterIndex = (line, delimiter) => {
  let from = 0;
  while (delimiter) {
    const at = line.indexOf(delimiter, from);
    if (at < 0) return -1;
    const standardLibraryScope = delimiter === "::" && /\bstd$/.test(line.slice(0, at)) && /^[A-Za-z_]/.test(line.slice(at + delimiter.length));
    if (!standardLibraryScope) return at;
    from = at + delimiter.length;
  }
  return -1;
};
var maskBlockLine = (line) => {
  if (!line.trim()) return line;
  const table = /^(\s*\|)(.*)(\|\s*)$/.exec(line);
  if (table && !/^\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+$/.test(table[2])) {
    const cells = table[2].split("|").map((cell) => cell.trim() ? wrapAnswer(cell) : cell);
    return `${table[1]}${cells.join("|")}${table[3]}`;
  }
  const match = /^(\s*(?:(?:>\s*)*(?:(?:[-+*]|\d+[.)])\s+|#{1,6}\s+)?))(.*)$/.exec(line);
  return match ? `${match[1]}${wrapAnswer(match[2])}` : wrapAnswer(line);
};
var applyMaskRanges = (line, ranges) => {
  const ordered = [...ranges].filter((range) => range.end > range.start).sort((left, right) => right.start - left.start);
  let result = line;
  for (const range of ordered) result = result.slice(0, range.start) + wrapAnswer(result.slice(range.start, range.end)) + result.slice(range.end);
  return result;
};
function maskSyntaxAnswers(markdown, templates, options = {}) {
  const rawLines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const lines = maskInlineCode(maskExcludedLines(rawLines.join("\n")));
  const output = [...rawLines];
  const fullyMasked = /* @__PURE__ */ new Set();
  const ranges = /* @__PURE__ */ new Map();
  const addRange = (line, start, end) => {
    const current = ranges.get(line) || [];
    current.push({ start, end });
    ranges.set(line, current);
  };
  const blockBetween = betweenVariables(templates.block || "", PLACEHOLDERS.question, PLACEHOLDERS.answer);
  const blockMarker = blockBetween.trim();
  const markerOnOwnLine = /^\s*\n[\s\S]*\n\s*$/.test(blockBetween);
  if (blockMarker) {
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      let question = "";
      let answerStart = index + 1;
      if (markerOnOwnLine && line.trim() === blockMarker) {
        let start = index - 1;
        while (start >= 0 && lines[start].trim()) start--;
        question = rawLines.slice(start + 1, index).join("\n").trim();
      } else if (!markerOnOwnLine && line.trimEnd().endsWith(blockMarker)) {
        question = rawLines[index].trimEnd().slice(0, -blockMarker.length).trim();
      } else continue;
      let answerEnd = answerStart;
      while (answerEnd < rawLines.length && rawLines[answerEnd].trim()) answerEnd++;
      if (!hasQuestion(question) || answerEnd === answerStart) continue;
      for (let answerLine = answerStart; answerLine < answerEnd; answerLine++) {
        output[answerLine] = maskBlockLine(rawLines[answerLine]);
        fullyMasked.add(answerLine);
      }
      index = Math.max(index, answerEnd - 1);
    }
  }
  const bidirectionalDelimiter = betweenVariables(templates.bidirectional || "", PLACEHOLDERS.sideA, PLACEHOLDERS.sideB).trim();
  const configuredInlineDelimiter = inlineQuestionDelimiter(templates.inline);
  const inlineDelimiter = inlineEntryConflictsWithFlashcard(options.inlineEntryDelimiter || "", templates.inline) ? "" : configuredInlineDelimiter;
  for (let index = 0; index < lines.length; index++) {
    if (fullyMasked.has(index) || !lines[index].trim()) continue;
    const line = lines[index];
    const bidirectionalAt = delimiterIndex(line, bidirectionalDelimiter);
    const inlineAt = delimiterIndex(line, inlineDelimiter);
    const delimiter = bidirectionalAt >= 0 ? bidirectionalDelimiter : inlineAt >= 0 ? inlineDelimiter : "";
    if (!delimiter) continue;
    const at = delimiter === bidirectionalDelimiter ? bidirectionalAt : inlineAt;
    const answerStart = at + delimiter.length;
    const answer = rawLines[index].slice(answerStart);
    if (hasQuestion(rawLines[index].slice(0, at)) && (delimiter === bidirectionalDelimiter ? hasQuestion(answer) : answer.trim())) addRange(index, answerStart, rawLines[index].length);
  }
  const clozeTemplate = templates.cloze || "";
  const answerAt = clozeTemplate.indexOf(PLACEHOLDERS.answer);
  const clozeOpen = answerAt >= 0 ? clozeTemplate.slice(0, answerAt) : "";
  const clozeClose = answerAt >= 0 ? clozeTemplate.slice(answerAt + PLACEHOLDERS.answer.length) : "";
  if (clozeOpen && clozeClose) {
    for (let index = 0; index < lines.length; index++) {
      if (fullyMasked.has(index) || !lines[index].trim() || ranges.has(index)) continue;
      const source = lines[index];
      let cursor = 0;
      while (cursor < source.length) {
        const start = source.indexOf(clozeOpen, cursor);
        if (start < 0) break;
        const contentStart = start + clozeOpen.length;
        const close = source.indexOf(clozeClose, contentStart);
        if (close < 0) break;
        if (rawLines[index].slice(contentStart, close).trim()) addRange(index, contentStart, close);
        cursor = close + clozeClose.length;
      }
    }
  }
  for (const [index, lineRanges] of ranges) output[index] = applyMaskRanges(rawLines[index], lineRanges);
  return output.join("\n");
}
function findClozeAnswerRanges(markdown, templates) {
  const clozeTemplate = templates.cloze || "";
  const answerAt = clozeTemplate.indexOf(PLACEHOLDERS.answer);
  if (answerAt < 0) return [];
  const clozeOpen = clozeTemplate.slice(0, answerAt);
  const clozeClose = clozeTemplate.slice(answerAt + PLACEHOLDERS.answer.length);
  if (!clozeOpen || !clozeClose) return [];
  const ranges = [];
  const rawLines = markdown.split("\n");
  const searchable = maskInlineCode(maskExcludedLines(markdown)).map((line, index) => line.padEnd(rawLines[index].length, "\0")).join("\n");
  let cursor = 0;
  while (cursor < markdown.length) {
    const start = searchable.indexOf(clozeOpen, cursor);
    if (start < 0) break;
    const answerStart = start + clozeOpen.length;
    const close = searchable.indexOf(clozeClose, answerStart);
    if (close < 0) break;
    const answer = markdown.slice(answerStart, close).trim();
    if (answer) ranges.push({ start, end: close + clozeClose.length, answer });
    cursor = close + clozeClose.length;
  }
  return ranges;
}
function maskClozeAnswers(markdown, templates, revealIndexes = /* @__PURE__ */ new Set()) {
  const ranges = findClozeAnswerRanges(markdown, templates);
  let result = markdown;
  for (let index = ranges.length - 1; index >= 0; index--) {
    const range = ranges[index];
    if (revealIndexes.has(index)) continue;
    const answerStart = range.start + (templates.cloze || "").indexOf(PLACEHOLDERS.answer);
    const answerEnd = range.end - ((templates.cloze || "").length - (templates.cloze || "").indexOf(PLACEHOLDERS.answer) - PLACEHOLDERS.answer.length);
    result = result.slice(0, answerStart) + `<span class="lexis-rv-answer-mask">${result.slice(answerStart, answerEnd)}</span>` + result.slice(answerEnd);
  }
  return result;
}
var addCard = (cards, counts, filePath, kind, front, back, line, groupSource = "", combinedFront) => {
  const base = [kind, front.trim(), back.trim()].join("");
  const occurrence = counts.get(base) || 0;
  counts.set(base, occurrence + 1);
  const id = stableId(filePath, kind, front, back, occurrence);
  cards.push({
    id,
    groupId: `group-${hashText([filePath, kind, groupSource || base, line].join(""))}`,
    kind,
    front: front.trim(),
    back: back.trim(),
    combinedFront: combinedFront?.trim(),
    line
  });
};
function parseSyntaxCards(markdown, filePath, templates, options = {}) {
  const rawLines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const visibleLines = maskExcludedLines(rawLines.join("\n"));
  const lines = maskInlineCode(visibleLines);
  const cards = [];
  const counts = /* @__PURE__ */ new Map();
  const consumed = /* @__PURE__ */ new Set();
  const blockBetween = betweenVariables(templates.block || "", PLACEHOLDERS.question, PLACEHOLDERS.answer);
  const blockMarker = blockBetween.trim();
  const markerOnOwnLine = /^\s*\n[\s\S]*\n\s*$/.test(blockBetween);
  if (blockMarker) {
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      let question = "";
      let answerStart = index + 1;
      let questionStart = index;
      if (markerOnOwnLine && line.trim() === blockMarker) {
        let start = index - 1;
        while (start >= 0 && lines[start].trim()) start--;
        questionStart = start + 1;
        question = rawLines.slice(questionStart, index).join("\n").trim();
      } else if (!markerOnOwnLine && line.trimEnd().endsWith(blockMarker)) {
        question = rawLines[index].trimEnd().slice(0, -blockMarker.length).trim();
      } else continue;
      let answerEnd = answerStart;
      while (answerEnd < rawLines.length && rawLines[answerEnd].trim()) answerEnd++;
      const answer = rawLines.slice(answerStart, answerEnd).join("\n").trim();
      if (!hasQuestion(question) || !answer) continue;
      for (let used = questionStart; used < answerEnd; used++) consumed.add(used);
      addCard(cards, counts, filePath, "block", question, answer, questionStart, `${question}
${answer}`);
      index = Math.max(index, answerEnd - 1);
    }
  }
  const bidirectionalDelimiter = betweenVariables(templates.bidirectional || "", PLACEHOLDERS.sideA, PLACEHOLDERS.sideB).trim();
  const configuredInlineDelimiter = inlineQuestionDelimiter(templates.inline);
  const inlineDelimiter = inlineEntryConflictsWithFlashcard(options.inlineEntryDelimiter || "", templates.inline) ? "" : configuredInlineDelimiter;
  for (let index = 0; index < lines.length; index++) {
    if (consumed.has(index) || !lines[index].trim()) continue;
    const line = lines[index];
    const bidirectionalAt = delimiterIndex(line, bidirectionalDelimiter);
    if (bidirectionalAt >= 0) {
      const at = bidirectionalAt;
      const sideA = rawLines[index].slice(0, at).trim();
      const sideB = rawLines[index].slice(at + bidirectionalDelimiter.length).trim();
      if (hasQuestion(sideA) && hasQuestion(sideB)) {
        const group = `${sideA}${bidirectionalDelimiter}${sideB}`;
        addCard(cards, counts, filePath, "bidirectional", sideA, sideB, index, group);
        addCard(cards, counts, filePath, "bidirectional", sideB, sideA, index, group);
        consumed.add(index);
      }
      continue;
    }
    const inlineAt = delimiterIndex(line, inlineDelimiter);
    if (inlineAt >= 0) {
      const at = inlineAt;
      const question = rawLines[index].slice(0, at).trim();
      const answer = rawLines[index].slice(at + inlineDelimiter.length).trim();
      if (hasQuestion(question) && answer) {
        addCard(cards, counts, filePath, "inline", question, answer, index);
        consumed.add(index);
      }
    }
  }
  const clozeTemplate = templates.cloze || "";
  const answerAt = clozeTemplate.indexOf(PLACEHOLDERS.answer);
  const clozeOpen = answerAt >= 0 ? clozeTemplate.slice(0, answerAt) : "";
  const clozeClose = answerAt >= 0 ? clozeTemplate.slice(answerAt + PLACEHOLDERS.answer.length) : "";
  if (clozeOpen && clozeClose) {
    for (let index = 0; index < lines.length; index++) {
      if (!lines[index].trim()) continue;
      const source = lines[index];
      const ranges = [];
      let cursor = 0;
      while (cursor < source.length) {
        const start = source.indexOf(clozeOpen, cursor);
        if (start < 0) break;
        const contentStart = start + clozeOpen.length;
        const close = source.indexOf(clozeClose, contentStart);
        if (close < 0) break;
        const answer = rawLines[index].slice(contentStart, close).trim();
        if (answer) ranges.push({ start, end: close + clozeClose.length, answer });
        cursor = close + clozeClose.length;
      }
      if (!ranges.length) continue;
      const original = rawLines[index];
      const combinedFront = ranges.reduceRight((value, range) => value.slice(0, range.start) + "[\u2026]" + value.slice(range.end), original);
      ranges.forEach((range, clozeIndex) => {
        const front = original.slice(0, range.start) + "[\u2026]" + original.slice(range.end);
        addCard(cards, counts, filePath, "cloze", front, original, index, original, combinedFront);
        cards[cards.length - 1].clozeAnswer = range.answer;
        cards[cards.length - 1].clozeIndex = clozeIndex;
      });
    }
  }
  const paths = reviewHeadingPaths(visibleLines);
  for (const card of cards) card.headingPath = paths[card.line] || [];
  return cards;
}

// src/review-catalog.ts
function rememberReviewCards(settings, cards, baseline, at = (/* @__PURE__ */ new Date()).toISOString()) {
  let changed = false;
  for (const card of cards) {
    if (settings.reviewCardMeta[card.key]) continue;
    settings.reviewCardMeta[card.key] = { filePath: card.file.path, discoveredAt: baseline ? null : at };
    changed = true;
  }
  return changed;
}
var ReviewCatalog = class {
  constructor(host) {
    this.host = host;
    this.parsed = /* @__PURE__ */ new Map();
    this.keysByPath = /* @__PURE__ */ new Map();
    this.pending = Promise.resolve();
    this.started = false;
    this.disposed = false;
    this.signature = "";
    this.scanTask = null;
    this.queuedUpdates = /* @__PURE__ */ new Set();
    this.failedPaths = /* @__PURE__ */ new Set();
    this.needsReconcile = false;
    this.dirty = false;
    this.saving = null;
    this.saveTimer = null;
  }
  templates() {
    const s = this.host.settings;
    return { inline: s.flashcardInlineTemplate, bidirectional: s.flashcardBidirectionalTemplate, block: s.flashcardBlockTemplate, cloze: s.flashcardClozeTemplate };
  }
  parseOptions(file) {
    return this.host.isInlineSourceFile?.(file) ? { inlineEntryDelimiter: this.host.settings.inlineEntryDelimiter } : {};
  }
  parsingSignature() {
    const s = this.host.settings;
    return JSON.stringify({ templates: this.templates(), inlineEntriesEnabled: s.inlineEntriesEnabled, inlineEntryDelimiter: s.inlineEntryDelimiter });
  }
  // Watching must not read note bodies: metadata emits many changes while a vault opens.
  start() {
    if (this.started || this.disposed) return;
    this.started = true;
    for (const [key, meta] of Object.entries(this.host.settings.reviewCardMeta)) {
      const keys = this.keysByPath.get(meta.filePath) || /* @__PURE__ */ new Set();
      keys.add(key);
      this.keysByPath.set(meta.filePath, keys);
    }
    this.host.registerEvent(this.host.app.metadataCache.on("changed", (file) => {
      if (this.signature || this.scanTask !== null) this.queueUpdate(file);
    }));
    this.host.registerEvent(this.host.app.vault.on("delete", (file) => {
      void this.enqueue(async () => {
        let changed = false;
        for (const path of this.keysByPath.keys()) {
          if (path === file.path || path.startsWith(`${file.path}/`)) changed = this.removeFile(path) || changed;
        }
        if (changed) this.scheduleSave();
      });
    }));
    this.host.registerEvent(this.host.app.vault.on("rename", (file, oldPath) => {
      if (file instanceof import_obsidian15.TFile) void this.enqueue(() => this.rename(file, oldPath));
      else void this.enqueue(async () => {
        for (const path of /* @__PURE__ */ new Set([...this.parsed.keys(), ...this.keysByPath.keys()])) {
          if (!path.startsWith(`${oldPath}/`)) continue;
          const current = this.host.app.vault.getFileByPath(file.path + path.slice(oldPath.length));
          if (current) await this.rename(current, path);
        }
      });
    }));
    this.host.register(() => {
      this.disposed = true;
      if (this.saveTimer) window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
      if (this.dirty) void this.persist().catch((error) => console.warn("[Lexis] Cannot save card discovery", error));
      this.parsed.clear();
      this.keysByPath.clear();
      this.queuedUpdates.clear();
      this.failedPaths.clear();
    });
  }
  enqueue(task) {
    const work = this.pending.then(async () => {
      if (!this.disposed) await task();
    });
    this.pending = work.catch((error) => console.warn("[Lexis] Card catalog update failed", error));
    return work;
  }
  queueUpdate(file) {
    if (this.disposed || this.queuedUpdates.has(file)) return;
    this.queuedUpdates.add(file);
    void this.enqueue(async () => {
      this.queuedUpdates.delete(file);
      await this.update(file);
    });
  }
  async settle() {
    let pending;
    do {
      pending = this.pending;
      await pending;
    } while (pending !== this.pending);
  }
  async ensureLoaded() {
    this.start();
    for (const path of this.failedPaths) {
      const file = this.host.app.vault.getFileByPath(path);
      if (file) this.queueUpdate(file);
      else this.failedPaths.delete(path);
    }
    do {
      if (!this.disposed && this.scanTask === null && this.signature !== this.parsingSignature()) {
        if (this.saveTimer) window.clearTimeout(this.saveTimer);
        this.saveTimer = null;
        this.scanTask = this.enqueue(() => this.scan()).finally(() => {
          this.scanTask = null;
          if (this.dirty) this.scheduleSave();
        });
      }
      if (this.scanTask !== null) await this.scanTask;
      await this.settle();
    } while (!this.disposed && this.signature !== this.parsingSignature());
    if (!this.disposed && this.needsReconcile && !this.failedPaths.size) this.reconcile();
  }
  async flush() {
    await this.settle();
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = null;
    do {
      await this.persist();
    } while (this.dirty || this.saving !== null);
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }
  async persist() {
    if (this.saving !== null) await this.saving;
    if (!this.dirty) return;
    this.dirty = false;
    this.saving = this.host.saveSettings();
    try {
      await this.saving;
    } catch (error) {
      this.dirty = true;
      throw error;
    } finally {
      this.saving = null;
    }
  }
  scheduleSave() {
    this.dirty = true;
    if (this.saveTimer || this.disposed || this.scanTask !== null) return;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.persist().catch((error) => console.warn("[Lexis] Cannot save card discovery", error));
    }, 1e3);
  }
  async scan() {
    const signature = this.parsingSignature();
    const files = this.host.app.vault.getMarkdownFiles();
    this.needsReconcile = false;
    for (let index = 0; index < files.length && !this.disposed; index += 16) {
      await Promise.all(files.slice(index, index + 16).map((file) => this.update(file)));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
    if (this.disposed) return;
    this.signature = signature;
    this.needsReconcile = true;
  }
  reconcile() {
    const paths = new Set(this.host.app.vault.getMarkdownFiles().map((file) => file.path));
    for (const path of /* @__PURE__ */ new Set([...this.parsed.keys(), ...this.keysByPath.keys()])) {
      if (!paths.has(path) && this.removeFile(path)) this.scheduleSave();
    }
    const syntaxKeys = new Set([...this.parsed.values()].flatMap((cards) => cards.map((card) => `syntax:${card.id}`)));
    for (const key of Object.keys(this.host.settings.reviewPriorities)) {
      if (key.startsWith("syntax:") ? syntaxKeys.has(key) : paths.has(key)) continue;
      delete this.host.settings.reviewPriorities[key];
      this.scheduleSave();
    }
    if (!this.host.settings.reviewCatalogInitialized) {
      this.host.settings.reviewCatalogInitialized = true;
      this.scheduleSave();
    }
    this.needsReconcile = false;
  }
  fileCards(file) {
    const cards = (this.parsed.get(file.path) || []).map((syntax) => ({
      key: `syntax:${syntax.id}`,
      file,
      label: syntax.front,
      type: "syntax",
      line: syntax.line,
      headingPath: syntax.headingPath,
      syntax
    }));
    if (this.host.isVocabFile(file)) cards.unshift({ key: file.path, file, label: file.basename, type: "note" });
    return cards;
  }
  async update(file, markdown) {
    if (file.extension !== "md" || this.disposed) return true;
    if (this.host.app.vault.getFileByPath(file.path) !== file) return true;
    try {
      markdown ??= await this.host.app.vault.cachedRead(file);
    } catch (error) {
      if (this.disposed) return false;
      this.failedPaths.add(file.path);
      console.warn("[Lexis] Cannot index review cards", file.path, error);
      return false;
    }
    if (this.disposed || this.host.app.vault.getFileByPath(file.path) !== file) return true;
    this.failedPaths.delete(file.path);
    this.parsed.set(file.path, parseSyntaxCards(markdown, file.path, this.templates(), this.parseOptions(file)));
    const cards = this.fileCards(file);
    const keys = new Set(cards.map((card) => card.key));
    let changed = rememberReviewCards(this.host.settings, cards, !this.host.settings.reviewCatalogInitialized);
    for (const key of this.keysByPath.get(file.path) || []) {
      if (keys.has(key)) continue;
      delete this.host.settings.reviewCardMeta[key];
      delete this.host.settings.reviewPriorities[key];
      changed = true;
    }
    this.keysByPath.set(file.path, keys);
    if (changed) this.scheduleSave();
    return true;
  }
  removeFile(path) {
    this.parsed.delete(path);
    this.failedPaths.delete(path);
    let changed = false;
    for (const key of /* @__PURE__ */ new Set([path, ...this.keysByPath.get(path) || []])) {
      if (key in this.host.settings.reviewCardMeta || key in this.host.settings.reviewPriorities) changed = true;
      delete this.host.settings.reviewCardMeta[key];
      delete this.host.settings.reviewPriorities[key];
    }
    this.keysByPath.delete(path);
    return changed;
  }
  async rename(file, oldPath) {
    if (this.disposed) return;
    if (file.extension !== "md") {
      if (this.removeFile(oldPath)) this.scheduleSave();
      return;
    }
    if (!this.signature && this.scanTask === null && !this.keysByPath.has(oldPath)) return;
    const markdown = await this.host.app.vault.cachedRead(file);
    if (this.disposed) return;
    const previous = this.parsed.get(oldPath) || parseSyntaxCards(markdown, oldPath, this.templates(), this.parseOptions(file));
    const current = parseSyntaxCards(markdown, file.path, this.templates(), this.parseOptions(file));
    const pairs = [[oldPath, file.path], ...previous.flatMap((before, index) => {
      const after = current[index];
      return after && before.kind === after.kind && before.front === after.front && before.back === after.back ? [[`syntax:${before.id}`, `syntax:${after.id}`]] : [];
    })];
    for (const [oldKey, newKey] of pairs) {
      const s = this.host.settings;
      if (s.reviewCardMeta[oldKey]) {
        s.reviewCardMeta[newKey] = { ...s.reviewCardMeta[oldKey], filePath: file.path };
        delete s.reviewCardMeta[oldKey];
      }
      if (s.reviewPriorities[oldKey]) {
        s.reviewPriorities[newKey] = s.reviewPriorities[oldKey];
        delete s.reviewPriorities[oldKey];
      }
      const oldSuspended = oldKey.startsWith("syntax:") ? oldKey : `note:${oldKey}`;
      const newSuspended = newKey.startsWith("syntax:") ? newKey : `note:${newKey}`;
      if (s.suspendedReviewItems?.[oldSuspended]) {
        s.suspendedReviewItems[newSuspended] = true;
        delete s.suspendedReviewItems[oldSuspended];
      }
    }
    this.removeFile(oldPath);
    await this.update(file, markdown);
    this.scheduleSave();
  }
  async cards() {
    await this.ensureLoaded();
    if (this.disposed) return [];
    const cards = this.host.app.vault.getMarkdownFiles().flatMap((file) => this.fileCards(file));
    if (rememberReviewCards(this.host.settings, cards, !this.host.settings.reviewCatalogInitialized)) this.scheduleSave();
    for (const card of cards) {
      const keys = this.keysByPath.get(card.file.path) || /* @__PURE__ */ new Set();
      keys.add(card.key);
      this.keysByPath.set(card.file.path, keys);
    }
    return cards;
  }
};

// src/occurrence-search.ts
function pdfItemsToText(items) {
  let out = "";
  let prev = null;
  for (const item of items || []) {
    const text = String(item && item.str || "");
    if (!text) {
      if (item && item.hasEOL) out += "\n";
      continue;
    }
    let separator = "";
    if (prev) {
      if (prev.hasEOL) separator = "\n";
      else if (!/\s$/.test(out) && !/^\s/.test(text)) {
        const pt = prev.transform || [], ct = item.transform || [];
        const sameLine = Number.isFinite(pt[5]) && Number.isFinite(ct[5]) ? Math.abs(pt[5] - ct[5]) <= Math.max(1, Math.abs(pt[3] || ct[3] || 0) * 0.45) : true;
        if (!sameLine) separator = "\n";
        else if (Number.isFinite(pt[4]) && Number.isFinite(ct[4]) && Number.isFinite(prev.width)) {
          const chars = Math.max(1, String(prev.str || "").trim().length);
          const charWidth = Math.abs(Number(prev.width) || 0) / chars;
          const gap = ct[4] - (pt[4] + Number(prev.width || 0));
          if (gap > Math.max(0.5, charWidth * 0.18) || gap < -Math.max(2, charWidth * 2)) separator = " ";
        } else separator = " ";
      }
    }
    out += separator + text;
    prev = item;
  }
  return out;
}
function normalizePdfText(text) {
  return String(text || "").replace(/([\p{L}\p{N}])-\s*\n\s*([\p{L}\p{N}])/gu, "$1$2").replace(/\s+/g, " ").trim();
}
function mergeOccurrences(markdown, pdf, limit) {
  const out = [], max = Math.max(1, Number(limit) || 1);
  for (let i = 0; out.length < max && (i < markdown.length || i < pdf.length); i++) {
    if (i < markdown.length) out.push(markdown[i]);
    if (out.length < max && i < pdf.length) out.push(pdf[i]);
  }
  return out;
}
function createOccurrenceSearch(options) {
  const { app, loadPdfJs: loadPdfJs2, boundedSource: boundedSource2, extractSentence, markdownAllowed, inScope } = options;
  const pdfCache = /* @__PURE__ */ new Map();
  const readPdfPages = async (file) => {
    const signature = `${file.stat && file.stat.mtime || 0}:${file.stat && file.stat.size || 0}`;
    const cached = pdfCache.get(file.path);
    if (cached && cached.signature === signature) return cached.promise;
    const promise = (async () => {
      let doc = null;
      try {
        const pdfjs = await loadPdfJs2();
        const buffer = await app.vault.readBinary(file);
        const task = pdfjs.getDocument({ data: new Uint8Array(buffer) });
        doc = await task.promise;
        const pages = [];
        for (let page = 1; page <= doc.numPages; page++) {
          const pdfPage = await doc.getPage(page);
          const content = await pdfPage.getTextContent();
          const text = normalizePdfText(pdfItemsToText(content.items));
          if (text) pages.push({ page, text });
          if (pdfPage.cleanup) pdfPage.cleanup();
        }
        return pages;
      } catch (error) {
        console.warn(`[Lexis] PDF \u51FA\u5904\u626B\u63CF\u5931\u8D25: ${file.path}`, error);
        return [];
      } finally {
        if (doc?.destroy) {
          try {
            await doc.destroy();
          } catch {
          }
        }
      }
    })();
    pdfCache.set(file.path, { signature, promise });
    return promise;
  };
  const searchMarkdown = async (word, limit, scope) => {
    const re = new RegExp(boundedSource2(word), "i"), results = [];
    const files = app.vault.getMarkdownFiles().filter((file) => markdownAllowed(file) && inScope(file.path, scope));
    for (const file of files) {
      if (results.length >= limit) break;
      let content;
      try {
        content = await app.vault.cachedRead(file);
      } catch {
        continue;
      }
      const index = content.search(re);
      if (index >= 0) results.push({ file, sentence: extractSentence(content, index) });
    }
    return results;
  };
  const searchPdf = async (word, limit, scope) => {
    const re = new RegExp(boundedSource2(word), "i"), results = [];
    const files = app.vault.getFiles().filter((file) => file.extension === "pdf" && inScope(file.path, scope));
    for (const file of files) {
      if (results.length >= limit) break;
      const pages = await readPdfPages(file);
      for (const page of pages) {
        const index = page.text.search(re);
        if (index < 0) continue;
        results.push({ file, page: page.page, sentence: extractSentence(page.text, index) });
        break;
      }
    }
    return results;
  };
  return {
    clearResults() {
      return;
    },
    invalidatePdf(path) {
      if (path) pdfCache.delete(path);
      else pdfCache.clear();
    },
    async find(word, { limit = 6, scope = [], includePdf = true } = {}) {
      const markdownPromise = searchMarkdown(word, limit, scope);
      const pdfPromise = includePdf ? searchPdf(word, limit, scope) : Promise.resolve([]);
      const [markdown, pdf] = await Promise.all([markdownPromise, pdfPromise]);
      return mergeOccurrences(markdown, pdf, limit);
    }
  };
}

// src/encounter-store.ts
var DAY = /^\d{4}-\d{2}-\d{2}$/;
var DEVICE = /^[a-f0-9]{32}$/;
var DEVICE_LABEL = /^[a-z][a-z0-9-]{0,31}$/;
var LEGACY_SNAPSHOT = /^([a-f0-9]{32})\.json$/;
var SHORT_NAMED_SNAPSHOT = /^([a-z][a-z0-9-]{0,31})--([a-f0-9]{8})\.json$/;
var NAMED_SNAPSHOT = /^([a-z][a-z0-9-]{0,31})--([a-f0-9]{32})\.json$/;
var LEGACY_EVENT_FILE = /^\d{4}-\d{2}-\d{2}\.jsonl$/;
var ACTIVE_KINDS = /* @__PURE__ */ new Set(["hover", "add", "open"]);
function encounterSnapshotName(file) {
  const name = file.slice(file.lastIndexOf("/") + 1);
  return LEGACY_SNAPSHOT.test(name) || SHORT_NAMED_SNAPSHOT.test(name) || NAMED_SNAPSHOT.test(name) ? name : null;
}
function validMutation(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value;
  if (typeof entry.path !== "string" || !entry.path || !Number.isSafeInteger(entry.changedAt) || Number(entry.changedAt) <= 0) return false;
  if (entry.deleted) return true;
  return Number.isSafeInteger(entry.encounteredAt) && Number(entry.encounteredAt) > 0 && typeof entry.day === "string" && DAY.test(entry.day);
}
function newer(left, right) {
  if (!left || right.changedAt > left.changedAt) return right;
  if (right.changedAt < left.changedAt) return left;
  return right.deleted && !left.deleted ? right : left;
}
async function ensureDirectory(adapter, folder) {
  let current = "";
  for (const segment of folder.split("/")) {
    current = current ? `${current}/${segment}` : segment;
    if (!await adapter.exists(current)) await adapter.mkdir(current);
  }
}
var EncounterStore = class {
  constructor(adapter, folder, deviceId, deviceLabel = "device") {
    this.adapter = adapter;
    this.folder = folder;
    this.deviceId = deviceId;
    this.deviceLabel = deviceLabel;
    if (!DEVICE.test(deviceId)) throw new Error("Invalid encounter device ID");
    if (!DEVICE_LABEL.test(deviceLabel)) throw new Error("Invalid encounter device label");
  }
  snapshotPath(folder = this.folder, deviceId = this.deviceId, deviceLabel = this.deviceLabel) {
    return `${folder}/${deviceLabel}--${deviceId}.json`;
  }
  legacySnapshotPath(folder = this.folder, deviceId = this.deviceId) {
    return `${folder}/${deviceId}.json`;
  }
  snapshotName(file) {
    return encounterSnapshotName(file);
  }
  async readSnapshot(file) {
    const raw = JSON.parse(await this.adapter.read(file));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Invalid Lexis encounter snapshot: ${file}`);
    const snapshot = raw;
    if (snapshot.schema !== 2 || typeof snapshot.deviceId !== "string" || !DEVICE.test(snapshot.deviceId) || !snapshot.entries || typeof snapshot.entries !== "object" || Array.isArray(snapshot.entries)) {
      throw new Error(`Invalid Lexis encounter snapshot: ${file}`);
    }
    const entries = {};
    for (const [path, value] of Object.entries(snapshot.entries)) {
      if (validMutation(value) && value.path === path) entries[path] = value;
    }
    const name = this.snapshotName(file);
    const legacyId = name?.match(LEGACY_SNAPSHOT)?.[1];
    const shortId = name?.match(SHORT_NAMED_SNAPSHOT)?.[2];
    const namedId = name?.match(NAMED_SNAPSHOT)?.[2];
    if (!name || legacyId && legacyId !== snapshot.deviceId || shortId && !snapshot.deviceId.startsWith(shortId) || namedId && namedId !== snapshot.deviceId) {
      throw new Error(`Invalid Lexis encounter snapshot name: ${file}`);
    }
    return { schema: 2, deviceId: snapshot.deviceId, entries };
  }
  async writeSnapshot(file, snapshot) {
    const data = JSON.stringify(snapshot);
    if (await this.adapter.exists(file)) await this.adapter.process(file, () => data);
    else await this.adapter.write(file, data);
  }
  async migrateOwnSnapshotName(folder = this.folder) {
    const named = this.snapshotPath(folder);
    const candidates = [this.legacySnapshotPath(folder)];
    if (await this.adapter.exists(folder)) {
      const root = await this.adapter.list(folder);
      for (const file of root.files) {
        const name = file.slice(file.lastIndexOf("/") + 1);
        if (SHORT_NAMED_SNAPSHOT.test(name) && file !== named) candidates.push(file);
      }
    }
    const sources2 = [];
    for (const file of candidates) {
      if (!await this.adapter.exists(file)) continue;
      const snapshot = await this.readSnapshot(file);
      if (snapshot.deviceId === this.deviceId) sources2.push({ file, snapshot });
    }
    if (!sources2.length) return;
    const current = await this.readOwnSnapshot(folder);
    for (const { snapshot } of sources2) {
      for (const [path, value] of Object.entries(snapshot.entries)) current.entries[path] = newer(current.entries[path], value);
    }
    await this.writeSnapshot(named, current);
    for (const { file } of sources2) if (file !== named) await this.adapter.remove(file);
  }
  async readOwnSnapshot(folder = this.folder) {
    const file = this.snapshotPath(folder);
    if (await this.adapter.exists(file)) return this.readSnapshot(file);
    return { schema: 2, deviceId: this.deviceId, entries: {} };
  }
  async migrateLegacyEvents(folder = this.folder) {
    const legacyFolder = `${folder}/${this.deviceId}`;
    if (!await this.adapter.exists(legacyFolder)) return;
    const root = await this.adapter.list(legacyFolder);
    const files = root.files.filter((file) => LEGACY_EVENT_FILE.test(file.slice(file.lastIndexOf("/") + 1)));
    if (!files.length) return;
    const snapshot = await this.readOwnSnapshot(folder);
    for (const file of files) {
      for (const line of (await this.adapter.read(file)).split("\n")) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (typeof event.path !== "string" || !event.path || typeof event.kind !== "string" || !ACTIVE_KINDS.has(event.kind) || typeof event.day !== "string" || !DAY.test(event.day) || typeof event.at !== "number" || !Number.isSafeInteger(event.at) || event.at <= 0) continue;
          const mutation = { path: event.path, changedAt: event.at, encounteredAt: event.at, day: event.day };
          snapshot.entries[event.path] = newer(snapshot.entries[event.path], mutation);
        } catch (error) {
          console.warn(`[Lexis] Ignoring invalid legacy encounter event in ${file}`, error);
        }
      }
    }
    await this.writeSnapshot(this.snapshotPath(folder), snapshot);
    for (const file of files) await this.adapter.remove(file);
    const remaining = await this.adapter.list(legacyFolder);
    if (!remaining.files.length && !remaining.folders.length) await this.adapter.rmdir(legacyFolder, false);
  }
  async snapshots(folder = this.folder) {
    if (!await this.adapter.exists(folder)) return [];
    const root = await this.adapter.list(folder);
    const output = [];
    for (const file of root.files.filter((name) => this.snapshotName(name))) {
      try {
        output.push({ name: file.slice(file.lastIndexOf("/") + 1), snapshot: await this.readSnapshot(file) });
      } catch (error) {
        console.warn(`[Lexis] Ignoring unreadable encounter snapshot ${file}`, error);
      }
    }
    return output;
  }
  async load() {
    await this.migrateOwnSnapshotName();
    await this.migrateLegacyEvents();
    const latest = {};
    for (const { snapshot } of await this.snapshots()) {
      for (const [path, value] of Object.entries(snapshot.entries)) latest[path] = newer(latest[path], value);
    }
    const totals = {};
    for (const [path, value] of Object.entries(latest)) {
      if (!value.deleted) totals[path] = { lastEncounter: value.day, encounteredAt: value.encounteredAt };
    }
    return totals;
  }
  async apply(mutations) {
    if (!mutations.length) return;
    await ensureDirectory(this.adapter, this.folder);
    await this.migrateOwnSnapshotName();
    await this.migrateLegacyEvents();
    const file = this.snapshotPath();
    const snapshot = await this.readOwnSnapshot();
    for (const mutation of mutations) {
      if (!validMutation(mutation)) throw new Error("Invalid encounter mutation");
      snapshot.entries[mutation.path] = newer(snapshot.entries[mutation.path], mutation);
    }
    await this.writeSnapshot(file, snapshot);
  }
  async copyTo(folder, created = /* @__PURE__ */ new Map()) {
    if (folder === this.folder || !await this.adapter.exists(this.folder)) return;
    await this.migrateOwnSnapshotName();
    await this.migrateLegacyEvents();
    await ensureDirectory(this.adapter, folder);
    await this.migrateOwnSnapshotName(folder);
    await this.migrateLegacyEvents(folder);
    const destination = await this.adapter.list(folder);
    const unrelated = destination.files.find((file) => !this.snapshotName(file) && !file.endsWith("/.DS_Store"));
    if (unrelated || destination.folders.some((path) => path !== `${folder}/reviews`)) throw new Error("Choose an empty folder dedicated to Lexis data.");
    for (const { name, snapshot } of await this.snapshots()) {
      const target = `${folder}/${name}`;
      if (!await this.adapter.exists(target)) {
        created.set(target, JSON.stringify(snapshot));
        await this.writeSnapshot(target, snapshot);
        continue;
      }
      const current = await this.readSnapshot(target);
      for (const [path, value] of Object.entries(snapshot.entries)) current.entries[path] = newer(current.entries[path], value);
      await this.writeSnapshot(target, current);
    }
  }
  async removeOwn() {
    if (!await this.adapter.exists(this.folder)) return;
    const root = await this.adapter.list(this.folder);
    for (const file of root.files) {
      const name = file.slice(file.lastIndexOf("/") + 1);
      if (name === `${this.deviceId}.json` || name.endsWith(`--${this.deviceId}.json`)) await this.adapter.remove(file);
      else if (SHORT_NAMED_SNAPSHOT.test(name)) {
        try {
          if ((await this.readSnapshot(file)).deviceId === this.deviceId) await this.adapter.remove(file);
        } catch {
        }
      }
    }
    const legacyFolder = `${this.folder}/${this.deviceId}`;
    if (await this.adapter.exists(legacyFolder)) {
      const legacy = await this.adapter.list(legacyFolder);
      if (!legacy.files.length && !legacy.folders.length) await this.adapter.rmdir(legacyFolder, false);
    }
    const remaining = await this.adapter.list(this.folder);
    if (remaining.files.every((file) => file.endsWith("/.DS_Store")) && !remaining.folders.length) {
      for (const file of remaining.files) await this.adapter.remove(file);
      await this.adapter.rmdir(this.folder, false);
    }
  }
  async removeCopiedTo(folder) {
    for (const { name, snapshot } of await this.snapshots()) {
      const destination = `${folder}/${name}`;
      if (!await this.adapter.exists(destination)) throw new Error("Encounter data has not finished moving");
      const target = await this.readSnapshot(destination);
      if (Object.entries(snapshot.entries).every(([key, value]) => target.entries[key] && newer(target.entries[key], value) === target.entries[key])) {
        await this.adapter.remove(`${this.folder}/${name}`);
      } else throw new Error("Encounter data changed during the move; source was retained");
    }
    const root = await this.adapter.list(this.folder);
    if (!root.files.length && !root.folders.length) await this.adapter.rmdir(this.folder, false);
  }
};

// src/plugin-data-storage.ts
var import_obsidian16 = require("obsidian");

// src/learning-data.ts
var LEARNING_FIELDS = [
  "reviewPlans",
  "reviewPracticeProgress",
  "reviewDailyTargets",
  "reviewGoalHistory",
  "reviewLog",
  "reviewHistory",
  "reviewEvents",
  "reviewAddedAt",
  "reviewCardMeta",
  "reviewCatalogInitialized",
  "reviewPriorities",
  "syntaxCardStates",
  "suspendedReviewItems"
];
var copy = (value) => JSON.parse(JSON.stringify(value));
var equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
var record = (value) => !!value && typeof value === "object" && !Array.isArray(value);
function retentionDays(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.min(3650, Math.round(value))) : 90;
}
function learningData(settings) {
  return Object.fromEntries(LEARNING_FIELDS.map((field) => [field, copy(settings[field] ?? (field === "reviewEvents" || field === "reviewPlans" ? [] : field === "reviewCatalogInitialized" ? false : {}))]));
}
function settingsOnly(settings) {
  const result = { ...settings };
  for (const field of LEARNING_FIELDS) delete result[field];
  delete result.encounterFolder;
  return result;
}
function pruneLearning(data, days, today = localDate(/* @__PURE__ */ new Date())) {
  if (days === null) return copy(data);
  const result = copy(data), cutoff = addDays(today, 1 - retentionDays(days));
  result.reviewEvents = result.reviewEvents.filter((event) => event.date >= cutoff);
  for (const [key, history] of Object.entries(result.reviewHistory)) {
    const recent = Array.isArray(history) ? history.filter((event) => event.date >= cutoff).slice(-64) : [];
    if (recent.length) result.reviewHistory[key] = recent;
    else delete result.reviewHistory[key];
  }
  for (const field of ["reviewLog", "reviewGoalHistory"]) {
    for (const day of Object.keys(result[field])) if (day < cutoff) delete result[field][day];
  }
  return result;
}
function flattenLearning(data) {
  const entries = {};
  for (const field of LEARNING_FIELDS) {
    const value = data[field];
    if (field === "reviewEvents" || field === "reviewPlans") {
      for (const item of data[field]) entries[JSON.stringify([field, item.id])] = item;
      if (field === "reviewPlans") entries[JSON.stringify([field, "$order"])] = data.reviewPlans.map((plan) => plan.id);
    } else if (field === "reviewPracticeProgress") {
      for (const [plan, progress] of Object.entries(data.reviewPracticeProgress || {})) {
        entries[JSON.stringify([field, JSON.stringify([plan, "$date"])])] = progress.date;
        for (const [card, count] of Object.entries(progress.counts)) entries[JSON.stringify([field, JSON.stringify([plan, card])])] = { date: progress.date, count };
      }
    } else if (field === "reviewHistory") {
      for (const [card, history] of Object.entries(data.reviewHistory)) {
        const byDate = {};
        for (const event of history) (byDate[event.date] ??= []).push(event);
        for (const [date, events] of Object.entries(byDate)) entries[JSON.stringify([field, JSON.stringify([card, date])])] = events;
      }
    } else if (field === "reviewCatalogInitialized") entries[JSON.stringify([field, "$value"])] = value;
    else if (record(value)) for (const [key, item] of Object.entries(value)) entries[JSON.stringify([field, key])] = item;
  }
  return entries;
}
function entryParts(key) {
  const parsed = JSON.parse(key);
  if (!Array.isArray(parsed) || parsed.length !== 2 || !LEARNING_FIELDS.includes(parsed[0]) || typeof parsed[1] !== "string") {
    throw new Error("Invalid learning record key");
  }
  return parsed;
}
function entryDay(key, value) {
  const [field, id] = entryParts(key);
  if (field === "reviewLog" || field === "reviewGoalHistory") return id;
  if (field === "reviewEvents") return record(value) && typeof value.date === "string" ? value.date : null;
  if (field === "reviewHistory") {
    const parts = JSON.parse(id);
    if (!Array.isArray(parts) || parts.length !== 2 || typeof parts[0] !== "string" || typeof parts[1] !== "string") throw new Error("Invalid review history key");
    return parts[1];
  }
  return null;
}
function validateLearningValue(key, value) {
  const [field, id] = entryParts(key);
  if (field === "reviewCatalogInitialized") return typeof value === "boolean";
  if (field === "reviewPlans" && id === "$order") return Array.isArray(value) && value.every((id2) => typeof id2 === "string");
  if (field === "reviewLog") return typeof value === "number" && Number.isFinite(value) && value >= 0;
  if (field === "reviewAddedAt") return typeof value === "string";
  if (field === "suspendedReviewItems") return typeof value === "boolean";
  if (field === "reviewPracticeProgress") {
    const parts = JSON.parse(id);
    return Array.isArray(parts) && parts.length === 2 && parts.every((part) => typeof part === "string") && (parts[1] === "$date" ? typeof value === "string" : record(value) && typeof value.date === "string" && typeof value.count === "number" && Number.isFinite(value.count) && value.count >= 0);
  }
  if (field === "reviewHistory") return Array.isArray(value) && value.every((event) => record(event) && typeof event.date === "string" && event.date === entryDay(key) && typeof event.s === "number" && Number.isFinite(event.s) && event.s > 0);
  if (!record(value)) return false;
  if (field === "reviewEvents") return value.id === id && typeof value.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.date) && typeof value.timestamp === "string" && typeof value.filePath === "string" && typeof value.label === "string" && (value.type === "note" || value.type === "syntax") && (value.precision === "day" || value.precision === "time") && Array.isArray(value.memberKeys) && value.memberKeys.every((key2) => typeof key2 === "string") && typeof value.grade === "number" && Number.isInteger(value.grade) && value.grade >= 1 && value.grade <= 4;
  if (field === "reviewPlans") return value.id === id && typeof value.name === "string" && typeof value.content === "string";
  return true;
}
function inflateLearning(entries) {
  const data = learningData({});
  let order = [];
  for (const [key, value] of Object.entries(entries)) {
    const [field, id] = entryParts(key);
    if (field === "reviewPlans" && id === "$order") {
      order = value;
      continue;
    }
    if (field === "reviewEvents") data.reviewEvents.push(value);
    else if (field === "reviewPlans") data.reviewPlans.push(value);
    else if (field === "reviewPracticeProgress") {
      const [plan, card] = JSON.parse(id);
      const item = value;
      const date = card === "$date" ? value : item.date;
      const progress = data.reviewPracticeProgress[plan];
      if (!progress || progress.date < date) data.reviewPracticeProgress[plan] = { date, counts: {} };
      if (data.reviewPracticeProgress[plan].date === date && card !== "$date") data.reviewPracticeProgress[plan].counts[card] = item.count;
    } else if (field === "reviewHistory") {
      const [card] = JSON.parse(id);
      (data.reviewHistory[card] ??= []).push(...value);
    } else if (field === "reviewCatalogInitialized") data.reviewCatalogInitialized = value === true;
    else Object.defineProperty(data[field], id, { value, enumerable: true, configurable: true, writable: true });
  }
  data.reviewEvents.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id));
  for (const key of Object.keys(data.reviewHistory)) data.reviewHistory[key].sort((a, b) => a.date.localeCompare(b.date));
  data.reviewPlans.sort((a, b) => (order.indexOf(a.id) < 0 ? Infinity : order.indexOf(a.id)) - (order.indexOf(b.id) < 0 ? Infinity : order.indexOf(b.id)) || a.id.localeCompare(b.id));
  return data;
}

// src/learning-store.ts
var FILE = /^(state|day-(\d{4}-\d{2}-\d{2}))--[a-z][a-z0-9-]{0,31}--([a-f0-9]{32})\.json$/;
async function ensureDataDirectory(adapter, folder) {
  let path = "";
  for (const part of folder.split("/")) {
    path = path ? `${path}/${part}` : part;
    if (!await adapter.exists(path)) await adapter.mkdir(path);
  }
}
var LearningStore = class {
  constructor(adapter, folder, device, label, now = () => Date.now()) {
    this.adapter = adapter;
    this.folder = folder;
    this.device = device;
    this.label = label;
    this.now = now;
    this.seen = {};
    this.own = {};
    this.pending = {};
    this.queue = Promise.resolve();
    this.clock = 0;
    this.days = 90;
    this.ready = false;
    this.cache = /* @__PURE__ */ new Map();
    if (!/^[a-f0-9]{32}$/.test(device) || !/^[a-z][a-z0-9-]{0,31}$/.test(label)) throw new Error("Invalid learning device identity");
    this.directory = `${folder}/reviews`;
  }
  path(kind) {
    return `${this.directory}/${kind}--${this.label}--${this.device}.json`;
  }
  marker() {
    return `${this.directory}/storage.json`;
  }
  isDataPath(path) {
    return path === this.directory || path.startsWith(`${this.directory}/`);
  }
  invalidate(path) {
    this.cache.delete(path);
  }
  async checkMarker(required) {
    if (!await this.adapter.exists(this.marker())) {
      if (required) throw new Error("Lexis learning data is missing or moving. Sync the data folder, then reload Lexis.");
      return false;
    }
    const marker = JSON.parse(await this.adapter.read(this.marker()));
    if (!record(marker) || marker.schema !== 1) throw new Error("Unsupported Lexis learning storage. Update Lexis; do not downgrade.");
    return true;
  }
  async read(path) {
    const stat = await this.adapter.stat(path), stamp = `${stat?.mtime}:${stat?.size}`;
    const cached = this.cache.get(path);
    if (stat && cached?.stamp === stamp) return cached.snapshot;
    const text = await this.adapter.read(path), raw = JSON.parse(text), name = path.split("/").pop()?.match(FILE);
    if (!name || !record(raw) || raw.schema !== 1 || raw.device !== name[3] || !record(raw.entries)) throw new Error(`Invalid or unsupported Lexis learning data: ${path}`);
    const entries = {};
    for (const [key, item] of Object.entries(raw.entries)) {
      entryParts(key);
      if (!record(item) || !Number.isSafeInteger(item.at) || Number(item.at) < 1 || item.deleted !== true && !("value" in item) || !item.deleted && !validateLearningValue(key, item.value) || (name[1] === "state" ? !!item.day || !!entryDay(key, item.value) : item.day !== name[2] || !item.deleted && entryDay(key, item.value) !== name[2])) throw new Error(`Invalid Lexis learning record: ${path}`);
      entries[key] = item;
    }
    const snapshot = { schema: 1, device: raw.device, entries };
    this.cache.set(path, { text, snapshot, stamp });
    return snapshot;
  }
  trim(entries) {
    if (this.days === null) return entries;
    const cutoff = addDays(localDate(new Date(this.now())), 1 - this.days), result = {};
    for (const [key, mutation] of Object.entries(entries)) {
      if (mutation.day && mutation.day < cutoff) continue;
      result[key] = mutation;
    }
    return result;
  }
  async aggregate() {
    if (!await this.adapter.exists(this.directory)) return { data: inflateLearning({}), count: 0 };
    const root = await this.adapter.list(this.directory), merged = {};
    let count = 0;
    const paths = root.files.filter((path) => FILE.test(path.split("/").pop() || "")).sort();
    for (let offset = 0; offset < paths.length; offset += 16) for (const { path, snapshot } of await Promise.all(paths.slice(offset, offset + 16).map(async (path2) => ({ path: path2, snapshot: await this.read(path2) })))) {
      const day = path.split("/").pop()?.match(FILE)?.[2];
      if (this.days !== null && day && day < addDays(localDate(new Date(this.now())), 1 - this.days)) {
        await this.adapter.remove(path);
        this.cache.delete(path);
        continue;
      }
      if (!day) count++;
      for (const mutation of Object.values(snapshot.entries)) this.clock = Math.max(this.clock, mutation.at);
      if (snapshot.device === this.device) for (const [key, mutation] of Object.entries(this.trim(snapshot.entries))) {
        if (!this.own[key] || mutation.at >= this.own[key].at) this.own[key] = mutation;
      }
      for (const [key, mutation] of Object.entries(this.trim(snapshot.entries))) {
        const before = merged[key];
        if (!before || mutation.at > before.mutation.at || mutation.at === before.mutation.at && snapshot.device > before.device) merged[key] = { mutation, device: snapshot.device };
      }
    }
    for (const [key, mutation] of Object.entries(this.trim(this.own))) {
      const before = merged[key];
      if (!before || mutation.at > before.mutation.at || mutation.at === before.mutation.at && this.device > before.device) merged[key] = { mutation, device: this.device };
    }
    const values = {};
    for (const [key, { mutation }] of Object.entries(merged)) if (!mutation.deleted) values[key] = mutation.value;
    const data = pruneLearning(inflateLearning(values), this.days, localDate(new Date(this.now())));
    const counts = {};
    for (const event of data.reviewEvents) counts[event.date] = (counts[event.date] || 0) + 1;
    for (const [day, total] of Object.entries(counts)) data.reviewLog[day] = Math.max(data.reviewLog[day] || 0, total);
    return { data, count };
  }
  async initialize(seed, days, required = false) {
    this.days = days === null ? null : retentionDays(days);
    const hasMarker = await this.checkMarker(required);
    const loaded = await this.aggregate();
    if (hasMarker && !loaded.count) throw new Error("Lexis learning snapshots are missing. Wait for synchronization.");
    if (hasMarker) {
      this.seen = flattenLearning(loaded.data);
      this.ready = true;
      return loaded.data;
    }
    const migrated = await this.save(pruneLearning(seed, this.days, localDate(new Date(this.now()))), days);
    await this.adapter.write(this.marker(), JSON.stringify({ schema: 1 }));
    this.ready = true;
    return migrated;
  }
  save(data, days) {
    this.days = days === null ? null : retentionDays(days);
    const current = flattenLearning(pruneLearning(data, this.days, localDate(new Date(this.now()))));
    for (const key of /* @__PURE__ */ new Set([...Object.keys(this.seen), ...Object.keys(current)])) {
      if (equal(this.seen[key], current[key])) continue;
      const value = current[key], old = this.seen[key];
      const event = value ?? old;
      const day = entryDay(key, event);
      this.pending[key] = { at: this.clock = Math.max(this.now(), this.clock + 1), ...value === void 0 ? { deleted: true } : { value: copy(value) }, ...day ? { day } : {} };
    }
    this.seen = current;
    const run = this.queue.catch(() => {
    }).then(async () => {
      if (this.ready) await this.checkMarker(true);
      await this.aggregate();
      const batch = { ...this.pending };
      Object.assign(this.own, batch);
      this.own = this.trim(this.own);
      await ensureDataDirectory(this.adapter, this.directory);
      const groups = /* @__PURE__ */ new Map([["state", {}]]);
      for (const [key, mutation] of Object.entries(this.own)) {
        const kind = mutation.day ? `day-${mutation.day}` : "state";
        if (!groups.has(kind)) groups.set(kind, {});
        groups.get(kind)[key] = mutation;
      }
      for (const [kind, entries] of groups) {
        const path = this.path(kind), text = JSON.stringify({ schema: 1, device: this.device, entries });
        if (this.cache.get(path)?.text === text) continue;
        if (await this.adapter.exists(path)) await this.adapter.process(path, () => text);
        else await this.adapter.write(path, text);
        if (await this.adapter.read(path) !== text) throw new Error("Lexis learning data verification failed");
        this.cache.delete(path);
      }
      for (const [key, mutation] of Object.entries(batch)) if (this.pending[key] === mutation) delete this.pending[key];
      return (await this.aggregate()).data;
    });
    this.queue = run;
    return run;
  }
  /** Incorporate synced records without swallowing edits made during an awaited write. */
  rebase(current, before, merged) {
    const values = flattenLearning(current), expected = flattenLearning(before), remote = flattenLearning(merged);
    for (const key of /* @__PURE__ */ new Set([...Object.keys(expected), ...Object.keys(remote)])) {
      if (equal(values[key], expected[key])) {
        if (key in remote) values[key] = remote[key];
        else delete values[key];
      }
      if (equal(this.seen[key], expected[key])) {
        if (key in remote) this.seen[key] = copy(remote[key]);
        else delete this.seen[key];
      }
    }
    return inflateLearning(values);
  }
  async flush() {
    await this.queue;
  }
  async copyTo(target, created = /* @__PURE__ */ new Map()) {
    await this.flush();
    if (await this.adapter.exists(target.directory)) {
      const root = await this.adapter.list(target.directory);
      if (root.files.length || root.folders.length) throw new Error("Choose an empty destination for learning data.");
    }
    await ensureDataDirectory(this.adapter, target.directory);
    const files = (await this.adapter.list(this.directory)).files.filter((path) => FILE.test(path.split("/").pop() || "") || path === this.marker());
    for (const path of files) {
      const text = await this.adapter.read(path), destination = `${target.directory}/${path.split("/").pop()}`;
      created.set(destination, text);
      await this.adapter.write(destination, text);
      if (await this.adapter.read(destination) !== text) throw new Error("Learning data move verification failed");
    }
    return files;
  }
};

// src/plugin-data-storage.ts
function learningDevice(app) {
  let id = app.loadLocalStorage("lexis:encounter-device-id");
  if (!id || !/^[a-f0-9]{32}$/.test(id)) {
    id = crypto.randomUUID().replaceAll("-", "");
    app.saveLocalStorage("lexis:encounter-device-id", id);
  }
  const label = import_obsidian16.Platform.isIosApp ? "ios" : import_obsidian16.Platform.isAndroidApp ? "android" : import_obsidian16.Platform.isWin ? "windows" : import_obsidian16.Platform.isLinux ? "linux" : import_obsidian16.Platform.isMacOS ? "macos" : import_obsidian16.Platform.isMobile ? "mobile" : "desktop";
  return { id, label };
}
var PluginDataStorage = class {
  constructor(host) {
    this.host = host;
    this.config = "";
    this.queue = Promise.resolve();
    this.relocating = false;
    this.blockedReason = "";
    this.device = learningDevice(host.app);
  }
  async validateRoot(folder, empty = false) {
    const io = this.host.app.vault.adapter;
    if (!await io.exists(folder)) return;
    const root = await io.list(folder);
    if (root.files.some((path) => !path.endsWith("/.DS_Store") && (empty || !encounterSnapshotName(path))) || root.folders.some((path) => empty || path !== `${folder}/reviews`)) {
      throw new Error("Choose a dedicated Lexis data folder, not a notes folder or another plugin's folder.");
    }
  }
  retention() {
    return this.host.settings.reviewRetentionConfirmed ? this.host.settings.reviewEventsRetentionDays : null;
  }
  async initialize(legacy) {
    const s = this.host.settings;
    if (legacy.learningStorageVersion != null && legacy.learningStorageVersion !== 1) throw new Error("Unsupported Lexis data format. Update Lexis; do not downgrade.");
    const oldFolder = legacy.encounterFolder || `${this.host.app.vault.configDir}/plugins/${this.host.manifest.id}/encounters`;
    s.dataFolder = dataFolder(s.dataFolder || (oldFolder.split("/").some((part) => part.startsWith(".")) ? "" : oldFolder));
    await this.validateRoot(s.dataFolder);
    s.reviewEventsRetentionDays = retentionDays(s.reviewEventsRetentionDays);
    const seed = learningData(s);
    const hasLearning = legacy.learningStorageVersion === 1 || Object.values(seed).some((value) => value === true || !!value && typeof value === "object" && Object.keys(value).length > 0);
    s.reviewRetentionConfirmed = legacy.reviewRetentionConfirmed === true || !hasLearning;
    this.store = new LearningStore(this.host.app.vault.adapter, s.dataFolder, this.device.id, this.device.label);
    const loaded = await this.store.initialize(seed, this.retention(), legacy.learningStorageVersion === 1);
    Object.assign(s, loaded);
    let previous = null;
    if (oldFolder !== s.dataFolder && await this.host.app.vault.adapter.exists(oldFolder)) {
      previous = new EncounterStore(this.host.app.vault.adapter, oldFolder, this.device.id, this.device.label);
      await previous.copyTo(s.dataFolder);
    }
    s.learningStorageVersion = 1;
    await this.save();
    if (previous) await previous.removeCopiedTo(s.dataFolder);
    delete s.encounterFolder;
  }
  save() {
    if (this.blockedReason) return Promise.reject(new Error(this.blockedReason));
    if (this.relocating) return Promise.reject(new Error("Learning data is moving. Try again when it finishes."));
    const before = learningData(this.host.settings);
    const persisted = this.store.save(before, this.retention());
    void persisted.catch(() => {
    });
    const task = this.queue.catch(() => {
    }).then(async () => {
      const merged = await persisted;
      Object.assign(this.host.settings, this.store.rebase(learningData(this.host.settings), before, merged));
      const config = settingsOnly(this.host.settings), serialized = JSON.stringify(config);
      if (serialized !== this.config) {
        await this.host.saveData(config);
        this.config = serialized;
      }
    });
    this.queue = task;
    return task;
  }
  async flush() {
    await this.queue;
    await this.store.flush();
  }
  async refresh() {
    if (!this.relocating) await this.save();
  }
  isDataPath(path) {
    return this.store?.isDataPath(path) || false;
  }
  invalidate(path) {
    this.store.invalidate(path);
  }
  async externalSettingsChanged() {
    const incoming = await this.host.loadData();
    if (!record(incoming)) throw new Error("Invalid synced Lexis configuration; current learning data was retained.");
    if (incoming.learningStorageVersion == null) {
      this.config = "";
      await this.save();
      new import_obsidian16.Notice(this.host.settings.language === "en" ? "Lexis: an old client wrote legacy data. Update Lexis on all devices." : "Lexis\uFF1A\u68C0\u6D4B\u5230\u65E7\u7248\u8BBE\u5907\u5199\u56DE\u6570\u636E\uFF0C\u5DF2\u5FFD\u7565\u65E7\u5B66\u4E60\u8BB0\u5F55\u3002\u8BF7\u7EDF\u4E00\u66F4\u65B0\u5404\u8BBE\u5907\u3002");
      return;
    }
    if (incoming.learningStorageVersion !== 1) {
      this.blockedReason = "Lexis data requires a newer plugin. Update Lexis on this device.";
      throw new Error(this.blockedReason);
    }
    if (dataFolder(typeof incoming.dataFolder === "string" ? incoming.dataFolder : "") !== this.store.folder) {
      this.blockedReason = this.host.settings.language === "en" ? "Lexis data folder changed on another device. Finish syncing, then reload Lexis." : "Lexis \u6570\u636E\u76EE\u5F55\u5DF2\u5728\u53E6\u4E00\u53F0\u8BBE\u5907\u66F4\u6539\u3002\u8BF7\u7B49\u5F85\u540C\u6B65\u5B8C\u6210\uFF0C\u518D\u91CD\u65B0\u52A0\u8F7D\u63D2\u4EF6\u3002";
      throw new Error(this.blockedReason);
    }
    Object.assign(this.host.settings, settingsOnly(incoming));
    this.host.settings.reviewEventsRetentionDays = retentionDays(incoming.reviewEventsRetentionDays);
    this.config = LEARNING_FIELDS.some((field) => field in incoming) ? "" : JSON.stringify(settingsOnly(this.host.settings));
    await this.save();
  }
  async move(folder, encounters) {
    const target = dataFolder(folder);
    if (target === this.store.folder) return encounters;
    if (target.startsWith(`${this.store.folder}/`) || this.store.folder.startsWith(`${target}/`)) throw new Error("The old and new data folders cannot contain each other.");
    await this.save();
    await this.flush();
    this.relocating = true;
    const io = this.host.app.vault.adapter, previous = this.store, oldFolder = this.host.settings.dataFolder;
    const created = /* @__PURE__ */ new Map();
    try {
      await this.validateRoot(target, true);
      const next = new LearningStore(io, target, this.device.id, this.device.label);
      await encounters.copyTo(target, created);
      const copied = await previous.copyTo(next, created);
      await next.initialize(learningData(this.host.settings), this.retention(), true);
      this.host.settings.dataFolder = target;
      await this.host.saveData(settingsOnly(this.host.settings));
      this.config = JSON.stringify(settingsOnly(this.host.settings));
      this.store = next;
      try {
        for (const path of copied) {
          const destination = `${next.directory}/${path.split("/").pop()}`;
          if (await io.read(path) !== await io.read(destination)) throw new Error("Source changed during the move; retained for safety");
          await io.remove(path);
        }
        if (!(await io.list(previous.directory)).files.length && !(await io.list(previous.directory)).folders.length) await io.rmdir(previous.directory, false);
        await encounters.removeCopiedTo(target);
      } catch (error) {
        new import_obsidian16.Notice(`Lexis: data moved, but source cleanup is incomplete: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
      return new EncounterStore(io, target, this.device.id, this.device.label);
    } catch (error) {
      if (this.store === previous) {
        this.host.settings.dataFolder = oldFolder;
        for (const [path, text] of created) if (await io.exists(path) && await io.read(path) === text) await io.remove(path);
        for (const folder2 of [`${target}/reviews`, target]) if (await io.exists(folder2)) {
          const root = await io.list(folder2);
          if (!root.files.length && !root.folders.length) await io.rmdir(folder2, false);
        }
      }
      throw error;
    } finally {
      this.relocating = false;
    }
  }
};

// src/bridge-server.ts
function createBridgeServer({ Notice: Notice20, Platform: Platform5 }) {
  class LexisBridge2 {
    constructor(plugin) {
      this.plugin = plugin;
      this.server = null;
    }
    get running() {
      return !!this.server;
    }
    generateToken() {
      const bytes = new Uint8Array(16);
      (window.crypto || crypto).getRandomValues(bytes);
      return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    start() {
      if (this.server) return;
      if (!Platform5.isDesktopApp) {
        new Notice20(this.plugin.t("notice.desktopBridge"));
        return;
      }
      let http = null;
      try {
        http = window.require?.("http") ?? null;
      } catch {
      }
      if (!http) {
        new Notice20(this.plugin.t("notice.desktopBridge"));
        return;
      }
      const port = Number(this.plugin.settings.bridgePort) || LEXIS_BRIDGE_DEFAULT_PORT;
      const server = http.createServer((req, res) => {
        this.handle(req, res).catch((err) => {
          try {
            res.writeHead(500);
            res.end(err instanceof Error ? err.message : "Internal error");
          } catch {
          }
        });
      });
      server.on("error", (err) => {
        this.server = null;
        const reason = err.code === "EADDRINUSE" ? this.plugin.t("notice.portBusy", { port }) : err.code || err.message;
        new Notice20(this.plugin.t("notice.bridgeFailed", { reason }));
      });
      server.listen(port, "127.0.0.1", () => this.plugin.updateStatusBar());
      this.server = server;
    }
    stop() {
      if (!this.server) return;
      this.server.close();
      this.server = null;
      this.plugin.updateStatusBar();
    }
    restart() {
      this.stop();
      if (this.plugin.settings.bridgeEnabled) this.start();
    }
    cors() {
      return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "X-Lexis-Token, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"
      };
    }
    async handle(req, res) {
      const plugin = this.plugin;
      const cors = this.cors();
      const send = (code, obj) => {
        res.writeHead(code, Object.assign({ "Content-Type": "application/json; charset=utf-8" }, cors));
        res.end(JSON.stringify(obj));
      };
      if (req.method === "OPTIONS") {
        res.writeHead(204, cors);
        res.end();
        return;
      }
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const path = url.pathname.replace(/\/+$/, "") || "/";
      if (path === "/ping" || path === "/") return send(200, { ok: true, app: "lexis", version: plugin.manifest.version, vault: plugin.app.vault.getName() });
      const tokenHeader = req.headers["x-lexis-token"];
      const token = (Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader) || url.searchParams.get("token") || "";
      if (!plugin.settings.bridgeToken || token !== plugin.settings.bridgeToken) return send(401, { ok: false, error: "bad-token" });
      if (path === "/words" && req.method === "GET") return send(200, plugin.bridgeWordList());
      if (path === "/word" && req.method === "GET") return send(200, await plugin.bridgeWordDetail(url.searchParams.get("key") || url.searchParams.get("w")));
      if (path === "/occurrences" && req.method === "GET") return send(200, await plugin.bridgeWordOccurrences(url.searchParams.get("key")));
      if (path === "/word" && req.method === "DELETE") return send(200, await plugin.bridgeDeleteWord(url.searchParams.get("key") || ""));
      if (path === "/add" && req.method === "POST") return send(200, await plugin.bridgeAddWord(await this.readBody(req)));
      if (path === "/tag" && req.method === "POST") return send(200, await plugin.bridgeTagWord(await this.readBody(req)));
      if (path === "/note" && req.method === "POST") return send(200, await plugin.bridgeAnnotate(await this.readBody(req)));
      if (path === "/move" && req.method === "POST") return send(200, await plugin.bridgeMoveWord(await this.readBody(req)));
      if (path === "/encounter" && req.method === "POST") return send(200, await plugin.bridgeEncounter(await this.readBody(req)));
      return send(404, { ok: false, error: "not-found" });
    }
    readBody(req) {
      return new Promise((resolve) => {
        let data = "";
        req.on("data", (chunk) => {
          data += typeof chunk === "string" ? chunk : chunk instanceof Uint8Array ? new TextDecoder().decode(chunk) : "";
          if (data.length > 1e6) req.destroy();
        });
        req.on("end", () => {
          try {
            const parsed = JSON.parse(data || "{}");
            resolve(parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {});
          } catch {
            resolve({});
          }
        });
        req.on("error", () => resolve({}));
      });
    }
  }
  return LexisBridge2;
}

// src/bridge-render.ts
function containsMath(markdown) {
  return markdown.includes("$$") || markdown.includes("\\(") || markdown.includes("\\[") || /\$[^\s$]/.test(markdown);
}
async function withTimeout(promise, milliseconds) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timer = window.setTimeout(() => reject(new Error("render-timeout")), milliseconds);
      })
    ]);
  } finally {
    if (timer !== void 0) window.clearTimeout(timer);
  }
}

// src/relation-sections.ts
function relationHeading(text) {
  return text.replace(/\s+#+\s*$/, "").replace(/^\s*\d+(?:\.\d+)*[.)、]?\s+/, "").trim().normalize("NFC");
}
function parseSectionLinks(raw) {
  const clean = raw.replace(/```[\s\S]*?```/g, "").replace(/^---\n[\s\S]*?\n---/, "");
  const out = [];
  let current = "\u76F8\u5173";
  const linkRe = /\[\[([^\]\n]+)\]\]/g;
  for (const line of clean.split("\n")) {
    const heading = /^#{1,6}[ \t]+(.+?)\s*$/.exec(line);
    if (heading) {
      current = relationHeading(heading[1]) || "\u76F8\u5173";
      continue;
    }
    linkRe.lastIndex = 0;
    let match = linkRe.exec(line);
    while (match) {
      const target = match[1].split(/[|#]/, 1)[0].trim();
      if (target && line[match.index - 1] !== "!") out.push({ type: current, target });
      match = linkRe.exec(line);
    }
  }
  return out;
}
function relationTypes(out, inc) {
  const names = /* @__PURE__ */ new Set([...Object.keys(out), ...Object.keys(inc)]);
  names.delete("\u76F8\u5173");
  return [...names, ...out["\u76F8\u5173"]?.length || inc["\u76F8\u5173"]?.length ? ["\u76F8\u5173"] : []];
}
function relationBlockSource(source, sectionText) {
  const info = /(?:^|\r?\n)[ \t]*(?:`{3,}|~{3,})[ \t]*rel(?:[ \t]+([^\r\n]+))?[ \t]*(?=\r?\n|$)/i.exec(sectionText || "")?.[1];
  return `rel ${relationHeading(info || source.trim().split(/\r?\n/, 1)[0] || "")}`.trim();
}
function replaceLexisFences(markdown, replace) {
  return markdown.replace(
    /(^|\n)(`{3,})[ \t]*(lexis|rel)\b([^\r\n]*)\r?\n([\s\S]*?)\2[ \t]*(?=\r?\n|$)/gi,
    (_all, prefix, _fence, language, info, body) => {
      const source = language.toLowerCase() === "rel" ? relationBlockSource(body, `\`\`\`rel${info}`) : `${info}
${body}`.trim();
      return `${prefix}${replace(source)}`;
    }
  );
}

// src/inline-category.ts
function inlineClassificationHeading(entry, level) {
  const headings = entry.headingPath || [];
  if (!headings.length) return null;
  if (!Number.isInteger(level) || level < 1 || level > 6) return headings[headings.length - 1] || null;
  return [...headings].reverse().find((heading) => heading.level <= level) || headings[0] || null;
}
function inlineClassificationPath(entry, level) {
  const headings = entry.headingPath || [];
  const category = inlineClassificationHeading(entry, level);
  if (!category) return [];
  const start = headings.indexOf(category);
  return start < 0 ? [category] : headings.slice(start);
}
function inlineCategoryLabel(entry) {
  return (entry.categoryPath?.length ? entry.categoryPath : [entry.category || ""]).filter(Boolean).join(" / ");
}

// src/bridge-math-css.ts
var FONT_URL = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)/g;
async function loadMathFont(url) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 3e3);
  try {
    const response = await window.fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error("math-font-unavailable");
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 32768) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
    }
    const mime = new URL(url).pathname.endsWith(".woff2") ? "woff2" : "woff";
    return `data:font/${mime};base64,${btoa(binary)}`;
  } finally {
    window.clearTimeout(timer);
  }
}
function createMathCssExporter(load = loadMathFont) {
  const fonts = /* @__PURE__ */ new Map();
  return async (document2) => {
    const style = document2.getElementById("MJX-CHTML-styles");
    const rules = Array.from(style?.sheet?.cssRules || [], (rule) => rule.cssText);
    const replacements = /* @__PURE__ */ new Map();
    const base = new URL(document2.baseURI);
    const sources2 = new Set(rules.filter((rule) => rule.startsWith("@font-face")).flatMap((rule) => [...rule.matchAll(FONT_URL)].map((match) => match[1] || match[2] || match[3])));
    await Promise.all([...sources2].map(async (source) => {
      const url = new URL(source, base);
      if (url.protocol !== base.protocol || url.host !== base.host || !/^\/lib\/mathjax\/.*\.woff2?$/.test(url.pathname)) return;
      const key = url.href;
      const pending = fonts.get(key) ?? load(key);
      fonts.set(key, pending);
      try {
        replacements.set(source, await pending);
      } catch {
        fonts.delete(key);
      }
    }));
    return rules.map((rule) => rule.startsWith("@font-face") ? rule.replace(FONT_URL, (match, quoted, singleQuoted, bare) => {
      const data = replacements.get(quoted || singleQuoted || bare);
      return data ? `url("${data}")` : match;
    }) : rule).join("\n");
  };
}

// src/bridge-render-api.ts
function textValue(value) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
}
function createBridgeRenderApi({ TFile: TFile10, Component: Component8, recentReviewDates: recentReviewDates2, escapeRe: escapeRe2, renderLexisMarkdown: renderLexisMarkdown2, finishRenderMath: finishRenderMath2, escHtml, vaultImageDataUrl: vaultImageDataUrl2 }) {
  const exportMathCss = createMathCssExporter();
  class BridgeRenderApi {
    extractSection(md, name) {
      const names = (Array.isArray(name) ? name : [name]).map(escapeRe2).join("|");
      const re = new RegExp("^#{1,6}[ \\t].*(?:" + names + ").*$", "m");
      const m = re.exec(md || "");
      if (!m) return "";
      const rest = md.slice(m.index + m[0].length);
      const next = /^#{1,6}[ \t]/m.exec(rest);
      return (next ? rest.slice(0, next.index) : rest).trim();
    }
    cardHeading(entry) {
      if (entry.inline) {
        const title2 = entry.canonical || entry.display;
        const alias = entry.isAlias && entry.display.toLowerCase() !== title2.toLowerCase() ? entry.display : "";
        return { title: title2, subtitle: [alias, inlineCategoryLabel(entry)].filter(Boolean).join(" \xB7 ") };
      }
      const title = entry.file?.basename || entry.display;
      const subtitle = entry.isAlias && entry.display.toLowerCase() !== title.toLowerCase() ? entry.display : "";
      return { title, subtitle };
    }
    bridgeMathCss() {
      return exportMathCss(this.app.workspace.containerEl.ownerDocument);
    }
    async bridgeWordDetail(key) {
      const k = this.resolveIndexKey(textValue(key));
      const e = this.index.get(k);
      if (!e) return { ok: false, error: "not-found" };
      if (e.inline) {
        const heading2 = this.cardHeading(e);
        const html2 = await this.renderInlineEntryHtml(e);
        return {
          ok: true,
          word: e.display,
          base: e.canonical || e.display,
          file: e.file.path,
          vault: this.app.vault.getName(),
          inline: true,
          category: e.category,
          markdown: e.annotation || "*(\u65E0\u6279\u6CE8)*",
          title: heading2.title,
          subtitle: heading2.subtitle,
          colorName: e.colorToken || "",
          html: html2,
          mathCss: html2.includes("<mjx-container") ? await this.bridgeMathCss() : ""
        };
      }
      this.recordEncounter(e.file, "hover");
      void this.hoverFeedback(e.file);
      let body = "";
      try {
        const raw = await this.app.vault.cachedRead(e.file);
        body = raw.replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/```dataviewjs[\s\S]*?```/g, "").replace(/```dataview[\s\S]*?```/g, "").replace(/```(?:lexis|rel)\b[\s\S]*?```/g, "");
        body = this.compactSections(body.trim());
      } catch {
      }
      const html = await this.bridgeFullHtml(e.file, e.display);
      const heading = this.cardHeading(e);
      return {
        ok: true,
        word: e.display,
        base: e.file && e.file.basename,
        file: e.file && e.file.path,
        vault: this.app.vault.getName(),
        title: heading.title,
        subtitle: heading.subtitle,
        colorName: e.colorToken || "",
        alias: !!e.isAlias,
        tags: [...e.tags || []],
        meaning: this.extractSection(body, ["\u610F\u601D", "\u610F\u4E49"]),
        markdown: body,
        html,
        mathCss: html.includes("<mjx-container") ? await this.bridgeMathCss() : ""
      };
    }
    async bridgeWordOccurrences(key) {
      const k = this.resolveIndexKey(textValue(key));
      const entry = this.index.get(k);
      if (!entry || entry.inline) return { ok: false, error: "not-found" };
      const html = await this.lexisBlockHtml(entry.file, entry.display, "occ");
      return { ok: true, html, mathCss: html.includes("<mjx-container") ? await this.bridgeMathCss() : "" };
    }
    bridgeOlink(path, base) {
      const vault = encodeURIComponent(this.app.vault.getName());
      return `<a class="lexis-web-ilink" href="obsidian://open?vault=${vault}&file=${encodeURIComponent(path)}">${escHtml(base)}</a>`;
    }
    occurrenceLabel(occurrence) {
      if (!occurrence?.file) return "";
      return occurrence.page ? `${occurrence.file.basename} p.${occurrence.page}` : occurrence.file.basename;
    }
    occurrenceLinkPath(occurrence) {
      if (!occurrence?.file) return "";
      return occurrence.file.path + (occurrence.page ? `#page=${occurrence.page}` : "");
    }
    async renderInlineEntryHtml(entry) {
      const div = createDiv();
      const comp = new Component8();
      comp.load();
      try {
        await this.renderInlineEntryInto(div, entry, comp);
        await this.bridgePostProcess(div, entry.file.path);
        return div.innerHTML;
      } finally {
        comp.unload();
      }
    }
    async bridgePostProcess(div, sourcePath2) {
      const vault = encodeURIComponent(this.app.vault.getName());
      div.querySelectorAll("a.internal-link").forEach((a) => {
        const lp = a.getAttribute("data-href") || a.getAttribute("href") || a.textContent || "";
        a.setAttribute("href", `obsidian://open?vault=${vault}&file=${encodeURIComponent(lp)}`);
        a.removeAttribute("data-href");
        a.classList.add("lexis-web-ilink");
      });
      for (const img of div.querySelectorAll("img")) {
        const src = img.getAttribute("src") || "";
        if (/^(?:https?:|data:)/i.test(src)) continue;
        const embed = img.closest(".internal-embed");
        const linkPath = embed?.getAttribute("src") || embed?.getAttribute("data-href") || img.getAttribute("alt") || "";
        try {
          const dataUrl = await vaultImageDataUrl2(this.app, linkPath, sourcePath2);
          if (dataUrl) img.setAttribute("src", dataUrl);
          else img.remove();
        } catch {
          img.remove();
        }
      }
      div.querySelectorAll(".internal-embed").forEach((embed) => {
        if (embed.querySelector("img")) embed.replaceWith(...Array.from(embed.childNodes));
        else embed.remove();
      });
      div.querySelectorAll("iframe").forEach((frame) => frame.remove());
    }
    // 整篇笔记渲成 HTML,且 ```lexis 块在原位渲染(保持文档顺序),供浏览器扩展悬浮卡用
    async bridgeFullHtml(file, display) {
      let raw = "";
      try {
        raw = await this.app.vault.cachedRead(file);
      } catch {
        return "";
      }
      raw = raw.replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/```dataviewjs[\s\S]*?```/g, "").replace(/```dataview[\s\S]*?```/g, "");
      const blocks = [];
      raw = replaceLexisFences(raw, (source) => {
        const i = blocks.length;
        blocks.push(source);
        return `

@@LEXIS${i}@@

`;
      });
      const div = createDiv();
      const comp = new Component8();
      comp.load();
      try {
        await withTimeout(renderLexisMarkdown2(this.app, raw, div, file.path || "", comp), 5e3);
      } catch {
      }
      for (let i = 0; i < blocks.length; i++) {
        const marker = `@@LEXIS${i}@@`;
        const host = Array.from(div.querySelectorAll("p, div, li")).find((element) => element.textContent.trim() === marker);
        const html = await this.lexisBlockHtml(file, display, blocks[i], true);
        if (!host) continue;
        if (!html || !html.trim()) {
          const prev = host.previousElementSibling;
          host.remove();
          if (prev && /^H[1-6]$/.test(prev.tagName)) {
            const nx = prev.nextElementSibling;
            if (!nx || /^H[1-6]$/.test(nx.tagName)) prev.remove();
          }
        } else {
          const parsed = new DOMParser().parseFromString(html, "text/html");
          const nodes = Array.from(parsed.body.childNodes, (node) => div.ownerDocument.importNode(node, true));
          host.replaceWith(...nodes);
        }
      }
      (function compact(container) {
        const hs = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
        const rm = [];
        for (let i = 0; i < hs.length; i++) {
          const h = hs[i], next = hs[i + 1] || null;
          let sib = h.nextElementSibling, ok = false;
          while (sib && sib !== next) {
            const nextSib = sib.nextElementSibling;
            if ((sib.textContent || "").trim()) {
              ok = true;
              break;
            }
            if (sib.querySelector(".lexis-web-sec,.lexis-web-rel,.lexis-web-occ,.lexis-web-curve,.lexis-web-dim")) {
              ok = true;
              break;
            }
            sib = nextSib;
          }
          if (!ok) rm.push(h);
        }
        for (const h of rm) h.remove();
      })(div);
      if (containsMath(raw)) {
        try {
          await withTimeout(finishRenderMath2(), 3e3);
        } catch {
        }
      }
      await this.bridgePostProcess(div, file.path);
      const out = div.innerHTML;
      comp.unload();
      return out;
    }
    // 单个 ```lexis 块 → HTML(对应 renderLexisBlock 的各模式,带 obsidian:// 链接)
    async lexisBlockHtml(file, display, src, deferOccurrences = false) {
      const parts = (src || "").trim().split(/\s+/).filter(Boolean);
      const m = (parts[0] || "").toLowerCase();
      const typeArg = parts.slice(1).join(" ");
      const olink = (path, basename) => this.bridgeOlink(path, basename);
      const relMap = (bags, types) => {
        const map = /* @__PURE__ */ new Map();
        for (const type of types) for (const relation of bags[type] || []) map.set(relation.path, relation.basename);
        return map;
      };
      if (m === "derived" || m === "\u6D3E\u751F") {
        const resolved = this.app.metadataCache.resolvedLinks || {};
        const map = /* @__PURE__ */ new Map();
        for (const s in resolved) if (this.inVocabFolder(s) && resolved[s] && resolved[s][file.path]) {
          const sf = this.app.vault.getAbstractFileByPath(s);
          if (sf instanceof TFile10) map.set(s, sf.basename);
        }
        let h = `<div class="lexis-web-sec">${escHtml(this.t("relation.backlinks", { count: map.size }))}</div>`;
        if (!map.size) return h + `<div class="lexis-web-occ lexis-web-dim">${escHtml(this.t("relation.noBacklinks"))}</div>`;
        return h + `<div class="lexis-web-rel">` + [...map].map(([p, b]) => olink(p, b)).join("") + `</div>`;
      }
      const showCurve = m === "" || m === "curve" || m === "all";
      const showRelated = m === "" || m === "refs" || m === "ref" || m === "rel" || m === "related" || m === "all";
      const showOcc = (m === "" || m === "refs" || m === "ref" || m === "occ" || m === "all") && this.settings.showOccurrences;
      let html = "";
      if (showCurve) {
        const card = this.readCard(file);
        const svg = this.buildCurveSVG(card);
        if (svg) {
          const due = card.due ? ` \xB7 \u4E0B\u6B21\u590D\u4E60 ${String(card.due).slice(0, 10)}` : "";
          const dates = recentReviewDates2(card);
          const history = dates.length ? `<div class="lexis-curve-history">${escHtml(this.t("curve.recentReviews", { dates: dates.map((date) => date.slice(5)).join(" \xB7 ") }))}</div>` : "";
          const view = buildCurveViewHtml(card, this.buildCurveSVG.bind(this), this.t.bind(this));
          html += `<div class="lexis-web-sec">\u{1F9E0} \u8BB0\u5FC6\u66F2\u7EBF\uFF08\u590D\u4E60\u65E5\u671F \xD7 \u4FDD\u7559\u7387${due}\uFF09</div><div class="lexis-web-curve">${history}${view}</div>`;
        }
      }
      if (showRelated && this.settings.showRelated) {
        try {
          const { out, inc } = await this.findTypedRelations(file);
          if ((m === "rel" || m === "related") && typeArg) {
            const type = relationHeading(typeArg);
            const types = type === "\u8FA8\u6790" ? ["\u8FA8\u6790", "\u76F8\u5173"] : [type];
            const outPaths = /* @__PURE__ */ new Set();
            for (const t of types) for (const r of out[t] || []) outPaths.add(r.path);
            const map = /* @__PURE__ */ new Map();
            for (const t of types) for (const r of inc[t] || []) if (!outPaths.has(r.path)) map.set(r.path, r.basename);
            if (map.size) html += `<div class="lexis-web-rel">` + [...map].map(([p, b]) => olink(p, b)).join("") + `</div>`;
          } else {
            for (const t of relationTypes(out, inc)) {
              const map = relMap(out, [t]);
              for (const [p, b] of relMap(inc, [t])) map.set(p, b);
              if (!map.size) continue;
              html += `<div class="lexis-web-sec">\u{1F517} ${escHtml(t)}</div><div class="lexis-web-rel">` + [...map].map(([p, b]) => olink(p, b)).join("") + `</div>`;
            }
          }
        } catch {
        }
      }
      if (showOcc && deferOccurrences) html += `<div class="lexis-web-occ-pending">\u51FA\u5904\u52A0\u8F7D\u4E2D\u2026</div>`;
      else if (showOcc) {
        try {
          const list = await this.findOccurrences(display);
          const curated = await this.getCuratedSourcePaths(file);
          const fresh = list.filter((o) => !curated.has(o.file.basename.toLowerCase()));
          html += `<div class="lexis-web-sec">\u{1F4CD} \u51FA\u73B0\u8FC7\u7684\u5730\u65B9 (${fresh.length})</div>`;
          if (!fresh.length) html += `<div class="lexis-web-occ lexis-web-dim">(\u6CA1\u6709\u672A\u6536\u85CF\u7684\u65B0\u51FA\u5904)</div>`;
          else {
            const comp = new Component8();
            comp.load();
            const rendered = [];
            for (const o of fresh) {
              const d = createDiv();
              await renderLexisMarkdown2(this.app, o.sentence, d, file.path, comp);
              rendered.push({ d, o });
            }
            try {
              await withTimeout(finishRenderMath2(), 3e3);
            } catch {
            }
            for (const { d, o } of rendered) {
              this.boldMatchesInPlace(d, display);
              html += `<div class="lexis-web-occ">${d.innerHTML} <span class="lexis-web-occ-src">\u2014 ${olink(this.occurrenceLinkPath(o), this.occurrenceLabel(o))}</span></div>`;
            }
            comp.unload();
          }
        } catch {
        }
      }
      return html;
    }
  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(BridgeRenderApi.prototype);
  return descriptors;
}

// src/occurrence-text.ts
var HASH_TOKENS = new RegExp([
  String.raw`\\[\s\S]`,
  "(`+)(?!`)[\\s\\S]*?\\1(?!`)",
  String.raw`(~{3,})[^\n]*\n[\s\S]*?\2`,
  String.raw`\$\$[\s\S]*?\$\$|\$(?:\\[\s\S]|[^$\\\n])+\$`,
  String.raw`\[\[[^\n]*?\]\]`,
  String.raw`\]\((?:\\[\s\S]|[^()\\]|\([^()]*\))*\)`,
  String.raw`(?:https?|obsidian):\/\/[^\s<>]+`,
  "#"
].join("|"), "g");
function escapeOccurrenceHashes(text) {
  return text.replace(HASH_TOKENS, (token) => token === "#" ? "\\#" : token);
}

// src/occurrence-render.ts
function renderOccurrenceContent(template, values) {
  return template.split("\n").map((line) => line.replace(/\{\{(\w+)\}\}/g, (_token, key, offset) => {
    const raw = values[key];
    if (!(key in values)) return _token;
    let value = typeof raw === "string" || typeof raw === "number" ? String(raw) : "";
    if (key === "sentence") value = escapeOccurrenceHashes(value);
    if (key === "sourceSuffix" && value && typeof values.sentence === "string" && /\n\$\$\s*$/.test(values.sentence)) value = `

${value.trimStart()}`;
    const before = line.slice(0, offset);
    const quote = /^(\s*(?:>\s*)+)/.exec(before)?.[1];
    if (quote) value = value.replaceAll("\n", `
${quote}`);
    return value;
  })).join("\n");
}

// src/bridge-api.ts
function errorMessage(error) {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "Unknown error";
}
function textValue2(value) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
}
function createBridgeApi({ DEFAULT_SETTINGS: DEFAULT_SETTINGS2, TFile: TFile10, Component: Component8, todayStr, recentReviewDates: recentReviewDates2, escapeRe: escapeRe2, renderLexisMarkdown: renderLexisMarkdown2, finishRenderMath: finishRenderMath2, escHtml, saveAnnotationImage: saveAnnotationImage2, vaultImageDataUrl: vaultImageDataUrl2 }) {
  class BridgeApi {
    // ---------- 词典桥接动作（由 Obsidian 卡片与外部阅读端共同调用） ----------
    // 网页划词/加出处:词不在库→新建,在库→加出处。来源是网址链接 [标题](url),不是 [[内链]]
    async bridgeAddWord(payload) {
      const word = textValue2(payload.word).trim();
      if (!word) return { ok: false, error: "empty-word" };
      const name = this.sanitizeName(word);
      if (!name) return { ok: false, error: "bad-name" };
      const alias = textValue2(payload.alias).trim();
      const sentence = textValue2(payload.sentence).trim();
      const url = textValue2(payload.url).trim();
      const title = (textValue2(payload.title) || url).trim().replaceAll("[", "").replaceAll("]", "");
      const source = url ? `[${title || url}](${url})` : "";
      const occurrence = sentence || source ? { word, sentence, source, date: todayStr() } : null;
      const dupKey = sentence || url;
      const reqFolder = this.normalizeFolder(textValue2(payload.folder));
      const folder = reqFolder && this.dictFolders().includes(reqFolder) ? reqFolder : this.primaryVocabFolder();
      const targetPath = (folder ? folder + "/" : "") + name + ".md";
      const memberships = (file) => (resolveDictionaries(this.app, this.settings.dicts || [], (item) => this.getTags(item), [file]).byFile.get(file.path) || []).map(dictionaryId);
      let existing = this.app.vault.getAbstractFileByPath(targetPath);
      if (!(existing instanceof TFile10)) {
        const hit = this.index.get(this.resolveIndexKey(word));
        if (hit && hit.file instanceof TFile10) existing = hit.file;
      }
      const injectAlias = (data) => {
        const re = /^---\r?\n([\s\S]*?)\r?\n---/;
        const fm = re.exec(data);
        const line = `  - ${alias}
`;
        if (!fm) return `---
aliases:
${line}---
` + data;
        const body = fm[1];
        if (body.includes(alias)) return data;
        if (/^aliases:/m.test(body)) {
          return data.slice(0, fm.index) + `---
` + body.replace(/^(aliases:.*)$/m, `$1
${line}`) + `
---` + data.slice(fm.index + fm[0].length);
        }
        return data.slice(0, fm.index) + `---
${body}
aliases:
${line}---` + data.slice(fm.index + fm[0].length);
      };
      try {
        if (existing instanceof TFile10) {
          if (alias) {
            if (this.app.vault.process) await this.app.vault.process(existing, injectAlias);
            else await this.app.vault.modify(existing, injectAlias(await this.app.vault.cachedRead(existing)));
            await this.rebuildIndex(false);
            if (alias) {
              const ak = alias.toLowerCase();
              if (!this.index.has(ak)) this.index.set(ak, { display: alias, file: existing, isAlias: true, tags: this.getTags(existing) });
            }
          }
          if (occurrence) {
            const cur = await this.app.vault.cachedRead(existing);
            if (dupKey && (cur.includes(dupKey) || cur.includes(escapeOccurrenceHashes(dupKey)))) return { ok: true, created: false, dup: true, word, file: existing.path, dictionaries: memberships(existing) };
            const apply = (data) => this.insertOccurrence(data, occurrence);
            if (this.app.vault.process) await this.app.vault.process(existing, apply);
            else await this.app.vault.modify(existing, apply(cur));
            this.recordEncounter(existing, "add");
          }
          if (!alias) this.scheduleRebuild();
          return { ok: true, created: false, word: existing.basename, alias: alias || void 0, file: existing.path, dictionaries: memberships(existing) };
        }
        await this.ensureFolder(folder);
        const tpl = await this.templateForFolder(folder);
        const content = this.renderTemplate(tpl != null ? tpl : this.minimalSkeleton(), { word, date: todayStr() });
        const file = await this.createEntryFile(targetPath, folder, content, (templateContent) => {
          let next = templateContent;
          if (occurrence) next = this.insertOccurrence(next, occurrence);
          if (alias) next = injectAlias(next);
          return next;
        });
        this.recordEncounter(file, "add");
        await this.rebuildIndex(false);
        if (alias) {
          const ak = alias.toLowerCase();
          if (!this.index.has(ak)) this.index.set(ak, { display: alias, file, isAlias: true, tags: /* @__PURE__ */ new Set() });
        }
        return { ok: true, created: true, word, alias: alias || void 0, file: file.path, dictionaries: memberships(file) };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    }
    async bridgeDeleteWord(key) {
      const k = this.resolveIndexKey(textValue2(key));
      const e = this.index.get(k);
      if (!e || !e.file) return { ok: false, error: "not-found" };
      if (e.inline) return { ok: false, error: "inline-readonly" };
      try {
        await this.app.fileManager.trashFile(e.file);
        await this.rebuildIndex(false);
        return { ok: true, deleted: e.display, file: e.file.path };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    }
    async bridgeTagWord(payload) {
      const key = this.resolveIndexKey(textValue2(payload.key));
      const tag = textValue2(payload.tag).toLowerCase().replace(/^#/, "");
      const action = textValue2(payload.action) || "add";
      if (!tag) return { ok: false, error: "empty-tag" };
      const e = this.index.get(key);
      if (!e || !e.file) return { ok: false, error: "not-found" };
      if (e.inline) return { ok: false, error: "inline-readonly" };
      try {
        let resultTags = [];
        await this.app.fileManager.processFrontMatter(e.file, (fm) => {
          const rawTags = fm.tags ?? fm.tag ?? [];
          const values = typeof rawTags === "string" ? rawTags.split(/[,，;；\s]+/) : Array.isArray(rawTags) ? rawTags : [rawTags];
          let tags = values.map((value) => textValue2(value).trim().replace(/^#/, "").toLowerCase()).filter((value) => value && value !== "null");
          if (action === "remove") tags = tags.filter((value) => value !== tag);
          else if (!tags.includes(tag)) tags.push(tag);
          tags = [...new Set(tags)];
          if (tags.length) fm.tags = tags;
          else delete fm.tags;
          if (fm.tag != null) delete fm.tag;
          resultTags = tags;
        });
        await this.rebuildIndex(false);
        const tagSet = new Set(resultTags);
        for (const entry of this.index.values()) {
          if (entry.file === e.file) entry.tags = tagSet;
        }
        return { ok: true, key, tag, action: action === "remove" ? "removed" : "added", tags: resultTags };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    }
    // 把 line 追加到指定标题小节末尾(在子标题/代码块之前);没这个标题就在文末新建。
    // headingLine:完整标题行(级别 + 文字,比如 "#### 出处",可以是用户在设置里自定义的任意级别/文字);
    // legacyNames:识别时额外认的旧标题文字(不认级别,只认文字,比如"例句"改名"出处"前的老笔记),但新建小节永远用 headingLine。
    insertUnderHeading(data, headingLine, line, legacyNames = []) {
      const headingText = headingLine.replace(/^#{1,6}[ \t]*/, "").trim() || headingLine;
      const names = [headingText, ...legacyNames || []].map(escapeRe2).join("|");
      const re = new RegExp("(^|\\n)#{1,6}[ \\t]*(?:" + names + ")[^\\n]*\\n");
      const m = re.exec(data);
      if (!m) return this.appendBeforeLexisBlock(data, `${headingLine}
${line}`);
      const headEnd = m.index + m[0].length;
      const after = data.slice(headEnd);
      let stop = after.search(/\n#{1,6}[ \t]|\n```/);
      if (stop < 0) stop = after.length;
      let section = after.slice(0, stop).replace(/[ \t]*\n+$/, "");
      const tail = after.slice(stop);
      const sep = section ? "\n" : "";
      const newSection = section + sep + line + "\n";
      const tailFixed = /^\n*```/.test(tail) ? "\n" + tail.replace(/^\n+/, "") : tail;
      return data.slice(0, headEnd) + newSection + tailFixed;
    }
    appendBeforeLexisBlock(data, blockText) {
      const content = String(data || "");
      const match = /(^|\n)```(?:lexis|rel)\b/.exec(content);
      const at = match ? match.index + match[1].length : -1;
      if (at >= 0) {
        const before2 = content.slice(0, at).replace(/\s*$/, "");
        const after = content.slice(at).replace(/^\n+/, "");
        return before2 + (before2 ? "\n\n" : "") + blockText.trim() + "\n\n" + after;
      }
      const before = content.replace(/\s*$/, "");
      return before + (before ? "\n\n" : "") + blockText.trim() + "\n";
    }
    renderTemplate(template, vars) {
      let out = String(template || "");
      for (const [key, value] of Object.entries(vars || {})) {
        out = out.replace(new RegExp(`\\{\\{${escapeRe2(key)}\\}\\}`, "g"), textValue2(value));
      }
      return out;
    }
    occurrenceTemplateDefinition() {
      const raw = String(this.settings.occurrenceTemplate ?? DEFAULT_SETTINGS2.occurrenceTemplate).trim();
      if (!raw) return null;
      const lines = raw.replace(/\r\n/g, "\n").split("\n");
      const first = (lines[0] || "").trim();
      if (/^#{1,6}[ \t]+/.test(first)) return { heading: first, item: lines.slice(1).join("\n").trim() };
      return { heading: "", item: raw };
    }
    occurrenceHeadingText() {
      const heading = this.occurrenceTemplateDefinition()?.heading || "";
      return heading.replace(/^#{1,6}[ \t]*/, "").trim();
    }
    occurrenceSentenceFromSection(section) {
      const item = this.occurrenceTemplateDefinition()?.item || "";
      const templateLine = item.split("\n").find((line2) => line2.includes("{{sentence}}"));
      if (templateLine) {
        const tokenRe = /\{\{(word|sentence|source|sourceSuffix|date)\}\}/g;
        const source = "(?:\\[\\[[^\\]]+\\]\\]|\\[[^\\]]+\\]\\([^\\n]+\\)|[^\\n]*?)";
        const sourceSuffix = `(?:\\s*\u2014\u2014\\s*${source})?`;
        let pattern = "^\\s*", last = 0;
        const literal = (text) => escapeRe2(text).replace(/\s+/g, "\\s+");
        let match = tokenRe.exec(templateLine);
        while (match) {
          pattern += literal(templateLine.slice(last, match.index));
          if (match[1] === "sentence") pattern += "(.+?)";
          else if (match[1] === "source") pattern += source;
          else if (match[1] === "sourceSuffix") pattern += sourceSuffix;
          else pattern += "[^\\n]*?";
          last = match.index + match[0].length;
          match = tokenRe.exec(templateLine);
        }
        pattern += literal(templateLine.slice(last)) + "\\s*$";
        const re = new RegExp(pattern);
        for (const line2 of String(section || "").split("\n")) {
          const found = re.exec(line2);
          if (found?.[1]) return found[1].trim();
        }
      }
      const line = String(section || "").split("\n").map((s) => s.trim()).find((s) => s.startsWith(">"));
      if (!line) return "";
      return line.replace(/^>\s*/, "").replace(/\s*——\s*(?:\[\[[^\]]*\]\]|\[[^\]]*\]\([^\n]+\))\s*$/, "").trim();
    }
    insertOccurrence(data, vars) {
      const definition = this.occurrenceTemplateDefinition();
      if (!definition) return data;
      const source = textValue2(vars.source);
      const values = { ...vars, source, sourceSuffix: source ? ` \u2014\u2014 ${source}` : "" };
      const item = renderOccurrenceContent(definition.item, values).trim();
      if (!item) return data;
      if (definition.heading) {
        const heading = this.renderTemplate(definition.heading, values).trim();
        return this.insertUnderHeading(data, heading, item, ["\u4F8B\u53E5", "\u51FA\u5904"]);
      }
      return this.appendBeforeLexisBlock(data, item);
    }
    // 批注小节标题行:设置里可以填完整一行(级别+文字,比如 "## 引用"),也可以只填文字(默认按 #### 级别);留空用默认 "#### 批注"
    annotationHeadingLine() {
      const v = (this.settings.annotationHeading || "").trim();
      if (!v) return "#### \u6279\u6CE8";
      return /^#{1,6}[ \t]/.test(v) ? v : `#### ${v}`;
    }
    annotationHeadingText() {
      return this.annotationHeadingLine().replace(/^#{1,6}[ \t]*/, "").trim() || "\u6279\u6CE8";
    }
    // 批注写进词条笔记；Obsidian 卡片还可同时把图片保存为仓库附件并插入引用。
    async bridgeAnnotate(payload) {
      const text = textValue2(payload.note ?? payload.text).trim().replace(/\r?\n+/g, " ");
      const image = typeof File !== "undefined" && payload.image instanceof File && payload.image.type.startsWith("image/") ? payload.image : null;
      if (!text && !image) return { ok: false, error: "empty-note" };
      const key = this.resolveIndexKey(textValue2(payload.key ?? payload.word).trim());
      const e = this.index.get(key);
      if (!e || !e.file) return { ok: false, error: "not-found" };
      if (e.inline) return { ok: false, error: "inline-readonly" };
      try {
        const imageFile = image ? await saveAnnotationImage2(this.app, this.settings, e.file, image) : null;
        const content = [text ? `> ${text}` : "", imageFile ? `![[${imageFile.path}]]` : ""].filter(Boolean).join("\n\n");
        const apply = (data) => this.insertUnderHeading(data, this.annotationHeadingLine(), content, ["\u6279\u6CE8"]);
        if (this.app.vault.process) await this.app.vault.process(e.file, apply);
        else await this.app.vault.modify(e.file, apply(await this.app.vault.cachedRead(e.file)));
        this._occCache.clear();
        return { ok: true, key, file: e.file.path };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    }
    // 切掉开头的 frontmatter,返回 { fm, body }
    splitFrontmatter(content) {
      const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(content || "");
      if (m && m.index === 0) return { fm: m[0], body: (content || "").slice(m[0].length) };
      return { fm: "", body: content || "" };
    }
    // 判断一篇词笔记是不是"只有模板骨架"(去掉 frontmatter / 代码块 / 批注小节 / 所有标题后没有任何文字)
    // 用于:移动到别的词典时,空骨架可以安全地重套新词典模板,有正文则只挪文件不动内容。
    isScaffoldOnly(content) {
      let s = this.splitFrontmatter(content).body;
      s = s.replace(/```[\s\S]*?```/g, "");
      const annotNames = [this.annotationHeadingText(), "\u6279\u6CE8"].map(escapeRe2).join("|");
      s = s.replace(new RegExp("(^|\\n)#{1,6}[ \\t][^\\n]*(?:" + annotNames + ")[\\s\\S]*?(?=\\n#{1,6}[ \\t]|$)", "g"), "\n");
      s = s.replace(/^#{1,6}[ \t].*$/gm, "");
      return !/[A-Za-z0-9一-鿿]/.test(s);
    }
    // 把已有词移动到另一个词典文件夹。默认只移动文件(正文/批注/出处全保留);
    // 但若该词笔记是空骨架且目标词典有自己的模板,则顺手重套模板——并把批注小节内容迁移过去。
    async bridgeMoveWord(payload) {
      const key = this.resolveIndexKey(textValue2(payload.key ?? payload.word).trim());
      const folder = this.normalizeFolder(textValue2(payload.folder));
      const e = this.index.get(key);
      if (!e || !e.file) return { ok: false, error: "not-found" };
      if (e.inline) return { ok: false, error: "inline-readonly" };
      if (folder && !this.dictFolders().includes(folder)) return { ok: false, error: "bad-folder" };
      const target = (folder ? folder + "/" : "") + e.file.name;
      if (target === e.file.path) return { ok: true, key, file: e.file.path, moved: false };
      if (this.app.vault.getAbstractFileByPath(target)) return { ok: false, error: "exists" };
      try {
        let oldContent = "";
        try {
          oldContent = await this.app.vault.cachedRead(e.file);
        } catch {
        }
        const tplRaw = await this.templateForFolder(folder);
        const retemplate = tplRaw != null && tplRaw.trim() !== "" && this.isScaffoldOnly(oldContent);
        await this.ensureFolder(folder);
        await this.app.fileManager.renameFile(e.file, target);
        let reTemplated = false;
        if (retemplate) {
          const annot = this.extractSection(oldContent, [this.annotationHeadingText(), "\u6279\u6CE8"]).replace(/```[\s\S]*?```/g, "").trim();
          const oldFm = this.splitFrontmatter(oldContent).fm;
          const filled = tplRaw.replace(/\{\{word\}\}/g, e.display).replace(/\{\{date\}\}/g, todayStr());
          const tplBody = this.splitFrontmatter(filled).body.replace(/^\s+/, "");
          let nc = (oldFm ? oldFm.replace(/\s*$/, "\n") : "") + (oldFm ? "\n" : "") + tplBody;
          if (annot) nc = this.insertUnderHeading(nc, this.annotationHeadingLine(), annot, ["\u6279\u6CE8"]);
          const fileNow = this.app.vault.getAbstractFileByPath(target);
          if (fileNow instanceof TFile10) {
            if (this.app.vault.process) await this.app.vault.process(fileNow, () => nc);
            else await this.app.vault.modify(fileNow, nc);
            reTemplated = true;
          }
        }
        await this.rebuildIndex(false);
        return { ok: true, key, file: target, folder, moved: true, reTemplated };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    }
    // 旧扩展仍会上报高亮扫描结果；保留端点兼容，但扫描不再算主动相遇。
    async bridgeEncounter(payload) {
      return { ok: true, recorded: 0, ignored: Array.isArray(payload.keys) ? payload.keys.length : 0 };
    }
    bridgeWordList() {
      const words = [];
      const dictionaries = this.settings.dicts || [];
      const membership = resolveDictionaries(this.app, dictionaries, (file) => this.getTags(file), [...new Map([...this.index.values()].map((entry) => [entry.file.path, entry.file])).values()]);
      for (const [key, e] of this.index) {
        if (e.archived || e.retired) continue;
        words.push({ key, word: e.display, alias: !!e.isAlias, inline: !!e.inline, tags: [...e.tags || []], file: e.file && e.file.path, dictionaries: (membership.byFile.get(e.file.path) || []).map(dictionaryId), color: this.colorForEntry(e), opacity: this.highlightAlphaForEntry(e), visible: this.highlightVisibleForEntry(e, false), wstyle: this.styleKindForEntry(e) });
      }
      return {
        ok: true,
        version: this.manifest.version,
        count: words.length,
        words,
        styleConfig: {
          tagRules: this.settings.tagRules || [],
          highlightColor: this.effectiveHighlightColor(),
          highlightOpacity: this.settings.highlightOpacity,
          highlightStyle: this.settings.highlightStyle,
          excludeTags: this.parseTags(this.settings.excludeTags),
          dicts: this.dictFolders(),
          collections: dictionaries.map((row) => ({ id: dictionaryId(row), name: dictionaryName(row), folder: row.folder })),
          dictColors: this.dictColorMap(),
          popoverWidth: this.settings.popoverWidth,
          popoverMaxHeight: this.settings.popoverMaxHeight,
          popoverFontSize: this.settings.popoverFontSize,
          hoverDelayMs: this.settings.hoverDelayMs,
          selectionPillOrder: this.settings.selectionPillOrder
        }
      };
    }
    // name 可以是单个标题文字,也可以是一个数组(比如当前自定义名字 + 旧的默认名字,任一命中都算)
  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(BridgeApi.prototype);
  return {
    ...createBridgeRenderApi({ TFile: TFile10, Component: Component8, recentReviewDates: recentReviewDates2, escapeRe: escapeRe2, renderLexisMarkdown: renderLexisMarkdown2, finishRenderMath: finishRenderMath2, escHtml, vaultImageDataUrl: vaultImageDataUrl2 }),
    ...descriptors
  };
}

// src/highlight-engine.ts
var import_view = require("@codemirror/view");
var import_state = require("@codemirror/state");
var obsidian2 = __toESM(require("obsidian"));

// src/reading-highlights.ts
function refreshReadingHighlightsInPlace(root, applyHighlights) {
  const parents = /* @__PURE__ */ new Set();
  const highlights = Array.from(root.querySelectorAll(".lexis-hl"));
  for (const highlight of highlights) {
    if (highlight.closest(".lexis-popover")) continue;
    const parent = highlight.parentNode;
    if (parent) parents.add(parent);
    highlight.replaceWith(...Array.from(highlight.childNodes));
  }
  for (const parent of parents) parent.normalize();
  applyHighlights(root);
}

// src/entry-colors.ts
var HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
function resolveEntryColorToken(token, entries) {
  const value = String(token || "").trim();
  if (!value) return "";
  if (HEX_COLOR.test(value)) return value;
  const key = value.toLowerCase();
  const entry = (entries || []).find((item) => String(item?.name || "").split(/\s*\/\s*/).some((name) => name.trim().toLowerCase() === key));
  const color = String(entry?.color || "").trim();
  return HEX_COLOR.test(color) ? color : "";
}
function entryColorLabel(token) {
  const value = String(token || "").trim();
  return value && !HEX_COLOR.test(value) ? value : "";
}
function collectInlineColorTokenUsages(entries) {
  const usages = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    const token = String(entry.colorToken || "").trim();
    const key = token.normalize("NFKC").toLowerCase();
    if (!key) continue;
    const usage = usages.get(key) || { token, count: 0, files: /* @__PURE__ */ new Set() };
    usage.count++;
    if (entry.file?.path) usage.files.add(entry.file.path);
    usages.set(key, usage);
  }
  return [...usages.values()].map(({ token, count, files }) => ({ token, count, fileCount: files.size }));
}
function unconfiguredEntryColorUsages(usages, entries) {
  return usages.filter(({ token }) => !resolveEntryColorToken(token, entries));
}

// src/highlight-index.ts
function createHighlightIndex({ Notice: Notice20, boundedSource: boundedSource2, compactMixedScriptSpacing: compactMixedScriptSpacing2, todayStr }) {
  class HighlightIndex {
    normalizeFolder(path) {
      return (path || "").trim().replace(/^\/+|\/+$/g, "");
    }
    inVocabFolder(path) {
      return this.vocabPaths ? this.vocabPaths.has(path) : false;
    }
    selfKeysFor(path) {
      return this._selfKeysByPath && this._selfKeysByPath.get(path) || null;
    }
    maybeRebuild(file, oldPath) {
      const path = file?.path || "";
      this._occCache.clear();
      if (file?.extension === "pdf") this.occurrenceSearch?.invalidatePdf(file.path);
      if (oldPath && /\.pdf$/i.test(oldPath)) this.occurrenceSearch?.invalidatePdf(oldPath);
      if (oldPath && path) {
        let reviewChanged = false;
        if (this.settings.reviewHistory?.[oldPath]) {
          this.settings.reviewHistory[path] = this.settings.reviewHistory[oldPath];
          delete this.settings.reviewHistory[oldPath];
          reviewChanged = true;
        }
        if (this.settings.reviewAddedAt?.[oldPath]) {
          this.settings.reviewAddedAt[path] = this.settings.reviewAddedAt[oldPath];
          delete this.settings.reviewAddedAt[oldPath];
          reviewChanged = true;
        }
        for (const event of this.settings.reviewEvents || []) {
          if (event.filePath === oldPath) {
            event.filePath = path;
            reviewChanged = true;
          }
          if (event.type === "note" && event.memberKeys.includes(oldPath)) {
            event.memberKeys = event.memberKeys.map((key) => key === oldPath ? path : key);
            event.label = file?.basename || event.label;
            reviewChanged = true;
          }
        }
        if (reviewChanged) void this.saveSettings();
      }
      const sources2 = (this.settings.dicts || []).flatMap(dictionarySources);
      const tags = file?.extension === "md" && sources2.some((source) => source.kind === "tag") ? this.getTags(file) : void 0;
      const matchesSource = file?.extension === "md" && sources2.some((source) => source.kind === "links" || dictionarySourceScore(source, path, tags) > 0);
      if (matchesSource || this.vocabPaths.has(path) || this.isInlineSourceFile(file) || this.inlineSourcePaths?.has(path) || oldPath && (this.inFolderScope(oldPath) || this.vocabPaths.has(oldPath) || this.inlineSourcePaths?.has(oldPath))) this.scheduleRebuild();
    }
    scheduleRebuild() {
      window.clearTimeout(this._rebuildTimer);
      this._rebuildTimer = window.setTimeout(() => {
        void this.rebuildIndex(false);
      }, 800);
    }
    inlineDelimiter() {
      return String(this.settings.inlineEntryDelimiter || DEFAULT_INLINE_ENTRY_DELIMITER).trim() || DEFAULT_INLINE_ENTRY_DELIMITER;
    }
    inlineAliasDelimiter() {
      return String(this.settings.inlineAliasDelimiter || "/").trim() || "/";
    }
    isInlineSourceFile(file) {
      if (!this.settings.inlineEntriesEnabled || !file?.path) return false;
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
      const marker = frontmatter["lexis-inline"];
      if (marker === true || marker === 1 || typeof marker === "string" && /^(true|yes|1)$/i.test(marker)) return true;
      return this.getTags(file).has("lexis-inline");
    }
    parseInlineEntries(content, file) {
      return parseInlineEntries(content, file, {
        entryDelimiter: this.inlineDelimiter(),
        aliasDelimiter: this.inlineAliasDelimiter()
      });
    }
    extractAliases(file) {
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (!frontmatter) return [];
      const extra = (this.settings.aliasSources || "").split(/[,，\s]+/).map((value) => value.trim()).filter(Boolean);
      const sources2 = [.../* @__PURE__ */ new Set(["aliases", "alias", ...extra])];
      const seen = /* @__PURE__ */ new Set();
      const results = [];
      for (const source of sources2) {
        const raw = frontmatter[source];
        if (raw == null || raw === "") continue;
        const values = typeof raw === "string" ? raw.split(/[,，;；]/) : Array.isArray(raw) ? raw : [raw];
        for (const value of values) {
          const alias = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
          if (!alias || alias.toLowerCase() === "null" || seen.has(alias)) continue;
          seen.add(alias);
          results.push(alias);
        }
      }
      return results;
    }
    getTags(file) {
      const cache = this.app.metadataCache.getFileCache(file);
      const tags = /* @__PURE__ */ new Set();
      const frontmatter = cache?.frontmatter;
      if (frontmatter) {
        const raw = frontmatter.tags ?? frontmatter.tag ?? [];
        const values = typeof raw === "string" ? raw.split(/[,，;；\s]+/) : Array.isArray(raw) ? raw : [raw];
        for (const value of values) {
          const tag = typeof value === "string" || typeof value === "number" ? String(value).trim().replace(/^#/, "") : "";
          if (tag && tag.toLowerCase() !== "null") tags.add(tag.toLowerCase());
        }
      }
      if (cache?.tags) for (const item of cache.tags) {
        const tag = (item.tag || "").replace(/^#/, "");
        if (tag) tags.add(tag.toLowerCase());
      }
      return tags;
    }
    async rebuildIndex(notify) {
      this._dictionaryScopes = null;
      const buildId = (this._indexBuildId || 0) + 1;
      this._indexBuildId = buildId;
      const index = /* @__PURE__ */ new Map();
      const selfKeysByPath = /* @__PURE__ */ new Map();
      const today = todayStr();
      let words = 0, aliases = 0, inlineEntries = 0, due = 0;
      const categoryOccurrences = /* @__PURE__ */ new Map();
      const scopes = this.dictionaryScopes();
      const files = scopes.files.filter((file) => scopes.byFile.has(file.path));
      const vocabPaths = new Set(files.map((file) => file.path));
      for (const file of files) {
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
        const tags = this.getTags(file);
        const display = file.basename;
        const key = display.toLowerCase();
        const own = /* @__PURE__ */ new Set([key]);
        const archived = frontmatter["lexis-status"] === "archived";
        const retired = frontmatter["lexis-status"] === "retired";
        const pinned = !!frontmatter["lexis-pinned"];
        const colorToken = typeof frontmatter["lexis-color"] === "string" ? frontmatter["lexis-color"].trim() : "";
        const stability = Number(frontmatter["lexis-s"]);
        const cardS = frontmatter["lexis-s"] == null || isNaN(stability) ? null : stability;
        if (!index.has(key)) {
          index.set(key, { display, file, isAlias: false, tags, archived, retired, pinned, cardS, colorToken });
          words++;
        }
        if (this.settings.includeAliases) for (const alias of this.extractAliases(file)) {
          const aliasKey = alias.toLowerCase();
          own.add(aliasKey);
          if (!index.has(aliasKey)) {
            index.set(aliasKey, { display: alias, file, isAlias: true, tags, archived, retired, pinned, cardS, colorToken });
            aliases++;
          }
        }
        selfKeysByPath.set(file.path, own);
        if (!archived && !retired && (frontmatter["lexis-s"] == null || !frontmatter["lexis-due"] || String(frontmatter["lexis-due"]).slice(0, 10) <= today)) due++;
      }
      const inlineFiles = scopes.files.filter((file) => this.isInlineSourceFile(file));
      const inlineSourcePaths = new Set(inlineFiles.map((file) => file.path));
      const parsed = await Promise.all(inlineFiles.map(async (file) => {
        try {
          return this.parseInlineEntries(await this.app.vault.cachedRead(file), file);
        } catch {
          return [];
        }
      }));
      if (buildId !== this._indexBuildId) return this.stats;
      this.inlineColorTokenUsages = collectInlineColorTokenUsages(parsed.flat());
      for (const entries of parsed) {
        const own = /* @__PURE__ */ new Set();
        for (const entry of entries) {
          const key = entry.display.toLowerCase();
          own.add(key);
          const heading = inlineClassificationHeading(entry, this.settings.inlineHeadingLevel);
          entry.category = heading?.name || "";
          entry.categoryPath = inlineClassificationPath(entry, this.settings.inlineHeadingLevel).map(({ name }) => name);
          if (heading) {
            const id = `${entry.file.path}::${heading.name}`;
            const node = categoryOccurrences.get(id) || { id, name: heading.name, level: heading.level, line: heading.line, file: entry.file, count: 0 };
            node.count++;
            categoryOccurrences.set(id, node);
          }
          if (!index.has(key)) {
            index.set(key, entry);
            inlineEntries++;
          }
          if (this.settings.includeAliases) for (const alias of entry.aliases || []) {
            const aliasKey = alias.toLowerCase();
            own.add(aliasKey);
            if (!index.has(aliasKey)) {
              index.set(aliasKey, { ...entry, display: alias, canonical: entry.display, isAlias: true });
              aliases++;
            }
          }
        }
        if (entries.length) selfKeysByPath.set(entries[0].file.path, own);
      }
      this.vocabPaths = vocabPaths;
      this.inlineSourcePaths = inlineSourcePaths;
      const legacyRank = new Map((this.settings.inlineCategoryOrder || []).map((name, rank) => [name, rank]));
      this.inlineCategoryOccurrences = [...categoryOccurrences.values()].sort((left, right) => {
        const leftRank = legacyRank.get(left.name) ?? Number.MAX_SAFE_INTEGER;
        const rightRank = legacyRank.get(right.name) ?? Number.MAX_SAFE_INTEGER;
        return leftRank - rightRank || left.name.localeCompare(right.name) || left.file.path.localeCompare(right.file.path) || left.line - right.line;
      });
      const categories = /* @__PURE__ */ new Map();
      for (const node of this.inlineCategoryOccurrences) {
        const current = categories.get(node.name) || { name: node.name, count: 0 };
        current.count += node.count;
        categories.set(node.name, current);
      }
      this.inlineCategories = [...categories.values()].sort((left, right) => {
        const leftRank = legacyRank.get(left.name) ?? Number.MAX_SAFE_INTEGER;
        const rightRank = legacyRank.get(right.name) ?? Number.MAX_SAFE_INTEGER;
        return leftRank - rightRank || left.name.localeCompare(right.name);
      });
      this.index = index;
      this._selfKeysByPath = selfKeysByPath;
      this.stats = { words, aliases, inlineEntries, due };
      this._occCache.clear();
      this.buildMatcher();
      this.updateStatusBar();
      this.reviewDashboard?.refresh();
      this.marginNoteExport?.schedule();
      this.refreshAllViews();
      if (notify) {
        const aliasPart = this.settings.includeAliases ? this.t("notice.aliasCount", { count: aliases }) : "";
        const folderCount = this.dictFolders().length;
        const tagCount = this.vocabTagSet().size;
        const scope = [folderCount ? this.t("notice.scopeFolders", { count: folderCount }) : "", tagCount ? this.t("notice.scopeTags", { count: tagCount }) : ""].filter(Boolean).join(" + ") || this.t("notice.scopeEmpty");
        const inlinePart = inlineEntries ? this.t("notice.inlineCount", { count: inlineEntries }) : "";
        new Notice20(this.t("notice.indexBuilt", { scope, words, aliases: aliasPart, inline: inlinePart }));
      }
      return this.stats;
    }
    buildMatcher() {
      let keys = [...this.index.keys()].filter((key) => key.length >= 2 || [...key].some((character) => (character.codePointAt(0) || 0) > 127));
      const excluded = this.excludeTagSet();
      if (excluded.size) keys = keys.filter((key) => {
        const entry = this.index.get(key);
        return !(entry?.tags && [...entry.tags].some((tag) => excluded.has(tag)));
      });
      keys = keys.filter((key) => !this.index.get(key)?.retired);
      keys.sort((left, right) => right.length - left.length);
      this._indexKeysByCompact = /* @__PURE__ */ new Map();
      for (const key of this.index.keys()) {
        this._indexKeysByCompact.set(key, key);
        const compact = compactMixedScriptSpacing2(key);
        if (!this._indexKeysByCompact.has(compact)) this._indexKeysByCompact.set(compact, key);
      }
      this._matchKeysByCompact = /* @__PURE__ */ new Map();
      for (const key of keys) {
        this._matchKeysByCompact.set(key, key);
        const compact = compactMixedScriptSpacing2(key);
        if (!this._matchKeysByCompact.has(compact)) this._matchKeysByCompact.set(compact, key);
      }
      this._pattern = keys.length ? keys.map(boundedSource2).join("|") : null;
    }
    resolveIndexKey(value) {
      const key = String(value || "").toLowerCase();
      return this._indexKeysByCompact.get(key) || this._indexKeysByCompact.get(compactMixedScriptSpacing2(key)) || key;
    }
    resolveMatchKey(value) {
      const key = String(value || "").toLowerCase();
      return this._matchKeysByCompact.get(key) || this._matchKeysByCompact.get(compactMixedScriptSpacing2(key)) || key;
    }
    updateStatusBar() {
      this.statusBar?.update();
    }
  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(HighlightIndex.prototype);
  return descriptors;
}

// src/highlight-mode.ts
function automaticHighlighting(settings) {
  return settings.enableHighlight && settings.highlightMode !== "manual";
}
function manualLookupEnabled(settings) {
  return settings.enableHighlight && settings.highlightMode === "manual";
}

// src/highlight-engine.ts
function createHighlightEngine({ Notice: Notice20, boundedSource: boundedSource2, compactMixedScriptSpacing: compactMixedScriptSpacing2, todayStr }) {
  class HighlightEngine {
    // ---------- 着色 ----------
    applyAlpha(color, alpha) {
      if (alpha == null || alpha >= 1) return color;
      const pct = Math.max(0, Math.min(100, Math.round(alpha * 100)));
      return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
    }
    // 高亮渐隐:强度是 FSRS stability 的单调函数,不用 retrievability——后者哪怕不复习也会随日历时间天天变,
    // 会导致高亮"没事自己变淡/变浓",违反"复习几轮才肉眼可见变淡"的直觉;stability 只在真实复习事件后才变,足够稳定。
    // progress = s/(s+K) 是个 0→1、单调递增、边际递减的曲线(K 是"淡一半"所需的天数,先内置常量,不开放成设置——
    // 用户只需要控制"最淡到哪"这个下限,具体曲线形状留给实现)。从未复习过的新词(cardS 为 null)固定全强度。
    fadeAlphaFor(entry) {
      if (!this.settings.fadeByMemory) return 1;
      const s = entry && entry.cardS;
      if (s == null) return 1;
      const K = 20;
      const progress = s / (s + K);
      const floor = Math.max(0, Math.min(1, this.settings.fadeFloor ?? 0.25));
      return 1 - progress * (1 - floor);
    }
    inlineClassificationMode() {
      return this.settings.inlineClassificationMode === "file" ? "file" : "heading";
    }
    inlineSourceKey(entry) {
      return entry.file.path && entry.category ? `${entry.file.path}::${entry.category}` : "";
    }
    // 标题模式使用选定层级的祖先标题；文件模式让同一来源文件共享外观。
    inlineCategoryColor(entry) {
      if (!entry?.inline) return "";
      const fileMode = this.inlineClassificationMode() === "file";
      const colors = fileMode ? this.settings.inlineFileColors || {} : this.settings.inlineCategoryColors || {};
      const key = fileMode ? entry.file?.path : entry.category;
      return String(colors[key || ""] || "").trim();
    }
    // 分类透明度使用和颜色相同的分类键；没有单独配置时沿用全局透明度。
    inlineCategoryOpacity(entry) {
      if (!entry?.inline) return null;
      const fileMode = this.inlineClassificationMode() === "file";
      const opacities = fileMode ? this.settings.inlineFileOpacity || {} : this.settings.inlineCategoryOpacity || {};
      const key = fileMode ? entry.file?.path : entry.category;
      if (!key || !Object.prototype.hasOwnProperty.call(opacities, key)) return null;
      const opacity = Number(opacities[key]);
      return isNaN(opacity) ? null : Math.max(0.1, Math.min(1, opacity));
    }
    highlightVisibleForEntry(entry, includeDictionary = true) {
      if (includeDictionary && this.dictSettingForFile(entry?.file)?.highlight === false) return false;
      if (!entry?.inline) return true;
      const fileMode = this.inlineClassificationMode() === "file";
      const parents = fileMode ? this.settings.inlineFileHighlight || {} : this.settings.inlineCategoryHighlight || {};
      const parentKey = fileMode ? entry.file?.path : entry.category;
      if (parentKey && parents[parentKey] === false) return false;
      const sourceKey2 = this.inlineSourceKey(entry);
      return !sourceKey2 || (this.settings.inlineSourceHighlight || {})[sourceKey2] !== false;
    }
    highlightAlphaForEntry(entry) {
      let opacity = this.settings.highlightOpacity ?? 1;
      const dictionaryOpacity = this.dictOpacityForFile(entry?.file);
      if (dictionaryOpacity != null) opacity = dictionaryOpacity;
      if (entry?.tags && this.settings.tagRules?.length) {
        const rule = this.settings.tagRules.find((item) => item.tag && entry.tags.has(item.tag.toLowerCase()));
        if (rule?.opacity != null && !isNaN(Number(rule.opacity))) opacity = Number(rule.opacity);
      }
      const inlineOpacity = this.inlineCategoryOpacity(entry);
      if (inlineOpacity != null) opacity = inlineOpacity;
      return Math.max(0.1, Math.min(1, opacity)) * this.fadeAlphaFor(entry);
    }
    // 某文件所属词典(文件夹)的专属色;子文件夹归父词典,取最长匹配。网页和 ob 内共用同一份 dictColorMap
    dictColorForFile(file) {
      const row = this.dictSettingForFile(file);
      return row && String(row.color || "").trim() || null;
    }
    dictOpacityForFile(file) {
      const row = this.dictSettingForFile(file);
      if (!row || row.opacity == null || isNaN(Number(row.opacity))) return null;
      return Math.max(0.1, Math.min(1, Number(row.opacity)));
    }
    dictSettingForFile(file) {
      return file?.path ? preferredDictionary(this.dictionaryScopes(), file.path) : null;
    }
    inlineStyleForEntry(entry, opts = {}) {
      let color = opts?.external ? this.effectiveHighlightColor() : this.settings.highlightColor || "var(--text-accent)";
      let styleKind = this.settings.highlightStyle || "wavy";
      const dc = this.dictColorForFile(entry && entry.file);
      if (dc) color = dc;
      if (entry?.tags && this.settings.tagRules?.length) {
        const rule = this.settings.tagRules.find((r) => r.tag && entry.tags.has(r.tag.toLowerCase()));
        if (rule) {
          if (rule.color) color = rule.color;
          if (rule.style) styleKind = rule.style;
        }
      }
      const inlineColor = this.inlineCategoryColor(entry);
      if (inlineColor) color = inlineColor;
      const entryColor = resolveEntryColorToken(entry?.colorToken, this.settings.entryColors);
      if (entryColor) color = entryColor;
      if (opts && opts.pdf) return "--lexis-hl-underline:none;--lexis-hl-background:transparent;";
      if (entry && entry.archived) return "--lexis-hl-underline:none;--lexis-hl-background:transparent;";
      if (entry && !this.highlightVisibleForEntry(entry)) return "--lexis-hl-underline:none;--lexis-hl-background:transparent;";
      const alpha = entry ? this.highlightAlphaForEntry(entry) : this.settings.highlightOpacity;
      const c = this.applyAlpha(color, alpha);
      if (styleKind === "background") return `--lexis-hl-underline:none;--lexis-hl-background:${c};border-radius:3px;padding:0 1px;`;
      if (styleKind === "underline") {
        return `--lexis-hl-underline:linear-gradient(${c},${c});--lexis-hl-underline-size:100% 1px;--lexis-hl-background:transparent;`;
      }
      const wave = `linear-gradient(135deg,transparent 40%,${c} 40%,${c} 60%,transparent 60%),linear-gradient(45deg,transparent 40%,${c} 40%,${c} 60%,transparent 60%)`;
      return `--lexis-hl-underline:${wave};--lexis-hl-underline-size:4px 2px,4px 2px;--lexis-hl-background:transparent;`;
    }
    currentHighlightPage(leaf = this.app.workspace.getMostRecentLeaf()) {
      if (!leaf) return null;
      const view = leaf.view;
      const type = view?.getViewType?.();
      if (type !== "markdown" && type !== "pdf") return null;
      const container = view.containerEl;
      if (!container?.classList) return null;
      const file = view.file || this.app.workspace.getActiveFile();
      return { leaf, container, key: `${type}:${file?.path || ""}` };
    }
    pageHighlightState(page) {
      let state = this._pageHighlightState.get(page.leaf);
      if (!state || state.key !== page.key) {
        state = { key: page.key, hidden: false };
        this._pageHighlightState.set(page.leaf, state);
      }
      return state;
    }
    applyPageHighlightState(page, state) {
      page.container.classList.toggle("lexis-page-highlights-hidden", state.hidden);
    }
    syncActivePageHighlightState(leaf = this.app.workspace.getMostRecentLeaf()) {
      const page = this.currentHighlightPage(leaf);
      if (!page) {
        leaf?.view?.containerEl?.classList?.remove("lexis-page-highlights-hidden");
        return;
      }
      this.applyPageHighlightState(page, this.pageHighlightState(page));
    }
    toggleCurrentPageHighlights(page = this.currentHighlightPage()) {
      if (!page) return;
      const state = this.pageHighlightState(page);
      state.hidden = !state.hidden;
      this.applyPageHighlightState(page, state);
      if (state.hidden) this.removePopover();
      new Notice20(this.t(state.hidden ? "notice.highlightsHidden" : "notice.highlightsShown"));
    }
    refreshAllViews() {
      this.app.workspace.iterateAllLeaves((leaf) => {
        const view = leaf.view;
        const pm = view.previewMode;
        if (pm?.containerEl) {
          refreshReadingHighlightsInPlace(pm.containerEl, (root) => {
            if (!automaticHighlighting(this.settings) || !this._pattern || !this.index.size) return;
            const selfKeys = this.selfKeysFor(view.file?.path || "");
            const sections = Array.from(root.querySelectorAll(".markdown-preview-section"));
            const targets2 = sections.length ? sections.filter((section) => !section.parentElement?.closest(".markdown-preview-section")) : [root];
            for (const target of targets2) {
              this.wrapMatchesInElement(target, "code,pre,a,.lexis-hl,.lexis-popover,.math,.tag", {}, selfKeys);
            }
          });
        }
        const cm = view.editor?.cm;
        if (this._liveRefreshEffect && cm?.dispatch) {
          try {
            cm.dispatch({ effects: this._liveRefreshEffect.of(void 0) });
          } catch {
          }
        }
      });
      if (this.liveAvailable) this.app.workspace.updateOptions();
      this.rescanPdfLayers();
      this.epubHighlights.rescan();
      this._canvasEdgeHighlights?.refresh();
    }
    // ---------- 阅读模式高亮 ----------
    highlightElement(el, ctx) {
      if (!automaticHighlighting(this.settings) || !this._pattern || !this.index.size) return;
      if (el.closest && el.closest(".lexis-popover,.lexis-library-preview,.lexis-log-row-content")) return;
      const selfKeys = ctx && ctx.sourcePath ? this.selfKeysFor(ctx.sourcePath) : null;
      this.wrapMatchesInElement(el, "code,pre,a,.lexis-hl,.lexis-popover,.math,.tag", {}, selfKeys);
    }
    // 把 el 内文本节点里命中词库的片段包成 <span class="lexis-hl">(供阅读模式 + PDF 复用)。
    // rejectSelector:父元素命中则跳过该文本节点(避免重复包/包进代码块等)。
    // excludeKeys:命中这些 key 时只留纯文本不高亮(词条笔记里不高亮自己的标题/别名,但别的词照常高亮)。
    wrapMatchesInElement(el, rejectSelector, styleOpts = {}, excludeKeys = null) {
      if (!this._pattern || !this.index.size) return;
      const doc = el.ownerDocument;
      const regex = new RegExp(this._pattern, "gi");
      const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          const p = node.parentElement;
          if (!p || rejectSelector && p.closest(rejectSelector)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const targets2 = [];
      let n;
      while (n = walker.nextNode()) if (n.nodeType === Node.TEXT_NODE) targets2.push(n);
      for (const node of targets2) {
        const text = node.nodeValue || "";
        regex.lastIndex = 0;
        if (!regex.test(text)) continue;
        regex.lastIndex = 0;
        const frag = doc.createDocumentFragment();
        let last = 0;
        let m;
        while (m = regex.exec(text)) {
          if (m.index > last) frag.appendChild(doc.createTextNode(text.slice(last, m.index)));
          const key = this.resolveMatchKey(m[0]);
          if (excludeKeys && excludeKeys.has(key)) {
            frag.appendChild(doc.createTextNode(m[0]));
            last = m.index + m[0].length;
            if (m[0].length === 0) regex.lastIndex++;
            continue;
          }
          const entry = this.index.get(key);
          const span = doc.createElement("span");
          span.className = "lexis-hl";
          span.textContent = m[0];
          span.dataset.lexisKey = key;
          span.setAttribute("style", this.inlineStyleForEntry(entry, styleOpts));
          frag.appendChild(span);
          last = m.index + m[0].length;
          if (m[0].length === 0) regex.lastIndex++;
        }
        if (last < text.length) frag.appendChild(doc.createTextNode(text.slice(last)));
        node.parentNode?.replaceChild(frag, node);
      }
    }
    // ---------- 实时预览高亮 ----------
    setupLiveExtension() {
      try {
        const editorInfoField2 = obsidian2.editorInfoField;
        const refreshEffect = import_state.StateEffect.define();
        this._liveRefreshEffect = refreshEffect;
        const buildDecorations = (view) => {
          const builder = new import_state.RangeSetBuilder();
          if (!automaticHighlighting(this.settings) || !this.settings.enableLivePreview || !this._pattern) return builder.finish();
          let selfKeys = null;
          if (editorInfoField2) {
            try {
              const info = view.state.field(editorInfoField2, false);
              if (info?.file?.path) selfKeys = this.selfKeysFor(info.file.path);
            } catch {
            }
          }
          const regex = new RegExp(this._pattern, "gi");
          for (const { from, to } of view.visibleRanges) {
            const text = view.state.doc.sliceString(from, to);
            regex.lastIndex = 0;
            let match;
            while (match = regex.exec(text)) {
              const key = this.resolveMatchKey(match[0]);
              if (selfKeys?.has(key)) {
                if (match[0].length === 0) regex.lastIndex++;
                continue;
              }
              const start = from + match.index;
              const end = start + match[0].length;
              const entry = this.index.get(key);
              builder.add(start, end, import_view.Decoration.mark({ class: "lexis-hl", attributes: { "data-lexis-key": key, style: this.inlineStyleForEntry(entry) } }));
              if (match[0].length === 0) regex.lastIndex++;
            }
          }
          return builder.finish();
        };
        const ext = import_view.ViewPlugin.fromClass(
          class {
            constructor(view) {
              this.decorations = buildDecorations(view);
            }
            update(update) {
              const indexChanged = update.transactions.some((transaction) => transaction.effects.some((effect) => effect.is(refreshEffect)));
              if (update.docChanged || update.viewportChanged || indexChanged) this.decorations = buildDecorations(update.view);
            }
          },
          { decorations: (v) => v.decorations }
        );
        this.registerEditorExtension(ext);
        this.liveAvailable = true;
      } catch (err) {
        this.liveAvailable = false;
        console.warn("[Lexis] \u5B9E\u65F6\u9884\u89C8\u9AD8\u4EAE\u4E0D\u53EF\u7528:", err);
      }
    }
  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(HighlightEngine.prototype);
  return { ...createHighlightIndex({ Notice: Notice20, boundedSource: boundedSource2, compactMixedScriptSpacing: compactMixedScriptSpacing2, todayStr }), ...descriptors };
}

// src/pdf-highlight-targets.ts
var targets = /* @__PURE__ */ new WeakMap();
var sources = /* @__PURE__ */ new WeakMap();
function setPdfTargets(layer, items) {
  targets.set(layer, items);
  for (const { anchor, source } of items) sources.set(anchor, source);
}
function pdfTargetSource(anchor) {
  return sources.get(anchor);
}
function pdfHighlightAt(event) {
  const node = event.target;
  const element = node?.nodeType === 1 ? node : node?.parentElement;
  if (!element || element.closest(".lexis-popover, .annotationLayer, a, button")) return null;
  const layer = element.closest(".textLayer") || element.closest(".page")?.querySelector(":scope > .textLayer");
  if (!layer) return null;
  for (const { anchor } of targets.get(layer) || []) {
    if (!anchor.isConnected || anchor.closest(".is-geometry-changing, .lexis-page-highlights-hidden")) continue;
    const rect = anchor.getBoundingClientRect();
    if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) return anchor;
  }
  return null;
}

// src/document-highlights.ts
function selectionTouchesLayer(layer, selection) {
  if (!selection || selection.isCollapsed) return false;
  return !!(selection.anchorNode && layer.contains(selection.anchorNode) || selection.focusNode && layer.contains(selection.focusNode));
}
function pdfHighlightBand(lineHeight, style, text = "") {
  if (style === "background") {
    const height2 = lineHeight * (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u.test(text) ? 0.8 : 0.7);
    return { topOffset: (lineHeight - height2) / 2, height: height2 };
  }
  const height = style === "underline" ? Math.max(1.2, Math.min(2, lineHeight * 0.1)) : Math.max(2, Math.min(3, lineHeight * 0.15));
  return { topOffset: Math.max(0, lineHeight - height + 1), height };
}
function createDocumentHighlights() {
  class DocumentHighlights {
    // ---------- PDF 高亮(钩 pdf.js 文字层) ----------
    // pdf.js 会把同一行甚至同一个词拆成多个 span。普通 TreeWalker 只能逐文本节点匹配，
    // 所以 PDF 先按几何位置还原短的视觉行，再把跨片段命中映射回原文本节点。
    pdfTextRuns(layer) {
      const doc = layer.ownerDocument || document;
      const walker = doc.createTreeWalker(layer, NodeFilter.SHOW_TEXT, {
        acceptNode: (node2) => {
          if (!node2.nodeValue || !node2.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          const parent = node2.parentElement;
          if (!parent || parent.closest(".lexis-hl,.lexis-popover")) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const parts = [];
      let node;
      while (node = walker.nextNode()) {
        try {
          const range = doc.createRange();
          range.selectNodeContents(node);
          const rect = range.getBoundingClientRect();
          if (!rect.width || !rect.height) continue;
          parts.push({ node, text: node.nodeValue || "", rect });
        } catch {
        }
      }
      const runs = [];
      for (const part of parts) {
        const last = runs[runs.length - 1];
        const center = part.rect.top + part.rect.height / 2;
        const sameLine = last && Math.abs(center - last.center) <= Math.max(2, Math.min(last.height, part.rect.height) * 0.45);
        const gap = last ? part.rect.left - last.right : 0;
        const sameRun = sameLine && gap >= -2 && gap <= Math.max(24, Math.min(last.height, part.rect.height) * 2.5);
        if (!sameRun) {
          runs.push({ parts: [part], left: part.rect.left, right: part.rect.right, top: part.rect.top, center, height: part.rect.height });
          continue;
        }
        last.parts.push(part);
        last.right = Math.max(last.right, part.rect.right);
        last.top = Math.min(last.top, part.rect.top);
        last.height = Math.max(last.height, part.rect.height);
        last.center = (last.center * (last.parts.length - 1) + center) / last.parts.length;
      }
      return runs;
    }
    pdfRunStream(run) {
      const text = [];
      const map = [];
      const appendSpace = (source) => {
        if (!text.length || text[text.length - 1] === " ") return;
        text.push(" ");
        map.push(source || null);
      };
      const appendPart = (part) => {
        for (let i = 0; i < part.text.length; i++) {
          const ch = part.text[i];
          if (/\s/.test(ch)) appendSpace({ node: part.node, offset: i });
          else {
            text.push(ch);
            map.push({ node: part.node, offset: i });
          }
        }
      };
      let previous = null;
      for (const part of run.parts) {
        if (previous && !/\s$/.test(previous.text) && !/^\s/.test(part.text)) {
          const gap = part.rect.left - previous.rect.right;
          const threshold = Math.max(1.5, Math.min(previous.rect.height, part.rect.height) * 0.16);
          if (gap > threshold) appendSpace(null);
        }
        appendPart(part);
        previous = part;
      }
      while (text[0] === " ") {
        text.shift();
        map.shift();
      }
      while (text[text.length - 1] === " ") {
        text.pop();
        map.pop();
      }
      return { text: text.join(""), map };
    }
    collectPdfMatches(layer) {
      if (!this._pattern || !this.index.size) return [];
      const runs = this.pdfTextRuns(layer);
      if (!runs.length) return [];
      const streams = runs.map((run) => this.pdfRunStream(run));
      const candidates = [];
      const nodeOrder = /* @__PURE__ */ new WeakMap();
      const regex = new RegExp(this._pattern, "gi");
      let order = 0;
      for (const run of runs) for (const part of run.parts) if (!nodeOrder.has(part.node)) nodeOrder.set(part.node, order++);
      const collect = (stream, accepts, droppedHyphen) => {
        regex.lastIndex = 0;
        let match;
        while (match = regex.exec(stream.text)) {
          const refs = stream.map.slice(match.index, match.index + match[0].length).filter((ref) => ref !== null);
          if (!refs.length || !accepts(refs)) {
            if (!match[0].length) regex.lastIndex++;
            continue;
          }
          const key = this.resolveMatchKey(match[0]);
          const entry = this.index.get(key);
          if (!entry) continue;
          const byNode = /* @__PURE__ */ new Map();
          for (const ref of refs) {
            const current = byNode.get(ref.node);
            if (current) {
              current.start = Math.min(current.start, ref.offset);
              current.end = Math.max(current.end, ref.offset + 1);
            } else byNode.set(ref.node, { node: ref.node, start: ref.offset, end: ref.offset + 1 });
          }
          if (droppedHyphen && byNode.has(droppedHyphen.node)) {
            const segment = byNode.get(droppedHyphen.node);
            segment.end = Math.max(segment.end, droppedHyphen.offset + 1);
          }
          const segments = [...byNode.values()].sort((a, b) => (nodeOrder.get(a.node) || 0) - (nodeOrder.get(b.node) || 0));
          candidates.push({ key, entry, segments, length: match[0].length });
          if (!match[0].length) regex.lastIndex++;
        }
      };
      for (let i = 0; i < runs.length; i++) {
        collect(streams[i], () => true, null);
      }
      for (let i = 0; i < runs.length; i++) {
        const current = runs[i];
        let nextIndex = -1, bestScore = Infinity;
        for (let j = i + 1; j < Math.min(runs.length, i + 9); j++) {
          const next = runs[j];
          const dy = next.top - current.top;
          const lineHeight = Math.max(current.height, next.height);
          if (dy <= lineHeight * 0.45 || dy > lineHeight * 3) continue;
          const dx = Math.abs(next.left - current.left);
          if (dx > Math.max(32, lineHeight * 3)) continue;
          const score = dy + dx * 0.2;
          if (score < bestScore) {
            bestScore = score;
            nextIndex = j;
          }
        }
        if (nextIndex < 0) continue;
        const left = streams[i], right = streams[nextIndex];
        if (!left.text || !right.text) continue;
        const leftNodes = new Set(runs[i].parts.map((part) => part.node));
        const rightNodes = new Set(runs[nextIndex].parts.map((part) => part.node));
        const crossesLines = (refs) => refs.some((ref) => leftNodes.has(ref.node)) && refs.some((ref) => rightNodes.has(ref.node));
        const combine = (leftText, leftMap, separator) => ({
          text: leftText + separator + right.text,
          map: leftMap.concat(separator ? [null] : [], right.map)
        });
        const hyphen = /[-\u00ad\u2010\u2011]$/.test(left.text);
        if (hyphen) {
          const dropped = left.map[left.map.length - 1];
          collect(combine(left.text.slice(0, -1), left.map.slice(0, -1), ""), crossesLines, dropped);
          collect(combine(left.text, left.map, ""), crossesLines, null);
        } else {
          collect(combine(left.text, left.map, ""), crossesLines, null);
          collect(combine(left.text, left.map, " "), crossesLines, null);
        }
      }
      candidates.sort((a, b) => b.length - a.length || a.segments[0].start - b.segments[0].start);
      const used = /* @__PURE__ */ new WeakMap();
      const accepted = [];
      const signatures = /* @__PURE__ */ new Set();
      for (const candidate of candidates) {
        const signature = candidate.key + "|" + candidate.segments.map((s) => `${nodeOrder.get(s.node)}:${s.start}-${s.end}`).join(",");
        if (signatures.has(signature)) continue;
        signatures.add(signature);
        const overlaps = candidate.segments.some((segment) => (used.get(segment.node) || []).some((range) => segment.start < range.end && segment.end > range.start));
        if (overlaps) continue;
        for (const segment of candidate.segments) {
          const ranges = used.get(segment.node) || [];
          ranges.push(segment);
          used.set(segment.node, ranges);
        }
        accepted.push(candidate);
      }
      return accepted;
    }
    // PDF.js 管理文字节点及其绝对定位；Lexis 只读取 Range，单独绘制并按坐标命中。
    setupPdfHighlight(document2 = this._pdfDocument || this.app.workspace.containerEl.ownerDocument) {
      this.teardownPdfHighlight();
      this._pdfDocument = document2;
      this._pdfWindow = document2.defaultView || window;
      const observerWindow = this._pdfWindow;
      this._pdfObservedLayers = /* @__PURE__ */ new WeakSet();
      this._pdfObservedSizes = /* @__PURE__ */ new WeakMap();
      const MutationObserverConstructor = observerWindow.MutationObserver;
      if (!automaticHighlighting(this.settings) || !this.settings.enablePdfHighlight || !MutationObserverConstructor) return;
      this._pdfPending = /* @__PURE__ */ new Set();
      const flush = () => {
        this._pdfRaf = 0;
        const next = this._pdfPending.values().next();
        if (!next.done) {
          this._pdfPending.delete(next.value);
          if (next.value.isConnected) {
            if (this.pdfLayerHasSelection(next.value)) {
              this._pdfPending.add(next.value);
              next.value.parentElement?.querySelector(":scope > .lexis-pdf-hl-layer")?.classList.remove("is-geometry-changing");
              if (!this._pdfResizeTimer) {
                this._pdfResizeTimer = this._pdfWindow?.setTimeout(() => {
                  this._pdfResizeTimer = 0;
                  if (!this._pdfRaf) this._pdfRaf = this._pdfWindow?.requestAnimationFrame(flush) || 0;
                }, 120) || 0;
              }
              return;
            }
            this.scanPdfLayer(next.value);
            next.value.parentElement?.querySelector(":scope > .lexis-pdf-hl-layer")?.classList.remove("is-geometry-changing");
          }
        }
        if (this._pdfPending.size) this._pdfRaf = this._pdfWindow?.requestAnimationFrame(flush) || 0;
        else document2.querySelectorAll(".lexis-pdf-hl-layer.is-geometry-changing").forEach((element) => element.classList.remove("is-geometry-changing"));
      };
      const scheduleFlush = (delay = 0) => {
        if (delay) {
          if (this._pdfResizeTimer || this._pdfRaf) return;
          this._pdfResizeTimer = this._pdfWindow?.setTimeout(() => {
            this._pdfResizeTimer = 0;
            if (!this._pdfRaf) this._pdfRaf = this._pdfWindow?.requestAnimationFrame(flush) || 0;
          }, delay) || 0;
        } else if (this._pdfPending.size && !this._pdfRaf) this._pdfRaf = this._pdfWindow?.requestAnimationFrame(flush) || 0;
      };
      this._pdfScheduleFlush = scheduleFlush;
      const ResizeObserverConstructor = observerWindow.ResizeObserver;
      if (ResizeObserverConstructor) {
        this._pdfResizeObserver = new ResizeObserverConstructor((entries) => {
          for (const entry of entries) {
            const target = entry.target;
            const size = `${entry.contentRect.width}:${entry.contentRect.height}`;
            const previousSize = this._pdfObservedSizes?.get(target);
            this._pdfObservedSizes?.set(target, size);
            if (previousSize == null || previousSize === size) continue;
            const layer = target.classList.contains("textLayer") ? target : target.querySelector(".textLayer");
            if (layer) this.markPdfGeometryChanging(layer);
          }
          if (this._pdfPending.size) scheduleFlush(220);
        });
      }
      this._pdfObserver = new MutationObserverConstructor((muts) => {
        let geometryChanged = false;
        for (const mu of muts) {
          const targetElement = mu.target.nodeType === 1 ? mu.target : mu.target.parentElement;
          if (targetElement?.closest(".lexis-pdf-hl-layer")) continue;
          if (mu.type === "childList" && [...mu.addedNodes, ...mu.removedNodes].length && [...mu.addedNodes, ...mu.removedNodes].every((node) => node.nodeType === 1 && node.classList.contains("lexis-pdf-hl-layer"))) continue;
          if (mu.type === "attributes") {
            if (targetElement?.classList.contains("textLayer")) {
              this.markPdfGeometryChanging(targetElement);
              geometryChanged = true;
            } else if (targetElement?.matches(".page, .canvasWrapper, canvas")) {
              const page = targetElement.classList.contains("page") ? targetElement : targetElement.closest(".page");
              const layer = page?.querySelector(":scope > .textLayer");
              if (layer) {
                this.markPdfGeometryChanging(layer);
                geometryChanged = true;
              }
            } else {
              const layer = targetElement?.closest(".textLayer");
              if (layer) {
                this.markPdfGeometryChanging(layer);
                geometryChanged = true;
              }
            }
            continue;
          }
          if (targetElement && !targetElement.closest(".lexis-hl,.lexis-pdf-hl-layer")) {
            const containingLayer = targetElement.classList.contains("textLayer") ? targetElement : targetElement.closest(".textLayer");
            if (containingLayer) {
              this.markPdfGeometryChanging(containingLayer);
              geometryChanged = true;
            } else if (targetElement.matches(".page, .canvasWrapper, canvas")) {
              const page = targetElement.classList.contains("page") ? targetElement : targetElement.closest(".page");
              const layer = page?.querySelector(":scope > .textLayer");
              if (layer) {
                this.markPdfGeometryChanging(layer);
                geometryChanged = true;
              }
            }
          }
          for (const node of mu.addedNodes) {
            if (node.nodeType !== 1) continue;
            const element = node;
            if (element.classList.contains("lexis-hl") || element.closest(".lexis-hl")) continue;
            if (element.classList.contains("textLayer")) {
              this.markPdfGeometryChanging(element);
              geometryChanged = true;
            } else element.querySelectorAll(".textLayer").forEach((layer) => {
              this.markPdfGeometryChanging(layer);
              geometryChanged = true;
            });
          }
        }
        if (geometryChanged) scheduleFlush(220);
      });
      this._pdfObserver.observe(document2.body, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["style"] });
      document2.querySelectorAll(".textLayer").forEach((layer) => this.markPdfGeometryChanging(layer));
      scheduleFlush();
    }
    observePdfLayer(layer) {
      if (!this._pdfResizeObserver || !layer || this._pdfObservedLayers?.has(layer)) return;
      try {
        this._pdfObservedLayers.add(layer);
        this._pdfResizeObserver.observe(layer);
        if (layer.parentElement) this._pdfResizeObserver.observe(layer.parentElement);
      } catch {
      }
    }
    markPdfGeometryChanging(layer) {
      if (!layer?.isConnected) return;
      this._pdfPending?.add(layer);
      if (!this.pdfLayerHasSelection(layer)) layer.parentElement?.querySelector(":scope > .lexis-pdf-hl-layer")?.classList.add("is-geometry-changing");
    }
    pdfLayerHasSelection(layer) {
      return selectionTouchesLayer(layer, this._pdfWindow?.getSelection() || null);
    }
    scanPdfLayer(layer) {
      if (!this.settings.enablePdfHighlight || !automaticHighlighting(this.settings)) return;
      this.observePdfLayer(layer);
      layer.classList.add("lexis-pdf-source-layer");
      const matches = this.collectPdfMatches(layer);
      const page = layer.parentElement;
      if (!page) return;
      if (getComputedStyle(page).position === "static") page.setCssStyles({ position: "relative" });
      let hl = page.querySelector(":scope > .lexis-pdf-hl-layer");
      if (!hl) {
        hl = page.createDiv({ cls: "lexis-pdf-hl-layer" });
        layer.insertAdjacentElement("beforebegin", hl);
      }
      hl.setCssStyles({
        position: "absolute",
        inset: "0",
        zIndex: "1",
        pointerEvents: "none"
      });
      hl.empty();
      const hlBB = hl.getBoundingClientRect();
      const scaleX = hlBB.width / (hl.offsetWidth || hlBB.width || 1);
      const scaleY = hlBB.height / (hl.offsetHeight || hlBB.height || 1);
      const items = [];
      for (const { key, entry, segments } of matches) {
        try {
          const color = this.colorForEntry(entry);
          const styleKind = this.styleKindForEntry(entry);
          const alphaFactor = styleKind === "background" ? 0.45 : 0.65;
          const alpha = Math.max(0.04, Math.min(0.75, this.highlightAlphaForEntry(entry) * alphaFactor));
          const paint = this.applyAlpha(color, alpha);
          for (const segment of segments) {
            const source = layer.ownerDocument.createRange();
            source.setStart(segment.node, segment.start);
            source.setEnd(segment.node, segment.end);
            for (const rect of Array.from(source.getClientRects()).filter((rect2) => rect2.width && rect2.height)) {
              const band = pdfHighlightBand(rect.height, styleKind, source.toString());
              const anchor = hl.createDiv({ cls: "lexis-pdf-target" });
              anchor.dataset.lexisKey = key;
              anchor.setCssStyles({
                position: "absolute",
                left: `${(rect.left - hlBB.left) / scaleX}px`,
                top: `${(rect.top - hlBB.top) / scaleY}px`,
                width: `${rect.width / scaleX}px`,
                height: `${rect.height / scaleY}px`,
                pointerEvents: "none"
              });
              items.push({ anchor, source });
              if (!entry.archived && this.highlightVisibleForEntry(entry)) {
                const d = anchor.createDiv({ cls: `lexis-pdf-hl is-${styleKind}` });
                d.setCssStyles({ position: "absolute", left: "0", top: `${band.topOffset / scaleY}px`, width: "100%", height: `${band.height / scaleY}px` });
                d.style.setProperty("--lexis-pdf-color", paint);
              }
            }
          }
        } catch {
        }
      }
      setPdfTargets(layer, items);
    }
    teardownPdfHighlight() {
      const document2 = this._pdfDocument;
      const hostWindow = this._pdfWindow || window;
      if (this._pdfObserver) {
        this._pdfObserver.disconnect();
        this._pdfObserver = null;
      }
      if (this._pdfRaf) {
        hostWindow.cancelAnimationFrame(this._pdfRaf);
        this._pdfRaf = 0;
      }
      if (this._pdfResizeObserver) {
        this._pdfResizeObserver.disconnect();
        this._pdfResizeObserver = null;
      }
      if (this._pdfResizeTimer) {
        hostWindow.clearTimeout(this._pdfResizeTimer);
        this._pdfResizeTimer = 0;
      }
      this._pdfScheduleFlush = null;
      this._pdfObservedLayers = null;
      this._pdfObservedSizes = null;
      if (document2) {
        document2.querySelectorAll(".lexis-pdf-hl-layer").forEach((layer) => layer.remove());
        document2.querySelectorAll(".textLayer.lexis-pdf-source-layer").forEach((layer) => layer.classList.remove("lexis-pdf-source-layer"));
        document2.querySelectorAll(".textLayer .lexis-hl").forEach((span) => {
          const text = document2.createTextNode(span.textContent || "");
          span.parentNode?.replaceChild(text, span);
        });
      }
      this._pdfDocument = null;
      this._pdfWindow = null;
    }
    // 词库/配色变化只重建独立图层；不得 normalize 或替换 PDF.js 的文本节点。
    rescanPdfLayers() {
      const document2 = this._pdfDocument || this.app.workspace.containerEl.ownerDocument;
      document2.querySelectorAll(".lexis-pdf-hl-layer").forEach((layer) => layer.remove());
      document2.querySelectorAll(".textLayer").forEach((layer) => this.markPdfGeometryChanging(layer));
      this._pdfScheduleFlush?.();
    }
  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(DocumentHighlights.prototype);
  return descriptors;
}

// src/reader-interactions.ts
var obsidian3 = __toESM(require("obsidian"));

// src/alias-search.ts
function normalized(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}
function fuzzyScore(query, value) {
  const needle = normalized(query);
  const haystack = normalized(value);
  if (!needle) return 0;
  if (haystack === needle) return 0;
  if (haystack.startsWith(needle)) return 10 + (haystack.length - needle.length) / 100;
  const containedAt = haystack.indexOf(needle);
  if (containedAt >= 0) return 20 + containedAt + (haystack.length - needle.length) / 100;
  let cursor = 0;
  let first = -1;
  let gaps = 0;
  for (const character of needle) {
    const foundAt = haystack.indexOf(character, cursor);
    if (foundAt < 0) return Number.POSITIVE_INFINITY;
    if (first < 0) first = foundAt;
    gaps += foundAt - cursor;
    cursor = foundAt + 1;
  }
  return 40 + first + gaps + Math.max(0, haystack.length - needle.length) / 100;
}
function collectAliasTargets(index) {
  const targets2 = /* @__PURE__ */ new Map();
  for (const entry of index.values()) {
    if (!entry?.file || entry.inline) continue;
    const id = entry.file.path;
    let target = targets2.get(id);
    if (!target) {
      target = { id, title: entry.file.basename, file: entry.file, terms: [], termSet: /* @__PURE__ */ new Set() };
      targets2.set(id, target);
    }
    for (const term of [entry.file.basename, entry.display]) {
      const key = normalized(term);
      if (!key || target.termSet.has(key)) continue;
      target.termSet.add(key);
      target.terms.push(term);
    }
  }
  return [...targets2.values()].map(({ termSet: _termSet, ...target }) => target);
}
function findExactAliasTarget(targets2, query) {
  const needle = normalized(query);
  if (!needle) return null;
  return targets2.find((target) => normalized(target.title) === needle) || targets2.find((target) => target.terms.some((term) => normalized(term) === needle)) || null;
}
function rankAliasTargets(targets2, query, limit = 8) {
  return targets2.map((target) => {
    let score = Number.POSITIVE_INFINITY;
    let matched = target.title;
    for (const term of target.terms) {
      const candidateScore = fuzzyScore(query, term);
      if (candidateScore < score) {
        score = candidateScore;
        matched = term;
      }
    }
    return { ...target, score, matched };
  }).filter((target) => Number.isFinite(target.score)).sort((left, right) => left.score - right.score || left.title.localeCompare(right.title)).slice(0, limit);
}

// src/alias-combobox.ts
var aliasMenuSequence = 0;
function openAliasCombobox(options) {
  const { document: doc, anchor, targets: targets2 } = options;
  const panel = doc.body.createDiv({ cls: "lexis-alias-search" });
  const input = panel.createEl("input", { cls: "lexis-alias-search-input" });
  input.value = options.initialValue;
  input.placeholder = options.placeholder;
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "true");
  const list = panel.createDiv({ cls: "lexis-alias-search-results" });
  list.setAttribute("role", "listbox");
  list.id = `lexis-alias-options-${++aliasMenuSequence}`;
  input.setAttribute("aria-controls", list.id);
  let closed = false;
  let activeIndex = 0;
  let primaryValue = input.value.trim();
  let exactTarget = findExactAliasTarget(targets2, primaryValue);
  let matches = rankAliasTargets(targets2, primaryValue, 9).filter((target) => target.id !== exactTarget?.id).slice(0, 7);
  const activate = (index) => {
    activeIndex = index;
    const rows = list.querySelectorAll('[role="option"]');
    rows.forEach((row, rowIndex) => {
      row.classList.toggle("is-active", rowIndex === index);
      row.setAttribute("aria-selected", String(rowIndex === index));
    });
    const active = rows[index];
    if (active) input.setAttribute("aria-activedescendant", active.id);
    else input.removeAttribute("aria-activedescendant");
  };
  const bindOption = (row, index) => {
    row.id = `${list.id}-${index}`;
    row.tabIndex = -1;
    row.addEventListener("mouseenter", () => activate(index));
    row.addEventListener("focus", () => activate(index));
  };
  const place = () => {
    const win = doc.defaultView || window;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(280, Math.max(220, win.innerWidth - 16));
    panel.style.width = `${width}px`;
    panel.style.left = `${Math.max(8, Math.min(rect.left, win.innerWidth - width - 8))}px`;
    const below = rect.bottom + 5;
    const height = panel.offsetHeight || 240;
    panel.style.top = `${below + height <= win.innerHeight - 8 ? below : Math.max(8, rect.top - height - 5)}px`;
  };
  const choose = (target) => {
    controller.close();
    options.onPick(target);
  };
  const chooseAt = (index) => {
    const hasPrimary = !!primaryValue;
    if (hasPrimary && index === 0) {
      controller.close();
      if (exactTarget) options.onPick(exactTarget);
      else options.onCreate(primaryValue);
      return;
    }
    const target = matches[index - (hasPrimary ? 1 : 0)];
    if (target) choose(target);
  };
  const render = () => {
    primaryValue = input.value.trim();
    exactTarget = findExactAliasTarget(targets2, primaryValue);
    matches = rankAliasTargets(targets2, primaryValue, 9).filter((target) => target.id !== exactTarget?.id).slice(0, 7);
    const optionCount = matches.length + (primaryValue ? 1 : 0);
    activeIndex = Math.min(activeIndex, Math.max(0, optionCount - 1));
    list.replaceChildren();
    if (primaryValue) {
      const primary = list.createEl("button", { cls: "lexis-alias-search-result is-primary", attr: { type: "button" } });
      primary.classList.toggle("is-active", activeIndex === 0);
      primary.setAttribute("role", "option");
      primary.setAttribute("aria-selected", activeIndex === 0 ? "true" : "false");
      bindOption(primary, 0);
      primary.createSpan({ text: primaryValue });
      primary.setAttribute("title", primaryValue);
      primary.createEl("small", { text: exactTarget ? options.existingLabel(exactTarget) : options.createLabel });
      primary.addEventListener("pointerdown", (event) => event.preventDefault());
      primary.addEventListener("click", () => chooseAt(0));
    }
    if (!primaryValue && !matches.length) {
      const empty = list.createDiv({ cls: "lexis-alias-search-empty" });
      empty.textContent = options.emptyText;
    } else {
      const offset = primaryValue ? 1 : 0;
      matches.forEach((match, index) => {
        const optionIndex = index + offset;
        const row = list.createEl("button", { cls: "lexis-alias-search-result", attr: { type: "button" } });
        row.classList.toggle("is-active", optionIndex === activeIndex);
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", optionIndex === activeIndex ? "true" : "false");
        bindOption(row, optionIndex);
        const title = row.createSpan();
        title.textContent = match.title;
        row.setAttribute("title", match.title);
        if (normalizedLabel(match.matched) !== normalizedLabel(match.title)) {
          const alias = row.createEl("small");
          alias.textContent = match.matched;
        }
        row.addEventListener("pointerdown", (event) => event.preventDefault());
        row.addEventListener("click", () => choose(match));
      });
    }
    activate(activeIndex);
    place();
  };
  const onOutside = (event) => {
    const target = event.target;
    if (target && !panel.contains(target) && !anchor.contains(target)) controller.close();
  };
  const controller = {
    close() {
      if (closed) return;
      closed = true;
      doc.removeEventListener("pointerdown", onOutside, true);
      input.setAttribute("aria-expanded", "false");
      panel.remove();
      options.onClose();
    }
  };
  input.addEventListener("input", () => {
    activeIndex = 0;
    render();
  });
  input.addEventListener("keydown", (event) => {
    const optionCount = matches.length + (primaryValue ? 1 : 0);
    if (event.key === "ArrowDown" && optionCount) {
      event.preventDefault();
      activate((activeIndex + 1) % optionCount);
    } else if (event.key === "ArrowUp" && optionCount) {
      event.preventDefault();
      activate((activeIndex - 1 + optionCount) % optionCount);
    } else if (event.key === "Enter" && optionCount) {
      event.preventDefault();
      chooseAt(activeIndex);
    } else if (event.key === "Escape") {
      event.preventDefault();
      controller.close();
    }
  });
  doc.addEventListener("pointerdown", onOutside, true);
  render();
  input.focus();
  input.select();
  return controller;
}
function normalizedLabel(value) {
  return String(value || "").normalize("NFKC").toLowerCase().trim();
}

// src/selection-pill-position.ts
function normalizePillScale(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(1.5, Math.max(0.75, Math.round(value * 100) / 100)) : 1;
}
function positionSelectionPill(anchor, pill, viewport, offset) {
  const clamp = (value, extent, size) => Math.max(6, Math.min(value, extent - size - 6));
  return {
    left: clamp(anchor.left + offset.x, viewport.width, pill.width),
    top: clamp(anchor.bottom + 6 + offset.y, viewport.height, pill.height)
  };
}

// src/selection-pill-order.ts
var SELECTION_PILL_ORDERS = [
  "add-dictionary-alias",
  "add-alias-dictionary",
  "dictionary-add-alias",
  "dictionary-alias-add",
  "alias-add-dictionary",
  "alias-dictionary-add"
];
function selectionPillActions(order) {
  const value = order && SELECTION_PILL_ORDERS.includes(order) ? order : "add-dictionary-alias";
  return value.split("-");
}

// src/canvas-highlight-target.ts
function eventElement(target) {
  if (!target || typeof target !== "object" || !("nodeType" in target)) return null;
  const node = target;
  return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
}
function pointInside(rect, x, y) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}
function pointInsideElement(element, x, y) {
  return Array.from(element.getClientRects()).some((rect) => pointInside(rect, x, y));
}
function canvasHighlightAt(event) {
  const target = eventElement(event.target);
  const canvas = target?.closest(".canvas-wrapper,.canvas");
  if (!canvas) return null;
  const document2 = canvas.ownerDocument;
  for (const element of document2.elementsFromPoint(event.clientX, event.clientY)) {
    const highlight = element.closest(".canvas-node .lexis-hl,.canvas-path-label-wrapper .lexis-hl");
    if (highlight && canvas.contains(highlight)) return highlight;
  }
  for (const highlight of canvas.querySelectorAll(".canvas-node .lexis-hl,.canvas-path-label-wrapper .lexis-hl")) {
    if (pointInsideElement(highlight, event.clientX, event.clientY)) return highlight;
  }
  return null;
}

// src/popover-edit-lifecycle.ts
var activePopoverEditors = /* @__PURE__ */ new WeakMap();
function finishPopoverEdit(popover) {
  const finish = activePopoverEditors.get(popover);
  return finish ? finish() : Promise.resolve(true);
}

// src/reader-frame-geometry.ts
function overlayAnchorFor(element) {
  let anchor = element;
  while (anchor.ownerDocument.defaultView?.frameElement) {
    anchor = anchor.ownerDocument.defaultView.frameElement;
  }
  return anchor;
}
function overlayDocumentFor(element) {
  return overlayAnchorFor(element).ownerDocument;
}
function readerRectInDocument(rect, source, destination) {
  let result = rect;
  let current = source;
  while (current !== destination) {
    const frame = current.defaultView?.frameElement;
    if (!frame) break;
    const bounds = frame.getBoundingClientRect();
    const scaleX = frame.offsetWidth ? bounds.width / frame.offsetWidth : 1;
    const scaleY = frame.offsetHeight ? bounds.height / frame.offsetHeight : 1;
    const left = bounds.left + (frame.clientLeft + result.left) * scaleX;
    const top = bounds.top + (frame.clientTop + result.top) * scaleY;
    const width = result.width * scaleX, height = result.height * scaleY;
    result = { left, top, width, height, right: left + width, bottom: top + height };
    current = frame.ownerDocument;
  }
  return result;
}
function frameBelongsToDocument(frame, root) {
  let current = frame;
  while (current) {
    if (!current.isConnected) return false;
    const owner = current.ownerDocument;
    if (owner === root) return true;
    const parent = owner.defaultView?.frameElement;
    if (!parent || parent.contentDocument !== owner) return false;
    current = parent;
  }
  return false;
}

// src/reader-interactions.ts
function eventElement2(target) {
  if (!target || typeof target !== "object" || !("nodeType" in target)) return null;
  const node = target;
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  return element && "dataset" in element ? element : null;
}
function closestHighlight(target) {
  return eventElement2(target)?.closest(".lexis-hl,.lexis-pdf-hl") || null;
}
function hasExpandedSelection(element) {
  const selection = element.ownerDocument.defaultView?.getSelection();
  return !!selection && !selection.isCollapsed && selection.rangeCount > 0;
}
function shouldHandleHighlightClick(isMobile, clickToOpen) {
  return isMobile || clickToOpen !== false;
}
function createReaderInteractions() {
  class ReaderInteractions {
    // ---------- 悬浮卡 ----------
    highlightTarget(event) {
      for (const target of event.composedPath()) {
        const highlight = closestHighlight(target);
        if (highlight) return highlight;
      }
      return closestHighlight(event.target) || pdfHighlightAt(event) || canvasHighlightAt(event) || this._excalidrawHighlights?.highlightAt(event) || null;
    }
    onMouseMove(event) {
      if (obsidian3.Platform.isMobile) return;
      const target = pdfHighlightAt(event) || canvasHighlightAt(event) || this._excalidrawHighlights?.highlightAt(event) || null;
      if (!this.readerHover.move(target, !!eventElement2(event.target)?.closest(".lexis-popover"))) return;
      if (target) this.onMouseOver(event);
    }
    onMouseOver(e) {
      if (obsidian3.Platform.isMobile) return;
      const t = this.highlightTarget(e);
      if (!t) return;
      if (e.buttons & 1 || hasExpandedSelection(t)) return;
      const delay = Math.max(0, Number(this.settings.hoverDelayMs) || 0);
      this.readerHover.enter(t, delay);
    }
    onMouseOut(e) {
      if (obsidian3.Platform.isMobile) return;
      const t = this.highlightTarget(e);
      if (!t) return;
      this.readerHover.leave(t);
    }
    onPointerDown(e) {
      if (!obsidian3.Platform.isMobile || e.pointerType !== "touch") return;
      if (!e.isPrimary || this._mobileTapStart) {
        this._mobileTapStart = null;
        return;
      }
      const target = this.highlightTarget(e);
      this._mobileTapStart = target && !hasExpandedSelection(target) ? { pointerId: e.pointerId, x: e.clientX, y: e.clientY, time: e.timeStamp, target } : null;
    }
    onPointerMove(e) {
      const start = this._mobileTapStart;
      if (start?.pointerId === e.pointerId && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12) {
        this._mobileTapStart = null;
      }
    }
    onPointerUp(e) {
      const start = this._mobileTapStart;
      this._mobileTapStart = null;
      if (!start || e.pointerId !== start.pointerId || e.pointerType !== "touch") return;
      if (e.timeStamp - start.time > 500 || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12) return;
      const target = start.target.isConnected ? start.target : this.highlightTarget(e);
      if (!target || hasExpandedSelection(target) || !this.index.has(target.dataset.lexisKey)) return;
      this._mobileTapClick = { x: e.clientX, y: e.clientY, time: Date.now() };
      e.preventDefault();
      e.stopPropagation();
      this.activateHighlight(target, false);
    }
    onPointerCancel() {
      this._mobileTapStart = null;
    }
    activateHighlight(target, newTab) {
      const entry = this.index.get(target.dataset.lexisKey);
      if (!entry) return;
      if (obsidian3.Platform.isMobile && this.settings.mobileTapAction !== "open") {
        void this.showPopover(target);
      } else if (entry.inline) {
        void this.openInlineEntry(entry, newTab);
      } else {
        void this.app.workspace.getLeaf(newTab ? "tab" : false).openFile(entry.file);
        this.removePopover();
      }
    }
    showManualLookup(key, rect, overlayDoc, source) {
      if (!this.index.has(key)) return false;
      this.removeSelPill();
      this.removePopover();
      const anchor = overlayDoc.body.createDiv({ cls: "lexis-manual-lookup-anchor" });
      anchor.dataset.lexisKey = key;
      anchor.setCssStyles({ left: `${rect.left}px`, top: `${rect.top}px`, width: `${Math.max(1, rect.width)}px`, height: `${Math.max(1, rect.height)}px` });
      void this.showPopover(anchor);
      this._manualLookupAnchor = anchor;
      this._manualLookupSource = source;
      return true;
    }
    manualLookupFromClick(event) {
      if (!manualLookupEnabled(this.settings) || event.detail < 2) return false;
      const target = eventElement2(event.target);
      if (!target || target.closest(".lexis-popover,.lexis-sel-pill,code,pre,a,input,textarea,[contenteditable=true]")) return false;
      if (!target.closest(".markdown-reading-view,.markdown-preview-view")) return false;
      const sourceDoc = target.ownerDocument;
      const selection = sourceDoc.defaultView?.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount < 1) return false;
      const text = selection.toString().trim();
      if (!text || text.length > 60 || /[\n\r]/.test(text)) return false;
      const key = this.resolveIndexKey(text);
      if (!this.index.has(key)) return false;
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) return false;
      const node = selection.anchorNode;
      const sentence = node ? this.extractSentence(node.textContent || "", selection.anchorOffset || 0) : text;
      const page = Number(target.closest("[data-page-number]")?.getAttribute("data-page-number")) || void 0;
      return this.showManualLookup(key, rect, sourceDoc, { file: this.app.workspace.getActiveFile(), sentence, page });
    }
    onClick(e) {
      if (!obsidian3.Platform.isMobile && this.manualLookupFromClick(e)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const recentTap = this._mobileTapClick;
      if (recentTap && Date.now() - recentTap.time < 700 && Math.hypot(e.clientX - recentTap.x, e.clientY - recentTap.y) < 20 && !eventElement2(e.target)?.closest(".lexis-popover")) {
        this._mobileTapClick = null;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const t = this.highlightTarget(e);
      if (t) {
        if (hasExpandedSelection(t)) return;
        if (this.index.has(t.dataset.lexisKey)) {
          if (!shouldHandleHighlightClick(obsidian3.Platform.isMobile, this.settings.clickHighlightToOpen)) return;
          e.preventDefault();
          this.activateHighlight(t, e.ctrlKey || e.metaKey);
        }
      } else if (this._popover && !this._popover.contains(eventElement2(e.target))) this.removePopover();
    }
    scheduleHide() {
      this.readerHover.scheduleHide();
    }
    removePopover() {
      const editing = this._popover;
      if (editing?.dataset.lexisEditing === "1") {
        void finishPopoverEdit(editing).then((saved) => {
          if (saved && this._popover === editing) this.removePopover();
        });
        return;
      }
      this.readerHover.cancelOpen();
      this.readerHover.keepOpen();
      if (this._popoverComp) {
        this._popoverComp.unload();
        this._popoverComp = null;
      }
      if (this._popover) {
        this._popover.remove();
        this._popover = null;
      }
      if (this._manualLookupAnchor) {
        this._manualLookupAnchor.remove();
        this._manualLookupAnchor = null;
      }
      this._manualLookupSource = null;
    }
    attachPopoverResize(popover, target) {
      const hostWindow = popover.ownerDocument.defaultView || window;
      if (hostWindow.matchMedia?.("(pointer: coarse)").matches) return;
      const handle = popover.createDiv({ cls: "lexis-popover-resize-handle" });
      handle.setAttribute("role", "separator");
      handle.setAttribute("aria-label", this.t("popover.resize"));
      handle.setAttribute("title", this.t("popover.resize"));
      handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        this.readerHover.keepOpen();
        const start = popover.getBoundingClientRect();
        const startHeight = popover.style.height;
        const startMaxHeight = popover.style.maxHeight;
        const startX = event.clientX;
        const startY = event.clientY;
        popover.dataset.lexisResizing = "1";
        try {
          handle.setPointerCapture(event.pointerId);
        } catch {
        }
        const resize = (move) => {
          const maxWidth = Math.max(260, hostWindow.innerWidth - start.left - 10);
          const maxHeight = Math.max(160, hostWindow.innerHeight - start.top - 10);
          const width = Math.max(260, Math.min(maxWidth, start.width + move.clientX - startX));
          const height = Math.max(160, Math.min(maxHeight, start.height + move.clientY - startY));
          popover.setCssStyles({ width: `${width}px`, height: `${height}px`, maxHeight: `${height}px` });
        };
        const finish = (cancelled) => {
          handle.removeEventListener("pointermove", resize);
          handle.removeEventListener("pointerup", onPointerUp);
          handle.removeEventListener("pointercancel", onPointerCancel);
          delete popover.dataset.lexisResizing;
          if (cancelled) {
            popover.setCssStyles({ width: `${start.width}px`, height: startHeight, maxHeight: startMaxHeight });
          } else {
            const result = popover.getBoundingClientRect();
            this.settings.popoverWidth = Math.round(result.width);
            this.settings.popoverMaxHeight = Math.round(result.height);
            popover.setCssStyles({ height: "", maxHeight: `${this.settings.popoverMaxHeight}px` });
            void this.saveSettings();
          }
          this.positionPopover(popover, target);
        };
        const onPointerUp = () => finish(false);
        const onPointerCancel = () => finish(true);
        handle.addEventListener("pointermove", resize);
        handle.addEventListener("pointerup", onPointerUp);
        handle.addEventListener("pointercancel", onPointerCancel);
      });
    }
    // ---------- 划词添加药丸(普通笔记,阅读/编辑两种模式) ----------
    removeSelPill() {
      this._aliasSearch?.close();
      this._aliasSearch = null;
      if (this._selPill) {
        this._selPill.remove();
        this._selPill = null;
      }
    }
    maybeShowSelPill(e, fromEpubIframe = false) {
      if (!this.settings.selectionPill) return;
      const tgt = eventElement2(e.target);
      if (tgt?.closest(".lexis-sel-pill, .lexis-popover, .menu")) return;
      const sourceDoc = tgt?.ownerDocument || document;
      const sourceWin = sourceDoc.defaultView || window;
      const overlayDoc = tgt ? overlayDocumentFor(tgt) : sourceDoc;
      const overlayWin = overlayDoc.defaultView || window;
      let sel, text;
      try {
        sel = sourceWin.getSelection();
        text = sel ? sel.toString().trim() : "";
      } catch {
        return;
      }
      if (!text || text.length > 60 || /[\n\r]/.test(text)) {
        this.removeSelPill();
        return;
      }
      const node = sel.anchorNode;
      const host = node ? node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement : null;
      if (!host || !fromEpubIframe && !host.closest(".markdown-source-view, .markdown-reading-view, .markdown-preview-view, .pdf-viewer, .pdf-container, .pdf-embed, .textLayer")) {
        this.removeSelPill();
        return;
      }
      let rect;
      try {
        rect = sel.getRangeAt(0).getBoundingClientRect();
      } catch {
        return;
      }
      if (!rect || !rect.width && !rect.height) {
        this.removeSelPill();
        return;
      }
      rect = readerRectInDocument(rect, sourceDoc, overlayDoc);
      this.removeSelPill();
      const known = this.index.has(this.resolveIndexKey(text));
      const selectedSourceFile = this.app.workspace.getActiveFile();
      const selectedSentence = (() => {
        const selectedNode = sel?.anchorNode;
        if (!selectedNode) return "";
        return this.extractSentence(selectedNode.textContent || "", sel?.anchorOffset || 0);
      })();
      const selectedPage = Number(host.closest("[data-page-number]")?.getAttribute("data-page-number")) || 0;
      const pill = overlayDoc.body.createDiv({ cls: "lexis-sel-pill" });
      pill.style.setProperty("--lexis-pill-scale", String(normalizePillScale(this.settings.selectionPillScale)));
      pill.addEventListener("mousedown", (ev) => ev.preventDefault());
      if (known) {
        const manual = manualLookupEnabled(this.settings);
        const b = pill.createSpan({ cls: "lexis-sel-pill-btn", text: `\u{1F4D6} ${this.t(manual ? "selection.lookupExisting" : "selection.openExisting")}` });
        b.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (manual) this.showManualLookup(this.resolveIndexKey(text), rect, overlayDoc, { file: selectedSourceFile, sentence: selectedSentence, page: selectedPage || void 0 });
          else void this.addFromPill(text, void 0, { openExisting: true });
        });
      } else {
        const dicts = this.dictFolders();
        let selectedFolder = this.preferredSelectionFolder();
        const folderLabel = (f) => String(f || this.t("common.root")).split("/").pop() || "";
        const addB = pill.createSpan({ cls: "lexis-sel-pill-btn", text: "\uFF0B" });
        addB.setAttribute("title", this.t("selection.add"));
        addB.setAttribute("aria-label", this.t("selection.add"));
        addB.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          void this.addFromPill(text, selectedFolder);
        });
        let folderB = null;
        if (dicts.length > 1) {
          folderB = pill.createSpan({ cls: "lexis-sel-pill-btn lexis-sel-pill-folder", text: folderLabel(selectedFolder) });
          folderB.setAttribute("title", this.t("selection.chooseDictionary"));
          folderB.setAttribute("aria-label", this.t("selection.chooseDictionary"));
          folderB.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const menu = new obsidian3.Menu();
            for (const f of dicts) menu.addItem((it) => it.setTitle(f || this.t("common.root")).setIcon(f === selectedFolder ? "check" : "folder").onClick(() => {
              selectedFolder = f;
              folderB?.setText(folderLabel(f));
              void this.rememberSelectionFolder(f);
            }));
            menu.showAtPosition({ x: ev.clientX, y: ev.clientY });
          });
        }
        const aliasB = pill.createSpan({ cls: "lexis-sel-pill-btn", text: "\u{1F517}" });
        aliasB.setAttribute("title", this.t("selection.alias"));
        aliasB.setAttribute("aria-label", this.t("selection.alias"));
        aliasB.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          this._aliasSearch?.close();
          this._aliasSearch = openAliasCombobox({
            document: overlayDoc,
            anchor: pill,
            targets: collectAliasTargets(this.index),
            initialValue: text,
            placeholder: this.t("selection.aliasSearch"),
            createLabel: this.t("selection.aliasCreate"),
            existingLabel: (target) => this.t("selection.aliasExisting", { word: target.title }),
            emptyText: this.t("selection.aliasNoResults"),
            onCreate: (targetText) => {
              this.removeSelPill();
              void this.addWordFromSelection(targetText, null, null, selectedFolder, {
                alias: text,
                sentence: selectedSentence,
                sourceFile: selectedSourceFile,
                page: selectedPage
              });
            },
            onPick: (target) => {
              this.removeSelPill();
              void this.attachAlias(text, target.file);
            },
            onClose: () => {
              this._aliasSearch = null;
            }
          });
        });
        const actions = { add: addB, dictionary: folderB, alias: aliasB };
        for (const action of selectionPillActions(this.settings.selectionPillOrder)) {
          const element = actions[action];
          if (element) pill.appendChild(element);
        }
      }
      const { top, left } = positionSelectionPill(
        rect,
        { width: pill.offsetWidth, height: pill.offsetHeight },
        { width: overlayWin.innerWidth, height: overlayWin.innerHeight },
        { x: this.settings.selectionPillOffsetX ?? 0, y: this.settings.selectionPillOffsetY ?? 0 }
      );
      pill.setCssStyles({ top: top + "px", left: left + "px" });
      this._selPill = pill;
    }
    preferredSelectionFolder() {
      const dicts = this.dictFolders();
      const saved = this.normalizeFolder(this.settings.lastSelectionFolder || "");
      return dicts.includes(saved) ? saved : dicts[0] || "";
    }
    async rememberSelectionFolder(folder) {
      const value = this.normalizeFolder(folder || "");
      if (!this.dictFolders().includes(value) || this.settings.lastSelectionFolder === value) return;
      this.settings.lastSelectionFolder = value;
      await this.saveSettings();
    }
    async addFromPill(text, folder, options = {}) {
      const view = this.app.workspace.getActiveViewOfType(obsidian3.MarkdownView);
      const editor = view && view.getMode && view.getMode() === "source" && view.editor ? view.editor : null;
      this.removeSelPill();
      if (folder) await this.rememberSelectionFolder(folder);
      await this.addWordFromSelection(text, editor, view, folder, options);
    }
  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(ReaderInteractions.prototype);
  return descriptors;
}

// src/popover-editor.ts
var import_obsidian18 = require("obsidian");

// src/note-edit-session.ts
function splitEditableNote(content) {
  const match = /^\uFEFF?---\r?\n(?:[\s\S]*?\r?\n)?---(?:\r?\n|$)/.exec(content);
  return match ? { prefix: match[0], body: content.slice(match[0].length) } : { prefix: "", body: content };
}
function replaceEditableBody(current, baselineBody, nextBody) {
  const parts = splitEditableNote(current);
  return parts.body === baselineBody ? parts.prefix + nextBody : null;
}
var NoteEditConflict = class extends Error {
  constructor() {
    super("The note body changed elsewhere");
  }
};
var NoteEditSession = class {
  constructor(body, process) {
    this.process = process;
    this.pending = null;
    this.baseline = body;
    this.draft = body;
  }
  get dirty() {
    return this.draft !== this.baseline;
  }
  update(body) {
    this.draft = body;
  }
  flush() {
    if (this.pending === null) this.pending = this.writeChanges().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }
  async writeChanges() {
    while (this.dirty) {
      const body = this.draft;
      await this.process((current) => {
        const next = replaceEditableBody(current, this.baseline, body);
        if (next === null) throw new NoteEditConflict();
        return next;
      });
      this.baseline = body;
    }
  }
};

// src/quick-edit-modal.ts
var import_obsidian17 = require("obsidian");
var errorMessage2 = (error) => error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
var LexisQuickEditModal = class extends import_obsidian17.Modal {
  constructor(app, file, t, onSaved) {
    super(app);
    this.file = file;
    this.t = t;
    this.onSaved = onSaved;
    this.baselineBody = "";
    this.textarea = null;
    this.saveButton = null;
  }
  onOpen() {
    this.modalEl.addClass("lexis-quick-edit-modal");
    this.setTitle(this.t("popover.editTitle", { word: this.file.basename }));
    const hint = this.contentEl.createDiv({ cls: "lexis-quick-edit-hint", text: this.t("popover.editHint") });
    const textarea = this.contentEl.createEl("textarea", { cls: "lexis-quick-edit-textarea", attr: { "aria-label": this.t("popover.editEntry") } });
    this.textarea = textarea;
    textarea.disabled = true;
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: this.t("common.cancel") }).addEventListener("click", () => this.close());
    const save = actions.createEl("button", { cls: "mod-cta", text: this.t("common.save") });
    this.saveButton = save;
    save.disabled = true;
    save.addEventListener("click", () => {
      void this.save();
    });
    textarea.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void this.save();
      }
    });
    void this.load(hint);
  }
  async load(hint) {
    try {
      const parts = splitEditableNote(await this.app.vault.read(this.file));
      this.baselineBody = parts.body;
      if (!this.textarea || !this.saveButton) return;
      this.textarea.value = parts.body;
      this.textarea.disabled = false;
      this.saveButton.disabled = false;
      this.textarea.focus();
    } catch (error) {
      hint.setText(this.t("popover.readFailed", { error: errorMessage2(error) }));
    }
  }
  async save() {
    if (!this.textarea || !this.saveButton || this.textarea.disabled) return;
    const nextBody = this.textarea.value;
    this.textarea.disabled = true;
    this.saveButton.disabled = true;
    let conflict = false;
    try {
      await this.app.vault.process(this.file, (current) => {
        const next = replaceEditableBody(current, this.baselineBody, nextBody);
        if (next == null) {
          conflict = true;
          return current;
        }
        return next;
      });
      if (conflict) {
        new import_obsidian17.Notice(this.t("popover.editConflict"));
        if (this.textarea) this.textarea.disabled = false;
        if (this.saveButton) this.saveButton.disabled = false;
        return;
      }
      new import_obsidian17.Notice(this.t("popover.editSaved", { word: this.file.basename }));
      this.close();
      await this.onSaved();
    } catch (error) {
      new import_obsidian17.Notice(this.t("popover.readFailed", { error: errorMessage2(error) }));
      if (this.textarea) this.textarea.disabled = false;
      if (this.saveButton) this.saveButton.disabled = false;
    }
  }
  onClose() {
    this.contentEl.empty();
    this.textarea = null;
    this.saveButton = null;
  }
};

// src/popover-editor.ts
var errorMessage3 = (error) => error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
function attachPopoverEditor(options) {
  const { app, file, popover, corner, content, component, t, render } = options;
  const button = corner.createEl("button", { cls: "lexis-popover-action", attr: { type: "button" } });
  corner.prepend(button);
  const resetButton = () => {
    (0, import_obsidian18.setIcon)(button, "pencil");
    button.setAttribute("title", t("popover.editEntry"));
    button.setAttribute("aria-label", t("popover.editEntry"));
  };
  resetButton();
  button.addEventListener("click", (event) => {
    void (async () => {
      event.preventDefault();
      event.stopPropagation();
      if (activePopoverEditors.has(popover)) {
        await finishPopoverEdit(popover);
        return;
      }
      if (options.mode() === "window") {
        new LexisQuickEditModal(app, file, t, async () => {
          if (popover.isConnected) await render();
        }).open();
        return;
      }
      popover.dataset.lexisEditing = "1";
      button.disabled = true;
      const load = app.vault.read(file);
      const loadingClose = async () => {
        try {
          await load;
        } catch {
          return true;
        }
        return activePopoverEditors.get(popover) === loadingClose ? false : finishPopoverEdit(popover);
      };
      activePopoverEditors.set(popover, loadingClose);
      try {
        const parts = splitEditableNote(await load);
        if (!popover.isConnected) {
          activePopoverEditors.delete(popover);
          delete popover.dataset.lexisEditing;
          return;
        }
        const session = new NoteEditSession(parts.body, (transform) => app.vault.process(file, transform));
        content.empty();
        const textarea = content.createEl("textarea", { cls: "lexis-popover-editor", attr: { "aria-label": t("popover.editEntry") } });
        textarea.value = parts.body;
        const status = content.createDiv({ cls: "lexis-popover-edit-status", text: t("popover.autosave"), attr: { "role": "status" } });
        const hostWindow = popover.ownerDocument.defaultView || window;
        let timer = 0;
        let composing = false;
        let finishing = null;
        const resize = () => {
          textarea.setCssStyles({ height: "auto" });
          textarea.setCssStyles({ height: `${Math.max(100, textarea.scrollHeight)}px` });
        };
        const save = async () => {
          hostWindow.clearTimeout(timer);
          if (composing) return false;
          status.setText(t("popover.saving"));
          try {
            await session.flush();
            status.setText(t("popover.saved"));
            return true;
          } catch (error) {
            status.setText(error instanceof NoteEditConflict ? t("popover.editConflict") : t("popover.readFailed", { error: errorMessage3(error) }));
            return false;
          }
        };
        const finish = () => {
          if (finishing === null) finishing = (async () => {
            if (!await save()) return false;
            if (session.dirty || composing) return false;
            activePopoverEditors.delete(popover);
            delete popover.dataset.lexisEditing;
            resetButton();
            if (popover.isConnected) {
              try {
                await render();
              } catch (error) {
                content.setText(t("popover.readFailed", { error: errorMessage3(error) }));
              }
            }
            return true;
          })().finally(() => {
            finishing = null;
          });
          return finishing;
        };
        activePopoverEditors.set(popover, finish);
        const changed = () => {
          session.update(textarea.value);
          resize();
          hostWindow.clearTimeout(timer);
          if (!composing) timer = hostWindow.setTimeout(() => {
            void save();
          }, 600);
        };
        textarea.addEventListener("input", changed);
        textarea.addEventListener("compositionstart", () => {
          composing = true;
          hostWindow.clearTimeout(timer);
        });
        textarea.addEventListener("compositionend", () => {
          composing = false;
          changed();
        });
        textarea.addEventListener("blur", () => {
          void save();
        });
        textarea.addEventListener("keydown", (event2) => {
          if (event2.key === "Enter" && (event2.metaKey || event2.ctrlKey) && !event2.isComposing) {
            event2.preventDefault();
            void finish();
          }
        });
        component.register(() => {
          hostWindow.clearTimeout(timer);
          void save();
        });
        (0, import_obsidian18.setIcon)(button, "check");
        button.setAttribute("title", t("common.done"));
        button.setAttribute("aria-label", t("common.done"));
        resize();
        textarea.focus();
      } catch (error) {
        activePopoverEditors.delete(popover);
        delete popover.dataset.lexisEditing;
        new import_obsidian18.Notice(t("popover.readFailed", { error: errorMessage3(error) }));
      } finally {
        button.disabled = false;
      }
    })();
  });
}

// src/reader-ui.ts
var obsidian4 = __toESM(require("obsidian"));

// src/reader-content.ts
function createReaderContent({ boundedSource: boundedSource2, Component: Component8, renderLexisMarkdown: renderLexisMarkdown2 }) {
  class ReaderContent {
    boldMatchesInPlace(el, word) {
      const re = new RegExp(boundedSource2(word), "ig");
      const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const targets2 = [];
      let node;
      while (node = walker.nextNode()) if (node.nodeType === Node.TEXT_NODE) targets2.push(node);
      for (const target of targets2) {
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
    async renderSentence(el, sentence, word, comp) {
      el.empty();
      const useComp = comp || new Component8();
      if (!comp) useComp.load();
      await renderLexisMarkdown2(this.app, sentence, el, "", useComp);
      this.boldMatchesInPlace(el, word);
    }
    compactSections(markdown) {
      return markdown.replace(/^#{2,6}[ \t].*\n(?:[ \t]*\n)*(?=#{1,6}[ \t]|$)/gm, "").trim();
    }
    stripForPreview(content) {
      return content.replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/```dataviewjs[\s\S]*?```/g, "").replace(/```dataview[\s\S]*?```/g, "").replace(/```(?:lexis|rel)\b[\s\S]*?```/g, "").trim();
    }
    async renderNoteInto(el, file, comp, keepLexis = false, maskAnswers = false) {
      const raw = await this.app.vault.cachedRead(file);
      let stripped = raw.replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/```dataviewjs[\s\S]*?```/g, "").replace(/```dataview[\s\S]*?```/g, "");
      if (!keepLexis) stripped = stripped.replace(/```(?:lexis|rel)\b[\s\S]*?```/g, "");
      if (maskAnswers) stripped = maskSyntaxAnswers(stripped, {
        inline: this.settings.flashcardInlineTemplate,
        bidirectional: this.settings.flashcardBidirectionalTemplate,
        block: this.settings.flashcardBlockTemplate,
        cloze: this.settings.flashcardClozeTemplate
      }, this.isInlineSourceFile(file) ? { inlineEntryDelimiter: this.settings.inlineEntryDelimiter } : {});
      const markdown = this.compactSections(stripped.trim()) || "*(\u7A7A)*";
      el.empty();
      await renderLexisMarkdown2(this.app, markdown, el, file.path, comp);
      const headings = el.querySelectorAll("h1, h2, h3, h4, h5, h6");
      const emptyHeadings = [];
      for (let index = 0; index < headings.length; index++) {
        const heading = headings[index];
        const next = headings[index + 1] || null;
        let sibling = heading.nextElementSibling;
        let hasContent = false;
        while (sibling && sibling !== next) {
          if ((sibling.textContent || "").trim() || sibling.querySelector(".lexis-section-title,.lexis-curve,.lexis-related,.lexis-occ,.lexis-occ-details,img,svg,video,iframe")) {
            hasContent = true;
            break;
          }
          sibling = sibling.nextElementSibling;
        }
        if (!hasContent) emptyHeadings.push(heading);
      }
      for (const heading of emptyHeadings) heading.remove();
    }
    async renderInlineEntryInto(el, entry, comp) {
      el.empty();
      const content = el.createDiv({ cls: "lexis-inline-annotation" });
      await renderLexisMarkdown2(this.app, entry.annotation || "*(\u65E0\u6279\u6CE8)*", content, entry.file.path, comp);
    }
  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(ReaderContent.prototype);
  return descriptors;
}

// src/reader-home-blocks.ts
var import_obsidian19 = require("obsidian");
function createReaderHomeBlocks(fmtDate) {
  class ReaderHomeBlocks {
    renderHeatmap(el) {
      const log = this.settings.reviewLog || {};
      const weeks = 18;
      const today = /* @__PURE__ */ new Date();
      const max = Math.max(1, ...Object.values(log).map(Number));
      const grid = el.createDiv({ cls: "lexis-hm-grid" });
      const current = new Date(today);
      current.setDate(current.getDate() - (weeks * 7 - 1));
      current.setDate(current.getDate() - current.getDay());
      let total = 0;
      for (let week = 0; week <= weeks; week++) {
        const column = grid.createDiv({ cls: "lexis-hm-col" });
        for (let day = 0; day < 7; day++) {
          const date = fmtDate(current);
          const cell = column.createDiv({ cls: "lexis-hm-cell" });
          if (current > today) cell.addClass("lexis-hm-future");
          else {
            const count = Number(log[date]) || 0;
            total += count;
            if (count > 0) cell.addClass("lexis-hm-l" + Math.min(4, Math.ceil(count / max * 4)));
            cell.setAttribute("title", this.t("home.heatmapDay", { date, count }));
            cell.setAttribute("role", "button");
            cell.tabIndex = 0;
            cell.addEventListener("click", (event) => {
              event.stopPropagation();
              void this.openReviewLog(date);
            });
            cell.addEventListener("keydown", (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.stopPropagation();
              void this.openReviewLog(date);
            });
          }
          current.setDate(current.getDate() + 1);
        }
      }
      el.createDiv({ cls: "lexis-hm-caption", text: this.t("home.heatmapCaption", { weeks, count: total }) });
    }
    renderHomeBlock(el, source = "", context) {
      el.addClass("lexis-home-block");
      if (!context) return;
      const component = new import_obsidian19.MarkdownRenderChild(el);
      context.addChild(component);
      const planName = /^plan:\s*(.+)$/m.exec(source)?.[1].trim();
      mountReviewDashboard(el, this, component, { compact: true, planName });
    }
  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(ReaderHomeBlocks.prototype);
  return descriptors;
}

// src/reader-popover-controls.ts
function confirmAction(obsidian9, app, title, message) {
  return new Promise((resolve) => {
    let settled = false;
    class ConfirmModal extends obsidian9.Modal {
      onOpen() {
        this.setTitle(title);
        this.contentEl.createEl("p", { text: message });
        const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
        actions.createEl("button", { text: "\u53D6\u6D88" }).addEventListener("click", () => this.close());
        actions.createEl("button", { cls: "mod-warning", text: "\u5220\u9664" }).addEventListener("click", () => {
          settled = true;
          resolve(true);
          this.close();
        });
      }
      onClose() {
        this.contentEl.empty();
        if (!settled) resolve(false);
      }
    }
    new ConfirmModal(app).open();
  });
}
function renderReaderPopoverControls({ obsidian: obsidian9, Notice: Notice20 }, meta, corner, body, entry, sourceSpan) {
  if (entry.inline) return;
  const baseKey = entry.file?.basename || entry.display;
  const path = entry.file?.path || "";
  const slash = path.lastIndexOf("/");
  const folder = slash > 0 ? path.slice(0, slash) : "";
  const shortFolder = (f) => String(f || this.t("common.root")).split("/").pop() || "";
  const folderChip = meta.createSpan({ cls: "lexis-popover-chip", text: shortFolder(folder) });
  folderChip.setAttribute("title", folder || this.t("common.root"));
  const dicts = this.dictFolders();
  if (dicts.length > 1) {
    folderChip.addClass("is-clickable");
    folderChip.setAttribute("title", `${folder || this.t("common.root")} \u2014 ${this.t("popover.moveDictionary")}`);
    folderChip.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const menu = new obsidian9.Menu();
      for (const target of dicts) menu.addItem((it) => it.setTitle(shortFolder(target)).setIcon(target === folder ? "check" : "folder").onClick(async () => {
        if (target === folder) return;
        const result = await this.bridgeMoveWord({ key: baseKey, folder: target });
        new Notice20(result.ok ? this.t("notice.moved", { folder: shortFolder(target) }) : this.t("notice.moveFailed", { error: result.error || this.t("common.failed") }));
        if (result.ok) this.removePopover();
      }));
      menu.showAtPosition({ x: ev.clientX, y: ev.clientY });
    });
  }
  const occurrenceBtn = meta.createEl("button", { cls: "lexis-popover-action", text: this.t("popover.addCurrentOccurrence") });
  occurrenceBtn.setAttribute("title", this.t("popover.addCurrentOccurrenceTitle"));
  occurrenceBtn.addEventListener("click", (ev) => {
    void (async () => {
      ev.preventDefault();
      ev.stopPropagation();
      const source = this.highlightSource(sourceSpan);
      occurrenceBtn.disabled = true;
      if (await this.addExampleToWord(entry.file, source.sentence, source.file, source.page)) {
        occurrenceBtn.setText("\u2713");
        occurrenceBtn.removeAttribute("title");
      } else occurrenceBtn.disabled = false;
    })();
  });
  const noteBtn = corner.createEl("button", { cls: "lexis-popover-action", attr: { type: "button" } });
  obsidian9.setIcon(noteBtn, "message-square-plus");
  noteBtn.setAttribute("title", this.t("popover.addNote"));
  noteBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const existing = body.querySelector(".lexis-popover-note-row");
    if (existing) {
      existing.querySelector("input")?.focus();
      return;
    }
    const row = body.createDiv({ cls: "lexis-popover-note-row" });
    const input = row.createEl("input", { attr: { type: "text", placeholder: this.t("popover.notePlaceholder") } });
    const imageInput = row.createEl("input", { cls: "lexis-popover-note-file", attr: { type: "file", accept: "image/*" } });
    const imageBtn = row.createEl("button", { cls: "lexis-popover-note-image", attr: { type: "button", title: this.t("popover.addImage") } });
    obsidian9.setIcon(imageBtn, "image-plus");
    input.addEventListener("click", (e) => e.stopPropagation());
    imageBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      imageInput.click();
    });
    imageInput.addEventListener("click", (e) => e.stopPropagation());
    imageInput.addEventListener("change", () => {
      void (async () => {
        const image = imageInput.files?.[0];
        if (!image) return;
        input.disabled = true;
        imageBtn.disabled = true;
        const result = await this.bridgeAnnotate({ key: baseKey, note: input.value.trim(), image });
        new Notice20(result.ok ? this.t("notice.noteAdded", { word: entry.display }) : this.t("notice.noteFailed", { error: result.error || this.t("common.failed") }));
        if (result.ok) this.removePopover();
        else {
          input.disabled = false;
          imageBtn.disabled = false;
          imageInput.value = "";
        }
      })();
    });
    input.addEventListener("keydown", (e) => {
      void (async () => {
        if (e.key === "Escape") {
          row.remove();
          return;
        }
        if (e.key !== "Enter") return;
        e.preventDefault();
        const note = input.value.trim();
        if (!note) {
          row.remove();
          return;
        }
        input.disabled = true;
        const result = await this.bridgeAnnotate({ key: baseKey, note });
        new Notice20(result.ok ? this.t("notice.noteAdded", { word: entry.display }) : this.t("notice.noteFailed", { error: result.error || this.t("common.failed") }));
        this.removePopover();
      })();
    });
    body.prepend(row);
    input.focus();
  });
  const delBtn = corner.createEl("button", { cls: "lexis-popover-action is-danger", text: "\u{1F5D1}" });
  delBtn.setAttribute("title", this.t("popover.deleteEntry"));
  delBtn.addEventListener("click", (ev) => {
    void (async () => {
      ev.preventDefault();
      ev.stopPropagation();
      if (!await confirmAction(obsidian9, this.app, this.t("popover.deleteEntry"), this.t("popover.deleteConfirm", { word: entry.display }))) return;
      const result = await this.bridgeDeleteWord(baseKey);
      new Notice20(result.ok ? this.t("notice.deleted", { word: entry.display }) : this.t("notice.deleteFailed", { error: result.error || this.t("common.failed") }));
      this.removePopover();
    })();
  });
  const tagWrap = body.createDiv({ cls: "lexis-popover-tags" });
  const tags = new Set(entry.tags || []);
  const renderTags = () => {
    tagWrap.empty();
    for (const tag of [...tags].sort()) {
      const pill = tagWrap.createSpan({ cls: "lexis-popover-tag", text: `#${tag}` });
      const remove = pill.createSpan({ cls: "lexis-popover-tag-remove", text: " \xD7" });
      remove.setAttribute("title", this.t("popover.deleteTag"));
      remove.addEventListener("click", (ev) => {
        void (async () => {
          ev.preventDefault();
          ev.stopPropagation();
          const result = await this.bridgeTagWord({ key: baseKey, tag, action: "remove" });
          if (result.ok) {
            tags.delete(tag);
            entry.tags = new Set(result.tags || []);
            renderTags();
          }
        })();
      });
    }
    const add = tagWrap.createSpan({ cls: "lexis-popover-tag is-add", text: tags.size ? "+" : this.t("popover.addTag") });
    add.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const menu = new obsidian9.Menu();
      for (const tag of this.collectVocabTags().filter((t) => !tags.has(t))) menu.addItem((it) => it.setTitle(`#${tag}`).setIcon("tag").onClick(async () => {
        const result = await this.bridgeTagWord({ key: baseKey, tag, action: "add" });
        if (result.ok) {
          tags.add(tag);
          entry.tags = new Set(result.tags || []);
          renderTags();
        }
      }));
      menu.showAtPosition({ x: ev.clientX, y: ev.clientY });
    });
  };
  renderTags();
}

// src/reader-ui.ts
function errorMessage4(error) {
  return error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
}
function createReaderUi({ buildCurveSVG: buildCurveSVG2, recentReviewDates: recentReviewDates2, FSRS: FSRS2, addDaysStr, daysBetween: daysBetween2, todayStr, fmtDate, TFile: TFile10, Notice: Notice20, boundedSource: boundedSource2, escapeRe: escapeRe2, Component: Component8, renderLexisMarkdown: renderLexisMarkdown2, openRestoreModal }) {
  class ReaderUi {
    // 遗忘曲线 SVG(FSRS 衰减)
    buildCurveSVG(card, limit = 8) {
      return buildCurveSVG2(card, {
        requestRetention: this.settings.requestRetention,
        nextInterval: (stability, retention) => FSRS2.nextInterval(stability, retention),
        retrievability: (elapsedDays, stability) => FSRS2.retrievability(elapsedDays, stability),
        addDaysStr,
        daysBetween: daysBetween2,
        todayStr
      }, { limit });
    }
    // 笔记内 ```lexis 代码块:曲线 + 相关词 + 出现过的地方
    async renderLexisBlock(el, ctx, src) {
      const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
      if (!(file instanceof TFile10)) {
        el.setText("Lexis:\u65E0\u6CD5\u8BC6\u522B\u5F53\u524D\u7B14\u8BB0");
        return;
      }
      const word = file.basename;
      el.addClass("lexis-block");
      const parts = (src || "").trim().split(/\s+/).filter(Boolean);
      const m = (parts[0] || "").toLowerCase();
      const typeArg = parts.slice(1).join(" ");
      const countBefore = el.children.length;
      if (m === "derived" || m === "\u6D3E\u751F") {
        await this.renderDerivedWords(el, file);
        if (el.children.length === countBefore) el.remove();
        return;
      }
      const showCurve = m === "" || m === "curve" || m === "all";
      const showRelated = m === "" || m === "refs" || m === "ref" || m === "rel" || m === "related" || m === "all";
      const showOcc = (m === "" || m === "refs" || m === "ref" || m === "occ" || m === "all") && this.settings.showOccurrences;
      if (showCurve) {
        const card = this.readCard(file);
        const svg = this.buildCurveSVG(card);
        if (svg) {
          const due = card.due ? ` \xB7 \u4E0B\u6B21\u590D\u4E60 ${String(card.due).slice(0, 10)}` : "";
          el.createDiv({ cls: "lexis-section-title", text: `\u{1F9E0} \u8BB0\u5FC6\u66F2\u7EBF\uFF08\u590D\u4E60\u65E5\u671F \xD7 \u4FDD\u7559\u7387${due}\uFF09` });
          const curve = el.createDiv({ cls: "lexis-curve" });
          const dates = recentReviewDates2(card);
          if (dates.length) curve.createDiv({ cls: "lexis-curve-history", text: this.t("curve.recentReviews", { dates: dates.map((date) => date.slice(5)).join(" \xB7 ") }) });
          const component = new obsidian4.MarkdownRenderChild(curve);
          ctx.addChild(component);
          mountCurveView(curve, component, () => this.readCard(file), (card2, limit) => this.buildCurveSVG(card2, limit), this.t.bind(this));
        }
      }
      if (showRelated) {
        if ((m === "rel" || m === "related") && typeArg) await this.renderReverseRelations(el, file, typeArg);
        else await this.renderTypedRelations(el, file);
      }
      if (showOcc) {
        const curated = await this.getCuratedSourcePaths(file);
        const list = (await this.findOccurrences(word)).filter((o) => !curated.has(o.file.basename.toLowerCase()));
        if (!list.length) return;
        const det = el.createEl("details", { cls: "lexis-occ-details" });
        det.createEl("summary", { text: `\u{1F4CD} \u51FA\u73B0\u8FC7\u7684\u5730\u65B9 (${list.length})` });
        const occWrap = det.createDiv();
        const comp = new obsidian4.MarkdownRenderChild(el);
        ctx.addChild(comp);
        for (const o of list) {
          const dd = occWrap.createDiv({ cls: "lexis-occ" });
          await this.renderSentence(dd, o.sentence, word, comp);
          const add = dd.createSpan({ cls: "lexis-occ-add", text: " \u2795" });
          add.setAttribute("title", "\u6536\u85CF\u5230\u51FA\u5904");
          add.addEventListener("click", () => {
            void (async () => {
              if (add.dataset.done) return;
              add.dataset.done = "1";
              if (await this.addExampleToWord(file, o.sentence, o.file, o.page)) {
                add.setText(" \u2713");
                add.setCssStyles({ cursor: "default" });
                add.removeAttribute("title");
              } else delete add.dataset.done;
            })();
          });
          const s2 = dd.createSpan({ cls: "lexis-occ-src", text: " \u2197 " + this.occurrenceLabel(o) });
          s2.setAttribute("data-lexis-review-link", o.file.path + (o.page ? `#page=${o.page}` : ""));
          s2.addEventListener("click", () => {
            void this.openOccurrence(o.file, word, o.page);
          });
        }
      }
      if (el.children.length === countBefore) el.remove();
    }
    // 把 alias 写进某词条文件的 frontmatter aliases(已存在则跳过,幂等)
    async addAliasToFile(file, alias) {
      if (!(file instanceof TFile10) || !alias) return;
      const inject = (data) => {
        const re = /^---\r?\n([\s\S]*?)\r?\n---/;
        const fm = re.exec(data);
        const line = `  - ${alias}
`;
        if (!fm) return `---
aliases:
${line}---
` + data;
        const body = fm[1];
        if (new RegExp(`(^|\\n)\\s*-\\s*["']?${escapeRe2(alias)}["']?\\s*($|\\n)`).test(body)) return data;
        if (/^aliases:/m.test(body)) return data.slice(0, fm.index) + `---
` + body.replace(/^(aliases:.*)$/m, `$1
${line}`) + `
---` + data.slice(fm.index + fm[0].length);
        return data.slice(0, fm.index) + `---
${body}
aliases:
${line}---` + data.slice(fm.index + fm[0].length);
      };
      if (this.app.vault.process) await this.app.vault.process(file, inject);
      else await this.app.vault.modify(file, inject(await this.app.vault.cachedRead(file)));
    }
    // 把当前选中的词并入目标词条(标题或别名解析到的同一个文件)的 aliases
    async attachAlias(aliasText, file) {
      aliasText = (aliasText || "").trim();
      if (!aliasText || !(file instanceof TFile10)) return;
      if (aliasText.toLowerCase() === file.basename.toLowerCase()) {
        new Notice20(this.t("notice.aliasSelf", { word: aliasText }));
        return;
      }
      try {
        await this.addAliasToFile(file, aliasText);
        await this.rebuildIndex(false);
        const ak = aliasText.toLowerCase();
        if (!this.index.has(ak)) this.index.set(ak, { display: aliasText, file, isAlias: true, tags: this.getTags(file) });
        new Notice20(this.t("notice.aliasAdded", { alias: aliasText, word: file.basename }));
      } catch (err) {
        new Notice20(this.t("notice.aliasFailed", { error: errorMessage4(err) }));
      }
    }
    openAndClose(file) {
      void this.app.workspace.getLeaf(false).openFile(file);
      this.removePopover();
    }
    async openInlineEntry(entry, newTab) {
      const leaf = this.app.workspace.getLeaf(newTab ? "tab" : false);
      await leaf.openFile(entry.file);
      try {
        const editor = leaf.view.editor;
        if (editor) {
          const offset = String(editor.getValue() || "").split(/\r?\n/).slice(0, entry.line || 0).reduce((n, line) => n + line.length + 1, 0);
          const pos = editor.offsetToPos(offset);
          editor.setCursor(pos);
          editor.scrollIntoView({ from: pos, to: pos }, true);
        }
      } catch {
      }
      this.removePopover();
    }
    async openOccurrence(file, word, page) {
      let leaf = this._occLeaf;
      if (!leaf || !leaf.parent) {
        leaf = this.app.workspace.getLeaf("tab");
        this._occLeaf = leaf;
      }
      await leaf.openFile(file, page ? { eState: { subpath: `#page=${page}` } } : void 0);
      await this.app.workspace.revealLeaf(leaf);
      try {
        const ed = leaf.view.editor;
        if (ed && word) {
          const m = new RegExp(boundedSource2(word), "i").exec(ed.getValue());
          if (m) {
            const pos = ed.offsetToPos(m.index);
            ed.setCursor(pos);
            ed.scrollIntoView({ from: pos, to: ed.offsetToPos(m.index + word.length) }, true);
          }
        }
      } catch {
      }
      this.removePopover();
    }
    highlightSource(span) {
      if (span === this._manualLookupAnchor && this._manualLookupSource) return this._manualLookupSource;
      const sourceDocument = span.ownerDocument;
      const locatedNode = overlayAnchorFor(span);
      let file = null;
      this.app.workspace.iterateAllLeaves((leaf) => {
        const view = leaf.view;
        if (!file && view.containerEl?.contains(locatedNode)) file = view.file || null;
      });
      if (!file) file = this.app.workspace.getActiveFile();
      const pageElement = span.closest("[data-page-number]");
      const pageValue = pageElement?.getAttribute("data-page-number") || "";
      const page = Number.parseInt(pageValue, 10) || void 0;
      const pdfSource = pdfTargetSource(span);
      if (pdfSource) {
        const container = pdfSource.startContainer.parentElement?.closest(".textLayer");
        if (!container) return { file, sentence: "", page };
        const before = sourceDocument.createRange();
        before.selectNodeContents(container);
        before.setEnd(pdfSource.startContainer, pdfSource.startOffset);
        return { file, sentence: this.extractSentence(container.textContent || "", before.toString().length), page };
      }
      const textContainer = span.closest("p,li,blockquote,td,th,figcaption,h1,h2,h3,h4,h5,h6,.cm-line,.textLayer") || span.parentElement;
      if (!textContainer) return { file, sentence: "", page };
      try {
        const range = sourceDocument.createRange();
        range.selectNodeContents(textContainer);
        range.setEndBefore(span);
        const sentence = this.extractSentence(textContainer.textContent || "", range.toString().length);
        return { file, sentence, page };
      } catch {
        return { file, sentence: (span.textContent || "").trim(), page };
      }
    }
    renderPopoverControls(meta, corner, body, entry, sourceSpan) {
      renderReaderPopoverControls.call(this, { obsidian: obsidian4, Notice: Notice20 }, meta, corner, body, entry, sourceSpan);
    }
    async showPopover(spanEl) {
      const key = spanEl.dataset.lexisKey;
      const entry = this.index.get(key);
      if (!entry) return;
      if (this._popover && this._popover.dataset.lexisKey === key) {
        this.readerHover.keepOpen();
        return;
      }
      if (this._popover?.dataset.lexisEditing === "1") return;
      if (!entry.inline) {
        this.recordEncounter(entry.file, "hover");
        void this.hoverFeedback(entry.file);
      }
      this.removePopover();
      const pop = overlayDocumentFor(spanEl).body.createDiv({ cls: "lexis-popover" });
      pop.dataset.lexisKey = key;
      this.applyPopoverAppearance(pop);
      const scroll = pop.createDiv({ cls: "lexis-popover-scroll" });
      const title = scroll.createDiv({ cls: "lexis-popover-title" });
      const heading = this.cardHeading(entry);
      title.createSpan({ cls: "lexis-popover-title-main", text: heading.title });
      if (heading.subtitle) title.createSpan({ cls: "lexis-popover-alias", text: heading.subtitle });
      if (entry.colorToken) {
        const label = entryColorLabel(entry.colorToken);
        const color = title.createSpan({ cls: `lexis-popover-entry-color${label ? "" : " is-color-only"}`, text: label });
        color.setAttribute("title", entry.colorToken);
        color.style.setProperty("--lexis-entry-color", this.colorForEntry(entry));
      }
      title.addEventListener("click", () => {
        if (entry.inline) void this.openInlineEntry(entry, false);
        else this.openAndClose(entry.file);
      });
      const corner = scroll.createDiv({ cls: "lexis-popover-corner" });
      const meta = scroll.createDiv({ cls: "lexis-popover-meta" });
      if (!entry.inline) {
        pop.addClass("has-corner-actions");
        const archiveBtn = meta.createSpan({ cls: "lexis-popover-archive", text: entry.archived ? `\u21A9 ${this.t("popover.restore")}` : `\u{1F4E6} ${this.t("popover.archive")}` });
        archiveBtn.setAttribute("title", this.t(entry.archived ? "popover.restoreTitle" : "popover.archiveTitle"));
        archiveBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (entry.archived) openRestoreModal(this.app, this, entry.file);
          else void this.setArchived(entry.file, true).then(() => new Notice20(this.t("notice.archived", { word: entry.file.basename })));
          this.removePopover();
        });
      }
      const body = scroll.createDiv({ cls: "lexis-popover-body" });
      body.setText(this.t("common.loading"));
      pop.addEventListener("mouseenter", () => this.readerHover.keepOpen());
      pop.addEventListener("mouseleave", () => this.scheduleHide());
      spanEl.addEventListener("mouseleave", () => this.scheduleHide(), { once: true });
      this._popover = pop;
      this.attachPopoverResize(pop, spanEl);
      this.positionPopover(pop, spanEl);
      try {
        body.empty();
        const comp = new Component8();
        comp.load();
        this._popoverComp = comp;
        this.renderPopoverControls(meta, corner, body, entry, spanEl);
        const contentEl = body.createDiv();
        if (entry.inline) await this.renderInlineEntryInto(contentEl, entry, comp);
        else await this.renderNoteInto(contentEl, entry.file, comp);
        if (this._popover !== pop) return;
        if (!entry.inline) attachPopoverEditor({
          app: this.app,
          file: entry.file,
          popover: pop,
          corner,
          content: contentEl,
          component: comp,
          mode: () => this.settings.popoverEditMode || "inline",
          t: (key2, vars) => this.t(key2, vars),
          render: async () => {
            contentEl.empty();
            await this.renderNoteInto(contentEl, entry.file, comp);
          }
        });
        if (!entry.inline && this.settings.showRelated) {
          const div = body.createDiv({ cls: "lexis-divider" });
          const n = await this.renderTypedRelations(body, entry.file);
          if (!n) div.remove();
        }
        if (!entry.inline && this.settings.showOccurrences) {
          body.createDiv({ cls: "lexis-divider" });
          const occTitle = body.createDiv({ cls: "lexis-section-title", text: `\u{1F4CD} ${this.t("popover.occurrences", { count: "\u2026" })}` });
          const occWrap = body.createDiv();
          occWrap.setText(this.t("common.searching"));
          const rawList = await this.findOccurrences(entry.display);
          if (this._popover === pop) {
            const curated = await this.getCuratedSourcePaths(entry.file);
            const list = rawList.filter((occurrence) => !curated.has(occurrence.file.basename.toLowerCase()));
            occTitle.setText(`\u{1F4CD} ${this.t("popover.occurrences", { count: list.length })}`);
            occWrap.empty();
            if (!list.length) occWrap.createDiv({ cls: "lexis-occ", text: this.t("popover.noOccurrences") });
            else for (const o of list) {
              const d = occWrap.createDiv({ cls: "lexis-occ" });
              await this.renderSentence(d, o.sentence, entry.display, comp);
              const add = d.createSpan({ cls: "lexis-occ-add", text: " \u2795" });
              add.setAttribute("title", this.t("popover.addOccurrence"));
              add.addEventListener("click", () => {
                void (async () => {
                  if (add.dataset.done) return;
                  add.dataset.done = "1";
                  if (await this.addExampleToWord(entry.file, o.sentence, o.file, o.page)) {
                    add.setText(" \u2713");
                    add.setCssStyles({ cursor: "default" });
                    add.removeAttribute("title");
                  } else delete add.dataset.done;
                })();
              });
              const src = d.createSpan({ cls: "lexis-occ-src", text: " \u2197 " + this.occurrenceLabel(o) });
              src.addEventListener("click", () => {
                void this.openOccurrence(o.file, entry.display, o.page);
              });
            }
            this.positionPopover(pop, spanEl);
          }
        }
        this.positionPopover(pop, spanEl);
      } catch (err) {
        body.setText(this.t("popover.readFailed", { error: errorMessage4(err) }));
      }
    }
    positionPopover(pop, spanEl) {
      const r = readerRectInDocument(spanEl.getBoundingClientRect(), spanEl.ownerDocument, pop.ownerDocument);
      const pr = pop.getBoundingClientRect();
      const hostWin = pop.ownerDocument.defaultView || window;
      let left = r.left, top = r.bottom + 6;
      if (left + pr.width > hostWin.innerWidth - 10) left = hostWin.innerWidth - pr.width - 10;
      if (left < 10) left = 10;
      if (top + pr.height > hostWin.innerHeight - 10) top = r.top - pr.height - 6;
      if (top < 10) top = 10;
      pop.setCssStyles({ left: left + "px", top: top + "px" });
    }
    applyPopoverAppearance(pop) {
      const width = Math.max(260, Number(this.settings.popoverWidth) || 460);
      const height = Math.max(160, Number(this.settings.popoverMaxHeight) || 420);
      const fontSize = "var(--font-text-size, 16px)";
      pop.setCssProps({
        "--lexis-popover-width": `${width}px`,
        "--lexis-popover-height": `${height}px`,
        "--lexis-popover-font-size": fontSize
      });
      pop.setCssStyles({
        width: `${width}px`,
        height: "",
        maxHeight: `${height}px`,
        fontSize
      });
    }
  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(ReaderUi.prototype);
  return {
    ...createReaderHomeBlocks(fmtDate),
    ...createReaderContent({ boundedSource: boundedSource2, Component: Component8, renderLexisMarkdown: renderLexisMarkdown2 }),
    ...descriptors
  };
}

// src/settings-sortable.ts
var import_obsidian20 = require("obsidian");

// src/settings-section.ts
var silentOpen = /* @__PURE__ */ new WeakMap();
function setSettingsSectionOpen(section, open) {
  const set = silentOpen.get(section);
  if (set) set(open);
  else section.open = open;
}
function createSettingsSection(container, title, {
  level = "group",
  collapsible = true,
  open = false,
  description = "",
  onToggle,
  key
} = {}) {
  const className = `lexis-settings-${level}`;
  const element = container.createEl(collapsible ? "details" : "div", { cls: className });
  if (key) element.dataset.lexisGroupKey = key;
  const heading = element.createEl(collapsible ? "summary" : "div", { cls: `${className}-heading` });
  const label = heading.createDiv({ cls: "lexis-settings-heading-label" });
  label.createSpan({ cls: `${className}-title`, text: title });
  if (description) label.createSpan({ cls: "lexis-settings-section-hint", text: description });
  const body = element.createDiv({ cls: `${className}-body` });
  if (collapsible) {
    const details = element;
    details.open = open;
    let previous = open;
    silentOpen.set(details, (next) => {
      previous = next;
      details.open = next;
    });
    if (onToggle) {
      details.addEventListener("toggle", () => {
        if (previous === details.open) return;
        previous = details.open;
        onToggle(details.open);
      });
    }
  }
  return { element, heading, body };
}

// src/settings-sortable.ts
function createSettingsSortable({ container, label, axis = "y", longPressMs = 320, onOrder, populateMenu, handleless = false, endBoundary }) {
  let pending = null, active = null, suppressClick = false;
  const items = () => Array.from(container.children).filter((child) => child.instanceOf(HTMLElement) && child.classList.contains("lexis-settings-sortable"));
  const ids = () => items().map((item) => item.dataset.lexisSortId);
  const clearTimer = () => {
    if (pending?.timer != null) window.clearTimeout(pending.timer);
    if (pending) pending.timer = null;
  };
  const move = (x, y) => {
    if (!active) return;
    active.item.style.left = `${Math.round(x - active.offsetX)}px`;
    active.item.style.top = `${Math.round(y - active.offsetY)}px`;
    const target = items().find((item) => {
      if (item === active?.item) return false;
      const rect = item.getBoundingClientRect();
      if (axis === "auto" && getComputedStyle(container).display === "grid") {
        return y < rect.top || y <= rect.bottom && x < rect.left + rect.width / 2;
      }
      return axis === "x" ? x < rect.left + rect.width / 2 : y < rect.top + rect.height / 2;
    });
    container.insertBefore(active.placeholder, target || endBoundary || null);
  };
  const start = () => {
    if (!pending || active) return;
    const { item, lastX, lastY } = pending;
    if (!item.isConnected) {
      finish(false);
      return;
    }
    const index = items().indexOf(item);
    if (index < 0) return;
    const open = item.tagName === "DETAILS" ? item.open : null;
    if (open) setSettingsSectionOpen(item, false);
    const rect = item.getBoundingClientRect(), style = getComputedStyle(item);
    const placeholder = container.createDiv({ cls: "lexis-settings-sort-placeholder" });
    placeholder.style.height = `${Math.ceil(rect.height)}px`;
    if (axis !== "y") placeholder.style.width = `${Math.ceil(rect.width)}px`;
    placeholder.style.marginTop = style.marginTop;
    placeholder.style.marginBottom = style.marginBottom;
    container.insertBefore(placeholder, item);
    active = {
      item,
      placeholder,
      next: item.nextSibling,
      index,
      style: item.style.cssText,
      open,
      offsetX: lastX - rect.left,
      offsetY: lastY - rect.top
    };
    item.classList.add("is-dragging");
    Object.assign(item.style, { position: "fixed", width: `${Math.ceil(rect.width)}px`, margin: "0", pointerEvents: "none", zIndex: "9999" });
    move(lastX, lastY);
  };
  const finish = (commit) => {
    clearTimer();
    if (active) {
      const { item, placeholder, next, index, style, open } = active;
      container.insertBefore(item, commit ? placeholder : next?.parentNode === container ? next : null);
      placeholder.remove();
      item.style.cssText = style;
      item.classList.remove("is-dragging");
      if (open != null) setSettingsSectionOpen(item, open);
      if (commit && items().indexOf(item) !== index) onOrder(ids(), item.dataset.lexisSortId);
      suppressClick = true;
      window.setTimeout(() => {
        suppressClick = false;
      }, 0);
    }
    if (pending) {
      try {
        pending.handle.releasePointerCapture(pending.pointerId);
      } catch {
      }
    }
    pending = null;
    active = null;
  };
  return {
    attach(item, heading, id) {
      item.classList.add("lexis-settings-sortable");
      item.dataset.lexisSortId = id;
      const handle = handleless ? heading : heading.createEl("button", { cls: "lexis-six-dots", attr: { type: "button", "aria-label": label, title: label } });
      if (!handleless) for (let index = 0; index < 6; index++) handle.createSpan({ cls: "lexis-sort-dot" });
      else handle.setAttribute("title", label);
      const disabled = () => handle.instanceOf(HTMLButtonElement) && handle.disabled || container.closest(".is-searching") != null;
      if (populateMenu) handle.setAttribute("aria-haspopup", "menu");
      handle.addEventListener("click", (event) => {
        if (handleless && !suppressClick) return;
        event.preventDefault();
        event.stopPropagation();
        if (handleless) event.stopImmediatePropagation();
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        if (!populateMenu) return;
        const menu = new import_obsidian20.Menu().setUseNativeMenu(false);
        populateMenu(menu, id);
        const rect = handle.getBoundingClientRect();
        menu.showAtPosition({ x: rect.right, y: rect.bottom }, handle.ownerDocument);
      }, { capture: handleless });
      handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || pending || disabled()) return;
        pending = { item, handle, pointerId: event.pointerId, pointerType: event.pointerType, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, timer: null };
        try {
          handle.setPointerCapture(event.pointerId);
        } catch {
        }
        if (event.pointerType === "touch" || handleless) pending.timer = window.setTimeout(start, longPressMs);
      });
      handle.addEventListener("pointermove", (event) => {
        if (!pending || event.pointerId !== pending.pointerId) return;
        pending.lastX = event.clientX;
        pending.lastY = event.clientY;
        const distance = Math.hypot(event.clientX - pending.x, event.clientY - pending.y);
        if (!active && !handleless && pending.pointerType !== "touch" && distance > 5) start();
        if (!active && (pending.pointerType === "touch" || handleless) && distance > 8) {
          finish(false);
          return;
        }
        if (active) {
          event.preventDefault();
          move(event.clientX, event.clientY);
        }
      }, { passive: false });
      handle.addEventListener("touchmove", (event) => {
        if (active && event.cancelable) event.preventDefault();
      }, { passive: false });
      handle.addEventListener("pointerup", (event) => {
        if (event.pointerId === pending?.pointerId) finish(true);
      });
      handle.addEventListener("pointercancel", (event) => {
        if (event.pointerId === pending?.pointerId) finish(false);
      });
      handle.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && active) {
          finish(false);
          return;
        }
        const previous = axis === "x" ? "ArrowLeft" : "ArrowUp", next = axis === "x" ? "ArrowRight" : "ArrowDown";
        if (disabled() || !event.altKey || ![previous, next].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        const siblings = items(), index = siblings.indexOf(item), target = siblings[index + (event.key === previous ? -1 : 1)];
        if (!target) return;
        container.insertBefore(item, event.key === previous ? target : target.nextSibling);
        onOrder(ids(), id);
        handle.focus();
      });
      handle.addEventListener("contextmenu", (event) => {
        if (active) event.preventDefault();
      });
    }
  };
}

// src/settings-controls.ts
function moveItem(items, from, to) {
  const next = Array.from(items || []);
  if (from === to || from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
function createReorderController({ container, onMove, label = "Reorder", longPressMs = 320 }) {
  let previous = [];
  const sorter = createSettingsSortable({
    container,
    label,
    axis: "auto",
    longPressMs,
    onOrder: (ids, movedId) => {
      const from = previous.indexOf(movedId), to = ids.indexOf(movedId);
      previous = ids;
      if (from >= 0 && to >= 0 && from !== to) void onMove(from, to);
    }
  });
  return {
    attach(item, index, { handleParent = item } = {}) {
      item.classList.add("lexis-sortable-item");
      handleParent.classList.add("lexis-sortable-row");
      item.dataset.lexisOrder = String(index);
      previous.push(String(index));
      sorter.attach(item, handleParent, String(index));
      handleParent.lastElementChild.classList.add("lexis-drag-handle");
    }
  };
}
function addAppearanceButton({ app, obsidian: obsidian9, parent, title, state, onChange, onReset, labels, allowStyle = false }) {
  const button = new obsidian9.ExtraButtonComponent(parent).setIcon("palette").setTooltip(title);
  const refreshButton = () => {
    const color = state().color;
    button.extraSettingsEl.setCssStyles({ color: color || "var(--text-accent)" });
  };
  button.onClick(() => {
    const modal = new obsidian9.Modal(app);
    modal.onOpen = () => {
      modal.contentEl.empty();
      modal.contentEl.createEl("h3", { text: title });
      new obsidian9.Setting(modal.contentEl).setName(labels.color).addColorPicker((picker) => picker.setValue(state().color).onChange((color) => {
        void Promise.resolve(onChange({ color })).then(refreshButton);
      }));
      new obsidian9.Setting(modal.contentEl).setName(labels.opacity).addSlider((slider) => slider.setLimits(0.1, 1, 0.05).setValue(state().opacity).onChange((opacity) => {
        void onChange({ opacity });
      }));
      if (allowStyle) {
        addCurrentChoice(new obsidian9.Setting(modal.contentEl).setName(labels.style), [
          { value: "", label: labels.defaultStyle },
          { value: "wavy", label: labels.wavy },
          { value: "underline", label: labels.underline },
          { value: "background", label: labels.background }
        ], state().style || "", async (style) => {
          await onChange({ style });
        });
      }
      new obsidian9.Setting(modal.contentEl).addButton((reset) => reset.setButtonText(labels.reset).onClick(() => {
        void Promise.resolve(onReset()).then(() => {
          refreshButton();
          modal.close();
        });
      })).addButton((done) => done.setButtonText(labels.done).setCta().onClick(() => modal.close()));
    };
    modal.open();
  });
  refreshButton();
  return button;
}

// src/template-provider.ts
function createTemplateProvider({ app, TFile: TFile10, getSettings, normalizeFolder, readTemplatePath }) {
  const lexisPathFor = (folder) => {
    const settings = getSettings();
    const normalized3 = normalizeFolder(folder);
    const row = (settings.dicts || []).find((item) => item && normalizeFolder(item.folder) === normalized3);
    return (row ? row.template || "" : settings.newWordTemplate || "").trim();
  };
  const templaterPlugin = () => app.plugins?.getPlugin("templater-obsidian") ?? null;
  const templaterTemplateFor = (folder) => {
    const plugin = templaterPlugin();
    if (!plugin?.templater?.write_template_to_file || plugin.settings?.trigger_on_file_creation_mode !== "folder") return null;
    const rules = Array.isArray(plugin.settings.folder_templates) ? plugin.settings.folder_templates : [];
    let current = normalizeFolder(folder);
    while (current) {
      const rule = rules.find((item) => normalizeFolder(item?.folder) === current && item?.template);
      if (rule) return { plugin, path: rule.template, folder: current };
      const slash = current.lastIndexOf("/");
      current = slash < 0 ? "" : current.slice(0, slash);
    }
    return null;
  };
  const readLexis = (folder) => readTemplatePath(lexisPathFor(folder));
  const create = async ({ path, folder, fallbackContent, transform = (content) => content }) => {
    const match = templaterTemplateFor(folder);
    if (!match) return app.vault.create(path, transform(fallbackContent));
    const templateFile = app.vault.getAbstractFileByPath(match.path);
    if (!(templateFile instanceof TFile10)) return app.vault.create(path, transform(fallbackContent));
    const file = await app.vault.create(path, "");
    await match.plugin.templater.write_template_to_file(templateFile, file);
    if (app.vault.process) await app.vault.process(file, transform);
    else await app.vault.modify(file, transform(await app.vault.cachedRead(file)));
    return file;
  };
  return { create, lexisPathFor, readLexis, templaterTemplateFor };
}

// src/settings-tab.ts
var import_obsidian33 = require("obsidian");

// src/settings-highlight-section.ts
function renderHighlightSettings(context) {
  const { Setting: Setting15, topSection, t, save, refresh, accentHex } = context;
  const hlSection = topSection("highlight", t("settings.highlight"));
  const highlightSwitch = new Setting15(hlSection).setName(t("settings.enableHighlight")).setDesc(t("settings.enableHighlightDesc"));
  const highlightOptions = hlSection.createEl("fieldset", { cls: "lexis-highlight-options" });
  let automaticGroups = [];
  const syncHighlightOptions = () => {
    highlightOptions.disabled = !this.plugin.settings.enableHighlight;
    highlightOptions.toggleClass("is-disabled", !this.plugin.settings.enableHighlight);
    const automatic = this.plugin.settings.enableHighlight && this.plugin.settings.highlightMode !== "manual";
    for (const group of automaticGroups) {
      group.toggleClass("is-disabled", !automatic);
      group.toggleAttribute("inert", !automatic);
    }
  };
  syncHighlightOptions();
  highlightSwitch.addToggle((toggle) => toggle.setValue(this.plugin.settings.enableHighlight).onChange(async (v) => {
    this.plugin.settings.enableHighlight = v;
    syncHighlightOptions();
    if (v && this.plugin.settings.enablePdfHighlight) this.plugin.setupPdfHighlight();
    else this.plugin.teardownPdfHighlight();
    await save();
    refresh();
  }));
  const scopeSection = createSettingsSection(highlightOptions, t("settings.highlightScope"), { key: "scope", collapsible: false });
  const scopeGroup = scopeSection.body;
  new Setting15(scopeGroup).setName(t("settings.livePreview")).setDesc(this.plugin.liveAvailable ? "" : t("settings.unsupported")).addToggle((t2) => t2.setValue(this.plugin.settings.enableLivePreview).setDisabled(!this.plugin.liveAvailable).onChange(async (v) => {
    this.plugin.settings.enableLivePreview = v;
    await save();
    refresh();
  }));
  new Setting15(scopeGroup).setName(t("settings.pdfHighlight")).setDesc(t("settings.pdfHighlightDesc")).addToggle((t2) => t2.setValue(this.plugin.settings.enablePdfHighlight).onChange(async (v) => {
    this.plugin.settings.enablePdfHighlight = v;
    await save();
    if (v) this.plugin.setupPdfHighlight();
    else {
      this.plugin.teardownPdfHighlight();
      this.plugin.rescanPdfLayers();
    }
  }));
  const interactionGroup = createSettingsSection(highlightOptions, t("settings.highlightInteraction"), { key: "interaction", collapsible: false }).body;
  const modeSetting = new Setting15(interactionGroup).setName(t("settings.highlightMode")).setDesc(t("settings.highlightModeDesc"));
  addCurrentChoice(modeSetting, [
    { value: "automatic", label: t("settings.highlightAutomatic") },
    { value: "manual", label: t("settings.highlightManual") }
  ], this.plugin.settings.highlightMode, async (mode) => {
    this.plugin.settings.highlightMode = mode;
    syncHighlightOptions();
    if (mode === "automatic" && this.plugin.settings.enablePdfHighlight) this.plugin.setupPdfHighlight();
    else this.plugin.teardownPdfHighlight();
    await save();
    refresh();
  });
  const styleSection = createSettingsSection(highlightOptions, t("settings.highlightAppearance"), { key: "style", collapsible: false });
  const styleGroup = styleSection.body;
  addCurrentChoice(new Setting15(styleGroup).setName(t("settings.highlightStyle")), [
    { value: "wavy", label: t("settings.wavy") },
    { value: "underline", label: t("settings.underline") },
    { value: "background", label: t("settings.background") }
  ], this.plugin.settings.highlightStyle, async (value) => {
    this.plugin.settings.highlightStyle = value;
    await save();
    refresh();
  });
  new Setting15(styleGroup).setName(t("settings.highlightColor")).addColorPicker((cp) => {
    this._colorComp = cp;
    cp.setValue(this.plugin.settings.highlightColor || accentHex).onChange(async (v) => {
      this.plugin.settings.highlightColor = v;
      await save();
      refresh();
    });
  }).addExtraButton((b) => b.setIcon("reset").setTooltip(t("settings.resetTheme")).onClick(async () => {
    this.plugin.settings.highlightColor = "";
    this._colorComp?.setValue(accentHex);
    await save();
    refresh();
  }));
  new Setting15(styleGroup).setName(t("settings.opacity")).addSlider((s) => s.setLimits(0.1, 1, 0.05).setValue(this.plugin.settings.highlightOpacity).onChange(async (v) => {
    this.plugin.settings.highlightOpacity = v;
    await save();
    refresh();
  }));
  new Setting15(styleGroup).setName(t("settings.fade")).setDesc(t("settings.fadeDesc")).addToggle((t2) => t2.setValue(this.plugin.settings.fadeByMemory).onChange(async (v) => {
    this.plugin.settings.fadeByMemory = v;
    await save();
    refresh();
  }));
  new Setting15(styleGroup).setName(t("settings.fadeFloor")).addSlider((s) => s.setLimits(0, 0.9, 0.05).setValue(this.plugin.settings.fadeFloor).onChange(async (v) => {
    this.plugin.settings.fadeFloor = v;
    await save();
    refresh();
  }));
  automaticGroups = [scopeSection.element, styleSection.element];
  syncHighlightOptions();
}
function renderVocabularyRules(context) {
  const { obsidian: obsidian9, Setting: Setting15, PathSuggest, topSection, t, save, refresh, accentHex, allTags, hasSuggest, appearanceLabels, createReorderController: createReorderController2, moveItem: moveItem2, addAppearanceButton: addAppearanceButton2 } = context;
  const rulesGroup = topSection("vocabulary-rules", t("settings.vocabularyRules"));
  const excludeSetting = new Setting15(rulesGroup).setName(t("settings.excludeTags")).setDesc(t("settings.excludeTagsDesc"));
  excludeSetting.settingEl.addClass("lexis-tags-setting");
  const excludeEditor = excludeSetting.controlEl.createDiv({ cls: "lexis-tag-editor" });
  const excludeChips = excludeEditor.createDiv({ cls: "lexis-tag-editor-chips" });
  const excludeAdd = excludeEditor.createDiv({ cls: "lexis-tag-editor-add" });
  const excludeInput = new obsidian9.TextComponent(excludeAdd).setPlaceholder(t("settings.addExcludedTag"));
  const excludedTags = () => [...new Set(this.plugin.parseTags(this.plugin.settings.excludeTags))];
  const saveExcludedTags = async (tags) => {
    this.plugin.settings.excludeTags = tags.join(" ");
    await save();
    await this.plugin.rebuildIndex(false);
  };
  const renderExcludedTags = () => {
    excludeChips.empty();
    for (const tag of excludedTags()) {
      const chip = excludeChips.createEl("button", { cls: "lexis-tag-editor-chip", attr: { type: "button", title: t("settings.removeExcludedTag", { tag }) } });
      chip.createSpan({ text: `#${tag}` });
      chip.createSpan({ cls: "lexis-tag-editor-remove", text: "\xD7" });
      chip.addEventListener("click", () => {
        void (async () => {
          await saveExcludedTags(excludedTags().filter((value) => value !== tag));
          renderExcludedTags();
        })();
      });
    }
  };
  const addExcludedTags = async (raw) => {
    const incoming = this.plugin.parseTags(raw);
    if (!incoming.length) return;
    await saveExcludedTags([.../* @__PURE__ */ new Set([...excludedTags(), ...incoming])]);
    excludeInput.setValue("");
    renderExcludedTags();
    excludeInput.inputEl.focus();
  };
  excludeInput.inputEl.addEventListener("keydown", (event) => {
    if (["Enter", ",", "\uFF0C", ";", "\uFF1B"].includes(event.key)) {
      event.preventDefault();
      void addExcludedTags(excludeInput.inputEl.value);
    } else if (event.key === "Backspace" && !excludeInput.inputEl.value) {
      const tags = excludedTags();
      if (tags.length) {
        tags.pop();
        void saveExcludedTags(tags).then(renderExcludedTags);
      }
    }
  });
  new obsidian9.ExtraButtonComponent(excludeAdd).setIcon("plus").setTooltip(t("settings.addExcludedTag")).onClick(() => {
    void addExcludedTags(excludeInput.inputEl.value);
  });
  if (hasSuggest) new PathSuggest(this.app, excludeInput.inputEl, () => allTags.filter((tag) => !excludedTags().includes(tag)), (value) => {
    void addExcludedTags(value);
  });
  renderExcludedTags();
  const tagColorSection = createSettingsSection(rulesGroup, t("settings.tagColors"), { key: "tag-colors", collapsible: false }).body;
  const rulesWrap = tagColorSection.createDiv();
  const renderRules = () => {
    rulesWrap.empty();
    const grid = rulesWrap.createDiv({ cls: "lexis-rule-grid" });
    const reorder = createReorderController2({
      container: grid,
      setIcon: obsidian9.setIcon,
      label: t("settings.reorder"),
      onMove: async (from, to) => {
        this.plugin.settings.tagRules = moveItem2(this.plugin.settings.tagRules, from, to);
        await save();
        refresh();
        renderRules();
      }
    });
    this.plugin.settings.tagRules.forEach((rule, i) => {
      const cell = grid.createDiv({ cls: "lexis-setting-row lexis-rule" });
      const tagIn = new obsidian9.TextComponent(cell).setPlaceholder(t("settings.tagPlaceholder")).setValue(rule.tag);
      const applyTag = async (v) => {
        rule.tag = (v || "").trim();
        await save();
        refresh();
      };
      tagIn.onChange(applyTag);
      if (hasSuggest) new PathSuggest(this.app, tagIn.inputEl, () => allTags, (v) => {
        tagIn.setValue(v);
        void applyTag(v);
      });
      addAppearanceButton2({
        app: this.app,
        obsidian: obsidian9,
        parent: cell,
        title: t("settings.tagAppearance"),
        labels: appearanceLabels,
        allowStyle: true,
        state: () => ({ color: rule.color || accentHex, opacity: Number(rule.opacity ?? this.plugin.settings.highlightOpacity), style: rule.style || "" }),
        onChange: async (patch) => {
          Object.assign(rule, patch);
          await save();
          refresh();
        },
        onReset: async () => {
          delete rule.color;
          delete rule.opacity;
          delete rule.style;
          await save();
          refresh();
        }
      });
      new obsidian9.ExtraButtonComponent(cell).setIcon("trash").setTooltip(t("common.delete")).onClick(async () => {
        this.plugin.settings.tagRules.splice(i, 1);
        await save();
        refresh();
        renderRules();
      });
      reorder.attach(cell, i);
    });
    const addRule = rulesWrap.createEl("button", { text: t("settings.addTagRule") });
    addRule.setCssStyles({ marginTop: "2px" });
    addRule.addEventListener("click", () => {
      void (async () => {
        this.plugin.settings.tagRules.push({ tag: "", color: accentHex, style: "" });
        await save();
        renderRules();
      })();
    });
  };
  renderRules();
}

// src/settings-inline-section.ts
function renderInlineSettings(context) {
  const { obsidian: obsidian9, Setting: Setting15, topSection, t, save, refresh, accentHex, appearanceLabels, createReorderController: createReorderController2, moveItem: moveItem2, addAppearanceButton: addAppearanceButton2 } = context;
  const inlineSection = topSection("inline", t("settings.inline"), { desc: t("settings.inlineDesc") });
  new Setting15(inlineSection).setName(t("settings.enableInline")).setDesc(t("settings.enableInlineDesc")).addToggle((t2) => t2.setValue(this.plugin.settings.inlineEntriesEnabled).onChange(async (v) => {
    this.plugin.settings.inlineEntriesEnabled = v;
    await save();
    await this.plugin.rebuildIndex(false);
    this.renderStats();
  }));
  const delimiterSetting = new Setting15(inlineSection).setName(t("settings.inlineDelimiter"));
  const updateDelimiterDescription = () => {
    const delimiter = this.plugin.inlineDelimiter();
    const conflict = inlineEntryConflictsWithFlashcard(delimiter, this.plugin.settings.flashcardInlineTemplate);
    delimiterSetting.setDesc(`${t("settings.inlineDelimiterDesc", { delimiter })}${conflict ? ` ${t("settings.syntaxConflict")}` : ""}`);
  };
  updateDelimiterDescription();
  delimiterSetting.addText((input) => input.setPlaceholder(DEFAULT_INLINE_ENTRY_DELIMITER).setValue(this.plugin.inlineDelimiter()).onChange(async (value) => {
    this.plugin.settings.inlineEntryDelimiter = (value || "").trim() || DEFAULT_INLINE_ENTRY_DELIMITER;
    updateDelimiterDescription();
    await save();
    await this.plugin.rebuildIndex(false);
    this.renderStats();
  }));
  new Setting15(inlineSection).setName(t("settings.inlineAliasDelimiter")).setDesc(t("settings.inlineAliasDelimiterDesc")).addText((t2) => t2.setPlaceholder("/").setValue(this.plugin.inlineAliasDelimiter()).onChange(async (v) => {
    this.plugin.settings.inlineAliasDelimiter = (v || "").trim() || "/";
    await save();
    await this.plugin.rebuildIndex(false);
    this.renderStats();
  }));
  const inlineSubsection = (key, title) => {
    return createSettingsSection(inlineSection, title, {
      key,
      open: this.plugin.settings.inlineSettingsCollapsed[key] !== true,
      onToggle: (open) => {
        this.plugin.settings.inlineSettingsCollapsed[key] = !open;
        void save();
      }
    }).body;
  };
  const entryColorGroup = inlineSubsection("entry-colors", t("settings.entryColors"));
  entryColorGroup.createDiv({ cls: "setting-item-description", text: t("settings.entryColorsDesc") });
  const missingColorsWrap = entryColorGroup.createDiv({ cls: "lexis-missing-entry-colors" });
  const entryColorsWrap = entryColorGroup.createDiv();
  const renderMissingColors = () => {
    missingColorsWrap.empty();
    const missing = unconfiguredEntryColorUsages(this.plugin.inlineColorTokenUsages || [], this.plugin.settings.entryColors);
    if (!missing.length) return;
    missingColorsWrap.createDiv({ cls: "lexis-missing-entry-colors-label", text: t("settings.unconfiguredEntryColors") });
    const list = missingColorsWrap.createDiv({ cls: "lexis-missing-entry-colors-list" });
    for (const usage of missing) {
      const add = list.createEl("button", {
        cls: "lexis-missing-entry-color",
        attr: { type: "button", title: t("settings.addUnconfiguredEntryColor", { name: usage.token }) }
      });
      add.createSpan({ text: usage.token });
      add.createSpan({ cls: "lexis-missing-entry-color-count", text: String(usage.count) });
      add.addEventListener("click", () => {
        void (async () => {
          this.plugin.settings.entryColors.push({ name: usage.token, color: accentHex });
          await save();
          refresh();
          renderEntryColors();
        })();
      });
    }
  };
  const renderEntryColors = () => {
    entryColorsWrap.empty();
    const grid = entryColorsWrap.createDiv({ cls: "lexis-rule-grid" });
    const reorder = createReorderController2({
      container: grid,
      setIcon: obsidian9.setIcon,
      label: t("settings.reorder"),
      onMove: async (from, to) => {
        this.plugin.settings.entryColors = moveItem2(this.plugin.settings.entryColors, from, to);
        await save();
        refresh();
        renderEntryColors();
      }
    });
    this.plugin.settings.entryColors.forEach((entryColor, index) => {
      const cell = grid.createDiv({ cls: "lexis-setting-row lexis-rule lexis-entry-color-row" });
      new obsidian9.TextComponent(cell).setPlaceholder(t("settings.entryColorPlaceholder")).setValue(entryColor.name).onChange(async (value) => {
        entryColor.name = value.trim();
        await save();
        refresh();
        renderMissingColors();
      });
      new obsidian9.ColorComponent(cell).setValue(entryColor.color || accentHex).onChange(async (value) => {
        entryColor.color = value;
        await save();
        refresh();
      });
      new obsidian9.ExtraButtonComponent(cell).setIcon("trash").setTooltip(t("common.delete")).onClick(async () => {
        this.plugin.settings.entryColors.splice(index, 1);
        await save();
        refresh();
        renderEntryColors();
      });
      reorder.attach(cell, index);
    });
    const addColor = entryColorsWrap.createEl("button", { text: t("settings.addEntryColor") });
    addColor.setCssStyles({ marginTop: "2px" });
    addColor.addEventListener("click", () => {
      void (async () => {
        this.plugin.settings.entryColors.push({ name: "", color: accentHex });
        await save();
        renderEntryColors();
      })();
    });
    renderMissingColors();
  };
  renderEntryColors();
  const classificationGroup = inlineSubsection("classification", t("settings.inlineClassificationSection"));
  let renderCategoryColors = () => {
  };
  let syncHeadingOptions = () => {
  };
  const classificationSetting = new Setting15(classificationGroup).setName(t("settings.inlineClassification")).setDesc(t("settings.inlineClassificationDesc"));
  addCurrentChoice(classificationSetting, [
    { value: "heading", label: t("settings.classifyByHeading") },
    { value: "file", label: t("settings.classifyByFile") }
  ], this.plugin.settings.inlineClassificationMode, async (mode) => {
    this.plugin.settings.inlineClassificationMode = mode;
    syncHeadingOptions();
    await save();
    renderCategoryColors();
    refresh();
  });
  classificationSetting.addExtraButton((button) => button.setIcon("refresh-cw").setTooltip(t("settings.refreshCategories")).onClick(async () => {
    await this.plugin.rebuildIndex(false);
    renderCategoryColors();
    this.renderStats();
  }));
  const headingOptions = classificationGroup.createDiv({ cls: "lexis-inline-heading-options" });
  const headingChoices = [{ value: "0", label: t("settings.nearestHeading") }];
  for (let level = 1; level <= 6; level++) headingChoices.push({ value: String(level), label: t("settings.headingLevel", { marks: "#".repeat(level), level }) });
  addCurrentChoice(
    new Setting15(headingOptions).setName(t("settings.inlineHeadingLevel")).setDesc(t("settings.inlineHeadingLevelDesc")),
    headingChoices,
    String(this.plugin.settings.inlineHeadingLevel),
    async (value) => {
      const level = Math.max(0, Math.min(6, Number.parseInt(value, 10) || 0));
      this.plugin.settings.inlineHeadingLevel = level;
      await save();
      await this.plugin.rebuildIndex(false);
      renderCategoryColors();
      this.renderStats();
    }
  );
  syncHeadingOptions = () => {
    headingOptions.hidden = this.plugin.settings.inlineClassificationMode === "file";
  };
  syncHeadingOptions();
  const categoryColorsWrap = classificationGroup.createDiv({ cls: "lexis-inline-tree" });
  const openInlineHeading = async (node) => {
    this.app.setting?.close();
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(node.file, { active: true });
    await this.app.workspace.revealLeaf(leaf);
    const reveal = () => {
      const editor = leaf.view instanceof obsidian9.MarkdownView ? leaf.view.editor : null;
      if (!editor) return;
      const position = { line: node.line, ch: 0 };
      editor.setCursor(position);
      editor.scrollIntoView({ from: position, to: position }, true);
    };
    reveal();
    window.setTimeout(reveal, 60);
  };
  renderCategoryColors = () => {
    categoryColorsWrap.empty();
    const occurrences = this.plugin.inlineCategoryOccurrences || [];
    if (!occurrences.length) {
      categoryColorsWrap.createEl("p", { cls: "setting-item-description", text: t("settings.noInlineCategories") });
      return;
    }
    const mode = this.plugin.settings.inlineClassificationMode === "file" ? "file" : "heading";
    const groupMap = /* @__PURE__ */ new Map();
    for (const node of occurrences) {
      const key = mode === "file" ? node.file.path : node.name;
      let group = groupMap.get(key);
      if (!group) {
        group = {
          id: `${mode}:${key}`,
          key,
          name: mode === "file" ? node.file.basename : node.name,
          count: 0,
          children: []
        };
        groupMap.set(key, group);
      }
      group.count += node.count;
      group.children.push(node);
    }
    const parentOrder = mode === "file" ? this.plugin.settings.inlineFileOrder : this.plugin.settings.inlineCategoryOrder;
    const parentRank = new Map(parentOrder.map((key, index) => [key, index]));
    let groups = [...groupMap.values()].sort((a, b) => {
      const ar = parentRank.has(a.key) ? parentRank.get(a.key) : Number.MAX_SAFE_INTEGER;
      const br = parentRank.has(b.key) ? parentRank.get(b.key) : Number.MAX_SAFE_INTEGER;
      return ar - br || a.name.localeCompare(b.name);
    });
    for (const group of groups) {
      const childRank = new Map((this.plugin.settings.inlineCategoryOrderByParent[group.id] || []).map((id, index) => [id, index]));
      group.children.sort((a, b) => {
        const ar = childRank.has(a.id) ? childRank.get(a.id) : Number.MAX_SAFE_INTEGER;
        const br = childRank.has(b.id) ? childRank.get(b.id) : Number.MAX_SAFE_INTEGER;
        const aLabel = mode === "file" ? a.name : a.file.path;
        const bLabel = mode === "file" ? b.name : b.file.path;
        return ar - br || aLabel.localeCompare(bLabel) || a.line - b.line;
      });
    }
    const colors = mode === "file" ? this.plugin.settings.inlineFileColors : this.plugin.settings.inlineCategoryColors;
    const opacities = mode === "file" ? this.plugin.settings.inlineFileOpacity : this.plugin.settings.inlineCategoryOpacity;
    const visibility = mode === "file" ? this.plugin.settings.inlineFileHighlight : this.plugin.settings.inlineCategoryHighlight;
    const sourceVisibility = this.plugin.settings.inlineSourceHighlight;
    const collapsed = this.plugin.settings.inlineCollapsedGroups;
    const rootReorder = createReorderController2({
      container: categoryColorsWrap,
      setIcon: obsidian9.setIcon,
      label: t("settings.reorder"),
      onMove: async (from, to) => {
        groups = moveItem2(groups, from, to);
        if (mode === "file") this.plugin.settings.inlineFileOrder = groups.map(({ key }) => key);
        else this.plugin.settings.inlineCategoryOrder = groups.map(({ key }) => key);
        await save();
        renderCategoryColors();
      }
    });
    groups.forEach((group, groupIndex) => {
      const enabled = visibility[group.key] !== false;
      const details = categoryColorsWrap.createEl("details", { cls: "lexis-inline-group" });
      details.open = collapsed[group.id] !== true;
      details.addEventListener("toggle", () => {
        void (async () => {
          collapsed[group.id] = !details.open;
          await save();
        })();
      });
      const summary = details.createEl("summary", { cls: "lexis-setting-row lexis-inline-group-row" });
      summary.createSpan({ cls: "lexis-inline-chevron" });
      summary.createSpan({ cls: "lexis-inline-group-name", text: group.name, attr: { title: group.key } });
      const parentControls = summary.createDiv({ cls: "lexis-inline-category-controls" });
      parentControls.addEventListener("click", (event) => event.stopPropagation());
      const countLabel = t("settings.entryCount", { count: group.count });
      parentControls.createSpan({ cls: "lexis-inline-count", text: countLabel, attr: { title: countLabel } });
      new obsidian9.ToggleComponent(parentControls).setTooltip(t("settings.showGroupHighlight")).setValue(enabled).onChange(async (value) => {
        visibility[group.key] = value;
        await save();
        refresh();
        renderCategoryColors();
      });
      addAppearanceButton2({
        app: this.app,
        obsidian: obsidian9,
        parent: parentControls,
        title: t("settings.categoryAppearance", { name: group.name }),
        labels: appearanceLabels,
        state: () => ({
          color: colors[group.key] || accentHex,
          opacity: Number(Object.prototype.hasOwnProperty.call(opacities, group.key) ? opacities[group.key] : this.plugin.settings.highlightOpacity)
        }),
        onChange: async (patch) => {
          if (patch.color != null) colors[group.key] = patch.color;
          if (patch.opacity != null) opacities[group.key] = patch.opacity;
          await save();
          refresh();
        },
        onReset: async () => {
          delete colors[group.key];
          delete opacities[group.key];
          await save();
          refresh();
        }
      });
      rootReorder.attach(details, groupIndex, { handleParent: summary });
      const childrenEl = details.createDiv({ cls: "lexis-inline-siblings lexis-inline-group-children" });
      const childReorder = createReorderController2({
        container: childrenEl,
        setIcon: obsidian9.setIcon,
        label: t("settings.reorder"),
        onMove: async (from, to) => {
          group.children = moveItem2(group.children, from, to);
          this.plugin.settings.inlineCategoryOrderByParent[group.id] = group.children.map(({ id }) => id);
          await save();
          renderCategoryColors();
        }
      });
      group.children.forEach((node, childIndex) => {
        const row = childrenEl.createDiv({ cls: `lexis-setting-row lexis-inline-category-row${enabled ? "" : " is-disabled"}` });
        const label = mode === "file" ? node.name : node.file.basename;
        const link = row.createEl("button", {
          cls: "lexis-inline-category-link",
          text: label,
          attr: { type: "button", title: `${node.file.path}:${node.line + 1}` }
        });
        link.addEventListener("click", () => {
          void openInlineHeading(node);
        });
        const childControls = row.createDiv({ cls: "lexis-inline-category-controls" });
        const childCount = t("settings.entryCount", { count: node.count });
        childControls.createSpan({ cls: "lexis-inline-count", text: childCount, attr: { title: childCount } });
        new obsidian9.ToggleComponent(childControls).setTooltip(t("settings.showSubsetHighlight")).setValue(sourceVisibility[node.id] !== false).setDisabled(!enabled).onChange(async (value) => {
          sourceVisibility[node.id] = value;
          await save();
          refresh();
        });
        childReorder.attach(row, childIndex);
      });
    });
  };
  renderCategoryColors();
}

// src/settings-storage-section.ts
function renderStorageSettings(context) {
  const { obsidian: obsidian9, Setting: Setting15, Notice: Notice20, PathSuggest, topSection, t, save, folders, hasSuggest, defaultEncounterFolder } = context;
  const dataSection = topSection("data", t("settings.dataStorage"), { open: true });
  dataSection.addClass("lexis-data-section");
  const encounterFolderSetting = new Setting15(dataSection).setName(t("settings.dataFolder")).setDesc(t("settings.dataFolderDesc"));
  encounterFolderSetting.settingEl.addClass("lexis-data-path-setting");
  const savedEncounterFolder = () => this.plugin.settings.dataFolder || defaultEncounterFolder;
  const folderInput = new obsidian9.TextComponent(encounterFolderSetting.controlEl).setValue(savedEncounterFolder());
  const undoFolder = new obsidian9.ExtraButtonComponent(encounterFolderSetting.controlEl).setIcon("undo").setTooltip(t("settings.encounterFolderUndo"));
  const confirmFolder = new obsidian9.ExtraButtonComponent(encounterFolderSetting.controlEl).setIcon("check").setTooltip(t("settings.dataFolderConfirm"));
  let switchingFolder = false;
  const refreshFolderActions = () => {
    const changed = folderInput.getValue().trim() !== savedEncounterFolder();
    undoFolder.setDisabled(!changed || switchingFolder);
    confirmFolder.setDisabled(!changed || switchingFolder);
  };
  folderInput.onChange(refreshFolderActions);
  folderInput.inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") event.preventDefault();
  });
  undoFolder.onClick(() => {
    folderInput.setValue(savedEncounterFolder());
    refreshFolderActions();
  });
  confirmFolder.onClick(() => {
    void (async () => {
      if (switchingFolder || folderInput.getValue().trim() === savedEncounterFolder()) return;
      switchingFolder = true;
      refreshFolderActions();
      try {
        const value = folderInput.getValue().trim();
        await this.plugin.setDataFolder(value);
        folderInput.setValue(savedEncounterFolder());
        new Notice20(t("settings.dataFolderSaved"));
      } catch (error) {
        new Notice20(t("settings.dataFolderError", { error: error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error" }));
      } finally {
        switchingFolder = false;
        refreshFolderActions();
      }
    })();
  });
  if (hasSuggest) new PathSuggest(this.app, folderInput.inputEl, () => folders, (value) => {
    folderInput.setValue(value);
    refreshFolderActions();
  });
  refreshFolderActions();
  new Setting15(dataSection).setName(t("settings.pluginDataPath")).setDesc(t("settings.pluginDataPathDesc", { path: `${this.app.vault.configDir}/plugins/${this.plugin.manifest.id}/data.json` }));
  const retention = new Setting15(dataSection).setName(t("settings.reviewRetention")).setDesc(t("settings.reviewRetentionDesc"));
  retention.settingEl.addClass("lexis-data-path-setting");
  const days = new obsidian9.TextComponent(retention.controlEl).setValue(String(this.plugin.settings.reviewEventsRetentionDays));
  days.inputEl.type = "number";
  days.inputEl.min = "1";
  days.inputEl.max = "3650";
  days.inputEl.step = "1";
  let savingDays = false;
  const undoDays = new obsidian9.ExtraButtonComponent(retention.controlEl).setIcon("undo").setTooltip(t("settings.encounterFolderUndo"));
  const confirmDays = new obsidian9.ExtraButtonComponent(retention.controlEl).setIcon("check").setTooltip(t("settings.reviewRetentionConfirm"));
  const updateDays = () => {
    const value = Number(days.getValue()), changed = value !== this.plugin.settings.reviewEventsRetentionDays;
    const pending = this.plugin.settings.reviewRetentionConfirmed !== true;
    const valid = Number.isInteger(value) && value >= 1 && value <= 3650;
    undoDays.setDisabled(savingDays || !changed);
    confirmDays.setDisabled(savingDays || !changed && !pending || !valid);
    if (pending && valid) {
      const current = learningData(this.plugin.settings), retained = pruneLearning(current, value);
      const count = (history) => Object.values(history).reduce((sum, events) => sum + events.length, 0);
      retention.setDesc(t("settings.reviewRetentionPending", { events: current.reviewEvents.length - retained.reviewEvents.length, points: count(current.reviewHistory) - count(retained.reviewHistory) }));
    } else retention.setDesc(t("settings.reviewRetentionDesc"));
  };
  days.onChange(updateDays);
  days.inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") event.preventDefault();
  });
  undoDays.onClick(() => {
    days.setValue(String(this.plugin.settings.reviewEventsRetentionDays));
    updateDays();
  });
  confirmDays.onClick(() => {
    void (async () => {
      const value = Number(days.getValue());
      if (savingDays || !Number.isInteger(value) || value < 1 || value > 3650) return;
      const previous = this.plugin.settings.reviewEventsRetentionDays;
      const previousConfirmation = this.plugin.settings.reviewRetentionConfirmed;
      savingDays = true;
      this.plugin.settings.reviewEventsRetentionDays = value;
      this.plugin.settings.reviewRetentionConfirmed = true;
      updateDays();
      try {
        await save();
        new Notice20(t("settings.reviewRetentionSaved"));
      } catch (error) {
        this.plugin.settings.reviewEventsRetentionDays = previous;
        this.plugin.settings.reviewRetentionConfirmed = previousConfirmation;
        new Notice20(t("settings.dataFolderError", { error: error instanceof Error ? error.message : "Unknown error" }));
      } finally {
        savingDays = false;
        updateDays();
      }
    })();
  });
  updateDays();
  const mobileSection = topSection("mobile", t("settings.mobileInteractions"), { desc: t("settings.mobileSectionDesc") });
  addCurrentChoice(new Setting15(mobileSection).setName(t("settings.mobileTapAction")).setDesc(t("settings.mobileTapDesc")), [
    { value: "popover", label: t("settings.mobileTapPopover") },
    { value: "open", label: t("settings.mobileTapOpen") }
  ], this.plugin.settings.mobileTapAction, async (value) => {
    this.plugin.settings.mobileTapAction = value;
    await save();
  });
  new Setting15(mobileSection).setName(t("settings.ratingOffset")).setDesc(t("settings.ratingOffsetDesc")).addSlider((s) => s.setLimits(0, 200, 5).setValue(this.plugin.settings.reviewBottomSpace).setInstant(true).onChange(async (value) => {
    this.plugin.settings.reviewBottomSpace = value;
    this.app.workspace.containerEl.ownerDocument.querySelectorAll('.workspace-leaf-content[data-type="lexis-review-view"]').forEach((view) => view.setCssProps({ "--lexis-review-bottom-space": `${value}px` }));
    await save();
  }));
}

// src/settings-reader-section.ts
var import_obsidian21 = require("obsidian");

// src/settings-selection-pill.ts
function addSelectionPillPosition(container, { Setting: Setting15, settings, t, save }) {
  let offset = { x: settings.selectionPillOffsetX ?? 0, y: settings.selectionPillOffsetY ?? 0 };
  let scale = normalizePillScale(settings.selectionPillScale);
  new Setting15(container).setName(t("settings.pillPosition")).setDesc(t("settings.pillPositionDesc")).addExtraButton((button) => button.setIcon("reset").setTooltip(t("settings.pillReset")).onClick(() => {
    offset = { x: 0, y: 0 };
    scale = 1;
    render();
    void persist();
  }));
  const preview = container.createDiv({ cls: "lexis-pill-position-preview" });
  const selection = preview.createSpan({ cls: "lexis-pill-position-selection", text: t("settings.pillPreviewText") });
  const handle = preview.createEl("button", { cls: "lexis-pill-position-handle", text: t("settings.pillDrag") });
  handle.type = "button";
  handle.setAttribute("aria-label", t("settings.pillDragLabel"));
  handle.title = t("settings.pillDragLabel");
  const controls = container.createDiv({ cls: "lexis-pill-position-inputs" });
  const inputs = {};
  for (const axis of ["x", "y"]) {
    const label = controls.createEl("label");
    label.createSpan({ text: t(axis === "x" ? "settings.pillOffsetX" : "settings.pillOffsetY") });
    const input = label.createEl("input", { type: "number" });
    input.step = "1";
    inputs[axis] = input;
    input.addEventListener("change", () => {
      if (Number.isFinite(input.valueAsNumber)) {
        offset[axis] = Math.round(input.valueAsNumber);
        void persist();
      }
      render();
    });
  }
  const scaleRow = controls.createEl("label", { cls: "lexis-pill-scale-control" });
  scaleRow.createSpan({ text: t("settings.pillSize") });
  const scaleInput = scaleRow.createEl("input", { type: "range" });
  scaleInput.min = "75";
  scaleInput.max = "150";
  scaleInput.step = "5";
  scaleInput.setAttribute("aria-label", t("settings.pillSize"));
  const scaleValue = scaleRow.createEl("output");
  scaleInput.addEventListener("input", () => {
    scale = normalizePillScale(scaleInput.valueAsNumber / 100);
    render();
  });
  scaleInput.addEventListener("change", () => {
    void persist();
  });
  function render() {
    preview.style.setProperty("--lexis-pill-scale", String(scale));
    preview.style.setProperty("--lexis-pill-x", `${offset.x}px`);
    preview.style.setProperty("--lexis-pill-y", `${offset.y}px`);
    inputs.x.value = String(offset.x);
    inputs.y.value = String(offset.y);
    scaleInput.value = String(Math.round(scale * 100));
    scaleValue.textContent = `${Math.round(scale * 100)}%`;
  }
  async function persist() {
    settings.selectionPillOffsetX = offset.x;
    settings.selectionPillOffsetY = offset.y;
    settings.selectionPillScale = scale;
    await save();
  }
  let drag = null;
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || drag) return;
    event.preventDefault();
    handle.focus({ preventScroll: true });
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: handle.offsetLeft, top: handle.offsetTop, initial: { ...offset } };
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const anchor = { left: selection.offsetLeft, bottom: selection.offsetTop + selection.offsetHeight };
    const position = positionSelectionPill(
      anchor,
      { width: handle.offsetWidth, height: handle.offsetHeight },
      { width: preview.clientWidth, height: preview.clientHeight },
      { x: drag.left + event.clientX - drag.x - anchor.left, y: drag.top + event.clientY - drag.y - anchor.bottom - 6 }
    );
    offset = { x: Math.round(position.left - anchor.left), y: Math.round(position.top - anchor.bottom - 6) };
    render();
  });
  handle.addEventListener("pointerup", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    drag = null;
    handle.releasePointerCapture(event.pointerId);
    void persist();
  });
  const cancelDrag = (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    offset = drag.initial;
    drag = null;
    render();
  };
  handle.addEventListener("pointercancel", cancelDrag);
  handle.addEventListener("lostpointercapture", cancelDrag);
  handle.addEventListener("keydown", (event) => {
    if (drag) return;
    const directions = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 }
    };
    const delta = directions[event.key];
    if (!delta) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    offset = { x: offset.x + delta.x * step, y: offset.y + delta.y * step };
    render();
    void persist();
  });
  render();
}

// src/settings-reader-section.ts
function renderReaderSettings({ plugin, topSection, PathSuggest, mdFiles, hasSuggest }) {
  const t = plugin.t.bind(plugin), save = () => plugin.saveSettings();
  const card = topSection("popover", t("settings.readingInteractions"));
  new import_obsidian21.Setting(card).setName(t("settings.clickHighlightToOpen")).setDesc(t("settings.clickHighlightToOpenDesc")).addToggle((toggle) => toggle.setValue(plugin.settings.clickHighlightToOpen !== false).onChange(async (value) => {
    plugin.settings.clickHighlightToOpen = value;
    await save();
  }));
  addCurrentChoice(new import_obsidian21.Setting(card).setName(t("settings.popoverEditMode")), [
    { value: "inline", label: t("settings.popoverEditInline") },
    { value: "window", label: t("settings.popoverEditWindow") }
  ], plugin.settings.popoverEditMode, async (value) => {
    plugin.settings.popoverEditMode = value;
    await save();
  });
  new import_obsidian21.Setting(card).setName(t("settings.hoverDelay")).setDesc(t("settings.hoverDelayDesc")).addSlider((slider) => slider.setLimits(0, 3, 0.1).setValue(plugin.settings.hoverDelayMs / 1e3).onChange(async (value) => {
    plugin.settings.hoverDelayMs = Math.round(value * 1e3);
    await save();
  }));
  new import_obsidian21.Setting(card).setName(t("settings.showRelated")).addToggle((toggle) => toggle.setValue(plugin.settings.showRelated).onChange(async (value) => {
    plugin.settings.showRelated = value;
    await save();
  }));
  new import_obsidian21.Setting(card).setName(t("settings.selectionPill")).addToggle((toggle) => toggle.setValue(plugin.settings.selectionPill).onChange(async (value) => {
    plugin.settings.selectionPill = value;
    await save();
    if (!value) plugin.removeSelPill();
  }));
  const dictionary = t("home.reviewDictionary");
  addCurrentChoice(new import_obsidian21.Setting(card).setName(t("settings.selectionPillOrder")), [
    { value: "add-dictionary-alias", label: `\uFF0B \xB7 ${dictionary} \xB7 \u{1F517}` },
    { value: "add-alias-dictionary", label: `\uFF0B \xB7 \u{1F517} \xB7 ${dictionary}` },
    { value: "dictionary-add-alias", label: `${dictionary} \xB7 \uFF0B \xB7 \u{1F517}` },
    { value: "dictionary-alias-add", label: `${dictionary} \xB7 \u{1F517} \xB7 \uFF0B` },
    { value: "alias-add-dictionary", label: `\u{1F517} \xB7 \uFF0B \xB7 ${dictionary}` },
    { value: "alias-dictionary-add", label: `\u{1F517} \xB7 ${dictionary} \xB7 \uFF0B` }
  ], plugin.settings.selectionPillOrder, async (value) => {
    plugin.settings.selectionPillOrder = value;
    await save();
    plugin.removeSelPill();
  });
  addSelectionPillPosition(card, { Setting: import_obsidian21.Setting, settings: plugin.settings, t, save });
  const templates = topSection("templates", t("settings.newEntry"));
  addCurrentChoice(new import_obsidian21.Setting(templates).setName(t("settings.emptyNotePreset")).setDesc(t("settings.emptyNotePresetDesc")), [
    { value: "blank", label: t("settings.emptyNoteBlank") },
    { value: "occ", label: t("settings.emptyNoteOccurrences") }
  ], plugin.settings.emptyNotePreset, async (value) => {
    plugin.settings.emptyNotePreset = value;
    await save();
  });
  new import_obsidian21.Setting(templates).setName(t("settings.defaultTemplate")).setDesc(t("settings.defaultTemplateDesc")).addText((input) => {
    input.setValue(plugin.settings.newWordTemplate);
    const apply = async (value) => {
      plugin.settings.newWordTemplate = value.trim();
      await save();
    };
    input.onChange(apply);
    if (hasSuggest) new PathSuggest(plugin.app, input.inputEl, () => mdFiles, (value) => {
      input.setValue(value);
      void apply(value);
    });
  });
  const sources2 = topSection("occurrences", t("settings.sourcesAndNotes"));
  const clear = async () => {
    plugin._occCache.clear();
    await save();
  };
  new import_obsidian21.Setting(sources2).setName(t("settings.showOccurrences")).setDesc(t("settings.showOccurrencesDesc")).addToggle((toggle) => toggle.setValue(plugin.settings.showOccurrences).onChange(async (value) => {
    plugin.settings.showOccurrences = value;
    await clear();
  }));
  new import_obsidian21.Setting(sources2).setName(t("settings.pdfOccurrences")).setDesc(t("settings.pdfOccurrencesDesc")).addToggle((toggle) => toggle.setValue(plugin.settings.includePdfOccurrences !== false).onChange(async (value) => {
    plugin.settings.includePdfOccurrences = value;
    await clear();
  }));
  new import_obsidian21.Setting(sources2).setName(t("settings.occurrenceLimit")).addSlider((slider) => slider.setLimits(1, 15, 1).setValue(plugin.settings.occurrenceLimit).onChange(async (value) => {
    plugin.settings.occurrenceLimit = value;
    await clear();
  }));
  new import_obsidian21.Setting(sources2).setName(t("settings.occurrenceScope")).setDesc(t("settings.occurrenceScopeDesc")).addText((input) => input.setPlaceholder(t("settings.wholeVault")).setValue(plugin.settings.occurrenceFolders).onChange(async (value) => {
    plugin.settings.occurrenceFolders = value.trim();
    await clear();
  }));
  const occurrence = new import_obsidian21.Setting(sources2).setName(t("settings.occurrenceTemplate")).setDesc(t("settings.occurrenceTemplateDesc")).addTextArea((input) => input.setPlaceholder(DEFAULT_SETTINGS.occurrenceTemplate).setValue(plugin.settings.occurrenceTemplate).onChange(async (value) => {
    plugin.settings.occurrenceTemplate = value;
    await save();
  }));
  occurrence.settingEl.addClass("lexis-template-setting");
  occurrence.controlEl.querySelector("textarea").rows = 4;
  new import_obsidian21.Setting(sources2).setName(t("settings.annotationHeading")).setDesc(t("settings.annotationHeadingDesc")).addText((input) => input.setPlaceholder("#### \u6279\u6CE8").setValue(plugin.settings.annotationHeading).onChange(async (value) => {
    plugin.settings.annotationHeading = value;
    await save();
  }));
}

// src/settings-tab-name-modal.ts
var import_obsidian22 = require("obsidian");
function askSettingsTabName(app, title, current, done, deleteLabel, deleteHint) {
  return new Promise((resolve) => {
    class NameModal extends import_obsidian22.Modal {
      constructor() {
        super(...arguments);
        this.result = null;
      }
      onOpen() {
        this.setTitle(title);
        let draft = current;
        const commit = () => {
          if (draft.trim()) {
            this.result = draft.trim();
            this.close();
          }
        };
        new import_obsidian22.Setting(this.contentEl).addText((input) => {
          input.setValue(current).onChange((value) => {
            draft = value;
          });
          input.inputEl.setAttribute("aria-label", title);
          input.inputEl.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          });
          window.setTimeout(() => {
            input.inputEl.focus();
            input.inputEl.select();
          }, 0);
        }).addButton((button) => button.setButtonText(done).setCta().onClick(commit));
        if (deleteLabel) new import_obsidian22.Setting(this.contentEl).setDesc(deleteHint || "").addButton((button) => {
          button.buttonEl.addClass("mod-warning");
          button.setButtonText(deleteLabel).onClick(() => {
            this.result = { delete: true };
            this.close();
          });
        });
      }
      onClose() {
        this.contentEl.empty();
        resolve(this.result);
      }
    }
    new NameModal(app).open();
  });
}

// src/settings-manual.ts
var import_obsidian24 = require("obsidian");

// src/settings-manual-preview.ts
var import_obsidian23 = require("obsidian");
function createManualPreview(host) {
  const today = localDate(/* @__PURE__ */ new Date());
  const file = (basename) => {
    const record2 = Object.create(import_obsidian23.TFile.prototype);
    if (!(record2 instanceof import_obsidian23.TFile)) throw new Error("Cannot create syntax demo file");
    return Object.assign(record2, { basename, name: `${basename}.md`, path: `Lexis-demo/${basename}.md`, extension: "md" });
  };
  const word = file("warm"), source = file("Example"), cold = file("cold");
  const files = new Map([word, source, cold].map((item) => [item.path, item]));
  const relation = { type: host.t("manual.relationType"), sourceFile: cold, targetFile: word };
  const relationMarkdown = `## ${relation.type}
[[${word.basename}]]`;
  const documents = /* @__PURE__ */ new Map([[cold.path, relationMarkdown], [word.path, ""]]);
  const reviewLog = Object.fromEntries(Array.from({ length: 21 }, (_, index) => [addDays(today, -index), [6, 12, 0, 9, 18, 4, 15][index % 7]]));
  const settings = {
    ...structuredClone(DEFAULT_SETTINGS),
    language: host.settings?.language || "zh",
    dicts: [],
    vocabFolders: "",
    excludeTags: "",
    reviewLog,
    reviewEvents: [],
    reviewGoalHistory: Object.fromEntries(Object.keys(reviewLog).map((date) => [date, { goal: 15, minimum: 5 }]))
  };
  const card = {
    s: 12,
    d: 4,
    last: addDays(today, -1),
    due: addDays(today, 5),
    reps: 3,
    lapses: 0,
    history: [12, 5, 1].map((days, index) => ({ date: addDays(today, -days), s: [3, 7, 12][index], grade: 3, retention: [0, 75, 84][index] }))
  };
  const summary = { date: today, goal: 15, minimum: 5, completed: 6, remaining: 9, retry: 1, due: 8, fresh: 4, total: 32, options: {} };
  const dashboard = { today: summary, plans: [{ plan: { id: "demo", name: host.t("manual.examplePlan"), sources: [], content: "notes" }, summary, items: [] }] };
  for (const [date, count] of Object.entries(reviewLog)) for (let index = 0; index < count; index++) settings.reviewEvents.push({
    id: `${date}-${index}`,
    date,
    timestamp: `${date}T12:00:00`,
    precision: "day",
    type: "note",
    filePath: word.path,
    label: `Example ${index}`,
    memberKeys: [`demo-${index}`],
    grade: 3,
    retention: 85
  });
  const preview = {
    settings,
    t: host.t.bind(host),
    app: {
      vault: { getAbstractFileByPath: (path) => files.get(path) || null, cachedRead: async (file2) => documents.get(file2.path) || "" },
      metadataCache: {
        resolvedLinks: { [cold.path]: { [word.path]: 1 } },
        getFirstLinkpathDest: (target) => files.get(`Lexis-demo/${target}.md`) || null
      },
      workspace: { getLeaf: () => ({ openFile: async () => {
      } }), onLayoutReady: (callback) => callback() }
    },
    renderLexisBlock(el, ctx, source2) {
      return host.renderLexisBlock.call(preview, el, ctx, source2);
    },
    renderHomeBlock(el, source2, ctx) {
      host.renderHomeBlock.call(preview, el, source2, ctx);
    },
    renderHeatmap(el) {
      host.renderHeatmap.call(preview, el);
    },
    buildCurveSVG: host.buildCurveSVG.bind(host),
    renderTypedRelations(el, file2) {
      return host.renderTypedRelations.call(preview, el, file2);
    },
    renderReverseRelations(el, file2, type) {
      return host.renderReverseRelations.call(preview, el, file2, type);
    },
    renderDerivedWords(el, file2) {
      return host.renderDerivedWords.call(preview, el, file2);
    },
    relLink(el, path, basename) {
      host.relLink.call(preview, el, path, basename);
    },
    renderSentence: host.renderSentence.bind(host),
    occurrenceLabel: host.occurrenceLabel.bind(host),
    readCard: () => card,
    findTypedRelations(file2) {
      return host.findTypedRelations.call(preview, file2);
    },
    getCuratedSourcePaths: async () => /* @__PURE__ */ new Set(),
    findOccurrences: async () => [{ file: source, sentence: "A warm light filled the room." }],
    inVocabFolder: () => true,
    addExampleToWord: async () => false,
    openOccurrence: async () => {
    },
    removePopover: () => {
    },
    openReviewLog: async () => {
    },
    openReview: async () => {
    },
    openHome: async () => {
    },
    reviewDashboard: { load: async () => dashboard, subscribe: () => () => {
    }, refresh: () => {
    } }
  };
  return { preview, sourcePath: word.path, relation, relationMarkdown };
}

// src/settings-manual.ts
var examples = [
  { title: "manual.complete", fence: "lexis", source: "" },
  { title: "manual.curve", fence: "lexis", source: "curve" },
  { title: "manual.relations", fence: "rel", source: "" },
  { title: "manual.occurrences", fence: "lexis", source: "occ" },
  { title: "manual.derived", fence: "lexis", source: "derived" },
  { title: "manual.home", fence: "lexis-home", source: "" },
  { title: "manual.plan", fence: "lexis-home", source: "" },
  { title: "manual.heatmap", fence: "lexis-heatmap", source: "" }
];
var fence = (name, source) => `\`\`\`${name}
${source}${source ? "\n" : ""}\`\`\``;
function renderSettingsManual(container, host, component) {
  const t = host.t.bind(host);
  container.createEl("p", { cls: "setting-item-description", text: t("manual.description") });
  let active = true, rendered = false;
  component.register(() => {
    active = false;
  });
  const context = {
    sourcePath: "",
    docId: "lexis-settings-demo",
    frontmatter: null,
    addChild: (child) => {
      if (active) component.addChild(child);
      else child.unload();
    },
    getSectionInfo: () => null
  };
  const section = container.parentElement;
  const render = async () => {
    if (rendered || !section.open || !active) return;
    rendered = true;
    let demo;
    try {
      demo = createManualPreview(host);
    } catch (error) {
      console.warn("[Lexis] Cannot initialize syntax examples", error);
      container.createEl("p", { cls: "setting-item-description", text: t("manual.failed") });
      return;
    }
    const { preview, sourcePath: sourcePath2, relation, relationMarkdown } = demo;
    context.sourcePath = sourcePath2;
    for (const example of examples) {
      if (!active) return;
      const block = container.createDiv({ cls: "lexis-manual-example" });
      block.setAttribute("data-manual-example", example.title);
      const header = block.createDiv({ cls: "lexis-manual-heading" });
      header.createEl("h4", { text: t(example.title) });
      const source = example.fence === "rel" ? t("manual.relationType") : example.title === "manual.plan" ? `plan: ${t("manual.examplePlan")}` : example.source;
      const code = fence(example.fence, source);
      const copy2 = header.createEl("button", { attr: { type: "button", title: t("manual.copy"), "aria-label": t("manual.copy") } });
      (0, import_obsidian24.setIcon)(copy2, "copy");
      component.registerDomEvent(copy2, "click", () => {
        void navigator.clipboard.writeText(code).then(() => new import_obsidian24.Notice(t("manual.copied"))).catch(() => new import_obsidian24.Notice(t("manual.copyFailed")));
      });
      if (example.fence === "rel") {
        block.createEl("pre").createEl("code", { text: fence("rel", t("manual.relationPlaceholder")) });
        block.createEl("p", { cls: "setting-item-description", text: t("manual.relationVariable", { example: relation.type }) });
        block.createEl("p", { cls: "setting-item-description", text: t("manual.relationFlow", { from: relation.sourceFile.name, to: relation.targetFile.name }) });
      }
      if (example.title === "manual.derived") block.createEl("p", { cls: "setting-item-description", text: t("manual.backlinksDescription") });
      const file = ["lexis", "rel"].includes(example.fence) ? "warm.md" : t("manual.exampleHomeFile");
      const notes = [{ file, path: sourcePath2, markdown: code, source: example.fence === "rel" ? `rel ${source}` : source }];
      if (example.fence === "rel" || example.title === "manual.derived") notes.unshift({
        file: relation.sourceFile.name,
        path: relation.sourceFile.path,
        markdown: `${relationMarkdown}

${fence("lexis", "rel")}`,
        source: "rel"
      });
      for (const note of notes) {
        if (!active) return;
        const pair = block.createDiv({ cls: "lexis-manual-pair" });
        pair.setAttribute("data-manual-file", note.file);
        const input = pair.createDiv({ cls: "lexis-manual-input" });
        input.createDiv({ cls: "lexis-manual-label", text: t("manual.writing") });
        input.createDiv({ cls: "lexis-manual-file", text: example.title === "manual.complete" || example.title === "manual.curve" ? t("manual.reviewedFile", { file: note.file }) : note.file });
        input.createEl("pre").createEl("code", { text: note.markdown });
        const result = pair.createDiv({ cls: "lexis-manual-result" });
        result.createDiv({ cls: "lexis-manual-label", text: t("manual.result") });
        const output = result.createDiv({ cls: "lexis-manual-output" });
        output.setAttribute("inert", "");
        try {
          if (example.fence === "lexis-heatmap") preview.renderHeatmap(output);
          else if (example.fence === "lexis-home") preview.renderHomeBlock(output, note.source, { ...context, sourcePath: note.path });
          else await preview.renderLexisBlock(output, { ...context, sourcePath: note.path }, note.source);
          for (const details of output.querySelectorAll("details")) details.open = true;
        } catch {
          if (active) output.setText(t("manual.failed"));
        }
      }
    }
  };
  component.registerDomEvent(section, "toggle", () => {
    void render();
  });
  void render();
}

// src/settings-section-order.ts
function orderedSectionKeys(available, saved) {
  const allowed = new Set(available);
  const previous = Array.isArray(saved) ? saved.filter((key) => typeof key === "string") : [];
  return [.../* @__PURE__ */ new Set([...previous, ...available])].filter((key) => typeof key === "string" && allowed.has(key));
}

// src/settings-navigation-model.ts
var SETTINGS_TABS = [
  { id: "general", label: "settings.tabGeneral", sections: ["general", "data"] },
  { id: "vocabulary", label: "settings.tabVocabulary", sections: ["dictionary", "inline", "vocabulary-rules", "templates"] },
  { id: "reading", label: "settings.tabStyle", sections: ["highlight", "popover", "occurrences"] },
  { id: "review", label: "settings.tabReview", sections: ["review"] },
  { id: "integrations", label: "settings.tabIntegrations", sections: ["bridge", "marginnote"] },
  { id: "other", label: "settings.tabOther", sections: ["mobile", "manual"] }
];
function settingsTabGroups(custom = [], names = {}, t) {
  const groups = SETTINGS_TABS.map((tab) => ({ id: tab.id, name: names[tab.id]?.trim() || t(tab.label) }));
  for (const group of custom) if (group.id.startsWith("custom-") && group.name.trim() && !groups.some((item) => item.id === group.id)) groups.push({ id: group.id, name: group.name.trim() });
  return groups;
}
function settingsTabForSection(key, assignments, groups = SETTINGS_TABS) {
  const saved = assignments[key];
  if (groups.some((tab) => tab.id === saved)) return saved;
  return SETTINGS_TABS.find((tab) => tab.sections.includes(key))?.id || "general";
}
function reorderVisibleSections(order, visible) {
  const keys = new Set(visible);
  let index = 0;
  return order.map((key) => keys.has(key) ? visible[index++] : key);
}

// src/settings-group-order.ts
function orderSettingsGroups(sections, saved, label, onOrder) {
  for (const [sectionKey, section] of sections) {
    const parents = /* @__PURE__ */ new Map();
    for (const group of section.querySelectorAll(".lexis-settings-group[data-lexis-group-key]")) {
      const parent = group.parentElement, siblings = parents.get(parent) || [];
      siblings.push(group);
      parents.set(parent, siblings);
    }
    for (const [parent, groups] of parents) {
      const parentGroup = parent.closest("[data-lexis-group-key]");
      const path = `${sectionKey}/${parentGroup?.dataset.lexisGroupKey || "root"}`;
      const byKey = new Map(groups.map((group) => [group.dataset.lexisGroupKey, group]));
      const order = orderedSectionKeys([...byKey.keys()], saved[path]);
      const slots = groups.map((group) => {
        const slot = group.ownerDocument.createComment("settings group");
        group.replaceWith(slot);
        return slot;
      });
      slots.forEach((slot, index) => slot.replaceWith(byKey.get(order[index])));
      const sort = createSettingsSortable({ container: parent, label, onOrder: (ids) => {
        saved = { ...saved, [path]: ids };
        onOrder(saved);
      } });
      order.forEach((key) => {
        const group = byKey.get(key);
        sort.attach(group, group.querySelector(":scope > .lexis-settings-group-heading"), key);
      });
    }
  }
}

// src/settings-search.ts
function matchesSettingsSearch(text, query) {
  return query.trim().split(/\s+/u).every((part) => Number.isFinite(fuzzyScore(part, text)));
}
function createSettingsSearch({ container, tabs, panels, sections, activeTab, t, setIcon: setIcon10, onRefresh }) {
  const search = container.createDiv({ cls: "lexis-settings-search" });
  tabs.before(search);
  setIcon10(search.createSpan({ cls: "lexis-settings-search-icon" }), "search");
  const input = search.createEl("input", { type: "search", attr: { placeholder: t("settings.search"), "aria-label": t("settings.search") } });
  const clear = search.createEl("button", { cls: "lexis-settings-search-clear", attr: { type: "button", "aria-label": t("settings.clearSearch") } });
  setIcon10(clear, "x");
  const empty = container.createDiv({ cls: "lexis-settings-search-empty", text: t("settings.noSearchResults"), attr: { role: "status" } });
  const folds = /* @__PURE__ */ new Map();
  const refresh = () => {
    const query = input.value.trim();
    clear.hidden = !query;
    tabs.hidden = !!query;
    container.classList.toggle("is-searching", !!query);
    for (const handle of container.querySelectorAll(".lexis-six-dots")) handle.disabled = !!query;
    if (!query) {
      for (const [section, open] of folds) setSettingsSectionOpen(section, open);
      folds.clear();
    }
    let count = 0;
    for (const [id, panel] of panels) {
      const label = panel.querySelector(".lexis-settings-search-group-label");
      label.hidden = !query;
      let matched = false;
      for (const section of sections.values()) {
        if (section.parentElement !== panel) continue;
        const found = !query || matchesSettingsSearch(`${label.textContent} ${section.textContent}`, query);
        section.hidden = !found;
        if (!found) continue;
        matched = true;
        count++;
        if (query) for (const fold of [section, ...section.querySelectorAll("details.lexis-settings-group")]) {
          if (!folds.has(fold)) folds.set(fold, fold.open);
          setSettingsSectionOpen(fold, true);
        }
      }
      panel.hidden = query ? !matched : id !== activeTab();
      panel.setAttribute("role", query ? "region" : "tabpanel");
    }
    empty.hidden = !query || count > 0;
    onRefresh?.();
  };
  const clearSearch = () => {
    input.value = "";
    refresh();
    input.focus();
  };
  input.addEventListener("input", refresh);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && input.value) {
      event.preventDefault();
      clearSearch();
    }
  });
  clear.addEventListener("click", clearSearch);
  refresh();
  return { refresh };
}

// src/settings-navigation.ts
var navigationSequence = 0;
function createSettingsNavigation(container, sections, options) {
  const prefix = `lexis-settings-navigation-${++navigationSequence}`;
  const header = container.createDiv({ cls: "lexis-settings-navigation-header" });
  container.before(header);
  const tabs = header.createDiv({ cls: "lexis-settings-tabs", attr: { role: "tablist", "aria-label": options.t("settings.title") } });
  let order = orderedSectionKeys([...sections.keys()], options.sectionOrder);
  let names = { ...options.tabNames };
  let custom = [...options.customTabs || []];
  const groups = settingsTabGroups(custom, names, options.t);
  let tabOrder = orderedSectionKeys(groups.map((tab) => tab.id), options.tabOrder);
  let assignments = { ...options.assignments };
  let active = tabOrder.includes(options.activeTab) ? options.activeTab : "general";
  const buttons = /* @__PURE__ */ new Map(), panels = /* @__PURE__ */ new Map();
  let search;
  let refreshFoldAction = () => {
  };
  const activate = (id, persist = true) => {
    const changed = active !== id;
    active = id;
    for (const [key, button] of buttons) {
      button.setAttribute("aria-selected", String(key === id));
      button.tabIndex = key === id ? 0 : -1;
      button.parentElement.classList.toggle("is-active", key === id);
    }
    search?.refresh();
    const current = buttons.get(id).parentElement.getBoundingClientRect(), viewport = tabs.getBoundingClientRect();
    if (current.left < viewport.left) tabs.scrollLeft -= viewport.left - current.left;
    else if (current.right > viewport.right) tabs.scrollLeft += current.right - viewport.right;
    if (changed && persist) options.onTabChange(id);
  };
  const tabFor = (key) => settingsTabForSection(key, assignments, groups);
  const placeSections = () => {
    for (const key of order) panels.get(tabFor(key)).appendChild(sections.get(key));
  };
  const addTab = tabs.createEl("button", { cls: "lexis-settings-add-tab", attr: { type: "button", "aria-label": options.t("settings.addTab"), title: options.t("settings.addTab") } });
  options.setIcon(addTab, "plus");
  const tabSort = createSettingsSortable({ container: tabs, axis: "x", handleless: true, endBoundary: addTab, label: options.t("settings.reorder"), onOrder: (ids) => {
    tabOrder = ids;
    options.onTabOrderChange(ids);
  } });
  const addGroup = ({ id, name }) => {
    const wrapper = tabs.createDiv({ cls: "lexis-settings-tab-wrapper", attr: { role: "presentation" } });
    tabs.insertBefore(wrapper, addTab);
    const button = wrapper.createEl("button", { cls: "lexis-settings-tab", text: name, attr: { type: "button", role: "tab" } });
    button.id = `${prefix}-${id}`;
    tabSort.attach(wrapper, button, id);
    const panel = container.createDiv({ cls: "lexis-settings-tabpanel lexis-settings-sections" });
    panel.id = `${button.id}-panel`;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", button.id);
    panel.createDiv({ cls: "lexis-settings-search-group-label", text: name }).hidden = true;
    button.setAttribute("aria-controls", panel.id);
    buttons.set(id, button);
    panels.set(id, panel);
    button.addEventListener("click", () => activate(id));
    button.addEventListener("keydown", (event) => {
      if (event.altKey || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const index = tabOrder.indexOf(id);
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabOrder.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabOrder.length) % tabOrder.length;
      buttons.get(tabOrder[next]).focus();
      activate(tabOrder[next]);
    });
  };
  for (const id of tabOrder) addGroup(groups.find((group) => group.id === id));
  placeSections();
  const sorters = /* @__PURE__ */ new Map();
  const addSorter = (id, panel) => sorters.set(id, createSettingsSortable({
    container: panel,
    label: options.t("settings.reorderMenu"),
    onOrder: (ids) => {
      order = reorderVisibleSections(order, ids);
      options.onOrderChange(order);
    },
    populateMenu: (menu, key) => {
      for (const destination of groups) if (destination.id !== tabFor(key)) {
        menu.addItem((item) => item.setTitle(options.t("settings.moveToTab", { tab: destination.name })).setIcon("folder-input").onClick(() => {
          assignments = { ...assignments, [key]: destination.id };
          options.onAssignmentsChange(assignments);
          const section = sections.get(key);
          section.querySelector(":scope > summary > .lexis-six-dots").remove();
          placeSections();
          sorters.get(destination.id).attach(section, section.querySelector(":scope > summary"), key);
          search.refresh();
        }));
      }
    }
  }));
  for (const [id, panel] of panels) addSorter(id, panel);
  for (const [key, section] of sections) sorters.get(tabFor(key)).attach(section, section.querySelector(":scope > summary"), key);
  orderSettingsGroups(sections, options.groupOrder, options.t("settings.reorder"), options.onGroupOrderChange);
  search = createSettingsSearch({ container, tabs, panels, sections, activeTab: () => active, t: options.t, setIcon: options.setIcon, onRefresh: () => refreshFoldAction() });
  const tools = header.createDiv({ cls: "lexis-settings-tab-tools" });
  const action = (icon, title, run) => {
    const button = tools.createEl("button", { attr: { type: "button", title: options.t(title), "aria-label": options.t(title) } });
    options.setIcon(button, icon);
    button.addEventListener("click", run);
    return button;
  };
  const rename = action("pencil", "settings.renameTab", () => {
    void (async () => {
      const group = groups.find((group2) => group2.id === active);
      const result = await options.requestTabName?.(group.name, group.id.startsWith("custom-"));
      if (!result || !header.isConnected) return;
      if (typeof result !== "string") {
        const index = groups.findIndex((item) => item.id === group.id);
        if (index < 0 || !group.id.startsWith("custom-")) return;
        groups.splice(index, 1);
        custom = custom.filter((item) => item.id !== group.id);
        tabOrder = tabOrder.filter((id) => id !== group.id);
        const nextAssignments = Object.fromEntries(Object.entries(assignments).filter(([, id]) => id !== group.id));
        assignments = nextAssignments;
        placeSections();
        buttons.get(group.id)?.parentElement?.remove();
        panels.get(group.id)?.remove();
        buttons.delete(group.id);
        panels.delete(group.id);
        sorters.delete(group.id);
        delete names[group.id];
        options.onGroupsChange?.(names, custom);
        options.onTabOrderChange(tabOrder);
        options.onAssignmentsChange(assignments);
        activate(tabOrder[0] || "general");
        return;
      }
      const name = result;
      group.name = name;
      names = { ...names, [group.id]: name };
      custom = custom.map((item) => item.id === group.id ? { ...item, name } : item);
      buttons.get(group.id).textContent = name;
      panels.get(group.id).querySelector(".lexis-settings-search-group-label").textContent = name;
      options.onGroupsChange?.(names, custom);
      search.refresh();
    })();
  });
  const visibleFolds = () => [...panels.values()].filter((panel) => !panel.hidden).flatMap((panel) => [...panel.querySelectorAll("details.lexis-settings-section, details.lexis-settings-group")]).filter((details) => !details.closest("[hidden]"));
  const fold = action("chevrons-up-down", "settings.expandAll", () => {
    const details = visibleFolds(), open = !details.every((item) => item.open);
    for (const item of details) item.open = open;
    refreshFoldAction();
  });
  fold.dataset.settingsFold = "";
  refreshFoldAction = () => {
    const details = visibleFolds(), collapse = details.length > 0 && details.every((item) => item.open);
    const label = options.t(collapse ? "settings.collapseAll" : "settings.expandAll");
    options.setIcon(fold, collapse ? "chevrons-down-up" : "chevrons-up-down");
    fold.setAttribute("aria-label", label);
    fold.title = label;
    fold.disabled = !details.length;
  };
  container.addEventListener("toggle", refreshFoldAction, true);
  tools.appendChild(rename);
  addTab.addEventListener("click", () => {
    void (async () => {
      const result = await options.requestTabName?.("");
      if (typeof result !== "string" || !result || !header.isConnected) return;
      const name = result;
      const group = { id: `custom-${crypto.randomUUID()}`, name };
      custom.push(group);
      groups.push(group);
      tabOrder.push(group.id);
      addGroup(group);
      tabs.appendChild(addTab);
      addSorter(group.id, panels.get(group.id));
      options.onGroupsChange?.(names, custom);
      options.onTabOrderChange(tabOrder);
      activate(group.id);
    })();
  });
  activate(active, false);
}

// src/settings-review-goals.ts
var import_obsidian25 = require("obsidian");
function renderReviewGoalSettings(parent, plugin) {
  const group = createSettingsSection(parent, plugin.t("dashboard.goalSettings"), { key: "goals" }).body;
  group.createDiv({ cls: "setting-item-description", text: plugin.t("dashboard.goalHint") });
  for (const [field, label, minimum] of [["reviewMinimumGoal", "dashboard.minimum", 0], ["reviewDailyGoal", "dashboard.goal", 1]]) {
    new import_obsidian25.Setting(group).setName(plugin.t(label)).addText((input) => {
      input.inputEl.type = "number";
      input.inputEl.min = String(minimum);
      input.inputEl.max = "10000";
      input.setValue(String(plugin.settings[field])).onChange(async (value) => {
        if (!value.trim()) return;
        const count = Number(value);
        if (!Number.isInteger(count) || count < minimum || count > 1e4) return;
        plugin.settings[field] = count;
        await plugin.saveSettings();
      });
    });
  }
  group.createDiv({ cls: "lexis-dim", text: plugin.t("dashboard.countHint") });
}

// src/settings-marginnote.ts
var import_obsidian28 = require("obsidian");

// src/marginnote-protocol.ts
function obsidianEntryUri(vault, path, heading) {
  const target = path + (heading ? `#${heading}` : "");
  return `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(target)}`;
}
function parseMarginNoteDictionary(text) {
  const value = JSON.parse(text);
  if (value?.format !== "lexis-marginnote" || value.version !== 1 || typeof value.source?.id !== "string" || !value.source.id || typeof value.source.vault !== "string" || typeof value.revision !== "string" || !Array.isArray(value.entries)) throw new Error("\u4E0D\u662F Lexis \u7684 MarginNote \u8BCD\u5E93\u6587\u4EF6 / Not a Lexis dictionary");
  const ids = /* @__PURE__ */ new Set();
  for (const entry of value.entries) {
    if (!entry || typeof entry.id !== "string" || !entry.id || ids.has(entry.id) || typeof entry.title !== "string" || !entry.title.trim() || !Array.isArray(entry.aliases) || !entry.aliases.every((alias) => typeof alias === "string") || typeof entry.markdown !== "string" || typeof entry.uri !== "string" || !/^obsidian:\/\/open\?/.test(entry.uri) || entry.path !== void 0 && (typeof entry.path !== "string" || entry.path.startsWith("/") || entry.path.split("/").some((part) => part === "..")) || entry.inline !== void 0 && typeof entry.inline !== "boolean" || entry.color !== void 0 && (typeof entry.color !== "string" || !/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(entry.color)) || entry.colorLabel !== void 0 && typeof entry.colorLabel !== "string") throw new Error("\u8BCD\u5E93\u6761\u76EE\u65E0\u6548 / Invalid dictionary entry");
    ids.add(entry.id);
  }
  return value;
}

// src/marginnote-export-data.ts
function dictionaryMarkdown(markdown) {
  return markdown.replace(/^---\r?\n(?:[\s\S]*?\r?\n)?---(?:\r?\n|$)/, "").replace(/^```(?:lexis|lexis-home|rel)\b[^\n]*\n[\s\S]*?^```\s*$/gm, "").trim();
}
async function buildMarginNoteDictionary(vault, index, read, options = {}) {
  const groups = /* @__PURE__ */ new Map();
  for (const entry of index.values()) {
    if (entry.archived || entry.retired || options.include?.(entry) === false) continue;
    const title = entry.inline ? entry.canonical || entry.display : entry.file.basename;
    const id = JSON.stringify([entry.file.path, entry.inline ? title : ""]);
    let group = groups.get(id);
    if (!group) {
      group = { entry: { ...entry, display: title }, aliases: /* @__PURE__ */ new Set() };
      groups.set(id, group);
    }
    if (entry.display === title) group.entry = { ...entry, display: title };
    if (entry.display !== title) group.aliases.add(entry.display);
    for (const alias of entry.aliases || []) group.aliases.add(alias);
  }
  const entries = [];
  for (const [id, { entry, aliases }] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const headingPath = entry.headingPath || [];
    const heading = entry.inline ? headingPath[headingPath.length - 1]?.name : void 0;
    const color = options.color?.(entry) || "";
    entries.push({
      id,
      title: entry.display,
      aliases: [...aliases].sort(),
      markdown: entry.inline ? entry.annotation || "" : dictionaryMarkdown(await read(entry)),
      uri: obsidianEntryUri(vault, entry.file.path, heading),
      path: entry.file.path,
      inline: !!entry.inline,
      ...color && /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color) ? { color, colorLabel: entryColorLabel(entry.colorToken) } : {}
    });
  }
  const source = { id: `obsidian:${vault}`, vault };
  const data = new TextEncoder().encode(JSON.stringify({ source, entries }));
  const digest = await crypto.subtle.digest("SHA-256", data);
  const revision = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return { format: "lexis-marginnote", version: 1, source, revision, entries };
}
function marginNoteExportPath(folder) {
  const path = folder.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (!path || path.startsWith("/") || /^[a-z]:/i.test(path) || path.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("\u8BF7\u8F93\u5165\u5E93\u5185\u6587\u4EF6\u5939\u8DEF\u5F84 / Enter a vault-relative folder");
  }
  return `${path}/lexis-marginnote.json`;
}

// src/folder-suggest.ts
var import_obsidian26 = require("obsidian");
var FolderSuggest = class extends import_obsidian26.AbstractInputSuggest {
  constructor(app, inputEl, getFolders, onPick) {
    super(app, inputEl);
    this.getFolders = getFolders;
    this.onPick = onPick;
    this.limit = 50;
  }
  getSuggestions(query) {
    const folders = this.getFolders();
    const value = query.trim();
    if (!value) return folders.slice(0, this.limit);
    const match = (0, import_obsidian26.prepareFuzzySearch)(value);
    return folders.filter((folder) => match(folder)).slice(0, this.limit);
  }
  renderSuggestion(folder, element) {
    const name = folder.split("/").pop() || folder;
    element.createDiv({ cls: "lexis-file-suggest-name", text: name });
    element.createDiv({ cls: "lexis-file-suggest-path", text: folder });
  }
  selectSuggestion(folder) {
    this.setValue(folder);
    this.close();
    this.onPick(folder);
  }
};

// src/settings-marginnote-scope.ts
var import_obsidian27 = require("obsidian");

// src/marginnote-scope.ts
var normalized2 = (value) => value.normalize("NFC").replace(/^\/+|\/+$/g, "");
function marginNoteSources(settings, index) {
  const sources2 = /* @__PURE__ */ new Map();
  for (const dict of settings.dicts || []) {
    if (dict.sources) {
      sources2.set(`dictionary:${dictionaryId(dict)}`, dictionaryName(dict));
      continue;
    }
    const folder = normalized2(dict.folder || "");
    if (folder) sources2.set(`folder:${folder}`, folder);
    for (const tag of (dict.tag || "").split(/[,，;；\s]+/).filter(Boolean)) {
      const name = tag.replace(/^#/, "").toLowerCase();
      sources2.set(`tag:${name}`, `#${name}`);
    }
  }
  for (const tag of (settings.vocabTags || "").split(/[,，;；\s]+/).filter(Boolean)) {
    const name = tag.replace(/^#/, "").toLowerCase();
    sources2.set(`tag:${name}`, `#${name}`);
  }
  for (const entry of index.values()) if (entry.inline) sources2.set(`file:${normalized2(entry.file.path)}`, entry.file.path);
  return [...sources2].map(([id, label]) => ({ id, label }));
}
function inMarginNoteScope(entry, selected, membership) {
  if (selected == null) return true;
  const path = normalized2(entry.file.path);
  return selected.some((id) => {
    const split = id.indexOf(":");
    const kind = id.slice(0, split);
    const value = normalized2(id.slice(split + 1));
    if (kind === "dictionary") return membership?.get(value)?.has(entry.file.path) || false;
    if (kind === "folder") return path.startsWith(`${value}/`);
    if (kind === "file") return path === value;
    return kind === "tag" && !!entry.tags?.has(value.toLowerCase());
  });
}

// src/settings-marginnote-scope.ts
function renderMarginNoteScope(container, plugin) {
  const t = plugin.t.bind(plugin);
  const options = marginNoteSources(plugin.settings, plugin.index || /* @__PURE__ */ new Map());
  const rows = container.createDiv();
  const save = async () => {
    await plugin.saveSettings();
    plugin.marginNoteExport.schedule();
  };
  const render = () => {
    rows.empty();
    const all = plugin.settings.marginNoteSources == null;
    new import_obsidian27.Setting(rows).setName(t("mn.scopeAll")).addToggle((toggle) => toggle.setValue(all).onChange(async (value) => {
      plugin.settings.marginNoteSources = value ? null : options.map(({ id }) => id);
      await save();
      render();
    }));
    if (!all) for (const option of options) {
      new import_obsidian27.Setting(rows).setName(option.label).addToggle((toggle) => toggle.setValue(plugin.settings.marginNoteSources.includes(option.id)).onChange(async (value) => {
        const selected = new Set(plugin.settings.marginNoteSources);
        if (value) selected.add(option.id);
        else selected.delete(option.id);
        plugin.settings.marginNoteSources = [...selected];
        await save();
      }));
    }
  };
  render();
}

// src/settings-marginnote.ts
function renderMarginNoteSettings(container, plugin) {
  const t = plugin.t.bind(plugin);
  const row = new import_obsidian28.Setting(container).setName(t("mn.folder")).setDesc(t("mn.folderDescription"));
  row.settingEl.addClass("lexis-data-path-setting");
  const folders = plugin.app.vault.getAllLoadedFiles().filter((file) => file instanceof import_obsidian28.TFolder).map((folder) => folder.path).filter((path) => path && path !== "/").sort();
  let draft = plugin.settings.marginNoteExportFolder;
  row.addText((input) => {
    input.setValue(draft).onChange((value) => {
      draft = value;
    });
    new FolderSuggest(plugin.app, input.inputEl, () => folders, (value) => {
      draft = value;
      input.setValue(value);
    });
    input.inputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") event.preventDefault();
    });
    row.addExtraButton((button) => button.setIcon("undo").setTooltip(t("mn.undo")).onClick(() => {
      draft = plugin.settings.marginNoteExportFolder;
      input.setValue(draft);
    }));
    row.addExtraButton((button) => button.setIcon("check").setTooltip(t("mn.confirm")).onClick(async () => {
      try {
        draft = marginNoteExportPath(draft).replace(/\/lexis-marginnote\.json$/, "");
        plugin.settings.marginNoteExportFolder = draft;
        await plugin.saveSettings();
        input.setValue(draft);
        plugin.marginNoteExport.schedule();
      } catch (error) {
        new import_obsidian28.Notice(t("mn.exportFailed", { error: error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error" }));
      }
    }));
  });
  renderMarginNoteScope(container, plugin);
  new import_obsidian28.Setting(container).setName(t("mn.auto")).setDesc(t("mn.autoDescription")).addToggle((toggle) => toggle.setValue(plugin.settings.marginNoteAutoExport).onChange(async (value) => {
    plugin.settings.marginNoteAutoExport = value;
    await plugin.saveSettings();
    plugin.marginNoteExport.schedule();
  }));
  new import_obsidian28.Setting(container).setName(t("mn.export")).addButton((button) => button.setButtonText(t("mn.export")).onClick(async () => {
    try {
      await plugin.rebuildIndex(false);
      const count = await plugin.marginNoteExport.export();
      new import_obsidian28.Notice(t("mn.exported", { count, path: marginNoteExportPath(plugin.settings.marginNoteExportFolder) }));
    } catch (error) {
      new import_obsidian28.Notice(t("mn.exportFailed", { error: error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error" }));
    }
  }));
}

// src/settings-maintenance.ts
var import_obsidian30 = require("obsidian");

// src/plugin-maintenance.ts
var import_obsidian29 = require("obsidian");
var REPOSITORY = "Heptazero/obsidian-lexis";
var ASSETS = ["main.js", "styles.css", "manifest.json"];
var MaintenanceError = class extends Error {
  constructor(key) {
    super(key);
    this.key = key;
  }
};
function comparePluginVersions(left, right) {
  const parse = (value) => {
    if (!/^\d+\.\d+\.\d+$/.test(value)) throw new MaintenanceError("maintenance.invalidRelease");
    return value.split(".").map(Number);
  };
  const a = parse(left), b = parse(right);
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}
async function remoteText(url) {
  let timer;
  try {
    return await Promise.race([
      (0, import_obsidian29.requestUrl)({ url, throw: false, headers: { "User-Agent": "Lexis" } }).then((response) => {
        if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
        return response.text;
      }),
      new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(new MaintenanceError("maintenance.timeout")), 15e3);
      })
    ]);
  } finally {
    window.clearTimeout(timer);
  }
}
var PluginMaintenance = class {
  constructor(host, readText = remoteText) {
    this.host = host;
    this.readText = readText;
  }
  loader() {
    const manager = this.host.app.plugins;
    if (!manager?.unloadPlugin || !manager.loadPlugin || !manager.loadManifest) throw new MaintenanceError("maintenance.unsupported");
    return manager;
  }
  installedDirectory() {
    const expected = `${this.host.app.vault.configDir}/plugins/${this.host.manifest.id}`;
    if (!this.host.manifest.dir || this.host.manifest.dir !== expected) throw new MaintenanceError("maintenance.development");
    return expected;
  }
  reopenSettings() {
    this.host.app.setting?.openTabById(this.host.manifest.id);
  }
  async reload() {
    const loader = this.loader();
    await this.host.prepareReload();
    await loader.unloadPlugin(this.host.manifest.id);
    if (!await loader.loadPlugin(this.host.manifest.id)) throw new MaintenanceError("maintenance.loadFailed");
    this.reopenSettings();
  }
  async check() {
    const release = JSON.parse(await this.readText(`https://api.github.com/repos/${REPOSITORY}/releases/latest`));
    if (release.draft || release.prerelease || typeof release.tag_name !== "string" || !/^v?\d+\.\d+\.\d+$/.test(release.tag_name) || !Array.isArray(release.assets) || !ASSETS.every((name) => release.assets.some((asset) => asset.name === name))) throw new MaintenanceError("maintenance.invalidRelease");
    if (comparePluginVersions(release.tag_name.replace(/^v/, ""), this.host.manifest.version) <= 0) return null;
    const base = `https://github.com/${REPOSITORY}/releases/download/${encodeURIComponent(release.tag_name)}`;
    const urls = { "main.js": `${base}/main.js`, "styles.css": `${base}/styles.css`, "manifest.json": `${base}/manifest.json` };
    const manifest = JSON.parse(await this.readText(urls["manifest.json"]));
    if (manifest.id !== this.host.manifest.id || manifest.version !== release.tag_name.replace(/^v/, "") || !manifest.minAppVersion) throw new MaintenanceError("maintenance.invalidRelease");
    if (!(0, import_obsidian29.requireApiVersion)(manifest.minAppVersion) || manifest.isDesktopOnly && import_obsidian29.Platform.isMobileApp) throw new MaintenanceError("maintenance.incompatible");
    return { version: manifest.version, tag: release.tag_name, manifest, urls };
  }
  async install(update) {
    const directory = this.installedDirectory(), loader = this.loader(), adapter = this.host.app.vault.adapter;
    const downloaded = new Map(await Promise.all(ASSETS.map(async (name) => [name, await this.readText(update.urls[name])])));
    const manifest = JSON.parse(downloaded.get("manifest.json"));
    if (manifest.id !== this.host.manifest.id || manifest.version !== update.version || !manifest.minAppVersion || !downloaded.get("main.js").trim()) throw new MaintenanceError("maintenance.invalidRelease");
    if (!(0, import_obsidian29.requireApiVersion)(manifest.minAppVersion) || manifest.isDesktopOnly && import_obsidian29.Platform.isMobileApp) throw new MaintenanceError("maintenance.incompatible");
    const previous = /* @__PURE__ */ new Map();
    for (const name of ASSETS) {
      const path = `${directory}/${name}`;
      previous.set(name, await adapter.exists(path) ? await adapter.read(path) : null);
    }
    await this.host.prepareReload();
    await loader.unloadPlugin(this.host.manifest.id);
    try {
      for (const name of ASSETS) await adapter.write(`${directory}/${name}`, downloaded.get(name));
      await loader.loadManifest(directory);
      const plugin = await loader.loadPlugin(this.host.manifest.id);
      if (!plugin || plugin.manifest.version !== update.version) throw new MaintenanceError("maintenance.loadFailed");
    } catch (error) {
      try {
        try {
          await loader.unloadPlugin(this.host.manifest.id);
        } catch {
        }
        for (const [name, text] of previous) {
          const path = `${directory}/${name}`;
          if (text != null) await adapter.write(path, text);
          else if (await adapter.exists(path)) await adapter.remove(path);
        }
        await loader.loadManifest(directory);
        const restored = await loader.loadPlugin(this.host.manifest.id);
        if (!restored || restored.manifest.version !== this.host.manifest.version) throw new MaintenanceError("maintenance.loadFailed");
        this.reopenSettings();
      } catch {
        throw new MaintenanceError("maintenance.restoreFailed");
      }
      throw error;
    }
    this.reopenSettings();
  }
};

// src/settings-maintenance.ts
function confirmUpdate(host, update, owner) {
  return new Promise((resolve) => {
    class UpdateModal extends import_obsidian30.Modal {
      constructor() {
        super(...arguments);
        this.accepted = false;
      }
      onOpen() {
        this.setTitle(host.t("maintenance.available", { version: update.version }));
        this.contentEl.createEl("p", { text: `${host.manifest.version} \u2192 ${update.version}` });
        this.contentEl.createEl("p", { text: host.t("maintenance.confirmDescription") });
        const actions = this.contentEl.createDiv({ cls: "lexis-maintenance-confirm-actions" });
        actions.createEl("button", { text: host.t("maintenance.cancel") }).onclick = () => this.close();
        actions.createEl("button", { cls: "mod-cta", text: host.t("maintenance.install") }).onclick = () => {
          this.accepted = true;
          this.close();
        };
      }
      onClose() {
        this.contentEl.empty();
        resolve(this.accepted);
      }
    }
    const modal = new UpdateModal(host.app);
    owner.register(() => modal.close());
    modal.open();
  });
}
function renderPluginMaintenance(container, host, owner) {
  const tools = container.createDiv({ cls: "lexis-settings-maintenance" });
  const service = new PluginMaintenance(host);
  let busy = false, active = true, installing = false;
  let status;
  const setStatus = (key, vars = {}, detail = "") => {
    if (!active) return;
    status.setText(host.t(key, vars));
    status.title = detail;
  };
  owner.register(() => {
    active = false;
  });
  const buttons = [];
  const action = (name, icon, run) => {
    const button = tools.createEl("button", { cls: "clickable-icon", attr: { type: "button", title: host.t(name), "aria-label": host.t(name), "data-maintenance-action": name } });
    (0, import_obsidian30.setIcon)(button, icon);
    buttons.push(button);
    button.onclick = () => {
      void (async () => {
        if (busy || !active) return;
        busy = true;
        buttons.forEach((item) => {
          item.disabled = true;
        });
        button.setAttribute("aria-busy", "true");
        (0, import_obsidian30.setIcon)(button, "loader-circle");
        try {
          await run();
        } catch (error) {
          if (!active && name === "maintenance.check" && !installing) return;
          const detail = error instanceof MaintenanceError ? host.t(error.key) : error instanceof Error ? error.message : host.t("common.failed");
          if (name === "maintenance.check") setStatus(installing ? "maintenance.installFailed" : "maintenance.checkFailed", {}, detail);
          new import_obsidian30.Notice(host.t("maintenance.failed", { error: detail }));
        } finally {
          busy = false;
          installing = false;
          buttons.forEach((item) => {
            item.disabled = false;
          });
          button.removeAttribute("aria-busy");
          (0, import_obsidian30.setIcon)(button, icon);
        }
      })();
    };
  };
  action("maintenance.reload", "rotate-cw", async () => {
    await service.reload();
    new import_obsidian30.Notice(host.t("maintenance.reloaded"));
  });
  action("maintenance.check", "download", async () => {
    setStatus("maintenance.checking");
    const update = await service.check();
    if (!active) return;
    if (!update) {
      setStatus("maintenance.noUpdate", { version: host.manifest.version });
      return;
    }
    setStatus("maintenance.pendingUpdate", { version: update.version });
    if (await confirmUpdate(host, update, owner)) {
      if (!active) return;
      setStatus("maintenance.installing");
      installing = true;
      await service.install(update);
      setStatus("maintenance.updated", { version: update.version });
      new import_obsidian30.Notice(host.t("maintenance.updated", { version: update.version }));
    }
  });
  status = tools.createSpan({ cls: "lexis-maintenance-status", attr: { role: "status", "aria-live": "polite", "aria-atomic": "true" } });
  setStatus("maintenance.unchecked", { version: host.manifest.version });
}

// src/settings-dictionaries.ts
var obsidian6 = __toESM(require("obsidian"));
var import_obsidian32 = require("obsidian");

// src/dictionary-editor.ts
var obsidian5 = __toESM(require("obsidian"));
var import_obsidian31 = require("obsidian");
var DictionaryEditor = class extends import_obsidian31.Modal {
  constructor(app, host, row, commit) {
    super(app);
    this.host = host;
    this.commit = commit;
    this.destinationEdited = false;
    this.suggests = [];
    this.draft = row ? structuredClone({ ...row, sources: dictionarySources(row) }) : { id: crypto.randomUUID(), name: "", sources: [{ kind: "folder", value: "" }], folder: "", template: "", highlight: true };
    this.destinationSource = this.draft.sources.find((source) => source.kind === "folder" && sourcePath(source.value) === sourcePath(this.draft.folder)) || null;
  }
  onOpen() {
    this.setTitle(this.host.t("collection.edit"));
    this.render();
  }
  render() {
    this.suggests.forEach((suggest2) => suggest2.close());
    this.suggests = [];
    const root = this.contentEl;
    root.empty();
    root.addClass("lexis-dictionary-editor");
    const t = (key) => this.host.t(key);
    const folders = this.app.vault.getAllLoadedFiles().filter((file) => "children" in file).map((file) => file.path).filter((path) => path && path !== "/");
    const files = this.app.vault.getMarkdownFiles().map((file) => file.path);
    const tags = /* @__PURE__ */ new Set();
    for (const file of this.app.vault.getMarkdownFiles()) {
      const cache = this.app.metadataCache.getFileCache(file);
      for (const value of cache?.tags || [])
        tags.add(value.tag);
      const raw = cache?.frontmatter?.tags;
      for (const value of Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,，;；\s]+/) : [])
        if (typeof value === "string")
          tags.add(`#${value.replace(/^#/, "")}`);
    }
    const Suggest = createPathSuggest(obsidian5);
    const suggest = (input, values, pick) => {
      this.suggests.push(new Suggest(this.app, input, values, pick, { fuzzy: true }));
    };
    new import_obsidian31.Setting(root).setName(t("collection.name")).addText((input) => input.setValue(this.draft.name || "").onChange((value) => {
      this.draft.name = value;
    }));
    new import_obsidian31.Setting(root).setName(t("collection.sources")).setDesc(t("collection.sourcesHint")).addButton((button) => {
      button.setIcon("plus").setTooltip(t("collection.addSource"));
      button.buttonEl.setAttribute("aria-label", t("collection.addSource"));
      button.onClick(() => {
        this.draft.sources.push({ kind: "folder", value: "" });
        this.render();
      });
    });
    let updateDestination = (value) => {
      this.draft.folder = value;
    };
    const releaseDestination = (source) => {
      if (this.destinationSource !== source || this.destinationEdited) return;
      this.destinationSource = null;
      updateDestination("");
    };
    for (const [index, source] of this.draft.sources.entries()) {
      const row = root.createDiv({ cls: "lexis-collection-source" });
      const kind = row.createEl("button", { text: t(`collection.${source.kind}`), attr: { type: "button" } });
      if (source.kind === "file" || source.kind === "links") kind.title = t(`collection.${source.kind}Hint`);
      kind.onclick = (event) => {
        const menu = new obsidian5.Menu();
        for (const value of ["folder", "tag", "file", "links"])
          menu.addItem((item) => item.setTitle(t(`collection.${value}`)).setChecked(source.kind === value).onClick(() => {
            releaseDestination(source);
            source.kind = value;
            source.value = "";
            this.render();
          }));
        menu.showAtMouseEvent(event);
      };
      const input = new obsidian5.TextComponent(row).setValue(source.kind === "tag" ? `#${source.value.replace(/^#/, "")}` : source.value);
      const apply = (value) => {
        if (value.startsWith("#")) {
          releaseDestination(source);
          source.kind = "tag";
          kind.setText(t("collection.tag"));
          kind.title = "";
        }
        source.value = value;
        input.setValue(value);
        const folder = source.kind === "folder" ? folders.find((path) => sourcePath(path) === sourcePath(value)) : void 0;
        if (folder && !this.destinationEdited && (!this.draft.folder || this.destinationSource === source)) {
          this.destinationSource = source;
          updateDestination(folder);
        }
      };
      input.onChange(apply);
      suggest(input.inputEl, () => source.kind === "folder" ? folders : source.kind === "tag" ? [...tags] : files, apply);
      new obsidian5.ExtraButtonComponent(row).setIcon("trash").setTooltip(t("common.delete")).onClick(() => {
        releaseDestination(source);
        this.draft.sources.splice(index, 1);
        this.render();
      });
    }
    let refreshTemplate = () => {
    };
    new import_obsidian31.Setting(root).setName(t("collection.destination")).setDesc(t("collection.destinationHint")).addText((input) => {
      updateDestination = (value) => {
        this.draft.folder = value;
        input.setValue(value);
        refreshTemplate();
      };
      const pick = (value) => {
        this.destinationEdited = true;
        updateDestination(value);
      };
      input.setValue(this.draft.folder || "").onChange(pick);
      suggest(input.inputEl, () => folders, pick);
    });
    const template = new import_obsidian31.Setting(root).setName(t("settings.defaultTemplate"));
    template.addText((input) => {
      input.setValue(this.draft.template || "").onChange((value) => {
        this.draft.template = value;
      });
      suggest(input.inputEl, () => files, (value) => {
        this.draft.template = value;
        input.setValue(value);
      });
      refreshTemplate = () => {
        const managed = this.host.templateProvider.templaterTemplateFor(this.draft.folder);
        template.setDesc(managed ? this.host.t("settings.templaterTemplate", { path: managed.path }) : "");
        input.setDisabled(!!managed);
      };
    });
    refreshTemplate();
    new import_obsidian31.Setting(root).addButton((button) => {
      button.setIcon("check").setTooltip(t("collection.save")).setCta();
      button.buttonEl.setAttribute("aria-label", t("collection.save"));
      button.onClick(async () => {
        const sources2 = dictionarySources(this.draft);
        const valid = (source) => source.kind === "tag" || (source.kind === "folder" ? folders : files).some((value) => value.normalize("NFC") === source.value);
        const destination = this.draft.folder.normalize("NFC");
        const destinationValid = !destination || folders.some((path) => path.normalize("NFC") === destination) && sources2.some((source) => source.kind === "folder" && (destination === source.value || destination.startsWith(source.value + "/")));
        if (!sources2.length || sources2.length !== this.draft.sources.length || !sources2.every(valid) || !destinationValid || this.draft.template && !files.includes(this.draft.template)) {
          new import_obsidian31.Notice(t("collection.invalid"));
          return;
        }
        this.draft.sources = sources2;
        delete this.draft.tag;
        if (!this.draft.name?.trim())
          this.draft.name = sources2.map(sourceLabel).join(" + ");
        button.setDisabled(true);
        try {
          await this.commit(this.draft);
          this.close();
        } catch {
          button.setDisabled(false);
          new import_obsidian31.Notice(t("common.failed"));
        }
      });
    });
  }
  onClose() {
    this.suggests.forEach((suggest) => suggest.close());
    this.contentEl.empty();
  }
};

// src/settings-dictionaries.ts
function renderDictionarySettings(container, plugin, accent, labels, stats) {
  const t = (key) => plugin.t(key);
  const list = container.createDiv({ cls: "lexis-dictionary-list" });
  const changed = async () => {
    await plugin.saveSettings();
    await plugin.rebuildIndex(false);
    stats();
  };
  const header = new import_obsidian32.Setting(container).setDesc(t("collection.sourcesHint")).setHeading();
  header.addButton((button) => {
    button.setIcon("plus").setTooltip(t("collection.add"));
    button.buttonEl.setAttribute("aria-label", t("collection.add"));
    button.onClick(() => new DictionaryEditor(plugin.app, plugin, null, async (row) => {
      plugin.settings.dicts.push(row);
      await changed();
      render();
    }).open());
  });
  container.insertBefore(header.settingEl, list);
  function render() {
    list.empty();
    const reorder = createReorderController({ container: list, setIcon: obsidian6.setIcon, label: t("settings.reorder"), onMove: async (from, to) => {
      plugin.settings.dicts = moveItem(plugin.settings.dicts, from, to);
      await changed();
      render();
    } });
    plugin.settings.dicts.forEach((dictionary, index) => {
      const row = list.createDiv({ cls: "lexis-setting-row lexis-dictionary-row" });
      const info = row.createDiv({ cls: "lexis-collection-info" });
      const name = info.createEl("button", { cls: "lexis-collection-name", text: dictionaryName(dictionary) || t("collection.empty") });
      const edit = () => new DictionaryEditor(plugin.app, plugin, dictionary, async (next) => {
        plugin.settings.dicts[index] = next;
        await changed();
        render();
      }).open();
      name.onclick = edit;
      info.createDiv({ cls: "lexis-dim lexis-collection-sources", text: dictionarySources(dictionary).map(sourceLabel).join(" \xB7 ") });
      new obsidian6.ToggleComponent(row).setTooltip(t("settings.showDictionaryHighlight")).setValue(dictionary.highlight !== false).onChange(async (value) => {
        dictionary.highlight = value;
        await plugin.saveSettings();
        plugin.refreshAllViews();
      });
      addAppearanceButton({
        app: plugin.app,
        obsidian: obsidian6,
        parent: row,
        title: t("settings.dictionaryAppearance"),
        labels,
        state: () => ({ color: dictionary.color || plugin.settings.highlightColor || accent, opacity: Number(dictionary.opacity ?? plugin.settings.highlightOpacity) }),
        onChange: async (patch) => {
          Object.assign(dictionary, patch);
          await plugin.saveSettings();
          plugin.refreshAllViews();
        },
        onReset: async () => {
          delete dictionary.color;
          delete dictionary.opacity;
          await plugin.saveSettings();
          plugin.refreshAllViews();
        }
      });
      new obsidian6.ExtraButtonComponent(row).setIcon("pencil").setTooltip(t("collection.edit")).onClick(edit);
      new obsidian6.ExtraButtonComponent(row).setIcon("trash").setTooltip(t("settings.deleteDictionary")).onClick(async () => {
        plugin.settings.dicts.splice(index, 1);
        await changed();
        render();
      });
      reorder.attach(row, index);
    });
  }
  render();
}

// src/settings-control-layout.ts
var WIDE_CONTROL_SELECTOR = 'input:not([type]), input[type="text"], input[type="number"], input[type="range"], select, textarea';
function directControl(setting) {
  for (const child of setting.children) {
    if (child.instanceOf(HTMLElement) && child.classList.contains("setting-item-control")) return child;
  }
  return null;
}
function annotateSettingControlLayouts(root) {
  for (const setting of root.querySelectorAll(".setting-item:not(.setting-item-heading)")) {
    const control = directControl(setting);
    setting.classList.toggle("lexis-setting-has-wide-control", !!control?.querySelector(WIDE_CONTROL_SELECTOR));
    setting.classList.toggle("lexis-setting-has-toggle", !!control?.querySelector(".checkbox-container"));
  }
}

// src/settings-tab.ts
var createSettingsTab = ({ obsidian: obsidian9, PluginSettingTab: PluginSettingTab2, Setting: Setting15, Notice: Notice20, TFolder: TFolder3, DEFAULT_SETTINGS: DEFAULT_SETTINGS2, cssColorToHex: cssColorToHex2, addAppearanceButton: addAppearanceButton2, createReorderController: createReorderController2, moveItem: moveItem2, LEXIS_HOME_VIEW: LEXIS_HOME_VIEW2, LEXIS_REVIEW_VIEW: LEXIS_REVIEW_VIEW2 }) => {
  const PathSuggest = createPathSuggest(obsidian9);
  return class LexisSettingTab extends PluginSettingTab2 {
    constructor(app, plugin) {
      super(app, plugin);
      this.statsEl = null;
      this._colorComp = null;
      this.renderTargetEl = null;
      this.manualComponent = null;
      this.plugin = plugin;
      plugin.register(() => this.hide());
    }
    display() {
      this.renderSettings(this.containerEl);
    }
    hide() {
      this.manualComponent?.unload();
      this.manualComponent = null;
    }
    rerender() {
      this.renderSettings(this.renderTargetEl?.isConnected ? this.renderTargetEl : this.containerEl);
    }
    section(containerEl, title, { desc = "" } = {}) {
      return createSettingsSection(containerEl, title, {
        level: "section",
        description: desc
      }).body;
    }
    getSettingDefinitions() {
      return [{
        name: "Lexis",
        aliases: ["dictionary", "highlight", "review", "browser", "PDF", "\u8BCD\u5178", "\u9AD8\u4EAE", "\u590D\u4E60"],
        render: (setting) => {
          this.renderSettings(setting.settingEl);
        }
      }];
    }
    renderSettings(containerEl) {
      this.hide();
      this.manualComponent = new import_obsidian33.Component();
      this.manualComponent.load();
      this.renderTargetEl = containerEl;
      containerEl.addClass("lexis-settings-root");
      containerEl.empty();
      const t = (key, vars) => this.plugin.t(key, vars);
      const document2 = containerEl.ownerDocument;
      const accentHex = cssColorToHex2(document2.defaultView?.getComputedStyle(document2.body).getPropertyValue("--text-accent") || "", document2);
      const save = () => this.plugin.saveSettings();
      const refresh = () => this.plugin.refreshAllViews();
      const appearanceLabels = {
        color: t("settings.highlightColor"),
        opacity: t("settings.opacity"),
        style: t("settings.highlightStyle"),
        defaultStyle: t("common.default"),
        wavy: t("settings.wavy"),
        underline: t("settings.underline"),
        background: t("settings.background"),
        reset: t("settings.resetAppearance"),
        done: t("common.done")
      };
      const title = new Setting15(containerEl).setName(t("settings.title")).setHeading();
      title.settingEl.addClass("lexis-settings-title-row");
      renderPluginMaintenance(title.controlEl, this.plugin, this.manualComponent);
      const sectionsContainer = containerEl.createDiv({ cls: "lexis-settings-navigation" });
      const sections = /* @__PURE__ */ new Map();
      const topSection = (key, title2, options = {}) => {
        const body = this.section(sectionsContainer, title2, options);
        const section = body.parentElement;
        section.dataset.lexisSectionKey = key;
        sections.set(key, section);
        return body;
      };
      const generalSection = topSection("general", t("settings.tabGeneral"));
      addCurrentChoice(new Setting15(generalSection).setName(t("language.name")), [
        { value: "zh", label: t("language.zh") },
        { value: "en", label: t("language.en") }
      ], this.plugin.settings.language || "zh", async (value) => {
        this.plugin.settings.language = value === "en" ? "en" : "zh";
        await save();
        this.plugin.refreshAllViews();
        this.app.workspace.iterateAllLeaves((leaf) => {
          const type = leaf?.view?.getViewType?.();
          if (type === LEXIS_HOME_VIEW2 || type === LEXIS_REVIEW_VIEW2) leaf.view.render?.();
        });
        new Notice20(t("language.reload"));
        this.rerender();
      });
      new Setting15(generalSection).setName(t("settings.statusBar")).setDesc(t("settings.statusBarDesc")).addToggle((toggle) => toggle.setValue(this.plugin.settings.statusBarVisible !== false).onChange((value) => this.plugin.statusBar.setVisible(value)));
      const folders = this.app.vault.getAllLoadedFiles().filter((f) => f instanceof TFolder3).map((f) => f.path).filter((p) => p && p !== "/").sort();
      const mdFiles = this.app.vault.getMarkdownFiles().map((f) => f.path).sort();
      const hasSuggest = !!obsidian9.AbstractInputSuggest;
      const allTags = (() => {
        const s = new Set(this.plugin.collectVocabTags());
        try {
          const tg = this.app.metadataCache.getTags?.() || {};
          for (const k in tg) s.add(k.replace(/^#/, "").toLowerCase());
        } catch {
        }
        return [...s].filter(Boolean).sort();
      })();
      const allProps = (() => {
        try {
          const infos = this.app.metadataCache.getAllPropertyInfos?.();
          if (infos) return Object.values(infos).map((info) => info.name).filter((name) => !!name).sort();
        } catch {
        }
        return [];
      })();
      const defaultEncounterFolder = DEFAULT_DATA_FOLDER;
      renderStorageSettings.call(this, {
        obsidian: obsidian9,
        Setting: Setting15,
        Notice: Notice20,
        PathSuggest,
        topSection,
        t,
        save,
        folders,
        hasSuggest,
        defaultEncounterFolder
      });
      const dictSection = topSection("dictionary", t("settings.dictionary"), { open: true });
      renderDictionarySettings(dictSection, this.plugin, accentHex, appearanceLabels, () => this.renderStats());
      new Setting15(dictSection).setName(t("settings.includeAliases")).addToggle((t2) => t2.setValue(this.plugin.settings.includeAliases).onChange(async (v) => {
        this.plugin.settings.includeAliases = v;
        await save();
        await this.plugin.rebuildIndex(false);
        this.renderStats();
      }));
      new Setting15(dictSection).setName(t("settings.aliasProperties")).setDesc(t("settings.aliasPropertiesDesc")).addText((t2) => {
        t2.setPlaceholder("Past, forms, variants").setValue(this.plugin.settings.aliasSources);
        const apply = async (v) => {
          this.plugin.settings.aliasSources = (v || "").trim();
          await save();
          if (this.plugin.settings.includeAliases) {
            void this.plugin.rebuildIndex(false);
            this.renderStats();
          }
        };
        t2.onChange(apply);
        if (hasSuggest) new PathSuggest(this.app, t2.inputEl, () => allProps, (v) => {
          t2.setValue(v);
          void apply(v);
        }, { multi: true, sep: "," });
      });
      renderInlineSettings.call(this, {
        obsidian: obsidian9,
        Setting: Setting15,
        topSection,
        t,
        save,
        refresh,
        accentHex,
        appearanceLabels,
        createReorderController: createReorderController2,
        moveItem: moveItem2,
        addAppearanceButton: addAppearanceButton2
      });
      renderHighlightSettings.call(this, {
        obsidian: obsidian9,
        Setting: Setting15,
        PathSuggest,
        topSection,
        t,
        save,
        refresh,
        accentHex,
        allTags,
        hasSuggest,
        appearanceLabels,
        createReorderController: createReorderController2,
        moveItem: moveItem2,
        addAppearanceButton: addAppearanceButton2
      });
      renderVocabularyRules.call(this, {
        obsidian: obsidian9,
        Setting: Setting15,
        PathSuggest,
        topSection,
        t,
        save,
        refresh,
        accentHex,
        allTags,
        hasSuggest,
        appearanceLabels,
        createReorderController: createReorderController2,
        moveItem: moveItem2,
        addAppearanceButton: addAppearanceButton2
      });
      renderReaderSettings({ plugin: this.plugin, topSection, PathSuggest, mdFiles, hasSuggest });
      const fsrsSection = topSection("review", t("settings.review"));
      renderReviewGoalSettings(fsrsSection, this.plugin);
      addCurrentChoice(new Setting15(fsrsSection).setName(t("settings.reviewLinkMode")).setDesc(t("settings.reviewLinkDesc")), [
        { value: "current", label: t("settings.reviewLinkCurrent") },
        { value: "tab", label: t("settings.reviewLinkTab") }
      ], this.plugin.settings.reviewLinkMode, async (value) => {
        this.plugin.settings.reviewLinkMode = value;
        await save();
      });
      const syntaxTemplates2 = [
        ["flashcardInlineTemplate", "settings.flashcardInline"],
        ["flashcardBidirectionalTemplate", "settings.flashcardBidirectional"],
        ["flashcardBlockTemplate", "settings.flashcardBlock"],
        ["flashcardClozeTemplate", "settings.flashcardCloze"]
      ];
      for (const [field, label] of syntaxTemplates2) {
        const setting = new Setting15(fsrsSection).setName(t(label));
        const updateDescription = () => {
          const conflict = field === "flashcardInlineTemplate" && inlineEntryConflictsWithFlashcard(this.plugin.settings.inlineEntryDelimiter, this.plugin.settings[field]);
          setting.setDesc(`${t("settings.flashcardTemplateDesc")}${conflict ? ` ${t("settings.syntaxConflict")}` : ""}`);
        };
        updateDescription();
        const saveTemplate = async (value) => {
          this.plugin.settings[field] = value;
          updateDescription();
          await save();
        };
        if (field === "flashcardBlockTemplate") {
          setting.addTextArea((input) => input.setPlaceholder(t("settings.templateDisabledPlaceholder")).setValue(this.plugin.settings[field]).onChange(saveTemplate));
          const textarea = setting.controlEl.querySelector("textarea");
          if (textarea) textarea.rows = 2;
        } else setting.addText((input) => input.setPlaceholder(t("settings.templateDisabledPlaceholder")).setValue(this.plugin.settings[field]).onChange(saveTemplate));
        setting.addExtraButton((button) => button.setIcon("reset").setTooltip(t("settings.resetTemplate")).onClick(async () => {
          const value = DEFAULT_SETTINGS2[field];
          this.plugin.settings[field] = value;
          await save();
          this.rerender();
        }));
      }
      new Setting15(fsrsSection).setName(t("settings.retention")).setDesc(t("settings.retentionDesc")).addSlider((s) => s.setLimits(0.8, 0.97, 0.01).setValue(this.plugin.settings.requestRetention).onChange(async (v) => {
        this.plugin.settings.requestRetention = v;
        await save();
      }));
      new Setting15(fsrsSection).setName(t("settings.newLimit")).addSlider((s) => s.setLimits(0, 100, 5).setValue(this.plugin.settings.newPerDay).onChange(async (v) => {
        this.plugin.settings.newPerDay = v;
        await save();
      }));
      new Setting15(fsrsSection).setName(t("settings.sessionLimit")).addSlider((s) => s.setLimits(10, 500, 10).setValue(this.plugin.settings.maxReviewsPerSession).onChange(async (v) => {
        this.plugin.settings.maxReviewsPerSession = v;
        await save();
      }));
      const suspendedCount = Object.values(this.plugin.settings.suspendedReviewItems || {}).filter(Boolean).length;
      new Setting15(fsrsSection).setName(t("settings.suspendedCards")).setDesc(t("settings.suspendedCardsDesc", { count: suspendedCount })).addButton((button) => button.setButtonText(t("settings.restoreSuspended")).setDisabled(!suspendedCount).onClick(async () => {
        this.plugin.settings.suspendedReviewItems = {};
        await save();
        new Notice20(t("settings.suspendedRestored"));
        this.rerender();
      }));
      addCurrentChoice(new Setting15(fsrsSection).setName(t("settings.cardFront")).setDesc(t("settings.cardFrontDesc")), [
        { value: "note", label: t("settings.noteCard") },
        { value: "cloze", label: t("settings.clozeCard") }
      ], this.plugin.settings.cardFront, async (value) => {
        this.plugin.settings.cardFront = value;
        await save();
      });
      new Setting15(fsrsSection).setName(t("settings.showReviewMetadata")).setDesc(t("settings.showReviewMetadataDesc")).addToggle((toggle) => toggle.setValue(!!this.plugin.settings.showReviewMetadata).onChange(async (value) => {
        this.plugin.settings.showReviewMetadata = value;
        this.plugin.applyReviewMetadataVisibility();
        await save();
      }));
      new Setting15(fsrsSection).setName(t("home.start")).addButton((b) => b.setButtonText(t("settings.openReview")).setCta().onClick(() => this.plugin.openHome()));
      new Setting15(fsrsSection).setName(t("settings.hoverFeedback")).setDesc(t("settings.hoverFeedbackDesc")).addToggle((t2) => t2.setValue(this.plugin.settings.hoverFeedback).onChange(async (v) => {
        this.plugin.settings.hoverFeedback = v;
        await save();
      }));
      new Setting15(fsrsSection).setName(t("settings.feedbackDays")).setDesc(t("settings.feedbackDaysDesc")).addSlider((s) => s.setLimits(1, 30, 1).setValue(this.plugin.settings.hoverFeedbackDays).onChange(async (v) => {
        this.plugin.settings.hoverFeedbackDays = v;
        await save();
      }));
      new Setting15(fsrsSection).setName(t("settings.retireDays")).setDesc(t("settings.retireDaysDesc")).addSlider((s) => s.setLimits(14, 365, 1).setValue(this.plugin.settings.retireCandidateDays).onChange(async (v) => {
        this.plugin.settings.retireCandidateDays = v;
        await save();
      }));
      const bridgeSection = topSection("bridge", t("settings.bridge"), { desc: t("settings.bridgeDesc") });
      renderMarginNoteSettings(topSection("marginnote", t("mn.exportSection")), this.plugin);
      renderSettingsManual(topSection("manual", t("settings.syntaxManual")), this.plugin, this.manualComponent);
      new Setting15(bridgeSection).setName(t("settings.enableBridge")).addToggle((t2) => t2.setValue(this.plugin.settings.bridgeEnabled).onChange(async (v) => {
        this.plugin.settings.bridgeEnabled = v;
        if (v && !this.plugin.settings.bridgeToken) this.plugin.settings.bridgeToken = this.plugin.bridge.generateToken();
        await save();
        this.plugin.bridge.restart();
        this.rerender();
      }));
      new Setting15(bridgeSection).setName(t("settings.port")).setDesc(t("settings.portDesc")).addText((t2) => t2.setValue(String(this.plugin.settings.bridgePort)).onChange(async (v) => {
        const n = parseInt(v, 10);
        if (n >= 1024 && n <= 65535) {
          this.plugin.settings.bridgePort = n;
          await save();
        }
      })).addExtraButton((b) => b.setIcon("rotate-ccw").setTooltip(t("settings.restartBridge")).onClick(() => {
        this.plugin.bridge.restart();
        new Notice20(t("notice.bridgeRestarted"));
      }));
      new Setting15(bridgeSection).setName(t("settings.token")).setDesc(t("settings.tokenDesc")).addText((input) => {
        input.setValue(this.plugin.settings.bridgeToken || t("settings.tokenPending")).setDisabled(true);
        input.inputEl.addClass("lexis-bridge-token-input");
      }).addExtraButton((b) => b.setIcon("copy").setTooltip(t("settings.copyToken")).onClick(async () => {
        if (this.plugin.settings.bridgeToken) {
          await navigator.clipboard.writeText(this.plugin.settings.bridgeToken);
          new Notice20(t("notice.tokenCopied"));
        }
      })).addExtraButton((b) => b.setIcon("refresh-cw").setTooltip(t("settings.regenerateToken")).onClick(async () => {
        this.plugin.settings.bridgeToken = this.plugin.bridge.generateToken();
        await save();
        this.plugin.bridge.restart();
        this.rerender();
      }));
      createSettingsNavigation(sectionsContainer, sections, {
        activeTab: this.plugin.settings.settingsActiveTab,
        sectionOrder: this.plugin.settings.settingsSectionOrder,
        t,
        setIcon: obsidian9.setIcon,
        tabOrder: this.plugin.settings.settingsTabOrder,
        assignments: this.plugin.settings.settingsTabAssignments,
        groupOrder: this.plugin.settings.settingsGroupOrder,
        tabNames: this.plugin.settings.settingsTabNames,
        customTabs: this.plugin.settings.settingsCustomTabs,
        requestTabName: (current, deletable) => askSettingsTabName(
          this.app,
          t(current ? "settings.renameTab" : "settings.addTab"),
          current,
          t("common.done"),
          deletable ? t("settings.deleteTab") : void 0,
          deletable ? t("settings.deleteTabHint") : void 0
        ),
        onGroupsChange: (names, custom) => {
          this.plugin.settings.settingsTabNames = names;
          this.plugin.settings.settingsCustomTabs = custom;
          void save();
        },
        onTabChange: (id) => {
          this.plugin.settings.settingsActiveTab = id;
          void save();
        },
        onOrderChange: (order) => {
          this.plugin.settings.settingsSectionOrder = order;
          void save();
        },
        onTabOrderChange: (order) => {
          this.plugin.settings.settingsTabOrder = order;
          void save();
        },
        onAssignmentsChange: (assignments) => {
          this.plugin.settings.settingsTabAssignments = assignments;
          void save();
        },
        onGroupOrderChange: (orders) => {
          this.plugin.settings.settingsGroupOrder = orders;
          void save();
        }
      });
      new Setting15(dictSection).setName(t("settings.rebuild")).addButton((b) => b.setButtonText(t("settings.rebuildNow")).onClick(() => {
        void this.plugin.rebuildIndex(true);
        this.renderStats();
      }));
      this.statsEl = dictSection.createEl("p", { cls: "lexis-stats" });
      this.renderStats();
      annotateSettingControlLayouts(containerEl);
    }
    renderStats() {
      if (!this.statsEl) return;
      const s = this.plugin.stats;
      this.statsEl.setText(this.plugin.t("settings.stats", { words: s.words, aliases: s.aliases, inline: s.inlineEntries || 0, due: s.due || 0 }));
    }
  };
};

// src/review-state.ts
var cloneState = (state) => state ? { ...state } : null;
function persistedSchedule(schedule, round22) {
  const s = round22(schedule.s);
  const d = round22(schedule.d);
  if (!Number.isFinite(s) || s <= 0 || !Number.isFinite(d) || d < 1 || d > 10) throw new Error("Invalid review schedule");
  return { s, d };
}
function createReviewState({ todayStr, round2: round22 }) {
  class ReviewState {
    readSyntaxCardState(id) {
      const state = this.settings.syntaxCardStates?.[id] || {};
      return {
        ...state,
        history: Array.isArray(this.settings.reviewHistory?.[`syntax:${id}`]) ? this.settings.reviewHistory[`syntax:${id}`] : []
      };
    }
    snapshotReviewItem(item) {
      if (item.type === "note") return { note: cloneState(item.card) };
      const syntax = {};
      for (const id of item.syntax?.memberIds || []) syntax[id] = cloneState(this.settings.syntaxCardStates?.[id]);
      return { syntax };
    }
    async applyReviewItemSchedule(item, schedule) {
      const { s, d } = persistedSchedule(schedule, round22);
      const state = {
        s,
        d,
        due: schedule.due,
        last: todayStr(),
        reps: schedule.reps,
        lapses: schedule.lapses
      };
      if (item.type === "note") {
        await this.app.fileManager.processFrontMatter(item.file, (frontmatter) => {
          frontmatter["lexis-s"] = state.s;
          frontmatter["lexis-d"] = state.d;
          frontmatter["lexis-due"] = state.due;
          frontmatter["lexis-last"] = state.last;
          frontmatter["lexis-reps"] = state.reps;
          frontmatter["lexis-lapses"] = state.lapses;
        });
        return;
      }
      for (const id of item.syntax?.memberIds || []) this.settings.syntaxCardStates[id] = { ...state };
      await this.saveSettings();
    }
    async suspendReviewItem(item) {
      for (const key of reviewItemSuspensionKeys(item)) this.settings.suspendedReviewItems[key] = true;
      await this.saveSettings();
      this.reviewDashboard?.refresh();
    }
    async restoreReviewItem(item, snapshot) {
      if (item.type === "note") {
        const previous = snapshot.note;
        await this.app.fileManager.processFrontMatter(item.file, (frontmatter) => {
          if (previous?.s == null || Number.isNaN(Number(previous.s))) {
            delete frontmatter["lexis-s"];
            delete frontmatter["lexis-d"];
            delete frontmatter["lexis-due"];
            delete frontmatter["lexis-last"];
            delete frontmatter["lexis-reps"];
            delete frontmatter["lexis-lapses"];
            return;
          }
          frontmatter["lexis-s"] = previous.s;
          frontmatter["lexis-d"] = previous.d;
          frontmatter["lexis-due"] = previous.due;
          frontmatter["lexis-last"] = previous.last;
          frontmatter["lexis-reps"] = previous.reps;
          frontmatter["lexis-lapses"] = previous.lapses;
        });
        return;
      }
      for (const [id, state] of Object.entries(snapshot.syntax || {})) {
        if (state) this.settings.syntaxCardStates[id] = { ...state };
        else delete this.settings.syntaxCardStates[id];
      }
      await this.saveSettings();
    }
    async logReviewItem(item, schedule, grade, retentionBefore) {
      const { s } = persistedSchedule(schedule, round22);
      const today = todayStr();
      this.settings.reviewLog[today] = (this.settings.reviewLog[today] || 0) + 1;
      const keys = item.type === "note" ? [item.file.path] : (item.syntax?.memberIds || []).map((id2) => `syntax:${id2}`);
      const id = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
      this.settings.reviewEvents.push({
        id,
        date: today,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        precision: "time",
        type: item.type,
        filePath: item.file.path,
        label: item.type === "note" ? item.file.basename : item.syntax?.front || item.file.basename,
        line: item.syntax?.line,
        memberKeys: keys,
        grade,
        retention: Math.round(Math.max(0, Math.min(1, retentionBefore)) * 100)
      });
      for (const key of keys) {
        const history = Array.isArray(this.settings.reviewHistory[key]) ? this.settings.reviewHistory[key] : [];
        history.push({ date: today, s, grade, retention: Math.round(Math.max(0, Math.min(1, retentionBefore)) * 100) });
        this.settings.reviewHistory[key] = history.slice(-64);
      }
      await this.saveSettings();
      this.reviewDashboard?.refresh();
      return id;
    }
    async undoReviewItemLog(item, eventId) {
      const event = this.settings.reviewEvents.find((entry) => entry.id === eventId);
      const day = event?.date || todayStr();
      if (this.settings.reviewLog[day]) {
        this.settings.reviewLog[day]--;
        if (this.settings.reviewLog[day] <= 0) delete this.settings.reviewLog[day];
      }
      const keys = item.type === "note" ? [item.file.path] : (item.syntax?.memberIds || []).map((id) => `syntax:${id}`);
      for (const key of keys) {
        const history = this.settings.reviewHistory[key];
        if (Array.isArray(history) && history.length) history.pop();
      }
      this.settings.reviewEvents = this.settings.reviewEvents.filter((event2) => event2.id !== eventId);
      await this.saveSettings();
      this.reviewDashboard?.refresh();
    }
  }
  const descriptors = Object.getOwnPropertyDescriptors(ReviewState.prototype);
  delete descriptors.constructor;
  return descriptors;
}

// src/review-queue.ts
var isFresh2 = (card) => card.s == null || Number.isNaN(Number(card.s));
var reviewedToday = (card, today) => {
  const latest = card.history?.[card.history.length - 1];
  return latest?.date === today && latest.grade !== 1;
};
var syntaxTemplates = (settings) => ({
  inline: settings.flashcardInlineTemplate,
  bidirectional: settings.flashcardBidirectionalTemplate,
  block: settings.flashcardBlockTemplate,
  cloze: settings.flashcardClozeTemplate
});
var stripFrontmatter = (markdown) => markdown.replace(/^---\s*\n[\s\S]*?\n---(?:\n|$)/, "");
var countNoteWords = (markdown) => {
  const content = stripFrontmatter(markdown);
  const cjkPattern = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
  const cjkCount = content.match(cjkPattern)?.length || 0;
  const otherWords = content.replace(cjkPattern, " ").match(/[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu)?.length || 0;
  return cjkCount + otherWords;
};
function createReviewQueue({ todayStr }) {
  class ReviewQueue {
    collectReviewFolders() {
      const folders = /* @__PURE__ */ new Set();
      for (const file of this.app.vault.getMarkdownFiles()) {
        let path = file.path;
        for (let slash = path.lastIndexOf("/"); slash > 0; slash = path.lastIndexOf("/")) {
          path = path.slice(0, slash);
          folders.add(path);
        }
      }
      return [...folders].sort((left, right) => left.localeCompare(right));
    }
    collectReviewTags() {
      const tags = /* @__PURE__ */ new Set();
      for (const file of this.app.vault.getMarkdownFiles()) for (const tag of this.getTags(file)) tags.add(tag);
      return [...tags].sort((left, right) => left.localeCompare(right));
    }
    async collectSuspendedReviewItems() {
      const suspended = Object.entries(this.settings.suspendedReviewItems || {}).filter(([, enabled]) => enabled);
      const syntaxKeys = new Set(suspended.filter(([key]) => key.startsWith("syntax:")).map(([key]) => key.slice("syntax:".length)));
      const syntaxMatches = /* @__PURE__ */ new Map();
      if (syntaxKeys.size) {
        const templates = syntaxTemplates(this.settings);
        await Promise.all(this.app.vault.getMarkdownFiles().map(async (file) => {
          let markdown = "";
          try {
            markdown = await this.app.vault.cachedRead(file);
          } catch {
            return;
          }
          const options = this.isInlineSourceFile?.(file) ? { inlineEntryDelimiter: this.settings.inlineEntryDelimiter } : {};
          for (const card of parseSyntaxCards(markdown, file.path, templates, options)) {
            if (syntaxKeys.has(card.id)) syntaxMatches.set(card.id, { file, card });
          }
        }));
      }
      const entries = [];
      for (const [key] of suspended) {
        if (key.startsWith("note:")) {
          const file = this.app.vault.getFileByPath(key.slice("note:".length));
          if (file?.extension === "md") entries.push({ key, type: "note", file, label: file.basename });
          continue;
        }
        if (key.startsWith("syntax:")) {
          const match = syntaxMatches.get(key.slice("syntax:".length));
          if (match) entries.push({
            key,
            type: "syntax",
            file: match.file,
            label: `${match.file.basename} \xB7 ${match.card.front}`,
            line: match.card.line
          });
        }
      }
      return entries.sort((left, right) => left.file.path.localeCompare(right.file.path) || (left.line ?? -1) - (right.line ?? -1) || left.label.localeCompare(right.label));
    }
    directLinkedFiles(sourcePath2) {
      return linkedMarkdownFiles(this.app, sourcePath2);
    }
    reviewScopeFiles(options) {
      if (options.dictionaryIds !== void 0) {
        const membership = resolveDictionaries(this.app, this.settings.dicts || [], (file) => this.getTags(file));
        const ids = options.dictionaryIds === null ? [...membership.paths.keys()] : options.dictionaryIds;
        const included = new Set(ids.flatMap((id) => [...membership.paths.get(id) || []]));
        return membership.files.filter((file) => included.has(file.path) && !this.readLifecycle(file).archived && !this.readLifecycle(file).retired);
      }
      if (options.sources) {
        const files2 = /* @__PURE__ */ new Map();
        for (const source of options.sources) {
          for (const file of this.reviewScopeFiles({ scope: source.scope === "file" ? "current" : source.scope, file: source.value, folder: source.value, linkSource: source.value, tag: source.value })) files2.set(file.path, file);
        }
        return [...files2.values()];
      }
      const scope = options.scope || "vocab";
      const current = scope === "current" ? this.app.vault.getFileByPath(options.file || "") : null;
      let files = scope === "current" ? current?.extension === "md" ? [current] : [] : this.app.vault.getMarkdownFiles();
      if (scope === "vocab") {
        files = files.filter((file) => this.inVocabFolder(file.path));
        const dictionary = this.normalizeFolder(options.folder || "");
        if (dictionary) files = files.filter((file) => this.inScope(file.path, [dictionary]));
      }
      if (scope === "folder") {
        const folder = this.normalizeFolder(options.folder || "");
        if (folder) files = files.filter((file) => this.inScope(file.path, [folder]));
      }
      if (scope === "links") files = this.directLinkedFiles(options.linkSource || "");
      if (scope === "tag") {
        const tag = String(options.tag || "").toLowerCase().replace(/^#/, "");
        files = tag ? files.filter((file) => this.getTags(file).has(tag)) : [];
      }
      return files.filter((file) => {
        const lifecycle = this.readLifecycle(file);
        return !lifecycle.archived && !lifecycle.retired;
      });
    }
    syntaxItems(file, cards, today, includeReviewed = false) {
      const result = [];
      const combinedGroups = /* @__PURE__ */ new Map();
      for (const syntax of cards) {
        const card = this.readSyntaxCardState(syntax.id);
        if (this.settings.suspendedReviewItems?.[syntaxSuspensionKey(syntax.id)] || !includeReviewed && reviewedToday(card, today)) continue;
        if (syntax.kind === "cloze") {
          const group = combinedGroups.get(syntax.groupId) || [];
          group.push(syntax);
          combinedGroups.set(syntax.groupId, group);
          continue;
        }
        result.push({
          type: "syntax",
          file,
          card,
          syntax: { id: syntax.id, memberIds: [syntax.id], kind: syntax.kind, front: syntax.front, back: syntax.back, line: syntax.line, headingPath: syntax.headingPath }
        });
      }
      for (const group of combinedGroups.values()) {
        const first = group[0];
        const members = group.map((syntax) => ({ id: syntax.id, front: syntax.front, answer: syntax.clozeAnswer, clozeIndex: syntax.clozeIndex, card: this.readSyntaxCardState(syntax.id) }));
        result.push({
          type: "syntax",
          file,
          card: reviewGroupState(members.map((member) => member.card)),
          syntax: {
            id: first.groupId,
            headingPath: first.headingPath,
            memberIds: members.map((member) => member.id),
            members,
            kind: "cloze",
            front: members[0].front,
            combinedFront: first.combinedFront || first.front,
            clozeAnswer: first.clozeAnswer,
            clozeIndex: first.clozeIndex,
            back: first.back,
            line: first.line
          }
        });
      }
      return result;
    }
    async migrateSyntaxCardPath(file, oldPath) {
      if (file.extension !== "md" || !oldPath.toLowerCase().endsWith(".md")) return;
      let markdown = "";
      try {
        markdown = await this.app.vault.cachedRead(file);
      } catch {
        return;
      }
      const templates = syntaxTemplates(this.settings);
      const options = this.isInlineSourceFile?.(file) ? { inlineEntryDelimiter: this.settings.inlineEntryDelimiter } : {};
      const previous = parseSyntaxCards(markdown, oldPath, templates, options);
      const current = parseSyntaxCards(markdown, file.path, templates, options);
      let changed = renamePracticeKey(this.settings, oldPath, file.path);
      for (let index = 0; index < Math.min(previous.length, current.length); index++) {
        const before = previous[index], after = current[index];
        if (before.kind !== after.kind || before.front !== after.front || before.back !== after.back) continue;
        const state = this.settings.syntaxCardStates[before.id];
        if (state && !this.settings.syntaxCardStates[after.id]) {
          this.settings.syntaxCardStates[after.id] = state;
          delete this.settings.syntaxCardStates[before.id];
          changed = true;
        }
        const history = this.settings.reviewHistory[`syntax:${before.id}`];
        if (history && !this.settings.reviewHistory[`syntax:${after.id}`]) {
          this.settings.reviewHistory[`syntax:${after.id}`] = history;
          delete this.settings.reviewHistory[`syntax:${before.id}`];
          changed = true;
        }
        const oldKey = `syntax:${before.id}`;
        const newKey = `syntax:${after.id}`;
        changed = renamePracticeKey(this.settings, oldKey, newKey) || changed;
        for (const event of this.settings.reviewEvents) {
          if (!event.memberKeys.includes(oldKey)) continue;
          event.memberKeys = event.memberKeys.map((key) => key === oldKey ? newKey : key);
          event.filePath = file.path;
          changed = true;
        }
      }
      if (changed) await this.saveSettings();
    }
    async collectReviewItems(options = {}, includeReviewed = false) {
      const resolved = options || {};
      const content = resolved.content || "notes";
      const files = this.reviewScopeFiles(resolved);
      const today = todayStr();
      const markdownByPath = /* @__PURE__ */ new Map();
      if (content === "syntax" || content === "both") {
        await Promise.all(files.map(async (file) => {
          try {
            markdownByPath.set(file.path, await this.app.vault.cachedRead(file));
          } catch {
            markdownByPath.set(file.path, "");
          }
        }));
      }
      const candidates = [];
      if (content === "notes" || content === "context" || content === "both") {
        for (const file of files) {
          const card = this.readCard(file);
          if (!this.settings.suspendedReviewItems?.[noteSuspensionKey(file.path)] && (includeReviewed || !reviewedToday(card, today))) {
            candidates.push({ type: "note", file, card });
          }
        }
      }
      if (content === "syntax" || content === "both") {
        const templates = syntaxTemplates(this.settings);
        const parsed = files.map((file) => {
          const options2 = this.isInlineSourceFile?.(file) ? { inlineEntryDelimiter: this.settings.inlineEntryDelimiter } : {};
          return this.syntaxItems(file, parseSyntaxCards(markdownByPath.get(file.path) || "", file.path, templates, options2), today, includeReviewed);
        });
        for (const items of parsed) candidates.push(...items);
      }
      return candidates;
    }
    async buildQueue(options = {}) {
      const resolved = options || {};
      const sortBy = resolved.sortBy || "due";
      const direction = resolved.sortDirection === "desc" ? -1 : 1;
      const today = todayStr();
      const practice = resolved.mode === "cram";
      let candidates = await this.collectReviewItems(resolved, practice);
      if (resolved.excludedKeys?.length) {
        const excluded = new Set(resolved.excludedKeys);
        candidates = candidates.map((item) => restrictReviewItem(item, new Set(reviewItemKeys(item).filter((key) => !excluded.has(key))))).filter((item) => !!item);
      }
      if (resolved.targetKeys) {
        const allowed = new Set(resolved.targetKeys);
        candidates = candidates.map((item) => restrictReviewItem(item, allowed)).filter((item) => !!item);
      }
      const markdownByPath = /* @__PURE__ */ new Map();
      if (sortBy === "wordCount") await Promise.all([...new Map(candidates.map((item) => [item.file.path, item.file])).values()].map(async (file) => {
        try {
          markdownByPath.set(file.path, await this.app.vault.cachedRead(file));
        } catch {
          markdownByPath.set(file.path, "");
        }
      }));
      const due = candidates.filter((item) => !isFresh2(item.card) && (!item.card.due || String(item.card.due).slice(0, 10) <= today));
      const fresh = candidates.filter((item) => isFresh2(item.card));
      let queue = practice ? candidates : due.concat(fresh);
      if (sortBy === "random") {
        for (let index = queue.length - 1; index > 0; index--) {
          const target = Math.floor(Math.random() * (index + 1));
          [queue[index], queue[target]] = [queue[target], queue[index]];
        }
      } else {
        const metric = (item, key2) => {
          if (key2 === "due") return item.card.due ? String(item.card.due).slice(0, 10) : null;
          if (key2 === "wordCount") return countNoteWords(markdownByPath.get(item.file.path) || "");
          if (key2 === "modified") return item.file.stat.mtime;
          if (key2 === "created") return item.file.stat.ctime;
          const frequency = this.freqVal(item.file);
          return Number.isFinite(frequency) ? frequency : null;
        };
        const key = sortBy;
        queue.sort((left, right) => {
          const leftValue = metric(left, key), rightValue = metric(right, key);
          if (leftValue == null && rightValue == null) return left.file.path.localeCompare(right.file.path);
          if (leftValue == null) return 1;
          if (rightValue == null) return -1;
          const compared = typeof leftValue === "number" && typeof rightValue === "number" ? leftValue - rightValue : String(leftValue).localeCompare(String(rightValue));
          return compared ? compared * direction : left.file.path.localeCompare(right.file.path);
        });
      }
      const newLimit = Math.max(0, this.settings.newPerDay ?? 20);
      queue = orderByReviewPriority(queue, this.settings.reviewPriorities);
      let admittedFresh = 0;
      if (!practice) queue = queue.filter((item) => !isFresh2(item.card) || admittedFresh++ < newLimit);
      if (resolved.dailyCardLimit != null) {
        let left = Math.max(0, resolved.dailyCardLimit);
        queue = queue.map((item) => {
          const keys = reviewItemKeys(item).slice(0, left);
          left -= keys.length;
          return restrictReviewItem(item, new Set(keys));
        }).filter((item) => !!item);
      }
      if (resolved.batchSize !== void 0) return takeReviewBatch(queue, resolved.batchSize).selected;
      return practice ? queue : queue.slice(0, this.settings.maxReviewsPerSession || 200);
    }
  }
  const descriptors = Object.getOwnPropertyDescriptors(ReviewQueue.prototype);
  delete descriptors.constructor;
  return descriptors;
}

// src/review-current-file-command.ts
function currentFileReviewCommand(host) {
  return {
    id: "review-current-file",
    name: host.t("command.reviewCurrentFile"),
    checkCallback: (checking) => {
      const file = host.app.workspace.getActiveFile();
      if (file?.extension !== "md") return false;
      if (!checking) host.configureReview({ scope: "current", file: file.path, content: "syntax", mode: "cram", batchSize: null, rounds: 1 });
      return true;
    }
  };
}

// src/review-scheduler.ts
function validState(stability, difficulty) {
  return Number.isFinite(stability) && stability > 0 && Number.isFinite(difficulty) && difficulty >= 1 && difficulty <= 10;
}
function scheduleReviewCard(card, grade, retention, today) {
  const previousS = Number(card.s);
  const previousD = Number(card.d);
  const reps = (Number(card.reps) || 0) + 1;
  let lapses = Number(card.lapses) || 0;
  let stability;
  let difficulty;
  if (!validState(previousS, previousD)) {
    stability = FSRS.initStability(grade);
    difficulty = FSRS.initDifficulty(grade);
  } else {
    const elapsed = card.last ? daysBetween(card.last, today) : 0;
    const retrievability = FSRS.retrievability(elapsed, previousS);
    difficulty = FSRS.nextDifficulty(previousD, grade);
    if (grade === 1) {
      stability = FSRS.nextForgetStability(previousD, previousS, retrievability);
      lapses++;
    } else {
      stability = FSRS.nextRecallStability(previousD, previousS, retrievability, grade);
    }
  }
  if (!Number.isFinite(stability) || stability <= 0) stability = FSRS.initStability(grade);
  if (!Number.isFinite(difficulty) || difficulty < 1 || difficulty > 10) difficulty = FSRS.initDifficulty(grade);
  const requestedRetention = Number.isFinite(retention) && retention > 0 && retention < 1 ? retention : 0.9;
  const interval = FSRS.nextInterval(stability, requestedRetention);
  return { s: stability, d: difficulty, reps, lapses, interval, due: addDaysString(today, interval) };
}
function repairReviewHistory(history) {
  let changed = false;
  for (const events of Object.values(history)) {
    if (!Array.isArray(events)) continue;
    for (const event of events) {
      if (!event || typeof event !== "object") continue;
      const stability = Number(event.s);
      if (Number.isFinite(stability) && stability > 0) continue;
      const grade = Number(event.grade);
      if (!Number.isInteger(grade) || grade < 1 || grade > 4) continue;
      event.s = round2(FSRS.initStability(grade));
      changed = true;
    }
  }
  return changed;
}

// src/settings-migration.ts
function pluginFolderName(manifestDir, pluginId) {
  return (manifestDir || pluginId).replace(/\/+$/, "").split("/").pop() || pluginId;
}
function mergeRecord(legacy, current) {
  const left = legacy && typeof legacy === "object" && !Array.isArray(legacy) ? legacy : {};
  const right = current && typeof current === "object" && !Array.isArray(current) ? current : {};
  return { ...left, ...right };
}
function migrateLegacySettings(current, legacy) {
  if (!legacy || current.legacySettingsImported) return { settings: current, migrated: false };
  return {
    settings: {
      ...current,
      ...legacy,
      reviewLog: mergeRecord(legacy.reviewLog, current.reviewLog),
      reviewHistory: mergeRecord(legacy.reviewHistory, current.reviewHistory),
      syntaxCardStates: mergeRecord(legacy.syntaxCardStates, current.syntaxCardStates),
      legacySettingsImported: true
    },
    migrated: true
  };
}
function migrateEntryColors(settings) {
  if (Array.isArray(settings.entryColors) || !Array.isArray(settings.colorRoles)) return { settings, migrated: false };
  const { colorRoles, ...current } = settings;
  return { settings: { ...current, entryColors: colorRoles }, migrated: true };
}

// src/workspace-documents.ts
var WorkspaceDocuments = class {
  constructor(plugin, callbacks) {
    this.plugin = plugin;
    this.callbacks = callbacks;
    this.documents = /* @__PURE__ */ new Map();
    this.events = [];
    this.running = false;
    this.active = plugin.app.workspace.containerEl.ownerDocument;
    plugin.register(() => this.dispose());
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.activateLeaf(this.plugin.app.workspace.getMostRecentLeaf());
    this.events.push(
      this.plugin.app.workspace.on("active-leaf-change", (leaf) => this.activateLeaf(leaf)),
      this.plugin.app.workspace.on("window-open", (_workspaceWindow, window2) => this.activate(window2.document)),
      this.plugin.app.workspace.on("window-close", (_workspaceWindow, window2) => this.remove(window2.document))
    );
  }
  current() {
    return this.active;
  }
  forEach(callback) {
    for (const document2 of this.documents.keys()) callback(document2);
  }
  activateLeaf(leaf) {
    this.activate(leaf?.view?.containerEl?.ownerDocument || this.plugin.app.workspace.containerEl.ownerDocument);
  }
  activate(document2) {
    if (!this.running) return;
    const documentChanged = this.active !== document2 || !this.documents.has(document2);
    this.bind(document2);
    this.active = document2;
    this.callbacks.activate(document2, documentChanged);
  }
  bind(document2) {
    if (this.documents.has(document2)) return;
    const cleanups = [];
    const listen = (target, event, callback, options) => {
      target.addEventListener(event, callback, options);
      cleanups.push(() => target.removeEventListener(event, callback, options));
    };
    this.documents.set(document2, () => {
      for (const cleanup of cleanups) cleanup();
    });
    listen(document2, "mousemove", (event) => this.callbacks.mousemove(event));
    listen(document2, "mouseover", (event) => this.callbacks.mouseover(event));
    listen(document2, "mouseout", (event) => this.callbacks.mouseout(event));
    listen(document2, "click", (event) => this.callbacks.click(event));
    listen(document2, "pointerdown", (event) => this.callbacks.pointerdown(event), { capture: true });
    listen(document2, "pointermove", (event) => this.callbacks.pointermove(event), { capture: true });
    listen(document2, "pointerup", (event) => this.callbacks.pointerup(event), { capture: true });
    listen(document2, "pointercancel", () => this.callbacks.pointercancel(), { capture: true });
    listen(document2, "mouseup", (event) => this.callbacks.mouseup(event));
    listen(document2, "keydown", (event) => {
      if (event.key === "Escape") this.callbacks.escape();
    });
    const window2 = document2.defaultView;
    if (window2) listen(window2, "scroll", (event) => this.callbacks.scroll(event), { capture: true });
  }
  remove(document2) {
    const cleanup = this.documents.get(document2);
    if (!cleanup) return;
    cleanup();
    this.documents.delete(document2);
    this.callbacks.close(document2);
    if (this.active === document2) {
      this.active = this.plugin.app.workspace.containerEl.ownerDocument;
      this.activate(this.active);
    }
  }
  dispose() {
    this.running = false;
    for (const cleanup of this.documents.values()) cleanup();
    this.documents.clear();
    for (const event of this.events) this.plugin.app.workspace.offref(event);
    this.events.length = 0;
  }
};

// src/reader-workspace.ts
function createReaderWorkspace(host) {
  return new WorkspaceDocuments(host, {
    mousemove: (event) => host.onMouseMove(event),
    mouseover: (event) => host.onMouseOver(event),
    mouseout: (event) => host.onMouseOut(event),
    click: (event) => host.onClick(event),
    pointerdown: (event) => host.onPointerDown(event),
    pointermove: (event) => host.onPointerMove(event),
    pointerup: (event) => host.onPointerUp(event),
    pointercancel: () => host.onPointerCancel(),
    mouseup: (event) => host.maybeShowSelPill(event),
    escape: () => host.removeSelPill(),
    scroll: (event) => {
      host.onPointerCancel();
      const target = event.target;
      const node = target && typeof target === "object" && "nodeType" in target ? target : null;
      if (host._popover && node && host._popover.contains(node)) return;
      const element = node?.nodeType === 1 ? node : node?.parentElement;
      if (element?.closest(".lexis-alias-search")) return;
      host.removePopover();
      host.removeSelPill();
    },
    activate: (document2, documentChanged) => {
      host._canvasEdgeHighlights.activate(document2);
      if (documentChanged) {
        host.setupPdfHighlight(document2);
        host.epubHighlights.start(document2);
      }
      host.applyReviewMetadataVisibility();
      host.syncActivePageHighlightState();
    },
    close: (document2) => {
      host._canvasEdgeHighlights.close(document2);
      if (host._popover?.ownerDocument === document2) host.removePopover();
      if (host._selPill?.ownerDocument === document2) host.removeSelPill();
    }
  });
}

// src/epub-surfaces.ts
var EPUB_FRAMES = "iframe[enable-annotation], .epub-reader-area iframe, .epub-container iframe, .epub-view iframe";
var ANNOTATOR_SHELLS = '.workspace-leaf-content[data-type="pdf-annotator"] iframe';
var ANNOTATOR_EPUB_PROXY = 'iframe[patched-src*="/demos/epub/epub.js/"]';
var EpubSurfaces = class {
  constructor(root, onChapter, onPrune) {
    this.root = root;
    this.onChapter = onChapter;
    this.onPrune = onPrune;
    this.documents = /* @__PURE__ */ new Map();
    this.shells = /* @__PURE__ */ new Map();
    this.foliate = /* @__PURE__ */ new Map();
    this.chapters = /* @__PURE__ */ new Set();
    this.foliateChapters = /* @__PURE__ */ new Map();
  }
  start() {
    this.watchDocument(this.root);
  }
  ownsChapter(frame) {
    return this.chapters.has(frame);
  }
  watchDocument(document2) {
    if (!document2.body || this.documents.get(document2)?.body === document2.body) return;
    this.documents.get(document2)?.observer.disconnect();
    const Constructor = document2.defaultView.MutationObserver;
    const observer = new Constructor((mutations) => {
      if (mutations.some((mutation) => mutation.removedNodes.length)) this.prune();
      for (const mutation of mutations) for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) this.scanNode(node, document2 !== this.root);
      }
    });
    this.documents.set(document2, { body: document2.body, observer });
    observer.observe(document2.body, { childList: true, subtree: true });
    this.scanNode(document2.body, document2 !== this.root);
  }
  scanNode(node, inShell) {
    const selector = `${EPUB_FRAMES},${ANNOTATOR_SHELLS},foliate-view${inShell ? `,${ANNOTATOR_EPUB_PROXY},#viewer iframe` : ""}`;
    const candidates = [...node.matches(selector) ? [node] : [], ...node.querySelectorAll(selector)];
    for (const candidate of candidates) {
      if (candidate.tagName.toLowerCase() === "foliate-view") this.observeFoliate(candidate);
      else if (candidate.matches(EPUB_FRAMES) || inShell && candidate.matches("#viewer iframe")) {
        const frame = candidate;
        this.chapters.add(frame);
        this.onChapter(frame);
      } else this.observeShell(candidate);
    }
  }
  observeShell(frame) {
    if (!this.shells.has(frame)) {
      const load = () => this.scanShell(frame);
      this.shells.set(frame, { load, document: null });
      frame.addEventListener("load", load);
    }
    this.scanShell(frame);
  }
  scanShell(frame) {
    const state = this.shells.get(frame);
    if (!state || !frameBelongsToDocument(frame, this.root)) return;
    let document2;
    try {
      document2 = frame.contentDocument;
    } catch {
      return;
    }
    if (state.document !== document2) {
      if (state.document) {
        this.documents.get(state.document)?.observer.disconnect();
        this.documents.delete(state.document);
      }
      state.document = document2;
      this.prune();
    }
    if (document2?.body) {
      this.watchDocument(document2);
    }
  }
  observeFoliate(view) {
    if (!this.foliate.has(view)) {
      const update = () => this.scanFoliate(view);
      this.foliate.set(view, update);
      view.addEventListener("load", update);
      view.addEventListener("relocate", update);
    }
    this.scanFoliate(view);
  }
  scanFoliate(view) {
    const active = /* @__PURE__ */ new Map();
    for (const { doc } of view.renderer?.getContents() || []) {
      const frame = doc?.defaultView?.frameElement;
      if (frame && frameBelongsToDocument(frame, this.root)) {
        active.set(frame, doc);
        this.chapters.add(frame);
        if (this.foliateChapters.get(view)?.get(frame) !== doc) this.onChapter(frame);
      }
    }
    for (const frame of this.foliateChapters.get(view)?.keys() || []) if (!active.has(frame)) this.chapters.delete(frame);
    this.foliateChapters.set(view, active);
    this.onPrune();
  }
  prune() {
    for (const [frame, state] of this.shells) if (!frameBelongsToDocument(frame, this.root)) {
      frame.removeEventListener("load", state.load);
      if (state.document) {
        this.documents.get(state.document)?.observer.disconnect();
        this.documents.delete(state.document);
      }
      this.shells.delete(frame);
    }
    for (const [view, update] of this.foliate) if (!view.isConnected) {
      view.removeEventListener("load", update);
      view.removeEventListener("relocate", update);
      for (const frame of this.foliateChapters.get(view)?.keys() || []) this.chapters.delete(frame);
      this.foliateChapters.delete(view);
      this.foliate.delete(view);
    }
    for (const frame of this.chapters) if (!frameBelongsToDocument(frame, this.root)) this.chapters.delete(frame);
    this.onPrune();
  }
  rescan() {
    this.prune();
    for (const document2 of this.documents.keys()) this.scanNode(document2.body, document2 !== this.root);
    for (const view of this.foliate.keys()) {
      this.scanFoliate(view);
      for (const frame of this.foliateChapters.get(view)?.keys() || []) this.onChapter(frame);
    }
  }
  dispose() {
    for (const { observer } of this.documents.values()) observer.disconnect();
    for (const [frame, state] of this.shells) frame.removeEventListener("load", state.load);
    for (const [view, update] of this.foliate) {
      view.removeEventListener("load", update);
      view.removeEventListener("relocate", update);
    }
    this.documents.clear();
    this.shells.clear();
    this.foliate.clear();
    this.foliateChapters.clear();
    this.chapters.clear();
  }
};

// src/epub-document-events.ts
function epubDocumentEvents(document2, host) {
  const window2 = document2.defaultView ? overlayDocumentFor(document2.body).defaultView : null;
  let timer = null;
  let previous = null;
  let dragging = false;
  const cancel = () => {
    if (timer !== null) window2?.clearTimeout(timer);
    timer = null;
  };
  const remember = () => {
    const selection = document2.defaultView?.getSelection();
    previous = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
  };
  const schedule = () => {
    cancel();
    if (dragging || !window2) return;
    timer = window2.setTimeout(() => {
      timer = null;
      const selection = document2.defaultView?.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      if (range && previous && range.startContainer === previous.startContainer && range.startOffset === previous.startOffset && range.endContainer === previous.endContainer && range.endOffset === previous.endOffset) return;
      host.maybeShowSelPill({ target: selection?.anchorNode || document2.body }, true);
      remember();
    }, 180);
  };
  const hooks = {
    mouseover: (event) => host.onMouseOver(event),
    mouseout: (event) => host.onMouseOut(event),
    click: (event) => host.onClick(event),
    mouseup: (event) => {
      dragging = false;
      cancel();
      host.maybeShowSelPill(event, true);
      remember();
    },
    pointerdown: (event) => {
      dragging = true;
      previous = null;
      cancel();
      host.onPointerDown(event);
    },
    pointermove: (event) => host.onPointerMove(event),
    pointerup: (event) => {
      dragging = false;
      host.onPointerUp(event);
      schedule();
    },
    pointercancel: () => {
      dragging = false;
      cancel();
      host.onPointerCancel();
    },
    touchstart: () => {
      dragging = true;
      previous = null;
      cancel();
    },
    touchend: () => {
      dragging = false;
      schedule();
    },
    selectionchange: schedule,
    keyup: schedule
  };
  return {
    hooks,
    bind: () => {
      for (const [event, hook] of Object.entries(hooks)) document2.addEventListener(event, hook, { capture: true });
    },
    dispose: () => {
      cancel();
      for (const [event, hook] of Object.entries(hooks)) document2.removeEventListener(event, hook, { capture: true });
    }
  };
}

// src/epub-highlights.ts
function releaseDocument(chapter) {
  chapter.events?.dispose();
  chapter.document = null;
  chapter.events = null;
}
var EpubHighlights = class {
  constructor(host) {
    this.host = host;
    this.surfaces = null;
    this.document = null;
    this.chapters = /* @__PURE__ */ new Map();
  }
  start(document2) {
    this.dispose();
    this.document = document2;
    this.surfaces = new EpubSurfaces(document2, (frame) => this.observe(frame), () => this.prune());
    this.surfaces.start();
  }
  rescan() {
    this.surfaces?.rescan();
  }
  dispose() {
    this.surfaces?.dispose();
    this.surfaces = null;
    for (const [frame, chapter] of this.chapters) {
      frame.removeEventListener("load", chapter.load);
      releaseDocument(chapter);
    }
    this.chapters.clear();
    this.document = null;
  }
  owns(frame) {
    return frame.matches(EPUB_FRAMES) || frame.hasAttribute("enable-annotation") || !!this.surfaces?.ownsChapter(frame);
  }
  observe(frame) {
    if (!this.document || !frame.isConnected || !this.owns(frame)) return;
    if (!this.chapters.has(frame)) {
      const load = () => this.scan(frame);
      this.chapters.set(frame, { load, document: null, events: null });
      frame.addEventListener("load", load);
    }
    this.scan(frame);
  }
  scan(frame) {
    const chapter = this.chapters.get(frame);
    if (!chapter || !frame.isConnected || !this.owns(frame)) return;
    let document2;
    try {
      document2 = frame.contentDocument;
    } catch {
      releaseDocument(chapter);
      return;
    }
    if (chapter.document !== document2) releaseDocument(chapter);
    if (!document2?.body) return;
    if (!chapter.document) {
      chapter.events = epubDocumentEvents(document2, this.host);
      chapter.document = document2;
    }
    chapter.events.bind();
    refreshReadingHighlightsInPlace(document2.body, (root) => {
      if (automaticHighlighting(this.host.settings)) {
        this.host.wrapMatchesInElement(root, "script,style,code,pre,.lexis-hl,.lexis-popover", { external: true });
      }
    });
  }
  prune() {
    for (const [frame, chapter] of this.chapters) {
      if (frameBelongsToDocument(frame, this.document) && this.surfaces?.ownsChapter(frame)) continue;
      frame.removeEventListener("load", chapter.load);
      releaseDocument(chapter);
      this.chapters.delete(frame);
    }
  }
};

// src/reader-hover.ts
var ReaderHover = class {
  constructor(host, clock = window) {
    this.host = host;
    this.clock = clock;
    this.showing = null;
    this.hiding = null;
    this.target = null;
    this.surfaceTarget = null;
  }
  enter(target, delay) {
    this.keepOpen();
    if (this.host._popover?.dataset.lexisKey === target.dataset.lexisKey || this.target === target) return;
    this.cancelOpen();
    this.target = target;
    const open = () => {
      this.showing = null;
      if (this.target === target && target.isConnected) void this.host.showPopover(target);
    };
    if (delay) {
      const clock = overlayDocumentFor(target).defaultView || this.clock;
      this.showing = { clock, id: clock.setTimeout(open, delay) };
    } else open();
  }
  leave(target) {
    if (this.target === target) this.cancelOpen();
    if (this.host._popover?.dataset.lexisKey === target.dataset.lexisKey) this.scheduleHide();
  }
  move(target, insidePopover) {
    if (target === this.surfaceTarget) return false;
    if (this.surfaceTarget) {
      this.cancelOpen();
      if (!insidePopover) this.scheduleHide();
    }
    this.surfaceTarget = target;
    return true;
  }
  keepOpen() {
    if (this.hiding) this.hiding.clock.clearTimeout(this.hiding.id);
    this.hiding = null;
  }
  scheduleHide() {
    this.keepOpen();
    const clock = this.host._popover?.ownerDocument.defaultView || this.clock;
    this.hiding = { clock, id: clock.setTimeout(() => {
      this.hiding = null;
      const popover = this.host._popover;
      if (popover?.dataset.lexisResizing !== "1" && popover?.dataset.lexisEditing !== "1") this.host.removePopover();
    }, 220) };
  }
  cancelOpen() {
    if (this.showing) this.showing.clock.clearTimeout(this.showing.id);
    this.showing = null;
    this.target = null;
  }
  dispose() {
    this.cancelOpen();
    this.keepOpen();
    this.surfaceTarget = null;
  }
};

// src/text-highlight-matches.ts
function textHighlightMatches(text, pattern, resolveKey, index) {
  if (!text || !pattern) return [];
  const regex = new RegExp(pattern, "gi");
  const matches = [];
  let match;
  while (match = regex.exec(text)) {
    const key = resolveKey(match[0]);
    const entry = index.get(key);
    if (entry) matches.push({ start: match.index, end: match.index + match[0].length, key, entry });
    if (!match[0].length) regex.lastIndex++;
  }
  return matches;
}

// src/excalidraw-highlights.ts
function fallbackSceneToViewport(point, state) {
  const zoom = Number(state.zoom?.value) || 1;
  return {
    x: (point.sceneX + state.scrollX) * zoom + state.offsetLeft,
    y: (point.sceneY + state.scrollY) * zoom + state.offsetTop
  };
}
function sceneElementBox(element, state, convert = fallbackSceneToViewport) {
  const start = convert({ sceneX: element.x, sceneY: element.y }, state);
  const end = convert({ sceneX: element.x + element.width, sceneY: element.y + element.height }, state);
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
    angle: Number(element.angle) || 0
  };
}
function pointInHighlightBox(x, y, box) {
  const centerX = box.left + box.width / 2;
  const centerY = box.top + box.height / 2;
  const cosine = Math.cos(-box.angle);
  const sine = Math.sin(-box.angle);
  const deltaX = x - centerX;
  const deltaY = y - centerY;
  const localX = deltaX * cosine - deltaY * sine;
  const localY = deltaX * sine + deltaY * cosine;
  return Math.abs(localX) <= box.width / 2 && Math.abs(localY) <= box.height / 2;
}
function sceneApiForView(view, plugin) {
  if (view.excalidrawAPI) return view.excalidrawAPI;
  if (plugin && "ea" in plugin && plugin.ea) return plugin.ea.getAPI(view)?.getExcalidrawAPI?.() || null;
  if (plugin && "getAPI" in plugin) return plugin.getAPI(view)?.getExcalidrawAPI?.() || null;
  return null;
}
var ExcalidrawHighlights = class {
  constructor(host) {
    this.host = host;
    this.views = /* @__PURE__ */ new Map();
    this.timer = 0;
  }
  start() {
    this.refresh();
    this.timer = window.setInterval(() => this.refresh(), 160);
    this.host.registerInterval(this.timer);
  }
  destroy() {
    window.clearInterval(this.timer);
    for (const state of this.views.values()) this.removeState(state);
    this.views.clear();
  }
  highlightAt(event) {
    for (const state of this.views.values()) {
      if (state.root.ownerDocument !== event.view?.document || !state.root.isConnected) continue;
      if (state.interacting) continue;
      const rootRect = state.root.getBoundingClientRect();
      if (event.clientX < rootRect.left || event.clientX > rootRect.right || event.clientY < rootRect.top || event.clientY > rootRect.bottom) continue;
      for (let index = state.anchors.length - 1; index >= 0; index--) {
        const anchor = state.anchors[index];
        if (pointInHighlightBox(event.clientX, event.clientY, anchor.box)) return anchor.element;
      }
    }
    return null;
  }
  refresh() {
    const plugin = this.excalidrawPlugin();
    const seen = /* @__PURE__ */ new Set();
    this.host.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if (view?.getViewType?.() !== "excalidraw") return;
      seen.add(view);
      this.renderView(plugin, view);
    });
    for (const [view, state] of this.views) {
      if (seen.has(view) && state.root.isConnected) continue;
      this.removeState(state);
      this.views.delete(view);
    }
  }
  renderView(plugin, view) {
    const root = view.containerEl?.querySelector(".excalidraw");
    if (!root) return;
    const viewState = this.ensureState(view, root);
    if (viewState.interacting) return;
    const api = viewState.api || sceneApiForView(view, plugin);
    if (!api) return;
    viewState.api = api;
    const appState = api.getAppState();
    const inactiveSignature = `inactive:${Number(automaticHighlighting(this.host.settings))}:${this.host._indexBuildId || 0}`;
    if (!automaticHighlighting(this.host.settings) || !this.host._pattern || !this.host.index.size) {
      if (viewState.signature !== inactiveSignature) {
        viewState.signature = inactiveSignature;
        viewState.anchors = [];
        viewState.layer.replaceChildren();
      }
      return;
    }
    const elements = api.getSceneElements();
    const matches = this.matches(viewState, elements);
    const rootRect = root.getBoundingClientRect();
    this.positionLayer(viewState.layer, rootRect);
    const signature = this.signature(appState, matches, rootRect);
    if (signature === viewState.signature) return;
    viewState.signature = signature;
    viewState.anchors = [];
    viewState.layer.replaceChildren();
    if (!matches.length) return;
    const sceneToViewport = this.sceneConverter(root);
    for (const item of matches) {
      const box = sceneElementBox(item.element, appState, sceneToViewport);
      if (box.width < 1 || box.height < 1) continue;
      this.renderTextMirror(viewState, item, box, rootRect, appState);
    }
  }
  matches(viewState, elements) {
    if (viewState.indexBuildId !== this.host._indexBuildId) {
      viewState.indexBuildId = this.host._indexBuildId;
      viewState.matchCache.clear();
    }
    const matches = [];
    const liveIds = /* @__PURE__ */ new Set();
    for (const element of elements) {
      if (element.type !== "text" || element.isDeleted) continue;
      liveIds.add(element.id);
      const text = element.text || element.originalText || "";
      const cached = viewState.matchCache.get(element.id);
      const elementMatches = cached?.version === element.version && cached.text === text ? cached.matches : textHighlightMatches(text, this.host._pattern, (value) => this.host.resolveMatchKey(value), this.host.index);
      if (elementMatches !== cached?.matches) viewState.matchCache.set(element.id, { version: element.version, text, matches: elementMatches });
      if (elementMatches.length) matches.push({ element, text, matches: elementMatches });
    }
    for (const id of viewState.matchCache.keys()) if (!liveIds.has(id)) viewState.matchCache.delete(id);
    return matches;
  }
  renderTextMirror(viewState, item, box, root, state) {
    const mirror = viewState.layer.createDiv({ cls: "lexis-excalidraw-text-mirror", attr: { "aria-hidden": "true" } });
    mirror.style.left = `${box.left - root.left}px`;
    mirror.style.top = `${box.top - root.top}px`;
    mirror.style.width = `${box.width}px`;
    mirror.style.height = `${box.height}px`;
    mirror.style.transform = `rotate(${box.angle}rad)`;
    mirror.style.fontSize = `${Math.max(1, Number(item.element.fontSize) || 20) * (Number(state.zoom?.value) || 1)}px`;
    mirror.style.fontFamily = this.fontFamily(item.element, viewState.root);
    mirror.style.lineHeight = String(Number(item.element.lineHeight) || 1.25);
    mirror.style.textAlign = item.element.textAlign || "left";
    const anchors = [];
    let offset = 0;
    for (const match of item.matches) {
      if (match.start > offset) mirror.appendChild(mirror.ownerDocument.createTextNode(item.text.slice(offset, match.start)));
      const anchor = mirror.createSpan({ cls: "lexis-hl lexis-excalidraw-hl", text: item.text.slice(match.start, match.end) });
      anchor.dataset.lexisKey = match.key;
      anchor.setAttribute("style", `${this.host.inlineStyleForEntry(match.entry, { external: true })};padding:0;`);
      anchors.push(anchor);
      offset = match.end;
    }
    if (offset < item.text.length) mirror.appendChild(mirror.ownerDocument.createTextNode(item.text.slice(offset)));
    for (const anchor of anchors) for (const rect of Array.from(anchor.getClientRects())) {
      if (rect.width > 0 && rect.height > 0) viewState.anchors.push({
        element: anchor,
        box: { left: rect.left, top: rect.top, width: rect.width, height: rect.height, angle: 0 }
      });
    }
  }
  fontFamily(element, root) {
    const fontFamily = Number(element.fontFamily) || 1;
    const resolved = this.excalidrawLib(root)?.getFontFamilyString?.({ fontFamily });
    if (resolved) return resolved;
    return { 1: "Virgil", 2: "Helvetica", 3: "Cascadia", 4: "Assistant", 5: "Lilita One", 6: "Nunito", 7: "Comic Shanns", 8: "Excalifont" }[fontFamily] || "sans-serif";
  }
  signature(state, matches, root) {
    return [
      this.host._indexBuildId || 0,
      Number(state.viewModeEnabled),
      state.zoom?.value,
      state.scrollX,
      state.scrollY,
      state.offsetLeft,
      state.offsetTop,
      root.width,
      root.height,
      root.left,
      root.top,
      ...matches.map(({ element, matches: textMatches }) => [
        element.id,
        element.version,
        element.x,
        element.y,
        element.width,
        element.height,
        element.angle,
        element.fontSize,
        element.fontFamily,
        element.lineHeight,
        element.textAlign,
        ...textMatches.map((match) => `${match.start}:${match.end}:${match.key}:${this.host.inlineStyleForEntry(match.entry, { external: true })}`)
      ].join(":"))
    ].join("|");
  }
  ensureState(view, root) {
    const existing = this.views.get(view);
    const mount = this.layerMount(root);
    if (existing?.root === root && existing.mount === mount && existing.layer.isConnected) return existing;
    if (existing) this.removeState(existing);
    const layer = mount.createDiv({ cls: "lexis-excalidraw-hl-layer" });
    const state = {
      root,
      mount,
      layer,
      anchors: [],
      api: null,
      matchCache: /* @__PURE__ */ new Map(),
      indexBuildId: -1,
      signature: "",
      interacting: false,
      interactionTimer: 0,
      stopInteractionTracking: () => {
      }
    };
    state.stopInteractionTracking = this.trackInteractions(state);
    this.views.set(view, state);
    return state;
  }
  removeState(state) {
    state.stopInteractionTracking();
    state.layer.remove();
  }
  trackInteractions(state) {
    const root = state.root;
    const ownerDocument = root.ownerDocument;
    const hostWindow = ownerDocument.defaultView || window;
    const begin = () => {
      hostWindow.clearTimeout(state.interactionTimer);
      state.interacting = true;
      state.layer.classList.add("is-interacting");
    };
    const finish = () => {
      hostWindow.clearTimeout(state.interactionTimer);
      if (!state.interacting) return;
      state.interacting = false;
      state.layer.classList.remove("is-interacting");
      state.signature = "";
      this.refresh();
    };
    const wheel = () => {
      begin();
      state.interactionTimer = hostWindow.setTimeout(finish, 140);
    };
    root.addEventListener("pointerdown", begin, true);
    root.addEventListener("wheel", wheel, { capture: true, passive: true });
    ownerDocument.addEventListener("pointerup", finish, true);
    ownerDocument.addEventListener("pointercancel", finish, true);
    return () => {
      hostWindow.clearTimeout(state.interactionTimer);
      root.removeEventListener("pointerdown", begin, true);
      root.removeEventListener("wheel", wheel, true);
      ownerDocument.removeEventListener("pointerup", finish, true);
      ownerDocument.removeEventListener("pointercancel", finish, true);
    };
  }
  layerMount(root) {
    const fullscreen = root.ownerDocument.fullscreenElement;
    return fullscreen?.instanceOf(HTMLElement) && fullscreen.contains(root) ? fullscreen : root.ownerDocument.body;
  }
  positionLayer(layer, root) {
    layer.style.left = `${root.left}px`;
    layer.style.top = `${root.top}px`;
    layer.style.width = `${root.width}px`;
    layer.style.height = `${root.height}px`;
  }
  sceneConverter(root) {
    return this.excalidrawLib(root)?.sceneCoordsToViewportCoords || fallbackSceneToViewport;
  }
  excalidrawLib(root) {
    const ownerWindow = root.ownerDocument.defaultView;
    const mainWindow = window;
    return ownerWindow?.ExcalidrawLib || mainWindow.ExcalidrawLib;
  }
  excalidrawPlugin() {
    const plugins = this.host.app.plugins;
    const plugin = plugins?.getPlugin?.("obsidian-excalidraw-plugin") || plugins?.plugins?.["obsidian-excalidraw-plugin"];
    if (!plugin) return null;
    const api = plugin;
    return api.ea?.getAPI || typeof api.getAPI === "function" ? api : null;
  }
};

// src/canvas-edge-highlights.ts
function edgeLabelMatches(text, pattern, resolveKey, index) {
  return textHighlightMatches(text, pattern, resolveKey, index);
}
function containsEdgeLabel(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const element = node;
  return element.matches(".canvas-path-label-wrapper, .canvas-path-label-wrapper *") || !!element.querySelector(".canvas-path-label-wrapper");
}
var CanvasEdgeHighlights = class {
  constructor(host) {
    this.host = host;
    this.documents = /* @__PURE__ */ new Map();
  }
  activate(document2) {
    if (!document2.body) return;
    if (!this.documents.has(document2)) {
      const Observer = document2.defaultView?.MutationObserver || MutationObserver;
      const observer = new Observer((mutations) => {
        if (!mutations.some((mutation) => {
          if (mutation.target.closest?.(".lexis-canvas-edge-hl-layer")) return false;
          return containsEdgeLabel(mutation.target) || [...mutation.addedNodes, ...mutation.removedNodes].some(containsEdgeLabel);
        })) return;
        this.schedule(document2);
      });
      observer.observe(document2.body, { childList: true, subtree: true });
      const input = (event) => {
        const target = event.target;
        const textarea = target && typeof target === "object" && "nodeType" in target && target.nodeType === Node.ELEMENT_NODE ? target : null;
        if (textarea?.tagName === "TEXTAREA" && textarea.closest(".canvas-path-label-wrapper")) this.schedule(document2);
      };
      document2.addEventListener("input", input, true);
      document2.addEventListener("scroll", input, true);
      this.documents.set(document2, { observer, input, frame: 0 });
    }
    this.schedule(document2);
  }
  close(document2) {
    const state = this.documents.get(document2);
    if (!state) return;
    state.observer.disconnect();
    document2.removeEventListener("input", state.input, true);
    document2.removeEventListener("scroll", state.input, true);
    document2.defaultView?.cancelAnimationFrame(state.frame);
    document2.querySelectorAll(".lexis-canvas-edge-hl-layer").forEach((element) => element.remove());
    this.documents.delete(document2);
  }
  destroy() {
    for (const document2 of [...this.documents.keys()]) this.close(document2);
  }
  refresh() {
    for (const document2 of this.documents.keys()) this.schedule(document2, true);
  }
  schedule(document2, force = false) {
    const state = this.documents.get(document2);
    if (!state) return;
    if (force) document2.querySelectorAll(".lexis-canvas-edge-hl-layer").forEach((layer) => delete layer.dataset.lexisSignature);
    if (state.frame) return;
    state.frame = (document2.defaultView || window).requestAnimationFrame(() => {
      state.frame = 0;
      this.render(document2);
    });
  }
  render(document2) {
    for (const wrapper of document2.querySelectorAll(".canvas-path-label-wrapper")) this.renderLabel(wrapper);
  }
  renderLabel(wrapper) {
    const textarea = wrapper.querySelector("textarea");
    let layer = wrapper.querySelector(":scope > .lexis-canvas-edge-hl-layer");
    const active = automaticHighlighting(this.host.settings) && this.host._pattern && this.host.index.size;
    const matches = active ? edgeLabelMatches(textarea?.value || "", this.host._pattern, (value) => this.host.resolveMatchKey(value), this.host.index) : [];
    if (!textarea || !matches.length) {
      layer?.remove();
      return;
    }
    const signature = [
      this.host._indexBuildId || 0,
      textarea.value,
      textarea.scrollLeft,
      textarea.scrollTop,
      ...matches.map((match) => `${match.start}:${match.end}:${match.key}:${this.host.inlineStyleForEntry(match.entry, { external: true })}`)
    ].join("|");
    if (layer?.dataset.lexisSignature === signature) return;
    if (!layer) {
      layer = wrapper.createDiv({ cls: "lexis-canvas-edge-hl-layer", attr: { "aria-hidden": "true" } });
    }
    layer.dataset.lexisSignature = signature;
    layer.replaceChildren();
    const content = layer.createDiv({ cls: "lexis-canvas-edge-hl-content" });
    this.copyTypography(textarea, content);
    content.style.transform = `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`;
    let offset = 0;
    for (const match of matches) {
      if (match.start > offset) content.appendChild(content.ownerDocument.createTextNode(textarea.value.slice(offset, match.start)));
      const highlight = content.createSpan({ cls: "lexis-hl lexis-canvas-edge-hl", text: textarea.value.slice(match.start, match.end) });
      highlight.dataset.lexisKey = match.key;
      highlight.setAttribute("style", `${this.host.inlineStyleForEntry(match.entry, { external: true })};padding:0;`);
      offset = match.end;
    }
    if (offset < textarea.value.length) content.appendChild(content.ownerDocument.createTextNode(textarea.value.slice(offset)));
  }
  copyTypography(source, target) {
    const style = source.ownerDocument.defaultView?.getComputedStyle(source);
    if (!style) return;
    target.style.fontFamily = style.fontFamily;
    target.style.fontSize = style.fontSize;
    target.style.fontStyle = style.fontStyle;
    target.style.fontWeight = style.fontWeight;
    target.style.borderStyle = style.borderStyle;
    target.style.borderWidth = style.borderWidth;
    target.style.letterSpacing = style.letterSpacing;
    target.style.lineHeight = style.lineHeight;
    target.style.padding = style.padding;
    target.style.textAlign = style.textAlign;
    target.style.textIndent = style.textIndent;
    target.style.textTransform = style.textTransform;
    target.style.wordSpacing = style.wordSpacing;
  }
};

// src/inline-heading-suggest.ts
var import_obsidian34 = require("obsidian");

// src/inline-heading-suggestions.ts
function inlineHeadingQuery(line, cursorCh, level) {
  if (level < 1 || level > 6) return null;
  const beforeCursor = line.slice(0, cursorCh);
  const match = new RegExp(`^(\\s{0,3}${"#".repeat(level)}\\s+)(.*)$`).exec(beforeCursor);
  return match ? { startCh: match[1].length, query: match[2] } : null;
}
function collectInlineHeadingSuggestions(sources2, level) {
  const suggestions = /* @__PURE__ */ new Map();
  for (const source of sources2) for (const heading of source.headings) {
    const name = heading.level === level ? heading.heading.trim() : "";
    const key = name.normalize("NFKC").toLowerCase();
    if (!key) continue;
    const item = suggestions.get(key) || { name, paths: /* @__PURE__ */ new Set(), occurrenceCount: 0 };
    item.paths.add(source.path);
    item.occurrenceCount++;
    suggestions.set(key, item);
  }
  return [...suggestions.values()].map(({ name, paths, occurrenceCount }) => ({ name, fileCount: paths.size, occurrenceCount }));
}
function rankInlineHeadingSuggestions(suggestions, query, limit = 30) {
  const value = query.trim();
  if (!value) return [...suggestions].sort((left, right) => right.fileCount - left.fileCount || right.occurrenceCount - left.occurrenceCount || left.name.localeCompare(right.name)).slice(0, limit);
  return suggestions.map((item) => ({ item, score: fuzzyScore(value, item.name) })).filter(({ score }) => Number.isFinite(score)).sort((left, right) => left.score - right.score || right.item.fileCount - left.item.fileCount || left.item.name.localeCompare(right.item.name)).slice(0, limit).map(({ item }) => item);
}

// src/inline-heading-suggest.ts
var InlineHeadingSuggest = class extends import_obsidian34.EditorSuggest {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.limit = 30;
  }
  onTrigger(cursor, editor, file) {
    if (!file || !this.plugin.settings.inlineEntriesEnabled || this.plugin.settings.inlineClassificationMode !== "heading" || !this.plugin.isInlineSourceFile(file)) return null;
    const match = inlineHeadingQuery(editor.getLine(cursor.line), cursor.ch, this.plugin.settings.inlineHeadingLevel);
    if (!match) return null;
    return { start: { line: cursor.line, ch: match.startCh }, end: cursor, query: match.query };
  }
  getSuggestions(context) {
    const level = this.plugin.settings.inlineHeadingLevel;
    if (level < 1 || level > 6) return [];
    const sources2 = this.app.vault.getMarkdownFiles().filter((file) => this.plugin.isInlineSourceFile(file)).map((file) => ({ path: file.path, headings: this.app.metadataCache.getFileCache(file)?.headings || [] }));
    return rankInlineHeadingSuggestions(collectInlineHeadingSuggestions(sources2, level), context.query, this.limit);
  }
  renderSuggestion(suggestion, element) {
    element.createDiv({ cls: "lexis-file-suggest-name", text: suggestion.name });
    element.createDiv({ cls: "lexis-file-suggest-path", text: this.plugin.t("suggest.headingSources", { count: suggestion.fileCount }) });
  }
  selectSuggestion(suggestion) {
    if (!this.context) return;
    this.context.editor.replaceRange(suggestion.name, this.context.start, this.context.end);
    this.close();
  }
};

// src/inline-color-suggest.ts
var import_obsidian35 = require("obsidian");

// src/entry-color-suggestions.ts
function inlineColorQuery(line, cursorCh, delimiter) {
  const beforeCursor = line.slice(0, cursorCh);
  const match = /\{([^{}]*)$/.exec(beforeCursor);
  if (!match) return null;
  const openAt = beforeCursor.length - match[0].length;
  const entryText = beforeCursor.slice(0, openAt).replace(/^\s*[-*+]\s+/, "").trim();
  if (!entryText) return null;
  const delimiterAt = line.indexOf(delimiter || "::");
  if (delimiterAt >= 0 && openAt > delimiterAt) return null;
  return { startCh: openAt + 1, query: match[1] };
}
function collectEntryColorSuggestions(entries) {
  const suggestions = /* @__PURE__ */ new Map();
  for (const entry of entries || []) {
    const group = String(entry?.name || "").trim();
    const color = String(entry?.color || "").trim();
    for (const rawName of group.split(/\s*\/\s*/)) {
      const name = rawName.trim();
      const key = name.normalize("NFKC").toLowerCase();
      if (key && !suggestions.has(key)) suggestions.set(key, { name, group, color });
    }
  }
  return [...suggestions.values()];
}
function rankEntryColorSuggestions(suggestions, query, limit = 30) {
  const value = query.trim();
  if (!value) return suggestions.slice(0, limit);
  return suggestions.map((item) => ({ item, score: fuzzyScore(value, item.name) })).filter(({ score }) => Number.isFinite(score)).sort((left, right) => left.score - right.score || left.item.name.localeCompare(right.item.name)).slice(0, limit).map(({ item }) => item);
}

// src/inline-color-suggest.ts
var InlineColorSuggest = class extends import_obsidian35.EditorSuggest {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.limit = 30;
  }
  onTrigger(cursor, editor, file) {
    if (!file || !this.plugin.settings.inlineEntriesEnabled || !this.plugin.isInlineSourceFile(file)) return null;
    const match = inlineColorQuery(editor.getLine(cursor.line), cursor.ch, this.plugin.settings.inlineEntryDelimiter);
    if (!match) return null;
    return { start: { line: cursor.line, ch: match.startCh }, end: cursor, query: match.query };
  }
  getSuggestions(context) {
    return rankEntryColorSuggestions(collectEntryColorSuggestions(this.plugin.settings.entryColors), context.query, this.limit);
  }
  renderSuggestion(suggestion, element) {
    const title = element.createDiv({ cls: "lexis-color-suggest-name" });
    title.createSpan({ cls: "lexis-color-suggest-swatch" }).setCssStyles({ backgroundColor: suggestion.color });
    title.createSpan({ text: suggestion.name });
    if (suggestion.group !== suggestion.name) element.createDiv({ cls: "lexis-file-suggest-path", text: suggestion.group });
  }
  selectSuggestion(suggestion) {
    if (!this.context) return;
    const { editor, start, end } = this.context;
    const hasClosingBrace = editor.getLine(end.line).charAt(end.ch) === "}";
    editor.replaceRange(suggestion.name + (hasClosingBrace ? "" : "}"), start, end);
    editor.setCursor({ line: end.line, ch: start.ch + suggestion.name.length + 1 });
    this.close();
  }
};

// src/status-bar.ts
function statusBarSummary(runtime) {
  const aliasPart = runtime.settings.includeAliases && runtime.stats.aliases ? runtime.t("status.aliases", { count: runtime.stats.aliases }) : "";
  const inlinePart = runtime.stats.inlineEntries ? runtime.t("status.inline", { count: runtime.stats.inlineEntries }) : "";
  const duePart = runtime.stats.due ? ` \xB7 \u23F0${runtime.stats.due}` : "";
  const bridgePart = runtime.bridge?.running ? " \xB7 \u{1F310}" : "";
  return runtime.t("status.summary", {
    words: runtime.stats.words,
    aliases: aliasPart,
    inline: inlinePart,
    due: duePart,
    bridge: bridgePart
  });
}
var LexisStatusBar = class {
  constructor(plugin, setIcon10) {
    this.plugin = plugin;
    this.setIcon = setIcon10;
    this.element = null;
  }
  mount() {
    const element = this.plugin.addStatusBarItem();
    element.addClass("lexis-status-bar");
    element.setAttribute("role", "button");
    element.tabIndex = 0;
    this.element = element;
    this.plugin.registerDomEvent(element, "click", () => this.toggleExpanded());
    this.plugin.registerDomEvent(element, "keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      this.toggleExpanded();
    });
    this.plugin.addCommand(this.visibilityCommand());
    this.update();
  }
  update() {
    const element = this.element;
    if (!element) return;
    const visible = this.plugin.settings.statusBarVisible !== false;
    element.hidden = !visible;
    if (!visible) return;
    const summary = statusBarSummary(this.plugin);
    element.empty();
    const icon = element.createSpan({ cls: "lexis-status-bar-icon" });
    this.setIcon(icon, "book-open");
    if (this.plugin.settings.statusBarExpanded) {
      element.createSpan({ cls: "lexis-status-bar-summary", text: summary });
    }
    element.setAttribute("aria-expanded", String(!!this.plugin.settings.statusBarExpanded));
    element.setAttribute("aria-label", this.plugin.t("status.toggleDetailsAria"));
    element.setAttribute("title", summary);
  }
  setVisible(visible) {
    this.plugin.settings.statusBarVisible = visible;
    this.update();
    void this.plugin.saveSettings();
  }
  toggleExpanded() {
    this.plugin.settings.statusBarExpanded = !this.plugin.settings.statusBarExpanded;
    this.update();
    void this.plugin.saveSettings();
  }
  visibilityCommand() {
    return {
      id: "toggle-status-bar",
      name: this.plugin.t("command.toggleStatusBar"),
      callback: () => this.setVisible(this.plugin.settings.statusBarVisible === false)
    };
  }
};

// src/review-dashboard.ts
var ReviewDashboard = class {
  constructor(plugin) {
    this.plugin = plugin;
    this.listeners = /* @__PURE__ */ new Set();
    this.pending = null;
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  refresh() {
    this.pending = null;
    for (const listener of this.listeners) listener();
  }
  load() {
    if (this.pending === null) {
      const task = this.collect();
      this.pending = task;
      void task.then(() => {
        if (this.pending === task) this.pending = null;
      }, () => {
        if (this.pending === task) this.pending = null;
      });
    }
    return this.pending;
  }
  async collect() {
    const { settings } = this.plugin;
    const date = localDate(/* @__PURE__ */ new Date());
    const plans = await Promise.all(settings.reviewPlans.map(async (plan) => ({ plan, items: await this.plugin.collectReviewItems(planOptions(plan), true) })));
    const scheduled = plans.filter(({ plan }) => plan.mode !== "cram");
    const globalItems = scheduled.length ? mergeReviewItems(scheduled.map((plan) => plan.items)) : await this.plugin.collectReviewItems(planOptions(), true);
    const globalOptions = scheduled.length ? { sources: [...new Set(globalItems.map((item) => item.file.path))].map((value) => ({ scope: "file", value })), content: "both" } : planOptions();
    const globalId = `global:${scheduled.map(({ plan }) => plan.id).join(",")}`;
    let changed = false;
    const summary = (id, items, options) => {
      let target = settings.reviewDailyTargets[id];
      if (!target || target.date !== date) {
        target = createDailyTarget(items, settings, date, options);
        settings.reviewDailyTargets[id] = target;
        changed = true;
      } else if (!target.keys.length) {
        const next = createDailyTarget(items, settings, date, options);
        if (next.keys.length) {
          target = next;
          settings.reviewDailyTargets[id] = target;
          changed = true;
        }
      }
      return dashboardSummary(items, settings, target, options);
    };
    const today = summary(globalId, globalItems, globalOptions);
    const result = plans.map(({ plan, items }) => ({ plan, items, summary: summary(plan.id, items, planOptions(plan)) }));
    if (settings.reviewGoalHistory[date]?.goal !== today.goal || settings.reviewGoalHistory[date]?.minimum !== today.minimum) {
      settings.reviewGoalHistory[date] = { goal: today.goal, minimum: today.minimum };
      changed = true;
    }
    const active = /* @__PURE__ */ new Set([globalId, ...plans.map(({ plan }) => plan.id)]);
    for (const id of Object.keys(settings.reviewDailyTargets)) {
      if (!active.has(id) || settings.reviewDailyTargets[id].date !== date) {
        delete settings.reviewDailyTargets[id];
        changed = true;
      }
    }
    if (changed) await this.plugin.saveSettings();
    return { today, plans: result };
  }
};

// src/marginnote-export.ts
var import_obsidian36 = require("obsidian");
var MarginNoteExport = class {
  constructor(host) {
    this.host = host;
    this.timer = 0;
    this.writing = Promise.resolve(0);
    this.stopped = false;
    host.addCommand({
      id: "export-marginnote-dictionary",
      name: host.t("mn.exportCommand"),
      callback: async () => {
        try {
          await host.rebuildIndex(false);
          const count = await this.export();
          new import_obsidian36.Notice(host.t("mn.exported", { count, path: marginNoteExportPath(host.settings.marginNoteExportFolder) }));
        } catch (error) {
          this.report(error);
        }
      }
    });
    host.registerEvent(host.app.vault.on("modify", (file) => {
      if (!host.settings.marginNoteAutoExport) return;
      if ([...host.index.values()].some((entry) => entry.file.path === file.path)) this.schedule();
    }));
    host.register(() => {
      this.stopped = true;
      window.clearTimeout(this.timer);
    });
  }
  schedule() {
    window.clearTimeout(this.timer);
    if (!this.host.settings.marginNoteAutoExport || this.stopped) return;
    this.timer = window.setTimeout(() => {
      void this.export().catch((error) => this.report(error));
    }, 1500);
  }
  export() {
    const run = this.writing.catch(() => 0).then(() => this.write());
    this.writing = run;
    return run;
  }
  async write() {
    if (this.stopped) return 0;
    const path = marginNoteExportPath(this.host.settings.marginNoteExportFolder);
    const excluded = new Set((this.host.settings.excludeTags || "").split(/[,，;；\s]+/).map((tag) => tag.replace(/^#/, "").toLowerCase()).filter(Boolean));
    const files = [...new Map([...this.host.index.values()].map((entry) => [entry.file.path, entry.file])).values()];
    const tagsByPath = new Map([...this.host.index.values()].map((entry) => [entry.file.path, entry.tags || /* @__PURE__ */ new Set()]));
    const membership = resolveDictionaries(this.host.app, this.host.settings.dicts || [], (file) => tagsByPath.get(file.path), files);
    const dictionary = await buildMarginNoteDictionary(
      this.host.app.vault.getName(),
      this.host.index,
      (entry) => this.host.app.vault.cachedRead(entry.file),
      {
        include: (entry) => inMarginNoteScope(entry, this.host.settings.marginNoteSources, membership.paths) && ![...entry.tags || []].some((tag) => excluded.has(tag.toLowerCase())) && !entry.archived && !entry.retired,
        color: (entry) => this.host.colorForEntry?.(entry) || ""
      }
    );
    if (this.stopped) return 0;
    const adapter = this.host.app.vault.adapter;
    if (await adapter.exists(path)) {
      const previous = parseMarginNoteDictionary(await adapter.read(path));
      if (previous.source.id !== dictionary.source.id) throw new Error(this.host.t("mn.otherSource"));
      if (previous.revision === dictionary.revision) return dictionary.entries.length;
    }
    const parts = path.split("/").slice(0, -1);
    for (let end = 1; end <= parts.length; end++) {
      const folder = parts.slice(0, end).join("/");
      if (!await adapter.exists(folder)) await adapter.mkdir(folder);
    }
    await adapter.write(path, JSON.stringify(dictionary, null, 2) + "\n");
    return dictionary.entries.length;
  }
  report(error) {
    new import_obsidian36.Notice(this.host.t("mn.exportFailed", { error: error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error" }));
  }
};

// src/marginnote-capture.ts
var import_obsidian37 = require("obsidian");

// src/marginnote-capture-data.ts
function parseMarginNoteCapture(params) {
  const word = typeof params.word === "string" ? params.word.trim() : "";
  const sentence = typeof params.sentence === "string" ? params.sentence.trim() : "";
  const source = typeof params.source === "string" ? params.source.trim() : "";
  if (!word || word.length > 200 || /[\r\n]/.test(word) || sentence.length > 4e3 || source.length > 500) {
    throw new Error("\u5212\u8BCD\u5185\u5BB9\u65E0\u6548\u6216\u8FC7\u957F / Invalid or oversized selection");
  }
  return { word, sentence, source };
}

// src/marginnote-capture.ts
var MarginNoteCaptureModal = class extends import_obsidian37.Modal {
  constructor(host, draft) {
    super(host.app);
    this.host = host;
    this.draft = draft;
    this.aliasSearch = null;
  }
  onOpen() {
    const t = this.host.t.bind(this.host);
    this.titleEl.setText(t("mn.capture"));
    let word = this.draft.word;
    let alias = "";
    let aliasFile = null;
    let folderInput;
    const folders = this.host.dictFolders();
    let folder = folders.includes(this.host.settings.lastSelectionFolder) ? this.host.settings.lastSelectionFolder : folders[0] || "";
    let pending = false;
    const root = this.contentEl;
    root.createDiv({ text: [this.draft.source, this.draft.sentence].filter(Boolean).join("\n") });
    const title = new import_obsidian37.Setting(root).setName(t("mn.captureWord"));
    title.addText((input) => {
      input.setValue(word).onChange((value) => {
        word = value;
        alias = "";
        aliasFile = null;
        folderInput?.setDisabled(false);
      });
      title.addExtraButton((button) => button.setIcon("link").setTooltip(t("selection.alias")).onClick(() => {
        this.aliasSearch?.close();
        this.aliasSearch = openAliasCombobox({
          document: root.ownerDocument,
          anchor: button.extraSettingsEl,
          targets: collectAliasTargets(this.host.index),
          initialValue: word,
          placeholder: t("selection.aliasSearch"),
          createLabel: t("selection.aliasCreate"),
          existingLabel: (target) => t("selection.aliasExisting", { word: target.title }),
          emptyText: t("selection.aliasNoResults"),
          onCreate: (value) => {
            word = value;
            alias = this.draft.word;
            aliasFile = null;
            input.setValue(word);
            folderInput?.setDisabled(false);
          },
          onPick: (target) => {
            word = target.title;
            alias = this.draft.word;
            aliasFile = target.file;
            input.setValue(word);
            folderInput?.setDisabled(true);
          },
          onClose: () => {
            this.aliasSearch = null;
          }
        });
      }));
    });
    new import_obsidian37.Setting(root).setName(t("selection.chooseDictionary")).addText((input) => {
      folderInput = input;
      input.setValue(folder).onChange((value) => {
        folder = value.trim();
      });
      new FolderSuggest(this.app, input.inputEl, () => folders, (value) => {
        folder = value;
        input.setValue(value);
      });
    });
    new import_obsidian37.Setting(root).addButton((button) => button.setButtonText(t("mn.cancel")).onClick(() => this.close())).addButton((button) => button.setButtonText(t("selection.add")).setCta().onClick(async () => {
      if (pending) return;
      if (!word.trim() || !aliasFile && folders.length > 0 && !this.host.dictFolders().includes(folder)) {
        new import_obsidian37.Notice(t("mn.captureInvalid"));
        return;
      }
      pending = true;
      button.setDisabled(true);
      try {
        if (aliasFile) await this.host.attachAlias(alias, aliasFile);
        else {
          await this.host.rememberSelectionFolder(folder);
          await this.host.addWordFromSelection(word, null, null, folder, {
            alias,
            sentence: this.draft.sentence,
            sourceFile: null,
            source: this.draft.source
          });
        }
        this.close();
      } catch {
        new import_obsidian37.Notice(t("mn.captureFailed"));
      } finally {
        pending = false;
        button.setDisabled(false);
      }
    }));
  }
  onClose() {
    this.aliasSearch?.close();
    this.contentEl.empty();
  }
};
function registerMarginNoteCapture(host) {
  host.registerObsidianProtocolHandler("lexis-add", (params) => {
    try {
      const draft = parseMarginNoteCapture(params);
      host.app.workspace.onLayoutReady(() => {
        void host.rebuildIndex(false).then(() => new MarginNoteCaptureModal(host, draft).open()).catch(() => {
          new import_obsidian37.Notice(host.t("mn.captureInvalid"));
        });
      });
    } catch {
      new import_obsidian37.Notice(host.t("mn.captureInvalid"));
    }
  });
}

// src/restore-modal.ts
var import_obsidian38 = require("obsidian");
var LexisRestoreModal = class extends import_obsidian38.Modal {
  constructor(app, plugin, file) {
    super(app);
    this.plugin = plugin;
    this.file = file;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("lexis-restore-modal");
    contentEl.createEl("h3", { text: this.plugin.t("restore.title", { word: this.file.basename }) });
    contentEl.createEl("p", { text: this.plugin.t("restore.question") });
    const row = contentEl.createDiv({ cls: "lexis-modal-btns" });
    const keepButton = row.createEl("button", { cls: "mod-cta", text: this.plugin.t("restore.keep") });
    keepButton.addEventListener("click", () => {
      void (async () => {
        await this.plugin.setArchived(this.file, false);
        new import_obsidian38.Notice(this.plugin.t("restore.kept", { word: this.file.basename }));
        this.close();
      })();
    });
    const resetButton = row.createEl("button", { text: this.plugin.t("restore.reset") });
    resetButton.addEventListener("click", () => {
      void (async () => {
        await this.app.fileManager.processFrontMatter(this.file, (frontmatter) => {
          delete frontmatter["lexis-status"];
          delete frontmatter["lexis-s"];
          delete frontmatter["lexis-d"];
          delete frontmatter["lexis-due"];
          delete frontmatter["lexis-last"];
          delete frontmatter["lexis-reps"];
          delete frontmatter["lexis-lapses"];
        });
        delete this.plugin.settings.reviewHistory[this.file.path];
        await this.plugin.saveSettings();
        await this.plugin.rebuildIndex(false);
        new import_obsidian38.Notice(this.plugin.t("restore.resetDone", { word: this.file.basename }));
        this.close();
      })();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/plugin-base.ts
var import_obsidian39 = require("obsidian");
var errorMessage5 = (error) => error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
var LexisPluginBase = class extends import_obsidian39.Plugin {
  constructor() {
    super(...arguments);
    this._encPending = [];
    this._encSaveTimer = 0;
  }
};

// src/plugin-dictionary.ts
var import_obsidian40 = require("obsidian");
var LexisPluginDictionary = class extends LexisPluginBase {
  t(key, vars) {
    return this.i18n ? this.i18n.t(key, vars) : key;
  }
  async saveSettings() {
    this._dictionaryScopes = null;
    if (this.dataStorage) await this.dataStorage.save();
    else await this.saveData(settingsOnly(this.settings));
  }
  dictionaryScopes() {
    return this._dictionaryScopes ??= resolveDictionaries(this.app, this.settings.dicts || [], (file) => this.getTags(file));
  }
  applyReviewMetadataVisibility() {
    if (this._workspaceDocuments) {
      this._workspaceDocuments.forEach((document2) => document2.body?.classList.toggle("lexis-show-review-metadata", !!this.settings.showReviewMetadata));
      return;
    }
    this.app.workspace.containerEl.ownerDocument.body?.classList.toggle("lexis-show-review-metadata", !!this.settings.showReviewMetadata);
  }
  parseTagRulesText(text) {
    const rules = [];
    for (const line of (text || "").split("\n")) {
      const m = /^\s*#?([^:：]+)[:：]\s*(\S+)(?:\s+(wavy|underline|background))?\s*$/.exec(line);
      if (m) rules.push({ tag: m[1].trim(), color: m[2].trim(), style: m[3] || "" });
    }
    return rules;
  }
  // ---------- 出处 & 相关词 ----------
  parseFolders(text) {
    return (text || "").split(/[,，\n]/).map((s) => this.normalizeFolder(s)).filter(Boolean);
  }
  parseTags(text) {
    return (text || "").split(/[,，;；\s]+/).map((s) => s.trim().replace(/^#/, "").toLowerCase()).filter(Boolean);
  }
  vocabTagSet() {
    const tags = new Set(this.parseTags(this.settings.vocabTags));
    for (const item of this.settings.dicts || []) for (const source of dictionarySources(item)) if (source.kind === "tag") tags.add(source.value);
    return tags;
  }
  excludeTagSet() {
    return new Set(this.parseTags(this.settings.excludeTags));
  }
  // Capture destinations are separate from the collection's membership rules.
  dictFolders() {
    return [...new Set((this.settings.dicts || []).map((d) => this.normalizeFolder(d && d.folder)).filter(Boolean))];
  }
  // 一条词的最终高亮色:词条角色/直写色 > 内联分类 > 标签 > 词典 > 全局。
  colorForEntry(e) {
    let color = this.effectiveHighlightColor();
    const dc = this.dictColorForFile(e && e.file);
    if (dc) color = dc;
    if (e && e.tags && this.settings.tagRules && this.settings.tagRules.length) {
      const rule = this.settings.tagRules.find((r) => r.tag && e.tags.has(r.tag.toLowerCase()));
      if (rule && rule.color) color = rule.color;
    }
    const inlineColor = this.inlineCategoryColor(e);
    if (inlineColor) color = inlineColor;
    const entryColor = resolveEntryColorToken(e?.colorToken, this.settings.entryColors);
    if (entryColor) color = entryColor;
    return color;
  }
  // 一条词的最终线型(标签规则可覆盖全局)
  styleKindForEntry(e) {
    let s = this.settings.highlightStyle || "wavy";
    if (e && e.tags && this.settings.tagRules && this.settings.tagRules.length) {
      const rule = this.settings.tagRules.find((r) => r.tag && e.tags.has(r.tag.toLowerCase()));
      if (rule && rule.style) s = rule.style;
    }
    return s;
  }
  // 全局高亮色的"实际值":留空(=主题强调色)时解析成真实 hex 发给网页,否则网页只能看到 var(--text-accent) 这种 ob 专用变量、读不到
  effectiveHighlightColor() {
    const c = (this.settings.highlightColor || "").trim();
    if (c) return c;
    const document2 = this._workspaceDocuments?.current() || this.app.workspace.containerEl.ownerDocument;
    try {
      return cssColorToHex(document2.defaultView?.getComputedStyle(document2.body).getPropertyValue("--text-accent") || "", document2);
    } catch {
      return "#7c5cff";
    }
  }
  // { 规范化文件夹: 颜色 },只含设了专属色的词典;供网页按所属词典着色
  dictColorMap() {
    const m = {};
    for (const d of this.settings.dicts || []) {
      const f = this.normalizeFolder(d && d.folder);
      const c = (d && d.color || "").trim();
      if (f && c) m[f] = c;
    }
    return m;
  }
  primaryVocabFolder() {
    return this.dictFolders()[0] || "";
  }
  // 新建单词时落地的文件夹(取第一个)
  inFolderScope(path) {
    const fs = this.dictFolders();
    return fs.length ? this.inScope(path, fs) : false;
  }
  // 某文件夹对应的模板:命中某词典行 → 完全按它的 template(留空=空白笔记,不再回退全局);
  // 没有对应词典行(极少见)→ 才用全局默认 newWordTemplate。这样"没给这个词典选模板"= 空白,符合直觉。
  templateForFolder(folder) {
    return this.templateProvider.readLexis(folder);
  }
  isVocabFile(file) {
    return !!file?.path && this.dictionaryScopes().byFile.has(file.path);
  }
  inScope(path, scope) {
    if (!scope.length) return true;
    return scope.some((f) => path === f || path.startsWith(f + "/"));
  }
  extractSentence(content, idx) {
    const bound = /[.!?。！？\n]/;
    let s = idx;
    while (s > 0 && !bound.test(content[s - 1])) s--;
    let e = idx;
    while (e < content.length && !bound.test(content[e])) e++;
    let sent = content.slice(s, e + 1).replace(/\s+/g, " ").trim();
    if (sent.length > 220) sent = sent.slice(0, 220) + "\u2026";
    return sent;
  }
  async findOccurrences(word) {
    const key = word.toLowerCase();
    if (this._occCache.has(key)) return this._occCache.get(key);
    const limit = this.settings.occurrenceLimit || 6;
    const scope = this.parseFolders(this.settings.occurrenceFolders);
    const results = await this.occurrenceSearch.find(word, { limit, scope, includePdf: this.settings.includePdfOccurrences !== false });
    this._occCache.set(key, results);
    return results;
  }
  findRelated(file) {
    const resolved = this.app.metadataCache.resolvedLinks || {};
    const set = /* @__PURE__ */ new Set();
    for (const src in resolved) {
      if (resolved[src][file.path] && this.inVocabFolder(src) && src !== file.path) set.add(src);
    }
    const out = resolved[file.path] || {};
    for (const dest in out) {
      if (this.inVocabFolder(dest) && dest !== file.path) set.add(dest);
    }
    return [...set].map((p) => this.app.vault.getAbstractFileByPath(p)).filter((file2) => file2 instanceof import_obsidian40.TFile);
  }
  async findTypedRelations(file) {
    const out = {}, inc = {};
    const put = (bag, type, tf) => {
      if (!tf || tf.path === file.path) return;
      (bag[type] = bag[type] || /* @__PURE__ */ new Map()).set(tf.path, tf.basename);
    };
    try {
      const raw = await this.app.vault.cachedRead(file);
      for (const { type, target } of parseSectionLinks(raw)) {
        const tf = this.app.metadataCache.getFirstLinkpathDest(target, file.path);
        if (tf && this.inVocabFolder(tf.path)) put(out, type, tf);
      }
    } catch {
    }
    const resolved = this.app.metadataCache.resolvedLinks || {};
    for (const src in resolved) {
      if (!this.inVocabFolder(src) || src === file.path || !resolved[src][file.path]) continue;
      const srcFile = this.app.vault.getAbstractFileByPath(src);
      if (!(srcFile instanceof import_obsidian40.TFile)) continue;
      try {
        const raw = await this.app.vault.cachedRead(srcFile);
        let matched = false;
        for (const { type, target } of parseSectionLinks(raw)) {
          const tf = this.app.metadataCache.getFirstLinkpathDest(target, src);
          if (tf && tf.path === file.path) {
            put(inc, type, srcFile);
            matched = true;
          }
        }
        if (!matched) put(inc, "\u76F8\u5173", srcFile);
      } catch {
      }
    }
    const toArr = (bag) => {
      const result = {};
      for (const type in bag) result[type] = [...bag[type].entries()].map(([path, basename]) => ({ path, basename }));
      return result;
    };
    return { out: toArr(out), inc: toArr(inc) };
  }
  async renderDerivedWords(container, file) {
    const resolved = this.app.metadataCache.resolvedLinks || {};
    const map = /* @__PURE__ */ new Map();
    for (const src in resolved) {
      if (this.inVocabFolder(src) && resolved[src] && resolved[src][file.path]) {
        const sf = this.app.vault.getAbstractFileByPath(src);
        if (sf instanceof import_obsidian40.TFile) map.set(src, sf.basename);
      }
    }
    if (!map.size) return;
    container.createDiv({ cls: "lexis-section-title", text: this.t("relation.backlinks", { count: map.size }) });
    const w = container.createDiv({ cls: "lexis-related" });
    for (const [path, basename] of map) this.relLink(w, path, basename);
  }
  relLink(w, path, basename) {
    const a = w.createEl("a", { text: basename, href: "#" });
    a.setAttribute("data-lexis-review-link", path);
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const f = this.app.vault.getAbstractFileByPath(path);
      if (f instanceof import_obsidian40.TFile) {
        void this.app.workspace.getLeaf(false).openFile(f);
        this.removePopover();
      }
    });
  }
  async renderTypedRelations(container, file) {
    const { out, inc } = await this.findTypedRelations(file);
    const order = relationTypes(out, inc);
    let n = 0;
    for (const t of order) {
      const map = /* @__PURE__ */ new Map();
      for (const r of out[t] || []) map.set(r.path, r.basename);
      for (const r of inc[t] || []) map.set(r.path, r.basename);
      if (!map.size) continue;
      container.createDiv({ cls: "lexis-section-title", text: "\u{1F517} " + t });
      const w = container.createDiv({ cls: "lexis-related" });
      for (const [path, basename] of map) {
        this.relLink(w, path, basename);
        n++;
      }
    }
    return n;
  }
  async renderReverseRelations(container, file, type) {
    const { out, inc } = await this.findTypedRelations(file);
    const name = relationHeading(type);
    const types = name === "\u8FA8\u6790" ? ["\u8FA8\u6790", "\u76F8\u5173"] : [name];
    const outPaths = /* @__PURE__ */ new Set();
    for (const t of types) for (const r of out[t] || []) outPaths.add(r.path);
    const map = /* @__PURE__ */ new Map();
    for (const t of types) for (const r of inc[t] || []) if (!outPaths.has(r.path)) map.set(r.path, r.basename);
    if (!map.size) return 0;
    const w = container.createDiv({ cls: "lexis-related lexis-rel-reverse" });
    for (const [path, basename] of map) this.relLink(w, path, basename);
    return map.size;
  }
  async getCuratedSourcePaths(wordFile) {
    try {
      const raw = await this.app.vault.cachedRead(wordFile);
      const names = [this.occurrenceHeadingText(), "\u4F8B\u53E5", "\u51FA\u5904"].filter(Boolean).map(escapeRe).join("|");
      const m = new RegExp("#{1,6}\\s*(?:" + names + ")([^\\n]*\\n[\\s\\S]*?)(?=\\n#{1,6}\\s|\\n```|$)").exec(raw);
      if (!m) return /* @__PURE__ */ new Set();
      const set = /* @__PURE__ */ new Set();
      const re = /\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g;
      let mm;
      while (mm = re.exec(m[1])) {
        const base = mm[1].trim().split("/").pop().replace(/\.(?:md|pdf)$/i, "");
        set.add(base.toLowerCase());
      }
      return set;
    } catch {
      return /* @__PURE__ */ new Set();
    }
  }
  sourceLinkTarget(file) {
    return file?.extension === "md" ? file.basename : file?.name || "";
  }
  async addExampleToWord(wordFile, sentence, sourceFile, page) {
    if (sourceFile) {
      const curated = await this.getCuratedSourcePaths(wordFile);
      if (curated.has(sourceFile.basename.toLowerCase())) {
        new import_obsidian40.Notice(this.t("notice.occurrenceExists"));
        return true;
      }
    }
    const occurrence = {
      word: wordFile.basename,
      sentence: (sentence || "").trim(),
      source: sourceFile ? page ? `[[${this.sourceLinkTarget(sourceFile)}#page=${page}|${sourceFile.basename} p.${page}]]` : `[[${this.sourceLinkTarget(sourceFile)}]]` : "",
      date: todayString()
    };
    const apply = (data) => this.insertOccurrence(data, occurrence);
    try {
      if (this.app.vault.process) await this.app.vault.process(wordFile, apply);
      else {
        const d = await this.app.vault.read(wordFile);
        await this.app.vault.modify(wordFile, apply(d));
      }
      this.recordEncounter(wordFile, "add");
      new import_obsidian40.Notice(this.t("notice.occurrenceSaved"));
      return true;
    } catch (err) {
      new import_obsidian40.Notice(this.t("notice.occurrenceFailed", { error: errorMessage5(err) }));
      return false;
    }
  }
};
function pluginDictionaryDescriptors() {
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(LexisPluginDictionary.prototype);
  return descriptors;
}

// src/plugin-review.ts
var import_obsidian44 = require("obsidian");

// src/review-view.ts
var import_obsidian42 = require("obsidian");

// src/review-progress-bar.ts
function renderReviewProgressBar(parent, progress, t) {
  const label = t("review.progressBar", { done: progress.completed, total: progress.total, retry: progress.retry, left: progress.remaining });
  const wrapper = parent.createDiv({ cls: "lexis-review-progress" });
  wrapper.createDiv({ cls: "lexis-review-progress-caption", text: label, attr: { "aria-live": "polite" } });
  const track = wrapper.createDiv({ cls: "lexis-progress-track", attr: {
    role: "progressbar",
    "aria-label": label,
    "aria-valuemin": "0",
    "aria-valuemax": String(Math.max(1, progress.total)),
    "aria-valuenow": String(progress.completed)
  } });
  for (const [kind, count] of [["complete", progress.completed], ["retry", progress.retry]]) {
    const segment = track.createSpan({ cls: `lexis-progress-segment is-${kind}` });
    segment.setCssProps({ "--lexis-progress-width": `${progress.total ? count / progress.total * 100 : 0}%` });
  }
}

// src/review-mobile-layout.ts
function reviewBottomClearance(viewBottom, viewportBottom, barTop, barHeight) {
  return barHeight > 0 ? Math.max(0, Math.ceil(Math.min(viewBottom, viewportBottom) - barTop)) + 12 : 12;
}
function isMobileReview(document2) {
  return document2.body.matches(".is-phone, .is-tablet, .is-mobile");
}
var ReviewMobileLayout = class {
  constructor(component, container, content, bar) {
    this.container = container;
    this.content = content;
    this.bar = bar;
    this.frame = 0;
    this.stopped = false;
    this.observedBar = null;
    this.observedNavbar = null;
    this.window = container.ownerDocument.defaultView;
    this.spacer = content.createDiv({ cls: "lexis-rv-bottom-spacer", attr: { "aria-hidden": "true" } });
    this.observer = new this.window.ResizeObserver(() => this.schedule());
    this.styles = new this.window.MutationObserver(() => this.schedule());
    this.styles.observe(container, { attributes: true, attributeFilter: ["style"] });
    this.observer.observe(container);
    component.registerDomEvent(this.window, "resize", () => this.schedule());
    if (this.window.visualViewport) {
      const viewport = this.window.visualViewport, changed = () => this.schedule();
      viewport.addEventListener("resize", changed);
      viewport.addEventListener("scroll", changed);
      component.register(() => {
        viewport.removeEventListener("resize", changed);
        viewport.removeEventListener("scroll", changed);
      });
    }
    component.register(() => this.dispose());
  }
  schedule() {
    if (this.stopped || this.frame) return;
    this.frame = this.window.requestAnimationFrame(() => {
      this.frame = 0;
      this.update();
    });
  }
  update() {
    if (this.stopped || !isMobileReview(this.container.ownerDocument)) return;
    const bar = this.bar();
    if (bar !== this.observedBar) {
      if (this.observedBar) this.observer.unobserve(this.observedBar);
      this.observedBar = bar;
      if (bar) this.observer.observe(bar);
    }
    const navbar = this.container.ownerDocument.querySelector(".mobile-navbar");
    if (navbar !== this.observedNavbar) {
      if (this.observedNavbar) this.observer.unobserve(this.observedNavbar);
      this.observedNavbar = navbar;
      if (navbar) this.observer.observe(navbar);
    }
    const viewport = this.window.visualViewport;
    const viewportBottom = viewport ? viewport.offsetTop + viewport.height : this.window.innerHeight;
    const navbarRect = navbar?.getBoundingClientRect();
    const navbarOverlap = navbarRect?.height ? Math.max(0, viewportBottom - navbarRect.top) : 0;
    const coveredViewport = Math.max(0, this.window.innerHeight - viewportBottom);
    const gap = `${Math.ceil(coveredViewport + navbarOverlap)}px`;
    if (this.container.style.getPropertyValue("--lexis-mobile-navbar-height") !== gap) this.container.style.setProperty("--lexis-mobile-navbar-height", gap);
    const rect = bar?.getBoundingClientRect();
    const clearance = reviewBottomClearance(this.content.getBoundingClientRect().bottom, viewportBottom, rect?.top || 0, rect?.height || 0);
    this.content.style.setProperty("--lexis-mobile-review-clearance", `${clearance}px`);
    if (this.content.lastElementChild !== this.spacer) this.content.appendChild(this.spacer);
    this.spacer.style.height = `${clearance}px`;
    this.content.style.scrollPaddingBottom = `${clearance}px`;
  }
  dispose() {
    this.stopped = true;
    this.observer.disconnect();
    this.styles.disconnect();
    this.spacer.remove();
    if (this.frame) this.window.cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
};

// src/review-actions.ts
var import_obsidian41 = require("obsidian");
var errorText = (error) => error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
function renderReviewActions(container, host, view) {
  const skip = container.createEl("button", { cls: "lexis-rv-undo", text: host.t("review.skip") });
  skip.onclick = () => view.skip();
  const more = container.createEl("button", { cls: "lexis-rv-undo", attr: { "aria-label": host.t("review.more") } });
  (0, import_obsidian41.setIcon)(more, "ellipsis");
  more.onclick = (event) => {
    const item = view.queue[view.pos];
    if (!item) return;
    const keys = reviewItemKeys(item);
    const position = view.pos;
    const menu = new import_obsidian41.Menu();
    menu.addItem((entry) => entry.setTitle(host.t("review.lowerPriority")).setIcon("arrow-down").onClick(async () => {
      more.disabled = true;
      try {
        await changeReviewPriority(host.settings, keys, true, () => host.saveSettings());
        if (view.pos === position && view.queue[position] === item) {
          view.pos++;
          view.render();
        }
      } catch (error) {
        new import_obsidian41.Notice(host.t("review.priorityFailed", { error: errorText(error) }));
      } finally {
        more.disabled = false;
      }
    }));
    if (keys.some((key) => host.settings.reviewPriorities?.[key])) {
      menu.addItem((entry) => entry.setTitle(host.t("review.resetPriority")).setIcon("rotate-ccw").onClick(async () => {
        try {
          await changeReviewPriority(host.settings, keys, false, () => host.saveSettings());
        } catch (error) {
          new import_obsidian41.Notice(host.t("review.priorityFailed", { error: errorText(error) }));
        }
      }));
    }
    menu.addItem((entry) => entry.setTitle(host.t("review.suspend")).setIcon("pause").onClick(() => view.suspend()));
    menu.showAtMouseEvent(event);
  };
}

// src/review-image-preview.ts
function createReviewImagePreview(document2, source, label, onClose) {
  const overlay = document2.body.createDiv({ cls: "lexis-rv-image-preview" });
  const image = overlay.createEl("img");
  image.src = source.currentSrc || source.src;
  image.alt = source.alt || "";
  const pointers = /* @__PURE__ */ new Map();
  let scale = 1, translateX = 0, translateY = 0;
  let startScale = 1, startTranslateX = 0, startTranslateY = 0, startDistance = 0;
  let startCenter = { x: 0, y: 0 };
  let startPan = { x: 0, y: 0 };
  const clampScale = (value) => Math.max(1, Math.min(5, value));
  const point = (event) => ({ x: event.clientX, y: event.clientY });
  const pair = () => [...pointers.values()].slice(0, 2);
  const distance = (points) => Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  const center = (points) => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
  const applyTransform = () => {
    if (scale === 1) {
      translateX = 0;
      translateY = 0;
    }
    image.setCssStyles({ transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})` });
    overlay.classList.toggle("is-zoomed", scale > 1);
  };
  const beginPinch = () => {
    const points = pair();
    if (points.length < 2) return;
    startDistance = distance(points);
    startCenter = center(points);
    startScale = scale;
    startTranslateX = translateX;
    startTranslateY = translateY;
  };
  image.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    image.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, point(event));
    if (pointers.size === 1) {
      startPan = point(event);
      startTranslateX = translateX;
      startTranslateY = translateY;
    } else if (pointers.size === 2) beginPinch();
  });
  image.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault();
    pointers.set(event.pointerId, point(event));
    if (pointers.size >= 2) {
      const points = pair();
      const currentCenter = center(points);
      scale = clampScale(startScale * (distance(points) / Math.max(1, startDistance)));
      translateX = startTranslateX + currentCenter.x - startCenter.x;
      translateY = startTranslateY + currentCenter.y - startCenter.y;
    } else if (scale > 1) {
      translateX = startTranslateX + event.clientX - startPan.x;
      translateY = startTranslateY + event.clientY - startPan.y;
    }
    applyTransform();
  });
  const endPointer = (event) => {
    if (!pointers.delete(event.pointerId)) return;
    if (pointers.size === 1) {
      const remaining = [...pointers.values()][0];
      startPan = remaining;
      startTranslateX = translateX;
      startTranslateY = translateY;
    }
  };
  image.addEventListener("pointerup", endPointer);
  image.addEventListener("pointercancel", endPointer);
  image.addEventListener("click", (event) => event.stopPropagation());
  const close = overlay.createEl("button", { cls: "lexis-rv-image-close" });
  close.type = "button";
  close.textContent = "\xD7";
  close.setAttribute("aria-label", label);
  close.addEventListener("click", onClose);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) onClose();
  });
  return overlay;
}

// src/review-batch-controls.ts
function renderBatchContinuation(parent, options, batch, t, configure) {
  if (!batch?.items.length) return;
  const keys = [...new Set(batch.items.flatMap(reviewItemKeys))];
  const base = { ...options, planId: void 0, dailyCardLimit: void 0, targetKeys: void 0 };
  const actions = parent.createDiv({ cls: "lexis-rv-batch-actions" });
  actions.createEl("button", { text: t("setup.repeat"), attr: { type: "button" } }).onclick = () => configure({ ...base, mode: "cram", batchSize: null, rounds: 1, targetKeys: keys, excludedKeys: void 0 });
  const remaining = new Set(batch.remaining.flatMap(reviewItemKeys)).size;
  if (remaining) actions.createEl("button", { text: t("setup.remaining", { count: remaining }), attr: { type: "button" } }).onclick = () => configure({ ...base, batchSize: null, targetKeys: [...new Set(batch.remaining.flatMap(reviewItemKeys))], excludedKeys: [.../* @__PURE__ */ new Set([...options.excludedKeys || [], ...keys])] });
}

// src/review-view.ts
var errorMessage6 = (error) => error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
var createReviewView = ({ reviewViewType, todayStr, renderLexisMarkdown: renderLexisMarkdown2 }) => class LexisReviewView extends import_obsidian42.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.batch = null;
    this.currentItem = null;
    this.wordEl = null;
    this.backEl = null;
    this.showBtn = null;
    this.rateBar = null;
    this._comp = null;
    this._frontComp = null;
    this._imagePreview = null;
    this.grading = false;
    this.mobileLayout = null;
    this.navigation = true;
    this.plugin = plugin;
    this.queue = [];
    this.pos = 0;
    this.reviewed = 0;
    this.revealed = false;
    this.undoStack = [];
    this.options = {};
  }
  isContextCard(item) {
    return !!item && item.type === "note" && this.options.content === "context";
  }
  getViewType() {
    return reviewViewType;
  }
  getDisplayText() {
    return this.plugin.t("review.title");
  }
  getIcon() {
    return "brain";
  }
  async onOpen() {
    this.registerDomEvent(window, "keydown", (event) => this.onKey(event));
    this.mobileLayout = new ReviewMobileLayout(this, this.containerEl, this.contentEl, () => this.rateBar);
    this.reviewNavigation = new ReviewNavigation({
      app: this.app,
      leaf: this.leaf,
      mode: () => this.plugin.settings.reviewLinkMode || "current",
      sourcePath: () => this.currentItem?.file.path || "",
      saveSession: () => this.saveSession(),
      failed: (error) => new import_obsidian42.Notice(this.plugin.t("review.openLinkFailed", { error: errorMessage6(error) }))
    }, this, this.contentEl);
    const saved = this.plugin.takeReviewSession(this.leaf);
    if (!saved) {
      await this.refresh();
      return;
    }
    this.queue = saved.queue;
    this.pos = saved.pos;
    this.reviewed = saved.reviewed;
    this.undoStack = saved.undoStack;
    this.options = saved.options;
    this.batch = saved.batch || null;
    this.render();
    if (saved.revealed) await this.reveal();
  }
  async onClose() {
    this.saveSession();
    this.mobileLayout?.dispose();
    if (this._comp) this._comp.unload();
    if (this._frontComp) this._frontComp.unload();
    this.closeImagePreview();
  }
  async refresh() {
    this.contentEl.empty();
    this.contentEl.createDiv({ cls: "lexis-rv-loading", text: this.plugin.t("common.loading") });
    const pool = await this.plugin.buildQueue({ ...this.options, batchSize: null, targetKeys: void 0, dailyCardLimit: void 0 });
    const options = { ...this.options, batchSize: this.options.batchSize !== void 0 ? this.options.batchSize : this.options.mode === "cram" ? null : this.plugin.settings.maxReviewsPerSession || 200 };
    this.batch = new ReviewBatch(pool, options, this.options.mode === "cram" ? practiceCounts(this.plugin.settings, this.options.planId, todayStr()) : {});
    this.queue = this.batch.queue();
    this.pos = 0;
    this.reviewed = 0;
    this.revealed = false;
    this.undoStack = [];
    this.render();
  }
  render() {
    const c = this.contentEl;
    c.empty();
    this.rateBar = null;
    c.addClass("lexis-review");
    c.setCssStyles({ paddingBottom: "" });
    if (this.pos >= this.queue.length && this.options.mode === "cram" && this.batch) {
      const next = this.batch.nextRound(this.plugin.settings.suspendedReviewItems);
      if (next.length) {
        this.queue = next;
        this.pos = 0;
        this.undoStack = [];
      }
    }
    if (this.pos >= this.queue.length) {
      this.renderDone(c);
      return;
    }
    if (this._frontComp) {
      this._frontComp.unload();
      this._frontComp = null;
    }
    this.revealed = false;
    const item = this.currentItem = this.queue[this.pos];
    const topbar = c.createDiv({ cls: "lexis-rv-topbar" });
    if (this.options.mode === "cram" && this.batch) topbar.createDiv({ cls: "lexis-dim", text: this.plugin.t("setup.round", { round: this.batch.round, rounds: this.batch.rounds }) });
    renderReviewProgressBar(topbar, this.sessionProgress(), (key, vars) => this.plugin.t(key, vars));
    const topbtns = topbar.createDiv({ cls: "lexis-rv-topbtns" });
    if (this.undoStack.length) {
      const ub = topbtns.createEl("button", { cls: "lexis-rv-undo", text: `\u21A9 ${this.plugin.t("review.undo")}` });
      ub.addEventListener("click", () => {
        void this.undo();
      });
    }
    renderReviewActions(topbtns, this.plugin, this);
    const card = c.createDiv({ cls: "lexis-rv-card" });
    card.addEventListener("click", (event) => {
      const image = event.composedPath().find((node) => node?.tagName === "IMG");
      if (!image || !card.contains(image)) return;
      event.preventDefault();
      event.stopPropagation();
      this.openImagePreview(image);
    }, { capture: true });
    let wordEl;
    if (this.isContextCard(item)) {
      const source = card.createEl("button", { cls: "lexis-rv-source", text: item.file.basename, attr: { type: "button" } });
      source.setAttribute("title", this.plugin.t("review.openSource"));
      source.addEventListener("click", () => {
        void this.openSource(item);
      });
      wordEl = card.createDiv({ cls: "lexis-rv-word is-context is-masked" });
      void this.renderContextFront(wordEl, item);
    } else if (item.type === "syntax" && item.syntax) {
      const source = card.createEl("button", { cls: "lexis-rv-source", text: `${item.file.basename} \xB7 L${item.syntax.line + 1}`, attr: { type: "button" } });
      source.setAttribute("title", this.plugin.t("review.openSource"));
      source.addEventListener("click", () => {
        void this.openSource(item);
      });
      if (item.syntax.headingPath?.length) card.createDiv({ cls: "lexis-log-row-meta", text: item.syntax.headingPath.join(" / ") });
      wordEl = card.createDiv({ cls: "lexis-rv-word is-syntax" });
      void this.renderSyntaxFront(wordEl, item);
    } else {
      wordEl = card.createDiv({ cls: "lexis-rv-word" });
      wordEl.setText(item.file.basename);
      wordEl.setAttribute("title", this.plugin.t("review.openSource"));
      wordEl.addEventListener("click", () => {
        void this.openSource(item);
      });
      if (this.plugin.settings.cardFront === "cloze") void this.applyClozeFront(wordEl, item);
    }
    this.wordEl = wordEl;
    const tagsSet = this.plugin.getTags(item.file);
    if (tagsSet.size) {
      const tw = card.createDiv({ cls: "lexis-rv-tags" });
      for (const t of tagsSet) {
        const pill = tw.createSpan({ cls: "lexis-tag", text: "#" + t });
        pill.setAttribute("title", this.plugin.t("review.onlyTag", { tag: t }));
        pill.addEventListener("click", () => {
          this.plugin.configureReview({ content: this.options.content, mode: this.options.mode, scope: "tag", tag: t, batchSize: null, rounds: 1 });
        });
      }
    }
    this.backEl = card.createDiv({ cls: "lexis-rv-back" });
    this.backEl.setCssStyles({ display: "none" });
    if (this.isMultiCloze(item)) {
      this.showBtn = c.createDiv({ cls: "lexis-rv-show-actions" });
      const one = this.showBtn.createEl("button", { cls: "mod-cta lexis-rv-show", text: this.plugin.t("review.showOne") });
      one.addEventListener("click", () => {
        void this.showAnswer("one");
      });
      const all = this.showBtn.createEl("button", { cls: "lexis-rv-show", text: this.plugin.t("review.showAll") });
      all.addEventListener("click", () => {
        void this.showAnswer("all");
      });
    } else {
      this.showBtn = c.createEl("button", { cls: "mod-cta lexis-rv-show", text: this.plugin.t("review.show") });
      this.showBtn.addEventListener("click", () => {
        void this.showAnswer("one");
      });
    }
    this.rateBar = c.createDiv({ cls: "lexis-rv-rate" });
    this.rateBar.setCssStyles({ display: "none" });
    const bs = this.plugin.settings.reviewBottomSpace ?? 70;
    this.containerEl.setCssProps({ "--lexis-review-bottom-space": `${bs}px` });
    const isPhone = isMobileReview(this.containerEl.doc);
    this.rateBar.setCssStyles({ marginBottom: isPhone ? "" : bs + "px" });
    this.renderRateButtons(item);
    this.updateMobileReviewLayout();
  }
  renderRateButtons(item) {
    this.rateBar.empty();
    const grades = [[1, "review.again"], [2, "review.hard"], [3, "review.good"], [4, "review.easy"]];
    for (const [g, key] of grades) {
      const ivl = this.options.mode === "cram" ? null : this.plugin.scheduleCard(item.card, g).interval;
      const b = this.rateBar.createEl("button", { cls: "lexis-rv-btn lexis-rv-g" + g });
      b.createSpan({ cls: "lexis-rv-label", text: `${this.plugin.t(key)} (${g})` });
      if (ivl != null) b.createSpan({ cls: "lexis-rv-ivl", text: this.plugin.humanInterval(ivl) });
      b.addEventListener("click", () => {
        void this.grade(g);
      });
    }
  }
  isMultiCloze(item) {
    return !!item && item.type === "syntax" && item.syntax?.kind === "cloze" && (item.syntax.members?.length || 0) > 1;
  }
  async showAnswer(mode) {
    const item = this.currentItem;
    if (this.isMultiCloze(item)) {
      const selected = chooseClozeRevealMode(item, mode);
      this.queue.splice(this.pos, 1, selected.current, ...selected.remaining);
      this.currentItem = selected.current;
      this.renderRateButtons(selected.current);
      if (this.wordEl) await this.renderSyntaxFront(this.wordEl, selected.current);
    }
    await this.reveal();
  }
  async reveal() {
    if (this.revealed) return;
    this.revealed = true;
    this.showBtn.setCssStyles({ display: "none" });
    this.backEl.setCssStyles({ display: "" });
    this.rateBar.setCssStyles({ display: "" });
    this.updateMobileReviewLayout();
    try {
      if (this._comp) this._comp.unload();
      this._comp = new import_obsidian42.Component();
      this._comp.load();
      const item = this.currentItem;
      if (!item) return;
      if (this.isContextCard(item)) {
        this.wordEl?.removeClass("is-masked");
        this.backEl.empty();
        this.backEl.setCssStyles({ display: "none" });
      } else if (item.type === "syntax" && item.syntax) {
        if (item.syntax.kind === "cloze") {
          this.backEl.empty();
          this.backEl.setCssStyles({ display: "none" });
          if (this.wordEl) await this.renderSyntaxFront(this.wordEl, item, true);
        } else {
          this.backEl.empty();
          await renderLexisMarkdown2(this.app, item.syntax.back, this.backEl, item.file.path, this._comp);
        }
      } else {
        await this.plugin.renderNoteInto(this.backEl, item.file, this._comp, true);
        const openOcc = () => this.backEl.querySelectorAll("details.lexis-occ-details").forEach((details) => {
          details.open = true;
        });
        openOcc();
        window.setTimeout(openOcc, 60);
      }
    } catch (err) {
      this.backEl.setText(this.plugin.t("review.renderFailed", { error: errorMessage6(err) }));
      console.error("[Lexis] reveal error", err);
    }
  }
  updateMobileReviewLayout() {
    this.mobileLayout?.update();
  }
  async grade(g) {
    if (this.grading) return;
    if (!this.revealed) {
      new import_obsidian42.Notice(this.plugin.t("review.revealFirst"));
      return;
    }
    const item = this.currentItem;
    this.grading = true;
    try {
      if (this.options.mode === "cram" && this.batch) {
        const practice = await this.batch.grade(item, g, this.plugin, this.options, todayStr());
        this.undoStack.push({ item, practice, snapshot: {}, previousCard: { ...item.card }, pos: this.pos, requeued: g === 1, eventId: "" });
        this.reviewed++;
        if (g === 1) this.queue.push(item);
        this.pos++;
        this.render();
        return;
      }
      const snapshot = this.plugin.snapshotReviewItem(item);
      const previousCard = { ...item.card };
      const retentionBefore = this.plugin.cardRetrievability(item.card);
      const sched = this.plugin.scheduleCard(item.card, g);
      await this.plugin.applyReviewItemSchedule(item, sched);
      const eventId = await this.plugin.logReviewItem(item, sched, g, retentionBefore);
      this.undoStack.push({ item, snapshot, previousCard, pos: this.pos, requeued: g === 1, eventId });
      this.reviewed++;
      const updated = { s: sched.s, d: sched.d, due: sched.due, last: todayStr(), reps: sched.reps, lapses: sched.lapses };
      item.card = updated;
      if (g === 1) this.queue.push({ ...item, card: { ...updated } });
      this.pos++;
      this.render();
    } catch (err) {
      new import_obsidian42.Notice(this.plugin.t("review.gradeFailed", { error: errorMessage6(err) }));
      console.error("[Lexis] grade error", err);
    } finally {
      this.grading = false;
    }
  }
  async undo() {
    const u = this.undoStack.pop();
    if (!u) {
      new import_obsidian42.Notice(this.plugin.t("review.nothingUndo"));
      return;
    }
    try {
      if (u.practice && this.batch) {
        const id = this.options.planId;
        if (id) {
          const store = this.plugin.settings.reviewPracticeProgress ||= {}, previous = store[id];
          restorePracticeStore(store, id, u.practice);
          try {
            await this.plugin.saveSettings();
          } catch (error) {
            if (previous) store[id] = previous;
            else delete store[id];
            this.undoStack.push(u);
            throw error;
          }
        }
        this.batch.restore(u.practice);
        this.plugin.reviewDashboard?.refresh();
      } else {
        await this.plugin.restoreReviewItem(u.item, u.snapshot);
        await this.plugin.undoReviewItemLog(u.item, u.eventId);
      }
      u.item.card = { ...u.previousCard };
      if (u.requeued && this.queue.length) this.queue.pop();
      this.pos = u.pos;
      this.reviewed = Math.max(0, this.reviewed - 1);
      this.render();
    } catch (err) {
      new import_obsidian42.Notice(this.plugin.t("review.undoFailed", { error: errorMessage6(err) }));
    }
  }
  saveSession() {
    this.plugin.saveReviewSession(this.leaf, {
      queue: this.queue,
      pos: this.pos,
      reviewed: this.reviewed,
      revealed: this.revealed,
      undoStack: this.undoStack,
      options: this.options,
      batch: this.batch || void 0
    });
  }
  async openSource(item) {
    const leaf = await this.reviewNavigation.openFile(item.file);
    if (item.syntax && leaf.view instanceof import_obsidian42.MarkdownView) {
      const position = { line: item.syntax.line, ch: 0 };
      leaf.view.editor.setCursor(position);
      leaf.view.editor.scrollIntoView({ from: position, to: position }, true);
    }
  }
  onKey(e) {
    if (this.app.workspace.getMostRecentLeaf() !== this.leaf) return;
    if (e.key === "Escape" && this._imagePreview) {
      e.preventDefault();
      this.closeImagePreview();
      return;
    }
    const target = e.targetNode;
    const element = target?.instanceOf(HTMLElement) ? target : null;
    const tag = element?.tagName || "";
    if (/INPUT|TEXTAREA/.test(tag) || element?.isContentEditable) return;
    if (e.key === "z" || e.key === "Z") {
      e.preventDefault();
      void this.undo();
      return;
    }
    if (e.key === "s" || e.key === "S") {
      e.preventDefault();
      this.skip();
      return;
    }
    if (this.pos >= this.queue.length) return;
    if (e.code === "Space") {
      e.preventDefault();
      if (!this.revealed) void this.showAnswer("one");
      return;
    }
    if (this.revealed && ["1", "2", "3", "4"].includes(e.key)) {
      e.preventDefault();
      void this.grade(Number(e.key));
    }
  }
  async applyClozeFront(wordEl, item) {
    const ex = await this.plugin.getFirstExample(item.file);
    if (!ex || this.currentItem !== item) return;
    wordEl.addClass("lexis-rv-cloze");
    wordEl.empty();
    if (this._frontComp) this._frontComp.unload();
    this._frontComp = new import_obsidian42.Component();
    this._frontComp.load();
    const cloze = this.plugin.buildCloze(ex, item.file.basename);
    await renderLexisMarkdown2(this.app, cloze, wordEl, item.file.path, this._frontComp);
  }
  async renderSyntaxFront(wordEl, item, reveal = false) {
    if (!item.syntax || this.currentItem !== item) return;
    wordEl.empty();
    wordEl.removeClass("is-cloze");
    if (this._frontComp) this._frontComp.unload();
    this._frontComp = new import_obsidian42.Component();
    this._frontComp.load();
    let markdown = displayedSyntaxFront(item.syntax.front, item.syntax.kind);
    if (item.syntax.kind === "cloze") {
      wordEl.addClass("is-cloze");
      const templates = {
        inline: this.plugin.settings.flashcardInlineTemplate,
        bidirectional: this.plugin.settings.flashcardBidirectionalTemplate,
        block: this.plugin.settings.flashcardBlockTemplate,
        cloze: this.plugin.settings.flashcardClozeTemplate
      };
      const ranges = findClozeAnswerRanges(item.syntax.back, templates);
      const revealIndexes = /* @__PURE__ */ new Set();
      if (reveal) {
        if (item.syntax.memberIds.length > 1) ranges.forEach((_, index) => revealIndexes.add(index));
        else if (item.syntax.clozeIndex != null) revealIndexes.add(item.syntax.clozeIndex);
      }
      markdown = maskClozeAnswers(item.syntax.back, templates, revealIndexes);
    }
    await renderLexisMarkdown2(this.app, markdown, wordEl, item.file.path, this._frontComp);
  }
  async renderContextFront(wordEl, item) {
    if (!this.isContextCard(item) || this.currentItem !== item) return;
    wordEl.empty();
    if (this._frontComp) this._frontComp.unload();
    this._frontComp = new import_obsidian42.Component();
    this._frontComp.load();
    await this.plugin.renderNoteInto(wordEl, item.file, this._frontComp, true, true);
  }
  openImagePreview(source) {
    this.closeImagePreview();
    this._imagePreview = createReviewImagePreview(this.containerEl.doc, source, this.plugin.t("review.closeImage"), () => this.closeImagePreview());
  }
  closeImagePreview() {
    if (this._imagePreview) this._imagePreview.remove();
    this._imagePreview = null;
  }
  skip() {
    if (this.pos >= this.queue.length) return;
    this.queue.push(this.queue[this.pos]);
    this.pos++;
    this.render();
  }
  async suspend() {
    if (this.pos >= this.queue.length) return;
    try {
      await this.plugin.suspendReviewItem(this.queue[this.pos]);
      this.pos++;
      this.render();
    } catch (err) {
      new import_obsidian42.Notice(this.plugin.t("review.suspendFailed", { error: errorMessage6(err) }));
    }
  }
  renderDone(c) {
    const progress = this.sessionProgress();
    renderReviewProgressBar(c, progress, (key, vars) => this.plugin.t(key, vars));
    const d = c.createDiv({ cls: "lexis-rv-done" });
    d.createDiv({ cls: "lexis-rv-done-emoji", text: "\u{1F389}" });
    d.createDiv({ text: progress.completed ? this.plugin.t("review.done", { count: progress.completed }) : this.plugin.t("review.noneDue") });
    if (this.options.mode !== "cram") {
      const b = d.createEl("button", { cls: "mod-cta", text: this.plugin.t("review.checkAgain") });
      b.onclick = () => {
        void this.plugin.rebuildIndex(false);
        void this.refresh();
      };
    }
    renderBatchContinuation(d, this.options, this.batch, (key, vars) => this.plugin.t(key, vars), (options) => this.plugin.configureReview(options));
    this.plugin.renderHeatmap(d.createDiv({ cls: "lexis-hm-wrap" }));
    const isPhone = isMobileReview(this.containerEl.doc);
    c.setCssStyles({ paddingBottom: isPhone ? "" : `${this.plugin.settings.reviewBottomSpace ?? 70}px` });
    this.updateMobileReviewLayout();
  }
  sessionProgress() {
    return sessionReviewProgress(this.queue, this.pos, this.plugin.settings.reviewEvents, todayStr(), this.plugin.settings.suspendedReviewItems, this.options.mode === "cram" ? new Map(Object.entries(this.batch?.grades || {})) : void 0);
  }
};

// src/plugin-views.ts
var LexisReviewView = createReviewView({ reviewViewType: LEXIS_REVIEW_VIEW, todayStr: todayString, renderLexisMarkdown });

// src/review-start-modal.ts
var import_obsidian43 = require("obsidian");
var ReviewStartModal = class extends import_obsidian43.Modal {
  constructor(app, host, options = { dictionaryIds: null, content: "syntax", mode: "cram", batchSize: null, rounds: 1 }, lockedFile) {
    super(app);
    this.host = host;
    this.lockedFile = lockedFile;
    this.options = structuredClone(options);
  }
  onOpen() {
    this.setTitle(this.host.t("setup.title"));
    let start;
    this.cleanup = mountReviewSetup(this.contentEl, this.app, this.host, this.options, () => {
      start?.setDisabled(!validReviewOptions(this.options));
    }, this.lockedFile);
    new import_obsidian43.Setting(this.contentEl).addButton((button) => button.setButtonText(this.host.t("setup.savePlan")).onClick(() => {
      if (!validReviewOptions(this.options)) {
        new import_obsidian43.Notice(this.host.t("setup.invalid"));
        return;
      }
      new ReviewPlanEditor(this.app, this.host, draftReviewPlan(this.options)).open();
    })).addButton((button) => {
      start = button;
      button.setButtonText(this.host.t("home.start")).setCta().setDisabled(!validReviewOptions(this.options)).onClick(async () => {
        button.setDisabled(true);
        try {
          await this.host.openReview(this.options);
          this.close();
        } catch {
          button.setDisabled(false);
          new import_obsidian43.Notice(this.host.t("common.failed"));
        }
      });
    });
  }
  onClose() {
    this.cleanup?.();
    this.contentEl.empty();
  }
};

// src/plugin-review.ts
var LexisPluginReview = class extends LexisPluginDictionary {
  // ---------- 生命周期(归档/常驻/淘汰) ----------
  // 只叠加在算法结果之上:这里不碰 lexis-s/d/due 等 FSRS 内部字段,那些只由真实复习事件驱动(applySchedule)。
  readLifecycle(file) {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    const status = fm["lexis-status"];
    return { archived: status === "archived", retired: status === "retired", pinned: !!fm["lexis-pinned"] };
  }
  // 归档 = 退出高亮 + 暂停复习队列,悬停仍可查;取消归档("恢复")默认走这条,FSRS 进度原样保留。
  // 重置为新词是恢复时的另一个选项,见 LexisRestoreModal,不在这个函数里做。
  async setArchived(file, archived) {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (archived) fm["lexis-status"] = "archived";
      else delete fm["lexis-status"];
    });
    await this.rebuildIndex(false);
  }
  async setPinned(file, pinned) {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (pinned) fm["lexis-pinned"] = true;
      else delete fm["lexis-pinned"];
    });
    await this.rebuildIndex(false);
  }
  // 淘汰 = 归档而非删除:退出高亮与复习,文件保留,但比"归档"更彻底——悬停也不再触发(不像归档还留一个隐形代理 span)。
  // 只从"淘汰法庭"候选列表的操作按钮触发,没有独立的命令/右键菜单入口(候选判定本身已经是入口了)。
  async setRetired(file, retired) {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (retired) fm["lexis-status"] = "retired";
      else delete fm["lexis-status"];
    });
    await this.rebuildIndex(false);
  }
  // 每台设备只写自己的最新主动相遇状态；读取时按更新时间合并。
  async loadEncounters() {
    const revision = this._encRevision;
    const loaded = await this._encounterStore.load();
    if (revision === this._encRevision) this._encounters = loaded;
  }
  async setDataFolder(input) {
    if (this._encSaveTimer) window.clearTimeout(this._encSaveTimer);
    await this.saveEncounters();
    if (this._encPending.length) throw new Error("Could not save pending encounters");
    this._encRelocating = true;
    try {
      const nextStore = await this.dataStorage.move(input, this._encounterStore);
      const revision = this._encRevision;
      const loaded = await nextStore.load();
      this._encounterStore = nextStore;
      if (revision === this._encRevision) this._encounters = loaded;
    } finally {
      this._encRelocating = false;
      if (this._encPending.length) this._encSaveTimer = window.setTimeout(() => {
        void this.saveEncounters();
      }, 500);
    }
    await this.saveSettings();
  }
  // 只记录主动相遇；同一词条与相遇类型在 60 秒内去重。
  recordEncounter(file, type) {
    if (!(file instanceof import_obsidian44.TFile)) return;
    const k = file.path;
    const now = Date.now();
    const dedupKey = k + ":" + type;
    if (!this._encounterDedup) this._encounterDedup = {};
    const last = this._encounterDedup[dedupKey];
    if (last && now - last < 6e4) return;
    this._encounterDedup[dedupKey] = now;
    const day = todayString();
    this._encounters[k] = { lastEncounter: day, encounteredAt: now };
    this._encRevision++;
    this._encPending.push({ path: k, changedAt: now, encounteredAt: now, day });
    this.scheduleEncounterSave();
  }
  deleteEncounterPath(path) {
    if (!this._encounters[path]) return;
    const now = Date.now();
    delete this._encounters[path];
    this._encRevision++;
    this._encPending.push({ path, changedAt: now, deleted: true });
    this.scheduleEncounterSave();
  }
  renameEncounterPath(oldPath, newPath) {
    if (oldPath === newPath) return;
    const prior = this._encounters[oldPath];
    if (!prior) return;
    const now = Date.now();
    delete this._encounters[oldPath];
    this._encRevision++;
    this._encPending.push({ path: oldPath, changedAt: now, deleted: true });
    if (prior) {
      this._encounters[newPath] = prior;
      this._encPending.push({ path: newPath, changedAt: now, encounteredAt: prior.encounteredAt, day: prior.lastEncounter });
    }
    this.scheduleEncounterSave();
  }
  scheduleEncounterSave() {
    if (this._encRelocating) return;
    if (this._encSaveTimer) window.clearTimeout(this._encSaveTimer);
    this._encSaveTimer = window.setTimeout(() => {
      void this.saveEncounters();
    }, 500);
  }
  async saveEncounters() {
    this._encSaveTimer = 0;
    if (this._encRelocating) return;
    if (this._encWriting !== null) return this._encWriting;
    this._encWriting = (async () => {
      while (this._encPending.length) {
        const batch = this._encPending.splice(0);
        try {
          await this._encounterStore.apply(batch);
        } catch (error) {
          this._encPending.unshift(...batch);
          console.warn("[Lexis] Cannot save encounters; will retry", error);
          break;
        }
      }
    })().finally(() => {
      this._encWriting = null;
      if (this._encPending.length) this._encSaveTimer = window.setTimeout(() => {
        void this.saveEncounters();
      }, 5e3);
    });
    return this._encWriting;
  }
  async prepareReload() {
    if (this._encRelocating) throw new Error(this.t("maintenance.pendingData"));
    await this.reviewCatalog.flush();
    await this.dataStorage?.flush();
    if (this._encSaveTimer) window.clearTimeout(this._encSaveTimer);
    await this.saveEncounters();
    if (this._encRelocating || this._encPending.length) throw new Error(this.t("maintenance.pendingData"));
    if (this._encSaveTimer) window.clearTimeout(this._encSaveTimer);
    this._encSaveTimer = 0;
  }
  // 悬停 = 一次失败的提取(没想起来才要查)。这个词的到期日如果还很远,说明"排期偏晚了",拉近一点提醒尽快复习——
  // 只挪 lexis-due,绝不碰 stability/difficulty,也不伪造一次复习评分(FSRS 内部状态只能由真实复习事件驱动)。
  async hoverFeedback(file) {
    if (!this.settings.hoverFeedback || !(file instanceof import_obsidian44.TFile)) return;
    if (this.readLifecycle(file).archived) return;
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    if (fm["lexis-s"] == null || !fm["lexis-due"]) return;
    const today = todayString();
    const rawDue = fm["lexis-due"];
    if (typeof rawDue !== "string" && typeof rawDue !== "number") return;
    const due = String(rawDue).slice(0, 10);
    const threshold = addDaysString(today, this.settings.hoverFeedbackDays ?? 3);
    if (due <= threshold) return;
    await this.app.fileManager.processFrontMatter(file, (fm2) => {
      fm2["lexis-due"] = today;
    });
  }
  // ---------- FSRS 调度 ----------
  readCard(file) {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    return {
      s: typeof fm["lexis-s"] === "number" ? fm["lexis-s"] : null,
      d: typeof fm["lexis-d"] === "number" ? fm["lexis-d"] : null,
      due: typeof fm["lexis-due"] === "string" ? fm["lexis-due"] : null,
      last: typeof fm["lexis-last"] === "string" ? fm["lexis-last"] : null,
      reps: typeof fm["lexis-reps"] === "number" ? fm["lexis-reps"] : null,
      lapses: typeof fm["lexis-lapses"] === "number" ? fm["lexis-lapses"] : null,
      history: Array.isArray(this.settings.reviewHistory?.[file.path]) ? this.settings.reviewHistory[file.path] : []
    };
  }
  cardRetrievability(card, date = todayString()) {
    const s = Number(card?.s);
    if (!s || isNaN(s) || !card?.last) return 0;
    return FSRS.retrievability(Math.max(0, daysBetween(card.last, date)), s);
  }
  scheduleCard(card, grade) {
    return scheduleReviewCard(card, grade, this.settings.requestRetention, todayString());
  }
  async getFirstExample(file) {
    try {
      const raw = await this.app.vault.cachedRead(file);
      if (!this.occurrenceHeadingText()) return this.occurrenceSentenceFromSection(raw);
      const names = [this.occurrenceHeadingText(), "\u4F8B\u53E5", "\u51FA\u5904"].filter(Boolean).map(escapeRe).join("|");
      const m = new RegExp("#{1,6}\\s*(?:" + names + ")([^\\n]*\\n[\\s\\S]*?)(?=\\n#{1,6}\\s|\\n```|$)").exec(raw);
      if (!m) return "";
      return this.occurrenceSentenceFromSection(m[1]);
    } catch {
      return "";
    }
  }
  buildCloze(sentence, word) {
    return sentence.replace(new RegExp(boundedSource(word), "ig"), "______");
  }
  humanInterval(days) {
    if (days < 1) return this.t("interval.ltDay");
    if (days < 30) return this.t("interval.days", { count: days });
    if (days < 365) return this.t("interval.months", { count: Math.round(days / 30) });
    return this.t("interval.years", { count: (days / 365).toFixed(1) });
  }
  freqVal(file) {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const n = parseInt(String(fm && fm.frequency).replace(/[^0-9]/g, ""), 10);
    return isNaN(n) ? Infinity : n;
  }
  collectVocabTags() {
    const s = /* @__PURE__ */ new Set();
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (!this.inVocabFolder(f.path)) continue;
      for (const t of this.getTags(f)) s.add(t);
    }
    return [...s].sort();
  }
  computeStats() {
    const today = todayString();
    let total = 0, due = 0, fresh = 0;
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (!this.inVocabFolder(f.path)) continue;
      total++;
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter || {};
      if (fm["lexis-status"] === "archived" || fm["lexis-status"] === "retired") continue;
      if (fm["lexis-s"] == null) {
        fresh++;
        due++;
      } else if (!fm["lexis-due"] || String(fm["lexis-due"]).slice(0, 10) <= today) due++;
    }
    return { total, due, fresh };
  }
  // ---------- 淘汰法庭(阶段 3) ----------
  // 硬条件筛子,不做加权评分:全部满足才入列,判决权在用户(淘汰/留下/已掌握三个按钮,见 LexisHomeView)。
  async buildRetireCandidates() {
    await this.saveEncounters();
    if (!this._encPending.length) await this.loadEncounters();
    const days = this.settings.retireCandidateDays ?? 90;
    const today = todayString();
    const files = this.app.vault.getMarkdownFiles().filter((f) => this.inVocabFolder(f.path));
    const out = [];
    for (const f of files) {
      const lc = this.readLifecycle(f);
      if (lc.pinned || lc.archived || lc.retired) continue;
      const created = formatDate(new Date(f.stat.ctime));
      if (daysBetween(created, today) < days) continue;
      const enc = this._encounters[f.path];
      const lastEncounter = enc && enc.lastEncounter || created;
      const sinceLast = daysBetween(lastEncounter, today);
      if (sinceLast < days) continue;
      let occCount = 0;
      try {
        occCount = (await this.findOccurrences(f.basename)).length;
      } catch {
      }
      out.push({
        file: f,
        display: f.basename,
        created,
        lastEncounter,
        sinceLast,
        occCount
      });
    }
    out.sort((a, b) => b.sinceLast - a.sinceLast);
    return out;
  }
  collectArchivedFiles() {
    return this.app.vault.getMarkdownFiles().filter((file) => this.inVocabFolder(file.path) && this.readLifecycle(file).archived).sort((left, right) => left.path.localeCompare(right.path));
  }
  async restoreSuspendedReviewItem(key) {
    if (!this.settings.suspendedReviewItems?.[key]) return;
    delete this.settings.suspendedReviewItems[key];
    await this.saveSettings();
  }
  configureReview(options) {
    new ReviewStartModal(this.app, this, options, options.scope === "current" ? options.file : void 0).open();
  }
  async openReview(options = {}) {
    let leaf = this.app.workspace.getLeavesOfType(LEXIS_REVIEW_VIEW)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf(true);
      await leaf.setViewState({ type: LEXIS_REVIEW_VIEW, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
    if (leaf.view instanceof LexisReviewView) {
      leaf.view.options = options || {};
      await leaf.view.refresh();
    }
  }
  async openReviewLog(date) {
    let leaf = this.app.workspace.getLeavesOfType(LEXIS_LOG_VIEW)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf("tab");
      await leaf.setViewState({ type: LEXIS_LOG_VIEW, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
    if (leaf.view instanceof LexisLogView) {
      if (date) leaf.view.setDay(date);
      else void leaf.view.refresh();
    }
  }
  saveReviewSession(leaf, state) {
    if (leaf && state) this._reviewSessions.set(leaf, state);
  }
  takeReviewSession(leaf) {
    if (!leaf) return null;
    const state = this._reviewSessions.get(leaf) || null;
    this._reviewSessions.delete(leaf);
    return state;
  }
  async openHome(location = "center") {
    const sourceFile = this.app.workspace.getActiveFile();
    const workspace = this.app.workspace;
    let leaf = location === "sidebar" ? await workspace.ensureSideLeaf(LEXIS_HOME_VIEW, "right", { active: true, reveal: true }) : workspace.getLeavesOfType(LEXIS_HOME_VIEW).find((candidate) => candidate.getRoot() === workspace.rootSplit);
    if (!leaf) {
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({ type: LEXIS_HOME_VIEW, active: true });
    }
    await workspace.revealLeaf(leaf);
    if (leaf.view instanceof LexisHomeView) {
      if (sourceFile) leaf.view.sourceFilePath = sourceFile.path;
      leaf.view.render();
    }
  }
  // ---------- 划词添加 ----------
};
function pluginReviewDescriptors() {
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(LexisPluginReview.prototype);
  return descriptors;
}

// src/plugin-entry.ts
var obsidian7 = __toESM(require("obsidian"));
var import_obsidian45 = require("obsidian");
var LexisPluginEntry = class extends LexisPluginReview {
  sanitizeName(name) {
    return (name || "").replace(/[\\/:*?"<>|#^[\]]/g, "").replace(/\s+/g, " ").trim();
  }
  async ensureFolder(folder) {
    if (!folder) return;
    if (!this.app.vault.getAbstractFileByPath(folder)) {
      try {
        await this.app.vault.createFolder(folder);
      } catch {
      }
    }
  }
  async readTemplatePath(p) {
    p = (p || "").trim();
    if (!p) return null;
    const f = this.app.vault.getAbstractFileByPath(p);
    if (f instanceof import_obsidian45.TFile) {
      try {
        return await this.app.vault.read(f);
      } catch {
        return null;
      }
    }
    return null;
  }
  async createEntryFile(path, folder, fallbackContent, transform) {
    const file = await this.templateProvider.create({ path, folder, fallbackContent, transform });
    this.settings.reviewAddedAt[file.path] = (/* @__PURE__ */ new Date()).toISOString();
    await this.saveSettings();
    return file;
  }
  // 无模板可选纯空白，或只放一个内置的出处面板；用户自己的模板始终优先。
  minimalSkeleton() {
    return this.settings.emptyNotePreset === "occ" ? "```lexis\nocc\n```\n" : "";
  }
  getSelectionSentence(editor) {
    if (!editor) return "";
    try {
      const from = editor.getCursor("from");
      const line = editor.getLine(from.line) || "";
      return this.extractSentence(line, from.ch || 0);
    } catch {
      return "";
    }
  }
  getReadingSentence() {
    try {
      const sel = window.getSelection();
      if (!sel || !sel.anchorNode) return "";
      const text = sel.anchorNode.textContent || "";
      return this.extractSentence(text, sel.anchorOffset || 0);
    } catch {
      return "";
    }
  }
  // 当前选区所在 PDF 页码(pdf.js 在 .page 上挂 data-page-number);取不到返回 0
  currentPdfPage() {
    try {
      const sel = window.getSelection();
      const n = sel && sel.anchorNode;
      const el = n?.nodeType === Node.ELEMENT_NODE ? n : n?.parentElement;
      const page = el?.closest("[data-page-number]");
      const v = page && page.getAttribute("data-page-number");
      return v ? parseInt(v, 10) || 0 : 0;
    } catch {
      return 0;
    }
  }
  addSelectedWordCommand() {
    const view = this.app.workspace.getActiveViewOfType(obsidian7.MarkdownView);
    let word = "", editor = null;
    if (view && view.editor && view.getMode && view.getMode() === "source") {
      word = (view.editor.getSelection() || "").trim();
      editor = view.editor;
    }
    if (!word) {
      const sel = window.getSelection();
      word = (sel ? sel.toString() : "").trim();
    }
    if (!word) {
      new import_obsidian45.Notice(this.t("notice.selectWord"));
      return;
    }
    void this.addWordFromSelection(word, editor, view);
  }
  async addWordFromSelection(word, editor = null, view = null, targetFolder = "", options = {}) {
    const clean = (word || "").trim();
    const aliasText = (options.alias || "").trim();
    const alias = aliasText && aliasText.normalize("NFKC").toLowerCase() !== clean.normalize("NFKC").toLowerCase() ? aliasText : "";
    const fileName = this.sanitizeName(clean);
    if (!fileName) {
      new import_obsidian45.Notice(this.t("notice.invalidWord"));
      return;
    }
    const reqFolder = this.normalizeFolder(targetFolder || "");
    const folder = reqFolder && this.dictFolders().includes(reqFolder) ? reqFolder : this.primaryVocabFolder();
    const targetPath = (folder ? folder + "/" : "") + fileName + ".md";
    const target = this.app.vault.getAbstractFileByPath(targetPath);
    let existing = target instanceof import_obsidian45.TFile ? target : null;
    if (!existing) {
      const hit = this.index.get(this.resolveIndexKey(clean));
      if (hit && hit.file instanceof import_obsidian45.TFile) existing = hit.file;
    }
    const srcFile = options.sourceFile !== void 0 ? options.sourceFile : view && view.file || this.app.workspace.getActiveFile();
    const sentence = options.sentence !== void 0 ? options.sentence : editor ? this.getSelectionSentence(editor) : this.getReadingSentence();
    const fromPdf = srcFile && srcFile.extension === "pdf" && !editor;
    if (existing) {
      if (alias) {
        await this.attachAlias(alias, existing);
        return;
      }
      new import_obsidian45.Notice(this.t(options.openExisting ? "notice.exists" : "notice.existsNoOpen", { word: existing.basename }));
      if (options.openExisting) void this.app.workspace.getLeaf(fromPdf ? "tab" : false).openFile(existing);
      return;
    }
    try {
      await this.ensureFolder(folder);
      const tpl = await this.templateForFolder(folder);
      const content = this.renderTemplate(tpl != null ? tpl : this.minimalSkeleton(), { word: clean, date: todayString() });
      const addOccurrence = (templateContent) => {
        let next = templateContent;
        if (!(sentence || srcFile || options.source)) return next;
        let sub = "", disp = srcFile ? srcFile.basename : "";
        if (fromPdf) {
          const pg = options.page || this.currentPdfPage();
          if (pg) {
            sub = `#page=${pg}`;
            disp = `${srcFile.basename} p.${pg}`;
          }
        }
        const sourceTarget = this.sourceLinkTarget(srcFile);
        const source = srcFile ? sub ? `[[${sourceTarget}${sub}|${disp}]]` : `[[${sourceTarget}]]` : options.source || "";
        next = this.insertOccurrence(next, { word: clean, sentence: sentence || "", source, date: todayString() });
        return next;
      };
      const file = await this.createEntryFile(targetPath, folder, content, addOccurrence);
      if (alias) await this.addAliasToFile(file, alias);
      this.recordEncounter(file, "add");
      await this.rebuildIndex(false);
      if (alias && !this.index.has(this.resolveIndexKey(alias))) this.index.set(this.resolveIndexKey(alias), { display: alias, file, isAlias: true, tags: this.getTags(file) });
      new import_obsidian45.Notice(alias ? this.t("notice.aliasAdded", { alias, word: file.basename }) : this.t(fromPdf ? "notice.addedPdf" : "notice.created", { word: fileName }));
    } catch (err) {
      new import_obsidian45.Notice(this.t("notice.createFailed", { error: errorMessage5(err) }));
    }
  }
};
function pluginEntryDescriptors() {
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(LexisPluginEntry.prototype);
  return descriptors;
}

// src/annotation-images.ts
var import_obsidian46 = require("obsidian");
var IMAGE_MIME = {
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp"
};
function attachmentName(file) {
  const clean = file.name.replace(/[\\/:*?"<>|#[\]]/g, "-").trim();
  if (/\.[a-z0-9]+$/i.test(clean)) return clean;
  const extension = Object.entries(IMAGE_MIME).find(([, mime]) => mime === file.type)?.[0] || "png";
  return `${clean || "image"}.${extension}`;
}
async function saveAnnotationImage(app, _settings, wordFile, image) {
  const filename = attachmentName(image);
  const path = await app.fileManager.getAvailablePathForAttachment(filename, wordFile.path);
  return app.vault.createBinary(path, await image.arrayBuffer());
}
async function vaultImageDataUrl(app, linkPath, sourcePath2) {
  const target = String(linkPath || "").split("|")[0].trim();
  if (!target) return null;
  const file = app.metadataCache.getFirstLinkpathDest(target, sourcePath2);
  if (!(file instanceof import_obsidian46.TFile)) return null;
  const mime = IMAGE_MIME[file.extension.toLowerCase()];
  if (!mime) return null;
  const bytes = await app.vault.readBinary(file);
  const view = new Uint8Array(bytes);
  let binary = "";
  for (let offset = 0; offset < view.length; offset += 32768) {
    binary += String.fromCharCode(...view.subarray(offset, offset + 32768));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

// src/main.ts
var LexisBridge = createBridgeServer({ Notice: import_obsidian47.Notice, Platform: import_obsidian47.Platform });
var LexisPlugin = class extends LexisPluginBase {
  constructor() {
    super(...arguments);
    this.readerHover = new ReaderHover(this);
    this.reviewCatalog = new ReviewCatalog(this);
  }
  async onload() {
    await this.loadSettings();
    this.i18n = createI18n(() => this.settings.language);
    this.templateProvider = createTemplateProvider({
      app: this.app,
      TFile: import_obsidian47.TFile,
      getSettings: () => this.settings,
      normalizeFolder: (folder) => this.normalizeFolder(folder),
      readTemplatePath: (path) => this.readTemplatePath(path)
    });
    this.applyReviewMetadataVisibility();
    this.index = /* @__PURE__ */ new Map();
    this.vocabPaths = /* @__PURE__ */ new Set();
    this.stats = { words: 0, aliases: 0, inlineEntries: 0, due: 0 };
    this.reviewDashboard = new ReviewDashboard(this);
    this.marginNoteExport = new MarginNoteExport(this);
    this.inlineColorTokenUsages = [];
    this._pattern = null;
    this._indexKeysByCompact = /* @__PURE__ */ new Map();
    this._matchKeysByCompact = /* @__PURE__ */ new Map();
    this._rebuildTimer = null;
    this._popover = null;
    this._popoverComp = null;
    this._selPill = null;
    this._manualLookupAnchor = null;
    this._manualLookupSource = null;
    this._mobileTapStart = null;
    this._mobileTapClick = null;
    this._occCache = /* @__PURE__ */ new Map();
    this.occurrenceSearch = createOccurrenceSearch({
      app: this.app,
      loadPdfJs: () => obsidian8.loadPdfJs(),
      boundedSource,
      extractSentence: (content, index) => this.extractSentence(content, index),
      markdownAllowed: (file) => !this.inVocabFolder(file.path) && !this.inlineSourcePaths?.has(file.path),
      inScope: (path, scope) => this.inScope(path, scope)
    });
    this.liveAvailable = false;
    this._encounters = {};
    this._encWriting = null;
    this._encRevision = 0;
    this._encRelocating = false;
    const { id: deviceId, label: deviceLabel } = this.dataStorage.device;
    this._encounterStore = new EncounterStore(this.app.vault.adapter, this.settings.dataFolder, deviceId, deviceLabel);
    this._encounterDedup = {};
    this._pageHighlightState = /* @__PURE__ */ new WeakMap();
    this._reviewSessions = /* @__PURE__ */ new WeakMap();
    try {
      await this.loadEncounters();
    } catch (error) {
      console.warn("[Lexis] Cannot load encounter history", error);
    }
    let syncTimer = 0;
    const refreshData = (file) => {
      if (!this.dataStorage.isDataPath(file.path) || this.dataStorage.relocating) return;
      this.dataStorage.invalidate(file.path);
      window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(() => {
        void this.dataStorage.refresh().then(() => this.reviewDashboard?.refresh()).catch((error) => console.warn("[Lexis] Cannot refresh learning data", error));
      }, 500);
    };
    this.registerEvent(this.app.vault.on("create", refreshData));
    this.registerEvent(this.app.vault.on("modify", refreshData));
    this.registerEvent(this.app.vault.on("delete", refreshData));
    this.register(() => window.clearTimeout(syncTimer));
    this.registerEvent(this.app.workspace.on("file-open", (file) => {
      if (file instanceof import_obsidian47.TFile && this.inVocabFolder(file.path)) this.recordEncounter(file, "open");
      window.requestAnimationFrame(() => this.syncActivePageHighlightState());
    }));
    this.statusBar = new LexisStatusBar(this, obsidian8.setIcon);
    this.statusBar.mount();
    this.addCommand({ id: "rebuild-index", name: this.t("command.rebuild"), callback: () => this.rebuildIndex(true) });
    this.addCommand({ id: "open-review", name: this.t("command.review"), callback: () => this.openHome() });
    this.addCommand(currentFileReviewCommand(this));
    this.addCommand({ id: "open-review-log", name: this.t("log.title"), callback: () => this.openReviewLog() });
    this.addCommand({ id: "add-selected-word", name: this.t("command.addSelection"), callback: () => this.addSelectedWordCommand() });
    this.addCommand({ id: "open-home", name: this.t("command.home"), callback: () => this.openHome("center") });
    this.addCommand({ id: "open-home-sidebar", name: this.t("command.homeSidebar"), callback: () => this.openHome("sidebar") });
    this.addCommand({
      id: "toggle-current-page-highlights",
      name: this.t("command.toggleHighlights"),
      checkCallback: (checking) => {
        const page = this.currentHighlightPage();
        if (!page) return false;
        if (checking) return true;
        this.toggleCurrentPageHighlights(page);
        return true;
      }
    });
    this.addRibbonIcon("graduation-cap", this.t("ribbon.home"), () => this.openHome());
    this.addRibbonIcon("brain", this.t("ribbon.review"), () => this.openHome());
    this.addCommand({
      id: "archive-word",
      name: this.t("command.archive"),
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !this.inVocabFolder(file.path) || this.readLifecycle(file).archived) return false;
        if (checking) return true;
        void this.setArchived(file, true).then(() => new import_obsidian47.Notice(this.t("notice.archived", { word: file.basename })));
        return true;
      }
    });
    this.addCommand({
      id: "restore-word",
      name: this.t("command.restore"),
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !this.inVocabFolder(file.path) || !this.readLifecycle(file).archived) return false;
        if (checking) return true;
        new LexisRestoreModal(this.app, this, file).open();
        return true;
      }
    });
    this.addCommand({
      id: "toggle-pin-word",
      name: this.t("command.pin"),
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !this.inVocabFolder(file.path)) return false;
        if (checking) return true;
        const pinned = this.readLifecycle(file).pinned;
        void this.setPinned(file, !pinned).then(() => new import_obsidian47.Notice(this.t(!pinned ? "notice.pinned" : "notice.unpinned", { word: file.basename })));
        return true;
      }
    });
    this.addCommand({
      id: "migrate-familiar-tag-to-archived",
      name: this.t("command.migrate"),
      callback: async () => {
        const files = this.app.vault.getMarkdownFiles().filter((f) => this.inVocabFolder(f.path) && this.getTags(f).has("\u719F\u6089") && !this.readLifecycle(f).archived && !this.readLifecycle(f).retired);
        if (!files.length) {
          new import_obsidian47.Notice(this.t("notice.noFamiliar"));
          return;
        }
        for (const f of files) await this.app.fileManager.processFrontMatter(f, (fm) => {
          fm["lexis-status"] = "archived";
        });
        await this.rebuildIndex(false);
        new import_obsidian47.Notice(this.t("notice.migrated", { count: files.length }));
      }
    });
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      if (!(file instanceof import_obsidian47.TFile) || !this.inVocabFolder(file.path)) return;
      const { archived, pinned } = this.readLifecycle(file);
      menu.addItem((it) => it.setTitle(this.t(archived ? "menu.restore" : "menu.archive")).setIcon(archived ? "archive-restore" : "archive").onClick(() => {
        if (archived) new LexisRestoreModal(this.app, this, file).open();
        else void this.setArchived(file, true).then(() => new import_obsidian47.Notice(this.t("notice.archived", { word: file.basename })));
      }));
      menu.addItem((it) => it.setTitle(this.t(pinned ? "menu.unpin" : "menu.pin")).setIcon(pinned ? "pin-off" : "pin").onClick(() => {
        void this.setPinned(file, !pinned).then(() => new import_obsidian47.Notice(this.t(!pinned ? "notice.pinned" : "notice.unpinned", { word: file.basename })));
      }));
    }));
    this.registerView(LEXIS_REVIEW_VIEW, (leaf) => new LexisReviewView(leaf, this));
    this.registerView(LEXIS_HOME_VIEW, (leaf) => new LexisHomeView(leaf, this));
    this.registerView(LEXIS_LOG_VIEW, (leaf) => new LexisLogView(leaf, this));
    this.addSettingTab(new LexisSettingTab(this.app, this));
    this.registerEditorSuggest(new InlineHeadingSuggest(this.app, this));
    this.registerEditorSuggest(new InlineColorSuggest(this.app, this));
    this.registerMarkdownPostProcessor((el, ctx) => this.highlightElement(el, ctx));
    this.registerMarkdownCodeBlockProcessor("lexis", (src, el, ctx) => this.renderLexisBlock(el, ctx, src));
    this.registerMarkdownCodeBlockProcessor("rel", (src, el, ctx) => this.renderLexisBlock(el, ctx, relationBlockSource(src, ctx.getSectionInfo(el)?.text)));
    this.registerMarkdownCodeBlockProcessor("lexis-heatmap", (src, el) => this.renderHeatmap(el));
    this.registerMarkdownCodeBlockProcessor("lexis-home", (src, el, ctx) => this.renderHomeBlock(el, src, ctx));
    this.setupLiveExtension();
    this.epubHighlights = new EpubHighlights(this);
    this._workspaceDocuments = createReaderWorkspace(this);
    this._canvasEdgeHighlights = new CanvasEdgeHighlights(this);
    this._workspaceDocuments.start();
    this._excalidrawHighlights = new ExcalidrawHighlights(this);
    this._excalidrawHighlights.start();
    this.app.workspace.onLayoutReady(() => {
      this._workspaceDocuments.activateLeaf(this.app.workspace.getMostRecentLeaf());
      void this.rebuildIndex(false);
      this.reviewCatalog.start();
      this.syncActivePageHighlightState();
    });
    this.registerEvent(this.app.vault.on("create", (f) => {
      if (f instanceof import_obsidian47.TFile) this.maybeRebuild(f);
    }));
    this.registerEvent(this.app.vault.on("delete", (f) => {
      if (!(f instanceof import_obsidian47.TFile)) return;
      this.deleteEncounterPath(f.path);
      this.maybeRebuild(f);
    }));
    this.registerEvent(this.app.vault.on("rename", (f, old) => {
      const dictionariesChanged = renameDictionaryPaths(this.settings.dicts, old, f.path);
      const plansChanged = renameReviewPlanPaths(this.settings.reviewPlans, old, f.path);
      if (dictionariesChanged || plansChanged) {
        void this.saveSettings();
        this.scheduleRebuild();
        this.reviewDashboard.refresh();
      }
      if (f instanceof import_obsidian47.TFile) {
        this.renameEncounterPath(old, f.path);
        this.maybeRebuild(f, old);
        void this.migrateSyntaxCardPath(f, old);
      }
    }));
    this.registerEvent(this.app.vault.on("modify", (file) => {
      this._occCache.clear();
      if (file instanceof import_obsidian47.TFile && file.extension === "pdf") this.occurrenceSearch.invalidatePdf(file.path);
      if (file instanceof import_obsidian47.TFile && this.isInlineSourceFile(file) || this.inlineSourcePaths?.has(file.path)) this.scheduleRebuild();
    }));
    this.registerEvent(this.app.metadataCache.on("changed", (file) => {
      this.maybeRebuild(file);
    }));
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor, view) => {
      const sel = (editor.getSelection() || "").trim();
      if (!sel || sel.length > 60) return;
      const label = sel.length > 16 ? sel.slice(0, 16) + "\u2026" : sel;
      const dicts = this.dictFolders();
      if (dicts.length > 1) {
        menu.addItem((item) => {
          item.setTitle(this.t("menu.add", { word: label })).setIcon("book-plus");
          const submenu = item.setSubmenu();
          for (const folder of dicts) {
            submenu.addItem((choice) => choice.setTitle(folder).setIcon("folder").onClick(() => this.addWordFromSelection(sel, editor, view, folder)));
          }
        });
      } else {
        menu.addItem((item) => item.setTitle(this.t("menu.add", { word: label })).setIcon("book-plus").onClick(() => this.addWordFromSelection(sel, editor, view)));
      }
    }));
    this.bridge = new LexisBridge(this);
    if (this.settings.bridgeEnabled) {
      if (!this.settings.bridgeToken) {
        this.settings.bridgeToken = this.bridge.generateToken();
        await this.saveSettings();
      }
      this.bridge.start();
    }
    registerMarginNoteCapture(this);
  }
  onunload() {
    window.clearTimeout(this._rebuildTimer);
    this.readerHover?.dispose();
    if (this._encSaveTimer || this._encPending.length) {
      window.clearTimeout(this._encSaveTimer);
      void this.saveEncounters();
    }
    this.removePopover();
    this.removeSelPill();
    this.teardownPdfHighlight();
    this.epubHighlights?.dispose();
    this._excalidrawHighlights?.destroy();
    this._canvasEdgeHighlights?.destroy();
    this.bridge?.stop();
    this._workspaceDocuments?.forEach((document2) => document2.body?.classList.remove("lexis-show-review-metadata"));
    this._workspaceDocuments?.dispose();
  }
  async onExternalSettingsChange() {
    if (!this.dataStorage) return;
    try {
      await this.dataStorage.externalSettingsChanged();
      this.refreshAllViews();
    } catch (error) {
      new import_obsidian47.Notice(`Lexis: ${error instanceof Error ? error.message : "Could not sync configuration"}`, 15e3);
    }
  }
  async loadStoredSettings() {
    const current = await this.loadData() || {};
    if (pluginFolderName(this.manifest.dir, this.manifest.id) !== this.manifest.id || current.legacySettingsImported || current.learningStorageVersion != null) return current;
    const legacyPath = `${this.app.vault.configDir}/plugins/lexis-local/data.json`;
    if (!await this.app.vault.adapter.exists(legacyPath)) return current;
    try {
      const legacy = JSON.parse(await this.app.vault.adapter.read(legacyPath));
      const result = migrateLegacySettings(current, legacy);
      return result.settings;
    } catch {
      return current;
    }
  }
  async loadSettings() {
    const entryColorMigration = migrateEntryColors(await this.loadStoredSettings());
    const stored = entryColorMigration.settings;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, stored);
    this.settings.reviewCardMeta = { ...this.settings.reviewCardMeta };
    this.settings.reviewPriorities = { ...this.settings.reviewPriorities };
    if (!["automatic", "manual"].includes(this.settings.highlightMode)) this.settings.highlightMode = "automatic";
    if ((!this.settings.tagRules || !this.settings.tagRules.length) && this.settings.tagRulesText) {
      this.settings.tagRules = this.parseTagRulesText(this.settings.tagRulesText);
      delete this.settings.tagRulesText;
    }
    if (!Array.isArray(this.settings.tagRules)) this.settings.tagRules = [];
    if (!Array.isArray(this.settings.entryColors)) this.settings.entryColors = [];
    if (!this.settings.inlineCategoryColors || typeof this.settings.inlineCategoryColors !== "object" || Array.isArray(this.settings.inlineCategoryColors)) this.settings.inlineCategoryColors = {};
    if (!this.settings.inlineCategoryOpacity || typeof this.settings.inlineCategoryOpacity !== "object" || Array.isArray(this.settings.inlineCategoryOpacity)) this.settings.inlineCategoryOpacity = {};
    if (!this.settings.inlineCategoryHighlight || typeof this.settings.inlineCategoryHighlight !== "object" || Array.isArray(this.settings.inlineCategoryHighlight)) this.settings.inlineCategoryHighlight = {};
    if (!["heading", "file"].includes(this.settings.inlineClassificationMode)) this.settings.inlineClassificationMode = "heading";
    if (!Number.isInteger(this.settings.inlineHeadingLevel) || this.settings.inlineHeadingLevel < 0 || this.settings.inlineHeadingLevel > 6) this.settings.inlineHeadingLevel = 2;
    if (!this.settings.inlineFileColors || typeof this.settings.inlineFileColors !== "object" || Array.isArray(this.settings.inlineFileColors)) this.settings.inlineFileColors = {};
    if (!this.settings.inlineFileOpacity || typeof this.settings.inlineFileOpacity !== "object" || Array.isArray(this.settings.inlineFileOpacity)) this.settings.inlineFileOpacity = {};
    if (!this.settings.inlineFileHighlight || typeof this.settings.inlineFileHighlight !== "object" || Array.isArray(this.settings.inlineFileHighlight)) this.settings.inlineFileHighlight = {};
    if (!this.settings.inlineSourceHighlight || typeof this.settings.inlineSourceHighlight !== "object" || Array.isArray(this.settings.inlineSourceHighlight)) this.settings.inlineSourceHighlight = {};
    if (!this.settings.inlineCollapsedGroups || typeof this.settings.inlineCollapsedGroups !== "object" || Array.isArray(this.settings.inlineCollapsedGroups)) this.settings.inlineCollapsedGroups = {};
    if (!Array.isArray(this.settings.inlineCategoryOrder)) this.settings.inlineCategoryOrder = [];
    if (!Array.isArray(this.settings.inlineFileOrder)) this.settings.inlineFileOrder = [];
    if (!this.settings.inlineCategoryOrderByParent || typeof this.settings.inlineCategoryOrderByParent !== "object" || Array.isArray(this.settings.inlineCategoryOrderByParent)) this.settings.inlineCategoryOrderByParent = {};
    if (!this.settings.reviewLog) this.settings.reviewLog = {};
    if (!this.settings.reviewHistory || typeof this.settings.reviewHistory !== "object" || Array.isArray(this.settings.reviewHistory)) this.settings.reviewHistory = {};
    repairReviewHistory(this.settings.reviewHistory);
    const eventsMigrated = !Array.isArray(stored.reviewEvents);
    this.settings.reviewEvents = eventsMigrated ? migrateReviewEvents(this.settings.reviewHistory) : stored.reviewEvents;
    if (!this.settings.reviewAddedAt || typeof this.settings.reviewAddedAt !== "object" || Array.isArray(this.settings.reviewAddedAt)) this.settings.reviewAddedAt = {};
    if (!this.settings.syntaxCardStates || typeof this.settings.syntaxCardStates !== "object" || Array.isArray(this.settings.syntaxCardStates)) this.settings.syntaxCardStates = {};
    if (this.settings.vocabFolders == null) this.settings.vocabFolders = this.settings.vocabFolder != null ? this.settings.vocabFolder : "01-word";
    if (this.settings.excludeTags == null) this.settings.excludeTags = this.settings.excludeTag || "";
    if (this.settings.vocabTags == null) this.settings.vocabTags = "";
    if (!Array.isArray(this.settings.dicts)) {
      this.settings.dicts = this.parseFolders(this.settings.vocabFolders).map((f) => ({ folder: f, template: "" }));
    }
    migrateDictionaryCollections(this.settings);
    this.dataStorage = new PluginDataStorage(this);
    try {
      await this.dataStorage.initialize(stored);
    } catch (error) {
      new import_obsidian47.Notice(`Lexis: ${error instanceof Error ? error.message : "Could not load learning data"}`, 15e3);
      throw error;
    }
  }
};
Object.defineProperties(LexisPlugin.prototype, pluginDictionaryDescriptors());
Object.defineProperties(LexisPlugin.prototype, pluginReviewDescriptors());
Object.defineProperties(LexisPlugin.prototype, pluginEntryDescriptors());
Object.defineProperties(LexisPlugin.prototype, createBridgeApi({
  DEFAULT_SETTINGS,
  TFile: import_obsidian47.TFile,
  Component: import_obsidian47.Component,
  todayStr: todayString,
  recentReviewDates,
  escapeRe,
  renderLexisMarkdown,
  finishRenderMath: import_obsidian47.finishRenderMath,
  escHtml: escapeHtml,
  saveAnnotationImage,
  vaultImageDataUrl
}));
Object.defineProperties(LexisPlugin.prototype, createReviewState({ todayStr: todayString, round2 }));
Object.defineProperties(LexisPlugin.prototype, createReviewQueue({ todayStr: todayString }));
Object.defineProperties(LexisPlugin.prototype, createHighlightEngine({
  FSRS,
  Notice: import_obsidian47.Notice,
  boundedSource,
  compactMixedScriptSpacing,
  todayStr: todayString
}));
Object.defineProperties(LexisPlugin.prototype, createDocumentHighlights());
Object.defineProperties(LexisPlugin.prototype, createReaderInteractions());
Object.defineProperties(LexisPlugin.prototype, createReaderUi({
  buildCurveSVG,
  recentReviewDates,
  FSRS,
  addDaysStr: addDaysString,
  daysBetween,
  fmtDate: formatDate,
  todayStr: todayString,
  TFile: import_obsidian47.TFile,
  Notice: import_obsidian47.Notice,
  boundedSource,
  escapeRe,
  Component: import_obsidian47.Component,
  renderLexisMarkdown,
  openRestoreModal: (app, plugin, file) => new LexisRestoreModal(app, plugin, file).open()
}));
var LexisSettingTab = createSettingsTab({
  obsidian: obsidian8,
  PluginSettingTab: import_obsidian47.PluginSettingTab,
  Setting: import_obsidian47.Setting,
  Notice: import_obsidian47.Notice,
  TFolder: import_obsidian47.TFolder,
  DEFAULT_SETTINGS,
  cssColorToHex,
  createReorderController,
  addAppearanceButton,
  moveItem,
  LEXIS_HOME_VIEW,
  LEXIS_REVIEW_VIEW
});
var main_default = LexisPlugin;
