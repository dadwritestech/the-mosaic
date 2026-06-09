import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

/** Quick MeshStandardMaterial with flat shading, shadows, and defaults. */
function mat(
  color: number | string,
  opts?: { roughness?: number; metalness?: number; transparent?: boolean; opacity?: number }
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts?.roughness ?? 0.85,
    metalness: opts?.metalness ?? 0.0,
    flatShading: true,
    transparent: opts?.transparent ?? false,
    opacity: opts?.opacity ?? 1.0,
  });
}

/**
 * Build a pitched / gabled roof as a group.
 *
 *  The roof consists of two angled slabs meeting at a central ridge,
 *  plus thin gable-end triangles that fill the triangular wall gaps.
 *
 *  @param width  – footprint width along X (ridge runs along X)
 *  @param depth  – footprint depth along Z
 *  @param height – ridge height above the base plane
 *  @param color  – roof colour
 */
function gableRoof(
  width: number,
  depth: number,
  height: number,
  color: number | string
): THREE.Group {
  const g = new THREE.Group();
  const roofMat = mat(color);

  const slopeLength = Math.sqrt((depth / 2) ** 2 + height ** 2);
  const angle = Math.atan2(height, depth / 2);

  // Two angled roof slabs
  for (let side = -1; side <= 1; side += 2) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(width + 0.12, 0.08, slopeLength), roofMat);
    slab.position.set(0, height / 2, (side * depth) / 4);
    slab.rotation.x = side * -angle;
    slab.castShadow = true;
    slab.receiveShadow = true;
    g.add(slab);
  }

  // Gable-end triangles (front + back, along +Z and -Z)
  const triShape = new THREE.Shape();
  triShape.moveTo(-width / 2, 0);
  triShape.lineTo(0, height);
  triShape.lineTo(width / 2, 0);
  triShape.lineTo(-width / 2, 0);

  const triGeo = new THREE.ExtrudeGeometry(triShape, {
    depth: 0.06,
    bevelEnabled: false,
  });
  for (const zSign of [-1, 1] as const) {
    const tri = new THREE.Mesh(triGeo, roofMat);
    tri.position.set(0, 0, (zSign * depth) / 2 - 0.03);
    if (zSign === -1) {
      tri.rotation.y = Math.PI;
    }
    tri.castShadow = true;
    g.add(tri);
  }

  return g;
}

/** A simple door mesh (flat panel in a frame). */
function door(
  w: number,
  h: number,
  frameColor: number | string,
  panelColor: number | string
): THREE.Group {
  const g = new THREE.Group();

  // Frame
  const frameThick = 0.06;
  const frameDepth = 0.08;
  const topBar = new THREE.Mesh(
    new THREE.BoxGeometry(w + frameThick * 2, frameThick, frameDepth),
    mat(frameColor)
  );
  topBar.position.y = h / 2;
  topBar.castShadow = true;
  g.add(topBar);

  const botBar = topBar.clone();
  botBar.position.y = -h / 2;
  g.add(botBar);

  for (const side of [-1, 1] as const) {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(frameThick, h, frameDepth),
      mat(frameColor)
    );
    pillar.position.set((side * w) / 2, 0, 0);
    pillar.castShadow = true;
    g.add(pillar);
  }

  // Panel
  const panel = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, h - 0.02, 0.04), mat(panelColor));
  panel.castShadow = true;
  g.add(panel);

  return g;
}

/** A window with frame + glass. */
function windowMesh(
  w: number,
  h: number,
  frameColor: number | string
): THREE.Group {
  const g = new THREE.Group();
  const ft = 0.05;
  const d = 0.07;

  // Frame bars
  const topBar = new THREE.Mesh(new THREE.BoxGeometry(w + ft * 2, ft, d), mat(frameColor));
  topBar.position.y = h / 2;
  topBar.castShadow = true;
  g.add(topBar);

  const botBar = topBar.clone();
  botBar.position.y = -h / 2;
  g.add(botBar);

  for (const side of [-1, 1] as const) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(ft, h, d), mat(frameColor));
    pillar.position.set((side * w) / 2, 0, 0);
    pillar.castShadow = true;
    g.add(pillar);
  }

  // Cross bar
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(w, ft * 0.6, d * 0.6), mat(frameColor));
  g.add(crossH);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(ft * 0.6, h, d * 0.6), mat(frameColor));
  g.add(crossV);

  // Glass
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.02, h - 0.02, 0.02),
    mat(0x8ec8e8, { roughness: 0.2, transparent: true, opacity: 0.45 })
  );
  g.add(glass);

  return g;
}

