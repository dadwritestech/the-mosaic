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

// Load a CC0 GLTF asset (e.g. KayKit), normalized to targetHeight and grounded.
export async function loadKit(path: string, targetHeight = 2): Promise<THREE.Object3D> {
  const gltf = await gltfLoader().loadAsync(path);
  const root = gltf.scene;
  root.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) o.material.metalness = 0; } });
  const size = new THREE.Vector3(); new THREE.Box3().setFromObject(root).getSize(size);
  root.scale.setScalar(targetHeight / Math.max(size.y, 0.001));
  const grounded = new THREE.Box3().setFromObject(root);
  root.position.y -= grounded.min.y;
  return root;
}

export interface LoadedModel { root: THREE.Object3D; mixer: THREE.AnimationMixer | null; }

// Load a real 3D Pokémon model, normalized to `targetHeight` units and grounded.
// Plays its first animation clip (idle) if present, returning a mixer to update.
export async function loadModel(dexNum: number, targetHeight = 1.5): Promise<LoadedModel> {
  const gltf = await gltfLoader().loadAsync(modelUrl(dexNum));
  const root = gltf.scene;
  root.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // Normalize by the LARGEST dimension, not height: flat/sprawling mons (spiders,
  // snakes, fish) have a tiny bbox height and would otherwise balloon when scaled
  // to a target height. Max-extent keeps relative sizes sane across body shapes.
  const size = new THREE.Vector3(); new THREE.Box3().setFromObject(root).getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  root.scale.setScalar(targetHeight / maxDim);
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

export interface LoadedChar { root: THREE.Object3D; mixer: THREE.AnimationMixer; play: (name: string) => void; }

// KayKit characters carry no clips — animations live in shared Rig_Medium files.
// Load them once and reuse across every character (same skeleton bone names).
let _kayClips: Promise<Map<string, THREE.AnimationClip>> | null = null;
function kayClips(): Promise<Map<string, THREE.AnimationClip>> {
  if (_kayClips) return _kayClips;
  _kayClips = (async () => {
    const m = new Map<string, THREE.AnimationClip>();
    for (const p of ['/kit/adventurers/Rig_Medium_General.glb', '/kit/adventurers/Rig_Medium_MovementBasic.glb']) {
      const g = await gltfLoader().loadAsync(p);
      for (const c of g.animations) m.set(c.name, c);
    }
    return m;
  })();
  return _kayClips;
}

// Load a KayKit Adventurers character (skinned, embedded texture) and bind the
// shared animation clips to it, normalized to targetHeight and grounded.
export async function loadKayCharacter(path: string, targetHeight = 1.7): Promise<LoadedChar> {
  const [gltf, clips] = await Promise.all([gltfLoader().loadAsync(path), kayClips()]);
  const root = gltf.scene;
  root.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const size = new THREE.Vector3(); new THREE.Box3().setFromObject(root).getSize(size);
  root.scale.setScalar(targetHeight / Math.max(size.y, 0.001));
  const grounded = new THREE.Box3().setFromObject(root); root.position.y -= grounded.min.y;
  const mixer = new THREE.AnimationMixer(root);
  let current = '';
  const play = (name: string) => {
    if (name === current) return;
    const clip = clips.get(name) ?? clips.get('Idle_A');
    if (!clip) return;
    mixer.stopAllAction();
    mixer.clipAction(clip).reset().fadeIn(0.2).play();
    current = name;
  };
  return { root, mixer, play };
}

// Load a rigged character GLB (e.g. Quaternius), normalized to targetHeight and
// grounded, exposing a `play(clipName)` that cross-switches animations by name
// (matches 'Walk'/'Idle' regardless of the 'Armature|Walk' prefix). Static models
// (no clips) return a no-op play.
export async function loadCharacter(path: string, targetHeight = 1.7): Promise<LoadedChar> {
  const gltf = await gltfLoader().loadAsync(path);
  const root = gltf.scene;
  root.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const size = new THREE.Vector3(); new THREE.Box3().setFromObject(root).getSize(size);
  root.scale.setScalar(targetHeight / Math.max(size.y, 0.001));
  const grounded = new THREE.Box3().setFromObject(root); root.position.y -= grounded.min.y;
  const mixer = new THREE.AnimationMixer(root);
  const byName = new Map<string, THREE.AnimationClip>();
  for (const c of gltf.animations) byName.set(c.name.replace(/^.*\|/, ''), c);
  let current = '';
  const play = (name: string) => {
    if (name === current) return;
    const clip = byName.get(name) ?? gltf.animations[0];
    if (!clip) return;
    mixer.stopAllAction();
    mixer.clipAction(clip).reset().fadeIn(0.2).play();
    current = name;
  };
  return { root, mixer, play };
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
