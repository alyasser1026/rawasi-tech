import type * as ThreeNS from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

type Three = typeof ThreeNS;
type Part = {
  x: number; y: number; z: number;
  width: number; height: number; depth: number;
  start: number; end: number; rise: boolean;
};

/** Dimension batches keep small, physically scaled edge chamfers on the frame. */
export function createConcreteStructure(THREE: Three, texture?: ThreeNS.Texture) {
  const group = new THREE.Group();
  const parts: Part[] = [];
  const xs = [-6, -2, 2, 6];
  const zs = [-4, 0, 4];
  const floorHeight = 3.25;
  const add = (x: number, y: number, z: number, width: number, height: number, depth: number, start: number, end: number, rise = false) => {
    parts.push({ x, y, z, width, height, depth, start, end, rise });
  };

  // The first pad is already present on arrival; the rest settle into the grid.
  for (let zi = 0; zi < zs.length; zi++) {
    for (let xi = 0; xi < xs.length; xi++) {
      const first = zi === 0 && xi === 0;
      const offset = 0.008 + (zi * xs.length + xi) * 0.003;
      add(xs[xi], 0.24, zs[zi], 1.75, 0.48, 1.75, first ? -0.05 : offset, first ? -0.01 : offset + 0.035);
    }
  }
  for (const z of zs) add(0, 0.52, z, 12.6, 0.4, 0.42, 0.065, 0.115);
  for (const x of xs) add(x, 0.52, 0, 0.42, 0.4, 8.6, 0.075, 0.125);
  add(0, 0.72, 0, 12.5, 0.14, 8.5, 0.115, 0.16);

  for (let floor = 0; floor < 4; floor++) {
    const start = 0.13 + floor * 0.187;
    const bottom = 0.72 + floor * floorHeight;
    const top = bottom + floorHeight;
    for (let zi = 0; zi < zs.length; zi++) {
      for (let xi = 0; xi < xs.length; xi++) {
        const stagger = (zi * xs.length + xi) * 0.001;
        add(xs[xi], bottom + floorHeight / 2, zs[zi], 0.46, floorHeight, 0.46, start + stagger, start + 0.06 + stagger, true);
      }
    }
    for (const z of zs) add(0, top - 0.22, z, 12.5, 0.5, 0.4, start + 0.075, start + 0.11);
    for (const x of xs) add(x, top - 0.22, 0, 0.4, 0.5, 8.5, start + 0.08, start + 0.115);
    // Leave one opening for the staircase rather than passing stairs through a slab.
    for (let xi = 0; xi < 3; xi++) {
      for (let zi = 0; zi < 2; zi++) {
        if (xi === 2 && zi === 1 && floor < 3) continue;
        const stagger = (xi * 2 + zi) * 0.003;
        add(xs[xi] + 2, top + 0.015, zs[zi] + 2, 4, 0.23, 4, start + 0.12 + stagger, start + 0.157 + stagger);
      }
    }
    if (floor < 3) {
      // Two returning flights fit comfortable risers and treads inside the core.
      for (let step = 0; step < 9; step++) {
        const rise = (floorHeight / 18) * (step + 1);
        add(3.05, bottom + rise - 0.1, 3.5 - step * 0.25, 1.2, 0.2, 0.27, start + 0.12 + step * 0.0015, start + 0.15 + step * 0.0015);
        add(4.9, bottom + floorHeight / 2 + rise - 0.1, 1.5 + step * 0.25, 1.2, 0.2, 0.27, start + 0.133 + step * 0.0015, start + 0.157 + step * 0.0015);
      }
      add(4, bottom + floorHeight / 2 - 0.1, 1.13, 3.3, 0.2, 0.8, start + 0.13, start + 0.16);
      add(4, top - 0.1, 3.85, 4, 0.2, 0.5, start + 0.15, start + 0.175);
    }
    // The stair core provides a continuous structural wall beside the wet riser.
    add(6.14, bottom + floorHeight / 2, 1.9, 0.22, floorHeight, 3.8, start + 0.018, start + 0.075, true);
  }

  const material = new THREE.MeshStandardMaterial({
    color: 0xd0cfca, map: texture || null, bumpMap: texture || null,
    bumpScale: 0.024, roughness: 0.88, metalness: 0,
  });
  const dimensions = new Map<string, Part[]>();
  for (const part of parts) {
    const key = `${part.width}/${part.height}/${part.depth}`;
    if (!dimensions.has(key)) dimensions.set(key, []);
    dimensions.get(key)!.push(part);
  }
  const concreteBatches = [...dimensions.entries()].map(([key, batchParts]) => {
    const { width, height, depth } = batchParts[0];
    const geometry = new RoundedBoxGeometry(width, height, depth, 2, 0.018);
    const mesh = new THREE.InstancedMesh(geometry, material, batchParts.length);
    mesh.name = `concrete-frame-${key}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(mesh);
    return { mesh, parts: batchParts, geometry };
  });

  const baseGeometry = new THREE.BoxGeometry(17.2, 0.38, 12.5);
  const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x64635b, map: texture || null, bumpMap: texture || null, bumpScale: 0.035, roughness: 1 });
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.name = 'foundation-site';
  base.position.y = -0.22;
  base.receiveShadow = true;
  group.add(base);

  const gravelGeometry = new THREE.IcosahedronGeometry(1, 0);
  const gravelMaterial = new THREE.MeshStandardMaterial({ color: 0x68695f, roughness: 1 });
  const gravel = new THREE.InstancedMesh(gravelGeometry, gravelMaterial, 240);
  gravel.name = 'site-gravel';
  gravel.receiveShadow = true;
  const stone = new THREE.Object3D();
  const noise = (index: number) => { const n = Math.sin(index * 127.1 + 18.7) * 43758.5453; return n - Math.floor(n); };
  for (let index = 0; index < 240; index++) {
    let x = (noise(index * 3) - 0.5) * 24;
    const z = (noise(index * 3 + 1) - 0.5) * 18;
    if (Math.abs(x) < 8.9 && Math.abs(z) < 6.5) x += x < 0 ? -9 : 9;
    const size = 0.035 + noise(index * 3 + 2) * 0.08;
    stone.position.set(x, -0.43 + size * 0.34, z);
    stone.rotation.set(index, index * 0.6, index * 0.35);
    stone.scale.set(size * 1.3, size * 0.6, size);
    stone.updateMatrix();
    gravel.setMatrixAt(index, stone.matrix);
    gravel.setColorAt(index, new THREE.Color().setScalar(0.68 + noise(index + 17) * 0.3));
  }
  gravel.instanceMatrix.needsUpdate = true;
  group.add(gravel);

  const transform = new THREE.Object3D();
  let lastProgress = -1;
  function setProgress(value: number) {
    const progress = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    if (progress === lastProgress) return;
    lastProgress = progress;
    for (const batch of concreteBatches) batch.parts.forEach((part, index) => {
      const linear = Math.max(0, Math.min(1, (progress - part.start) / (part.end - part.start)));
      const amount = linear * linear * (3 - 2 * linear);
      if (amount === 0) {
        transform.position.set(0, 0, 0);
        transform.scale.set(0, 0, 0);
      } else {
        const height = part.height * (part.rise ? amount : 1);
        const y = part.rise ? part.y - part.height / 2 + height / 2 : part.y + (1 - amount) * 1.25;
        transform.position.set(part.x, y, part.z);
        transform.scale.set(part.rise ? 1 : amount, height / part.height, part.rise ? 1 : amount);
      }
      transform.updateMatrix();
      batch.mesh.setMatrixAt(index, transform.matrix);
    });
    for (const batch of concreteBatches) batch.mesh.instanceMatrix.needsUpdate = true;
  }
  setProgress(0);

  return {
    group,
    setProgress,
    dispose() {
      for (const batch of concreteBatches) { batch.mesh.dispose(); batch.geometry.dispose(); }
      gravel.dispose();
      gravelGeometry.dispose();
      gravelMaterial.dispose();
      baseGeometry.dispose();
      material.dispose();
      baseMaterial.dispose();
      group.clear();
    },
  };
}
