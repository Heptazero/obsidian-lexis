export interface EditableNote { prefix: string; body: string }

export function splitEditableNote(content: string): EditableNote {
  const match = /^\uFEFF?---\r?\n(?:[\s\S]*?\r?\n)?---(?:\r?\n|$)/.exec(content);
  return match ? { prefix: match[0], body: content.slice(match[0].length) } : { prefix: "", body: content };
}

export function replaceEditableBody(current: string, baselineBody: string, nextBody: string): string | null {
  const parts = splitEditableNote(current);
  return parts.body === baselineBody ? parts.prefix + nextBody : null;
}

export class NoteEditConflict extends Error {
  constructor() { super("The note body changed elsewhere"); }
}

/** Serialize body writes while preserving the latest properties written by other features. */
export class NoteEditSession {
  private baseline: string;
  private draft: string;
  private pending: Promise<void> | null = null;

  constructor(body: string, private readonly process: (transform: (current: string) => string) => Promise<unknown>) {
    this.baseline = body;
    this.draft = body;
  }

  get dirty(): boolean { return this.draft !== this.baseline; }
  update(body: string): void { this.draft = body; }

  flush(): Promise<void> {
    if (this.pending === null) this.pending = this.writeChanges().finally(() => { this.pending = null; });
    return this.pending;
  }

  private async writeChanges(): Promise<void> {
    while (this.dirty) {
      const body = this.draft;
      await this.process((current) => {
        const next = replaceEditableBody(current, this.baseline, body);
        if (next === null) throw new NoteEditConflict();
        return next;
      });
      this.baseline = body;
    }
  }
}
