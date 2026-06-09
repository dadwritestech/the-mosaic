const id = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Showdown's animated sprites cover the full National Dex. Drop a GLB at
// web/assets/models/<id>.glb later to upgrade a species to a true 3D model.
export function spriteUrl(species: string, side: 'front' | 'back'): string {
  // Relative path -> proxied same-origin by Vite (see vite.config.ts) so it loads as a WebGL texture.
  return `/sprites/${side === 'back' ? 'ani-back' : 'ani'}/${id(species)}.gif`;
}

// High-res HOME render (clean 3D-model PNG on transparent bg), keyed by national dex number.
export function homeUrl(dexNum: number): string {
  return `/home/${dexNum}.png`;
}
