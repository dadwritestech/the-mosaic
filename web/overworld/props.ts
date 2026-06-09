import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

/** Quick MeshStandardMaterial with the low-poly look baked in. */
function mat(
  color: string | number,
  opts?: { roughness?: number; metalness?: number; flatShading?: boolean },
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts?.roughness ?? 0.9,
    metalness: opts?.metalness ?? 0.0,
    flatShading: opts?.flatShading ?? true,
  });
}

/** Deterministic pseudo-random in [0,1) derived from seed + index. */
function seeded(seed: number, n: number): number {
  const x = Math.sin(seed * 99 + n) * 1e4;
  return x - Math.floor(x);
}


/** Linear interpolation. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/* ------------------------------------------------------------------ */
/*  1. Deciduous tree — tapered trunk + layered foliage blobs           */
/* ------------------------------------------------------------------ */
export function makeTree(seed = 0): THREE.Group {
  const group = new THREE.Group();

  const trunkH = lerp(0.45, 0.62, seeded(seed, 1));
  const trunkR = lerp(0.1, 0.14, seeded(seed, 2));

  // Trunk — tapered, a touch of lean
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(trunkR * 0.7, trunkR, trunkH, 7), mat('#6b4a2f'));
  trunk.position.y = trunkH / 2;
  trunk.rotation.z = (seeded(seed, 0) - 0.5) * 0.08;
  trunk.castShadow = true; trunk.receiveShadow = true;
  group.add(trunk);

  // Canopy — a cohesive rounded two-tone dome (detail-1 icosahedra = smooth low-poly),
  // a wide darker base mass topped by a lighter dome. Reads as a real tree, not blobs.
  const lights = ['#6cbf4a', '#74c957', '#62b63f'];
  const lightG = lights[Math.floor(seeded(seed, 3) * lights.length)];
  const darkG = '#3f8f2c';
  const r = lerp(0.58, 0.74, seeded(seed, 4));
  const baseY = trunkH + r * 0.55;

  const lower = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat(darkG));
  lower.scale.set(1.18, 0.82, 1.18); lower.position.y = baseY;
  lower.rotation.y = seeded(seed, 5) * Math.PI;
  lower.castShadow = true; lower.receiveShadow = true;
  group.add(lower);

  const upper = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.82, 1), mat(lightG));
  upper.scale.set(1.0, 0.92, 1.0); upper.position.y = baseY + r * 0.42;
  upper.rotation.y = seeded(seed, 6) * Math.PI + 0.6;
  upper.castShadow = true; upper.receiveShadow = true;
  group.add(upper);

  return group;
}

/* ------------------------------------------------------------------ */
/*  2. Pine tree — trunk + stacked conical tiers                        */
/* ------------------------------------------------------------------ */
export function makePineTree(seed = 0): THREE.Group {
  const group = new THREE.Group();

  const trunkH = lerp(0.5, 0.7, seeded(seed, 0));
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.1, trunkH, 6, 1),
    mat('#6b4226'),
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const tierCount = Math.floor(lerp(2, 3, seeded(seed, 1)));
  const totalH = lerp(2.2, 2.8, seeded(seed, 2));
  const baseY = trunkH - 0.1;

  for (let i = 0; i < tierCount; i++) {
    const t = i / (tierCount - 1 || 1);
    const radius = lerp(0.65, 0.15, t) * (0.9 + seeded(seed, 10 + i) * 0.2);
    const h = totalH / tierCount * 1.1;
    const geo = new THREE.ConeGeometry(radius, h, 9, 1);
    const shade = i % 2 === 0 ? '#357324' : '#46862e';
    const mesh = new THREE.Mesh(geo, mat(shade));
    mesh.position.y = baseY + t * (totalH - trunkH) + h * 0.3;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group;
}

