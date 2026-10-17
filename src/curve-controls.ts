/** Shared by Obsidian and the browser bundle; no vault, scheduler or plugin state. */
export function curveDateIsCurrent(html: string): boolean {
  const dates = [...html.matchAll(/data-curve-today="(\d{4}-\d{2}-\d{2})"/g)];
  return dates.every((match) => match[1] === localDay());
}

function localDay(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function attachCurveControls(root: HTMLElement, refresh?: () => void | Promise<void>): () => void {
  const document = root.ownerDocument, window = document.defaultView;
  let timer = 0, active = true, refreshing = false;
  const activate = (event: Event) => {
    const target = event.target as Element;
    const control = target.closest?.<HTMLElement>("[data-curve-toggle], [data-curve-detail]");
    if (!control || !root.contains(control)) return;
    const view = control.closest<HTMLElement>(".lexis-curve-view");
    event.preventDefault(); event.stopPropagation();
    if (control.hasAttribute("data-curve-toggle")) {
      const expanded = control.getAttribute("aria-expanded") !== "true";
      control.setAttribute("aria-expanded", String(expanded));
      control.textContent = expanded ? control.dataset.recentLabel : control.dataset.allLabel;
      view.querySelector<HTMLElement>(".lexis-curve-recent").hidden = expanded;
      view.querySelector<HTMLElement>(".lexis-curve-all").hidden = !expanded;
    } else view.querySelector<HTMLElement>(".lexis-curve-info").textContent = control.dataset.curveDetail;
  };
  const keydown = (event: KeyboardEvent) => {
    if ((event.key === "Enter" || event.key === " ") && (event.target as Element).closest("[data-curve-detail]")) activate(event);
  };
  const schedule = () => {
    window.clearTimeout(timer);
    const tomorrow = new Date(); tomorrow.setHours(24, 0, 0, 100);
    timer = window.setTimeout(() => { void update(); }, Math.max(100, tomorrow.getTime() - Date.now()));
  };
  const update = async () => {
    if (!active || !refresh || refreshing) return;
    const dates = [...root.querySelectorAll<SVGElement>("svg[data-curve-today]")];
    if (root.isConnected && dates.some((svg) => svg.dataset.curveToday !== localDay())) {
      refreshing = true;
      try { await refresh(); }
      catch (error) { console.warn("[Lexis] Cannot refresh Today marker", error); }
      finally { refreshing = false; }
    }
    if (active) schedule();
  };
  const wake = () => { void update(); };
  root.addEventListener("click", activate);
  root.addEventListener("keydown", keydown);
  if (refresh) { document.addEventListener("visibilitychange", wake); window.addEventListener("focus", wake); schedule(); }
  return () => {
    active = false; window.clearTimeout(timer);
    root.removeEventListener("click", activate); root.removeEventListener("keydown", keydown);
    document.removeEventListener("visibilitychange", wake); window.removeEventListener("focus", wake);
  };
}

interface BrowserCurveHost extends HTMLElement { lexisCurveCleanup?: () => void }
export function attachBrowserCurves(box: BrowserCurveHost, content: HTMLElement,
  request: () => Promise<{ ok?: boolean; html?: string }>, render: (data: unknown) => void): void {
  if (!content.querySelector(".lexis-curve-view")) { box.lexisCurveCleanup = undefined; return; }
  box.lexisCurveCleanup = attachCurveControls(content, async () => {
    const ranges = [...content.querySelectorAll("[data-curve-toggle]")].map((button) => button.getAttribute("aria-expanded") === "true");
    const data = await request();
    if (box.isConnected && data?.ok) {
      render(data);
      box.querySelectorAll<HTMLButtonElement>("[data-curve-toggle]").forEach((button, index) => { if (ranges[index]) button.click(); });
    }
  });
}
