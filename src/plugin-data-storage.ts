import { Notice, Platform, type App, type PluginManifest } from "obsidian";
import { EncounterStore, encounterSnapshotName } from "./encounter-store";
import { dataFolder } from "./data-folder";
import { LEARNING_FIELDS, learningData, record, retentionDays, settingsOnly } from "./learning-data";
import { LearningStore } from "./learning-store";
import type { LexisSettings } from "./types";

interface StorageHost {
  app: App;
  manifest: PluginManifest;
  settings: LexisSettings;
  saveData(settings: Partial<LexisSettings>): Promise<void>;
  loadData(): Promise<unknown>;
}

export function learningDevice(app: App): { id: string; label: string } {
  let id = app.loadLocalStorage("lexis:encounter-device-id") as string | null;
  if (!id || !/^[a-f0-9]{32}$/.test(id)) {
    id = crypto.randomUUID().replaceAll("-", ""); app.saveLocalStorage("lexis:encounter-device-id", id);
  }
  const label = Platform.isIosApp ? "ios" : Platform.isAndroidApp ? "android" : Platform.isWin ? "windows"
    : Platform.isLinux ? "linux" : Platform.isMacOS ? "macos" : Platform.isMobile ? "mobile" : "desktop";
  return { id, label };
}

export class PluginDataStorage {
  store: LearningStore;
  readonly device: { id: string; label: string };
  private config = "";
  private queue: Promise<void> = Promise.resolve();
  relocating = false;
  private blockedReason = "";
  constructor(private readonly host: StorageHost) { this.device = learningDevice(host.app); }

  private async validateRoot(folder: string, empty = false): Promise<void> {
    const io = this.host.app.vault.adapter;
    if (!(await io.exists(folder))) return;
    const root = await io.list(folder);
    if (root.files.some(path => !path.endsWith("/.DS_Store") && (empty || !encounterSnapshotName(path))) || root.folders.some(path => empty || path !== `${folder}/reviews`)) {
      throw new Error("Choose a dedicated Lexis data folder, not a notes folder or another plugin's folder.");
    }
  }

  private retention(): number | null { return this.host.settings.reviewRetentionConfirmed ? this.host.settings.reviewEventsRetentionDays : null; }

  async initialize(legacy: { encounterFolder?: string; learningStorageVersion?: number; reviewRetentionConfirmed?: boolean }): Promise<void> {
    const s = this.host.settings;
    if (legacy.learningStorageVersion != null && legacy.learningStorageVersion !== 1) throw new Error("Unsupported Lexis data format. Update Lexis; do not downgrade.");
    const oldFolder = legacy.encounterFolder || `${this.host.app.vault.configDir}/plugins/${this.host.manifest.id}/encounters`;
    s.dataFolder = dataFolder(s.dataFolder || (oldFolder.split("/").some(part => part.startsWith(".")) ? "" : oldFolder));
    await this.validateRoot(s.dataFolder);
    s.reviewEventsRetentionDays = retentionDays(s.reviewEventsRetentionDays);
    const seed = learningData(s);
    const hasLearning = legacy.learningStorageVersion === 1 || Object.values(seed).some(value => value === true || !!value && typeof value === "object" && Object.keys(value).length > 0);
    s.reviewRetentionConfirmed = legacy.reviewRetentionConfirmed === true || !hasLearning;
    this.store = new LearningStore(this.host.app.vault.adapter, s.dataFolder, this.device.id, this.device.label);
    const loaded = await this.store.initialize(seed, this.retention(), legacy.learningStorageVersion === 1);
    Object.assign(s, loaded);
    // Encounter state shares the visible root. Only recognized, verified snapshots may be moved.
    let previous: EncounterStore | null = null;
    if (oldFolder !== s.dataFolder && await this.host.app.vault.adapter.exists(oldFolder)) {
      previous = new EncounterStore(this.host.app.vault.adapter, oldFolder, this.device.id, this.device.label);
      await previous.copyTo(s.dataFolder);
    }
    s.learningStorageVersion = 1;
    await this.save();
    // The pointer and migrated learning files are durable before removing old encounter snapshots.
    if (previous) await previous.removeCopiedTo(s.dataFolder);
    delete (s as unknown as Record<string, unknown>).encounterFolder;
  }

