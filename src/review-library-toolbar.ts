import { Menu, setIcon } from "obsidian";
import { compactLibrarySorts, type LibraryState } from "./review-library-model";
import { libraryGroups } from "./review-library-groups";
interface ToolbarHost {
    t(key: string): string;
}
interface ToolbarOptions {
    reviewed?: boolean;
    groupsExpanded?: () => boolean;
    toggleGroups?: () => void;
}
const sortLabels = { name: "library.sortName", reps: "library.sortReps", retention: "library.sortRetention", due: "log.due" };
/** One grouping choice and a right-aligned sort/direction/display group. */
export function renderLibraryToolbar(root: HTMLElement, host: ToolbarHost, state: LibraryState, changed: (groupChanged?: boolean) => void, { reviewed = true, groupsExpanded, toggleGroups }: ToolbarOptions = {}): () => void {
    const toolbar = root.createDiv({ cls: "lexis-library-toolbar" });
    const search = toolbar.createEl("input", { cls: "lexis-log-search", attr: { type: "search", placeholder: host.t("library.search"), "aria-label": host.t("library.search") } });
    search.value = state.query;
    search.oninput = () => { state.query = search.value; changed(); };
    const controls = toolbar.createDiv({ cls: "lexis-library-controls" });
    const scope = controls.createDiv({ cls: "lexis-library-scope" });
    const order = controls.createDiv({ cls: "lexis-library-order" });
    const redraw = (groupChanged = false) => { changed(groupChanged); options(); };
    function options() {
        scope.empty();
        order.empty();
        const group = scope.createEl("button", { text: `${host.t(`collection.group.${state.groupBy || "none"}`)} ▾`, attr: { "data-library-group": "", title: host.t("collection.group") } });
        group.onclick = event => {
            const menu = new Menu();
            for (const value of libraryGroups)
                menu.addItem(item => item.setTitle(host.t(`collection.group.${value}`)).setChecked(state.groupBy === value).onClick(() => {
                    if (state.groupBy === value) return;
                    state.groupBy = value; redraw(true);
                }));
            menu.showAtMouseEvent(event);
        };
        if (state.groupBy !== "none" && toggleGroups) {
            const expanded = groupsExpanded?.() === true;
            const label = host.t(expanded ? "library.collapseGroups" : "library.expandGroups");
            const toggle = scope.createEl("button", { cls: "clickable-icon", attr: { "data-library-groups-toggle": expanded ? "collapse" : "expand", "aria-label": label, title: label } });
            setIcon(toggle, expanded ? "chevrons-down-up" : "chevrons-up-down");
            toggle.onclick = () => { toggleGroups(); options(); };
        }
        if (reviewed) {
            const sort = order.createEl("button", { text: `${host.t(sortLabels[compactLibrarySorts.find(value => value === state.sort) || "reps"])} ▾`, attr: { "data-library-sort": "" } });
            sort.onclick = event => {
                const menu = new Menu();
                for (const value of compactLibrarySorts) menu.addItem(item => item.setTitle(host.t(sortLabels[value])).setChecked(state.sort === value).onClick(() => { state.sort = value; redraw(); }));
                menu.showAtMouseEvent(event);
            };
            const directionLabel = host.t(state.direction === "desc" ? "library.desc" : "library.asc");
            const direction = order.createEl("button", { cls: "clickable-icon", attr: { "data-library-direction": "", "aria-label": directionLabel, title: directionLabel } });
            setIcon(direction, state.direction === "desc" ? "arrow-down" : "arrow-up");
            direction.onclick = () => { state.direction = state.direction === "desc" ? "asc" : "desc"; redraw(); };
        }
        const mode = order.createEl("button", { attr: { "data-library-view": state.view, "aria-label": host.t("library.switchView") } });
        mode.createSpan({ text: host.t(`library.view.${state.view}`) });
        setIcon(mode.createSpan({ cls: "lexis-library-switch" }), "arrow-left-right");
        mode.onclick = () => { state.view = state.view === "cards" ? "list" : "cards"; redraw(); };
    }
    options();
    return options;
}
