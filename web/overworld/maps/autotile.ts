// Canonical RMXP autotile sub-pattern table.
// Each of the 48 connectivity patterns -> [TL, TR, BL, BR] quarter-tile
// indices into a 6-column grid of 16x16 quarters (index = row*6 + col).
export const AUTOTILE_TABLE: ReadonlyArray<readonly [number, number, number, number]> = [
  [26,27,32,33],[ 4,27,32,33],[26, 5,32,33],[ 4, 5,32,33],
  [26,27,32,11],[ 4,27,32,11],[26, 5,32,11],[ 4, 5,32,11],
  [26,27,10,33],[ 4,27,10,33],[26, 5,10,33],[ 4, 5,10,33],
  [26,27,10,11],[ 4,27,10,11],[26, 5,10,11],[ 4, 5,10,11],
  [24,25,30,31],[24, 5,30,31],[24,25,30,11],[24, 5,30,11],
  [14,15,20,21],[14,15,20,11],[14,15,10,21],[14,15,10,11],
  [28,29,34,35],[28,29,10,35],[ 4,29,34,35],[ 4,29,10,35],
  [38,39,44,45],[ 4,39,44,45],[38, 5,44,45],[ 4, 5,44,45],
  [24,29,30,35],[14,15,44,45],[12,13,18,19],[12,13,18,11],
  [16,17,22,23],[16,17,10,23],[28,33,34,39],[ 4,17,10,23],
  [12,17,18,23],[12,13,42,43],[36,37,42,43],[36,17,42,23],
  [12,17,42,23],[36,37,18,19],[16,21,22,27],[40,41,46,47],
];

export function autotileQuads(sub: number): readonly [number, number, number, number] {
  return AUTOTILE_TABLE[sub] ?? AUTOTILE_TABLE[0];
}

/** Quarter-tile index -> source pixel in the 6-col x 8-row grid of 16px quarters. */
export function quarterSrc(q: number): { sx: number; sy: number } {
  return { sx: (q % 6) * 16, sy: Math.floor(q / 6) * 16 };
}
