"use strict";

// 纯呈现：按真实复习日期画分段遗忘曲线；调度参数和日期工具由主插件注入。
function buildCurveSVG(card, { requestRetention, nextInterval, retrievability, addDaysStr, daysBetween, todayStr }) {
  const currentS = Number(card.s);
  if (!currentS || isNaN(currentS)) return null;

  const eventsByDate = new Map();
  for (const raw of Array.isArray(card.history) ? card.history : []) {
    const date = String(raw?.date || "").slice(0, 10);
    const s = Number(raw?.s);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !s || isNaN(s)) continue;
    eventsByDate.set(date, { date, s, retention: Number(raw.retention) });
  }
  const lastDate = String(card.last || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(lastDate)) {
    const saved = eventsByDate.get(lastDate);
    eventsByDate.set(lastDate, { date: lastDate, s: currentS, retention: saved?.retention });
  }
  const events = [...eventsByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (!events.length) return null;

  const targetRetention = requestRetention || 0.9;
  const startDate = events[0].date;
  const fallbackDue = addDaysStr(events[events.length - 1].date, nextInterval(events[events.length - 1].s, targetRetention));
  const endDate = [String(card.due || "").slice(0, 10), todayStr(), fallbackDue, events[events.length - 1].date]
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort()
    .pop();
  const totalDays = Math.max(1, daysBetween(startDate, endDate));
  const H = 122, left = 34, right = 12, top = 8, bottom = 26;
  const W = Math.max(300, Math.min(1800, Math.max(totalDays * 12 + left + right, events.length * 64 + left + right)));
  const plotW = W - left - right, plotH = H - top - bottom;
  const xDay = (day) => left + plotW * Math.max(0, Math.min(totalDays, day)) / totalDays;
  const xDate = (date) => xDay(daysBetween(startDate, date));
  const y = (retention) => top + plotH * (1 - Math.max(0, Math.min(1, retention)));

  let path = "";
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const eventX = xDate(event.date);
    const before = Number.isFinite(event.retention) ? event.retention / 100 : 1;
    if (!path) path = `M${eventX.toFixed(1)} ${y(before).toFixed(1)} L${eventX.toFixed(1)} ${y(1).toFixed(1)}`;
    else path += ` L${eventX.toFixed(1)} ${y(1).toFixed(1)}`;
    const segmentEnd = i + 1 < events.length ? events[i + 1].date : endDate;
    const segmentDays = Math.max(0, daysBetween(event.date, segmentEnd));
    const samples = Math.max(2, Math.min(48, segmentDays * 2));
    for (let sample = 1; sample <= samples; sample++) {
      const elapsed = segmentDays * sample / samples;
      const xx = xDay(daysBetween(startDate, event.date) + elapsed);
      const retention = retrievability(elapsed, event.s);
      path += ` L${xx.toFixed(1)} ${y(retention).toFixed(1)}`;
    }
  }

  const grid = [1, 0.5, 0].map((retention) => {
    const yy = y(retention).toFixed(1);
    return `<line x1="${left}" y1="${yy}" x2="${W - right}" y2="${yy}" stroke="var(--background-modifier-border)" stroke-width="1"/>` +
      `<text x="${left - 5}" y="${(+yy + 3.5).toFixed(1)}" text-anchor="end" fill="var(--text-muted)" font-size="9">${Math.round(retention * 100)}%</text>`;
  }).join("");
  const targetY = y(targetRetention).toFixed(1);

  let lastLabelX = -Infinity;
  const reviewMarks = events.map((event) => {
    const xx = xDate(event.date);
    const before = Number.isFinite(event.retention) ? event.retention / 100 : null;
    const point = before == null ? "" : `<circle cx="${xx.toFixed(1)}" cy="${y(before).toFixed(1)}" r="2.5" fill="var(--text-accent)"/>`;
    const label = xx - lastLabelX < 42 ? "" : `<text x="${xx.toFixed(1)}" y="${H - 7}" text-anchor="middle" fill="var(--text-muted)" font-size="9">${event.date.slice(5)}</text>`;
    if (label) lastLabelX = xx;
    return `<line x1="${xx.toFixed(1)}" y1="${top}" x2="${xx.toFixed(1)}" y2="${H - bottom}" stroke="var(--text-faint)" stroke-width="1" stroke-dasharray="2 3"/>${point}${label}`;
  }).join("");

  const today = todayStr();
  const latest = [...events].reverse().find((event) => event.date <= today) || events[0];
  const todayRetention = retrievability(Math.max(0, daysBetween(latest.date, today)), latest.s);
  const todayX = xDate(today);
  const todayPoint = today >= startDate && today <= endDate
    ? `<circle cx="${todayX.toFixed(1)}" cy="${y(todayRetention).toFixed(1)}" r="3" fill="var(--interactive-accent)"/>`
    : "";

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
    grid +
    `<line x1="${left}" y1="${targetY}" x2="${W - right}" y2="${targetY}" stroke="var(--text-faint)" stroke-dasharray="3 3" stroke-width="1"/>` +
    `<path d="${path}" fill="none" stroke="var(--interactive-accent)" stroke-width="2"/>` +
    reviewMarks + todayPoint +
    `</svg>`;
}

module.exports = { buildCurveSVG };
