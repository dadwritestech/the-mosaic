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
  // Showdown appends "[from] ability: Static" and "[of] p1a: Pikachu" to explain cause + source.
  const fromCause = (): string | undefined => {
    const f = parts.find((p) => p.startsWith('[from]'));
    if (!f) return undefined;
    return f.replace('[from]', '').replace(/^\s*(ability|item|move|effect):\s*/i, '').trim() || undefined;
  };
  const ofSource = (): string | undefined => {
    const o = parts.find((p) => p.startsWith('[of]'));
    if (!o) return undefined;
    return (o.replace('[of]', '').split(':')[1] ?? '').trim() || undefined; // 'p1a: Pikachu' -> 'Pikachu'
  };
  switch (tag) {
    case 'move':    return { type: 'move', side: sideOf(parts[2]), move: parts[3] };
    case '-damage': return { type: 'damage', side: sideOf(parts[2]), hpPercent: hpPercent(parts[3]), cause: fromCause(), source: ofSource() };
    case '-heal':   return { type: 'heal', side: sideOf(parts[2]), hpPercent: hpPercent(parts[3]) };
    case '-status': return { type: 'status', side: sideOf(parts[2]), status: parts[3], cause: fromCause(), source: ofSource() };
    case '-curestatus': return { type: 'cure', side: sideOf(parts[2]), status: parts[3] };
    case '-boost':  return { type: 'boost', side: sideOf(parts[2]), stat: parts[3], amount: Number(parts[4]), cause: fromCause(), source: ofSource() };
    case '-unboost':return { type: 'boost', side: sideOf(parts[2]), stat: parts[3], amount: -Number(parts[4]), cause: fromCause(), source: ofSource() };
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