/* ------------------------------------------------------------------ */
/*  1. Pokémon Center                                                  */
/* ------------------------------------------------------------------ */

/** Bright welcoming Pokémon Center: white walls, red gabled roof, Poké-Ball sign. */
export function makePokemonCenter(): THREE.Group {
  const building = new THREE.Group();

  const wallW = 1.8;
  const wallD = 1.8;
  const wallH = 1.7;
  const wallColor = 0xf5f0e6; // cream/white

  // Foundation step
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(wallW + 0.2, 0.12, wallD + 0.2),
    mat(0xd4cfc4)
  );
  foundation.position.y = 0.06;
  foundation.receiveShadow = true;
  foundation.castShadow = true;
  building.add(foundation);

  // Wall body
  const walls = new THREE.Mesh(new THREE.BoxGeometry(wallW, wallH, wallD), mat(wallColor));
  walls.position.y = 0.12 + wallH / 2;
  walls.castShadow = true;
  walls.receiveShadow = true;
  building.add(walls);

  // Roof
  const roof = gableRoof(wallW, wallD, 0.8, 0xd92626);
  roof.position.y = 0.12 + wallH;
  building.add(roof);

  // Sliding glass door (wide bluish)
  const d = door(0.7, 0.85, 0x3d3d3d, 0x6bbce8);
  d.position.set(0, 0.12 + 0.425, wallD / 2 + 0.01);
  building.add(d);

  // Windows on side walls
  const winL = windowMesh(0.35, 0.35, 0x3d3d3d);
  winL.position.set(-wallW / 2 - 0.01, 0.12 + wallH * 0.55, 0);
  winL.rotation.y = -Math.PI / 2;
  building.add(winL);

  const winR = windowMesh(0.35, 0.35, 0x3d3d3d);
  winR.position.set(wallW / 2 + 0.01, 0.12 + wallH * 0.55, 0);
  winR.rotation.y = Math.PI / 2;
  building.add(winR);

  // Sign board above door (red rectangle)
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.22, 0.06),
    mat(0xd92626)
  );
  signBoard.position.set(0, 0.12 + wallH + 0.15, wallD / 2 + 0.04);
  signBoard.castShadow = true;
  building.add(signBoard);

  // Poké-Ball motif on sign: red top half disc + white bottom half disc
  const discRadius = 0.07;
  const halfGeoTop = new THREE.CylinderGeometry(discRadius, discRadius, 0.02, 16, 1, false, 0, Math.PI);
  const topHalf = new THREE.Mesh(halfGeoTop, mat(0xd92626));
  topHalf.rotation.x = Math.PI / 2;
  topHalf.rotation.z = Math.PI;
  topHalf.position.set(0, 0.12 + wallH + 0.15, wallD / 2 + 0.08);
  building.add(topHalf);

  const halfGeoBot = new THREE.CylinderGeometry(discRadius, discRadius, 0.02, 16, 1, false, Math.PI, Math.PI);
  const botHalf = new THREE.Mesh(halfGeoBot, mat(0xf5f0e6));
  botHalf.rotation.x = Math.PI / 2;
  botHalf.rotation.z = Math.PI;
  botHalf.position.set(0, 0.12 + wallH + 0.15, wallD / 2 + 0.08);
  building.add(botHalf);

  // Center button
  const btn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.025, 8),
    mat(0x3d3d3d)
  );
  btn.rotation.x = Math.PI / 2;
  btn.position.set(0, 0.12 + wallH + 0.15, wallD / 2 + 0.09);
  building.add(btn);

  return building;
}

/* ------------------------------------------------------------------ */
/*  2. Mart                                                            */
/* ------------------------------------------------------------------ */

