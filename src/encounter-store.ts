import type { DataAdapter } from "obsidian";

export type ActiveEncounterKind = "hover" | "add" | "open";

export interface EncounterSummary {
  lastEncounter: string;
  encounteredAt: number;
}

export interface EncounterMutation {
  path: string;
  changedAt: number;
  encounteredAt?: number;
  day?: string;
  deleted?: true;
}

interface EncounterSnapshot {
  schema: 2;
  deviceId: string;
  entries: Record<string, EncounterMutation>;
}

interface EncounterSnapshotFile {
  name: string;
  snapshot: EncounterSnapshot;
}

interface LegacyEncounterEvent {
  path?: unknown;
  kind?: unknown;
  day?: unknown;
  at?: unknown;
}

export type EncounterTotals = Record<string, EncounterSummary>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DEVICE = /^[a-f0-9]{32}$/;
const DEVICE_LABEL = /^[a-z][a-z0-9-]{0,31}$/;
const LEGACY_SNAPSHOT = /^([a-f0-9]{32})\.json$/;
const SHORT_NAMED_SNAPSHOT = /^([a-z][a-z0-9-]{0,31})--([a-f0-9]{8})\.json$/;
const NAMED_SNAPSHOT = /^([a-z][a-z0-9-]{0,31})--([a-f0-9]{32})\.json$/;
const LEGACY_EVENT_FILE = /^\d{4}-\d{2}-\d{2}\.jsonl$/;
const ACTIVE_KINDS = new Set(["hover", "add", "open"]);

export function encounterFolder(input: string, configDir: string, pluginId: string): string {
  const value = input.trim().replaceAll("\\", "/").replace(/\/+$/, "");
  if (!value) return `${configDir}/plugins/${pluginId}/encounters`;
  const parts = value.split("/");
  if (value.startsWith("/") || /^[A-Za-z]:/.test(value) || parts.some((part) => !part || part === "." || part === "..") || /\.jsonl?$/i.test(value)) {
    throw new Error("Enter a vault-relative folder path, not a file name or absolute path.");
  }
  return value;
}

function validMutation(value: unknown): value is EncounterMutation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Partial<EncounterMutation>;
  if (typeof entry.path !== "string" || !entry.path || !Number.isSafeInteger(entry.changedAt) || Number(entry.changedAt) <= 0) return false;
  if (entry.deleted) return true;
  return Number.isSafeInteger(entry.encounteredAt) && Number(entry.encounteredAt) > 0 && typeof entry.day === "string" && DAY.test(entry.day);
}