  save(): Promise<void> {
    if (this.blockedReason) return Promise.reject(new Error(this.blockedReason));
    if (this.relocating) return Promise.reject(new Error("Learning data is moving. Try again when it finishes."));
    const before = learningData(this.host.settings);
    const persisted = this.store.save(before, this.retention());
    // A configuration write may hold the queue while the next disk operation fails.
    // Mark that rejection handled now; the queued task still rethrows it to its caller.
    void persisted.catch((): void => {});
    const task = this.queue.catch((): void => {}).then(async () => {
      const merged = await persisted;
      Object.assign(this.host.settings, this.store.rebase(learningData(this.host.settings), before, merged));
      const config = settingsOnly(this.host.settings), serialized = JSON.stringify(config);
      if (serialized !== this.config) { await this.host.saveData(config); this.config = serialized; }
    });
    this.queue = task;
    return task;
  }

  async flush(): Promise<void> { await this.queue; await this.store.flush(); }
  async refresh(): Promise<void> { if (!this.relocating) await this.save(); }
  isDataPath(path: string): boolean { return this.store?.isDataPath(path) || false; }
  invalidate(path: string): void { this.store.invalidate(path); }

  async externalSettingsChanged(): Promise<void> {
    const incoming = await this.host.loadData();
    if (!record(incoming)) throw new Error("Invalid synced Lexis configuration; current learning data was retained.");
    if (incoming.learningStorageVersion == null) {
      // An old client rewrote data.json. Never import its obsolete learning fields again.
      this.config = ""; await this.save();
      new Notice(this.host.settings.language === "en" ? "Lexis: an old client wrote legacy data. Update Lexis on all devices."
        : "Lexis：检测到旧版设备写回数据，已忽略旧学习记录。请统一更新各设备。");
      return;
    }
    if (incoming.learningStorageVersion !== 1) {
      this.blockedReason = "Lexis data requires a newer plugin. Update Lexis on this device.";
      throw new Error(this.blockedReason);
    }
    if (dataFolder(typeof incoming.dataFolder === "string" ? incoming.dataFolder : "") !== this.store.folder) {
      this.blockedReason = this.host.settings.language === "en" ? "Lexis data folder changed on another device. Finish syncing, then reload Lexis."
        : "Lexis 数据目录已在另一台设备更改。请等待同步完成，再重新加载插件。";
      throw new Error(this.blockedReason);
    }
    Object.assign(this.host.settings, settingsOnly(incoming as Partial<LexisSettings>));
    this.host.settings.reviewEventsRetentionDays = retentionDays(incoming.reviewEventsRetentionDays);
    this.config = LEARNING_FIELDS.some(field => field in incoming) ? "" : JSON.stringify(settingsOnly(this.host.settings));
    await this.save();
  }

  async move(folder: string, encounters: EncounterStore): Promise<EncounterStore> {
    const target = dataFolder(folder);
    if (target === this.store.folder) return encounters;
    if (target.startsWith(`${this.store.folder}/`) || this.store.folder.startsWith(`${target}/`)) throw new Error("The old and new data folders cannot contain each other.");
    await this.save(); await this.flush(); this.relocating = true;
    const io = this.host.app.vault.adapter, previous = this.store, oldFolder = this.host.settings.dataFolder;
    const created = new Map<string, string>();
    try {
      await this.validateRoot(target, true);
      const next = new LearningStore(io, target, this.device.id, this.device.label);
      await encounters.copyTo(target, created);
      const copied = await previous.copyTo(next, created);
      await next.initialize(learningData(this.host.settings), this.retention(), true);
      this.host.settings.dataFolder = target;
      await this.host.saveData(settingsOnly(this.host.settings));
      this.config = JSON.stringify(settingsOnly(this.host.settings));
      this.store = next;
      // Only exact copied files are removed; no recursive deletion and no unrelated content.
      try {
        for (const path of copied) {
          const destination = `${next.directory}/${path.split("/").pop()}`;
          if (await io.read(path) !== await io.read(destination)) throw new Error("Source changed during the move; retained for safety");
          await io.remove(path);
        }
        if (!(await io.list(previous.directory)).files.length && !(await io.list(previous.directory)).folders.length) await io.rmdir(previous.directory, false);
        await encounters.removeCopiedTo(target);
      } catch (error) {
        new Notice(`Lexis: data moved, but source cleanup is incomplete: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
      return new EncounterStore(io, target, this.device.id, this.device.label);
    } catch (error) {
      if (this.store === previous) {
        this.host.settings.dataFolder = oldFolder;
        // Roll back only files this operation created and whose content has not changed.
        for (const [path, text] of created) if (await io.exists(path) && await io.read(path) === text) await io.remove(path);
        for (const folder of [`${target}/reviews`, target]) if (await io.exists(folder)) {
          const root = await io.list(folder);
          if (!root.files.length && !root.folders.length) await io.rmdir(folder, false);
        }
      }
      throw error;
    } finally { this.relocating = false; }
  }
}

