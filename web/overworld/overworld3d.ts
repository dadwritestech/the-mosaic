import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { makeTree, makePineTree, makeGrassTuft, makeFlower, makeBush, makeRock } from './props';
import { makePokemonCenter, makeMart, makeGym, makeHouse } from './buildings';
import type { View } from '../net';

// 3D overworld in the Let's Go spirit: a grassy field under a tilted 3/4 camera,
// 3D buildings/trees, a follow-cam, soft shadows, and Pokémon roaming the field.
// Server-driven: it renders the same { tiles, player } view the 2D version used.

function grassTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#7fc24a'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    const shade = ['#74b843', '#86cc54', '#6fae3e', '#8fd35e'][i % 4];
    g.fillStyle = shade; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 14);
  return t;
}


export class OverworldScreen3D {
  private renderer = new THREE.WebGLRenderer({ antialias: true });
  private composer!: EffectComposer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
  private view: View | null = null;
  private facing: 'up' | 'down' | 'left' | 'right' = 'down';

  private player = new THREE.Group();
  private legL!: THREE.Mesh; private legR!: THREE.Mesh; private armL!: THREE.Mesh; private armR!: THREE.Mesh;
  private pvis = { x: 0, z: 0 };          // smoothed player world position
  private cam = new THREE.Vector3();
  private bob = 0;

  private tileGroup = new THREE.Group();
  private builtLocation = '';
  private mapW = 9; private mapH = 6;
  private running = false;

  // DOM HUD
  private topbar: HTMLDivElement;
  private msgbar: HTMLDivElement;

