// Browser-only state; no bridge request or Obsidian setting is involved.
globalThis.LexisPillPositionEditor = {
  mount(container, initial, save) {
    const { normalizePillOffset, positionSelectionPill, positionBrowserSelectionPill } = LexisPillPosition;
    let offset = normalizePillOffset(initial), drag = null;
    const preview = container.querySelector('.pill-position-preview');
    const selection = container.querySelector('.pill-position-selection');
    const handle = container.querySelector('.pill-position-handle');
    const inputs = { x: container.querySelector('[data-axis="x"]'), y: container.querySelector('[data-axis="y"]') };
    const size = () => ({ width: handle.offsetWidth, height: handle.offsetHeight });
    const viewport = () => ({ width: preview.clientWidth, height: preview.clientHeight });
    const anchor = () => {
      const rect = selection.getBoundingClientRect(), bounds = preview.getBoundingClientRect();
      const top = rect.top - bounds.top - preview.clientTop;
      return { left: rect.left - bounds.left - preview.clientLeft, top, bottom: top + rect.height, width: rect.width };
    };
    const persist = () => save({ ...offset });
    function render() {
      const position = positionBrowserSelectionPill(anchor(), size(), viewport(), offset);
      handle.style.left = position.left + 'px';
      handle.style.top = position.top + 'px';
      for (const axis of ['x', 'y']) inputs[axis].value = offset[axis];
    }
    for (const axis of ['x', 'y']) inputs[axis].addEventListener('change', () => {
      if (Number.isFinite(inputs[axis].valueAsNumber)) {
        offset[axis] = Math.round(inputs[axis].valueAsNumber);
        void persist();
      }
      render();
    });
    container.querySelector('.pill-position-reset').addEventListener('click', () => {
      offset = { x: 0, y: 0 }; render(); void persist();
    });
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || drag) return;
      event.preventDefault(); handle.focus({ preventScroll: true });
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: handle.offsetLeft, top: handle.offsetTop, initial: { ...offset } };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const rect = anchor(), pill = size();
      const base = { left: rect.left + (rect.width - pill.width) / 2, bottom: rect.bottom };
      const position = positionSelectionPill(base, pill, viewport(), {
        x: drag.left + event.clientX - drag.x - base.left,
        y: drag.top + event.clientY - drag.y - base.bottom - 6,
      });
      offset = normalizePillOffset({ x: position.left - base.left, y: position.top - base.bottom - 6 });
      render();
    });
    handle.addEventListener('pointerup', event => {
      if (!drag || drag.id !== event.pointerId) return;
      drag = null; handle.releasePointerCapture(event.pointerId); void persist();
    });
    const cancel = event => {
      if (!drag || drag.id !== event.pointerId) return;
      offset = drag.initial; drag = null; render();
    };
    handle.addEventListener('pointercancel', cancel);
    handle.addEventListener('lostpointercapture', cancel);
    handle.addEventListener('keydown', event => {
      if (drag) return;
      const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!delta) return;
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      offset = { x: offset.x + delta[0] * step, y: offset.y + delta[1] * step };
      render(); void persist();
    });
    container.addEventListener('toggle', render);
    render();
  },
};
