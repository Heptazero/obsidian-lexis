import type { DataAdapter } from "obsidian";

export type EncounterKind = "hover" | "add" | "passive" | "open";
export interface EncounterEvent {
  id: string;
  path: string;
  kind: EncounterKind;
  day: string;
  at: number;
}
export interface EncounterSummary {
  hoverCount: number;
  encounterCount: number;
  lastEncounter: string;
}
export type EncounterTotals = Record<string, EncounterSummary>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = new Set<EncounterKind>(["hover", "add", "passive", "open"]);

export function encounterFolder(input: string, configDir: string, pluginId: string): string {
  const value = input.trim().replaceAll("\\", "/").replace(/\/+$/, "");
  if (!value) return `${configDir}/plugins/${pluginId}/encounters`;
  const parts = value.split("/");
  if (value.startsWith("/") || /^[A-Za-z]:/.test(value) || parts.some((part) => !part || part === "." || part === "..") || /\.jsonl?$/i.test(value)) {
    throw new Error("Enter a vault-relative folder path, not a file name or absolute path.");
  }
  return value;
}

function applyEvent(totals: EncounterTotals, event: EncounterEvent): void {
  const entry = totals[event.path] || (totals[event.path] = { hoverCount: 0, encounterCount: 0, lastEncounter: "" });
  entry.encounterCount++;
  if (event.kind === "hover") entry.hoverCount++;
  if (event.day > entry.lastEncounter) entry.lastEncounter = event.day;
}

async function ensureDirectory(adapter: DataAdapter, folder: string): Promise<void> {
  let current = "";
  for (const segment of folder.split("/")) {
    current = current ? `${current}/${segment}` : segment;
    if (!(await adapter.exists(current))) await adapter.mkdir(current);
  }
}

export class EncounterStore {
  constructor(
    private readonly adapter: DataAdapter,
    readonly folder: string,
    readonly deviceId: string,
  ) {}

  async load(): Promise<EncounterTotals> {
    const totals: EncounterTotals = {};
    if (!(await this.adapter.exists(this.folder))) return totals;
    const root = await this.adapter.list(this.folder);
    const baselinePath = `${this.folder}/baseline.json`;
    if (root.files.includes(baselinePath)) {
      const raw = JSON.parse(await this.adapter.read(baselinePath)) as unknown;
      if (!raw || typeof raw !== "object") throw new Error("Invalid Lexis encounter baseline");
      const baseline = raw as { schema?: number; entries?: EncounterTotals };
      if (baseline.schema !== 1 || !baseline.entries || typeof baseline.entries !== "object" || Array.isArray(baseline.entries)) throw new Error("Invalid Lexis encounter baseline");
      for (const [path, entry] of Object.entries(baseline.entries)) {
        if (!path || !entry || !Number.isSafeInteger(entry.encounterCount) || entry.encounterCount < 0 || !Number.isSafeInteger(entry.hoverCount) || entry.hoverCount < 0 || entry.hoverCount > entry.encounterCount || (entry.lastEncounter && !DAY.test(entry.lastEncounter))) continue;
        totals[path] = { encounterCount: entry.encounterCount, hoverCount: entry.hoverCount, lastEncounter: entry.lastEncounter };
      }
    }
    const seen = new Set<string>();
    for (const deviceFolder of root.folders) {
      if (!/\/[a-f0-9]{32}$/.test(deviceFolder)) continue;
      const { files } = await this.adapter.list(deviceFolder);
      for (const file of files) {
        if (!/\/\d{4}-\d{2}-\d{2}\.jsonl$/.test(file)) continue;
        const lines = (await this.adapter.read(file)).split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          let event: EncounterEvent;
          try { event = JSON.parse(line) as EncounterEvent; }
          catch { console.warn(`[Lexis] Invalid encounter event in ${file}`); continue; }
          if (typeof event.id !== "string" || typeof event.path !== "string" || !event.path || !KINDS.has(event.kind) || !DAY.test(event.day) || seen.has(event.id)) continue;
          seen.add(event.id);
          applyEvent(totals, event);
        }
      }
    }
    return totals;
  }

  async append(events: EncounterEvent[]): Promise<void> {
    if (!events.length) return;
    const folder = `${this.folder}/${this.deviceId}`;
    await ensureDirectory(this.adapter, folder);
    const byDay = new Map<string, string[]>();
    for (const event of events) {
      if (!DAY.test(event.day)) throw new Error("Invalid encounter date");
      const lines = byDay.get(event.day) || [];
      lines.push(JSON.stringify(event));
      byDay.set(event.day, lines);
    }
    for (const [day, lines] of byDay) {
      const file = `${folder}/${day}.jsonl`;
      const text = `${lines.join("\n")}\n`;
      if (await this.adapter.exists(file)) await this.adapter.append(file, text);
      else await this.adapter.write(file, text);
    }
  }

  async copyTo(folder: string): Promise<void> {
    if (folder === this.folder || !(await this.adapter.exists(this.folder))) return;
    await ensureDirectory(this.adapter, folder);
    const destination = await this.adapter.list(folder);
    const otherFile = destination.files.find((file) => !/\/(baseline\.json|\.DS_Store)$/.test(file));
    const otherFolder = destination.folders.find((item) => !/\/(?:[a-f0-9]{32}|legacy-backup)$/.test(item));
    if (otherFile || otherFolder) throw new Error("Choose an empty folder dedicated to Lexis encounter records.");
    const source = await this.adapter.list(this.folder);
    const baseline = `${this.folder}/baseline.json`;
    if (source.files.includes(baseline)) {
      const target = `${folder}/baseline.json`;
      if (await this.adapter.exists(target)) {
        if (await this.adapter.read(target) !== await this.adapter.read(baseline)) throw new Error("The destination has a different encounter baseline.");
      } else await this.adapter.copy(baseline, target);
    }
    for (const sourceFolder of source.folders.filter((item) => /\/[a-f0-9]{32}$/.test(item))) {
      const targetFolder = folder + sourceFolder.slice(this.folder.length);
      await ensureDirectory(this.adapter, targetFolder);
      const { files } = await this.adapter.list(sourceFolder);
      for (const file of files.filter((item) => /\/\d{4}-\d{2}-\d{2}\.jsonl$/.test(item))) {
        const target = targetFolder + file.slice(sourceFolder.length);
        if (!(await this.adapter.exists(target))) { await this.adapter.copy(file, target); continue; }
        const existing = await this.adapter.read(target);
        const incoming = await this.adapter.read(file);
        if (existing === incoming) continue;
        const ids = new Set(existing.split("\n").filter(Boolean).map((line) => (JSON.parse(line) as EncounterEvent).id));
        const additional = incoming.split("\n").filter(Boolean).filter((line) => {
          const id = (JSON.parse(line) as EncounterEvent).id;
          if (typeof id !== "string" || !id) throw new Error("Invalid encounter event ID");
          if (ids.has(id)) return false;
          ids.add(id);
          return true;
        });
        if (additional.length) await this.adapter.append(target, `${existing.endsWith("\n") ? "" : "\n"}${additional.join("\n")}\n`);
      }
    }
  }
}
