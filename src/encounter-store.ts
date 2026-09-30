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

export type EncounterTotals = Record<string, EncounterSummary>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DEVICE = /^[a-f0-9]{32}$/;
const DEVICE_LABEL = /^[a-z][a-z0-9-]{0,31}$/;
const LEGACY_SNAPSHOT = /^([a-f0-9]{32})\.json$/;
const NAMED_SNAPSHOT = /^([a-z][a-z0-9-]{0,31})--([a-f0-9]{8})\.json$/;

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
    return `${folder}/${deviceLabel}--${deviceId.slice(0, 8)}.json`;
  }

  private legacySnapshotPath(folder = this.folder, deviceId = this.deviceId): string {
    return `${folder}/${deviceId}.json`;
  }

  private snapshotName(file: string): string | null {
    const name = file.slice(file.lastIndexOf("/") + 1);
    return LEGACY_SNAPSHOT.test(name) || NAMED_SNAPSHOT.test(name) ? name : null;
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
    const shortId = name?.match(NAMED_SNAPSHOT)?.[2];
    if (!name || (legacyId && legacyId !== snapshot.deviceId) || (shortId && !snapshot.deviceId.startsWith(shortId))) {
      throw new Error(`Invalid Lexis encounter snapshot name: ${file}`);
    }
    return { schema: 2, deviceId: snapshot.deviceId, entries };
  }

  private async migrateOwnSnapshotName(folder = this.folder): Promise<void> {
    const legacy = this.legacySnapshotPath(folder);
    if (!(await this.adapter.exists(legacy))) return;
    const named = this.snapshotPath(folder);
    const snapshot = await this.readSnapshot(legacy);
    if (await this.adapter.exists(named)) {
      const current = await this.readSnapshot(named);
      for (const [path, value] of Object.entries(snapshot.entries)) current.entries[path] = newer(current.entries[path], value);
      await this.adapter.write(named, JSON.stringify(current));
    } else {
      await this.adapter.write(named, JSON.stringify(snapshot));
    }
    await this.adapter.remove(legacy);
  }

  private async snapshots(folder = this.folder): Promise<EncounterSnapshotFile[]> {
    if (!(await this.adapter.exists(folder))) return [];
    const root = await this.adapter.list(folder);
    const output: EncounterSnapshotFile[] = [];
    for (const file of root.files.filter((name) => this.snapshotName(name))) {
      output.push({ name: file.slice(file.lastIndexOf("/") + 1), snapshot: await this.readSnapshot(file) });
    }
    return output;
  }

  async load(): Promise<EncounterTotals> {
    await this.migrateOwnSnapshotName();
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
    const file = this.snapshotPath();
    let entries: Record<string, EncounterMutation> = {};
    if (await this.adapter.exists(file)) entries = (await this.readSnapshot(file)).entries;
    for (const mutation of mutations) {
      if (!validMutation(mutation)) throw new Error("Invalid encounter mutation");
      entries[mutation.path] = newer(entries[mutation.path], mutation);
    }
    const snapshot: EncounterSnapshot = { schema: 2, deviceId: this.deviceId, entries };
    await this.adapter.write(file, JSON.stringify(snapshot));
  }

  async copyTo(folder: string): Promise<void> {
    if (folder === this.folder || !(await this.adapter.exists(this.folder))) return;
    await this.migrateOwnSnapshotName();
    await ensureDirectory(this.adapter, folder);
    await this.migrateOwnSnapshotName(folder);
    const destination = await this.adapter.list(folder);
    const unrelated = destination.files.find((file) => !this.snapshotName(file) && !file.endsWith("/.DS_Store"));
    if (unrelated || destination.folders.length) throw new Error("Choose an empty folder dedicated to Lexis encounter records.");
    for (const { name, snapshot } of await this.snapshots()) {
      const target = `${folder}/${name}`;
      if (!(await this.adapter.exists(target))) {
        await this.adapter.write(target, JSON.stringify(snapshot));
        continue;
      }
      const current = await this.readSnapshot(target);
      for (const [path, value] of Object.entries(snapshot.entries)) current.entries[path] = newer(current.entries[path], value);
      await this.adapter.write(target, JSON.stringify(current));
    }
  }

  async clear(): Promise<void> {
    if (!(await this.adapter.exists(this.folder))) return;
    const root = await this.adapter.list(this.folder);
    const unrelated = root.files.find((file) => !this.snapshotName(file) && !file.endsWith("/.DS_Store"));
    if (unrelated || root.folders.length) throw new Error("Encounter folder contains unrelated data and was not removed.");
    for (const file of root.files) await this.adapter.remove(file);
    await this.adapter.rmdir(this.folder, false);
  }
}
