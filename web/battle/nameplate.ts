export interface NameplateData {
  name: string;
  level: number;
  gender?: 'M' | 'F' | 'N';
  hpPercent: number;
  hp?: number;
  maxHp?: number;
  status?: string;
  expPercent?: number;
}

const STATUS_COLORS: Record<string, string> = {
  par: '#d8a200',
  psn: '#9a3fb0',
  tox: '#9a3fb0',
  brn: '#d8642a',
  slp: '#7a8694',
  frz: '#37b0d8',
};

function hpColor(pct: number): string {
  if (pct > 50) return '#46d160';
  if (pct > 20) return '#f5c043';
  return '#e5533a';
}

function statusLabel(code: string): string {
  const map: Record<string, string> = {
    par: 'PAR',
    psn: 'PSN',
    tox: 'TOX',
    brn: 'BRN',
    slp: 'SLP',
    frz: 'FRZ',
  };
  return map[code] ?? code.toUpperCase();
}

function genderSymbol(g?: 'M' | 'F' | 'N'): string {
  if (g === 'M') return '♂';
  if (g === 'F') return '♀';
  return '';
}

function genderColor(g: string): string {
  if (g === 'M') return '#5b9be6';
  if (g === 'F') return '#f28e8e';
  return '';
}

export class Nameplate {
  el: HTMLElement;

  private _nameSpan: HTMLElement;
  private _genderSpan: HTMLElement;
  private _statusSpan: HTMLElement;
  private _levelSpan: HTMLElement;
  private _hpFill: HTMLElement;
  private _hpNumberSpan: HTMLElement;
  private _expTrack: HTMLElement;
  private _expFill: HTMLElement;
  private _expRow: HTMLElement;

  /* --- HP number animation --- */
  private _lastHpNum: number | undefined;
  private _hpAnimFrame: number | null = null;

  constructor(side: 'self' | 'foe') {
    const root = document.createElement('div');
    root.style.cssText = [
      'position:relative',
      'display:flex',
      'flex-direction:column',
      'gap:4px',
      'padding:8px 14px',
      'min-width:230px',
      'border-radius:14px',
      'background:rgba(20,28,44,.82)',
      'border:1px solid rgba(255,255,255,.15)',
      'color:#fff',
      'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
      'box-shadow:0 4px 14px rgba(0,0,0,.35)',
      'backdrop-filter:blur(6px)',
      '-webkit-backdrop-filter:blur(6px)',
      'user-select:none',
      'pointer-events:none',
    ].join(';');

    // accent bar
    const accent = document.createElement('div');
    accent.style.cssText = [
      'position:absolute',
      'top:0',
      side === 'self' ? 'left:0' : 'left:0',
      'bottom:0',
      'width:3px',
      'border-radius:14px 0 0 14px',
      'background:' + (side === 'self' ? '#f0b840' : '#e5533a'),
    ].join(';');
    root.appendChild(accent);

    // --- top row: name + status pill | level ---
    const topRow = document.createElement('div');
    topRow.style.cssText = [
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'gap:6px',
    ].join(';');

    const nameGroup = document.createElement('div');
    nameGroup.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:5px',
      'flex-wrap:nowrap',
      'min-width:0',
    ].join(';');

    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = [
      'font-weight:700',
      'font-size:15px',
      'white-space:nowrap',
      'overflow:hidden',
      'text-overflow:ellipsis',
    ].join(';');

    const genderSpan = document.createElement('span');
    genderSpan.style.cssText = [
      'font-size:12px',
      'line-height:1',
      'flex-shrink:0',
    ].join(';');

    const statusSpan = document.createElement('span');
    statusSpan.style.cssText = [
      'font-size:11px',
      'font-weight:600',
      'color:#fff',
      'padding:1px 6px',
      'border-radius:4px',
      'flex-shrink:0',
      'display:none',
    ].join(';');

    nameGroup.appendChild(nameSpan);
    nameGroup.appendChild(genderSpan);
    nameGroup.appendChild(statusSpan);

    const levelSpan = document.createElement('span');
    levelSpan.style.cssText = [
      'font-size:13px',
      'color:#cbd5e1',
      'flex-shrink:0',
    ].join(';');

    topRow.appendChild(nameGroup);
    topRow.appendChild(levelSpan);
    root.appendChild(topRow);

