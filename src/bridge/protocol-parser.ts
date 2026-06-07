import type { BattleEvent, Side } from './types';

export function sideOf(ident: string): Side {
  return ident.trim().startsWith('p1') ? 'p1' : 'p2';
}

function hpPercent(hpStatus: string): number {
  // forms: "62/100", "0 fnt", "100/100 par"
  const frac = hpStatus.split(' ')[0];
  if (frac.includes('/')) {
    const [cur, max] = frac.split('/').map(Number);
    return max ? Math.round((cur / max) * 100) : 0;
  }
  return Number(frac) || 0;
}

// nameMap lets us resolve |win|NAME back to a Side. Defaults handle the test case.
export function parseLine(
  line: string,
  nameMap: Record<string, Side> = { P1: 'p1', P2: 'p2' },
): BattleEvent | null {
  const parts = line.split('|'); // leading '' because line starts with '|'
  const tag = parts[1];
  switch (tag) {
    case 'move':   return { type: 'move', side: sideOf(parts[2]), move: parts[3] };
    case '-damage':return { type: 'damage', side: sideOf(parts[2]), hpPercent: hpPercent(parts[3]) };
    case '-status':return { type: 'status', side: sideOf(parts[2]), status: parts[3] };
    case 'faint':  return { type: 'faint', side: sideOf(parts[2]) };
    case 'switch': return { type: 'switch', side: sideOf(parts[2]),
                            species: parts[3].split(',')[0], hpPercent: hpPercent(parts[4]) };
    case 'turn':   return { type: 'turn', turn: Number(parts[2]) };
    case 'win':    return { type: 'win', side: nameMap[parts[2]] ?? 'p1' };
    default:       return null;
  }
}
