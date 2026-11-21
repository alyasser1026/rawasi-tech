import type * as ThreeNS from 'three';

type Three = typeof ThreeNS;
type Detail = {
  floor: number;
  kind: 'cage' | 'starter' | 'form';
  x: number; y: number; z: number;
  sx: number; sy: number; sz: number;
  axis?: 'x' | 'z';
};

/** Reusable, temporary construction equipment, timed to the concrete frame. */
export function createConstructionDetails(THREE: Three) {
  const group = new THREE.Group();
  group.name = 'construction-details';
  const rebar: Detail[] = [];
  const props: Detail[] = [];
  const timber: Detail[] = [];
  const plates: Detail[] = [];
  const xs = [-6, -2, 2, 6];
  const zs = [-4, 0, 4];
  const bars = [
    [-0.15, -0.15], [0, -0.15], [0.15, -0.15], [0.15, 0],
    [0.15, 0.15], [0, 0.15], [-0.15, 0.15], [-0.15, 0],
  ];
  const add = (
    parts: Detail[], floor: number, kind: Detail['kind'],
    x: number, y: number, z: number, sx: number, sy: number, sz: number,
    axis?: Detail['axis'],
  ) => parts.push({ floor, kind, x, y, z, sx, sy, sz, axis });

  for (let floor = 0; floor < 4; floor++) {
    const bottom = 0.72 + floor * 3.25;
    const top = bottom + 3.25;
    for (const x of xs) for (const z of zs) {
      for (const [dx, dz] of bars) {
        add(rebar, floor, 'cage', x + dx, bottom + 1.625, z + dz, 0.011, 3.25, 0.011);
        // Starter bars stay exposed until the next storey's pour encloses them.
        add(rebar, floor, 'starter', x + dx, top + 0.225, z + dz, 0.011, 0.45, 0.011);
      }
      for (let tie = 0; tie < 15; tie++) {
        const y = bottom + 0.12 + tie * 0.215;
        for (const side of [-1, 1]) {
          add(rebar, floor, 'cage', x, y, z + side * 0.17, 0.0045, 0.34, 0.0045, 'x');
          add(rebar, floor, 'cage', x + side * 0.17, y, z, 0.0045, 0.34, 0.0045, 'z');
        }
      }
    }

    for (let xi = 0; xi < 3; xi++) for (let zi = 0; zi < 2; zi++) {
      if (xi === 2 && zi === 1 && floor < 3) continue;
      const x = xs[xi] + 2;
      const z = zs[zi] + 2;
      // Plywood has visible panel seams, with crossing joists underneath.
      for (const offset of [-1, 1]) {
        add(timber, floor, 'form', x + offset, top - 0.126, z, 1.97, 0.04, 3.94);
        add(timber, floor, 'form', x, top - 0.35, z + offset * 1.05, 3.8, 0.16, 0.12);
      }
      for (const offset of [-1.5, -0.5, 0.5, 1.5]) {
        add(timber, floor, 'form', x + offset, top - 0.225, z, 0.08, 0.15, 3.85);
      }
      for (const dx of [-1.15, 1.15]) for (const dz of [-1.05, 1.05]) {
        const height = 2.82;
        add(props, floor, 'form', x + dx, bottom + height / 2, z + dz, 0.028, height, 0.028);
        // A wider lower sleeve, collar, and small bearing plates identify real props.
        add(props, floor, 'form', x + dx, bottom + 0.64, z + dz, 0.037, 1.28, 0.037);
        add(props, floor, 'form', x + dx, bottom + 1.3, z + dz, 0.055, 0.065, 0.055);
        add(plates, floor, 'form', x + dx, bottom + 0.025, z + dz, 0.19, 0.05, 0.19);
        add(plates, floor, 'form', x + dx, top - 0.445, z + dz, 0.2, 0.04, 0.16);
      }
    }
  }

  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 6, 1);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const steel = new THREE.MeshStandardMaterial({ color: 0x3f4342, metalness: 0.65, roughness: 0.7 });
  const propSteel = new THREE.MeshStandardMaterial({ color: 0x646965, metalness: 0.55, roughness: 0.78 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x81735c, metalness: 0, roughness: 0.96 });
  const make = (geometry: ThreeNS.BufferGeometry, material: ThreeNS.Material, parts: Detail[], name: string) => {
    const mesh = new THREE.InstancedMesh(geometry, material, parts.length);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(mesh);
    return { mesh, parts };
  };
  const batches = [
    make(cylinder, steel, rebar, 'column-reinforcement'),
    make(cylinder, propSteel, props, 'telescopic-slab-props'),
    make(box, propSteel, plates, 'prop-bearing-plates'),
    make(box, wood, timber, 'plywood-and-timber-formwork'),
  ];
  const transform = new THREE.Object3D();
  const smooth = (a: number, b: number, p: number) => {
    const t = Math.max(0, Math.min(1, (p - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  let lastProgress = -1;
  function setProgress(value: number) {
    const progress = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    if (progress === lastProgress) return;
    lastProgress = progress;
    for (const { mesh, parts } of batches) {
      let visibleCount = 0;
      for (let index = 0; index < parts.length; index++) {
        const part = parts[index];
        const stage = 0.13 + part.floor * 0.187;
        let amount: number;
        if (part.kind === 'form') {
          amount = smooth(stage + 0.078, stage + 0.093, progress)
            * (1 - smooth(stage + 0.172, stage + 0.185, progress));
        } else {
          amount = smooth(stage - 0.027, stage - 0.008, progress);
          if (part.kind === 'cage') amount *= 1 - smooth(stage + 0.071, stage + 0.076, progress);
          else if (part.floor < 3) amount *= 1 - smooth(stage + 0.251, stage + 0.258, progress);
        }
        if (amount <= 0.00001) continue;
        transform.position.set(part.x, part.y, part.z);
        transform.rotation.set(0, 0, 0);
        if (part.axis === 'x') transform.rotation.z = Math.PI / 2;
        if (part.axis === 'z') transform.rotation.x = Math.PI / 2;
        // Uniformly retract equipment only during the brief assembly/removal interval.
        transform.scale.set(part.sx * amount, part.sy * amount, part.sz * amount);
        transform.updateMatrix();
        mesh.setMatrixAt(visibleCount++, transform.matrix);
      }
      mesh.count = visibleCount;
      mesh.visible = visibleCount > 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  setProgress(0);
  return {
    group,
    setProgress,
    dispose() {
      for (const { mesh } of batches) mesh.dispose();
      cylinder.dispose();
      box.dispose();
      steel.dispose();
      propSteel.dispose();
      wood.dispose();
      group.clear();
    },
  };
}
