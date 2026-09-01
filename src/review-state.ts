import type { App } from "obsidian";
import type { LexisSettings, ReviewCardState, ReviewItem, ReviewStateSnapshot } from "./types";

interface ReviewSchedule {
  s: number;
  d: number;
  due: string;
  reps: number;
  lapses: number;
}

interface ReviewStateDependencies {
  todayStr: () => string;
  round2: (value: number) => number;
}

interface ReviewStateHost {
  app: App;
  settings: LexisSettings;
  saveSettings(): Promise<void>;
}

const cloneState = (state: ReviewCardState | null | undefined): ReviewCardState | null => state ? { ...state } : null;

export function createReviewState({ todayStr, round2 }: ReviewStateDependencies): PropertyDescriptorMap {
  class ReviewState {
    declare app: ReviewStateHost["app"];
    declare settings: ReviewStateHost["settings"];
    declare saveSettings: ReviewStateHost["saveSettings"];

    readSyntaxCardState(id: string): ReviewCardState {
      const state = this.settings.syntaxCardStates?.[id] || {};
      return {
        ...state,
        history: Array.isArray(this.settings.reviewHistory?.[`syntax:${id}`]) ? this.settings.reviewHistory[`syntax:${id}`] : [],
      };
    }

    snapshotReviewItem(item: ReviewItem): ReviewStateSnapshot {
      if (item.type === "note") return { note: cloneState(item.card) };
      const syntax: Record<string, ReviewCardState | null> = {};
      for (const id of item.syntax?.memberIds || []) syntax[id] = cloneState(this.settings.syntaxCardStates?.[id]);
      return { syntax };
    }

    async applyReviewItemSchedule(item: ReviewItem, schedule: ReviewSchedule): Promise<void> {
      const state: ReviewCardState = {
        s: round2(schedule.s),
        d: round2(schedule.d),
        due: schedule.due,
        last: todayStr(),
        reps: schedule.reps,
        lapses: schedule.lapses,
      };
      if (item.type === "note") {
        await this.app.fileManager.processFrontMatter(item.file, (frontmatter: Record<string, unknown>) => {
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

    async restoreReviewItem(item: ReviewItem, snapshot: ReviewStateSnapshot): Promise<void> {
      if (item.type === "note") {
        const previous = snapshot.note;
        await this.app.fileManager.processFrontMatter(item.file, (frontmatter: Record<string, unknown>) => {
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

    async logReviewItem(item: ReviewItem, schedule: ReviewSchedule, grade: number, retentionBefore: number): Promise<void> {
      const today = todayStr();
      this.settings.reviewLog[today] = (this.settings.reviewLog[today] || 0) + 1;
      const keys = item.type === "note" ? [item.file.path] : (item.syntax?.memberIds || []).map((id) => `syntax:${id}`);
      for (const key of keys) {
        const history = Array.isArray(this.settings.reviewHistory[key]) ? this.settings.reviewHistory[key] : [];
        history.push({ date: today, s: round2(schedule.s), grade, retention: Math.round(Math.max(0, Math.min(1, retentionBefore)) * 100) });
        this.settings.reviewHistory[key] = history.slice(-64);
      }
      await this.saveSettings();
    }

    async undoReviewItemLog(item: ReviewItem): Promise<void> {
      const today = todayStr();
      if (this.settings.reviewLog[today]) {
        this.settings.reviewLog[today]--;
        if (this.settings.reviewLog[today] <= 0) delete this.settings.reviewLog[today];
      }
      const keys = item.type === "note" ? [item.file.path] : (item.syntax?.memberIds || []).map((id) => `syntax:${id}`);
      for (const key of keys) {
        const history = this.settings.reviewHistory[key];
        if (Array.isArray(history) && history.length) history.pop();
      }
      await this.saveSettings();
    }
  }

  const descriptors = Object.getOwnPropertyDescriptors(ReviewState.prototype);
  delete descriptors.constructor;
  return descriptors;
}
