import type { App, Plugin, View } from "obsidian";
import type { LexisEntry, LexisSettings } from "./types";

interface SceneElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  text?: string;
  originalText?: string;
  version?: number;
  isDeleted?: boolean;
}

interface SceneState {
  offsetLeft: number;
  offsetTop: number;
  scrollX: number;
  scrollY: number;
  zoom: { value: number };
  viewModeEnabled?: boolean;
}

interface SceneApi {
  getAppState(): SceneState;
  getSceneElements(): readonly SceneElement[];
}

interface ExcalidrawAutomate {
  getExcalidrawAPI(): SceneApi | null;
}

interface ExcalidrawPluginApi {
  ea?: {
    getAPI(view: View): ExcalidrawAutomate;
  };
}

interface ExcalidrawView extends View {
  excalidrawAPI?: SceneApi | null;
}

interface LegacyExcalidrawPluginApi {
  getAPI(view: View): ExcalidrawAutomate;
}

interface AppWithPlugins extends App {
  plugins?: {
    getPlugin?(id: string): unknown;
    plugins?: Record<string, unknown>;
  };
}

interface ExcalidrawLib {
  sceneCoordsToViewportCoords?: (
    point: { sceneX: number; sceneY: number },
    state: SceneState,
  ) => { x: number; y: number };
}

interface ExcalidrawWindow extends Window {
  ExcalidrawLib?: ExcalidrawLib;
}

interface HighlightBox {
  left: number;
  top: number;
  width: number;
  height: number;
  angle: number;
}

interface HighlightAnchor {
  element: HTMLElement;
  box: HighlightBox;
}

interface CachedMatch {
  version: number | undefined;
  text: string;
  match: { key: string; entry: LexisEntry } | null;
}

interface ViewState {
  root: HTMLElement;
  mount: HTMLElement;
  layer: HTMLElement;
  anchors: HighlightAnchor[];
  api: SceneApi | null;
  matchCache: Map<string, CachedMatch>;
  indexBuildId: number;
  signature: string;
}

export interface ExcalidrawHighlightHost extends Plugin {
  settings: LexisSettings;
  index: Map<string, LexisEntry>;
  _pattern: string | null;
  _indexBuildId: number;
  resolveMatchKey(value: string): string;
  inlineStyleForEntry(entry: LexisEntry | undefined, options?: { external?: boolean }): string;
}

export function firstExcalidrawMatch(
  text: string,
  pattern: string | null,
  resolveKey: (value: string) => string,
  index: Map<string, LexisEntry>,
): { key: string; entry: LexisEntry } | null {
  if (!text || !pattern) return null;
  const match = new RegExp(pattern, "i").exec(text);
  if (!match) return null;
  const key = resolveKey(match[0]);
  const entry = index.get(key);
  return entry ? { key, entry } : null;
}

function fallbackSceneToViewport(point: { sceneX: number; sceneY: number }, state: SceneState): { x: number; y: number } {
  const zoom = Number(state.zoom?.value) || 1;
  return {
    x: (point.sceneX + state.scrollX) * zoom + state.offsetLeft,
    y: (point.sceneY + state.scrollY) * zoom + state.offsetTop,
  };
}

export function sceneElementBox(
  element: SceneElement,
  state: SceneState,
  convert = fallbackSceneToViewport,
): HighlightBox {
  const start = convert({ sceneX: element.x, sceneY: element.y }, state);
  const end = convert({ sceneX: element.x + element.width, sceneY: element.y + element.height }, state);
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
    angle: Number(element.angle) || 0,
  };
}

export function pointInHighlightBox(x: number, y: number, box: HighlightBox): boolean {
  const centerX = box.left + box.width / 2;
  const centerY = box.top + box.height / 2;
  const cosine = Math.cos(-box.angle);
  const sine = Math.sin(-box.angle);
  const deltaX = x - centerX;
  const deltaY = y - centerY;
  const localX = deltaX * cosine - deltaY * sine;
  const localY = deltaX * sine + deltaY * cosine;
  return Math.abs(localX) <= box.width / 2 && Math.abs(localY) <= box.height / 2;
}

