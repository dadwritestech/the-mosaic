import { api } from './net';
import { OverworldScreen } from './overworld/overworld-screen';
import { BattleScreen } from './battle/battle-screen';

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

function render(view: any) {
  if (view.screen === 'overworld') {
    if (battle) { battle.dispose(); battle = null; }
    canvas.style.display = 'block';
    overworld.render(view);
  } else {
    canvas.style.display = 'none';
    if (!battle) {
      battle = new BattleScreen(root, (kind, index) => send(kind, kind === 'turn' ? { index } : {}));
    }
    void battle.render(view);
  }
}

render(await api('view'));
