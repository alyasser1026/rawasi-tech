import type * as ThreeNS from 'three';
import {
  type BimLayerId,
  CAPITAL_APARTMENTS,
  type FurnitureItemSpec,
  TOWER_DIMS,
  TOWER_TOTAL_HEIGHT,
  TYPICAL_FLOOR_ZONES,
  TYPICAL_FURNITURE,
  TYPICAL_WALL_SEGMENTS,
  type TowerLightingPreset,
  type UnitId,
} from './capital-tower-model';

export type Three = typeof ThreeNS;

export interface TowerDisposables {
  add: <T extends { dispose: () => void }>(d: T) => T;
  disposeAll: () => void;
}

export function createDisposables(): TowerDisposables {
  const list: { dispose: () => void }[] = [];
  return {
    add<T extends { dispose: () => void }>(d: T): T {
      list.push(d);
      return d;
    },
    disposeAll() {
      for (const item of list) {
        try {
          item.dispose();
        } catch {
          // ignore double disposal
        }
      }
      list.length = 0;
    },
  };
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createTravertineTexture(THREE: Three, disp: TowerDisposables): ThreeNS.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#e6d6c1';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 16; i++) {
    const y = i * 16;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(182,155,124,0.16)' : 'rgba(255,248,236,0.18)';
    ctx.fillRect(0, y, 256, 15);
    ctx.fillStyle = 'rgba(130,108,82,0.28)';
    ctx.fillRect(0, y + 15, 256, 1);
  }
  const tex = disp.add(new THREE.CanvasTexture(canvas));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createParquetTexture(THREE: Three, disp: TowerDisposables): ThreeNS.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#a47143';
  ctx.fillRect(0, 0, 256, 256);
  const plankH = 32;
  const plankW = 128;
  for (let row = 0; row < 8; row++) {
    const offset = (row % 2) * 64;
    for (let col = -1; col < 3; col++) {
      const shade = 0.9 + ((row * 7 + col * 3) % 5) * 0.04;
      const r = Math.min(255, Math.round(166 * shade));
      const g = Math.min(255, Math.round(115 * shade));
      const b = Math.min(255, Math.round(68 * shade));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(col * plankW + offset, row * plankH, plankW - 2, plankH - 2);
      ctx.strokeStyle = 'rgba(65,40,18,0.22)';
      ctx.strokeRect(col * plankW + offset, row * plankH, plankW - 2, plankH - 2);
    }
  }
  const tex = disp.add(new THREE.CanvasTexture(canvas));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.5, 2.5);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createMarbleTexture(THREE: Three, disp: TowerDisposables): ThreeNS.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#ece6dc';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(155,140,122,0.28)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * 34);
    ctx.bezierCurveTo(85, i * 34 + 14, 170, i * 34 - 16, 256, i * 34 + 6);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(120,108,94,0.22)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= 256; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 0; y <= 256; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  const tex = disp.add(new THREE.CanvasTexture(canvas));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSignTexture(
  THREE: Three,
  disp: TowerDisposables,
  title: string,
  subtitle: string,
  bg = '#241a13',
  fg = '#f6d298',
  border = '#d98c42',
  w = 512,
  h = 128
): ThreeNS.CanvasTexture {
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = border;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fg;
  ctx.font = subtitle ? '700 44px "Cairo", "Segoe UI", sans-serif' : '700 40px Georgia, serif';
  ctx.fillText(title, w / 2, subtitle ? h * 0.42 : h * 0.52);

  if (subtitle) {
    ctx.fillStyle = '#e7ccb0';
    ctx.font = '600 22px Georgia, serif';
    ctx.fillText(subtitle, w / 2, h * 0.76);
  }
  const tex = disp.add(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface PaletteMaterials {
  limestone: ThreeNS.MeshStandardMaterial;
  bronzeDark: ThreeNS.MeshStandardMaterial;
  espressoFrame: ThreeNS.MeshStandardMaterial;
  cutWall: ThreeNS.MeshStandardMaterial;
  partitionWall: ThreeNS.MeshStandardMaterial;
  glassFacade: ThreeNS.MeshStandardMaterial;
  glassBalustrade: ThreeNS.MeshStandardMaterial;
  warmWindowGlow: ThreeNS.MeshStandardMaterial;
  sconceGlow: ThreeNS.MeshStandardMaterial;
  parquet: ThreeNS.MeshStandardMaterial;
  marble: ThreeNS.MeshStandardMaterial;
  tileBath: ThreeNS.MeshStandardMaterial;
  concrete: ThreeNS.MeshStandardMaterial;
  steelElevator: ThreeNS.MeshStandardMaterial;
  fabricCream: ThreeNS.MeshStandardMaterial;
  fabricCharcoal: ThreeNS.MeshStandardMaterial;
  woodFurniture: ThreeNS.MeshStandardMaterial;
  greenery: ThreeNS.MeshStandardMaterial;
  goldBrass: ThreeNS.MeshStandardMaterial;
}

export function createArchitecturalMaterials(
  THREE: Three,
  disp: TowerDisposables,
  preset: TowerLightingPreset = 'brochure'
): PaletteMaterials {
  const travTex = createTravertineTexture(THREE, disp);
  const parquetTex = createParquetTexture(THREE, disp);
  const marbleTex = createMarbleTexture(THREE, disp);

  const glowIntensity = preset === 'daylight' ? 0.45 : preset === 'night' ? 1.85 : 1.15;

  const std = (params: ThreeNS.MeshStandardMaterialParameters) =>
    disp.add(new THREE.MeshStandardMaterial(params));

  return {
    limestone: std({ map: travTex, color: 0xebd9c4, roughness: 0.72, metalness: 0.04 }),
    bronzeDark: std({ color: 0x4b3b30, roughness: 0.48, metalness: 0.28 }),
    espressoFrame: std({ color: 0x261d17, roughness: 0.4, metalness: 0.48 }),
    cutWall: std({ color: 0x1b1714, roughness: 0.65, metalness: 0.1 }),
    partitionWall: std({ color: 0xe6dacb, roughness: 0.8 }),
    glassFacade: std({
      color: 0x3b4852,
      roughness: 0.12,
      metalness: 0.45,
      transparent: true,
      opacity: 0.56,
    }),
    glassBalustrade: std({
      color: 0xc2d5e3,
      roughness: 0.14,
      metalness: 0.25,
      transparent: true,
      opacity: 0.42,
    }),
    warmWindowGlow: std({
      color: 0xffe0a8,
      emissive: 0xffa84c,
      emissiveIntensity: glowIntensity,
      roughness: 0.25,
    }),
    sconceGlow: std({
      color: 0xfff0d4,
      emissive: 0xffb357,
      emissiveIntensity: glowIntensity * 1.35,
      roughness: 0.15,
    }),
    parquet: std({ map: parquetTex, color: 0xd8b184, roughness: 0.52, metalness: 0.04 }),
    marble: std({ map: marbleTex, color: 0xf4eee4, roughness: 0.26, metalness: 0.08 }),
    tileBath: std({ color: 0xded8ce, roughness: 0.38, metalness: 0.05 }),
    concrete: std({ color: 0x9aa0a6, roughness: 0.85, metalness: 0.05 }),
    steelElevator: std({ color: 0xb7bcc2, roughness: 0.28, metalness: 0.82 }),
    fabricCream: std({ color: 0xf3ece1, roughness: 0.82 }),
    fabricCharcoal: std({ color: 0x3a322d, roughness: 0.82 }),
    woodFurniture: std({ color: 0x855632, roughness: 0.52 }),
    greenery: std({ color: 0x3d6d3b, roughness: 0.78 }),
    goldBrass: std({ color: 0xd4a45a, roughness: 0.3, metalness: 0.78 }),
  };
}

function addBoxMesh(
  THREE: Three,
  disp: TowerDisposables,
  parent: ThreeNS.Group,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  mat: ThreeNS.Material,
  specKey?: string,
  pickables?: ThreeNS.Object3D[],
  castShadow = true,
  receiveShadow = true
): ThreeNS.Mesh {
  const geo = disp.add(new THREE.BoxGeometry(w, h, d));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  if (specKey) {
    mesh.userData.specKey = specKey;
    pickables?.push(mesh);
  }
  parent.add(mesh);
  return mesh;
}

/** Build the complete 13-level Capital Tower exterior facade, retail arcade, and balconies. */
export function buildTowerExteriorScene(
  THREE: Three,
  disp: TowerDisposables,
  mats: PaletteMaterials,
  pickables: ThreeNS.Object3D[]
): ThreeNS.Group {
  const root = new THREE.Group();
  const { width: W, depth: D, podiumHeight: PH, floorHeight: FH, residentialFloors: FLOORS } = TOWER_DIMS;

  // Ground stone plaza + sidewalk apron
  addBoxMesh(THREE, disp, root, W + 14, 0.24, D + 14, 0, -0.12, 2.0, mats.marble, 'podium', pickables, false, true);
  addBoxMesh(THREE, disp, root, W + 16, 0.3, 0.4, 0, 0.05, D / 2 + 8.5, mats.concrete, undefined, undefined, false, true);

  // Ornamental boulevard trees flanking front promenade (brochure lower-left/right trees)
  for (const tx of [-W / 2 - 4.2, -W / 2 - 1.5, W / 2 + 1.5, W / 2 + 4.2]) {
    for (const tz of [D / 2 + 3.2, D / 2 - 3.0]) {
      const trunkGeo = disp.add(new THREE.CylinderGeometry(0.18, 0.26, 2.2, 8));
      const trunk = new THREE.Mesh(trunkGeo, mats.bronzeDark);
      trunk.position.set(tx, 1.1, tz);
      trunk.castShadow = true;
      root.add(trunk);
      const canopyGeo = disp.add(new THREE.DodecahedronGeometry(1.55, 1));
      const canopy = new THREE.Mesh(canopyGeo, mats.greenery);
      canopy.position.set(tx, 3.1, tz);
      canopy.castShadow = true;
      root.add(canopy);
    }
  }

  // Commercial Ground Podium: THE ARCADE / MAISON D'OR / CAFÉ LUMIÈRE
  addBoxMesh(THREE, disp, root, W, PH, D - 0.6, 0, PH / 2, -0.3, mats.bronzeDark, 'podium', pickables);
  // Warm illuminated retail glazing panels & mullions along front podium (+Z = D/2)
  const bayCenters = [-7.2, -2.5, 2.5, 7.2];
  const shopLabels: [string, string][] = [
    ['THE ARCADE', 'BOUTIQUE GALLERY'],
    ["MAISON D'OR", 'FINE INTERIORS'],
    ['مدخل برج كابيتال', 'LOBBY RECEPTION'],
    ['CAFÉ LUMIÈRE', 'ESPRESSO & BAKERY'],
  ];
  bayCenters.forEach((bx, idx) => {
    const bw = idx === 0 || idx === 3 ? 3.8 : 4.2;
    // Recessed warm shop glass
    addBoxMesh(THREE, disp, root, bw, PH - 1.15, 0.1, bx, (PH - 1.15) / 2 + 0.05, D / 2 - 0.05, mats.warmWindowGlow, 'podium', pickables);
    addBoxMesh(THREE, disp, root, bw + 0.14, 0.14, 0.28, bx, PH - 1.0, D / 2 + 0.06, mats.espressoFrame, 'podium', pickables);
    // Fascia nameplate
    const [t, s] = shopLabels[idx];
    const signTex = createSignTexture(THREE, disp, t, s, '#1f1610', '#f6d196', '#b77435', 384, 96);
    const signMat = disp.add(new THREE.MeshStandardMaterial({ map: signTex, emissive: 0x3b220d, emissiveIntensity: 0.45, roughness: 0.35 }));
    addBoxMesh(THREE, disp, root, bw * 0.84, 0.68, 0.12, bx, PH - 0.42, D / 2 + 0.12, signMat, idx === 2 ? 'entrance' : 'podium', pickables);
  });

  // Main Tower Banner "برج كابيتال — Perfect Home" anchored above Podium
  const towerSignTex = createSignTexture(THREE, disp, 'برج كابيتال', 'CAPITAL TOWER • PERFECT HOME', '#1c140e', '#ffe0ad', '#f97316', 768, 160);
  const towerSignMat = disp.add(new THREE.MeshStandardMaterial({ map: towerSignTex, emissive: 0x452208, emissiveIntensity: 0.5, roughness: 0.3 }));
  addBoxMesh(THREE, disp, root, 9.8, 1.35, 0.22, 0, PH + 0.55, D / 2 + 0.32, towerSignMat, 'entrance', pickables);

  // Monumental front entrance steps preview on podium center
  for (let s = 0; s < 4; s++) {
    addBoxMesh(THREE, disp, root, 4.4 - s * 0.2, 0.18, 0.5, 2.5, 0.09 + s * 0.18, D / 2 + 1.2 - s * 0.45, mats.marble, 'entrance', pickables);
  }

  // Front vertical pilasters (5 columns dividing 4 symmetrical bays)
  const pilasterX = [-9.42, -4.95, -0.1, 4.95, 9.42];
  const frontGlassMat = mats.warmWindowGlow;

  for (let f = 0; f < FLOORS; f++) {
    const yBase = PH + f * FH;
    const yMid = yBase + FH / 2;
    // Lower floors (0..2) & Penthouse top floors (10..11) are Dark Taupe Bronze; mid floors (3..9) Limestone Cream
    const isDarkZone = f < 3 || f >= 10;
    const claddingMat = isDarkZone ? mats.bronzeDark : mats.limestone;

    // Main core body (recessed slightly at center terrace zone on front face)
    addBoxMesh(THREE, disp, root, W - 0.4, FH - 0.26, D - 2.6, 0, yMid, -1.1, claddingMat, 'facade', pickables);
    // Floor belt slab cornice projecting cleanly all around
    addBoxMesh(THREE, disp, root, W + 0.42, 0.28, D + 0.42, 0, yBase + 0.14, 0, claddingMat, 'facade', pickables);

    // 5 vertical pilasters + warm vertical wall sconces
    for (const px of pilasterX) {
      addBoxMesh(THREE, disp, root, 0.72, FH - 0.04, 0.8, px, yMid, D / 2 - 0.15, claddingMat, 'facade', pickables);
      // Warm golden wall wash sconce along pilaster center (brochure signature lighting!)
      if (f >= 2 && f <= 10) {
        addBoxMesh(THREE, disp, root, 0.12, 0.72, 0.14, px, yMid + 0.2, D / 2 + 0.28, mats.sconceGlow, 'facade', pickables, false, false);
      }
    }

    // Outer left & right tall twin mullioned window bays (-7.2 and +7.2)
    for (const bx of [-7.2, 7.2]) {
      addBoxMesh(THREE, disp, root, 3.85, FH - 0.26, 2.0, bx, yMid, D / 2 - 0.9, claddingMat, 'facade', pickables);
      addBoxMesh(THREE, disp, root, 2.25, FH - 0.78, 0.12, bx, yMid + 0.06, D / 2 + 0.1, frontGlassMat, 'facade', pickables);
      addBoxMesh(THREE, disp, root, 0.1, FH - 0.74, 0.16, bx, yMid + 0.06, D / 2 + 0.13, mats.espressoFrame, 'facade', pickables);
      addBoxMesh(THREE, disp, root, 2.35, 0.1, 0.16, bx, yMid + 0.45, D / 2 + 0.13, mats.espressoFrame, 'facade', pickables);
    }

    // Center two recessed terrace bays (-2.5 and +2.4) with sliding terrace glass + glass railing + corner shrubs
    for (const tx of [-2.5, 2.4]) {
      // Back wall of balcony with glowing wide triple sliding door
      addBoxMesh(THREE, disp, root, 3.8, FH - 0.65, 0.1, tx, yMid + 0.02, D / 2 - 1.85, frontGlassMat, 'facade', pickables);
      addBoxMesh(THREE, disp, root, 0.1, FH - 0.6, 0.14, tx - 0.9, yMid + 0.02, D / 2 - 1.8, mats.espressoFrame, 'facade', pickables);
      addBoxMesh(THREE, disp, root, 0.1, FH - 0.6, 0.14, tx + 0.9, yMid + 0.02, D / 2 - 1.8, mats.espressoFrame, 'facade', pickables);
      // Front glass balustrade + bronze top cap
      addBoxMesh(THREE, disp, root, 4.1, 1.02, 0.07, tx, yBase + 0.68, D / 2 + 0.08, mats.glassBalustrade, 'facade', pickables, false, true);
      addBoxMesh(THREE, disp, root, 4.18, 0.07, 0.12, tx, yBase + 1.2, D / 2 + 0.08, mats.espressoFrame, 'facade', pickables);
      // Small terrace greenery planter pot
      addBoxMesh(THREE, disp, root, 0.42, 0.5, 0.42, tx - 1.5, yBase + 0.5, D / 2 - 0.35, mats.greenery, 'interiorFinish', pickables);
    }

    // Side & rear elevation rhythmic punched windows for 360° orbit quality
    for (const sx of [-W / 2 + 0.12, W / 2 - 0.12]) {
      for (const wz of [-9.5, -3.5, 2.5, 8.2]) {
        addBoxMesh(THREE, disp, root, 0.14, FH - 0.9, 2.1, sx, yMid + 0.05, wz, frontGlassMat, 'facade', pickables, false, false);
        addBoxMesh(THREE, disp, root, 0.18, 0.1, 2.18, sx, yMid + 0.4, wz, mats.espressoFrame, 'facade', pickables);
      }
    }
    for (const rz of [-D / 2 + 1.32]) {
      for (const rx of [-7.0, -2.5, 2.5, 7.0]) {
        addBoxMesh(THREE, disp, root, 2.4, FH - 0.9, 0.14, rx, yMid + 0.05, rz, frontGlassMat, 'facade', pickables, false, false);
      }
    }
  }

  // Classical stepped crown cornice & illuminated soffit on top of Floor 12
  const roofY = TOWER_TOTAL_HEIGHT;
  addBoxMesh(THREE, disp, root, W + 0.9, 0.42, D + 0.9, 0, roofY + 0.2, 0, mats.bronzeDark, 'facade', pickables);
  addBoxMesh(THREE, disp, root, W + 1.8, 0.65, D + 1.8, 0, roofY + 0.72, 0, mats.bronzeDark, 'facade', pickables);
  // Warm crown uplight trim under overhanging eave
  addBoxMesh(THREE, disp, root, W + 1.1, 0.1, 0.14, 0, roofY + 0.36, D / 2 + 0.52, mats.sconceGlow, 'facade', pickables, false, false);
  // Side architectural wings on crown matching brochure photo
  addBoxMesh(THREE, disp, root, 5.2, 1.35, D + 0.9, -W / 2 + 2.5, roofY + 1.15, 0, mats.bronzeDark, 'facade', pickables);
  addBoxMesh(THREE, disp, root, 5.2, 1.35, D + 0.9, W / 2 - 2.5, roofY + 1.15, 0, mats.bronzeDark, 'facade', pickables);
  // Elevator penthouse + MEP roof deck enclosure
  addBoxMesh(THREE, disp, root, 5.4, 2.4, 5.6, 1.4, roofY + 1.25, -0.8, mats.bronzeDark, 'core', pickables);

  return root;
}

/** Build the dedicated "Unique Modern Entrance" marble staircase & twin elevator lobby. */
export function buildEntranceLobbyScene(
  THREE: Three,
  disp: TowerDisposables,
  mats: PaletteMaterials,
  pickables: ThreeNS.Object3D[]
): ThreeNS.Group {
  const root = new THREE.Group();

  // Lobby base marble floor
  addBoxMesh(THREE, disp, root, 14, 0.3, 16, 0, -0.15, 0, mats.marble, 'entrance', pickables, false, true);

  // 5 wide Calacatta marble podium steps rising from front (Z = +6.5 -> +2.2) with LED step strips
  for (let i = 0; i < 5; i++) {
    const stepW = 10.6 - i * 0.2;
    const stepY = 0.11 + i * 0.22;
    const stepZ = 5.6 - i * 0.68;
    addBoxMesh(THREE, disp, root, stepW, 0.22, 0.72, 0, stepY, stepZ, mats.marble, 'entrance', pickables);
    // Warm LED riser nose glow under each marble tread
    addBoxMesh(THREE, disp, root, stepW - 0.3, 0.045, 0.06, 0, stepY + 0.09, stepZ + 0.35, mats.sconceGlow, 'entrance', pickables, false, false);
  }

  // Elevated upper elevator landing platform (y = 1.1, z = -4.5..+2.5)
  addBoxMesh(THREE, disp, root, 11.4, 1.1, 7.2, 0, 0.55, -0.9, mats.marble, 'entrance', pickables);

  // Fluted marble side walls + framed bronze glass niches + vertical warm linear sconces
  for (const sx of [-5.2, 5.2]) {
    addBoxMesh(THREE, disp, root, 0.45, 5.4, 13.5, sx, 2.7, -0.2, mats.marble, 'entrance', pickables);
    for (const pz of [-2.4, 1.8, 5.0]) {
      const sign = sx < 0 ? 1 : -1;
      addBoxMesh(THREE, disp, root, 0.22, 4.9, 0.55, sx + sign * 0.22, 2.7, pz, mats.limestone, 'entrance', pickables);
      // Warm vertical LED sconce strip
      addBoxMesh(THREE, disp, root, 0.08, 2.4, 0.14, sx + sign * 0.34, 2.8, pz, mats.sconceGlow, 'entrance', pickables, false, false);
    }
    // Framed dark reflective bronze feature panel
    const sign = sx < 0 ? 1 : -1;
    addBoxMesh(THREE, disp, root, 0.08, 3.6, 2.6, sx + sign * 0.22, 2.9, -0.3, mats.espressoFrame, 'entrance', pickables);
  }

  // Back portal wall behind Twin Elevators
  addBoxMesh(THREE, disp, root, 10.8, 5.6, 0.45, 0, 2.8, -4.4, mats.limestone, 'core', pickables);

  // Twin Stainless & Bronze Portal Elevators (Elev A @ -2.15, Elev B @ +0.45) + Hallway Door (@ +3.4)
  for (const ex of [-2.15, 0.45]) {
    // Tall dark marble & bronze frame (4.6m tall just like brochure photo!)
    addBoxMesh(THREE, disp, root, 2.25, 4.15, 0.22, ex, 3.15, -4.15, mats.espressoFrame, 'core', pickables);
    // Double brushed stainless steel elevator sliding leaves
    addBoxMesh(THREE, disp, root, 0.86, 2.65, 0.1, ex - 0.45, 2.42, -4.08, mats.steelElevator, 'core', pickables);
    addBoxMesh(THREE, disp, root, 0.86, 2.65, 0.1, ex + 0.45, 2.42, -4.08, mats.steelElevator, 'core', pickables);
    // Glazed transom header above elevator door + illuminated floor indicator
    addBoxMesh(THREE, disp, root, 1.78, 0.95, 0.1, ex, 4.45, -4.08, mats.marble, 'core', pickables);
    addBoxMesh(THREE, disp, root, 0.46, 0.18, 0.08, ex, 3.84, -4.02, mats.sconceGlow, 'core', pickables, false, false);
  }
  // Central call button pier between elevators
  addBoxMesh(THREE, disp, root, 0.26, 0.85, 0.12, -0.85, 2.45, -4.02, mats.goldBrass, 'core', pickables);

  // Secondary Dark Hallway Access Door to stairs (right side matching brochure)
  addBoxMesh(THREE, disp, root, 1.35, 2.65, 0.14, 3.25, 2.42, -4.12, mats.espressoFrame, 'core', pickables);

  // Suspended Illuminated Tray Ceiling
  addBoxMesh(THREE, disp, root, 10.4, 0.22, 13.0, 0, 5.4, -0.2, mats.limestone, 'entrance', pickables, false, true);
  for (const lz of [-2.8, 0.2, 3.2]) {
    addBoxMesh(THREE, disp, root, 7.6, 0.06, 0.18, 0, 5.28, lz, mats.sconceGlow, 'entrance', pickables, false, false);
  }

  return root;
}

function addFurniturePiece(
  THREE: Three,
  disp: TowerDisposables,
  parent: ThreeNS.Group,
  item: FurnitureItemSpec,
  baseY: number,
  mats: PaletteMaterials,
  pickables: ThreeNS.Object3D[]
) {
  const g = new THREE.Group();
  g.position.set(item.x, baseY, item.z);
  g.rotation.y = item.rotY ?? 0;

  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: ThreeNS.Material) =>
    addBoxMesh(THREE, disp, g, w, h, d, x, y, z, mat, 'interiorFinish', pickables, true, true);

  switch (item.kind) {
    case 'kingBed':
      box(1.9, 0.34, 2.1, 0, 0.2, 0, mats.woodFurniture);
      box(1.76, 0.22, 1.95, 0, 0.45, 0.04, mats.fabricCream);
      box(1.96, 1.05, 0.14, 0, 0.56, -1.0, mats.fabricCharcoal);
      box(0.68, 0.14, 0.42, -0.44, 0.6, -0.68, mats.fabricCream);
      box(0.68, 0.14, 0.42, 0.44, 0.6, -0.68, mats.fabricCream);
      box(1.78, 0.08, 0.68, 0, 0.57, 0.55, mats.goldBrass);
      break;
    case 'twinBed':
      box(1.02, 0.3, 1.92, 0, 0.18, 0, mats.woodFurniture);
      box(0.94, 0.2, 1.82, 0, 0.4, 0.02, mats.fabricCream);
      box(1.06, 0.85, 0.12, 0, 0.46, -0.92, mats.espressoFrame);
      box(0.65, 0.12, 0.36, 0, 0.52, -0.62, mats.fabricCream);
      break;
    case 'wardrobe':
      box(item.w ?? 1.8, 2.15, item.d ?? 0.58, 0, 1.08, 0, mats.woodFurniture);
      break;
    case 'nightstand':
      box(0.46, 0.48, 0.44, 0, 0.24, 0, mats.woodFurniture);
      box(0.18, 0.24, 0.18, 0, 0.6, 0, mats.sconceGlow);
      break;
    case 'sofa':
      box(2.35, 0.42, 0.92, 0, 0.22, 0, mats.fabricCream);
      box(2.35, 0.72, 0.22, 0, 0.42, -0.35, mats.fabricCream);
      box(0.22, 0.58, 0.92, -1.06, 0.34, 0, mats.fabricCharcoal);
      box(0.22, 0.58, 0.92, 1.06, 0.34, 0, mats.fabricCharcoal);
      break;
    case 'armchair':
      box(0.84, 0.4, 0.84, 0, 0.21, 0, mats.fabricCream);
      box(0.84, 0.66, 0.2, 0, 0.38, -0.32, mats.fabricCharcoal);
      break;
    case 'coffeeTable':
      box(1.05, 0.08, 0.72, 0, 0.36, 0, mats.marble);
      box(0.92, 0.3, 0.6, 0, 0.15, 0, mats.espressoFrame);
      break;
    case 'diningSet':
      box(1.9, 0.08, 1.05, 0, 0.75, 0, mats.woodFurniture);
      box(0.8, 0.72, 0.6, 0, 0.36, 0, mats.espressoFrame);
      for (const cx of [-0.62, 0, 0.62]) {
        box(0.42, 0.45, 0.42, cx, 0.24, -0.68, mats.fabricCream);
        box(0.42, 0.45, 0.42, cx, 0.24, 0.68, mats.fabricCream);
      }
      break;
    case 'tvConsole':
      box(2.1, 0.45, 0.44, 0, 0.24, 0, mats.espressoFrame);
      box(1.65, 0.92, 0.06, 0, 1.12, -0.1, mats.cutWall);
      break;
    case 'kitchenCounter': {
      const kw = item.w ?? 2.4;
      const kd = item.d ?? 2.6;
      box(kw, 0.9, 0.62, 0, 0.45, -kd / 2 + 0.32, mats.marble);
      box(0.62, 0.9, kd - 0.6, -kw / 2 + 0.31, 0.45, 0.25, mats.marble);
      box(0.62, 0.9, kd - 0.6, kw / 2 - 0.31, 0.45, 0.25, mats.marble);
      box(0.65, 0.06, 0.52, 0, 0.93, -kd / 2 + 0.32, mats.steelElevator);
      break;
    }
    case 'tub':
      box(0.84, 0.52, 1.68, 0, 0.26, 0, mats.fabricCream);
      break;
    case 'toilet':
      box(0.42, 0.42, 0.62, 0, 0.21, 0, mats.fabricCream);
      box(0.42, 0.76, 0.22, 0, 0.38, -0.22, mats.fabricCream);
      break;
    case 'vanity':
      box(0.86, 0.82, 0.52, 0, 0.41, 0, mats.marble);
      break;
    case 'bistroSet':
      box(0.54, 0.64, 0.54, 0, 0.32, 0, mats.woodFurniture);
      box(0.48, 0.44, 0.48, -0.58, 0.22, 0, mats.fabricCream);
      box(0.48, 0.44, 0.48, 0.58, 0.22, 0, mats.fabricCream);
      break;
    case 'planter':
      box(0.46, 0.42, 0.46, 0, 0.21, 0, mats.bronzeDark);
      box(0.56, 0.72, 0.56, 0, 0.68, 0, mats.greenery);
      break;
  }

  parent.add(g);
}

/** Build the interactive 3D Brochure Cutaway Floor Plan (all units OR focused apartment 01/02/03). */
export function buildTypicalFloorCutawayScene(
  THREE: Three,
  disp: TowerDisposables,
  mats: PaletteMaterials,
  pickables: ThreeNS.Object3D[],
  focus: 'typical' | UnitId = 'typical'
): ThreeNS.Group {
  const root = new THREE.Group();
  const slabH = TOWER_DIMS.slabThickness;
  const wallH = focus === 'typical' ? 2.25 : 2.38;

  // Base structural floor plinth (Architectural model board)
  addBoxMesh(THREE, disp, root, TOWER_DIMS.width + 1.2, 0.26, TOWER_DIMS.depth + 1.2, 0, -0.15, 0, mats.concrete, 'slab', pickables, false, true);

  // Room Zones (textured parquet / bathroom tiles / lobby marble / terraces)
  for (const z of TYPICAL_FLOOR_ZONES) {
    const isDimmed = focus !== 'typical' && z.owner !== focus && z.owner !== 'core';
    let surfaceMat: ThreeNS.Material =
      z.surface === 'parquet'
        ? mats.parquet
        : z.surface === 'tile'
        ? mats.tileBath
        : z.surface === 'lobby'
        ? mats.marble
        : mats.marble;

    if (isDimmed) {
      surfaceMat = disp.add(
        new THREE.MeshStandardMaterial({
          color: 0x3b3530,
          roughness: 0.88,
          transparent: true,
          opacity: 0.26,
        })
      );
    }
    const specKey = z.surface === 'lobby' ? 'entrance' : 'interiorFinish';
    addBoxMesh(THREE, disp, root, z.w, 0.08, z.d, z.x, 0.04, z.z, surfaceMat, specKey, pickables, false, true);
  }

  // Highlight ring/border around selected apartment on typical floor
  const wallCutTopMat = mats.cutWall;
  const wallDimMat = disp.add(
    new THREE.MeshStandardMaterial({ color: 0x3f3730, roughness: 0.9, transparent: true, opacity: 0.28 })
  );

  for (const seg of TYPICAL_WALL_SEGMENTS) {
    const belongs =
      focus === 'typical' ||
      seg.owner === focus ||
      seg.owner === 'core' ||
      (seg.owner === 'exterior' &&
        ((focus === 'apt01' && seg.z <= -3.3) ||
          (focus === 'apt02' && seg.x <= 0.2 && seg.z >= -3.6) ||
          (focus === 'apt03' && seg.x >= -0.3)));

    const h = seg.kind === 'balustrade' ? 1.05 : seg.kind === 'glass' ? wallH - 0.15 : wallH;
    let wMat: ThreeNS.Material =
      seg.kind === 'balustrade'
        ? mats.glassBalustrade
        : seg.kind === 'glass'
        ? mats.glassFacade
        : isExteriorOrParty(seg.kind)
        ? mats.limestone
        : mats.partitionWall;

    if (!belongs) {
      wMat = wallDimMat;
    }

    const wallMesh = addBoxMesh(
      THREE,
      disp,
      root,
      seg.w,
      h,
      seg.d,
      seg.x,
      0.08 + h / 2,
      seg.z,
      wMat,
      seg.owner === 'core' ? 'core' : 'wall',
      pickables,
      belongs,
      true
    );

    // Dark brochure-style sharp cut cap on top of walls
    if (belongs && (seg.kind === 'exterior' || seg.kind === 'partition')) {
      addBoxMesh(THREE, disp, root, seg.w + 0.01, 0.06, seg.d + 0.01, seg.x, 0.08 + h + 0.03, seg.z, wallCutTopMat, undefined, undefined, false, false);
    }
    void wallMesh;
  }

  // Double-run marble Staircase & Twin Elevator Cabs in Central Core (X [-0.8..3.6], Z [-3.4..1.8])
  for (let st = 0; st < 8; st++) {
    addBoxMesh(THREE, disp, root, 0.28, 0.18, 1.05, 1.3 + st * 0.26, 0.12 + st * 0.14, -2.55, mats.marble, 'core', pickables);
    addBoxMesh(THREE, disp, root, 0.28, 0.18, 1.05, 3.1 - st * 0.26, 1.24 + st * 0.14, -1.35, mats.marble, 'core', pickables);
  }
  addBoxMesh(THREE, disp, root, 0.72, 0.12, 2.25, 3.26, 1.24, -1.95, mats.marble, 'core', pickables);
  // Twin Elevators (Elev 1 + Elev 2)
  for (const ez of [-0.05, 1.1]) {
    addBoxMesh(THREE, disp, root, 1.55, wallH, 1.02, 0.25, 0.08 + wallH / 2, ez, mats.steelElevator, 'core', pickables);
    addBoxMesh(THREE, disp, root, 0.06, wallH - 0.18, 0.72, 1.05, 0.08 + (wallH - 0.18) / 2, ez, mats.goldBrass, 'core', pickables);
  }

  // Brochure 3D Furniture
  for (const item of TYPICAL_FURNITURE) {
    if (focus !== 'typical' && item.owner !== focus) continue;
    addFurniturePiece(THREE, disp, root, item, 0.08, mats, pickables);
  }

  // Ground-to-cutaway unit indicator badge at active unit center when viewing typical floor
  if (focus === 'typical') {
    const badges: { id: UnitId; x: number; z: number }[] = [
      { id: 'apt01', x: -3.2, z: -8.6 },
      { id: 'apt02', x: -3.0, z: 7.4 },
      { id: 'apt03', x: 5.2, z: 7.2 },
    ];
    for (const b of badges) {
      const apt = CAPITAL_APARTMENTS[b.id];
      const tex = createSignTexture(
        THREE,
        disp,
        `${apt.title} · ${apt.areaSqm}m²`,
        `${apt.bedrooms} BED · ${apt.bathrooms} BATH`,
        '#140f0b',
        '#ffffff',
        apt.accent,
        360,
        108
      );
      const bMat = disp.add(new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.94 }));
      const plateGeo = disp.add(new THREE.PlaneGeometry(3.4, 1.02));
      const plate = new THREE.Mesh(plateGeo, bMat);
      plate.rotation.x = -Math.PI / 2 + 0.35;
      plate.position.set(b.x, 3.15, b.z);
      plate.userData.unitSwitch = b.id;
      pickables.push(plate);
      root.add(plate);
    }
  }

  void slabH;
  return root;
}

