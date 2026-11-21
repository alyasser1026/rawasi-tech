import type * as ThreeNS from 'three';

type Three = typeof ThreeNS;
type Point = [number, number, number];
type Finish = 'waste' | 'water' | 'return' | 'steel' | 'cable' | 'dark';
type Shape = 'round' | 'box';
type Timing = { start: number; end: number };
type Part = Timing & {
  position: ThreeNS.Vector3;
  rotation: ThreeNS.Quaternion;
  scale: ThreeNS.Vector3;
  from?: ThreeNS.Vector3;
  direction?: ThreeNS.Vector3;
};

/** Exposed first-fix services, in metres, coordinated below the concrete beams. */
export function createBuildingServices(THREE: Three) {
  const group = new THREE.Group();
  group.name = 'building-services';
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10, 1);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const materials: Record<Finish, ThreeNS.MeshStandardMaterial> = {
    waste: new THREE.MeshStandardMaterial({ color: 0x888c88, roughness: 0.68, metalness: 0.02 }),
    water: new THREE.MeshStandardMaterial({ color: 0x526e60, roughness: 0.65, metalness: 0 }),
    return: new THREE.MeshStandardMaterial({ color: 0x69745b, roughness: 0.69, metalness: 0 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xa1a5a3, roughness: 0.43, metalness: 0.72 }),
    cable: new THREE.MeshStandardMaterial({ color: 0x8c5435, roughness: 0.82, metalness: 0 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x343b3a, roughness: 0.84, metalness: 0.04 }),
  };
  const batches = new Map<string, { shape: Shape; finish: Finish; parts: Part[] }>();
  const up = new THREE.Vector3(0, 1, 0);
  const point = (value: Point) => new THREE.Vector3(...value);

  function add(shape: Shape, finish: Finish, part: Part) {
    const key = `${shape}-${finish}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = { shape, finish, parts: [] };
      batches.set(key, batch);
    }
    batch.parts.push(part);
  }

  function segment(finish: Finish, from: Point, to: Point, radius: number, timing: Timing) {
    const a = point(from);
    const direction = point(to).sub(a);
    const length = direction.length();
    if (length < 0.0001) return;
    direction.divideScalar(length);
    add('round', finish, {
      ...timing,
      position: a.clone().addScaledVector(direction, length / 2),
      rotation: new THREE.Quaternion().setFromUnitVectors(up, direction),
      scale: new THREE.Vector3(radius, length, radius),
      from: a,
      direction,
    });
  }

  function block(finish: Finish, center: Point, dimensions: Point, timing: Timing) {
    add('box', finish, {
      ...timing,
      position: point(center),
      rotation: new THREE.Quaternion(),
      scale: point(dimensions),
    });
  }

  function collar(finish: Finish, center: Point, direction: Point, radius: number, length: number, timing: Timing) {
    const axis = point(direction).normalize().multiplyScalar(length / 2);
    segment(finish, point(center).sub(axis).toArray() as Point, point(center).add(axis).toArray() as Point, radius, timing);
  }

  // Short cylinders follow rounded bends; all elbows share the straight-pipe batch.
  function pipe(finish: Finish, points: Point[], radius: number, timing: Timing, bendRadius = 0.16) {
    const route: Point[] = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
      const corner = point(points[i]);
      const previous = point(points[i - 1]).sub(corner);
      const next = point(points[i + 1]).sub(corner);
      const bend = Math.min(bendRadius, previous.length() * 0.35, next.length() * 0.35);
      const a = corner.clone().add(previous.normalize().multiplyScalar(bend));
      const b = corner.clone().add(next.normalize().multiplyScalar(bend));
      route.push(a.toArray() as Point);
      for (let sample = 1; sample <= 5; sample++) {
        const t = sample / 5;
        route.push(a.clone().multiplyScalar((1 - t) ** 2)
          .addScaledVector(corner, 2 * (1 - t) * t).addScaledVector(b, t * t).toArray() as Point);
      }
    }
    route.push(points[points.length - 1]);
    const duration = timing.end - timing.start;
    for (let i = 0; i < route.length - 1; i++) {
      const delay = (i / Math.max(1, route.length - 2)) * duration * 0.32;
      segment(finish, route[i], route[i + 1], radius, { start: timing.start + delay, end: timing.end - duration * 0.32 + delay });
    }
  }

  for (let floor = 0; floor < 4; floor++) {
    const start = 0.13 + floor * 0.187;
    const bottom = 0.72 + floor * 3.25;
    const top = bottom + 3.25;
    const riserTime = { start: start + 0.105, end: start + 0.137 };
    const branchTime = { start: start + 0.126, end: start + 0.172 };
    const fittingTime = { start: start + 0.147, end: start + 0.18 };
    // The wet risers occupy the service edge of the open stairwell.
    // Each storey ends at exactly the next one's starting elevation.
    const riserBottom = bottom - 0.16;
    const riserTop = floor === 3 ? top - 0.61 : top - 0.16;
    const wasteX = 5.91;
    segment('waste', [wasteX, riserBottom, 3.15], [wasteX, floor === 3 ? top + 0.55 : riserTop, 3.15], 0.075, riserTime);
    if (floor === 3) {
      collar('steel', [wasteX, top + 0.015, 3.15], [0, 1, 0], 0.091, 0.27, fittingTime);
      collar('dark', [wasteX, top + 0.551, 3.15], [0, 1, 0], 0.059, 0.002, fittingTime);
    }
    for (const y of [bottom + 0.12, top - 0.82]) {
      collar('waste', [wasteX, y, 3.15], [0, 1, 0], 0.088, 0.15, fittingTime);
      collar('steel', [wasteX, y + 0.14, 3.15], [0, 1, 0], 0.082, 0.026, fittingTime);
      block('steel', [wasteX + 0.17, y + 0.14, 3.15], [0.22, 0.032, 0.035], fittingTime);
    }

    const wasteY = top - 0.76;
    pipe('waste', [[wasteX, wasteY, 3.15], [wasteX, wasteY + 0.025, 1.15], [-4.55, wasteY + 0.12, 1.15]], 0.055, branchTime, 0.22);
    collar('waste', [wasteX, wasteY, 3.15], [0, 1, 0], 0.091, 0.24, fittingTime);
    for (const x of [-4.1, -0.7, 1.25]) {
      const y = wasteY + (wasteX - x) / 10.46 * 0.12;
      pipe('waste', [[x, y, 1.15], [x, y + 0.035, 2.62], [x, top + 0.22, 2.62]], 0.038, branchTime, 0.13);
      collar('waste', [x, y, 1.15], [1, -0.012, 0], 0.068, 0.16, fittingTime);
      collar('waste', [x, top + 0.17, 2.62], [0, 1, 0], 0.045, 0.1, fittingTime);
      collar('steel', [x, top + 0.015, 2.62], [0, 1, 0], 0.052, 0.27, fittingTime);
    }
    for (const x of [-3.3, 0.65, 4.55]) {
      const y = wasteY + (wasteX - x) / 10.46 * 0.12;
      collar('steel', [x, y, 1.15], [1, 0, 0], 0.063, 0.026, fittingTime);
      segment('steel', [x, y + 0.045, 1.15], [x, top - 0.14, 1.15], 0.008, fittingTime);
    }

    for (let supply = 0; supply < 2; supply++) {
      const finish: Finish = supply ? 'return' : 'water';
      const x = 5.64 + supply * 0.1;
      const z = 2.8 - supply * 0.13;
      const y = top - 1.01 - supply * 0.095;
      const branchZ = -0.65 - supply * 0.1;
      segment(finish, [x, riserBottom, z], [x, riserTop, z], 0.026, riserTime);
      pipe(finish, [[x, y, z], [x, y, branchZ], [-4.25, y, branchZ]], 0.022, branchTime, 0.12);
      collar(finish, [x, bottom + 0.18, z], [0, 1, 0], 0.035, 0.11, fittingTime);
      collar(finish, [x, y, z], [0, 1, 0], 0.037, 0.13, fittingTime);
      for (const outletX of [-3.85, -0.45, 1.5]) {
        pipe(finish, [[outletX, y, branchZ], [outletX, y, 2.62 + supply * 0.15], [outletX, top + 0.2, 2.62 + supply * 0.15]], 0.016, branchTime, 0.08);
        collar(finish, [outletX, top + 0.166, 2.62 + supply * 0.15], [0, 1, 0], 0.022, 0.065, fittingTime);
        collar('steel', [outletX, top + 0.015, 2.62 + supply * 0.15], [0, 1, 0], 0.026, 0.27, fittingTime);
      }
      // A compact brass valve body and a restrained dark operating handle.
      collar('steel', [x, bottom + 0.72, z], [0, 1, 0], 0.037, 0.13, fittingTime);
      block('dark', [x, bottom + 0.72, z + 0.047], [0.09, 0.019, 0.026], fittingTime);
    }

    // An opposite dry riser feeds a galvanized ladder tray under each slab.
    const trayY = top - 0.76;
    const trayZ = 3.22;
    for (const z of [3.58, 3.77]) {
      segment('steel', [-5.38, riserBottom, z], [-5.38, riserTop, z], 0.03, riserTime);
      collar('steel', [-5.38, bottom + 0.2, z], [0, 1, 0], 0.038, 0.13, fittingTime);
      pipe('steel', [[-5.38, trayY, z], [-5.38, trayY, trayZ], [-4.86, trayY, trayZ]], 0.024, branchTime, 0.12);
    }
    block('steel', [-5.06, trayY, trayZ], [0.3, 0.21, 0.3], fittingTime);
    block('dark', [-5.06, trayY - 0.109, trayZ], [0.25, 0.013, 0.25], fittingTime);
    for (const z of [trayZ - 0.16, trayZ + 0.16]) {
      block('steel', [-1.705, trayY, z], [6.55, 0.072, 0.018], branchTime);
    }
    for (let rung = 0; rung < 20; rung++) {
      block('steel', [-4.93 + rung * 0.33, trayY - 0.025, trayZ], [0.025, 0.018, 0.32], branchTime);
    }
    for (let wire = 0; wire < 4; wire++) {
      const z = trayZ - 0.105 + wire * 0.07;
      pipe(wire === 1 || wire === 3 ? 'dark' : 'cable', [
        [-5.38, riserBottom, 3.58 + wire * 0.025],
        [-5.38, trayY + 0.015, 3.58 + wire * 0.025],
        [-5.02, trayY + 0.015, z],
        [1.55, trayY + 0.015, z],
      ], 0.013, branchTime, 0.15);
    }
    for (const x of [-4.4, -1.3, 1.25]) {
      for (const z of [trayZ - 0.23, trayZ + 0.23]) {
        segment('steel', [x, trayY - 0.1, z], [x, top - 0.13, z], 0.008, fittingTime);
        block('steel', [x, top - 0.13, z], [0.075, 0.02, 0.075], fittingTime);
      }
      block('steel', [x, trayY - 0.085, trayZ], [0.03, 0.025, 0.53], fittingTime);
    }
    for (const x of [-3.6, 0.25, 1.05]) {
      pipe('steel', [[x, trayY - 0.045, trayZ], [x, top - 0.94, trayZ], [x, top - 0.94, -0.72]], 0.017, branchTime, 0.1);
      block('steel', [x, top - 0.94, -0.65], [0.15, 0.1, 0.17], fittingTime);
      block('dark', [x, top - 0.995, -0.65], [0.117, 0.008, 0.137], fittingTime);
    }
    // Floor-mounted strut channels carry the cabinet beside the dry riser.
    const mountingBase = bottom + (floor === 0 ? 0.07 : 0.13);
    const mountingTop = bottom + 2.1;
    for (const z of [3.44, 3.72]) {
      block('steel', [-5.625, (mountingBase + mountingTop) / 2, z], [0.04, mountingTop - mountingBase, 0.035], fittingTime);
      block('steel', [-5.625, mountingBase + 0.018, z], [0.14, 0.035, 0.12], fittingTime);
    }
    block('steel', [-5.55, bottom + 1.31, 3.58], [0.11, 0.55, 0.38], fittingTime);
    block('dark', [-5.487, bottom + 1.31, 3.58], [0.012, 0.43, 0.28], fittingTime);
  }

  const instances = [...batches.values()].map((batch) => {
    const mesh = new THREE.InstancedMesh(batch.shape === 'round' ? cylinder : box, materials[batch.finish], batch.parts.length);
    mesh.name = `services-${batch.shape}-${batch.finish}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(mesh);
    return { mesh, parts: batch.parts };
  });
  const transform = new THREE.Object3D();
  let lastProgress = -1;
  function setProgress(value: number) {
    const progress = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    if (progress === lastProgress) return;
    lastProgress = progress;
    for (const { mesh, parts } of instances) {
      let visibleCount = 0;
      for (let index = 0; index < parts.length; index++) {
        const part = parts[index];
        const linear = Math.max(0, Math.min(1, (progress - part.start) / (part.end - part.start)));
        const amount = linear * linear * (3 - 2 * linear);
        if (amount <= 0.00001) continue;
        transform.quaternion.copy(part.rotation);
        transform.position.copy(part.position);
        if (part.from && part.direction) {
          transform.position.copy(part.from).addScaledVector(part.direction, part.scale.y * amount / 2);
          transform.scale.set(part.scale.x, part.scale.y * amount, part.scale.z);
        } else transform.scale.copy(part.scale).multiplyScalar(amount);
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
      for (const { mesh } of instances) mesh.dispose();
      cylinder.dispose();
      box.dispose();
      for (const material of Object.values(materials)) material.dispose();
      group.clear();
    },
  };
}
