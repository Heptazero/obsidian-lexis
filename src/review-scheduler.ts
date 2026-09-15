import { FSRS } from "./fsrs";
import { addDaysString, daysBetween, round2 } from "./shared-utils";
import type { ReviewCardState, ReviewHistoryEvent } from "./types";

export interface ReviewSchedule {
  s: number;
  d: number;
  due: string;
  reps: number;
  lapses: number;
  interval: number;
}

function validState(stability: number, difficulty: number): boolean {
  return Number.isFinite(stability) && stability > 0
    && Number.isFinite(difficulty) && difficulty >= 1 && difficulty <= 10;
}

export function scheduleReviewCard(card: ReviewCardState, grade: number, retention: number, today: string): ReviewSchedule {
  const previousS = Number(card.s);
  const previousD = Number(card.d);
  const reps = (Number(card.reps) || 0) + 1;
  let lapses = Number(card.lapses) || 0;
  let stability: number;
  let difficulty: number;

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

export function repairReviewHistory(history: Record<string, ReviewHistoryEvent[]>): boolean {
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
