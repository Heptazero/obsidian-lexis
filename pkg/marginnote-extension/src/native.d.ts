interface NativeNote {
  noteId: string;
  notebookId: string;
  noteTitle: string;
  excerptText: string;
  excerptTextMarkdown: number;
  colorIndex?: number;
  parentNote?: NativeNote | null;
  removeFromParent?(): void;
  addChild(note: NativeNote): void;
}
interface NativeArray<T> { count(): number; objectAtIndex(index: number): T }
interface NativeURL {
  path: string;
  startAccessingSecurityScopedResource(): boolean;
  stopAccessingSecurityScopedResource(): void;
  bookmarkDataWithOptionsIncludingResourceValuesForKeysRelativeToURLError(
    options: number, keys: string[], relative: null, error: null,
  ): unknown;
}
interface NativeTimer { invalidate(): void }
interface NativeAlert { textFieldAtIndex(index: number): { text: string; placeholder: string } }
interface NativeDocumentController {
  selectionText: string;
  isSelectionText: boolean;
  currPageNo: number;
  document?: { docTitle: string };
}
interface NativeSelectionNotification { userInfo: { winRect?: string } }
interface NativeView {
  frame: { x: number; y: number; width: number; height: number };
  bounds: { x: number; y: number; width: number; height: number };
  convertRectFromView(rect: NativeView["frame"], view: unknown): NativeView["frame"];
  addSubview(view: NativeButton): void;
}
interface NativeButton {
  readonly tracking: boolean;
  frame: NativeView["frame"];
  backgroundColor: unknown;
  titleLabel: { font: unknown };
  layer: { cornerRadius: number; masksToBounds: boolean };
  setTitleForState(title: string, state: number): void;
  setTitleColorForState(color: unknown, state: number): void;
  addTargetActionForControlEvents(target: AddonInstance, selector: string, events: number): void;
  removeFromSuperview(): void;
}
interface NativeStudy {
  view?: NativeView;
  notebookController: { notebookId: string; focusNote: NativeNote | null };
  readerController?: { currentDocumentController?: NativeDocumentController };
  refreshAddonCommands(): void;
}
interface AddonInstance {
  window: unknown; timer?: NativeTimer; active?: boolean;
  selectionShortcut?: import("./selection-shortcut").SelectionShortcut;
}
declare const self: AddonInstance;
declare const JSB: {
  newAddon: (mainPath: string) => unknown;
  defineClass(name: string, instance: Record<string, (...args: never[]) => unknown>, statics: Record<string, () => void>): unknown;
};
declare const Application: { sharedInstance(): {
  osType: number;
  studyController(window: unknown): NativeStudy;
  checkNotifySenderInWindow(notification: unknown, window: unknown): boolean;
  refreshAfterDBChanged(topic: string): void;
  showHUD(message: string, window: unknown, seconds: number): void;
  alert(message: string): void;
  openURL(url: NativeURL): void;
  openFileWithUTIs(types: string[], controller: NativeStudy, callback: (value: unknown) => void): void;
} };
declare const NSNotificationCenter: { defaultCenter(): {
  addObserverSelectorName(target: AddonInstance, selector: string, name: string): void;
  removeObserverName(target: AddonInstance, name: string): void;
} };
declare const UIButton: { buttonWithType(type: number): NativeButton };
declare const UIColor: { whiteColor(): unknown; colorWithRedGreenBlueAlpha(red: number, green: number, blue: number, alpha: number): unknown };
declare const UIFont: { systemFontOfSize(size: number): unknown };
declare const Database: { sharedInstance(): {
  getNotebookById(id: string): { notes: NativeNote[] | NativeArray<NativeNote> } | null;
  getNoteById(id: string): NativeNote | null;
  createNoteWithTitleTopicid(title: string, topic: string): NativeNote;
  savedb(): void;
  setNotebookSyncDirty(topic: string): void;
} };
declare const NSUserDefaults: { standardUserDefaults(): {
  objectForKey(key: string): unknown;
  setObjectForKey(value: unknown, key: string): void;
  removeObjectForKey(key: string): void;
} };
declare const NSURL: {
  fileURLWithPath(path: string): NativeURL;
  URLWithString(uri: string): NativeURL;
  URLByResolvingBookmarkDataOptionsRelativeToURLBookmarkDataIsStaleError(
    data: unknown, options: number, relative: null, stale: null, error: null,
  ): NativeURL | null;
};
declare const NSString: { stringWithContentsOfURL(url: NativeURL): string | null };
declare const UIPasteboard: { generalPasteboard(): { string: string | null } };
declare const NSTimer: {
  scheduledTimerWithTimeInterval(seconds: number, repeat: boolean, callback: () => void): NativeTimer;
};
declare const UIAlertView: {
  showWithTitleMessageStyleCancelButtonTitleOtherButtonTitlesTapBlock(
    title: string, message: string, style: number, cancel: string, buttons: string[],
    callback: (alert: unknown, buttonIndex?: number) => void,
  ): NativeAlert;
};
