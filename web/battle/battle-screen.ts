import * as THREE from 'three';
import { loadModel, loadCreature } from './creature';
import { Hud } from '../ui/hud';
import type { View } from '../net';

// Cinematic 3D battle: real animated GLB models on a lit field, classic 2D HUD.
export class BattleScreen {
  private renderer = new THREE.WebGLRenderer({ antialias: true });
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 100);
  private hud: Hud;
  private selfObj?: THREE.Object3D;
  private foeObj?: THREE.Object3D;
  private selfMixer: THREE.AnimationMixer | null = null;
  private foeMixer: THREE.AnimationMixer | null = null;
  private selfKey = '';
  private foeKey = '';
  private lastT = performance.now();
  private running = false;
  private endedEl: HTMLDivElement | null = null;
  private endKey: ((e: KeyboardEvent) => void) | null = null;

  constructor(private host: HTMLElement, private onAction: (cmd: string, body?: Record<string, unknown>) => void) {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.style.cssText = 'position:absolute;inset:0';
    this.host.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color('#afe3ff');
    this.scene.fog = new THREE.Fog('#afe3ff', 16, 34);

    const ground = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshStandardMaterial({ color: '#8ac45a', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground);

    // subtle battle pads under each fighter (top sits at ~y=0 so feet rest on them)
    const padMat = new THREE.MeshStandardMaterial({ color: '#73b24c', roughness: 0.95 });
    for (const [px, pz] of [[-2.2, 1.0], [2.1, -1.3]] as const) {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.7, 0.12, 40), padMat);
      pad.position.set(px, -0.05, pz); pad.receiveShadow = true; this.scene.add(pad);
    }

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6a9a4a, 1.1));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.2);
    sun.position.set(4, 9, 5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera as THREE.OrthographicCamera; sc.left = -8; sc.right = 8; sc.top = 8; sc.bottom = -8; sc.far = 30;
    this.scene.add(sun);

    this.camera.position.set(0, 3.4, 7.4); this.camera.lookAt(0, 1.35, 0);

    this.hud = new Hud(this.host, {
      onMove: (i) => this.onAction('turn', { index: i }),
      onSwitch: (i) => this.onAction('switchMon', { index: i }),
      onBall: (ball) => this.onAction('catch', { ball }),
    });
  }

  // Try a real 3D model; fall back to a sprite billboard if it isn't available yet.
  private async loadFighter(num: number, species: string, side: 'self' | 'foe'): Promise<{ obj: THREE.Object3D; mixer: THREE.AnimationMixer | null }> {
    try {
      const { root, mixer } = await loadModel(num, 2.2);
      root.rotation.y = side === 'self' ? Math.PI : 0; // self faces away (back to cam), foe faces camera
      return { obj: root, mixer };
    } catch {
      const spr = await loadCreature(species, side === 'self' ? 'back' : 'front');
      spr.scale.set(2.8, 2.8, 1); spr.position.y = 1.4;
      return { obj: spr, mixer: null };
    }
  }

  async render(view: View) {
    if (view.self.species !== this.selfKey) {
      this.selfKey = view.self.species;
      if (this.selfObj) this.scene.remove(this.selfObj);
      const f = await this.loadFighter(view.self.num, view.self.species, 'self');
      this.selfObj = f.obj; this.selfMixer = f.mixer;
      this.selfObj.position.x = -2.2; this.selfObj.position.z = 1.0;
      this.scene.add(this.selfObj);
    }
    if (view.foe.species !== this.foeKey) {
      this.foeKey = view.foe.species;
      if (this.foeObj) this.scene.remove(this.foeObj);
      const f = await this.loadFighter(view.foe.num, view.foe.species, 'foe');
      this.foeObj = f.obj; this.foeMixer = f.mixer;
      this.foeObj.position.x = 2.1; this.foeObj.position.z = -1.3;
      this.scene.add(this.foeObj);
    }
    this.hud.render({
      self: { name: `${view.self.species} L${view.self.level}`, hp: view.self.hpPercent, status: view.self.status, boosts: view.self.boosts ?? {}, volatiles: view.self.volatiles ?? [], item: view.self.heldItem || undefined },
      foe: { name: `${view.foe.species}`, hp: view.foe.hpPercent, status: view.foe.status, boosts: view.foe.boosts ?? {}, volatiles: view.foe.volatiles ?? [] },
      weather: view.weather ?? '', terrain: view.terrain ?? '',
      moves: view.moves, switches: view.switches ?? [], balls: view.balls ?? [],
      canCatch: view.canCatch, log: view.log,
    });
    if ((view as any).ended) this.showEnded((view as any).ended); else this.clearEnded();
    if (!this.running) { this.running = true; this.loop(); }
  }

  private clearEnded() {
    if (this.endedEl) { this.endedEl.remove(); this.endedEl = null; }
    if (this.endKey) { window.removeEventListener('keydown', this.endKey); this.endKey = null; }
  }

  // Battle-over overlay: result + rewards + a Continue button (battleContinue).
  // Without this the screen stays on the move list after the foe faints — stuck.
  private showEnded(ended: any) {
    if (this.endedEl) return;
    const RC: Record<string, string> = { win: '#43e07d', caught: '#5db4ff', loss: '#ff7a6b', run: '#cbd5e1' };
    const color = RC[ended.result] ?? '#fff';
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;background:rgba(8,11,20,.5);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)';
    const card = document.createElement('div');
    card.className = 'hud-glass';
    card.style.cssText = 'min-width:300px;max-width:78%;padding:26px 32px;border-radius:22px;text-align:center;display:flex;flex-direction:column;gap:8px;color:#eef3ff;font-family:"Segoe UI",system-ui,sans-serif';
    const add = (text: string, css: string) => { const d = document.createElement('div'); d.textContent = text; d.style.cssText = css; card.appendChild(d); };
    for (const ln of (ended.lines ?? [ended.message]) as string[]) add(ln, `font-size:18px;font-weight:800;color:${color};text-shadow:0 1px 3px rgba(0,0,0,.4)`);
    const r = ended.rewards;
    if (r) {
      if (r.money) add(`+${r.money}₽`, 'font-size:14px;font-weight:600;color:#ffd76a;margin-top:4px');
      for (const e of (r.exp ?? [])) add(`${e.species} +${e.amount} EXP`, 'font-size:13px;color:#cbd9f2');
      for (const lu of (r.levelUps ?? [])) add(`${lu.species} grew to Lv ${lu.level}!${lu.evolutionInto ? ` It evolved into ${lu.evolutionInto}!` : ''}`, 'font-size:13px;font-weight:700;color:#9ee7ff');
      for (const it of (r.items ?? [])) add(`Found ${it}!`, 'font-size:13px;color:#d6c8ff');
    }
    const cont = document.createElement('button');
    cont.className = 'hud-btn';
    cont.textContent = 'Continue ▶';
    cont.style.cssText = 'pointer-events:auto;margin-top:12px;align-self:center;background:linear-gradient(135deg,#43e07d,#28c866);color:#06210f;font-size:16px;font-weight:800;padding:12px 30px;border:0;border-radius:99px;cursor:pointer';
    cont.addEventListener('click', () => this.onAction('battleContinue'));
    card.appendChild(cont);
    overlay.appendChild(card);
    this.host.appendChild(overlay);
    this.endedEl = overlay;
    // Enter / Space also continues (fast pick-up-and-play)
    this.endKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.onAction('battleContinue'); } };
    window.addEventListener('keydown', this.endKey);
  }

  // Keep feet on the ground each frame: loadModel only grounds the bind pose,
  // so an idle clip that lifts the mesh otherwise leaves it floating.
  private _box = new THREE.Box3();
  private groundFeet(o: THREE.Object3D) {
    this._box.setFromObject(o);
    const minY = this._box.min.y;
    if (Number.isFinite(minY)) o.position.y -= minY;
  }

  private loop = () => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastT) / 1000); this.lastT = now;
    this.selfMixer?.update(dt); this.foeMixer?.update(dt);
    if (this.selfObj) this.groundFeet(this.selfObj);
    if (this.foeObj) this.groundFeet(this.foeObj);
    this.renderer.render(this.scene, this.camera);
  };

  dispose() { this.running = false; this.clearEnded(); this.hud.clear(); this.renderer.domElement.remove(); this.renderer.dispose(); }
}
