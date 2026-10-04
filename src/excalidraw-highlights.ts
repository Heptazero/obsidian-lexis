import type { App, Plugin, View } from "obsidian";
import type { LexisEntry, LexisSettings } from "./types";
import { textHighlightMatches, type TextHighlightMatch } from "./text-highlight-matches";

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
  fontSize?: number;
  fontFamily?: number;
  lineHeight?: number;
  textAlign?: "left" | "center" | "right";
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
  getFontFamilyString?: (element: { fontFamily: number }) => string;
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
  matches: TextHighlightMatch[];
}

interface MatchedTextElement {
  element: SceneElement;
  text: string;
  matches: TextHighlightMatch[];
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
  interacting: boolean;
  interactionTimer: number;
  stopInteractionTracking: () => void;
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
  const match = textHighlightMatches(text, pattern, resolveKey, index)[0];
  return match ? { key: match.key, entry: match.entry } : null;
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
      if (state.interacting) continue;
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
    if (viewState.interacting) return;
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
    for (const item of matches) {
      const box = sceneElementBox(item.element, appState, sceneToViewport);
      if (box.width < 1 || box.height < 1) continue;
      this.renderTextMirror(viewState, item, box, rootRect, appState);
    }
  }

  private matches(viewState: ViewState, elements: readonly SceneElement[]): MatchedTextElement[] {
    if (viewState.indexBuildId !== this.host._indexBuildId) {
      viewState.indexBuildId = this.host._indexBuildId;
      viewState.matchCache.clear();
    }
    const matches: MatchedTextElement[] = [];
    const liveIds = new Set<string>();
    for (const element of elements) {
      if (element.type !== "text" || element.isDeleted) continue;
      liveIds.add(element.id);
      const text = element.text || element.originalText || "";
      const cached = viewState.matchCache.get(element.id);
      const elementMatches = cached?.version === element.version && cached.text === text
        ? cached.matches
        : textHighlightMatches(text, this.host._pattern, (value) => this.host.resolveMatchKey(value), this.host.index);
      if (elementMatches !== cached?.matches) viewState.matchCache.set(element.id, { version: element.version, text, matches: elementMatches });
      if (elementMatches.length) matches.push({ element, text, matches: elementMatches });
    }
    for (const id of viewState.matchCache.keys()) if (!liveIds.has(id)) viewState.matchCache.delete(id);
    return matches;
  }

  private renderTextMirror(
    viewState: ViewState,
    item: MatchedTextElement,
    box: HighlightBox,
    root: DOMRect,
    state: SceneState,
  ): void {
    const mirror = viewState.layer.createDiv({ cls: "lexis-excalidraw-text-mirror", attr: { "aria-hidden": "true" } });
    mirror.style.left = `${box.left - root.left}px`;
    mirror.style.top = `${box.top - root.top}px`;
    mirror.style.width = `${box.width}px`;
    mirror.style.height = `${box.height}px`;
    mirror.style.transform = `rotate(${box.angle}rad)`;
    mirror.style.fontSize = `${Math.max(1, Number(item.element.fontSize) || 20) * (Number(state.zoom?.value) || 1)}px`;
    mirror.style.fontFamily = this.fontFamily(item.element, viewState.root);
    mirror.style.lineHeight = String(Number(item.element.lineHeight) || 1.25);
    mirror.style.textAlign = item.element.textAlign || "left";

    const anchors: HTMLElement[] = [];
    let offset = 0;
    for (const match of item.matches) {
      if (match.start > offset) mirror.appendChild(mirror.ownerDocument.createTextNode(item.text.slice(offset, match.start)));
      const anchor = mirror.createSpan({ cls: "lexis-hl lexis-excalidraw-hl", text: item.text.slice(match.start, match.end) });
      anchor.dataset.lexisKey = match.key;
      anchor.setAttribute("style", `${this.host.inlineStyleForEntry(match.entry, { external: true })};padding:0;`);
      anchors.push(anchor);
      offset = match.end;
    }
    if (offset < item.text.length) mirror.appendChild(mirror.ownerDocument.createTextNode(item.text.slice(offset)));

    for (const anchor of anchors) for (const rect of Array.from(anchor.getClientRects())) {
      if (rect.width > 0 && rect.height > 0) viewState.anchors.push({
        element: anchor,
        box: { left: rect.left, top: rect.top, width: rect.width, height: rect.height, angle: 0 },
      });
    }
  }

  private fontFamily(element: SceneElement, root: HTMLElement): string {
    const fontFamily = Number(element.fontFamily) || 1;
    const resolved = this.excalidrawLib(root)?.getFontFamilyString?.({ fontFamily });
    if (resolved) return resolved;
    return ({ 1: "Virgil", 2: "Helvetica", 3: "Cascadia", 4: "Assistant", 5: "Lilita One", 6: "Nunito", 7: "Comic Shanns", 8: "Excalifont" } as Record<number, string>)[fontFamily] || "sans-serif";
  }

  private signature(
    state: SceneState,
    matches: MatchedTextElement[],
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
      ...matches.map(({ element, matches: textMatches }) => [
        element.id, element.version, element.x, element.y, element.width, element.height, element.angle,
        element.fontSize, element.fontFamily, element.lineHeight, element.textAlign,
        ...textMatches.map((match) => `${match.start}:${match.end}:${match.key}:${this.host.inlineStyleForEntry(match.entry, { external: true })}`),
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
      interacting: false,
      interactionTimer: 0,
      stopInteractionTracking: () => {},
    };
    state.stopInteractionTracking = this.trackInteractions(state);
    this.views.set(view, state);
    return state;
  }

  private removeState(state: ViewState): void {
    state.stopInteractionTracking();
    state.layer.remove();
  }

  private trackInteractions(state: ViewState): () => void {
    const root = state.root;
    const ownerDocument = root.ownerDocument;
    const hostWindow = ownerDocument.defaultView || window;
    const begin = () => {
      hostWindow.clearTimeout(state.interactionTimer);
      state.interacting = true;
      state.layer.classList.add("is-interacting");
    };
    const finish = () => {
      hostWindow.clearTimeout(state.interactionTimer);
      if (!state.interacting) return;
      state.interacting = false;
      state.layer.classList.remove("is-interacting");
      state.signature = "";
      this.refresh();
    };
    const wheel = () => {
      begin();
      state.interactionTimer = hostWindow.setTimeout(finish, 140);
    };
    root.addEventListener("pointerdown", begin, true);
    root.addEventListener("wheel", wheel, { capture: true, passive: true });
    ownerDocument.addEventListener("pointerup", finish, true);
    ownerDocument.addEventListener("pointercancel", finish, true);
    return () => {
      hostWindow.clearTimeout(state.interactionTimer);
      root.removeEventListener("pointerdown", begin, true);
      root.removeEventListener("wheel", wheel, true);
      ownerDocument.removeEventListener("pointerup", finish, true);
      ownerDocument.removeEventListener("pointercancel", finish, true);
    };
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
    return this.excalidrawLib(root)?.sceneCoordsToViewportCoords
      || fallbackSceneToViewport;
  }

  private excalidrawLib(root: HTMLElement): ExcalidrawLib | undefined {
    const ownerWindow = root.ownerDocument.defaultView as ExcalidrawWindow | null;
    const mainWindow = window as unknown as ExcalidrawWindow;
    return ownerWindow?.ExcalidrawLib || mainWindow.ExcalidrawLib;
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