export function sceneApiForView(
  view: ExcalidrawView,
  plugin: ExcalidrawPluginApi | LegacyExcalidrawPluginApi | null,
): SceneApi | null {
  if (view.excalidrawAPI) return view.excalidrawAPI;
  if (plugin && "ea" in plugin && plugin.ea) return plugin.ea.getAPI(view)?.getExcalidrawAPI?.() || null;
  if (plugin && "getAPI" in plugin) return plugin.getAPI(view)?.getExcalidrawAPI?.() || null;
  return null;
}

export class ExcalidrawHighlights {
  private readonly views = new Map<View, ViewState>();
  private timer = 0;

  constructor(private readonly host: ExcalidrawHighlightHost) {}

  start(): void {
    this.refresh();
    this.timer = window.setInterval(() => this.refresh(), 160);
    this.host.registerInterval(this.timer);
  }

  destroy(): void {
    window.clearInterval(this.timer);
    for (const state of this.views.values()) this.removeState(state);
    this.views.clear();
  }

  highlightAt(event: MouseEvent): HTMLElement | null {
    for (const state of this.views.values()) {
      if (state.root.ownerDocument !== event.view?.document || !state.root.isConnected) continue;
      const rootRect = state.root.getBoundingClientRect();
      if (event.clientX < rootRect.left || event.clientX > rootRect.right || event.clientY < rootRect.top || event.clientY > rootRect.bottom) continue;
      for (let index = state.anchors.length - 1; index >= 0; index--) {
        const anchor = state.anchors[index];
        if (pointInHighlightBox(event.clientX, event.clientY, anchor.box)) return anchor.element;
      }
    }
    return null;
  }

