// web/audio/sfx.ts — tiny WebAudio SFX helper, zero assets
// Lazily creates a single AudioContext on first user gesture (autoplay policy).

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Short blip for hover/select. */
export function select(): void {
  try {
    const c = ensureCtx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(880, c.currentTime);
    g.gain.setValueAtTime(0.08, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
    o.start(c.currentTime);
    o.stop(c.currentTime + 0.08);
  } catch { /* audio never breaks gameplay */ }
}

/** Two-tone ascending for confirm. */
export function confirm(): void {
  try {
    const c = ensureCtx();
    const t = c.currentTime;
    [523, 659].forEach((freq, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, t + i * 0.08);
      g.gain.setValueAtTime(0.08, t + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.12);
      o.start(t + i * 0.08);
      o.stop(t + i * 0.08 + 0.12);
    });
  } catch { /* */ }
}

/** Descending tone for cancel/back. */
export function cancel(): void {
  try {
    const c = ensureCtx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(440, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(220, c.currentTime + 0.12);
    g.gain.setValueAtTime(0.08, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
    o.start(c.currentTime);
    o.stop(c.currentTime + 0.12);
  } catch { /* */ }
}

/** Noise burst for hits; pitch/length scale with effectiveness. */
export function hit(eff: number): void {
  try {
    const c = ensureCtx();
    const t = c.currentTime;
    const dur = Math.min(0.3, 0.1 + Math.abs(eff) * 0.05);
    const freq = 200 + Math.min(eff * 80, 400);
    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(Math.max(60, freq), t);
    o.frequency.exponentialRampToValueAtTime(60, t + dur);
    g.gain.setValueAtTime(0.12 * Math.min(Math.max(eff, 0.25), 2), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t);
    o.stop(t + dur);
  } catch { /* */ }
}

/** Descending tone for faint/KO. */
export function faint(): void {
  try {
    const c = ensureCtx();
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(440, t);
    o.frequency.exponentialRampToValueAtTime(80, t + 0.5);
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.start(t);
    o.stop(t + 0.5);
  } catch { /* */ }
}

/** Gentle ascending arpeggio for heal. */
export function heal(): void {
  try {
    const c = ensureCtx();
    const t = c.currentTime;
    [392, 494, 587, 784].forEach((freq, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, t + i * 0.06);
      g.gain.setValueAtTime(0.06, t + i * 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.15);
      o.start(t + i * 0.06);
      o.stop(t + i * 0.06 + 0.15);
    });
  } catch { /* */ }
}

/** Looping soft beep for low HP. Returns a handle to stop it. */
export function lowHp(): { stop: () => void } {
  let stopped = false;
  let id: ReturnType<typeof setInterval> | null = null;
  try {
    const c = ensureCtx();
    id = setInterval(() => {
      if (stopped) return;
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(300, c.currentTime);
      g.gain.setValueAtTime(0.04, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
      o.start(c.currentTime);
      o.stop(c.currentTime + 0.1);
    }, 500);
  } catch { /* */ }
  return { stop: () => { stopped = true; if (id !== null) clearInterval(id); } };
}
