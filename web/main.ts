import { api } from './net';
import { OverworldScreen2D } from './overworld/overworld2d';
import { BattleScreen } from './battle/battle-screen';
import { Menu } from './ui/menu';

const root = document.getElementById('game')!;

let battle: BattleScreen | null = null;
let busy = false;

async function send(cmd: string, body: Record<string, unknown> = {}) {
  if (busy) return;
  busy = true;
  try { render(await api(cmd, body)); } finally { busy = false; }
}

const overworld = new OverworldScreen2D(root, (dir) => send('move', { dir }));
const menu = new Menu(root, (cmd, body) => send(cmd, body));

// M opens the pause menu, Escape closes it (overworld only).
window.addEventListener('keydown', (e) => {
  if (battle) return;
  if (e.key === 'm' || e.key === 'M') send('menu', { which: 'pause' });
  else if (e.key === 'Escape') send('closeMenu');
});

function render(view: any) {
  if (view.screen === 'overworld') {
    if (battle) { battle.dispose(); battle = null; }
    overworld.show();
    overworld.render(view);
    menu.render(view);
  } else {
    overworld.hide();
    menu.clear();
    if (!battle) battle = new BattleScreen(root, (cmd, body) => send(cmd, body ?? {}));
    void battle.render(view);
  }
}

render(await api('view'));
