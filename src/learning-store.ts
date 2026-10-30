import type { DataAdapter } from "obsidian";
import { copy, entryDay, entryParts, equal, flattenLearning, inflateLearning, pruneLearning, record, retentionDays, validateLearningValue, type DataEntries, type LearningData } from "./learning-data";
import { addDays, localDate } from "./review-log-data";

interface Mutation { at: number; value?: unknown; deleted?: true; day?: string }
interface Snapshot { schema: 1; device: string; entries: Record<string, Mutation> }
const FILE = /^(state|day-(\d{4}-\d{2}-\d{2}))--[a-z][a-z0-9-]{0,31}--([a-f0-9]{32})\.json$/;

export async function ensureDataDirectory(adapter: DataAdapter, folder: string): Promise<void> {
  let path = "";
  for (const part of folder.split("/")) {
    path = path ? `${path}/${part}` : part;
    if (!(await adapter.exists(path))) await adapter.mkdir(path);
  }
}

/** Latest per-record state plus bounded daily history. Each device writes only its own files. */
export class LearningStore {
  private seen: DataEntries = {};
  private own: Record<string, Mutation> = {};
  private pending: Record<string, Mutation> = {};
  private queue: Promise<unknown> = Promise.resolve();
  private clock = 0;
  private days: number | null = 90;
  private ready = false;
  private cache = new Map<string, { text: string; snapshot: Snapshot; stamp: string }>();
  readonly directory: string;
  constructor(private readonly adapter: DataAdapter, readonly folder: string, readonly device: string, readonly label: string,
    private readonly now = () => Date.now()) {
    if (!/^[a-f0-9]{32}$/.test(device) || !/^[a-z][a-z0-9-]{0,31}$/.test(label)) throw new Error("Invalid learning device identity");
    this.directory = `${folder}/reviews`;
  }
  private path(kind: string): string { return `${this.directory}/${kind}--${this.label}--${this.device}.json`; }
  private marker(): string { return `${this.directory}/storage.json`; }
  isDataPath(path: string): boolean { return path === this.directory || path.startsWith(`${this.directory}/`); }
  invalidate(path: string): void { this.cache.delete(path); }

  private async checkMarker(required: boolean): Promise<boolean> {
    if (!(await this.adapter.exists(this.marker()))) {
      if (required) throw new Error("Lexis learning data is missing or moving. Sync the data folder, then reload Lexis.");
      return false;
    }
    const marker: unknown = JSON.parse(await this.adapter.read(this.marker()));
    if (!record(marker) || marker.schema !== 1) throw new Error("Unsupported Lexis learning storage. Update Lexis; do not downgrade.");
    return true;
  }

  private async read(path: string): Promise<Snapshot> {
    const stat = await this.adapter.stat(path), stamp = `${stat?.mtime}:${stat?.size}`;
    const cached = this.cache.get(path);
    if (stat && cached?.stamp === stamp) return cached.snapshot;
    const text = await this.adapter.read(path), raw: unknown = JSON.parse(text), name = path.split("/").pop()?.match(FILE);
    if (!name || !record(raw) || raw.schema !== 1 || raw.device !== name[3] || !record(raw.entries)) throw new Error(`Invalid or unsupported Lexis learning data: ${path}`);
    const entries: Record<string, Mutation> = {};
    for (const [key, item] of Object.entries(raw.entries)) {
      entryParts(key);
      if (!record(item) || !Number.isSafeInteger(item.at) || Number(item.at) < 1 || (item.deleted !== true && !("value" in item))
        || (!item.deleted && !validateLearningValue(key, item.value))
        || (name[1] === "state" ? !!item.day || !!entryDay(key, item.value) : item.day !== name[2] || (!item.deleted && entryDay(key, item.value) !== name[2]))) throw new Error(`Invalid Lexis learning record: ${path}`);
      entries[key] = item as unknown as Mutation;
    }
    const snapshot: Snapshot = { schema: 1, device: raw.device, entries };
    this.cache.set(path, { text, snapshot, stamp });
    return snapshot;
  }

  private trim(entries: Record<string, Mutation>): Record<string, Mutation> {
    if (this.days === null) return entries;
    const cutoff = addDays(localDate(new Date(this.now())), 1 - this.days), result: Record<string, Mutation> = {};
    for (const [key, mutation] of Object.entries(entries)) {
      if (mutation.day && mutation.day < cutoff) continue;
      result[key] = mutation;
    }
    return result;
  }

