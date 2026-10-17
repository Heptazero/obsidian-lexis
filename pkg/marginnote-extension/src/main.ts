import { parseMarginNoteDictionary } from "../../../src/marginnote-protocol";
import { importDictionary, nativeNotes } from "./importer";
import { forgetFile, pickedURL, preference, readDictionary, rememberedFile, rememberFile, setPreference } from "./source";
import { managedEntryIdentity } from "../../../src/marginnote-protocol";
import { returnUri, uriForVault } from "./links";
import { editTargetVault, effectiveTargetVault } from "./target-vault";
import { manageDictionary } from "./manage";
import { selectionCapture, sendSelection } from "./capture";
import { SelectionShortcut } from "./selection-shortcut";

const app = () => Application.sharedInstance();
const instances = new Set<AddonInstance>();
const report = (error: unknown) => app().alert(`Lexis MN\n${error instanceof Error ? error.message : String(error)}`);
function currentTopic(window: unknown): string {
  const topic = app().studyController(window)?.notebookController?.notebookId;
  if (!topic) throw new Error("请先打开学习集 / Open a study set first");
  return topic;
}

async function check(window: unknown, automatic: boolean): Promise<void> {
  let topic = "";
  try {
    topic = currentTopic(window);
    if (automatic && preference(topic, "auto") !== true) return;
    const url = rememberedFile(topic);
    if (!url) {
      if (!automatic) throw new Error("请先选择词库文件；剪贴板导入不能自动更新 / Select a dictionary file first");
      return;
    }
    const result = await importDictionary(topic, window, readDictionary(url), automatic);
    if (!automatic && result) app().showHUD(`新增 ${result.created} · 更新 ${result.updated} · 停用 ${result.disabled}`, window, 4);
  } catch (error) {
    if (!automatic) report(error);
    else {
      // Do not hide failures behind a permanently enabled switch or repeatedly interrupt reading.
      if (!topic) return;
      setPreference(topic, "auto", false);
      app().showHUD("Lexis 自动检查已暂停，请重新选择文件 / Update check paused", window, 5);
    }
  }
}

function chooseFile(window: unknown, topic: string): void {
  app().openFileWithUTIs(["public.json"], app().studyController(window), (value) => {
    void (async () => {
      const url = pickedURL(value);
      if (!url) return;
      const snapshot = readDictionary(url);
      const result = await importDictionary(topic, window, snapshot);
      // A prior source must not keep updating after the user selects a new file.
      forgetFile(topic);
      const remembered = rememberFile(topic, url);
      app().showHUD(`已导入 ${result?.total || 0} 个词条`, window, 4);
      if (!remembered) app().alert("已导入，但无法保留文件权限；下次请重新选择文件 / File access could not be retained");
    })().catch(report);
  });
}

async function paste(window: unknown, topic: string): Promise<void> {
  const text = UIPasteboard.generalPasteboard().string;
  if (!text) throw new Error("剪贴板为空 / Clipboard is empty");
  const snapshot = parseMarginNoteDictionary(String(text));
  const result = await importDictionary(topic, window, snapshot);
  forgetFile(topic);
  app().showHUD(`已导入 ${result?.total || 0} 个词条`, window, 4);
}

function openSelected(window: unknown): void {
  const note = app().studyController(window).notebookController.focusNote;
  if (!note || !managedEntryIdentity(note.excerptText || "")) throw new Error("请先选中 Lexis 词条卡片 / Select a Lexis card");
  const uri = returnUri(note.excerptText);
  if (!uri) throw new Error("卡片中没有 Obsidian 链接 / No Obsidian link found");
  app().openURL(NSURL.URLWithString(uriForVault(uri, effectiveTargetVault(currentTopic(window)))));
}

