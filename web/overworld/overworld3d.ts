import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { makeTree, makePineTree, makeGrassTuft, makeFlower, makeBush, makeRock } from './props';
import { loadKit, loadKayCharacter } from '../battle/creature';
import type { View } from '../net';

// CC0 characters: player is an animated KayKit Knight (shared-rig clips);
// townsfolk + Warden reuse the Quaternius static models for now.
const PLAYER_MODEL = '/kit/adventurers/Knight.glb';
const WARDEN_MODEL = '/kit/characters/soldier.glb';            // armed sentinel guarding the rift
const NPC_MODELS = ['/kit/characters/man.glb', '/kit/characters/adventurer.glb']; // townsfolk

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
  private legL?: THREE.Mesh; private legR?: THREE.Mesh; private armL?: THREE.Mesh; private armR?: THREE.Mesh;
  private playerMixer: THREE.AnimationMixer | null = null;
  private playerPlay: ((name: string) => void) | null = null;
  private pvis = { x: 0, z: 0 };          // smoothed player world position
  private cam = new THREE.Vector3();
  private bob = 0;

  private sun!: THREE.DirectionalLight;
  private hemi!: THREE.HemisphereLight;
  private particles?: THREE.Points;
  private swayables: THREE.Object3D[] = [];     // grass tufts that gently sway
  private villagers: { obj: THREE.Object3D; x: number; z: number; tx: number; tz: number; spd: number }[] = [];
  private timeKey = '';
  private lastT = performance.now();
  // real CC0 (KayKit) model templates, cloned per placement
  private kitCache = new Map<string, THREE.Object3D>();
  private readonly TREES = ['/kit/nature/tree_single_A.gltf', '/kit/nature/tree_single_B.gltf', '/kit/nature/trees_A_medium.gltf', '/kit/nature/trees_B_medium.gltf', '/kit/nature/trees_A_small.gltf'];
  private readonly ROCKS = ['/kit/nature/rock_single_A.gltf', '/kit/nature/rock_single_B.gltf', '/kit/nature/rock_single_C.gltf'];

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

    // lighting — bright, soft, slightly warm (Let's Go daylight); refs kept for day/night
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x6a9a4a, 1.15);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
    this.sun.position.set(8, 16, 6); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const d = 24; const sc = this.sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -d; sc.right = d; sc.top = d; sc.bottom = -d; sc.near = 1; sc.far = 60;
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun);
    this.buildParticles();

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
    this.topbar.style.cssText = "position:absolute;top:0;left:0;right:0;background:linear-gradient(180deg,rgba(12,15,24,.72),rgba(12,15,24,0));backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding:13px 20px 24px;color:#eef3ff;font:600 14px 'Segoe UI',system-ui,sans-serif;letter-spacing:.2px;pointer-events:none";
    this.msgbar = document.createElement('div');
    this.msgbar.style.cssText = "position:absolute;bottom:22px;left:50%;transform:translateX(-50%);background:rgba(18,22,36,.7);backdrop-filter:blur(16px) saturate(1.2);-webkit-backdrop-filter:blur(16px) saturate(1.2);border:1px solid rgba(255,255,255,.14);color:#fff;padding:12px 26px;border-radius:18px;font:600 16px 'Segoe UI',system-ui,sans-serif;pointer-events:none;display:none;box-shadow:0 10px 30px rgba(0,0,0,.4)";
    this.host.appendChild(this.topbar);
    this.host.appendChild(this.msgbar);

    this.running = true;
    this.loop();
    this.preloadKit();
  }

  // Preload tree/rock/character models once; re-place the current area when ready.
  private async preloadKit() {
    this.loadPlayerModel();
    await Promise.all([
      ...this.TREES.map((p) => this.cacheKit(p, 2.0)),
      ...this.ROCKS.map((p) => this.cacheKit(p, 0.6)),
      ...NPC_MODELS.map((p) => this.cacheKit(p, 1.5)),
      this.cacheKit(WARDEN_MODEL, 1.6),
    ]);
    if (this.view) this.rebuildTiles(this.view);
  }

  // Swap the procedural placeholder player for the rigged Quaternius model.
  private async loadPlayerModel() {
    try {
      const c = await loadKayCharacter(PLAYER_MODEL, 1.7);
      this.player.clear();
      this.player.add(c.root);
      this.playerMixer = c.mixer; this.playerPlay = c.play; c.play('Idle_A');
    } catch { /* keep the procedural fallback */ }
  }
  private async cacheKit(path: string, h: number) {
    if (this.kitCache.has(path)) return;
    try { this.kitCache.set(path, await loadKit(path, h)); } catch { /* missing */ }
  }
  private kitClone(path: string): THREE.Object3D | null {
    const t = this.kitCache.get(path); if (!t) return null;
    const c = t.clone(true);
    c.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return c;
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

  // ---- W5: lived-in polish ------------------------------------------------

  private dotTexture(): THREE.Texture {
    const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, '#fff'); grd.addColorStop(0.35, '#fff'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }

  // drifting ambient motes (pollen by day / fireflies at night), follow the player
  private buildParticles() {
    const N = 150;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 36; pos[i * 3 + 1] = Math.random() * 5 + 0.4; pos[i * 3 + 2] = (Math.random() - 0.5) * 36; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    (geo as any).userData.base = pos.slice();
    const m = new THREE.PointsMaterial({ size: 0.16, map: this.dotTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xfff2b0, opacity: 0.55 });
    this.particles = new THREE.Points(geo, m);
    this.scene.add(this.particles);
  }

  // tint sky / lights / fog / particles by time of day
  private applyTimeOfDay(time: string) {
    const P: Record<string, { sky: number; fog: number; sunC: number; sunI: number; hemiI: number; ground: number; partC: number; partO: number }> = {
      morning: { sky: 0xd8ecff, fog: 0xdfeeff, sunC: 0xffe6c4, sunI: 1.05, hemiI: 1.1, ground: 0x6a9a4a, partC: 0xfff0c0, partO: 0.5 },
      day:     { sky: 0xbfeaff, fog: 0xbfeaff, sunC: 0xfff4e0, sunI: 1.2, hemiI: 1.2, ground: 0x6a9a4a, partC: 0xffffff, partO: 0.35 },
      night:   { sky: 0x3a4e7e, fog: 0x42578a, sunC: 0xb3bfe8, sunI: 0.8, hemiI: 1.05, ground: 0x40527a, partC: 0xfff3a0, partO: 0.95 },
    };
    const p = P[time] ?? P.day;
    (this.scene.background as THREE.Color).set(p.sky);
    (this.scene.fog as THREE.Fog).color.set(p.fog);
    this.sun.color.set(p.sunC); this.sun.intensity = p.sunI;
    this.hemi.color.set(p.sky); this.hemi.groundColor.set(p.ground); this.hemi.intensity = p.hemiI;
    if (this.particles) { (this.particles.material as THREE.PointsMaterial).color.set(p.partC); (this.particles.material as THREE.PointsMaterial).opacity = p.partO; (this.particles.material as THREE.PointsMaterial).size = time === 'night' ? 0.22 : 0.16; }
  }

  // a couple of villagers wandering the open ground near the path
  private spawnVillagers() {
    // wandering townsfolk belong in towns, not out on the dangerous rift routes
    if (this.builtLocation.startsWith('rift-') || this.builtLocation === 'world-core') return;
    const colors = [0x4a7fd6, 0xd66a9a, 0x6abf6a, 0xc8923a];
    const cx = this.mapW / 2, cz = this.mapH / 2;
    const n = 3;
    for (let k = 0; k < n; k++) {
      const obj = this.kitClone(NPC_MODELS[k % NPC_MODELS.length]) ?? this.character(colors[k % colors.length]);
      const x = cx + (Math.random() - 0.5) * (this.mapW - 6), z = cz + (Math.random() - 0.5) * (this.mapH - 6);
      obj.position.set(x, 0, z); this.tileGroup.add(obj);
      this.villagers.push({ obj, x, z, tx: x, tz: z, spd: 0.25 + Math.random() * 0.2 });
    }
  }

  // ---- tiles --------------------------------------------------------------

  private rebuildTiles(view: View) {
    this.tileGroup.clear();
    this.swayables = []; this.villagers = [];
    const tiles: string[][] = view.tiles;
    this.mapH = tiles.length; this.mapW = tiles[0].length;
    for (let y = 0; y < this.mapH; y++) {
      for (let x = 0; x < this.mapW; x++) {
        const t = tiles[y][x];
        const seed = x * 37 + y * 101;
        let obj: THREE.Object3D | null = null;
        if (t === 'wall') { obj = this.kitClone(this.TREES[seed % this.TREES.length]) ?? ((seed % 5 === 0) ? makePineTree(seed) : makeTree(seed)); obj.rotation.y = (seed % 4) * Math.PI / 2; }
        else if (t === 'grass') {
          // tall-grass tile: a grass tuft, sometimes a flower or bush for life
          const g = new THREE.Group(); g.add(makeGrassTuft(seed));
          if (seed % 3 === 0) { const f = makeFlower(seed + 1); f.position.set(0.25, 0, 0.2); g.add(f); }
          if (seed % 7 === 0) { const b = makeBush(seed + 2); b.position.set(-0.25, 0, -0.2); g.add(b); }
          obj = g; this.swayables.push(g);
        }
        else if (t === 'field') {
          // open grass ground: bare (ground plane shows), with the odd flower/tuft for life
          if (seed % 23 === 0) obj = makeFlower(seed);
          else if (seed % 17 === 0) { obj = makeGrassTuft(seed); this.swayables.push(obj); }
          else continue;
        }
        else if (t === 'center') { this.placeKit('building_C', x, y, 2.6); continue; }
        else if (t === 'shop') { this.placeKit('building_B', x, y, 2.4); continue; }
        else if (t === 'gym') { this.placeKit('building_G', x, y, 3.0); continue; }
        else if (t === 'npc') obj = this.kitClone(NPC_MODELS[seed % NPC_MODELS.length]) ?? this.character(0x5a8fd6);
        else if (t === 'warden') {
          const w = this.kitClone(WARDEN_MODEL);
          if (w) { w.scale.multiplyScalar(1.4); w.rotation.y = -Math.PI / 2; obj = w; } // bigger, faces the approaching player
          else obj = this.character(0xc0392b);
        }
        else if (t === 'floor' || t === 'exit') {
          const path = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.06, 0.98), new THREE.MeshStandardMaterial({ color: t === 'exit' ? '#e6cf86' : '#d9c28c' }));
          path.position.set(x, 0.0, y); path.receiveShadow = true; this.tileGroup.add(path); continue;
        }
        if (obj) { obj.position.set(x, 0, y); this.tileGroup.add(obj); }
      }
    }
    this.scatterDecor();
    this.spawnVillagers();
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
        if (r < 0.5) { obj = this.kitClone(this.TREES[i % this.TREES.length]) ?? makeTree(i); obj.rotation.y = (i % 4) * Math.PI / 2; }  // dense tree-line
        else if (r < 0.58) obj = this.kitClone(this.ROCKS[i % this.ROCKS.length]) ?? makeRock(i);
        else if (r < 0.64) obj = makeFlower(i);
        else if (r < 0.72) obj = makeGrassTuft(i);
        if (obj) { obj.position.set(x, 0, z); this.tileGroup.add(obj); }
        i++;
      }
    }
    // a few real cottages just outside the play area for a village feel
    const houses = ['building_A', 'building_D', 'building_E', 'building_H'];
    [[-3, 2], [W + 2.5, H - 2], [-2.5, H + 3], [W + 3, 3]].forEach(([hx, hz], k) => this.placeKit(houses[k % houses.length], hx, hz, 2.2));
  }

  // Load a real CC0 (KayKit) building model and drop it at a tile, grounded.
  // Async — guarded against the location changing while it loads.
  private async placeKit(name: string, x: number, y: number, h: number) {
    const loc = this.builtLocation;
    try {
      const m = await loadKit(`/kit/city/${name}.gltf`, h);
      if (this.builtLocation !== loc) return;
      m.position.set(x, 0, y);
      this.tileGroup.add(m);
    } catch { /* asset missing — skip */ }
  }

  // ---- frame --------------------------------------------------------------

  render(view: View) {
    this.view = view;
    if (view.locationId !== this.builtLocation) {
      this.builtLocation = view.locationId;
      this.rebuildTiles(view);
      this.pvis = { x: view.player.x, z: view.player.y };  // snap on location change
    }
    if (view.time && view.time !== this.timeKey) { this.timeKey = view.time; this.applyTimeOfDay(view.time); }
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
    const bobY = this.playerMixer ? 0 : Math.abs(Math.sin(performance.now() / 90)) * this.bob * 0.1;
    this.player.position.set(this.pvis.x, bobY, this.pvis.z);
    const faceAngle = { down: 0, up: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }[this.facing];
    this.player.rotation.y += (faceAngle - this.player.rotation.y) * 0.3;
    if (this.playerPlay) {
      this.playerPlay(this.bob > 0.15 ? 'Walking_A' : 'Idle_A'); // rigged model: clip-based
    } else if (this.legL && this.legR && this.armL && this.armR) {
      // procedural fallback walk cycle
      const swing = Math.sin(performance.now() / 80) * Math.min(this.bob, 1) * 0.7;
      this.legL.rotation.x = swing; this.legR.rotation.x = -swing;
      this.armL.rotation.x = -swing * 0.8; this.armR.rotation.x = swing * 0.8;
    }

    // follow camera (tilted 3/4, Let's Go-ish)
    const target = new THREE.Vector3(this.pvis.x, 0.7, this.pvis.z);
    const want = new THREE.Vector3(this.pvis.x, 9.5, this.pvis.z + 8.8);
    this.cam.lerp(want, 0.12); if (this.cam.length() === 0) this.cam.copy(want);
    this.camera.position.copy(this.cam);
    this.camera.lookAt(target);

    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - this.lastT / 1000); this.lastT = performance.now();
    this.playerMixer?.update(dt);

    // grass sway — gentle wind, phase offset by position
    for (const s of this.swayables) s.rotation.z = Math.sin(now * 1.6 + s.position.x * 0.7 + s.position.z * 0.5) * 0.12;

    // wandering villagers
    for (const v of this.villagers) {
      const dx = v.tx - v.x, dz = v.tz - v.z; const d = Math.hypot(dx, dz);
      if (d < 0.15) { v.tx = this.mapW / 2 + (Math.random() - 0.5) * (this.mapW - 6); v.tz = this.mapH / 2 + (Math.random() - 0.5) * (this.mapH - 6); }
      else { v.x += (dx / d) * v.spd * dt; v.z += (dz / d) * v.spd * dt; v.obj.rotation.y = Math.atan2(dx, dz); }
      v.obj.position.set(v.x, Math.abs(Math.sin(now * 6 + v.x)) * 0.04, v.z);
    }

    // ambient motes drift + follow the player loosely
    if (this.particles) {
      this.particles.position.set(this.pvis.x, 0, this.pvis.z);
      const pos = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
      const base = (this.particles.geometry as any).userData.base as Float32Array;
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, base[i * 3] + Math.sin(now * 0.4 + i) * 0.6);
        pos.setY(i, base[i * 3 + 1] + Math.sin(now * 0.7 + i * 1.3) * 0.4);
        pos.setZ(i, base[i * 3 + 2] + Math.cos(now * 0.35 + i) * 0.6);
      }
      pos.needsUpdate = true;
    }

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
