import * as THREE from 'three';
import { spriteUrl } from '../assets/manifest';

export async function loadCreature(species: string, side: 'front' | 'back'): Promise<THREE.Sprite> {
  const tex = await new THREE.TextureLoader().loadAsync(spriteUrl(species, side));
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  s.scale.set(2.6, 2.6, 1);
  return s;
}
