import { marginNoteCaptureUri, type MarginNoteCapture } from "../../../src/marginnote-capture-data";
import { effectiveTargetVault } from "./target-vault";

export function selectionCapture(window: unknown): MarginNoteCapture | null {
  const app = Application.sharedInstance();
  const document = app.studyController(window).readerController?.currentDocumentController;
  const text = document?.isSelectionText ? (document.selectionText || "").trim() : "";
  if (!document || !text) return null;
  const word = text.replace(/\s+/g, " ");
  const source = ["MarginNote", document.document?.docTitle, document.currPageNo > 0 ? `p.${document.currPageNo}` : ""].filter(Boolean).join(" · ");
  return { word, sentence: text, source };
}

export function sendSelection(topic: string, window: unknown, capture: MarginNoteCapture | null): void {
  if (!capture) throw new Error("请先在文档中选中文字 / Select text in the document first");
  const uri = marginNoteCaptureUri(effectiveTargetVault(topic), capture);
  Application.sharedInstance().openURL(NSURL.URLWithString(uri));
}
