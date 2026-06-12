// Shared modern UI theme — injected once. Glassy panels + gradient buttons,
// consistent across the overworld HUD, menus, and dialogs.
const THEME_CSS = `
.ui-press{ transition:transform .12s ease, filter .12s ease, box-shadow .12s ease; }
.ui-press:hover{ filter:brightness(1.12); transform:translateY(-2px); }
.ui-press:active{ transform:translateY(0) scale(.97); }
.ui-cardh{ transition:transform .12s ease, filter .12s ease, border-color .12s ease; }
.ui-cardh:hover{ filter:brightness(1.08); transform:translateY(-1px); }
.ui-scroll::-webkit-scrollbar{ width:8px; }
.ui-scroll::-webkit-scrollbar-thumb{ background:rgba(255,255,255,.18); border-radius:99px; }
`;

export function ensureTheme(): void {
  if (document.getElementById('ui-theme')) return;
  const s = document.createElement('style');
  s.id = 'ui-theme';
  s.textContent = THEME_CSS;
  document.head.appendChild(s);
}

// Reusable inline style fragments (for DOM built with cssText).
export const GLASS = 'background:rgba(20,25,40,.82);backdrop-filter:blur(18px) saturate(1.2);-webkit-backdrop-filter:blur(18px) saturate(1.2);border:1px solid rgba(255,255,255,.13);box-shadow:0 18px 50px rgba(0,0,0,.5)';
export const BTN_PRIMARY = 'pointer-events:auto;border:0;border-radius:12px;padding:11px 18px;cursor:pointer;font-size:15px;font-weight:700;color:#fff;background:linear-gradient(135deg,#3f6fd0,#2f57b0);box-shadow:0 4px 14px rgba(0,0,0,.28)';
export const BTN_NEUTRAL = 'pointer-events:auto;border:0;border-radius:12px;padding:11px 18px;cursor:pointer;font-size:15px;font-weight:700;color:#fff;background:linear-gradient(135deg,#4a5266,#3a4154);box-shadow:0 4px 14px rgba(0,0,0,.28)';
