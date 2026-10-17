"use strict";

import type { ReviewHistoryEvent } from "./types";

export interface CurveCard {
  s?: number | null;
  history?: ReviewHistoryEvent[];
  last?: string | null;
  due?: string | null;
}

interface CurveDependencies {
  requestRetention: number;
  nextInterval: (stability: number, retention: number) => number;
  retrievability: (elapsedDays: number, stability: number) => number;
  addDaysStr: (date: string, days: number) => string;
  daysBetween: (start: string, end: string) => number;
  todayStr: () => string;
}

interface CurveEvent {
  date: string;
  s: number;
  retention?: number;
}

function recentReviewDates(card: CurveCard, limit = 4): string[] {
  const dates = (Array.isArray(card.history) ? card.history : [])
    .map((event) => String(event?.date || "").slice(0, 10))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));
  const lastDate = String(card.last || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(lastDate)) dates.push(lastDate);
  return [...new Set(dates)].sort().reverse().slice(0, Math.max(1, limit));
}

// 纯呈现：按真实复习日期画分段遗忘曲线；调度参数和日期工具由主插件注入。
function buildCurveSVG(card: CurveCard, { requestRetention, nextInterval, retrievability, addDaysStr, daysBetween, todayStr }: CurveDependencies, { limit = 8 }: { limit?: number } = {}): string | null {
  const currentS = Number(card.s);
  if (!Number.isFinite(currentS) || currentS <= 0) return null;
  const today = todayStr();

  const eventsByDate = new Map<string, CurveEvent>();
  for (const raw of Array.isArray(card.history) ? card.history : []) {
    const date = String(raw?.date || "").slice(0, 10);
    const s = Number(raw?.s);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today || !Number.isFinite(s) || s <= 0) continue;
    eventsByDate.set(date, { date, s, retention: raw.retention == null ? undefined : Number(raw.retention) });
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
  const endDate = [String(card.due || "").slice(0, 10), addDaysStr(today, 1), fallbackDue]
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort()
    .pop();
  const totalDays = Math.max(1, daysBetween(startDate, endDate));
  const W = 420, H = 150, left = 34, right = 24, top = 10, bottom = 30;
  const plotW = W - left - right, plotH = H - top - bottom;
  const xDay = (day: number) => left + plotW * Math.max(0, Math.min(totalDays, day)) / totalDays;
  const xDate = (date: string) => xDay(daysBetween(startDate, date));
  const y = (retention: number) => top + plotH * (1 - Math.max(0, Math.min(1, retention)));

  let path = "", forecast = "";
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const eventX = xDate(event.date);
    const before = Number.isFinite(event.retention) ? event.retention / 100 : 1;
    if (!path) path = `M${eventX.toFixed(1)} ${y(before).toFixed(1)} L${eventX.toFixed(1)} ${y(1).toFixed(1)}`;
    else path += ` L${eventX.toFixed(1)} ${y(1).toFixed(1)}`;
    const segmentEnd = i + 1 < events.length ? events[i + 1].date : endDate;
    const segmentDays = Math.max(0, daysBetween(event.date, segmentEnd));
    const todayElapsed = Math.max(0, daysBetween(event.date, today));
    const pastDays = Math.min(segmentDays, todayElapsed);
    const samples = Math.max(2, Math.min(48, pastDays * 2));
    for (let sample = 1; sample <= samples; sample++) {
      const elapsed = pastDays * sample / samples;
      const xx = xDay(daysBetween(startDate, event.date) + elapsed);
      const retention = retrievability(elapsed, event.s);
      path += ` L${xx.toFixed(1)} ${y(retention).toFixed(1)}`;
    }
    if (segmentDays > pastDays) {
      forecast = `M${xDate(today).toFixed(1)} ${y(retrievability(todayElapsed, event.s)).toFixed(1)}`;
      for (let sample = 1; sample <= 32; sample++) {
        const elapsed = pastDays + (segmentDays - pastDays) * sample / 32;
        forecast += ` L${xDay(daysBetween(startDate, event.date) + elapsed).toFixed(1)} ${y(retrievability(elapsed, event.s)).toFixed(1)}`;
      }
    }
  }

  const grid = [1, 0.75, 0.5, 0.25, 0].map((retention) => {
    const yy = y(retention).toFixed(1);
    return `<line x1="${left}" y1="${yy}" x2="${W - right}" y2="${yy}" stroke="var(--background-modifier-border)" stroke-width="1"/>` +
      `<text x="${left - 5}" y="${(+yy + 3.5).toFixed(1)}" text-anchor="end" fill="var(--text-muted)" font-size="9">${Math.round(retention * 100)}%</text>`;
  }).join("");
  const targetY = y(targetRetention).toFixed(1);

  const todayX = xDate(today);
  let lastLabelX = -Infinity;
  const reviewMarks = events.map((event) => {
    const xx = xDate(event.date);
    const before = Number.isFinite(event.retention) ? event.retention / 100 : null;
    const detail = before == null ? event.date : `${event.date} · ${Math.round(before * 100)}%`;
    const point = `<g data-curve-detail="${detail}" data-review-date="${event.date}" tabindex="0" role="button" aria-label="${detail}"><title>${detail}</title><circle cx="${xx.toFixed(1)}" cy="${y(before ?? 1).toFixed(1)}" r="9" fill="transparent"/><circle cx="${xx.toFixed(1)}" cy="${y(before ?? 1).toFixed(1)}" r="2.5" fill="var(--text-accent)"/></g>`;
    const label = xx - lastLabelX < 42 || Math.abs(xx - todayX) < 42 ? "" : `<text x="${xx.toFixed(1)}" y="${H - 7}" text-anchor="middle" fill="var(--text-muted)" font-size="9">${event.date.slice(5)}</text>`;
    if (label) lastLabelX = xx;
    return `<line x1="${xx.toFixed(1)}" y1="${top}" x2="${xx.toFixed(1)}" y2="${H - bottom}" stroke="var(--text-faint)" stroke-width="1" stroke-dasharray="2 3"/>${point}${label}`;
  }).join("");

  const latest = [...events].reverse().find((event) => event.date <= today) || events[0];
  const todayRetention = retrievability(Math.max(0, daysBetween(latest.date, today)), latest.s);
  const todayPoint = today >= startDate && today <= endDate
    ? `<g data-curve-detail="Today · ~${Math.round(todayRetention * 100)}%" tabindex="0" role="button" aria-label="Today · ~${Math.round(todayRetention * 100)}%"><line x1="${todayX.toFixed(1)}" y1="${top}" x2="${todayX.toFixed(1)}" y2="${H - bottom}" stroke="var(--interactive-accent)" stroke-width="1"/><circle cx="${todayX.toFixed(1)}" cy="${y(todayRetention).toFixed(1)}" r="9" fill="transparent"/><circle cx="${todayX.toFixed(1)}" cy="${y(todayRetention).toFixed(1)}" r="3" fill="var(--interactive-accent)"/><text x="${todayX.toFixed(1)}" y="${H - 7}" text-anchor="middle" fill="var(--interactive-accent)" font-size="10">Today</text></g>`
    : "";

  const predicted = retrievability(daysBetween(latest.date, endDate), latest.s);
  return `<svg data-curve-today="${today}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
    grid +
    `<line x1="${left}" y1="${top}" x2="${left}" y2="${H - bottom}" stroke="var(--text-muted)" stroke-width="1"/>` +
    `<line x1="${left}" y1="${H - bottom}" x2="${W - right}" y2="${H - bottom}" stroke="var(--text-muted)" stroke-width="1"/>` +
    `<line x1="${left}" y1="${targetY}" x2="${W - right}" y2="${targetY}" stroke="var(--text-faint)" stroke-dasharray="3 3" stroke-width="1"/>` +
    `<path class="lexis-curve-history-line" d="${path}" fill="none" stroke="var(--interactive-accent)" stroke-width="2"/>` +
    `<path class="lexis-curve-forecast" d="${forecast}" fill="none" stroke="var(--interactive-accent)" stroke-width="2" stroke-dasharray="4 4"/>` +
    `<g data-curve-detail="${endDate} · ~${Math.round(predicted * 100)}%" tabindex="0" role="button" aria-label="${endDate} · ~${Math.round(predicted * 100)}%"><title>${endDate} · ~${Math.round(predicted * 100)}%</title><circle cx="${xDate(endDate).toFixed(1)}" cy="${y(predicted).toFixed(1)}" r="9" fill="transparent"/><circle class="lexis-curve-prediction" cx="${xDate(endDate).toFixed(1)}" cy="${y(predicted).toFixed(1)}" r="3" fill="var(--background-primary)" stroke="var(--interactive-accent)"/></g>` +
    reviewMarks + todayPoint +
    `</svg>`;
}

export { buildCurveSVG, recentReviewDates };
