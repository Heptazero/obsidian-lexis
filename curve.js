"use strict";

// 纯呈现：调度参数和日期工具从主插件注入，避免图表拥有任何词库写入职责。
function buildCurveSVG(card, { requestRetention, nextInterval, retrievability, addDaysStr, daysBetween, todayStr }) {
  const s = Number(card.s);
  if (!s || isNaN(s)) return null;
  const targetRetention = requestRetention || 0.9;
  const interval = nextInterval(s, targetRetention);
  const maxDays = Math.max(interval * 1.6, 2);
  const W = 380, H = 156, left = 38, right = 10, top = 10, bottom = 28;
  const startDate = card.last ? String(card.last).slice(0, 10) : todayStr();
  const endRetention = retrievability(maxDays, s);
  const floor = Math.max(0, Math.floor(endRetention * 10) / 10);
  const x = (days) => left + (W - left - right) * (days / maxDays);
  const y = (retention) => top + (H - top - bottom) * (1 - (retention - floor) / (1 - floor));
  const dateAt = (days) => String(addDaysStr(startDate, Math.round(days))).slice(5);
  let path = "";
  const samples = 48;
  for (let i = 0; i <= samples; i++) {
    const days = maxDays * i / samples;
    const retention = retrievability(days, s);
    path += (i ? " L" : "M") + x(days).toFixed(1) + " " + y(retention).toFixed(1);
  }
  const elapsed = card.last ? Math.min(daysBetween(card.last, todayStr()), maxDays) : 0;
  const todayX = x(elapsed);
  const targetY = y(targetRetention);
  const todayY = y(retrievability(elapsed, s));
  const yTicks = [];
  for (let retention = 1; retention >= floor - 0.001; retention -= 0.1) yTicks.push(Math.round(retention * 10) / 10);
  const grid = yTicks.map((retention) => {
    const yy = y(retention).toFixed(1);
    return `<line x1="${left}" y1="${yy}" x2="${W - right}" y2="${yy}" stroke="var(--background-modifier-border)" stroke-width="1"/>` +
      `<text x="${left - 6}" y="${(+yy + 4).toFixed(1)}" text-anchor="end" fill="var(--text-muted)" font-size="10">${Math.round(retention * 100)}%</text>`;
  }).join("");
  const dates = [[0, "start"], [maxDays / 2, "middle"], [maxDays, "end"]]
    .map(([days, anchor]) => `<text x="${x(days).toFixed(1)}" y="${H - 8}" text-anchor="${anchor}" fill="var(--text-muted)" font-size="10">${dateAt(days)}</text>`)
    .join("");
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">` +
    grid +
    `<line x1="${left}" y1="${targetY.toFixed(1)}" x2="${W - right}" y2="${targetY.toFixed(1)}" stroke="var(--text-faint)" stroke-dasharray="3 3" stroke-width="1"/>` +
    `<path d="${path}" fill="none" stroke="var(--interactive-accent)" stroke-width="2"/>` +
    `<line x1="${todayX.toFixed(1)}" y1="${top}" x2="${todayX.toFixed(1)}" y2="${H - bottom}" stroke="var(--text-accent)" stroke-width="1"/>` +
    `<circle cx="${todayX.toFixed(1)}" cy="${todayY.toFixed(1)}" r="3" fill="var(--text-accent)"/>` +
    `<text x="${Math.min(todayX + 4, W - right).toFixed(1)}" y="${top + 10}" fill="var(--text-accent)" font-size="10">今天</text>` +
    dates +
    `</svg>`;
}

module.exports = { buildCurveSVG };
