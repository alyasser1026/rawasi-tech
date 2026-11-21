import type * as ThreeNS from 'three';

type Three = typeof ThreeNS;
type ShapeKind = 'box' | 'cylinder';
type AnimMode = 'scale' | 'rise' | 'slideZ' | 'slideX';
type FinishKey =
  | 'travertine'
  | 'darkStone'
  | 'bronze'
  | 'aluminum'
  | 'wood'
  | 'glass'
  | 'balconyGlass'
  | 'warmGlow'
  | 'craneYellow'
  | 'safetyOrange'
  | 'foliage'
  | 'solar'
  | 'paving';

type ArchPart = {
  finish: FinishKey;
  shape: ShapeKind;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  start: number;
  end: number;
  hideStart?: number;
  hideEnd?: number;
  mode?: AnimMode;
  dirSign?: number;
  rx?: number;
  ry?: number;
  rz?: number;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, p: number) => {
  const t = clamp01((p - a) / Math.max(0.0001, b - a));
  return t * t * (3 - 2 * t);
};

function createTravertineTexture(THREE: Three): ThreeNS.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#e7ddd0';
  ctx.fillRect(0, 0, 256, 256);

  const courseH = 32;
  for (let row = 0; row < 8; row++) {
    const y = row * courseH;
    const tone = (row % 3) * 5;
    ctx.fillStyle = `rgb(${232 - tone}, ${222 - tone}, ${208 - tone})`;
    ctx.fillRect(0, y + 1, 256, courseH - 2);

    // Subtle limestone veining
    ctx.fillStyle = 'rgba(170, 152, 130, 0.14)';
    ctx.fillRect(0, y + 9 + (row % 4) * 3, 256, 2);

    // Architectural ashlar joint lines
    ctx.fillStyle = 'rgba(92, 82, 70, 0.24)';
    ctx.fillRect(0, y, 256, 1.5);
    const offsetX = (row % 2) * 64;
    for (let x = offsetX; x < 256; x += 128) {
      ctx.fillRect(x, y, 1.5, courseH);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCedarWoodTexture(THREE: Three): ThreeNS.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#8b5a33';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 16; i++) {
    const y = i * 16;
    const shade = (i % 4) * 6;
    ctx.fillStyle = `rgb(${144 - shade}, ${94 - Math.round(shade * 0.7)}, ${54 - Math.round(shade * 0.5)})`;
    ctx.fillRect(0, y, 256, 14);
    ctx.fillStyle = 'rgba(42, 24, 12, 0.34)';
    ctx.fillRect(0, y + 14, 256, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Architectural cladding, curtain-wall glazing, cantilevered balconies,
 * entrance canopy, rooftop penthouse/pergola/solar crown, and tower crane
 * synchronized cleanly with `concrete-structure-three.ts`.
 */
export function createArchitecturalBuilding(THREE: Three, concreteTexture?: ThreeNS.Texture) {
  const group = new THREE.Group();
  group.name = 'architectural-building';

  const createdTextures: ThreeNS.Texture[] = [];
  const createdGeometries: ThreeNS.BufferGeometry[] = [];
  const createdMaterials: ThreeNS.Material[] = [];

  const travertineTex = createTravertineTexture(THREE);
  if (travertineTex) createdTextures.push(travertineTex);
  const woodTex = createCedarWoodTexture(THREE);
  if (woodTex) createdTextures.push(woodTex);

  const trackMat = <T extends ThreeNS.Material>(mat: T): T => {
    createdMaterials.push(mat);
    return mat;
  };
  const trackGeo = <T extends ThreeNS.BufferGeometry>(geo: T): T => {
    createdGeometries.push(geo);
    return geo;
  };

  const materials: Record<FinishKey, ThreeNS.MeshStandardMaterial> = {
    travertine: trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe6ddd0,
        map: travertineTex || concreteTexture || null,
        bumpMap: travertineTex || concreteTexture || null,
        bumpScale: 0.014,
        roughness: 0.76,
        metalness: 0.04,
      })
    ),
    darkStone: trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x262e36,
        roughness: 0.52,
        metalness: 0.22,
      })
    ),
    bronze: trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xc89156,
        roughness: 0.3,
        metalness: 0.82,
      })
    ),
    aluminum: trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1b2229,
        roughness: 0.34,
        metalness: 0.76,
      })
    ),
    wood: trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x946137,
        map: woodTex || null,
        roughness: 0.7,
        metalness: 0.04,
      })
    ),
    glass: trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x243f54,
        roughness: 0.08,
        metalness: 0.65,
        transparent: true,
        opacity: 0.78,
      })
    ),
    balconyGlass: trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x8db8d0,
        roughness: 0.07,
        metalness: 0.28,
        transparent: true,
        opacity: 0.36,
        depthWrite: false,
      })
    ),
    warmGlow: trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffe6c2,
        emissive: 0xffb156,
        emissiveIntensity: 1.45,
        roughness: 0.32,
        metalness: 0.05,
      })
    ),
    craneYellow: trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xd98f1e,
        roughness: 0.44,
        metalness: 0.46,
      })
    ),
    safetyOrange: trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe25c22,
        roughness: 0.54,
        metalness: 0.18,
      })
    ),
    foliage: trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x3b5b40,
        roughness: 0.88,
        metalness: 0.02,
      })
    ),
    solar: trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x13273f,
        roughness: 0.16,
        metalness: 0.64,
      })
    ),
    paving: trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x43484f,
        roughness: 0.86,
        metalness: 0.06,
      })
    ),
  };

  const parts: ArchPart[] = [];
  const box = (
    finish: FinishKey,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    start: number,
    end: number,
    opts?: Partial<Pick<ArchPart, 'hideStart' | 'hideEnd' | 'mode' | 'dirSign' | 'rx' | 'ry' | 'rz'>>
  ) => {
    parts.push({ finish, shape: 'box', x, y, z, w, h, d, start, end, ...opts });
  };

  const cyl = (
    finish: FinishKey,
    x: number,
    y: number,
    z: number,
    radius: number,
    len: number,
    start: number,
    end: number,
    opts?: Partial<Pick<ArchPart, 'hideStart' | 'hideEnd' | 'mode' | 'dirSign' | 'rx' | 'ry' | 'rz'>>
  ) => {
    parts.push({ finish, shape: 'cylinder', x, y, z, w: radius, h: len, d: radius, start, end, ...opts });
  };

  const xs = [-6, -2, 2, 6];
  const zs = [-4, 0, 4];
  const floorHeight = 3.25;

  // =========================================================================
  // 1. SITE PODIUM, PLAZA PAVING, GRAND ENTRY STEPS, PLANTERS & BOLLARDS
  // =========================================================================
  box('paving', 0, -0.39, 0.5, 20.6, 0.08, 17.0, 0.0, 0.04);
  box('darkStone', 0, -0.30, 0, 17.65, 0.22, 12.95, 0.01, 0.05);
  // Wide front entrance terrace & architectural stone steps
  box('travertine', 0, -0.09, 5.15, 5.6, 0.24, 2.0, 0.03, 0.08);
  box('darkStone', 0, -0.20, 6.28, 4.8, 0.16, 0.42, 0.04, 0.09);
  box('travertine', 0, -0.31, 6.68, 5.0, 0.15, 0.42, 0.04, 0.095);
  box('bronze', 0, -0.02, 6.14, 5.56, 0.03, 0.04, 0.68, 0.75);

  // Flanking stone planters, greenery & illuminated walkway bollards
  for (const side of [-1, 1]) {
    const px = side * 4.25;
    box('darkStone', px, 0.06, 5.1, 2.55, 0.54, 1.05, 0.71, 0.78);
    box('travertine', px, 0.35, 5.1, 2.62, 0.07, 1.12, 0.72, 0.79);
    for (const bx of [-0.75, 0, 0.75]) {
      box('foliage', px + bx, 0.56, 5.1, 0.62, 0.46, 0.62, 0.74, 0.82, { mode: 'rise' });
      box('foliage', px + bx + side * 0.06, 0.80, 5.1, 0.40, 0.34, 0.40, 0.76, 0.84, { mode: 'rise' });
    }
    // Site bollard pathway lights
    for (const bz of [5.85, 7.1]) {
      box('aluminum', side * 3.1, -0.06, bz, 0.14, 0.62, 0.14, 0.72, 0.8, { mode: 'rise' });
      box('warmGlow', side * 3.1, 0.22, bz, 0.15, 0.09, 0.15, 0.75, 0.83);
    }
  }

  // =========================================================================
  // 2. PER-FLOOR LUXURY FACADE ENVELOPE, GLAZING, BALCONIES & SAFETY RAILS
  // =========================================================================
  const addWindowBay = (
    orientation: 'front' | 'back' | 'west' | 'east',
    bayCenter: number,
    floorBottom: number,
    startT: number,
    opts?: { fullHeightDoor?: boolean; noGlow?: boolean; recessedGlass?: boolean; hasBalconyDoor?: boolean }
  ) => {
    const mullionDepth = 0.13;
    const frameThick = 0.065;
    const sillY = floorBottom + 0.15;
    const headY = floorBottom + 2.75;
    const winH = headY - sillY;
    const winMidY = (sillY + headY) / 2;
    const baySpan = 3.36;

    const place = (
      finish: FinishKey,
      along: number,
      y: number,
      depthOffset: number,
      spanAlong: number,
      spanY: number,
      spanDepth: number,
      s: number,
      e: number,
      mode?: AnimMode
    ) => {
      if (orientation === 'front') {
        box(finish, bayCenter + along, y, 4.10 + depthOffset, spanAlong, spanY, spanDepth, s, e, { mode });
      } else if (orientation === 'back') {
        box(finish, bayCenter + along, y, -4.10 - depthOffset, spanAlong, spanY, spanDepth, s, e, { mode });
      } else if (orientation === 'west') {
        box(finish, -6.10 - depthOffset, y, bayCenter + along, spanDepth, spanY, spanAlong, s, e, { mode });
      } else {
        box(finish, 6.10 + depthOffset, y, bayCenter + along, spanDepth, spanY, spanAlong, s, e, { mode });
      }
    };

    // Dark stone outer cheek liners around opening
    place('darkStone', -baySpan / 2 - 0.04, winMidY, 0.08, 0.08, winH + 0.04, 0.22, startT, startT + 0.04);
    place('darkStone', baySpan / 2 + 0.04, winMidY, 0.08, 0.08, winH + 0.04, 0.22, startT, startT + 0.04);

    // Anodized aluminum perimeter frame
    place('aluminum', 0, headY - frameThick / 2, 0.04, baySpan, frameThick, mullionDepth, startT + 0.01, startT + 0.055);
    place('aluminum', 0, sillY + frameThick / 2, 0.04, baySpan, frameThick, mullionDepth, startT + 0.01, startT + 0.055);
    place('aluminum', -baySpan / 2 + frameThick / 2, winMidY, 0.04, frameThick, winH, mullionDepth, startT + 0.01, startT + 0.055);
    place('aluminum', baySpan / 2 - frameThick / 2, winMidY, 0.04, frameThick, winH, mullionDepth, startT + 0.01, startT + 0.055);

    // Intermediate vertical mullions & horizontal transom
    for (const mx of [-0.84, 0.84]) {
      place('aluminum', mx, winMidY, 0.04, 0.055, winH, mullionDepth, startT + 0.02, startT + 0.065);
    }
    if (!opts?.fullHeightDoor) {
      place('aluminum', 0, sillY + 0.56, 0.04, baySpan, 0.05, mullionDepth, startT + 0.025, startT + 0.065);
    } else {
      place('aluminum', 0, headY - 0.52, 0.04, baySpan, 0.05, mullionDepth, startT + 0.025, startT + 0.065);
    }

    // Reflective curtain-wall glass pane
    place('glass', 0, winMidY, 0.02, baySpan - 0.06, winH - 0.06, 0.035, startT + 0.035, startT + 0.085);

    // Warm interior ceiling cove light visible through glass
    if (!opts?.noGlow) {
      place('warmGlow', 0, headY - 0.22, -0.58, baySpan * 0.72, 0.06, 0.14, startT + 0.065, startT + 0.11);
    }
  };

  for (let floor = 0; floor < 4; floor++) {
    const stage = 0.13 + floor * 0.187;
    const bottom = 0.72 + floor * floorHeight;
    const top = bottom + floorHeight;
    const finishStart = 0.28 + floor * 0.145;

    // 2A. Temporary perimeter safety guardrails after floor slab finishes, removed cleanly as facade closes
    const railShowStart = stage + 0.135;
    const railShowEnd = stage + 0.155;
    const railHideStart = finishStart + 0.015;
    const railHideEnd = finishStart + 0.045;
    if (floor < 3) {
      for (const px of [-5.8, -4.0, -2.2, -0.2, 1.8]) {
        box('safetyOrange', px, top + 0.55, 4.18, 0.045, 0.92, 0.045, railShowStart, railShowEnd, {
          hideStart: railHideStart,
          hideEnd: railHideEnd,
        });
      }
      box('safetyOrange', -2.0, top + 0.96, 4.18, 7.8, 0.04, 0.04, railShowStart, railShowEnd, {
        hideStart: railHideStart,
        hideEnd: railHideEnd,
      });
      box('safetyOrange', -2.0, top + 0.56, 4.18, 7.8, 0.035, 0.035, railShowStart, railShowEnd, {
        hideStart: railHideStart,
        hideEnd: railHideEnd,
      });
      for (const pz of [-3.8, -2.0, -0.2, 1.8, 3.8]) {
        box('safetyOrange', -6.18, top + 0.55, pz, 0.045, 0.92, 0.045, railShowStart, railShowEnd, {
          hideStart: railHideStart,
          hideEnd: railHideEnd,
        });
      }
      box('safetyOrange', -6.18, top + 0.96, 0, 0.04, 0.04, 7.8, railShowStart, railShowEnd, {
        hideStart: railHideStart,
        hideEnd: railHideEnd,
      });
    }

    // 2B. Perimeter Column Pilasters (Travertine Stone + Brushed Bronze vertical inlays)
    for (const x of xs) {
      for (const zSign of [-1, 1]) {
        const z = zSign * 4.30;
        box('travertine', x, bottom + floorHeight / 2, z, 0.62, floorHeight + 0.02, 0.16, finishStart, finishStart + 0.055, {
          mode: 'rise',
        });
        box('bronze', x, bottom + floorHeight / 2, z + zSign * 0.09, 0.06, floorHeight - 0.18, 0.03, finishStart + 0.03, finishStart + 0.08, {
          mode: 'rise',
        });
      }
    }
    for (const z of zs) {
      for (const xSign of [-1, 1]) {
        // Leave east stair shear-wall center pilaster sleek
        const x = xSign * 6.30;
        box('travertine', x, bottom + floorHeight / 2, z, 0.16, floorHeight + 0.02, 0.62, finishStart, finishStart + 0.055, {
          mode: 'rise',
        });
        box('bronze', x + xSign * 0.09, bottom + floorHeight / 2, z, 0.03, floorHeight - 0.18, 0.06, finishStart + 0.03, finishStart + 0.08, {
          mode: 'rise',
        });
      }
    }

    // 2C. Horizontal Travertine Spandrel Fascia & Dark Shadow-Gap Bronze Reveals
    const fasciaY = top - 0.14;
    box('travertine', 0, fasciaY, 4.29, 13.06, 0.56, 0.16, finishStart + 0.045, finishStart + 0.105);
    box('travertine', 0, fasciaY, -4.29, 13.06, 0.56, 0.16, finishStart + 0.045, finishStart + 0.105);
    box('travertine', -6.29, fasciaY, 0, 0.16, 0.56, 8.74, finishStart + 0.045, finishStart + 0.105);
    box('travertine', 6.29, fasciaY, 0, 0.16, 0.56, 8.74, finishStart + 0.045, finishStart + 0.105);

    // Metallic bronze drip-edge accents along each floor band
    box('bronze', 0, fasciaY - 0.29, 4.35, 13.12, 0.04, 0.07, finishStart + 0.075, finishStart + 0.125);
    box('bronze', 0, fasciaY - 0.29, -4.35, 13.12, 0.04, 0.07, finishStart + 0.075, finishStart + 0.125);
    box('bronze', -6.35, fasciaY - 0.29, 0, 0.07, 0.04, 8.80, finishStart + 0.075, finishStart + 0.125);
    box('bronze', 6.35, fasciaY - 0.29, 0, 0.07, 0.04, 8.80, finishStart + 0.075, finishStart + 0.125);

    // Dark recessed reveal groove on spandrel upper lip
    box('darkStone', 0, fasciaY + 0.26, 4.31, 12.98, 0.06, 0.14, finishStart + 0.06, finishStart + 0.11);
    box('darkStone', -6.31, fasciaY + 0.26, 0, 0.14, 0.06, 8.66, finishStart + 0.06, finishStart + 0.11);

    // 2D. Curtain Wall Glazing & Mullions on All Sides
    // Front Left bay (-4)
    addWindowBay('front', -4, bottom, finishStart + 0.015, { fullHeightDoor: floor > 0 });
    // Front Center bay (0) - Entrance on ground floor, panoramic window + wood louvers on upper floors
    addWindowBay('front', 0, bottom, finishStart + 0.02, { fullHeightDoor: floor === 0 });
    // Stairwell Front-Right Bay (cx = +4, z = +4.18) -> transparent curtain wall revealing interior stairs
    box('aluminum', 4, bottom + 2.74, 4.18, 3.36, 0.06, 0.12, finishStart + 0.02, finishStart + 0.06);
    box('aluminum', 4, bottom + 0.18, 4.18, 3.36, 0.06, 0.12, finishStart + 0.02, finishStart + 0.06);
    box('aluminum', 4, bottom + 1.46, 4.18, 3.36, 0.05, 0.12, finishStart + 0.025, finishStart + 0.07);
    for (const sx of [2.35, 3.45, 4.55, 5.65]) {
      box('aluminum', sx, bottom + 1.46, 4.18, 0.055, 2.60, 0.12, finishStart + 0.025, finishStart + 0.07);
    }
    box('balconyGlass', 4, bottom + 1.46, 4.18, 3.32, 2.54, 0.04, finishStart + 0.035, finishStart + 0.085);
    box('warmGlow', 2.45, bottom + 1.46, 4.24, 0.045, 2.35, 0.045, finishStart + 0.07, finishStart + 0.115);

    // Rear Facade glazing (-Z)
    for (const bx of [-4, 0, 4]) {
      addWindowBay('back', bx, bottom, finishStart + 0.025, { noGlow: bx === 4 });
    }
    // West Facade glazing (-X)
    addWindowBay('west', -2, bottom, finishStart + 0.02);
    addWindowBay('west', 2, bottom, finishStart + 0.02, { fullHeightDoor: floor > 0 });
    // East Facade rear bay glazing (+X) + subtle dark cladding beside stair wall
    addWindowBay('east', -2, bottom, finishStart + 0.03);
    box('darkStone', 6.26, bottom + 1.46, 2.0, 0.08, 2.60, 3.34, finishStart + 0.02, finishStart + 0.08);
    box('bronze', 6.31, bottom + 1.46, 1.35, 0.03, 2.40, 0.045, finishStart + 0.05, finishStart + 0.10);
    box('bronze', 6.31, bottom + 1.46, 2.65, 0.03, 2.40, 0.045, finishStart + 0.05, finishStart + 0.10);

    // 2E. Ground Floor Grand Entrance Portal & Illuminated Wood Canopy
    if (floor === 0) {
      // Twin bronze door handles + center transom divider on ground center bay
      for (const hx of [-0.14, 0.14]) {
        box('bronze', hx, bottom + 1.15, 4.21, 0.035, 0.92, 0.06, finishStart + 0.07, finishStart + 0.12);
      }
      // Architectural darkStone entry portal surround piers
      box('darkStone', -1.85, bottom + 1.48, 4.38, 0.42, 2.95, 0.34, finishStart + 0.04, finishStart + 0.095, { mode: 'rise' });
      box('darkStone', 1.85, bottom + 1.48, 4.38, 0.42, 2.95, 0.34, finishStart + 0.04, finishStart + 0.095, { mode: 'rise' });

      // Cantilevered luxury canopy with timber soffit & recessed linear lights
      box('darkStone', 0, top - 0.18, 5.26, 4.65, 0.24, 2.08, finishStart + 0.08, finishStart + 0.145, {
        mode: 'slideZ',
        dirSign: 1,
      });
      box('bronze', 0, top - 0.06, 6.29, 4.69, 0.045, 0.05, finishStart + 0.10, finishStart + 0.155);
      box('wood', 0, top - 0.31, 5.24, 4.35, 0.04, 1.82, finishStart + 0.095, finishStart + 0.155);
      for (const lz of [4.72, 5.24, 5.76]) {
        box('warmGlow', 0, top - 0.335, lz, 3.6, 0.025, 0.065, finishStart + 0.11, finishStart + 0.165);
      }
    }

    // 2F. Upper Floor Architectural Timber Louvers & Cantilevered Glass Balconies (floors 1, 2, 3)
    if (floor > 0) {
      // Vertical cedar architectural louvers on Front Center right side & West Rear bay
      for (let i = 0; i < 6; i++) {
        box('wood', 0.92 + i * 0.16, bottom + 1.45, 4.24, 0.055, 2.58, 0.16, finishStart + 0.07, finishStart + 0.125);
        box('wood', -6.24, bottom + 1.45, -2.9 + i * 0.18, 0.16, 2.58, 0.055, finishStart + 0.07, finishStart + 0.125);
      }

      // FRONT-LEFT CANTILEVERED BALCONY (x in [-5.88, -2.12], z: 4.25 -> 5.42)
      const fBalW = 3.76;
      const fBalCx = -4.0;
      const fBalCz = 4.84;
      const fBalD = 1.18;
      box('travertine', fBalCx, bottom + 0.04, fBalCz, fBalW, 0.24, fBalD, finishStart + 0.055, finishStart + 0.11, {
        mode: 'slideZ',
        dirSign: 1,
      });
      box('wood', fBalCx, bottom - 0.09, fBalCz, fBalW - 0.12, 0.035, fBalD - 0.1, finishStart + 0.075, finishStart + 0.13);
      box('warmGlow', fBalCx, bottom - 0.11, fBalCz + 0.25, fBalW - 0.6, 0.02, 0.055, finishStart + 0.09, finishStart + 0.145);
      // Aluminum shoe channel & bronze handrail
      box('aluminum', fBalCx, bottom + 0.20, 5.40, fBalW, 0.08, 0.06, finishStart + 0.085, finishStart + 0.135);
      box('bronze', fBalCx, bottom + 1.18, 5.40, fBalW + 0.02, 0.045, 0.055, finishStart + 0.11, finishStart + 0.165);
      // Frameless glass balustrade (front & 2 returns)
      box('balconyGlass', fBalCx, bottom + 0.70, 5.40, fBalW - 0.04, 0.94, 0.03, finishStart + 0.095, finishStart + 0.15);
      for (const sx of [fBalCx - fBalW / 2 + 0.02, fBalCx + fBalW / 2 - 0.02]) {
        box('balconyGlass', sx, bottom + 0.70, 4.82, 0.03, 0.94, fBalD - 0.04, finishStart + 0.095, finishStart + 0.15);
        box('bronze', sx, bottom + 1.18, 4.82, 0.055, 0.045, fBalD, finishStart + 0.11, finishStart + 0.165);
      }
      // Side cedar privacy louver screen on inner edge of balcony
      for (let i = 0; i < 4; i++) {
        box('wood', -2.20, bottom + 1.38, 4.42 + i * 0.22, 0.06, 2.38, 0.12, finishStart + 0.10, finishStart + 0.155, {
          mode: 'rise',
        });
      }

      // WEST-FRONT CANTILEVERED BALCONY (z in [0.16, 3.84], x: -6.25 -> -7.36)
      const wBalD = 3.68;
      const wBalCz = 2.0;
      const wBalCx = -6.81;
      const wBalW = 1.12;
      box('travertine', wBalCx, bottom + 0.04, wBalCz, wBalW, 0.24, wBalD, finishStart + 0.055, finishStart + 0.11, {
        mode: 'slideX',
        dirSign: -1,
      });
      box('wood', wBalCx, bottom - 0.09, wBalCz, wBalW - 0.1, 0.035, wBalD - 0.12, finishStart + 0.075, finishStart + 0.13);
      box('warmGlow', wBalCx - 0.22, bottom - 0.11, wBalCz, 0.055, 0.02, wBalD - 0.6, finishStart + 0.09, finishStart + 0.145);
      box('aluminum', -7.34, bottom + 0.20, wBalCz, 0.06, 0.08, wBalD, finishStart + 0.085, finishStart + 0.135);
      box('bronze', -7.34, bottom + 1.18, wBalCz, 0.055, 0.045, wBalD + 0.02, finishStart + 0.11, finishStart + 0.165);
      box('balconyGlass', -7.34, bottom + 0.70, wBalCz, 0.03, 0.94, wBalD - 0.04, finishStart + 0.095, finishStart + 0.15);
      for (const sz of [wBalCz - wBalD / 2 + 0.02, wBalCz + wBalD / 2 - 0.02]) {
        box('balconyGlass', -6.80, bottom + 0.70, sz, wBalW - 0.04, 0.94, 0.03, finishStart + 0.095, finishStart + 0.15);
        box('bronze', -6.80, bottom + 1.18, sz, wBalW, 0.045, 0.055, finishStart + 0.11, finishStart + 0.165);
      }
    }
  }

  // =========================================================================
  // 3. ARCHITECTURAL CROWN PARAPET, ROOFTOP PENTHOUSE, PERGOLA, HVAC & SOLAR
  // =========================================================================
  const roofTopY = 13.85;
  const parapetH = 1.05;
  const parapetMidY = roofTopY + parapetH / 2 - 0.05;

  // Perimeter parapet walls + dark metal coping + cantilevered glowing crown eyebrow
  box('travertine', 0, parapetMidY, 4.24, 12.88, parapetH, 0.24, 0.76, 0.83, { mode: 'rise' });
  box('travertine', 0, parapetMidY, -4.24, 12.88, parapetH, 0.24, 0.76, 0.83, { mode: 'rise' });
  box('travertine', -6.24, parapetMidY, 0, 0.24, parapetH, 8.64, 0.76, 0.83, { mode: 'rise' });
  box('travertine', 6.24, parapetMidY, 0, 0.24, parapetH, 8.64, 0.76, 0.83, { mode: 'rise' });

  // Coping & cantilevered cornice ring at y = 14.92
  box('darkStone', 0, 14.90, 4.46, 13.86, 0.20, 0.72, 0.79, 0.855);
  box('darkStone', 0, 14.90, -4.46, 13.86, 0.20, 0.72, 0.79, 0.855);
  box('darkStone', -6.46, 14.90, 0, 0.72, 0.20, 9.64, 0.79, 0.855);
  box('darkStone', 6.46, 14.90, 0, 0.72, 0.20, 9.64, 0.79, 0.855);
  box('bronze', 0, 15.02, 4.82, 13.90, 0.04, 0.04, 0.81, 0.875);
  box('bronze', -6.82, 15.02, 0, 0.04, 0.04, 9.68, 0.81, 0.875);
  // Warm crown wash strip under eyebrow soffit
  box('warmGlow', 0, 14.78, 4.58, 12.8, 0.03, 0.09, 0.82, 0.885);
  box('warmGlow', -6.58, 14.78, 0, 0.09, 0.03, 8.8, 0.82, 0.885);

  // Rooftop Staircase Penthouse Core (x in [2.0, 6.2], z in [-0.1, 4.15])
  const phH = 2.75;
  const phMidY = roofTopY + phH / 2 - 0.02;
  box('travertine', 4.1, phMidY, 2.0, 4.25, phH, 4.2, 0.78, 0.85, { mode: 'rise' });
  box('darkStone', 4.1, roofTopY + phH + 0.08, 2.0, 4.75, 0.22, 4.7, 0.81, 0.875);
  box('bronze', 4.1, roofTopY + phH + 0.20, 4.35, 4.76, 0.04, 0.04, 0.82, 0.885);
  // Penthouse clerestory ribbon glass + terrace door on west wall
  box('glass', 4.1, roofTopY + 2.24, 4.12, 3.4, 0.42, 0.06, 0.82, 0.875);
  box('aluminum', 1.96, roofTopY + 1.12, 1.35, 0.08, 2.22, 1.08, 0.81, 0.87);
  box('glass', 1.95, roofTopY + 1.15, 1.35, 0.05, 1.95, 0.92, 0.82, 0.88);
  box('warmGlow', 4.1, roofTopY + 2.52, 4.22, 3.6, 0.04, 0.07, 0.83, 0.888);

  // Rooftop Timber-Slatted Pergola Terrace (x in [-5.6, -0.3], z in [0.4, 3.5])
  const pergH = 2.35;
  for (const px of [-5.5, -0.4]) {
    for (const pz of [0.45, 3.45]) {
      box('aluminum', px, roofTopY + pergH / 2 - 0.05, pz, 0.14, pergH, 0.14, 0.80, 0.86, { mode: 'rise' });
    }
  }
  box('aluminum', -2.95, roofTopY + pergH - 0.02, 0.45, 5.3, 0.16, 0.16, 0.82, 0.87);
  box('aluminum', -2.95, roofTopY + pergH - 0.02, 3.45, 5.3, 0.16, 0.16, 0.82, 0.87);
  box('aluminum', -5.5, roofTopY + pergH - 0.02, 1.95, 0.16, 0.16, 3.16, 0.82, 0.87);
  box('aluminum', -0.4, roofTopY + pergH - 0.02, 1.95, 0.16, 0.16, 3.16, 0.82, 0.87);
  for (let i = 0; i < 11; i++) {
    box('wood', -5.2 + i * 0.45, roofTopY + pergH + 0.08, 1.95, 0.09, 0.12, 3.24, 0.83, 0.885);
  }
  box('warmGlow', -2.95, roofTopY + pergH - 0.12, 3.36, 4.4, 0.035, 0.06, 0.84, 0.89);

  // Rooftop MEP HVAC Chillers behind Louvered Acoustic Screen + Solar PV Array
  box('aluminum', -3.8, roofTopY + 0.72, -1.3, 3.4, 1.45, 0.08, 0.79, 0.855, { mode: 'rise' });
  for (const cx of [-4.6, -3.1]) {
    box('darkStone', cx, roofTopY + 0.52, -2.55, 1.15, 0.96, 1.45, 0.80, 0.865);
    cyl('aluminum', cx, roofTopY + 1.03, -2.55, 0.40, 0.10, 0.81, 0.875);
  }
  // Monocrystalline Solar PV Array (2 rows x 4 panels)
  for (const rz of [-3.15, -1.75]) {
    for (let col = 0; col < 4; col++) {
      const sx = -1.35 + col * 1.12;
      box('aluminum', sx, roofTopY + 0.24, rz, 0.10, 0.50, 0.10, 0.81, 0.87);
      box('solar', sx, roofTopY + 0.52, rz, 0.98, 0.05, 1.02, 0.82, 0.885, { rx: 0.34 });
    }
  }

  // =========================================================================
  // 4. LATTICE TOWER CRANE (Mast via InstancedMesh, Jib Slews Deterministically)
  // =========================================================================
  const craneX = 10.4;
  const craneZ = -5.8;
  const craneTopY = 20.4;
  const craneBaseY = -0.43;

  // Heavy concrete ballast blocks + mast base collar
  box('darkStone', craneX, craneBaseY + 0.28, craneZ, 2.8, 0.56, 2.8, 0.01, 0.08);
  box('travertine', craneX, craneBaseY + 0.82, craneZ, 2.1, 0.52, 2.1, 0.02, 0.09);

  // 4 Vertical Mast Chords + Tier Collars (instanced)
  const mastH = craneTopY - (craneBaseY + 0.95);
  const mastMidY = craneBaseY + 0.95 + mastH / 2;
  for (const cx of [-0.46, 0.46]) {
    for (const cz of [-0.46, 0.46]) {
      box('craneYellow', craneX + cx, mastMidY, craneZ + cz, 0.11, mastH, 0.11, 0.02, 0.19, { mode: 'rise' });
    }
  }
  const tierCount = 11;
  for (let tier = 0; tier <= tierCount; tier++) {
    const ty = craneBaseY + 1.15 + (tier / tierCount) * (mastH - 0.35);
    const ts = 0.03 + (tier / tierCount) * 0.15;
    box('craneYellow', craneX, ty, craneZ + 0.46, 0.98, 0.08, 0.07, ts, ts + 0.04);
    box('craneYellow', craneX, ty, craneZ - 0.46, 0.98, 0.08, 0.07, ts, ts + 0.04);
    box('craneYellow', craneX - 0.46, ty, craneZ, 0.07, 0.08, 0.98, ts, ts + 0.04);
    box('craneYellow', craneX + 0.46, ty, craneZ, 0.07, 0.08, 0.98, ts, ts + 0.04);
  }

  // Build InstancedMesh batches for all static & progress-timed architectural parts
  const unitBoxGeo = trackGeo(new THREE.BoxGeometry(1, 1, 1));
  const unitCylGeo = trackGeo(new THREE.CylinderGeometry(1, 1, 1, 12, 1));
  const batchMap = new Map<string, { finish: FinishKey; shape: ShapeKind; parts: ArchPart[] }>();

  for (const part of parts) {
    const key = `${part.finish}::${part.shape}`;
    let entry = batchMap.get(key);
    if (!entry) {
      entry = { finish: part.finish, shape: part.shape, parts: [] };
      batchMap.set(key, entry);
    }
    entry.parts.push(part);
  }

  const instancedBatches = [...batchMap.entries()].map(([key, batch]) => {
    const mesh = new THREE.InstancedMesh(
      batch.shape === 'cylinder' ? unitCylGeo : unitBoxGeo,
      materials[batch.finish],
      batch.parts.length
    );
    mesh.name = `arch-${key}`;
    mesh.castShadow = batch.finish !== 'balconyGlass' && batch.finish !== 'warmGlow';
    mesh.receiveShadow = batch.finish !== 'warmGlow';
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(mesh);
    return { mesh, parts: batch.parts };
  });

  // =========================================================================
  // 5. SLEWING JIB GROUP OF TOWER CRANE (Pure Deterministic Transform vs Progress)
  // =========================================================================
  const jibGroup = new THREE.Group();
  jibGroup.name = 'crane-slewing-assembly';
  jibGroup.position.set(craneX, craneTopY, craneZ);
  group.add(jibGroup);

  const addJibMesh = (
    parent: ThreeNS.Object3D,
    geo: ThreeNS.BufferGeometry,
    mat: ThreeNS.Material,
    px: number,
    py: number,
    pz: number,
    rx = 0,
    ry = 0,
    rz = 0
  ) => {
    trackGeo(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(px, py, pz);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = mat !== materials.glass && mat !== materials.warmGlow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // Slewing ring & operator cabin
  addJibMesh(jibGroup, new THREE.CylinderGeometry(0.68, 0.72, 0.44, 14), materials.aluminum, 0, 0.16, 0);
  addJibMesh(jibGroup, new THREE.BoxGeometry(1.15, 1.35, 1.05), materials.craneYellow, 0.85, 0.92, 0.72);
  addJibMesh(jibGroup, new THREE.BoxGeometry(0.95, 0.88, 0.08), materials.glass, 0.92, 0.96, 1.24);
  addJibMesh(jibGroup, new THREE.BoxGeometry(0.08, 0.88, 0.86), materials.glass, 0.27, 0.96, 0.72);

  // Apex cathead tower + front/back stay rods
  addJibMesh(jibGroup, new THREE.CylinderGeometry(0.14, 0.46, 3.1, 4), materials.craneYellow, 0, 2.0, 0, 0, Math.PI / 4);
  // Long horizontal boom pointing towards -X (over the building site)
  const jibLen = 16.4;
  addJibMesh(jibGroup, new THREE.BoxGeometry(jibLen, 0.68, 0.76), materials.craneYellow, -jibLen / 2 + 0.5, 0.92, 0);
  addJibMesh(jibGroup, new THREE.BoxGeometry(jibLen - 0.5, 0.10, 0.10), materials.craneYellow, -jibLen / 2 + 0.6, 1.56, 0);
  for (let s = 0; s < 14; s++) {
    const sx = -0.35 - s * 1.12;
    addJibMesh(jibGroup, new THREE.BoxGeometry(0.07, 0.78, 0.72), materials.craneYellow, sx, 1.15, 0, 0, 0, (s % 2 ? 1 : -1) * 0.42);
  }
  // Warning aviation beacon at crane apex & boom tip
  addJibMesh(jibGroup, new THREE.BoxGeometry(0.18, 0.18, 0.18), materials.warmGlow, 0, 3.62, 0);
  addJibMesh(jibGroup, new THREE.BoxGeometry(0.16, 0.16, 0.16), materials.warmGlow, -jibLen + 0.55, 1.32, 0);

  // Tension cables from cathead peak to boom & counter-jib
  const frontCableLen = Math.hypot(11.6, 2.15);
  addJibMesh(jibGroup, new THREE.CylinderGeometry(0.03, 0.03, frontCableLen, 6), materials.aluminum, -5.8, 2.48, 0, 0, 0, Math.PI / 2 - Math.atan2(2.15, 11.6));
  const backCableLen = Math.hypot(4.6, 2.15);
  addJibMesh(jibGroup, new THREE.CylinderGeometry(0.03, 0.03, backCableLen, 6), materials.aluminum, 2.3, 2.48, 0, 0, 0, -(Math.PI / 2 - Math.atan2(2.15, 4.6)));

  // Counter-jib & concrete counterweight blocks (+X)
  addJibMesh(jibGroup, new THREE.BoxGeometry(5.6, 0.52, 0.84), materials.craneYellow, 2.8, 0.88, 0);
  for (let b = 0; b < 3; b++) {
    addJibMesh(jibGroup, new THREE.BoxGeometry(0.68, 1.35, 1.16), materials.darkStone, 3.6 + b * 0.78, 0.88, 0);
  }

  // Traveling Trolley + Hoist Cable + Hook Block
  const trolleyGroup = new THREE.Group();
  trolleyGroup.name = 'crane-trolley';
  trolleyGroup.position.set(-10.5, 0.50, 0);
  jibGroup.add(trolleyGroup);
  addJibMesh(trolleyGroup, new THREE.BoxGeometry(0.86, 0.24, 0.92), materials.aluminum, 0, 0, 0);
  const hoistMesh = addJibMesh(trolleyGroup, new THREE.CylinderGeometry(0.025, 0.025, 1, 6), materials.aluminum, 0, -0.5, 0);
  const hookBlock = addJibMesh(trolleyGroup, new THREE.BoxGeometry(0.42, 0.42, 0.28), materials.craneYellow, 0, -1, 0);

  // =========================================================================
  // 6. DETERMINISTIC SCRUBBING CONTROLLER
  // =========================================================================
  const dummy = new THREE.Object3D();
  let lastProgress = -1;

  function setProgress(value: number) {
    const progress = clamp01(Number.isFinite(value) ? value : 0);
    if (progress === lastProgress) return;
    lastProgress = progress;

    for (const { mesh, parts: batchParts } of instancedBatches) {
      let visibleCount = 0;
      for (let i = 0; i < batchParts.length; i++) {
        const part = batchParts[i];
        let amount = smooth(part.start, part.end, progress);
        if (part.hideStart !== undefined && part.hideEnd !== undefined) {
          amount *= 1 - smooth(part.hideStart, part.hideEnd, progress);
        }
        if (amount <= 0.0001) continue;

        dummy.rotation.set(part.rx ?? 0, part.ry ?? 0, part.rz ?? 0);

        if (part.mode === 'rise') {
          const curH = part.h * amount;
          dummy.position.set(part.x, part.y - part.h / 2 + curH / 2, part.z);
          dummy.scale.set(part.w, curH, part.d);
        } else if (part.mode === 'slideZ') {
          const sign = part.dirSign ?? 1;
          dummy.position.set(part.x, part.y, part.z - sign * (1 - amount) * 0.65);
          dummy.scale.set(part.w, part.h, part.d * (0.15 + 0.85 * amount));
        } else if (part.mode === 'slideX') {
          const sign = part.dirSign ?? 1;
          dummy.position.set(part.x - sign * (1 - amount) * 0.65, part.y, part.z);
          dummy.scale.set(part.w * (0.15 + 0.85 * amount), part.h, part.d);
        } else {
          dummy.position.set(part.x, part.y, part.z);
          dummy.scale.set(part.w * amount, part.h * amount, part.d * amount);
        }

        dummy.updateMatrix();
        mesh.setMatrixAt(visibleCount++, dummy.matrix);
      }
      mesh.count = visibleCount;
      mesh.visible = visibleCount > 0;
      mesh.instanceMatrix.needsUpdate = true;
    }

    // Clamp crane slewing/hoist completion cleanly at progress = 0.89 so 0.90 === 1.00
    const craneActive = smooth(0.04, 0.16, progress);
    jibGroup.visible = craneActive > 0.001;
    jibGroup.scale.setScalar(Math.max(0.0001, craneActive));

    const motionT = clamp01((progress - 0.14) / 0.75);
    jibGroup.rotation.y = -0.34 + Math.sin(motionT * Math.PI * 1.35) * 0.42;

    const trolleyX = -7.2 - Math.sin(motionT * Math.PI) * 5.2 - motionT * 1.4;
    const cableLen = 2.6 + (1 - Math.abs(Math.sin(motionT * Math.PI * 2))) * 3.8 * (1 - motionT * 0.45);
    trolleyGroup.position.set(trolleyX, 0.50, 0);
    hoistMesh.scale.set(1, cableLen, 1);
    hoistMesh.position.set(0, -cableLen / 2, 0);
    hookBlock.position.set(0, -cableLen - 0.21, 0);
  }

  setProgress(0);

  return {
    group,
    setProgress,
    dispose() {
      for (const { mesh } of instancedBatches) {
        mesh.dispose();
      }
      for (const geo of createdGeometries) {
        geo.dispose();
      }
      for (const mat of createdMaterials) {
        mat.dispose();
      }
      for (const tex of createdTextures) {
        tex.dispose();
      }
      jibGroup.clear();
      group.clear();
    },
  };
}
