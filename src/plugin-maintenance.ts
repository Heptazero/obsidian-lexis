import { Platform, requestUrl, requireApiVersion, type App, type PluginManifest } from "obsidian";

const REPOSITORY = "Heptazero/obsidian-lexis";
const ASSETS = ["main.js", "styles.css", "manifest.json"] as const;
type Asset = typeof ASSETS[number];
interface PluginLoader {
  unloadPlugin(id: string): Promise<void>;
  loadPlugin(id: string): Promise<{ manifest: PluginManifest } | null>;
  loadManifest(dir: string): Promise<void>;
}
export interface MaintenanceHost {
  app: App;
  manifest: PluginManifest;
  prepareReload(): Promise<void>;
}
export interface PluginUpdate {
  version: string;
  tag: string;
  manifest: PluginManifest;
  urls: Record<Asset, string>;
}
export class MaintenanceError extends Error {
  constructor(readonly key: string) { super(key); }
}

export function comparePluginVersions(left: string, right: string): number {
  const parse = (value: string) => {
    if (!/^\d+\.\d+\.\d+$/.test(value)) throw new MaintenanceError("maintenance.invalidRelease");
    return value.split(".").map(Number);
  };
  const a = parse(left), b = parse(right);
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

async function remoteText(url: string): Promise<string> {
  let timer: number;
  try {
    return await Promise.race([
      requestUrl({ url, throw: false, headers: { "User-Agent": "Lexis" } }).then((response) => {
        if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
        return response.text;
      }),
      new Promise<never>((_, reject) => { timer = window.setTimeout(() => reject(new MaintenanceError("maintenance.timeout")), 15000); }),
    ]);
  } finally { window.clearTimeout(timer); }
}

/** Explicit maintenance only. No background checks, source checkout writes or data migrations. */
export class PluginMaintenance {
  constructor(private host: MaintenanceHost, private readText = remoteText) {}

  private loader(): PluginLoader {
    const manager = (this.host.app as App & { plugins?: PluginLoader }).plugins;
    if (!manager?.unloadPlugin || !manager.loadPlugin || !manager.loadManifest) throw new MaintenanceError("maintenance.unsupported");
    return manager;
  }

  private installedDirectory(): string {
    const expected = `${this.host.app.vault.configDir}/plugins/${this.host.manifest.id}`;
    if (!this.host.manifest.dir || this.host.manifest.dir !== expected) throw new MaintenanceError("maintenance.development");
    return expected;
  }

  private reopenSettings(): void {
    (this.host.app as App & { setting?: { openTabById(id: string): void } }).setting?.openTabById(this.host.manifest.id);
  }

  async reload(): Promise<void> {
    const loader = this.loader();
    await this.host.prepareReload();
    await loader.unloadPlugin(this.host.manifest.id);
    if (!await loader.loadPlugin(this.host.manifest.id)) throw new MaintenanceError("maintenance.loadFailed");
    this.reopenSettings();
  }

  async check(): Promise<PluginUpdate | null> {
    const release = JSON.parse(await this.readText(`https://api.github.com/repos/${REPOSITORY}/releases/latest`)) as {
      tag_name: string; draft: boolean; prerelease: boolean; assets: Array<{ name: string }>;
    };
    if (release.draft || release.prerelease || typeof release.tag_name !== "string" || !/^v?\d+\.\d+\.\d+$/.test(release.tag_name)
      || !Array.isArray(release.assets) || !ASSETS.every((name) => release.assets.some((asset) => asset.name === name))) throw new MaintenanceError("maintenance.invalidRelease");
    if (comparePluginVersions(release.tag_name.replace(/^v/, ""), this.host.manifest.version) <= 0) return null;
    const base = `https://github.com/${REPOSITORY}/releases/download/${encodeURIComponent(release.tag_name)}`;
    const urls = { "main.js": `${base}/main.js`, "styles.css": `${base}/styles.css`, "manifest.json": `${base}/manifest.json` };
    const manifest = JSON.parse(await this.readText(urls["manifest.json"])) as PluginManifest;
    if (manifest.id !== this.host.manifest.id || manifest.version !== release.tag_name.replace(/^v/, "") || !manifest.minAppVersion) throw new MaintenanceError("maintenance.invalidRelease");
    if (!requireApiVersion(manifest.minAppVersion) || (manifest.isDesktopOnly && Platform.isMobileApp)) throw new MaintenanceError("maintenance.incompatible");
    return { version: manifest.version, tag: release.tag_name, manifest, urls };
  }

  async install(update: PluginUpdate): Promise<void> {
    const directory = this.installedDirectory(), loader = this.loader(), adapter = this.host.app.vault.adapter;
    const downloaded = new Map<Asset, string>(await Promise.all(ASSETS.map(async (name) => [name, await this.readText(update.urls[name])] as const)));
    const manifest = JSON.parse(downloaded.get("manifest.json")) as PluginManifest;
    if (manifest.id !== this.host.manifest.id || manifest.version !== update.version || !manifest.minAppVersion || !downloaded.get("main.js").trim()) throw new MaintenanceError("maintenance.invalidRelease");
    if (!requireApiVersion(manifest.minAppVersion) || (manifest.isDesktopOnly && Platform.isMobileApp)) throw new MaintenanceError("maintenance.incompatible");
    const previous = new Map<Asset, string | null>();
    for (const name of ASSETS) {
      const path = `${directory}/${name}`;
      previous.set(name, await adapter.exists(path) ? await adapter.read(path) : null);
    }
    await this.host.prepareReload();
    await loader.unloadPlugin(this.host.manifest.id);
    try {
      for (const name of ASSETS) await adapter.write(`${directory}/${name}`, downloaded.get(name));
      await loader.loadManifest(directory);
      const plugin = await loader.loadPlugin(this.host.manifest.id);
      if (!plugin || plugin.manifest.version !== update.version) throw new MaintenanceError("maintenance.loadFailed");
    } catch (error) {
      // Backups exist only in this operation's memory and only cover the three code assets.
      try {
        try { await loader.unloadPlugin(this.host.manifest.id); }
        catch { /* A failed onload can also fail to unload. Still restore disk assets. */ }
        for (const [name, text] of previous) {
          const path = `${directory}/${name}`;
          if (text != null) await adapter.write(path, text);
          else if (await adapter.exists(path)) await adapter.remove(path);
        }
        await loader.loadManifest(directory);
        const restored = await loader.loadPlugin(this.host.manifest.id);
        if (!restored || restored.manifest.version !== this.host.manifest.version) throw new MaintenanceError("maintenance.loadFailed");
        this.reopenSettings();
      } catch { throw new MaintenanceError("maintenance.restoreFailed"); }
      throw error;
    }
    this.reopenSettings();
  }
}
