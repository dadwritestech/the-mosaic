import { OverworldScreen3D } from './overworld/overworld3d';

// Standalone boot of the existing 3D overworld with a fabricated sample map,
// so we can see the roaming world (grass/trees/buildings/day-night/follow-cam).
// Arrow keys move the player — the overworld calls onMove, we update + re-render.

const W = 16, H = 11;
const tiles: string[][] = [];
for (let y = 0; y < H; y++) {
  const row: string[] = [];
  for (let x = 0; x < W; x++) {
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) row.push('wall');        // tree border
    else if (x === 7) row.push('floor');                                            // a path
    else if (x >= 3 && x <= 5 && y >= 3 && y <= 6) row.push('grass');               // tall-grass patch (encounters)
    else if (x >= 10 && x <= 12 && y >= 6 && y <= 8) row.push('grass');             // second patch
    else row.push('field');                                                         // open ground
  }
  tiles.push(row);
}
tiles[2][2] = 'center';   // Pokémon Center building
tiles[2][W - 3] = 'shop'; // Mart building
tiles[8][3] = 'npc';

const view: any = {
  locationId: 'demo-3d',
  time: 'day',
  tiles,
  player: { x: 7, y: 8 },
  party: [{ species: 'Pikachu', level: 8, hpPercent: 100 }],
  badges: [],
  money: 3000,
  message: 'Arrow keys to roam — this is the 3D overworld that already exists.',
};

const host = document.getElementById('app')!;
const ow = new OverworldScreen3D(host, (dir: string) => {
  const d: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const [dx, dy] = d[dir];
  const nx = view.player.x + dx, ny = view.player.y + dy;
  if (tiles[ny]?.[nx] && tiles[ny][nx] !== 'wall') { view.player.x = nx; view.player.y = ny; }
  view.message = '';
  ow.render(view);
});
ow.render(view);
(window as any).__ow = ow;
