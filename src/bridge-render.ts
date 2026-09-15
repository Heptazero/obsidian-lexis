export function containsMath(markdown: string): boolean {
  return markdown.includes("$$")
    || markdown.includes("\\(")
    || markdown.includes("\\[")
    || /\$[^\s$]/.test(markdown);
}

export async function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = window.setTimeout(() => reject(new Error("render-timeout")), milliseconds);
      }),
    ]);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}
