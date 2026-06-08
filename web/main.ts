import { api } from './net';
import { OverworldScreen } from './overworld/overworld-screen';
import { BattleScreen } from './battle/battle-screen';
import { Menu } from './ui/menu';

const root = document.getElementById('game')!;
const canvas = document.createElement('canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
canvas.style.cssText = 'position:absolute;inset:0';
root.appendChild(canvas);

let battle: BattleScreen | null = null;
let busy = false;

async function send(cmd: string, body: Record<string, unknown> = {}) {
  if (busy) return;
  busy = true;
  try { render(await api(cmd, body)); } finally { busy = false; }
}

const overworld = new OverworldScreen(canvas, (dir) => send('move', { dir }));
const menu = new Menu(root, (cmd, body) => send(cmd, body));

// Pressing M (or Escape to close) toggles the pause menu while in the overworld.
window.addEventListener('keydown', (e) => {
  if (battle) return;
  if (e.key === 'm' || e.key === 'M') { send('menu', { which: 'pause' }); }
  else if (e.key === 'Escape') { send('closeMenu'); }
});

function render(view: any) {
  if (view.screen === 'overworld') {
    if (battle) { battle.dispose(); battle = null; }
    canvas.style.display = 'block';
    overworld.render(view);
    menu.render(view);          // draws the overlay on top, or clears it when none
  } else {
    canvas.style.display = 'none';
    menu.clear();
    if (!battle) {
      battle = new BattleScreen(root, (kind, index) => send(kind, kind === 'turn' ? { index } : {}));
    }
    void battle.render(view);
  }
}

render(await api('view'));
