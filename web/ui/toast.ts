// web/ui/toast.ts — tiny toast notification helper
// Slides a small card in from top-center, auto-dismisses after ~2.2s.

const TOAST_DURATION = 2200;

function el(tag: string, css?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (css) node.style.cssText = css;
  if (text !== undefined) node.textContent = text;
  return node;
}

const KIND_COLORS: Record<string, string> = {
  info: '#3b82f6',
  good: '#22c55e',
  bad: '#ef4444',
};

let toastContainer: HTMLElement | null = null;

function getContainer(): HTMLElement {
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = el('div', 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;');
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(_host: HTMLElement, text: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
  const container = getContainer();
  const color = KIND_COLORS[kind] ?? KIND_COLORS.info;

  const card = el('div',
    'position:relative;pointer-events:auto;padding:8px 18px;border-radius:10px;background:rgba(15,22,36,.92);color:#fff;font-size:13px;font-weight:600;font-family:system-ui;border:1px solid rgba(255,255,255,.1);box-shadow:0 4px 16px rgba(0,0,0,.4);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transform:translateY(-20px);transition:opacity .25s ease,transform .25s ease;white-space:nowrap;',
    text,
  );

  // Accent bar on left
  const accent = el('div', `position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:10px 0 0 10px;background:${color};`);
  card.appendChild(accent);

  container.appendChild(card);

  // Trigger slide-in
  requestAnimationFrame(() => {
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
  });

  // Auto-dismiss
  setTimeout(() => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(-20px)';
    setTimeout(() => card.remove(), 300);
  }, TOAST_DURATION);
}
