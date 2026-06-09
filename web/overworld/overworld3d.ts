import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { makeTree, makePineTree, makeGrassTuft, makeFlower, makeBush, makeRock } from './props';
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
    const mk = (geo: THREE.BufferGeometry, color: number, y: number) => {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
      m.position.y = y; m.castShadow = true; return m;
    };
    this.player.add(mk(new THREE.CapsuleGeometry(0.22, 0.32, 4, 10), 0xe0533a, 0.42)); // body (red)
    this.player.add(mk(new THREE.SphereGeometry(0.2, 16, 14), 0xf2c9a0, 0.82));          // head
    const cap = mk(new THREE.SphereGeometry(0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0x7a2d20, 0.9);
    this.player.add(cap);                                                                 // cap
    this.player.add(mk(new THREE.BoxGeometry(0.12, 0.28, 0.12), 0x33405a, 0.16));         // legs block
  }

  private character(color: number): THREE.Group {
    const g = new THREE.Group();
    const mk = (geo: THREE.BufferGeometry, c: number, y: number) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: c, roughness: .85 })); m.position.y = y; m.castShadow = true; return m; };
    g.add(mk(new THREE.CapsuleGeometry(0.2, 0.28, 4, 8), color, 0.4));
    g.add(mk(new THREE.SphereGeometry(0.18, 12, 10), 0xf2c9a0, 0.78));
    return g;
  }

  private building(roof: number): THREE.Group {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.6, 0.82), new THREE.MeshStandardMaterial({ color: 0xe9e3d6 }));
    wall.position.y = 0.3; wall.castShadow = true; wall.receiveShadow = true; g.add(wall);
    const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.4, 4), new THREE.MeshStandardMaterial({ color: roof }));
    roofMesh.position.y = 0.8; roofMesh.rotation.y = Math.PI / 4; roofMesh.castShadow = true; g.add(roofMesh);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.04), new THREE.MeshStandardMaterial({ color: 0x5a4633 }));
    door.position.set(0, 0.15, 0.42); g.add(door);
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
        else if (t === 'center') obj = this.building(0xe0533a);
        else if (t === 'shop') obj = this.building(0x3a7bd6);
        else if (t === 'gym') obj = this.building(0x9a55c8);
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
    for (let gx = -8; gx <= W + 8; gx++) {
      for (let gz = -8; gz <= H + 8; gz++) {
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
    this.player.position.set(this.pvis.x, Math.abs(Math.sin(performance.now() / 90)) * this.bob * 0.12, this.pvis.z);
    const faceAngle = { down: 0, up: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }[this.facing];
    this.player.rotation.y += (faceAngle - this.player.rotation.y) * 0.3;

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
