import type * as ThreeNS from 'three';

type Three = typeof ThreeNS;
type Part = {
  x: number; y: number; z: number;
  width: number; height: number; depth: number;
  start: number; end: number; rise: boolean;
};

/** A single reusable mesh holds an exposed four-storey concrete frame. */
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
      for (let step = 0; step < 15; step++) {
        const stepHeight = (floorHeight / 15) * (step + 1);
        add(3.45, bottom + stepHeight - 0.1, 3.75 - step * 0.24, 1.35, 0.2, 0.27, start + 0.12 + step * 0.0015, start + 0.15 + step * 0.0015);
      }
      add(4.55, top - 0.1, 0.35, 3.1, 0.2, 0.7, start + 0.15, start + 0.175);
    }
  }

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    color: 0xd0cfca, map: texture || null, roughness: 0.93, metalness: 0,
  });
  const concrete = new THREE.InstancedMesh(geometry, material, parts.length);
  concrete.name = 'concrete-frame';
  concrete.castShadow = true;
  concrete.receiveShadow = true;
  // Instances travel a little while assembling, outside their final bounds.
  concrete.frustumCulled = false;
  concrete.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(concrete);

  const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x434641, roughness: 1 });
  const base = new THREE.Mesh(geometry, baseMaterial);
  base.name = 'foundation-site';
  base.scale.set(17.2, 0.12, 12.5);
  base.position.y = -0.06;
  base.receiveShadow = true;
  group.add(base);

  const transform = new THREE.Object3D();
  let lastProgress = -1;
  function setProgress(value: number) {
    const progress = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    if (progress === lastProgress) return;
    lastProgress = progress;
    parts.forEach((part, index) => {
      const linear = Math.max(0, Math.min(1, (progress - part.start) / (part.end - part.start)));
      const amount = linear * linear * (3 - 2 * linear);
      if (amount === 0) {
        transform.position.set(0, 0, 0);
        transform.scale.set(0, 0, 0);
      } else {
        const height = part.height * (part.rise ? amount : 1);
        const y = part.rise ? part.y - part.height / 2 + height / 2 : part.y + (1 - amount) * 1.25;
        transform.position.set(part.x, y, part.z);
        transform.scale.set(part.width * (part.rise ? 1 : amount), height, part.depth * (part.rise ? 1 : amount));
      }
      transform.updateMatrix();
      concrete.setMatrixAt(index, transform.matrix);
    });
    concrete.instanceMatrix.needsUpdate = true;
  }
  setProgress(0);

  return {
    group,
    setProgress,
    dispose() {
      concrete.dispose();
      geometry.dispose();
      material.dispose();
      baseMaterial.dispose();
      group.clear();
    },
  };
}