  private async aggregate(): Promise<{ data: LearningData; count: number }> {
    if (!(await this.adapter.exists(this.directory))) return { data: inflateLearning({}), count: 0 };
    const root = await this.adapter.list(this.directory), merged: Record<string, { mutation: Mutation; device: string }> = {};
    let count = 0;
    const paths = root.files.filter(path => FILE.test(path.split("/").pop() || "")).sort();
    for (let offset = 0; offset < paths.length; offset += 16) for (const { path, snapshot } of await Promise.all(paths.slice(offset, offset + 16).map(async path => ({ path, snapshot: await this.read(path) })))) {
      const day = path.split("/").pop()?.match(FILE)?.[2];
      if (this.days !== null && day && day < addDays(localDate(new Date(this.now())), 1 - this.days)) {
        // A closed, expired day is never written again by this schema. Validate before deleting.
        await this.adapter.remove(path); this.cache.delete(path); continue;
      }
      if (!day) count++;
      for (const mutation of Object.values(snapshot.entries)) this.clock = Math.max(this.clock, mutation.at);
      if (snapshot.device === this.device) for (const [key, mutation] of Object.entries(this.trim(snapshot.entries))) {
        if (!this.own[key] || mutation.at >= this.own[key].at) this.own[key] = mutation;
      }
      for (const [key, mutation] of Object.entries(this.trim(snapshot.entries))) {
        const before = merged[key];
        if (!before || mutation.at > before.mutation.at || mutation.at === before.mutation.at && snapshot.device > before.device) merged[key] = { mutation, device: snapshot.device };
      }
    }
    // Sync can deliver an older copy of our own file. Never downgrade state already read here.
    for (const [key, mutation] of Object.entries(this.trim(this.own))) {
      const before = merged[key];
      if (!before || mutation.at > before.mutation.at || mutation.at === before.mutation.at && this.device > before.device) merged[key] = { mutation, device: this.device };
    }
    const values: DataEntries = {};
    for (const [key, { mutation }] of Object.entries(merged)) if (!mutation.deleted) values[key] = mutation.value;
    const data = pruneLearning(inflateLearning(values), this.days, localDate(new Date(this.now())));
    const counts: Record<string, number> = {};
    for (const event of data.reviewEvents) counts[event.date] = (counts[event.date] || 0) + 1;
    for (const [day, total] of Object.entries(counts)) data.reviewLog[day] = Math.max(data.reviewLog[day] || 0, total);
    return { data, count };
  }

  async initialize(seed: LearningData, days: number | null, required = false): Promise<LearningData> {
    this.days = days === null ? null : retentionDays(days);
    const hasMarker = await this.checkMarker(required);
    const loaded = await this.aggregate();
    if (hasMarker && !loaded.count) throw new Error("Lexis learning snapshots are missing. Wait for synchronization.");
    if (hasMarker) {
      this.seen = flattenLearning(loaded.data);
      this.ready = true;
      return loaded.data;
    }
    // One-time conversion only. A marker prevents stale data.json files from re-importing old state.
    const migrated = await this.save(pruneLearning(seed, this.days, localDate(new Date(this.now()))), days);
    await this.adapter.write(this.marker(), JSON.stringify({ schema: 1 }));
    this.ready = true;
    return migrated;
  }

  save(data: LearningData, days: number | null): Promise<LearningData> {
    this.days = days === null ? null : retentionDays(days);
    const current = flattenLearning(pruneLearning(data, this.days, localDate(new Date(this.now()))));
    for (const key of new Set([...Object.keys(this.seen), ...Object.keys(current)])) {
      if (equal(this.seen[key], current[key])) continue;
      const value = current[key], old = this.seen[key];
      const event = value ?? old;
      const day = entryDay(key, event);
      this.pending[key] = { at: this.clock = Math.max(this.now(), this.clock + 1), ...(value === undefined ? { deleted: true as const } : { value: copy(value) }), ...(day ? { day } : {}) };
    }
    this.seen = current;
    const run = this.queue.catch((): void => {}).then(async () => {
      if (this.ready) await this.checkMarker(true);
      await this.aggregate();
      const batch = { ...this.pending };
      Object.assign(this.own, batch); this.own = this.trim(this.own);
      await ensureDataDirectory(this.adapter, this.directory);
      const groups = new Map<string, Record<string, Mutation>>([["state", {}]]);
      for (const [key, mutation] of Object.entries(this.own)) {
        const kind = mutation.day ? `day-${mutation.day}` : "state";
        if (!groups.has(kind)) groups.set(kind, {});
        groups.get(kind)[key] = mutation;
      }
      for (const [kind, entries] of groups) {
        const path = this.path(kind), text = JSON.stringify({ schema: 1, device: this.device, entries });
        if (this.cache.get(path)?.text === text) continue;
        if (await this.adapter.exists(path)) await this.adapter.process(path, () => text);
        else await this.adapter.write(path, text);
        // Verify before considering data durable or removing the legacy fields.
        if (await this.adapter.read(path) !== text) throw new Error("Lexis learning data verification failed");
        this.cache.delete(path);
      }
      for (const [key, mutation] of Object.entries(batch)) if (this.pending[key] === mutation) delete this.pending[key];
      return (await this.aggregate()).data;
    });
    this.queue = run;
    return run;
  }

  /** Incorporate synced records without swallowing edits made during an awaited write. */
  rebase(current: LearningData, before: LearningData, merged: LearningData): LearningData {
    const values = flattenLearning(current), expected = flattenLearning(before), remote = flattenLearning(merged);
    for (const key of new Set([...Object.keys(expected), ...Object.keys(remote)])) {
      if (equal(values[key], expected[key])) {
        if (key in remote) values[key] = remote[key]; else delete values[key];
      }
      if (equal(this.seen[key], expected[key])) {
        if (key in remote) this.seen[key] = copy(remote[key]); else delete this.seen[key];
      }
    }
    return inflateLearning(values);
  }

  async flush(): Promise<void> { await this.queue; }
  async copyTo(target: LearningStore, created = new Map<string, string>()): Promise<string[]> {
    await this.flush();
    if (await this.adapter.exists(target.directory)) {
      const root = await this.adapter.list(target.directory);
      if (root.files.length || root.folders.length) throw new Error("Choose an empty destination for learning data.");
    }
    await ensureDataDirectory(this.adapter, target.directory);
    const files = (await this.adapter.list(this.directory)).files.filter(path => FILE.test(path.split("/").pop() || "") || path === this.marker());
    for (const path of files) {
      const text = await this.adapter.read(path), destination = `${target.directory}/${path.split("/").pop()}`;
      created.set(destination, text);
      await this.adapter.write(destination, text);
      if (await this.adapter.read(destination) !== text) throw new Error("Learning data move verification failed");
    }
    return files;
  }
}
