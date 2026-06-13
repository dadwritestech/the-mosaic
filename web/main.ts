import { api } from './net';
import { OverworldScreen3D } from './overworld/overworld3d';
import { BattleScreen } from './battle/battle-screen';
import { Menu } from './ui/menu';
import { Sidebar } from './ui/sidebar';
import { TitleScreen } from './screens/title';
import { OptionsScreen } from './screens/options';
import { TrainerCardScreen } from './screens/trainercard';
import { PokedexScreen } from './screens/pokedex';
import { ShopScreen } from './screens/shop';
import { RegionMapScreen } from './screens/regionmap';

const root = document.getElementById('game')!;

let battle: BattleScreen | null = null;
let busy = false;
let lastBaseView: any = null;  // remembers the screen behind Options overlay
let currentScreen = 'title';

/* ---- lazy-constructed meta-screens ---- */
let titleScreen: TitleScreen | null = null;
let optionsScreen: OptionsScreen | null = null;
let trainerCardScreen: TrainerCardScreen | null = null;
let pokedexScreen: PokedexScreen | null = null;
let shopScreen: ShopScreen | null = null;
let regionMapScreen: RegionMapScreen | null = null;

async function send(cmd: string, body: Record<string, unknown> = {}) {
  if (busy) return;
  // Intercept options commands — pure client-side, no server round-trip.
  if (cmd === 'openOptions') { render({ screen: 'options' }); return; }
  if (cmd === 'closeOptions') {
    if (lastBaseView) render(lastBaseView);
    else send('view');
    return;
  }
  busy = true;
  try { render(await api(cmd, body)); } finally { busy = false; }
}

const overworld = new OverworldScreen3D(root, (dir) => send('move', { dir }));
const menu = new Menu(root, (cmd, body) => send(cmd, body));
const sidebar = new Sidebar(root);

// M opens the pause menu, Escape closes it (overworld only).
window.addEventListener('keydown', (e) => {
  if (currentScreen !== 'overworld') return;
  if (e.key === 'm' || e.key === 'M') send('menu', { which: 'pause' });
  else if (e.key === 'Escape') send('closeMenu');
  else if (e.key === 'c' || e.key === 'C') send('trainerCard');
  else if (e.key === 'p' || e.key === 'P') send('pokedex');
  else if (e.key === 'r' || e.key === 'R') send('regionMap');
});

function hideAll(): void {
  overworld.hide();
  menu.clear();
  hideMetaScreens();
}

/* Hide every meta-screen overlay (title/options/dex/shop/etc.) without
   touching the overworld or battle layers. Called when we return to a
   base screen so a closed overlay doesn't linger on top. */
function hideMetaScreens(): void {
  titleScreen?.hide();
  optionsScreen?.hide();
  trainerCardScreen?.hide();
  pokedexScreen?.hide();
  shopScreen?.hide();
  regionMapScreen?.hide();
}

function render(view: any) {
  currentScreen = view.screen;
  
  if (view.sidebar) {
    sidebar.render(view.sidebar);
  }

  /* Remember the base view so closeOptions can return to it. */
  if (view.screen !== 'options') { lastBaseView = view; }

  /* ---- options screen (overlay, keep previous screen visible behind) ---- */
  if (view.screen === 'options') {
    if (!optionsScreen) optionsScreen = new OptionsScreen(root, (cmd, body) => send(cmd, body ?? {}));
    optionsScreen.show();
    optionsScreen.render(view);
    return;
  }

  /* Any screen transition first tears down open meta-overlays; the
     branch below re-shows whichever one (if any) this view wants. */
  hideMetaScreens();

  /* ---- title screen ---- */
  if (view.screen === 'title') {
    hideAll();
    if (!titleScreen) titleScreen = new TitleScreen(root, (cmd, body) => send(cmd, body ?? {}));
    titleScreen.show();
    titleScreen.render(view);
    return;
  }

  /* ---- trainer card ---- */
  if (view.screen === 'trainercard') {
    if (!trainerCardScreen) trainerCardScreen = new TrainerCardScreen(root, (cmd, body) => send(cmd, body ?? {}));
    trainerCardScreen.show();
    trainerCardScreen.render(view);
    return;
  }

  /* ---- pokedex ---- */
  if (view.screen === 'pokedex') {
    if (!pokedexScreen) pokedexScreen = new PokedexScreen(root, (cmd, body) => send(cmd, body ?? {}));
    pokedexScreen.show();
    pokedexScreen.render(view);
    return;
  }

  /* ---- shop ---- */
  if (view.screen === 'shop') {
    if (!shopScreen) shopScreen = new ShopScreen(root, (cmd, body) => send(cmd, body ?? {}));
    shopScreen.show();
    shopScreen.render(view);
    return;
  }

  /* ---- region map ---- */
  if (view.screen === 'regionmap') {
    if (!regionMapScreen) regionMapScreen = new RegionMapScreen(root, (cmd, body) => send(cmd, body ?? {}));
    regionMapScreen.show();
    regionMapScreen.render(view);
    return;
  }

  /* ---- overworld (existing) ---- */
  if (view.screen === 'overworld') {
    if (battle) { battle.dispose(); battle = null; }
    overworld.show();
    overworld.render(view);
    menu.render(view);
    return;
  }

  /* ---- battle (existing — catch-all for anything that is not overworld) ---- */
  overworld.hide();
  menu.clear();
  if (!battle) battle = new BattleScreen(root, (cmd, body) => send(cmd, body ?? {}));
  void battle.render(view);
}

render(await api('title'));