function newer(left: EncounterMutation | undefined, right: EncounterMutation): EncounterMutation {
  if (!left || right.changedAt > left.changedAt) return right;
  if (right.changedAt < left.changedAt) return left;
  return right.deleted && !left.deleted ? right : left;
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
    readonly deviceLabel = "device",
  ) {
    if (!DEVICE.test(deviceId)) throw new Error("Invalid encounter device ID");
    if (!DEVICE_LABEL.test(deviceLabel)) throw new Error("Invalid encounter device label");
  }

  private snapshotPath(folder = this.folder, deviceId = this.deviceId, deviceLabel = this.deviceLabel): string {
    return `${folder}/${deviceLabel}--${deviceId}.json`;
  }

  private legacySnapshotPath(folder = this.folder, deviceId = this.deviceId): string {
    return `${folder}/${deviceId}.json`;
  }

  private snapshotName(file: string): string | null {
    const name = file.slice(file.lastIndexOf("/") + 1);
    return LEGACY_SNAPSHOT.test(name) || SHORT_NAMED_SNAPSHOT.test(name) || NAMED_SNAPSHOT.test(name) ? name : null;
  }

  private async readSnapshot(file: string): Promise<EncounterSnapshot> {
    const raw = JSON.parse(await this.adapter.read(file)) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Invalid Lexis encounter snapshot: ${file}`);
    const snapshot = raw as Partial<EncounterSnapshot>;
    if (snapshot.schema !== 2 || typeof snapshot.deviceId !== "string" || !DEVICE.test(snapshot.deviceId) || !snapshot.entries || typeof snapshot.entries !== "object" || Array.isArray(snapshot.entries)) {
      throw new Error(`Invalid Lexis encounter snapshot: ${file}`);
    }
    const entries: Record<string, EncounterMutation> = {};
    for (const [path, value] of Object.entries(snapshot.entries)) {
      if (validMutation(value) && value.path === path) entries[path] = value;
    }
    const name = this.snapshotName(file);
    const legacyId = name?.match(LEGACY_SNAPSHOT)?.[1];
    const shortId = name?.match(SHORT_NAMED_SNAPSHOT)?.[2];
    const namedId = name?.match(NAMED_SNAPSHOT)?.[2];
    if (!name || (legacyId && legacyId !== snapshot.deviceId) || (shortId && !snapshot.deviceId.startsWith(shortId)) || (namedId && namedId !== snapshot.deviceId)) {
      throw new Error(`Invalid Lexis encounter snapshot name: ${file}`);
    }
    return { schema: 2, deviceId: snapshot.deviceId, entries };
  }

  private async writeSnapshot(file: string, snapshot: EncounterSnapshot): Promise<void> {
    const data = JSON.stringify(snapshot);
    if (await this.adapter.exists(file)) await this.adapter.process(file, () => data);
    else await this.adapter.write(file, data);
  }

  private async migrateOwnSnapshotName(folder = this.folder): Promise<void> {
    const named = this.snapshotPath(folder);
    const candidates = [this.legacySnapshotPath(folder)];
    if (await this.adapter.exists(folder)) {
      const root = await this.adapter.list(folder);
      for (const file of root.files) {
        const name = file.slice(file.lastIndexOf("/") + 1);
        if (SHORT_NAMED_SNAPSHOT.test(name) && file !== named) candidates.push(file);
      }
    }
    const sources: { file: string; snapshot: EncounterSnapshot }[] = [];
    for (const file of candidates) {
      if (!(await this.adapter.exists(file))) continue;
      const snapshot = await this.readSnapshot(file);
      if (snapshot.deviceId === this.deviceId) sources.push({ file, snapshot });
    }
    if (!sources.length) return;
    const current = await this.readOwnSnapshot(folder);
    for (const { snapshot } of sources) {
      for (const [path, value] of Object.entries(snapshot.entries)) current.entries[path] = newer(current.entries[path], value);
    }
    await this.writeSnapshot(named, current);
    for (const { file } of sources) if (file !== named) await this.adapter.remove(file);
  }

  private async readOwnSnapshot(folder = this.folder): Promise<EncounterSnapshot> {
    const file = this.snapshotPath(folder);
    if (await this.adapter.exists(file)) return this.readSnapshot(file);
    return { schema: 2, deviceId: this.deviceId, entries: {} };
  }

  private async migrateLegacyEvents(folder = this.folder): Promise<void> {
    const legacyFolder = `${folder}/${this.deviceId}`;
    if (!(await this.adapter.exists(legacyFolder))) return;
    const root = await this.adapter.list(legacyFolder);
    const files = root.files.filter((file) => LEGACY_EVENT_FILE.test(file.slice(file.lastIndexOf("/") + 1)));
    if (!files.length) return;
    const snapshot = await this.readOwnSnapshot(folder);
    for (const file of files) {
      for (const line of (await this.adapter.read(file)).split("\n")) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line) as LegacyEncounterEvent;
          if (typeof event.path !== "string" || !event.path || typeof event.kind !== "string" || !ACTIVE_KINDS.has(event.kind) || typeof event.day !== "string" || !DAY.test(event.day) || typeof event.at !== "number" || !Number.isSafeInteger(event.at) || event.at <= 0) continue;
          const mutation: EncounterMutation = { path: event.path, changedAt: event.at, encounteredAt: event.at, day: event.day };
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

  private async snapshots(folder = this.folder): Promise<EncounterSnapshotFile[]> {
    if (!(await this.adapter.exists(folder))) return [];
    const root = await this.adapter.list(folder);
    const output: EncounterSnapshotFile[] = [];
    for (const file of root.files.filter((name) => this.snapshotName(name))) {
      try {
        output.push({ name: file.slice(file.lastIndexOf("/") + 1), snapshot: await this.readSnapshot(file) });
      } catch (error) {
        console.warn(`[Lexis] Ignoring unreadable encounter snapshot ${file}`, error);
      }
    }
    return output;
  }

  async load(): Promise<EncounterTotals> {
    await this.migrateOwnSnapshotName();
    await this.migrateLegacyEvents();
    const latest: Record<string, EncounterMutation> = {};
    for (const { snapshot } of await this.snapshots()) {
      for (const [path, value] of Object.entries(snapshot.entries)) latest[path] = newer(latest[path], value);
    }
    const totals: EncounterTotals = {};
    for (const [path, value] of Object.entries(latest)) {
      if (!value.deleted) totals[path] = { lastEncounter: value.day, encounteredAt: value.encounteredAt };
    }
    return totals;
  }

  async apply(mutations: EncounterMutation[]): Promise<void> {
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

  async copyTo(folder: string): Promise<void> {
    if (folder === this.folder || !(await this.adapter.exists(this.folder))) return;
    await this.migrateOwnSnapshotName();
    await this.migrateLegacyEvents();
    await ensureDirectory(this.adapter, folder);
    await this.migrateOwnSnapshotName(folder);
    await this.migrateLegacyEvents(folder);
    const destination = await this.adapter.list(folder);
    const unrelated = destination.files.find((file) => !this.snapshotName(file) && !file.endsWith("/.DS_Store"));
    if (unrelated || destination.folders.length) throw new Error("Choose an empty folder dedicated to Lexis encounter records.");
    for (const { name, snapshot } of await this.snapshots()) {
      const target = `${folder}/${name}`;
      if (!(await this.adapter.exists(target))) {
        await this.writeSnapshot(target, snapshot);
        continue;
      }
      const current = await this.readSnapshot(target);
      for (const [path, value] of Object.entries(snapshot.entries)) current.entries[path] = newer(current.entries[path], value);
      await this.writeSnapshot(target, current);
    }
  }

  async removeOwn(): Promise<void> {
    if (!(await this.adapter.exists(this.folder))) return;
    const root = await this.adapter.list(this.folder);
    for (const file of root.files) {
      const name = file.slice(file.lastIndexOf("/") + 1);
      if (name === `${this.deviceId}.json` || name.endsWith(`--${this.deviceId}.json`)) await this.adapter.remove(file);
      else if (SHORT_NAMED_SNAPSHOT.test(name)) {
        try { if ((await this.readSnapshot(file)).deviceId === this.deviceId) await this.adapter.remove(file); }
        catch { /* An unreadable file is not safe to remove. */ }
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
}
