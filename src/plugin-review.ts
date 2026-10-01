"use strict";

import * as obsidian from "obsidian";
import { TFile } from "obsidian";
import { LEXIS_HOME_VIEW, LEXIS_LOG_VIEW, LEXIS_REVIEW_VIEW } from "./constants";
import { FSRS } from "./fsrs";
import { LexisHomeView, type RetireCandidate } from "./home-view";
import { LexisLogView } from "./review-log-view";
import { scheduleReviewCard } from "./review-scheduler";
import { EncounterStore, encounterFolder, type ActiveEncounterKind } from "./encounter-store";
import { addDaysString as addDaysStr, boundedSource, daysBetween, escapeRe, formatDate as fmtDate, todayString as todayStr } from "./shared-utils";
import type { ReviewOptions } from "./types";
import { LexisPluginDictionary } from "./plugin-dictionary";
import { LexisReviewView } from "./plugin-views";
import type { HomeOpenLocation, Lifecycle, ReviewCard, Schedule } from "./plugin-base";

export class LexisPluginReview extends LexisPluginDictionary {
  // ---------- 生命周期(归档/常驻/淘汰) ----------
  // 只叠加在算法结果之上:这里不碰 lexis-s/d/due 等 FSRS 内部字段,那些只由真实复习事件驱动(applySchedule)。
  readLifecycle(file: TFile): Lifecycle {
    const fm = (this.app.metadataCache.getFileCache(file)?.frontmatter || {}) as Record<string, unknown>;
    const status = fm["lexis-status"];
    return { archived: status === "archived", retired: status === "retired", pinned: !!fm["lexis-pinned"] };
  }
  // 归档 = 退出高亮 + 暂停复习队列,悬停仍可查;取消归档("恢复")默认走这条,FSRS 进度原样保留。
  // 重置为新词是恢复时的另一个选项,见 LexisRestoreModal,不在这个函数里做。
  async setArchived(file: TFile, archived: boolean): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      if (archived) fm["lexis-status"] = "archived";
      else delete fm["lexis-status"];
    });
    await this.rebuildIndex(false);
  }
  async setPinned(file: TFile, pinned: boolean): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      if (pinned) fm["lexis-pinned"] = true;
      else delete fm["lexis-pinned"];
    });
    await this.rebuildIndex(false);
  }
  // 淘汰 = 归档而非删除:退出高亮与复习,文件保留,但比"归档"更彻底——悬停也不再触发(不像归档还留一个隐形代理 span)。
  // 只从"淘汰法庭"候选列表的操作按钮触发,没有独立的命令/右键菜单入口(候选判定本身已经是入口了)。
  async setRetired(file: TFile, retired: boolean): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
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
  async setEncounterFolder(input: string): Promise<void> {
    const target = encounterFolder(input, this.app.vault.configDir, this.manifest.id);
    const setting = input.trim().replaceAll("\\", "/").replace(/\/+$/, "");
    if (target === this._encounterStore.folder) {
      if (setting !== this.settings.encounterFolder) { this.settings.encounterFolder = setting; await this.saveSettings(); }
      return;
    }
    if (this._encSaveTimer) window.clearTimeout(this._encSaveTimer);
    await this.saveEncounters();
    if (this._encPending.length) throw new Error("Could not save pending encounters");
    const previousSetting = this.settings.encounterFolder;
    const previousStore = this._encounterStore;
    this._encRelocating = true;
    try {
      await this._encounterStore.copyTo(target);
      const nextStore = new EncounterStore(this.app.vault.adapter, target, this._encounterStore.deviceId, this._encounterStore.deviceLabel);
      const revision = this._encRevision;
      const loaded = await nextStore.load();
      this.settings.encounterFolder = setting;
      await this.saveSettings();
      this._encounterStore = nextStore;
      if (revision === this._encRevision) this._encounters = loaded;
    } catch (error) {
      this.settings.encounterFolder = previousSetting;
      this._encounterStore = previousStore;
      throw error;
    } finally {
      this._encRelocating = false;
      if (this._encPending.length) this._encSaveTimer = window.setTimeout(() => { void this.saveEncounters(); }, 500);
    }
    await previousStore.removeOwn();
  }
  // 只记录主动相遇；同一词条与相遇类型在 60 秒内去重。
  recordEncounter(file: TFile, type: ActiveEncounterKind): void {
    if (!(file instanceof TFile)) return;
    const k = file.path;
    const now = Date.now();
    const dedupKey = k + ":" + type;
    if (!this._encounterDedup) this._encounterDedup = {};
    const last = this._encounterDedup[dedupKey];
    if (last && now - last < 60000) return; // 60 秒内的重复相遇不重复计数
    this._encounterDedup[dedupKey] = now;
    const day = todayStr();
    this._encounters[k] = { lastEncounter: day, encounteredAt: now };
    this._encRevision++;
    this._encPending.push({ path: k, changedAt: now, encounteredAt: now, day });
    this.scheduleEncounterSave();
  }
  deleteEncounterPath(path: string): void {
    if (!this._encounters[path]) return;
    const now = Date.now();
    delete this._encounters[path];
    this._encRevision++;
    this._encPending.push({ path, changedAt: now, deleted: true });
    this.scheduleEncounterSave();
  }
  renameEncounterPath(oldPath: string, newPath: string): void {
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
  scheduleEncounterSave(): void {
    if (this._encRelocating) return;
    if (this._encSaveTimer) window.clearTimeout(this._encSaveTimer);
    this._encSaveTimer = window.setTimeout(() => { void this.saveEncounters(); }, 500);
  }
  async saveEncounters() {
    this._encSaveTimer = 0;
    if (this._encRelocating) return;
    if (this._encWriting !== null) return this._encWriting;
    this._encWriting = (async () => {
      while (this._encPending.length) {
        const batch = this._encPending.splice(0);
        try { await this._encounterStore.apply(batch); }
        catch (error) {
          this._encPending.unshift(...batch);
          console.warn("[Lexis] Cannot save encounters; will retry", error);
          break;
        }
      }
    })().finally(() => {
      this._encWriting = null;
      if (this._encPending.length) this._encSaveTimer = window.setTimeout(() => { void this.saveEncounters(); }, 5000);
    });
    return this._encWriting;
  }
  // 悬停 = 一次失败的提取(没想起来才要查)。这个词的到期日如果还很远,说明"排期偏晚了",拉近一点提醒尽快复习——
  // 只挪 lexis-due,绝不碰 stability/difficulty,也不伪造一次复习评分(FSRS 内部状态只能由真实复习事件驱动)。
  async hoverFeedback(file: TFile): Promise<void> {
    if (!this.settings.hoverFeedback || !(file instanceof TFile)) return;
    if (this.readLifecycle(file).archived) return; // 已归档:悬停只记账,不回流
    const fm = (this.app.metadataCache.getFileCache(file)?.frontmatter || {}) as Record<string, unknown>;
    if (fm["lexis-s"] == null || !fm["lexis-due"]) return; // 还没背过/没有到期日可提前
    const today = todayStr();
    const rawDue = fm["lexis-due"];
    if (typeof rawDue !== "string" && typeof rawDue !== "number") return;
    const due = String(rawDue).slice(0, 10);
    const threshold = addDaysStr(today, this.settings.hoverFeedbackDays ?? 3);
    if (due <= threshold) return; // 本来就不算远,不用管
    await this.app.fileManager.processFrontMatter(file, (fm2: Record<string, unknown>) => { fm2["lexis-due"] = today; });
  }

  // ---------- FSRS 调度 ----------
  readCard(file: TFile): ReviewCard {
    const fm = (this.app.metadataCache.getFileCache(file)?.frontmatter || {}) as Record<string, unknown>;
    return {
      s: typeof fm["lexis-s"] === "number" ? fm["lexis-s"] : null,
      d: typeof fm["lexis-d"] === "number" ? fm["lexis-d"] : null,
      due: typeof fm["lexis-due"] === "string" ? fm["lexis-due"] : null,
      last: typeof fm["lexis-last"] === "string" ? fm["lexis-last"] : null,
      reps: typeof fm["lexis-reps"] === "number" ? fm["lexis-reps"] : null,
      lapses: typeof fm["lexis-lapses"] === "number" ? fm["lexis-lapses"] : null,
      history: Array.isArray(this.settings.reviewHistory?.[file.path]) ? this.settings.reviewHistory[file.path] : [],
    };
  }
  cardRetrievability(card: ReviewCard, date = todayStr()): number {
    const s = Number(card?.s);
    if (!s || isNaN(s) || !card?.last) return 0;
    return FSRS.retrievability(Math.max(0, daysBetween(card.last, date)), s);
  }
  scheduleCard(card: ReviewCard, grade: number): Schedule {
    return scheduleReviewCard(card, grade, this.settings.requestRetention, todayStr());
  }
  async getFirstExample(file: TFile): Promise<string> {
    try {
      const raw = await this.app.vault.cachedRead(file);
      if (!this.occurrenceHeadingText()) return this.occurrenceSentenceFromSection(raw);
      const names = [this.occurrenceHeadingText(), "例句", "出处"].filter(Boolean).map(escapeRe).join("|");
      const m = new RegExp("#{1,6}\\s*(?:" + names + ")([^\\n]*\\n[\\s\\S]*?)(?=\\n#{1,6}\\s|\\n```|$)").exec(raw);
      if (!m) return "";
      return this.occurrenceSentenceFromSection(m[1]);
    } catch { return ""; }
  }
  buildCloze(sentence: string, word: string): string { return sentence.replace(new RegExp(boundedSource(word), "ig"), "______"); }
  humanInterval(days: number): string {
    if (days < 1) return this.t("interval.ltDay");
    if (days < 30) return this.t("interval.days", { count: days });
    if (days < 365) return this.t("interval.months", { count: Math.round(days / 30) });
    return this.t("interval.years", { count: (days / 365).toFixed(1) });
  }
  freqVal(file: TFile): number { const fm = this.app.metadataCache.getFileCache(file)?.frontmatter; const n = parseInt(String(fm && fm.frequency).replace(/[^0-9]/g, ""), 10); return isNaN(n) ? Infinity : n; }
  collectVocabTags(): string[] { const s = new Set<string>(); for (const f of this.app.vault.getMarkdownFiles()) { if (!this.inVocabFolder(f.path)) continue; for (const t of this.getTags(f)) s.add(t); } return [...s].sort(); }
  computeStats(): { due: number; fresh: number; total: number } {
    const today = todayStr();
    let total = 0, due = 0, fresh = 0;
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (!this.inVocabFolder(f.path)) continue;
      total++;
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter || {};
      if (fm["lexis-status"] === "archived" || fm["lexis-status"] === "retired") continue; // 已归档/已淘汰:计入总数,但不计入待复习/新词(复习队列已暂停)
      if (fm["lexis-s"] == null) { fresh++; due++; }
      else if (!fm["lexis-due"] || String(fm["lexis-due"]).slice(0, 10) <= today) due++;
    }
    return { total, due, fresh };
  }
  // ---------- 淘汰法庭(阶段 3) ----------
  // 硬条件筛子,不做加权评分:全部满足才入列,判决权在用户(淘汰/留下/已掌握三个按钮,见 LexisHomeView)。
  async buildRetireCandidates(): Promise<RetireCandidate[]> {
    await this.saveEncounters();
    if (!this._encPending.length) await this.loadEncounters();
    const days = this.settings.retireCandidateDays ?? 90;
    const today = todayStr();
    const files = this.app.vault.getMarkdownFiles().filter((f) => this.inVocabFolder(f.path));
    const out = [];
    for (const f of files) {
      const lc = this.readLifecycle(f);
      if (lc.pinned || lc.archived || lc.retired) continue; // 常驻/已归档/已淘汰:永远不进候选
      const created = fmtDate(new Date(f.stat.ctime));
      if (daysBetween(created, today) < days) continue; // 入库不够久
      const enc = this._encounters[f.path];
      const lastEncounter = (enc && enc.lastEncounter) || created; // 从没相遇过就用入库日期当基准
      const sinceLast = daysBetween(lastEncounter, today);
      if (sinceLast < days) continue; // 最近还自然相遇过,不算候选
      let occCount = 0;
      try { occCount = (await this.findOccurrences(f.basename)).length; } catch { /* An unavailable source index counts as zero occurrences. */ }
      out.push({
        file: f, display: f.basename, created, lastEncounter, sinceLast,
        occCount,
      });
    }
    out.sort((a, b) => b.sinceLast - a.sinceLast);
    return out;
  }
  collectArchivedFiles(): TFile[] {
    return this.app.vault.getMarkdownFiles()
      .filter((file) => this.inVocabFolder(file.path) && this.readLifecycle(file).archived)
      .sort((left, right) => left.path.localeCompare(right.path));
  }
  async restoreSuspendedReviewItem(key: string): Promise<void> {
    if (!this.settings.suspendedReviewItems?.[key]) return;
    delete this.settings.suspendedReviewItems[key];
    await this.saveSettings();
  }
  async openReview(options: ReviewOptions = {}): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(LEXIS_REVIEW_VIEW)[0];
    if (!leaf) { leaf = this.app.workspace.getLeaf(true); await leaf.setViewState({ type: LEXIS_REVIEW_VIEW, active: true }); }
    await this.app.workspace.revealLeaf(leaf);
    if (leaf.view instanceof LexisReviewView) { leaf.view.options = options || {}; await leaf.view.refresh(); }
  }
  async openReviewLog(date?: string): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(LEXIS_LOG_VIEW)[0];
    if (!leaf) { leaf = this.app.workspace.getLeaf("tab"); await leaf.setViewState({ type: LEXIS_LOG_VIEW, active: true }); }
    await this.app.workspace.revealLeaf(leaf);
    if (leaf.view instanceof LexisLogView) {
      if (date) leaf.view.setDay(date);
      else void leaf.view.refresh();
    }
  }
  saveReviewSession(leaf: obsidian.WorkspaceLeaf, state: unknown): void { if (leaf && state) this._reviewSessions.set(leaf, state); }
  takeReviewSession(leaf: obsidian.WorkspaceLeaf): unknown {
    if (!leaf) return null;
    const state = this._reviewSessions.get(leaf) || null;
    this._reviewSessions.delete(leaf);
    return state;
  }
  async openHome(location: HomeOpenLocation = "center"): Promise<void> {
    const sourceFile = this.app.workspace.getActiveFile();
    const workspace = this.app.workspace;
    let leaf = location === "sidebar"
      ? await workspace.ensureSideLeaf(LEXIS_HOME_VIEW, "right", { active: true, reveal: true })
      : workspace.getLeavesOfType(LEXIS_HOME_VIEW).find((candidate) => candidate.getRoot() === workspace.rootSplit);
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
}

export function pluginReviewDescriptors(): PropertyDescriptorMap {
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(LexisPluginReview.prototype);
  return descriptors;
}
