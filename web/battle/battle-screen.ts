import * as THREE from 'three';
import { loadCreature } from './creature';
import { Hud } from '../ui/hud';
import type { View } from '../net';

export class BattleScreen {
  private renderer = new THREE.WebGLRenderer({ antialias: true });
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  private hud: Hud;
  private selfObj?: THREE.Object3D;
  private foeObj?: THREE.Object3D;
  private selfSpecies = '';
  private foeSpecies = '';
  private running = false;

  constructor(private host: HTMLElement, private onAction: (cmd: string, body?: Record<string, unknown>) => void) {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.domElement.style.cssText = 'position:absolute;inset:0';
    this.host.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color('#bfe9ff');
    const ground = new THREE.Mesh(new THREE.CircleGeometry(7, 40), new THREE.MeshStandardMaterial({ color: '#86c45a' }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.2; this.scene.add(ground);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x557755, 1.2));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6); dir.position.set(3, 6, 4); this.scene.add(dir);
    this.camera.position.set(0, 3.6, 6.4); this.camera.lookAt(0, 1.1, 0);
    this.hud = new Hud(this.host, {
      onMove: (i) => this.onAction('turn', { index: i }),
      onSwitch: (i) => this.onAction('switchMon', { index: i }),
      onBall: (ball) => this.onAction('catch', { ball }),
    });
  }

  async render(view: View) {
    if (view.self.species !== this.selfSpecies) {
      this.selfSpecies = view.self.species;
      if (this.selfObj) this.scene.remove(this.selfObj);
      this.selfObj = await loadCreature(this.selfSpecies, 'back'); this.selfObj.position.set(-2.4, 1.1, 1.2); this.scene.add(this.selfObj);
    }
    if (view.foe.species !== this.foeSpecies) {
      this.foeSpecies = view.foe.species;
      if (this.foeObj) this.scene.remove(this.foeObj);
      this.foeObj = await loadCreature(this.foeSpecies, 'front'); this.foeObj.position.set(2.4, 1.5, -1.2); this.scene.add(this.foeObj);
    }
    this.hud.render({
      self: { name: `${view.self.species} L${view.self.level}`, hp: view.self.hpPercent, status: view.self.status, boosts: view.self.boosts ?? {}, volatiles: view.self.volatiles ?? [], item: view.self.heldItem || undefined },
      foe: { name: `${view.foe.species}`, hp: view.foe.hpPercent, status: view.foe.status, boosts: view.foe.boosts ?? {}, volatiles: view.foe.volatiles ?? [] },
      weather: view.weather ?? '', terrain: view.terrain ?? '',
      moves: view.moves, switches: view.switches ?? [], balls: view.balls ?? [],
      canCatch: view.canCatch, log: view.log,
    });
    if (!this.running) { this.running = true; this.loop(); }
  }
  private loop = () => { if (!this.running) return; this.renderer.render(this.scene, this.camera); requestAnimationFrame(this.loop); };
  dispose() { this.running = false; this.hud.clear(); this.renderer.domElement.remove(); this.renderer.dispose(); }
}
