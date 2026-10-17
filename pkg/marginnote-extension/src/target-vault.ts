import { managedEntryIdentity } from "../../../src/marginnote-protocol";
import { nativeNotes, withDictionaryWrite } from "./importer";
import { retargetReturnLink, returnUri, vaultFromUri } from "./links";
import { preference, setPreference } from "./source";

function savedName(topic: string, field: string): string {
  const value = preference(topic, field);
  return typeof value === "string" ? value.trim() : "";
}

function managedNotes(topic: string): NativeNote[] {
  const source = preference(topic, "source");
  return nativeNotes(topic).filter((note) => {
    const owner = managedEntryIdentity(note.excerptText || "");
    return owner && (!source || owner.sourceId === source);
  });
}

function sourceVault(topic: string, notes: NativeNote[]): string {
  return savedName(topic, "sourceVault") || notes.map((note) => vaultFromUri(returnUri(note.excerptText || ""))).find(Boolean) || "";
}

export function effectiveTargetVault(topic: string): string {
  return savedName(topic, "targetVault") || sourceVault(topic, managedNotes(topic));
}

/** Repair only the generated first link, including inactive cards; never reimport bodies. */
export async function setTargetVault(topic: string, window: unknown, input: string): Promise<number> {
  return withDictionaryWrite(topic, async () => {
    const notes = managedNotes(topic);
    const original = sourceVault(topic, notes);
    const name = input.trim();
    const target = name || original;
    const db = Database.sharedInstance();
    const app = Application.sharedInstance();
    if (original) setPreference(topic, "sourceVault", original);
    // Keep future imports consistent even if a native write fails halfway through.
    setPreference(topic, "targetVault", name);
    let changed = 0;
    let pending = 0;
    const save = () => { db.setNotebookSyncDirty(topic); db.savedb(); pending = 0; };
    try {
      for (const note of notes) {
        const before = note.excerptText || "";
        const after = retargetReturnLink(before, target);
        if (before === after) continue;
        note.excerptText = after;
        changed++;
        pending++;
        if (pending >= 40) {
          save();
          app.showHUD(`已修正 ${changed} 个链接 / Updated links: ${changed}`, window, 2);
          await new Promise<void>((resolve) => { NSTimer.scheduledTimerWithTimeInterval(0.01, false, resolve); });
        }
      }
    } finally {
      if (pending) save();
      if (changed) app.refreshAfterDBChanged(topic);
    }
    return changed;
  });
}

export function editTargetVault(topic: string, window: unknown, report: (error: unknown) => void): void {
  const current = effectiveTargetVault(topic);
  const view = UIAlertView.showWithTitleMessageStyleCancelButtonTitleOtherButtonTitlesTapBlock(
    "目标 Obsidian 库名 / Target vault",
    "填写此设备上的库名，不是文件夹路径。留空跟随导出的库名；保存会修正已有卡片链接。\nVault name on this device, not a folder path. Leave blank to use the exported name.",
    2, "取消 / Cancel", ["保存 / Save"],
    (alert, index) => {
      const selected = typeof alert === "number" ? alert : index;
      if (selected !== 1) return;
      const dialog = typeof alert === "number" ? view : alert as NativeAlert;
      const name = String(dialog.textFieldAtIndex(0).text || "");
      void setTargetVault(topic, window, name).then((count) => {
        Application.sharedInstance().showHUD(`已保存 · 修正 ${count} 个链接 / Updated links: ${count}`, window, 4);
      }).catch(report);
    },
  );
  view.textFieldAtIndex(0).text = savedName(topic, "targetVault");
  view.textFieldAtIndex(0).placeholder = current || "Obsidian 库名 / Vault name";
}
