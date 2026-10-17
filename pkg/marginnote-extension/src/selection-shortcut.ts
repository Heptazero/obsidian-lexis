import { parseMarginNoteCapture, type MarginNoteCapture } from "../../../src/marginnote-capture-data";
import { selectionCapture, sendSelection } from "./capture";
import { selectionButtonRect, selectionMenuRect, type MenuRect } from "./selection-layout";

const events = [
  ["PopupMenuOnSelection", "showLexisSelection:"],
  ["ClosePopupMenuOnSelection", "hideLexisSelection:"],
] as const;

export class SelectionShortcut {
  private button: NativeButton | null = null;
  private draft: { capture: MarginNoteCapture; topic: string; document: NativeDocumentController } | null = null;
  private bounds: MenuRect | null = null;
  private closeTimer: NativeTimer | null = null;

  constructor(private instance: AddonInstance) {}

  start(): void {
    for (const [event, selector] of events) {
      NSNotificationCenter.defaultCenter().addObserverSelectorName(this.instance, selector, event);
    }
  }

  stop(): void {
    this.hide();
    for (const [event] of events) NSNotificationCenter.defaultCenter().removeObserverName(this.instance, event);
  }

  show(notification: NativeSelectionNotification): void {
    const app = Application.sharedInstance();
    if (!this.instance.active || !app.checkNotifySenderInWindow(notification, this.instance.window)) return;
    this.hide();
    const study = app.studyController(this.instance.window);
    const document = study.readerController?.currentDocumentController;
    const capture = selectionCapture(this.instance.window);
    const menu = selectionMenuRect(notification.userInfo?.winRect);
    const view = study.view;
    const topic = study.notebookController.notebookId;
    if (!capture || !document || !menu || !view || !topic) return;
    try { parseMarginNoteCapture({ ...capture }); } catch { return; }
    // The notification's rect is in window coordinates, not study-view coordinates.
    const frame = selectionButtonRect(view.convertRectFromView(menu, this.instance.window), view.bounds);
    if (!frame) return;
    const button = UIButton.buttonWithType(0);
    button.frame = frame;
    button.setTitleForState("添加到 Obsidian", 0);
    button.setTitleColorForState(UIColor.whiteColor(), 0);
    button.titleLabel.font = UIFont.systemFontOfSize(14);
    button.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(0.39, 0.28, 0.77, 1);
    button.layer.cornerRadius = 10;
    button.layer.masksToBounds = true;
    button.addTargetActionForControlEvents(this.instance, "addLexisSelection:", 1 << 6);
    button.addTargetActionForControlEvents(this.instance, "cancelLexisSelection:", (1 << 7) | (1 << 8));
    this.button = button;
    this.draft = { capture, topic, document };
    this.bounds = { ...view.bounds };
    view.addSubview(button);
  }

  close(notification: NativeSelectionNotification): void {
    if (!this.button || !Application.sharedInstance().checkNotifySenderInWindow(notification, this.instance.window)) return;
    // MN may close its menu as the shortcut is pressed. Let that touch finish first.
    this.closeTimer?.invalidate();
    this.closeTimer = NSTimer.scheduledTimerWithTimeInterval(0, false, () => {
      this.closeTimer = null;
      if (!this.button?.tracking) this.hide();
    });
  }

  hide(): void {
    this.closeTimer?.invalidate();
    this.closeTimer = null;
    this.button?.removeFromSuperview();
    this.button = null;
    this.draft = null;
    this.bounds = null;
  }

  layout(): void {
    const prior = this.bounds;
    if (!prior) return;
    const bounds = Application.sharedInstance().studyController(this.instance.window).view?.bounds;
    if (!bounds || Object.keys(prior).some((key) => bounds[key as keyof MenuRect] !== prior[key as keyof MenuRect])) this.hide();
  }

  send(): void {
    const draft = this.draft;
    const study = Application.sharedInstance().studyController(this.instance.window);
    if (!draft || !this.instance.active || study.notebookController.notebookId !== draft.topic ||
        study.readerController?.currentDocumentController !== draft.document) { this.hide(); return; }
    this.hide();
    sendSelection(draft.topic, this.instance.window, draft.capture);
  }
}
