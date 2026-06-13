// web/settings.ts — client-side settings persisted to localStorage.
// Single source of truth for options that do not require server round-trips.

const KEY = 'mosaic-settings';

export interface GameSettings {
  textSpeed: 'slow' | 'normal' | 'fast';
  battleAnimations: boolean;
  sfxVolume: number;     // 0-100
  masterVolume: number;  // 0-100
  dayNightTint: boolean;
  sidebarOpen: boolean;
  sidebarCards: string[];
}

const DEFAULTS: GameSettings = {
  textSpeed: 'normal',
  battleAnimations: true,
  sfxVolume: 80,
  masterVolume: 80,
  dayNightTint: true,
  sidebarOpen: true,
  sidebarCards: ['party', 'pokedex', 'map'],
};

function load(): GameSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(s: GameSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota */ }
}

let _cache: GameSettings | null = null;

function ensure(): GameSettings {
  if (!_cache) _cache = load();
  return _cache;
}

export function getSettings(): GameSettings { return { ...ensure() }; }

export function setSetting<K extends keyof GameSettings>(key: K, value: GameSettings[K]): void {
  const s = ensure();
  s[key] = value;
  _cache = { ...s };
  save(_cache);
}

/** Milliseconds per log line based on textSpeed setting. */
export function logDelayMs(): number {
  const speeds = { slow: 1400, normal: 900, fast: 400 };
  return speeds[getSettings().textSpeed];
}

/** Whether battle animations should play. */
export function animationsEnabled(): boolean {
  return getSettings().battleAnimations;
}
