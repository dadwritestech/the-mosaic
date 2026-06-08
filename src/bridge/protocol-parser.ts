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
  const cleanup = (s: string) => (s ?? '').replace(/^(move|item|ability|typechange):\s*/, '').trim();
  switch (tag) {
    case 'move':    return { type: 'move', side: sideOf(parts[2]), move: parts[3] };
    case '-damage': return { type: 'damage', side: sideOf(parts[2]), hpPercent: hpPercent(parts[3]) };
    case '-heal':   return { type: 'heal', side: sideOf(parts[2]), hpPercent: hpPercent(parts[3]) };
    case '-status': return { type: 'status', side: sideOf(parts[2]), status: parts[3] };
    case '-curestatus': return { type: 'cure', side: sideOf(parts[2]), status: parts[3] };
    case '-boost':  return { type: 'boost', side: sideOf(parts[2]), stat: parts[3], amount: Number(parts[4]) };
    case '-unboost':return { type: 'boost', side: sideOf(parts[2]), stat: parts[3], amount: -Number(parts[4]) };
    case '-weather':return { type: 'weather', weather: parts[2] === 'none' ? '' : parts[2] };
    case '-fieldstart': return { type: 'field', effect: cleanup(parts[2]), start: true };
    case '-fieldend':   return { type: 'field', effect: cleanup(parts[2]), start: false };
    case '-start':  return { type: 'volatile', side: sideOf(parts[2]), effect: cleanup(parts[3]), start: true };
    case '-end':    return { type: 'volatile', side: sideOf(parts[2]), effect: cleanup(parts[3]), start: false };
    case '-item':   return { type: 'item', side: sideOf(parts[2]), item: parts[3], ended: false };
    case '-enditem':return { type: 'item', side: sideOf(parts[2]), item: parts[3], ended: true };
    case '-ability':return { type: 'ability', side: sideOf(parts[2]), ability: parts[3] };
    case 'cant':    return { type: 'cant', side: sideOf(parts[2]), reason: cleanup(parts[3]) };
    case '-immune': return { type: 'immune', side: sideOf(parts[2]) };
    case '-miss':   return { type: 'miss', side: sideOf(parts[2]) };
    case '-supereffective': return { type: 'effectiveness', side: sideOf(parts[2]), kind: 'super' };
    case '-resisted':       return { type: 'effectiveness', side: sideOf(parts[2]), kind: 'resist' };
    case '-crit':   return { type: 'crit', side: sideOf(parts[2]) };
    case '-fail':   return { type: 'fail', side: sideOf(parts[2]) };
    case 'faint':   return { type: 'faint', side: sideOf(parts[2]) };
    case 'switch':  return { type: 'switch', side: sideOf(parts[2]),
                            species: parts[3].split(',')[0], hpPercent: hpPercent(parts[4]) };
    case 'turn':    return { type: 'turn', turn: Number(parts[2]) };
    case 'win':     return { type: 'win', side: nameMap[parts[2]] ?? 'p1' };
    default:        return null;
  }
}