/** General Mart shop: cream walls, blue gabled roof, awning over door. */
export function makeMart(): THREE.Group {
  const building = new THREE.Group();

  const wallW = 1.6;
  const wallD = 1.6;
  const wallH = 1.6;
  const wallColor = 0xf5f0e6;

  // Foundation
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(wallW + 0.18, 0.1, wallD + 0.18),
    mat(0xd4cfc4)
  );
  foundation.position.y = 0.05;
  foundation.receiveShadow = true;
  foundation.castShadow = true;
  building.add(foundation);

  // Walls
  const walls = new THREE.Mesh(new THREE.BoxGeometry(wallW, wallH, wallD), mat(wallColor));
  walls.position.y = 0.1 + wallH / 2;
  walls.castShadow = true;
  walls.receiveShadow = true;
  building.add(walls);

  // Roof
  const roof = gableRoof(wallW, wallD, 0.7, 0x2d6cdf);
  roof.position.y = 0.1 + wallH;
  building.add(roof);

  // Door
  const d = door(0.45, 0.8, 0x5a3e28, 0x8a6a4a);
  d.position.set(0, 0.1 + 0.4, wallD / 2 + 0.01);
  building.add(d);

  // Awning over door (thin angled slab)
  const awningSlab = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.04, 0.55),
    mat(0x2d6cdf)
  );
  awningSlab.position.set(0, 0.1 + wallH * 0.72, wallD / 2 + 0.28);
  awningSlab.rotation.x = -0.25;
  awningSlab.castShadow = true;
  building.add(awningSlab);

  // Awning support poles
  for (const side of [-1, 1] as const) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6),
      mat(0x5a3e28)
    );
    pole.position.set(side * 0.3, 0.1 + wallH * 0.55, wallD / 2 + 0.42);
    pole.castShadow = true;
    building.add(pole);
  }

  // Windows
  const winL = windowMesh(0.3, 0.3, 0x3d3d3d);
  winL.position.set(-wallW / 2 - 0.01, 0.1 + wallH * 0.55, 0);
  winL.rotation.y = -Math.PI / 2;
  building.add(winL);

  const winR = windowMesh(0.3, 0.3, 0x3d3d3d);
  winR.position.set(wallW / 2 + 0.01, 0.1 + wallH * 0.55, 0);
  winR.rotation.y = Math.PI / 2;
  building.add(winR);

  // Blue sign board over door
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.16, 0.05),
    mat(0x2d6cdf)
  );
  signBoard.position.set(0, 0.1 + wallH + 0.12, wallD / 2 + 0.04);
  signBoard.castShadow = true;
  building.add(signBoard);

  // White "MART" text suggestion: small white strip
  const textStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.06, 0.01),
    mat(0xffffff)
  );
  textStrip.position.set(0, 0.1 + wallH + 0.12, wallD / 2 + 0.07);
  building.add(textStrip);

  return building;
}

/* ------------------------------------------------------------------ */
/*  3. Gym                                                             */
/* ------------------------------------------------------------------ */

/** Imposing gym: grey stone walls, purple roof, banner on a pole. */
export function makeGym(): THREE.Group {
  const building = new THREE.Group();

  const wallW = 2.0;
  const wallD = 1.8;
  const wallH = 2.0;
  const wallColor = 0x8a8a8a;

  // Foundation (wider, more imposing)
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(wallW + 0.3, 0.15, wallD + 0.3),
    mat(0x6e6e6e)
  );
  foundation.position.y = 0.075;
  foundation.receiveShadow = true;
  foundation.castShadow = true;
  building.add(foundation);

  // Steps (two small steps)
  for (let i = 0; i < 2; i++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(wallW + 0.3 - i * 0.15, 0.08, 0.25),
      mat(0x7a7a7a)
    );
    step.position.set(0, 0.15 + 0.04 + i * 0.08, wallD / 2 + 0.15 + i * 0.25);
    step.receiveShadow = true;
    step.castShadow = true;
    building.add(step);
  }

  // Walls
  const walls = new THREE.Mesh(new THREE.BoxGeometry(wallW, wallH, wallD), mat(wallColor));
  walls.position.y = 0.15 + wallH / 2;
  walls.castShadow = true;
  walls.receiveShadow = true;
  building.add(walls);

  // Decorative stone band (horizontal stripe near top)
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(wallW + 0.04, 0.12, wallD + 0.04),
    mat(0x6e6e6e)
  );
  band.position.y = 0.15 + wallH * 0.82;
  band.castShadow = true;
  building.add(band);

  // Roof
  const roof = gableRoof(wallW, wallD, 0.75, 0x6b3fa0);
  roof.position.y = 0.15 + wallH;
  building.add(roof);

  // Double doors
  const doorGroup = new THREE.Group();
  for (const side of [-1, 1] as const) {
    const d = door(0.32, 0.9, 0x4a3420, 0x6a5a4a);
    d.position.set(side * 0.34, 0, 0);
    doorGroup.add(d);
  }
  doorGroup.position.set(0, 0.15 + 0.45, wallD / 2 + 0.01);
  building.add(doorGroup);

  // Windows (higher up, smaller)
  for (const side of [-1, 1] as const) {
    const w = windowMesh(0.28, 0.35, 0x3d3d3d);
    w.position.set(side * 0.65, 0.15 + wallH * 0.5, wallD / 2 + 0.01);
    building.add(w);
  }

  // Side windows
  for (const side of [-1, 1] as const) {
    const w = windowMesh(0.28, 0.35, 0x3d3d3d);
    w.position.set(side * (wallW / 2 + 0.01), 0.15 + wallH * 0.5, 0);
    w.rotation.y = side * Math.PI / 2;
    building.add(w);
  }

  // Banner / flag on a pole at the ridge
  const poleH = 0.6;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, poleH, 6),
    mat(0x5a5a5a)
  );
  pole.position.set(0, 0.15 + wallH + 0.75 + poleH / 2, 0);
  pole.castShadow = true;
  building.add(pole);

  // Flag (thin colored quad)
  const flagGeo = new THREE.PlaneGeometry(0.35, 0.22);
  const flag = new THREE.Mesh(flagGeo, mat(0x8b5cf6, { roughness: 0.7 }));
  flag.position.set(0.18, 0.15 + wallH + 0.75 + poleH - 0.08, 0);
  flag.castShadow = true;
  building.add(flag);

  return building;
}