/* ------------------------------------------------------------------ */
/*  3. Rock cluster — 1-3 irregular grey boulders                       */
/* ------------------------------------------------------------------ */
export function makeRock(seed = 0): THREE.Group {
  const group = new THREE.Group();

  const count = Math.floor(lerp(1, 3, seeded(seed, 0)));
  const greys = ['#9a9a8f', '#8a8a7f', '#a5a59a', '#88887e'];

  for (let i = 0; i < count; i++) {
    const s = lerp(0.25, 0.55, seeded(seed, 10 + i));
    const geo = new THREE.IcosahedronGeometry(s, 0);
    const mesh = new THREE.Mesh(geo, mat(greys[Math.floor(seeded(seed, 20 + i) * greys.length)]));
    mesh.position.set(
      (seeded(seed, 30 + i) - 0.5) * s * 1.2,
      s * 0.55,
      (seeded(seed, 40 + i) - 0.5) * s * 1.2,
    );
    mesh.scale.set(
      0.7 + seeded(seed, 50 + i) * 0.6,
      0.5 + seeded(seed, 60 + i) * 0.5,
      0.7 + seeded(seed, 70 + i) * 0.6,
    );
    mesh.rotation.set(
      seeded(seed, 80 + i) * Math.PI,
      seeded(seed, 90 + i) * Math.PI,
      seeded(seed, 100 + i) * Math.PI,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group;
}

/* ------------------------------------------------------------------ */
/*  4. Bush — 2-3 overlapping rounded green blobs                       */
/* ------------------------------------------------------------------ */
export function makeBush(seed = 0): THREE.Group {
  const group = new THREE.Group();

  const count = Math.floor(lerp(2, 3, seeded(seed, 0)));
  const greens = ['#5fae3c', '#4c9a32', '#3c8a2a'];

  for (let i = 0; i < count; i++) {
    const radius = lerp(0.18, 0.3, seeded(seed, 10 + i));
    const geo = new THREE.IcosahedronGeometry(radius, 0);
    const mesh = new THREE.Mesh(geo, mat(greens[i % greens.length]));
    mesh.position.set(
      (seeded(seed, 20 + i) - 0.5) * 0.3,
      radius * 0.7 + seeded(seed, 30 + i) * 0.1,
      (seeded(seed, 40 + i) - 0.5) * 0.3,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group;
}

/* ------------------------------------------------------------------ */
/*  5. Flower — thin stem + small colored petal cluster                 */
/* ------------------------------------------------------------------ */
export function makeFlower(seed = 0): THREE.Group {
  const group = new THREE.Group();

  const stemH = lerp(0.15, 0.22, seeded(seed, 0));
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.015, stemH, 4, 1),
    mat('#4c9a32'),
  );
  stem.position.y = stemH / 2;
  stem.castShadow = true;
  group.add(stem);

  // Petal cluster — small flat cylinder
  const petalColors = ['#f08090', '#ffe066', '#ffffff', '#e04040', '#ffb3c1'];
  const petalColor = petalColors[Math.floor(seeded(seed, 1) * petalColors.length)];
  const petalR = lerp(0.06, 0.1, seeded(seed, 2));
  const petals = new THREE.Mesh(
    new THREE.CylinderGeometry(petalR, petalR, 0.03, 6, 1),
    mat(petalColor),
  );
  petals.position.y = stemH + 0.015;
  petals.castShadow = true;
  group.add(petals);

  // Tiny center
  const center = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.025, 0),
    mat('#ffe066'),
  );
  center.position.y = stemH + 0.02;
  center.castShadow = true;
  group.add(center);

  return group;
}

/* ------------------------------------------------------------------ */
/*  6. Grass tuft — 4-6 splayed tapered blades                          */
/* ------------------------------------------------------------------ */
export function makeGrassTuft(seed = 0): THREE.Group {
  const group = new THREE.Group();

  const count = Math.floor(lerp(4, 6, seeded(seed, 0)));
  const greens = ['#5fae3c', '#4c9a32', '#6bbf4a'];

  for (let i = 0; i < count; i++) {
    const h = lerp(0.2, 0.35, seeded(seed, 10 + i));
    const geo = new THREE.ConeGeometry(0.02, h, 4, 1);
    const mesh = new THREE.Mesh(geo, mat(greens[i % greens.length]));

    const angle = seeded(seed, 20 + i) * Math.PI * 2;
    const spread = seeded(seed, 30 + i) * 0.25;
    mesh.position.set(
      Math.cos(angle) * spread,
      h / 2,
      Math.sin(angle) * spread,
    );
    mesh.rotation.set(
      Math.sin(angle) * 0.3,
      0,
      Math.cos(angle) * 0.3,
    );
    mesh.castShadow = true;
    group.add(mesh);
  }

  return group;
}

/* ------------------------------------------------------------------ */
/*  7. Fence segment — 2 posts + 2 rails, 1 unit wide along X           */
/* ------------------------------------------------------------------ */
export function makeFence(): THREE.Group {
  const group = new THREE.Group();

  const postH = 0.6;
  const postW = 0.06;
  const railH = 0.04;
  const railW = 0.035;
  const halfW = 0.5; // 1-unit total width

  const postGeo = new THREE.BoxGeometry(postW, postH, postW);
  const woodMat = mat('#8b6914');

  // Two posts
  for (const x of [-halfW, halfW]) {
    const post = new THREE.Mesh(postGeo, woodMat);
    post.position.set(x, postH / 2, 0);
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);
  }

  // Two horizontal rails
  const railGeo = new THREE.BoxGeometry(1.0, railH, railW);
  for (const y of [0.18, 0.42]) {
    const rail = new THREE.Mesh(railGeo, woodMat);
    rail.position.set(0, y, 0);
    rail.castShadow = true;
    rail.receiveShadow = true;
    group.add(rail);
  }

  return group;
}

/* ------------------------------------------------------------------ */
/*  8. Signpost — vertical post + angled board near the top             */
/* ------------------------------------------------------------------ */
export function makeSignpost(): THREE.Group {
  const group = new THREE.Group();

  const postH = 1.0;
  const postW = 0.08;
  const woodMat = mat('#8b6914');

  // Post
  const post = new THREE.Mesh(
    new THREE.BoxGeometry(postW, postH, postW),
    woodMat,
  );
  post.position.y = postH / 2;
  post.castShadow = true;
  post.receiveShadow = true;
  group.add(post);

  // Board — slightly angled, near top
  const boardW = 0.45;
  const boardH = 0.25;
  const boardD = 0.04;
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(boardW, boardH, boardD),
    mat('#a07828'),
  );
  board.position.set(0, postH - 0.15, boardD / 2 + 0.02);
  board.rotation.z = -0.08; // slight tilt
  board.castShadow = true;
  board.receiveShadow = true;
  group.add(board);

  return group;
}
