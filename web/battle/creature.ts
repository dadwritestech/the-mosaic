import * as THREE from 'three';
import { spriteUrl, homeUrl } from '../assets/manifest';

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