    // --- HP row ---
    const hpRow = document.createElement('div');
    hpRow.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:6px',
    ].join(';');

    const hpLabel = document.createElement('span');
    hpLabel.style.cssText = [
      'font-size:10px',
      'font-weight:600',
      'color:#9fb3d1',
      'flex-shrink:0',
      'width:16px',
    ].join(';');
    hpLabel.textContent = 'HP';

    const hpTrack = document.createElement('div');
    hpTrack.style.cssText = [
      'flex:1',
      'height:9px',
      'background:#0e1626',
      'border-radius:5px',
      'overflow:hidden',
    ].join(';');

    const hpFill = document.createElement('div');
    hpFill.style.cssText = [
      'height:100%',
      'border-radius:5px',
      'transition:width .45s ease',
      'width:100%',
    ].join(';');

    hpTrack.appendChild(hpFill);

    const hpNumberSpan = document.createElement('span');
    hpNumberSpan.style.cssText = [
      'font-size:12px',
      'color:#cbd5e1',
      'flex-shrink:0',
      'text-align:right',
      'min-width:58px',
      'display:none',
    ].join(';');

    hpRow.appendChild(hpLabel);
    hpRow.appendChild(hpTrack);
    hpRow.appendChild(hpNumberSpan);
    root.appendChild(hpRow);

    // --- EXP row ---
    const expRow = document.createElement('div');
    expRow.style.cssText = [
      'display:none',
    ].join(';');

    const expTrack = document.createElement('div');
    expTrack.style.cssText = [
      'height:4px',
      'background:#0e1626',
      'border-radius:2px',
      'overflow:hidden',
    ].join(';');

    const expFill = document.createElement('div');
    expFill.style.cssText = [
      'height:100%',
      'background:#5b9be6',
      'border-radius:2px',
      'transition:width .4s ease',
      'width:0%',
    ].join(';');

    expTrack.appendChild(expFill);
    expRow.appendChild(expTrack);
    root.appendChild(expRow);

    this.el = root;
    this._nameSpan = nameSpan;
    this._genderSpan = genderSpan;
    this._statusSpan = statusSpan;
    this._levelSpan = levelSpan;
    this._hpFill = hpFill;
    this._hpNumberSpan = hpNumberSpan;
    this._expTrack = expTrack;
    this._expFill = expFill;
    this._expRow = expRow;
  }

  update(d: NameplateData): void {
    // name
    this._nameSpan.textContent = d.name;

    // gender
    const sym = genderSymbol(d.gender);
    this._genderSpan.textContent = sym;
    this._genderSpan.style.color = genderColor(d.gender ?? 'N');

    // level
    this._levelSpan.textContent = `Lv.${d.level}`;

    // status pill
    if (d.status && d.status !== '') {
      this._statusSpan.textContent = statusLabel(d.status);
      this._statusSpan.style.background = STATUS_COLORS[d.status] ?? '#888';
      this._statusSpan.style.display = '';
    } else {
      this._statusSpan.style.display = 'none';
    }

    // HP bar
    const clampedHp = Math.max(0, Math.min(100, d.hpPercent));
    this._hpFill.style.width = clampedHp + '%';
    this._hpFill.style.background = hpColor(clampedHp);

    // HP numbers (animated count-up/down)
    if (d.hp !== undefined && d.maxHp !== undefined) {
      this._hpNumberSpan.style.display = '';
      this.animateHpNumber(d.hp, d.maxHp);
    } else {
      this._hpNumberSpan.style.display = 'none';
      if (this._hpAnimFrame !== null) {
        cancelAnimationFrame(this._hpAnimFrame);
        this._hpAnimFrame = null;
      }
      this._lastHpNum = undefined;
    }

    // EXP bar
    if (d.expPercent !== undefined) {
      this._expRow.style.display = '';
      const clampedExp = Math.max(0, Math.min(100, d.expPercent));
      this._expFill.style.width = clampedExp + '%';
    } else {
      this._expRow.style.display = 'none';
    }
  }

  private animateHpNumber(targetHp: number, maxHp: number): void {
    const start = this._lastHpNum ?? targetHp;
    const duration = 450;
    const startTime = performance.now();

    if (this._hpAnimFrame !== null) {
      cancelAnimationFrame(this._hpAnimFrame);
    }

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const current = Math.round(start + (targetHp - start) * t);
      this._hpNumberSpan.textContent = `${Math.max(0, Math.min(maxHp, current))}/${maxHp}`;
      if (t < 1) {
        this._hpAnimFrame = requestAnimationFrame(step);
      } else {
        this._hpNumberSpan.textContent = `${Math.max(0, Math.min(maxHp, targetHp))}/${maxHp}`;
        this._lastHpNum = targetHp;
        this._hpAnimFrame = null;
      }
    };

    this._hpAnimFrame = requestAnimationFrame(step);
  }
}
