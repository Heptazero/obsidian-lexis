import { Component, MarkdownRenderer, type App } from "obsidian";

export const escapeRe = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const boundedSource = (word: string): string => {
  const leftBoundary = /^[A-Za-z0-9_]/.test(word) ? "\\b" : "";
  const rightBoundary = /[A-Za-z0-9_]$/.test(word) ? "\\b" : "";
  return leftBoundary + escapeRe(word) + rightBoundary;
};

export const escapeHtml = (value: string | number | null | undefined): string => String(value == null ? "" : value).replace(
  /[&<>"]/g,
  (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character] || character),
);

export const renderLexisMarkdown = (
  app: App,
  markdown: string,
  element: HTMLElement,
  sourcePath: string,
  component: Component,
): Promise<void> => MarkdownRenderer.render(app, String(markdown == null ? "" : markdown).replace(/\u00a0/g, " "), element, sourcePath, component);

export const round2 = (value: number): number => Math.round(value * 100) / 100;

export function cssColorToHex(color: string, document: Document): string {
  if (!color) return "#888888";
  if (/^#[0-9a-fA-F]{6}$/.test(color.trim())) return color.trim();
  const temporary = document.body.createDiv();
  temporary.setCssStyles({ color });
  const rgb = temporary.win.getComputedStyle(temporary).color;
  temporary.remove();
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
  if (!match) return "#888888";
  return `#${[match[1], match[2], match[3]].map((value) => (+value).toString(16).padStart(2, "0")).join("")}`;
}

export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function todayString(): string {
  return formatDate(new Date());
}

function parseDate(value: string): Date {
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function addDaysString(base: string, days: number): string {
  const date = base ? parseDate(base) : new Date();
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

export function daysBetween(from: string, to: string): number {
  return Math.max(0, Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000));
}