  constructor(private host: HTMLElement, private onMove: (dir: string) => void) {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.style.cssText = 'position:absolute;inset:0';
    this.host.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color('#bfeaff');
    this.scene.fog = new THREE.Fog('#bfeaff', 22, 46);

    // lighting — bright, soft, slightly warm (Let's Go daylight)
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6a9a4a, 1.15));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
    sun.position.set(8, 16, 6); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const d = 24; const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -d; sc.right = d; sc.top = d; sc.bottom = -d; sc.near = 1; sc.far = 60;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);

    // big grass ground so the field reads as open (Let's Go style)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ map: grassTexture() }),
    );
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true;
    this.scene.add(ground);

    this.scene.add(this.tileGroup);
    this.buildPlayer();
    this.scene.add(this.player);

    // post-processing: ambient occlusion (depth/contact shading) + subtle bloom
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const gtao = new GTAOPass(this.scene, this.camera, window.innerWidth, window.innerHeight);
    gtao.output = GTAOPass.OUTPUT.Default;
    (gtao as any).blendIntensity = 0.7;
    this.composer.addPass(gtao);
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.25, 0.7, 0.9));
    this.composer.addPass(new OutputPass());

    window.addEventListener('keydown', (e) => {
      const map: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
      const dir = map[e.key];
      if (dir) { e.preventDefault(); this.facing = dir; this.bob = 1; this.onMove(dir); }
    });
    window.addEventListener('resize', () => this.resize());

    // DOM HUD overlay
    this.topbar = document.createElement('div');
    this.topbar.style.cssText = 'position:absolute;top:0;left:0;right:0;background:linear-gradient(#0b0f17cc,#0b0f1700);padding:8px 14px;color:#fff;font:600 15px system-ui;pointer-events:none';
    this.msgbar = document.createElement('div');
    this.msgbar.style.cssText = 'position:absolute;bottom:18px;left:50%;transform:translateX(-50%);background:rgba(20,30,46,.92);color:#fff;padding:10px 22px;border-radius:14px;font:500 17px system-ui;pointer-events:none;display:none;box-shadow:0 6px 20px #0006';
    this.host.appendChild(this.topbar);
    this.host.appendChild(this.msgbar);

    this.running = true;
    this.loop();
  }

  // ---- builders -----------------------------------------------------------

  private buildPlayer() {
    const M = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true });
    const skin = M(0xf2c9a0), jacket = M(0xd83b2f), pants = M(0x33405a), pack = M(0xe0b84a), shoe = M(0x2a2a2a);
    const part = (geo: THREE.BufferGeometry, m: THREE.Material, y = 0) => { const o = new THREE.Mesh(geo, m); o.position.y = y; o.castShadow = true; return o; };
    // limbs pivot from the top (hip/shoulder): translate geometry down so origin = pivot
    const limb = (rad: number, len: number, m: THREE.Material) => { const g = new THREE.CapsuleGeometry(rad, len, 3, 6); g.translate(0, -(len / 2 + rad), 0); const o = new THREE.Mesh(g, m); o.castShadow = true; return o; };

    // legs (pivot ~hip y=0.34)
    this.legL = limb(0.07, 0.2, pants); this.legL.position.set(-0.1, 0.36, 0);
    this.legR = limb(0.07, 0.2, pants); this.legR.position.set(0.1, 0.36, 0);
    this.legL.add(part(new THREE.BoxGeometry(0.11, 0.07, 0.17), shoe, -0.34)); // shoe at foot
    this.legR.add(part(new THREE.BoxGeometry(0.11, 0.07, 0.17), shoe, -0.34));
    // torso (jacket)
    const torso = part(new THREE.CapsuleGeometry(0.17, 0.22, 4, 8), jacket, 0.6);
    // backpack
    const bag = part(new THREE.BoxGeometry(0.24, 0.28, 0.13), pack, 0.6); bag.position.z = -0.16;
    // arms (pivot ~shoulder y=0.74)
    this.armL = limb(0.05, 0.16, jacket); this.armL.position.set(-0.21, 0.74, 0);
    this.armR = limb(0.05, 0.16, jacket); this.armR.position.set(0.21, 0.74, 0);
    // head + cap + brim
    const head = part(new THREE.SphereGeometry(0.155, 16, 14), skin, 0.92);
    const cap = part(new THREE.SphereGeometry(0.165, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), jacket, 0.97);
    const brim = part(new THREE.BoxGeometry(0.27, 0.04, 0.16), jacket, 0.95); brim.position.z = 0.14;

    this.player.add(this.legL, this.legR, torso, bag, this.armL, this.armR, head, cap, brim);
  }

  private character(color: number): THREE.Group {
    const g = new THREE.Group();
    const mk = (geo: THREE.BufferGeometry, c: number, y: number) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: c, roughness: .85 })); m.position.y = y; m.castShadow = true; return m; };
    g.add(mk(new THREE.CapsuleGeometry(0.2, 0.28, 4, 8), color, 0.4));
    g.add(mk(new THREE.SphereGeometry(0.18, 12, 10), 0xf2c9a0, 0.78));
    return g;
  }

  // ---- tiles --------------------------------------------------------------

  private rebuildTiles(view: View) {
    this.tileGroup.clear();
    const tiles: string[][] = view.tiles;
    this.mapH = tiles.length; this.mapW = tiles[0].length;
    for (let y = 0; y < this.mapH; y++) {
      for (let x = 0; x < this.mapW; x++) {
        const t = tiles[y][x];
        const seed = x * 37 + y * 101;
        let obj: THREE.Object3D | null = null;
        if (t === 'wall') obj = (seed % 5 === 0) ? makePineTree(seed) : makeTree(seed);
        else if (t === 'grass') {
          // tall-grass tile: a grass tuft, sometimes a flower or bush for life
          const g = new THREE.Group(); g.add(makeGrassTuft(seed));
          if (seed % 3 === 0) { const f = makeFlower(seed + 1); f.position.set(0.25, 0, 0.2); g.add(f); }
          if (seed % 7 === 0) { const b = makeBush(seed + 2); b.position.set(-0.25, 0, -0.2); g.add(b); }
          obj = g;
        }
        else if (t === 'field') {
          // open grass ground: bare (ground plane shows), with the odd flower/tuft for life
          if (seed % 23 === 0) obj = makeFlower(seed);
          else if (seed % 17 === 0) obj = makeGrassTuft(seed);
          else continue;
        }
        else if (t === 'center') obj = makePokemonCenter();
        else if (t === 'shop') obj = makeMart();
        else if (t === 'gym') obj = makeGym();
        else if (t === 'npc') obj = this.character(0x5a8fd6);
        else if (t === 'floor' || t === 'exit') {
          const path = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.06, 0.98), new THREE.MeshStandardMaterial({ color: t === 'exit' ? '#e6cf86' : '#d9c28c' }));
          path.position.set(x, 0.0, y); path.receiveShadow = true; this.tileGroup.add(path); continue;
        }
        if (obj) { obj.position.set(x, 0, y); this.tileGroup.add(obj); }
      }
    }
    this.scatterDecor();
  }

  // Fill the open ground AROUND the play area with a natural tree-line + scattered
  // rocks/flowers so the field reads as open and alive (not a walled box).
  private scatterDecor() {
    const W = this.mapW, H = this.mapH;
    const rand = (n: number) => { const x = Math.sin(n * 131.7) * 1e4; return x - Math.floor(x); };
    let i = 1000;
    const band = 5; // depth of forest beyond the map's own tree border
    for (let gx = -band; gx <= W + band; gx++) {
      for (let gz = -band; gz <= H + band; gz++) {
        if (gx >= -1 && gx <= W && gz >= -1 && gz <= H) continue; // keep the play area clear
        const r = rand(gx * 73.1 + gz * 19.7);
        const x = gx + (rand(i * 3 + 1) - 0.5) * 0.6, z = gz + (rand(i * 3 + 2) - 0.5) * 0.6;
        let obj: THREE.Object3D | null = null;
        if (r < 0.5) obj = r < 0.1 ? makePineTree(i) : makeTree(i);   // dense tree-line
        else if (r < 0.58) obj = makeRock(i);
        else if (r < 0.64) obj = makeFlower(i);
        else if (r < 0.72) obj = makeGrassTuft(i);
        if (obj) { obj.position.set(x, 0, z); this.tileGroup.add(obj); }
        i++;
      }
    }
    // a few cottages just outside the play area for a village feel
    for (const [hx, hz, hs] of [[-3, 2, 1], [W + 2.5, H - 2, 2], [-2.5, H + 3, 3]] as const) {
      const h = makeHouse(hs); h.position.set(hx, 0, hz); h.rotation.y = (rand(hs * 11) - 0.5) * 0.6; this.tileGroup.add(h);
    }
  }

  // ---- frame --------------------------------------------------------------

  render(view: View) {
    this.view = view;
    if (view.locationId !== this.builtLocation) {
      this.builtLocation = view.locationId;
      this.rebuildTiles(view);
      this.pvis = { x: view.player.x, z: view.player.y };  // snap on location change
    }
    // top bar
    const party = (view.party ?? []).map((m: any) => `${m.species} L${m.level} ${m.hpPercent}%`).join('   ');
    this.topbar.textContent = `${view.locationId}  ·  ${view.time}  ·  badges:${view.badges?.length ?? 0}  ·  ${view.money ?? 0}₽  ·  ${party}`;
    if (view.message) { this.msgbar.textContent = view.message; this.msgbar.style.display = 'block'; }
    else this.msgbar.style.display = 'none';
  }

  private loop = () => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    if (this.renderer.domElement.style.display === 'none' || !this.view) return;
    const p = this.view.player;
    // smooth player + bob
    this.pvis.x += (p.x - this.pvis.x) * 0.2;
    this.pvis.z += (p.y - this.pvis.z) * 0.2;
    this.bob *= 0.85;
    this.player.position.set(this.pvis.x, Math.abs(Math.sin(performance.now() / 90)) * this.bob * 0.1, this.pvis.z);
    const faceAngle = { down: 0, up: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }[this.facing];
    this.player.rotation.y += (faceAngle - this.player.rotation.y) * 0.3;
    // walk cycle: swing limbs while a step is in progress (bob decays after each step)
    const swing = Math.sin(performance.now() / 80) * Math.min(this.bob, 1) * 0.7;
    this.legL.rotation.x = swing; this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.8; this.armR.rotation.x = swing * 0.8;

    // follow camera (tilted 3/4, Let's Go-ish)
    const target = new THREE.Vector3(this.pvis.x, 0.7, this.pvis.z);
    const want = new THREE.Vector3(this.pvis.x, 9.5, this.pvis.z + 8.8);
    this.cam.lerp(want, 0.12); if (this.cam.length() === 0) this.cam.copy(want);
    this.camera.position.copy(this.cam);
    this.camera.lookAt(target);

    this.composer.render();
  };

  private resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  show() { this.renderer.domElement.style.display = 'block'; this.topbar.style.display = 'block'; }
  hide() { this.renderer.domElement.style.display = 'none'; this.topbar.style.display = 'none'; this.msgbar.style.display = 'none'; }
  dispose() { this.running = false; this.renderer.domElement.remove(); this.topbar.remove(); this.msgbar.remove(); this.renderer.dispose(); }
}