/* ------------------------------------------------------------------ */
/*  4. House (seeded)                                                  */
/* ------------------------------------------------------------------ */

/** Cozy cottage: colours derived deterministically from seed, chimney on roof. */
export function makeHouse(seed = 0): THREE.Group {
  const building = new THREE.Group();

  // Deterministic pseudo-random in [0,1)
  const r = (n: number) => {
    const x = Math.sin(seed * 99 + n) * 1e4;
    return x - Math.floor(x);
  };

  // Palette choices
  const roofColors = [0xc0563a, 0x3a9a8a, 0x8a6a3a]; // terracotta, teal, brown
  const roofColor = roofColors[Math.floor(r(0) * roofColors.length)];

  const wallBase = Math.floor(r(1) * 40) + 200; // 200-240
  const wallColor = new THREE.Color(`hsl(${Math.floor(r(2) * 40 + 20)}, ${Math.floor(r(3) * 15 + 20)}%, ${Math.floor(r(4) * 10 + 75)}%)`);

  const doorColors = [0x6b4226, 0x5c3a1e, 0x7a5a3a];
  const doorColor = doorColors[Math.floor(r(5) * doorColors.length)];

  const wallW = 1.5;
  const wallD = 1.5;
  const wallH = 1.5;

  // Foundation
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(wallW + 0.16, 0.1, wallD + 0.16),
    mat(0xd4cfc4)
  );
  foundation.position.y = 0.05;
  foundation.receiveShadow = true;
  foundation.castShadow = true;
  building.add(foundation);

  // Walls
  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(wallW, wallH, wallD),
    mat(wallColor.getHex())
  );
  walls.position.y = 0.1 + wallH / 2;
  walls.castShadow = true;
  walls.receiveShadow = true;
  building.add(walls);

  // Roof
  const roof = gableRoof(wallW, wallD, 0.7, roofColor);
  roof.position.y = 0.1 + wallH;
  building.add(roof);

  // Chimney
  const chimneyH = 0.5 + r(6) * 0.3;
  const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, chimneyH, 0.22),
    mat(0x8a6a5a)
  );
  chimney.position.set(
    (r(7) - 0.5) * 0.5,
    0.1 + wallH + 0.7 + chimneyH / 2 - 0.15,
    (r(8) - 0.5) * 0.4
  );
  chimney.castShadow = true;
  building.add(chimney);

  // Chimney top lip
  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.06, 0.28),
    mat(0x7a5a4a)
  );
  lip.position.copy(chimney.position);
  lip.position.y += chimneyH / 2;
  lip.castShadow = true;
  building.add(lip);

  // Door
  const d = door(0.38, 0.75, 0x5a3e28, doorColor);
  d.position.set(0, 0.1 + 0.375, wallD / 2 + 0.01);
  building.add(d);

  // 1-2 windows based on seed
  const numWindows = r(9) > 0.4 ? 2 : 1;

  // Front window (if 2 windows)
  if (numWindows >= 2) {
    const fw = windowMesh(0.28, 0.28, 0x5a3e28);
    fw.position.set(0.45, 0.1 + wallH * 0.52, wallD / 2 + 0.01);
    building.add(fw);
  }

  // Side window
  const sw = windowMesh(0.28, 0.28, 0x5a3e28);
  const sideSign = r(10) > 0.5 ? 1 : -1;
  sw.position.set(sideSign * (wallW / 2 + 0.01), 0.1 + wallH * 0.52, 0);
  sw.rotation.y = sideSign * Math.PI / 2;
  building.add(sw);

  return building;
}
