export function createReviewImagePreview(document: Document, source: HTMLImageElement, label: string, onClose: () => void): HTMLElement {
  const overlay = document.body.createDiv({ cls: "lexis-rv-image-preview" });
  const image = overlay.createEl("img");
  image.src = source.currentSrc || source.src;
  image.alt = source.alt || "";
  const pointers = new Map<number, { x: number; y: number }>();
  let scale = 1, translateX = 0, translateY = 0;
  let startScale = 1, startTranslateX = 0, startTranslateY = 0, startDistance = 0;
  let startCenter = { x: 0, y: 0 };
  let startPan = { x: 0, y: 0 };
  const clampScale = (value: number) => Math.max(1, Math.min(5, value));
  const point = (event: PointerEvent) => ({ x: event.clientX, y: event.clientY });
  const pair = () => [...pointers.values()].slice(0, 2);
  const distance = (points: Array<{ x: number; y: number }>) => Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  const center = (points: Array<{ x: number; y: number }>) => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
  const applyTransform = () => {
    if (scale === 1) { translateX = 0; translateY = 0; }
    image.setCssStyles({ transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})` });
    overlay.classList.toggle("is-zoomed", scale > 1);
  };
  const beginPinch = () => {
    const points = pair();
    if (points.length < 2) return;
    startDistance = distance(points);
    startCenter = center(points);
    startScale = scale;
    startTranslateX = translateX;
    startTranslateY = translateY;
  };
  image.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    image.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, point(event));
    if (pointers.size === 1) {
      startPan = point(event);
      startTranslateX = translateX;
      startTranslateY = translateY;
    } else if (pointers.size === 2) beginPinch();
  });
  image.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault();
    pointers.set(event.pointerId, point(event));
    if (pointers.size >= 2) {
      const points = pair();
      const currentCenter = center(points);
      scale = clampScale(startScale * (distance(points) / Math.max(1, startDistance)));
      translateX = startTranslateX + currentCenter.x - startCenter.x;
      translateY = startTranslateY + currentCenter.y - startCenter.y;
    } else if (scale > 1) {
      translateX = startTranslateX + event.clientX - startPan.x;
      translateY = startTranslateY + event.clientY - startPan.y;
    }
    applyTransform();
  });
  const endPointer = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId)) return;
    if (pointers.size === 1) {
      const remaining = [...pointers.values()][0];
      startPan = remaining;
      startTranslateX = translateX;
      startTranslateY = translateY;
    }
  };
  image.addEventListener("pointerup", endPointer);
  image.addEventListener("pointercancel", endPointer);
  image.addEventListener("click", (event) => event.stopPropagation());
  const close = overlay.createEl("button", { cls: "lexis-rv-image-close" });
  close.type = "button";
  close.textContent = "×";
  close.setAttribute("aria-label", label);
  close.addEventListener("click", onClose);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) onClose(); });
  return overlay;
}