function isExteriorOrParty(kind: string): boolean {
  return kind === 'exterior' || kind === 'partition';
}

export interface BimFloorTracker {
  mesh: ThreeNS.Object3D;
  baseY: number;
  floorIndex: number; // -1 foundation, 0 podium, 1..12 residential, 13 roof
  layer: BimLayerId;
}

export interface CapitalTowerBimAssembly {
  layerGroups: Record<BimLayerId, ThreeNS.Group>;
  trackers: BimFloorTracker[];
  elevatorCabs: { mesh: ThreeNS.Mesh; phase: number; baseX: number; baseZ: number }[];
  pickables: ThreeNS.Object3D[];
}

/**
 * Shared BIM Digital Twin builder of برج كابيتال used by BOTH inline CapitalTower3D BIM mode
 * and the dedicated #bim workbench (BimModel.tsx). Zero duplicated structural geometry!
 */
export function buildCapitalTowerBimAssembly(
  THREE: Three,
  disp: TowerDisposables,
  scene: ThreeNS.Scene,
  floorsToBuild = TOWER_DIMS.residentialFloors
): CapitalTowerBimAssembly {
  const layerGroups: Record<BimLayerId, ThreeNS.Group> = {
    structure: new THREE.Group(),
    core: new THREE.Group(),
    masonry: new THREE.Group(),
    mep: new THREE.Group(),
    finish: new THREE.Group(),
  };
  (Object.values(layerGroups) as ThreeNS.Group[]).forEach((g) => scene.add(g));

  const trackers: BimFloorTracker[] = [];
  const pickables: ThreeNS.Object3D[] = [];
  const elevatorCabs: { mesh: ThreeNS.Mesh; phase: number; baseX: number; baseZ: number }[] = [];

  const mat = (color: number, opts: ThreeNS.MeshStandardMaterialParameters = {}) =>
    disp.add(new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.08, ...opts }));

  const mConcrete = mat(0x9ea5ac, { roughness: 0.88 });
  const mConcreteDark = mat(0x7e858c, { roughness: 0.9 });
  const mPile = mat(0x697077, { roughness: 0.92 });
  const mCore = mat(0xd97706, { roughness: 0.65, metalness: 0.14 });
  const mSteel = mat(0xcbd5e1, { roughness: 0.25, metalness: 0.82 });
  const mMasonry = mat(0xe3d3ba, { roughness: 0.92, transparent: true, opacity: 0.62 });
  const mDuct = mat(0x38bdf8, { roughness: 0.38, metalness: 0.42 });
  const mDiffuser = mat(0xf1f5f9, { roughness: 0.35, metalness: 0.3 });
  const mPipeSupply = mat(0x2563eb, { roughness: 0.35 });
  const mPipeDrain = mat(0x475569, { roughness: 0.55 });
  const mConduit = mat(0xfacc15, { roughness: 0.45 });
  const mPanel = mat(0x334155, { roughness: 0.55 });
  const mGlass = mat(0x8bc6e8, { transparent: true, opacity: 0.42, roughness: 0.1, metalness: 0.25 });
  const mFacade = mat(0xc75517, { roughness: 0.52 });
  const mSandstone = mat(0xe7d6c0, { roughness: 0.75 });
  const mParquet = mat(0xb88450, { roughness: 0.55 });
  const mEdge = disp.add(new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.28 }));

  const sharedGeos = new Map<string, ThreeNS.BufferGeometry>();
  const getBoxGeo = (w: number, h: number, d: number) => {
    const key = `b:${w.toFixed(2)}:${h.toFixed(2)}:${d.toFixed(2)}`;
    let g = sharedGeos.get(key);
    if (!g) {
      g = disp.add(new THREE.BoxGeometry(w, h, d));
      sharedGeos.set(key, g);
    }
    return g;
  };
  const getEdgeGeo = (boxGeo: ThreeNS.BufferGeometry, key: string) => {
    const ek = `e:${key}`;
    let g = sharedGeos.get(ek);
    if (!g) {
      g = disp.add(new THREE.EdgesGeometry(boxGeo));
      sharedGeos.set(ek, g);
    }
    return g;
  };

  const addBimBox = (
    layer: BimLayerId,
    specKey: string,
    floorIndex: number,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: ThreeNS.Material,
    withEdges = false,
    unitOwner?: UnitId | 'core'
  ) => {
    const geo = getBoxGeo(w, h, d);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.userData = { specKey, layer, floorIndex, unitOwner };
    if (withEdges) {
      mesh.add(new THREE.LineSegments(getEdgeGeo(geo, `b:${w.toFixed(2)}:${h.toFixed(2)}:${d.toFixed(2)}`), mEdge));
    }
    layerGroups[layer].add(mesh);
    trackers.push({ mesh, baseY: y, floorIndex, layer });
    pickables.push(mesh);
    return mesh;
  };

  const addBimCyl = (
    layer: BimLayerId,
    specKey: string,
    floorIndex: number,
    r: number,
    h: number,
    x: number,
    y: number,
    z: number,
    material: ThreeNS.Material,
    rotZ = 0
  ) => {
    const key = `c:${r.toFixed(2)}:${h.toFixed(2)}`;
    let geo = sharedGeos.get(key);
    if (!geo) {
      geo = disp.add(new THREE.CylinderGeometry(r, r, h, 10));
      sharedGeos.set(key, geo);
    }
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.rotation.z = rotZ;
    mesh.userData = { specKey, layer, floorIndex };
    layerGroups[layer].add(mesh);
    trackers.push({ mesh, baseY: y, floorIndex, layer });
    pickables.push(mesh);
    return mesh;
  };

  const { width: W, depth: D, podiumHeight: PH, floorHeight: FH, slabThickness: ST } = TOWER_DIMS;
  const totalTopY = PH + floorsToBuild * FH;

  // 1) Basement Concrete Raft + Strauss/CFA Bored Piles (floorIndex = -1)
  addBimBox('structure', 'foundation', -1, W + 1.4, 0.85, D + 1.4, 0, -0.425, 0, mConcreteDark, true);
  for (const gx of TOWER_DIMS.gridX) {
    for (const gz of TOWER_DIMS.gridZ) {
      addBimCyl('structure', 'foundation', -1, 0.34, 3.2, gx, -2.45, gz, mPile);
    }
  }

  // 2) Levels: Floor 0 = Commercial Podium, Floors 1..floorsToBuild = Typical Residential Floors
  const levelCount = floorsToBuild + 1;
  for (let lvl = 0; lvl < levelCount; lvl++) {
    const isPodium = lvl === 0;
    const h = isPodium ? PH : FH;
    const y0 = isPodium ? 0 : PH + (lvl - 1) * FH;
    const slabY = y0 + ST / 2;
    const clearH = h - ST;

    // Flat slab (with staircase/elevator core opening feel via surrounding segments or full slab)
    addBimBox('structure', 'slab', lvl, W + 0.36, ST, D + 0.36, 0, slabY, 0, mConcrete, true);

    // Perimeter edge beams under next slab
    const beamY = y0 + h - ST - 0.16;
    addBimBox('structure', 'slab', lvl, W, 0.32, 0.28, 0, beamY, D / 2 - 0.14, mConcreteDark);
    addBimBox('structure', 'slab', lvl, W, 0.32, 0.28, 0, beamY, -D / 2 + 0.14, mConcreteDark);

    // Full structural column grid (Grid A-E x 1-6)
    for (const gx of TOWER_DIMS.gridX) {
      for (const gz of TOWER_DIMS.gridZ) {
        addBimBox('structure', 'column', lvl, 0.42, clearH, 0.42, gx, y0 + ST + clearH / 2, gz, mConcrete);
      }
    }

    // Core Shear Walls + Staircase Flights (all levels)
    const cy = y0 + ST + clearH / 2;
    addBimBox('core', 'core', lvl, 4.4, clearH, 0.24, 1.4, cy, -3.4, mCore, false, 'core');
    addBimBox('core', 'core', lvl, 0.24, clearH, 5.2, -0.8, cy, -0.8, mCore, false, 'core');
    addBimBox('core', 'core', lvl, 0.24, clearH, 5.2, 3.6, cy, -0.8, mCore, false, 'core');
    // Scissor stairs inside core
    addBimBox('core', 'core', lvl, 2.2, 0.22, 1.2, 2.2, y0 + h * 0.48, -2.1, mConcreteDark, false, 'core');

    // Architectural walls + unit partitions + front balconies per floor
    if (isPodium) {
      // Podium shopfront glazing + rear service walls
      addBimBox('finish', 'podium', lvl, W - 0.8, clearH - 0.5, 0.1, 0, y0 + ST + clearH / 2, D / 2 - 0.08, mGlass);
      addBimBox('finish', 'podium', lvl, 10.2, 0.85, 0.24, 0, y0 + h - 0.42, D / 2 + 0.22, mFacade);
      addBimBox('masonry', 'podium', lvl, 0.24, clearH, D - 0.6, -W / 2 + 0.12, cy, 0, mMasonry);
      addBimBox('masonry', 'podium', lvl, 0.24, clearH, D - 0.6, W / 2 - 0.12, cy, 0, mMasonry);
      addBimBox('masonry', 'podium', lvl, W - 0.5, clearH, 0.24, 0, cy, -D / 2 + 0.12, mMasonry);
    } else {
      // Residential Typical Floor (140 / 185 / 205 m² partitions)
      for (const seg of TYPICAL_WALL_SEGMENTS) {
        if (seg.kind === 'balustrade') {
          addBimBox('finish', 'interiorFinish', lvl, seg.w, 1.0, seg.d, seg.x, y0 + ST + 0.5, seg.z, mGlass, false, seg.owner === 'exterior' ? undefined : seg.owner);
        } else if (seg.kind === 'glass') {
          addBimBox('finish', 'facade', lvl, seg.w, clearH - 0.35, 0.06, seg.x, y0 + ST + clearH / 2, seg.z, mGlass, false, seg.owner === 'exterior' ? undefined : seg.owner);
        } else {
          addBimBox(
            'masonry',
            'wall',
            lvl,
            seg.w,
            clearH,
            seg.d,
            seg.x,
            y0 + ST + clearH / 2,
            seg.z,
            mMasonry,
            false,
            seg.owner === 'exterior' ? undefined : seg.owner
          );
        }
      }

      // Facade pilaster claddings on front elevation (matches Capital Tower limestone / bronze rhythm)
      const isDarkLvl = lvl <= 3 || lvl >= 11;
      const cladding = isDarkLvl ? mFacade : mSandstone;
      for (const px of [-9.4, -4.95, -0.1, 4.95, 9.4]) {
        addBimBox('finish', 'facade', lvl, 0.68, clearH, 0.26, px, cy, D / 2 + 0.14, cladding);
      }

      // Parquet finish plates per apartment (thin top covering showing unit breakdown cleanly)
      addBimBox('finish', 'interiorFinish', lvl, 13.0, 0.05, 10.0, -3.0, y0 + ST + 0.025, -8.6, mParquet, false, 'apt01');
      addBimBox('finish', 'interiorFinish', lvl, 9.2, 0.05, 16.5, -5.0, y0 + ST + 0.025, 5.1, mParquet, false, 'apt02');
      addBimBox('finish', 'interiorFinish', lvl, 9.6, 0.05, 27.0, 4.7, y0 + ST + 0.025, -0.1, mParquet, false, 'apt03');
    }

    // Concealed HVAC trunk ducts + linear diffusers + distribution panel on every floor
    const ceilY = y0 + h - ST - 0.34;
    // Main apartment duct spines (Apt 01 hall, Apt 02 reception hall, Apt 03 gallery & reception)
    addBimBox('mep', 'duct', lvl, 9.2, 0.24, 0.42, -3.0, ceilY, -7.2, mDuct, false, 'apt01');
    addBimBox('mep', 'duct', lvl, 0.42, 0.24, 10.6, -2.6, ceilY, 6.2, mDuct, false, 'apt02');
    addBimBox('mep', 'duct', lvl, 0.42, 0.24, 15.2, 4.25, ceilY, 1.0, mDuct, false, 'apt03');
    addBimBox('mep', 'duct', lvl, 4.4, 0.24, 0.42, 2.0, ceilY, 7.2, mDuct, false, 'apt03');
    // Linear diffusers
    addBimBox('mep', 'duct', lvl, 1.1, 0.06, 0.2, 2.0, ceilY - 0.16, -7.2, mDiffuser);
    addBimBox('mep', 'duct', lvl, 1.1, 0.06, 0.2, -2.6, ceilY - 0.16, 8.6, mDiffuser);
    addBimBox('mep', 'duct', lvl, 1.1, 0.06, 0.2, 2.3, ceilY - 0.16, 8.6, mDiffuser);
    // Floor Electrical Distribution Panel beside elevator lobby
    addBimBox('mep', 'conduit', lvl, 0.14, 0.65, 0.48, 3.45, y0 + ST + 1.45, 0.65, mPanel);
    addBimBox('mep', 'conduit', lvl, 0.12, clearH, 0.12, 3.42, cy, 1.4, mConduit);
  }

  // 3) Roof Slab + Classical Cornice + HVAC Rooftop Plant + Machine Room (lvl = levelCount)
  addBimBox('structure', 'slab', levelCount, W + 0.5, ST, D + 0.5, 0, totalTopY + ST / 2, 0, mConcrete, true);
  addBimBox('finish', 'facade', levelCount, W + 1.6, 0.55, D + 1.6, 0, totalTopY + 0.55, 0, mFacade);
  addBimBox('core', 'core', levelCount, 5.2, 2.3, 5.4, 1.4, totalTopY + 1.15, -0.8, mCore, true, 'core');
  addBimBox('mep', 'duct', levelCount, 3.4, 1.25, 2.1, -5.2, totalTopY + 0.8, -5.5, mDuct);
  addBimBox('mep', 'duct', levelCount, 3.4, 1.25, 2.1, -5.2, totalTopY + 0.8, 4.5, mDuct);

  // 4) Continuous Vertical Plumbing Wet Stacks (all 13 floors aligned with kitchen/bath shafts!)
  for (const st of TOWER_DIMS.wetStacks) {
    addBimCyl('mep', 'pipe', 0, 0.11, totalTopY + 0.8, st.x, (totalTopY + 0.2) / 2, st.z, mPipeSupply);
    addBimCyl('mep', 'pipe', 0, 0.14, totalTopY + 0.8, st.x + 0.34, (totalTopY + 0.2) / 2, st.z, mPipeDrain);
  }

  // 5) Animated Twin Elevator Cabs traveling up & down inside the Core
  for (const [idx, ez] of [-0.05, 1.1].entries()) {
    const cab = addBimBox('core', 'core', 1, 1.55, 2.15, 1.0, 0.25, PH + 3.0, ez, mSteel, true, 'core');
    elevatorCabs.push({ mesh: cab, phase: idx * Math.PI, baseX: 0.25, baseZ: ez });
  }

  return { layerGroups, trackers, elevatorCabs, pickables };
}
