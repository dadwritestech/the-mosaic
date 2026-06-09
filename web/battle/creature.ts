import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { spriteUrl, homeUrl, modelUrl } from '../assets/manifest';

// Shared GLTF loader with the Draco decoder (models are Draco-compressed).
let _gltf: GLTFLoader | null = null;
function gltfLoader(): GLTFLoader {
  if (_gltf) return _gltf;
  const draco = new DRACOLoader();
  draco.setDecoderPath('/draco/'); // served from web/public/draco (bundled, no CDN)
  _gltf = new GLTFLoader();
  _gltf.setDRACOLoader(draco);
  return _gltf;
}

export interface LoadedModel { root: THREE.Object3D; mixer: THREE.AnimationMixer | null; }

// Load a real 3D Pokémon model, normalized to `targetHeight` units and grounded.
// Plays its first animation clip (idle) if present, returning a mixer to update.
export async function loadModel(dexNum: number, targetHeight = 1.5): Promise<LoadedModel> {
  const gltf = await gltfLoader().loadAsync(modelUrl(dexNum));
  const root = gltf.scene;
  root.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // normalize scale to a consistent on-field height
  const size = new THREE.Vector3(); new THREE.Box3().setFromObject(root).getSize(size);
  root.scale.setScalar(targetHeight / Math.max(size.y, 0.001));
  // drop to ground (min.y -> 0)
  const grounded = new THREE.Box3().setFromObject(root);
  root.position.y -= grounded.min.y;
  let mixer: THREE.AnimationMixer | null = null;
  if (gltf.animations?.length) {
    mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(gltf.animations[0]).play();
  }
  return { root, mixer };
}

export async function loadCreature(species: string, side: 'front' | 'back'): Promise<THREE.Sprite> {
  const tex = await new THREE.TextureLoader().loadAsync(spriteUrl(species, side));
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  s.scale.set(2.6, 2.6, 1);
  return s;
}

// Crisp high-res billboard from the HOME 3D-model render (much cleaner than the
// pixelated battle GIF). Used in the overworld field and as a battle fallback.
export async function loadHomeBillboard(dexNum: number): Promise<THREE.Sprite> {
  const tex = await new THREE.TextureLoader().loadAsync(homeUrl(dexNum));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  s.scale.set(2.6, 2.6, 1);
  return s;
}
