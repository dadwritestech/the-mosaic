import * as THREE from 'three';
import { loadModel } from './battle/creature';

// Quick standalone viewer to confirm the repo's 3D Pokemon models load + animate.
// ?dex=25 (Pikachu) by default; try ?dex=6 (Charizard), ?dex=1 (Bulbasaur), etc.
const dex = Number(new URLSearchParams(location.search).get('dex') ?? '25');

const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x171a2b);

const cam = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
cam.position.set(0, 1.5, 3.4);
cam.lookAt(0, 0.8, 0);

scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x352a44, 1.3));
const key = new THREE.DirectionalLight(0xffffff, 2.0);
key.position.set(3, 6, 4); key.castShadow = true; scene.add(key);
const rim = new THREE.DirectionalLight(0x99bbff, 1.0);
rim.position.set(-4, 3, -3); scene.add(rim);

// soft ground disc + grid so the model is clearly grounded
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(6, 48),
  new THREE.MeshStandardMaterial({ color: 0x20243c, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const grid = new THREE.GridHelper(12, 24, 0x3a4170, 0x262a47);
(grid.material as THREE.Material).transparent = true; (grid.material as any).opacity = 0.4; scene.add(grid);

let modelRoot: THREE.Object3D | null = null;
let mixer: THREE.AnimationMixer | null = null;

loadModel(dex, 1.6)
  .then(({ root, mixer: m }) => {
    modelRoot = root; mixer = m;
    root.traverse((o: any) => { if (o.isMesh) o.castShadow = true; });
    scene.add(root);
    document.title = `dex ${dex} loaded${m ? ' (animated)' : ' (static)'}`;
    (window as any).__loaded = true;
  })
  .catch((e) => {
    document.title = `ERROR dex ${dex}: ${e.message}`;
    (window as any).__error = String(e);
    console.error(e);
  });

const clock = new THREE.Clock();
function tick() {
  const dt = clock.getDelta();
  if (mixer) mixer.update(dt);
  if (modelRoot) modelRoot.rotation.y += dt * 0.6;
  renderer.render(scene, cam);
  requestAnimationFrame(tick);
}
tick();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  cam.aspect = window.innerWidth / window.innerHeight; cam.updateProjectionMatrix();
});