  private refresh(): void {
    const plugin = this.excalidrawPlugin();
    const seen = new Set<View>();
    this.host.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if (view?.getViewType?.() !== "excalidraw") return;
      seen.add(view);
      this.renderView(plugin, view);
    });
    for (const [view, state] of this.views) {
      if (seen.has(view) && state.root.isConnected) continue;
      this.removeState(state);
      this.views.delete(view);
    }
  }

  private renderView(plugin: ExcalidrawPluginApi | LegacyExcalidrawPluginApi | null, view: View): void {
    const root = view.containerEl?.querySelector<HTMLElement>(".excalidraw");
    if (!root) return;
    const viewState = this.ensureState(view, root);
    const api = viewState.api || sceneApiForView(view, plugin);
    if (!api) return;
    viewState.api = api;
    const appState = api.getAppState();
    const inactiveSignature = `inactive:${Number(this.host.settings.enableHighlight)}:${this.host._indexBuildId || 0}`;
    if (!this.host.settings.enableHighlight || !this.host._pattern || !this.host.index.size) {
      if (viewState.signature !== inactiveSignature) {
        viewState.signature = inactiveSignature;
        viewState.anchors = [];
        viewState.layer.replaceChildren();
      }
      return;
    }
    const elements = api.getSceneElements();
    const matches = this.matches(viewState, elements);
    const rootRect = root.getBoundingClientRect();
    this.positionLayer(viewState.layer, rootRect);
    const signature = this.signature(appState, matches, rootRect);
    if (signature === viewState.signature) return;
    viewState.signature = signature;
    viewState.anchors = [];
    viewState.layer.replaceChildren();
    if (!matches.length) return;

    const sceneToViewport = this.sceneConverter(root);
    for (const match of matches) {
      const box = sceneElementBox(match.element, appState, sceneToViewport);
      if (box.width < 1 || box.height < 1) continue;
      const anchor = viewState.layer.createSpan({ cls: "lexis-hl lexis-excalidraw-hl" });
      anchor.dataset.lexisKey = match.key;
      anchor.setAttribute("aria-hidden", "true");
      anchor.setAttribute("style", this.host.inlineStyleForEntry(match.entry, { external: true }));
      anchor.style.left = `${box.left - rootRect.left}px`;
      anchor.style.top = `${box.top - rootRect.top}px`;
      anchor.style.width = `${box.width}px`;
      anchor.style.height = `${box.height}px`;
      anchor.style.transform = `rotate(${box.angle}rad)`;
      viewState.anchors.push({ element: anchor, box });
    }
  }

  private matches(viewState: ViewState, elements: readonly SceneElement[]): Array<{ element: SceneElement; key: string; entry: LexisEntry }> {
    if (viewState.indexBuildId !== this.host._indexBuildId) {
      viewState.indexBuildId = this.host._indexBuildId;
      viewState.matchCache.clear();
    }
    const matches: Array<{ element: SceneElement; key: string; entry: LexisEntry }> = [];
    const liveIds = new Set<string>();
    for (const element of elements) {
      if (element.type !== "text" || element.isDeleted) continue;
      liveIds.add(element.id);
      const text = element.originalText || element.text || "";
      const cached = viewState.matchCache.get(element.id);
      const match = cached?.version === element.version && cached.text === text
        ? cached.match
        : firstExcalidrawMatch(text, this.host._pattern, (value) => this.host.resolveMatchKey(value), this.host.index);
      if (match !== cached?.match) viewState.matchCache.set(element.id, { version: element.version, text, match });
      if (match) matches.push({ element, ...match });
    }
    for (const id of viewState.matchCache.keys()) if (!liveIds.has(id)) viewState.matchCache.delete(id);
    return matches;
  }

  private signature(
    state: SceneState,
    matches: Array<{ element: SceneElement; key: string; entry: LexisEntry }>,
    root: DOMRect,
  ): string {
    return [
      this.host._indexBuildId || 0,
      Number(state.viewModeEnabled),
      state.zoom?.value,
      state.scrollX,
      state.scrollY,
      state.offsetLeft,
      state.offsetTop,
      root.width,
      root.height,
      root.left,
      root.top,
      ...matches.map(({ element, key, entry }) => [
        element.id, element.version, element.x, element.y, element.width, element.height, element.angle, key,
        this.host.inlineStyleForEntry(entry, { external: true }),
      ].join(":")),
    ].join("|");
  }

  private ensureState(view: View, root: HTMLElement): ViewState {
    const existing = this.views.get(view);
    const mount = this.layerMount(root);
    if (existing?.root === root && existing.mount === mount && existing.layer.isConnected) return existing;
    if (existing) this.removeState(existing);
    const layer = mount.createDiv({ cls: "lexis-excalidraw-hl-layer" });
    const state: ViewState = {
      root,
      mount,
      layer,
      anchors: [],
      api: null,
      matchCache: new Map(),
      indexBuildId: -1,
      signature: "",
    };
    this.views.set(view, state);
    return state;
  }

  private removeState(state: ViewState): void {
    state.layer.remove();
  }

  private layerMount(root: HTMLElement): HTMLElement {
    const fullscreen = root.ownerDocument.fullscreenElement;
    return fullscreen?.instanceOf(HTMLElement) && fullscreen.contains(root)
      ? fullscreen
      : root.ownerDocument.body;
  }

  private positionLayer(layer: HTMLElement, root: DOMRect): void {
    layer.style.left = `${root.left}px`;
    layer.style.top = `${root.top}px`;
    layer.style.width = `${root.width}px`;
    layer.style.height = `${root.height}px`;
  }

  private sceneConverter(root: HTMLElement): (point: { sceneX: number; sceneY: number }, state: SceneState) => { x: number; y: number } {
    const ownerWindow = root.ownerDocument.defaultView as ExcalidrawWindow | null;
    const mainWindow = window as unknown as ExcalidrawWindow;
    return ownerWindow?.ExcalidrawLib?.sceneCoordsToViewportCoords
      || mainWindow.ExcalidrawLib?.sceneCoordsToViewportCoords
      || fallbackSceneToViewport;
  }

  private excalidrawPlugin(): ExcalidrawPluginApi | LegacyExcalidrawPluginApi | null {
    const plugins = (this.host.app as AppWithPlugins).plugins;
    const plugin = plugins?.getPlugin?.("obsidian-excalidraw-plugin")
      || plugins?.plugins?.["obsidian-excalidraw-plugin"];
    if (!plugin) return null;
    const api = plugin as ExcalidrawPluginApi & LegacyExcalidrawPluginApi;
    return api.ea?.getAPI || typeof api.getAPI === "function" ? api : null;
  }
}