function menu(window: unknown): void {
  try {
    const topic = currentTopic(window);
    const selection = selectionCapture(window);
    const auto = preference(topic, "auto") === true;
    const count = nativeNotes(topic).filter((note) => managedEntryIdentity(note.excerptText || "")).length;
    const actions = [
      { title: "选择词库文件 / Import file", run: () => chooseFile(window, topic) },
      { title: "从剪贴板导入 / Paste dictionary", run: () => paste(window, topic) },
      { title: `目标 Obsidian 库名 / Target vault: ${effectiveTargetVault(topic) || "默认 / Default"}`, run: () => editTargetVault(topic, window, report) },
      { title: "更新词库 / Refresh dictionary", run: () => check(window, false) },
      { title: `按文件夹分组 / Folder grouping: ${preference(topic, "grouped") !== false ? "ON" : "OFF"}`, run: () => manageDictionary(topic, window, "group") },
      { title: "绑定当前卡片颜色 / Bind selected card color", run: () => manageDictionary(topic, window, "color") },
      { title: "选中文字添加到 Obsidian / Add selection in Obsidian", run: () => sendSelection(topic, window, selection) },
      { title: `自动检查 / Auto-check: ${auto ? "ON" : "OFF"}`, run: () => {
        if (!auto && !rememberedFile(topic)) throw new Error("请先选择词库文件 / Select a file first");
        setPreference(topic, "auto", !auto);
        if (!auto) return check(window, false);
      } },
      { title: "在 Obsidian 打开 / Open selected card", run: () => openSelected(window) },
      { title: "使用说明 / Help", run: () => app().alert(
        "首次导入前，在主脑图新建并选中一张 Lexis 词库卡片。导入后，在学习集更多菜单开启标题链接，并把该脑图选为字典；其他学习集添加它为外部字典。\n\n" +
        "在 Obsidian 的 MarginNote 设置选择导出范围。MN 默认按文件夹分组，内联词条再按来源文件分组。颜色绑定：先用 MN 调色板给词条设色，再选「绑定当前卡片颜色」。用手形工具划词后，点击原生菜单旁「添加到 Obsidian」，在 Obsidian 确认后才保存。\n\n" +
        "Obsidian 是唯一正文来源，更新保留 MN 评论。自动检查只更新词库，不升级插件；仅在 MN 前台运行，云同步可能延迟。\n\n" +
        "Create and select a dictionary parent card before importing. Enable Title Link and select this mind map as a dictionary. Use an external dictionary in other study sets. Imported titles/body are read-only copies; user comments are preserved.",
      ) },
    ];
    UIAlertView.showWithTitleMessageStyleCancelButtonTitleOtherButtonTitlesTapBlock(
      "Lexis MN", `${count} 张导入卡片 / Imported cards`, 0, "取消 / Cancel", actions.map((action) => action.title),
      (alert, index) => {
        const selected = typeof alert === "number" ? alert : index;
        if (selected == null || selected === 0) return;
        const action = actions[selected - 1];
        if (action) void Promise.resolve().then(action.run).catch(report);
      },
    );
  } catch (error) { report(error); }
}

function activate(instance: AddonInstance): void {
  instances.add(instance);
  instance.active = true;
  if (!instance.selectionShortcut) {
    instance.selectionShortcut = new SelectionShortcut(instance);
    instance.selectionShortcut.start();
  }
  instance.timer?.invalidate();
  const window = instance.window;
  instance.timer = NSTimer.scheduledTimerWithTimeInterval(30, true, () => { void check(window, true); });
  void check(window, true);
}
function deactivate(instance: AddonInstance): void {
  instance.active = false;
  instance.selectionShortcut?.stop();
  instance.selectionShortcut = undefined;
  instance.timer?.invalidate();
  instance.timer = undefined;
}

JSB.newAddon = () => JSB.defineClass("LexisMNAddon : JSExtension", {
  sceneWillConnect: () => activate(self),
  sceneDidBecomeActive: () => activate(self),
  sceneWillResignActive: () => deactivate(self),
  sceneDidDisconnect: () => { deactivate(self); instances.delete(self); },
  notebookWillOpen: () => {
    const instance = self;
    instance.selectionShortcut?.hide();
    NSTimer.scheduledTimerWithTimeInterval(0.3, false, () => {
      if (instance.active) void check(instance.window, true);
    });
  },
  notebookWillClose: () => self.selectionShortcut?.hide(),
  documentWillClose: () => self.selectionShortcut?.hide(),
  controllerWillLayoutSubviews: () => self.selectionShortcut?.layout(),
  showLexisSelection: (notification: NativeSelectionNotification) => self.selectionShortcut?.show(notification),
  hideLexisSelection: (notification: NativeSelectionNotification) => self.selectionShortcut?.close(notification),
  cancelLexisSelection: () => self.selectionShortcut?.hide(),
  addLexisSelection: () => {
    try { self.selectionShortcut?.send(); } catch (error) { report(error); }
  },
  queryAddonCommandStatus: () => ({ image: "icon.png", object: self, selector: "openLexis:", checked: false }),
  openLexis: () => menu(self.window),
}, { addonDidConnect: () => {}, addonWillDisconnect: () => {
  for (const instance of instances) deactivate(instance);
  instances.clear();
} });
