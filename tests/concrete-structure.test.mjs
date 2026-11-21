import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';

async function loadBuilder(file, exportedName) {
  const source = fs.readFileSync(new URL(`../app/site/${file}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  const resolved = outputText.replace(/from (['"])([^'"]+)\1/g, (_match, _quote, specifier) => `from ${JSON.stringify(import.meta.resolve(specifier))}`);
  return (await import(`data:text/javascript;base64,${Buffer.from(resolved).toString('base64')}`))[exportedName];
}

test('completed service routes clear both stair flights and landings', () => {
  const structure = builders[0][1](THREE);
  const services = builders[1][1](THREE);
  structure.setProgress(1);
  services.setProgress(1);
  const instanceBox = (mesh, index) => {
    mesh.geometry.computeBoundingBox();
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(index, matrix);
    return mesh.geometry.boundingBox.clone().applyMatrix4(matrix).expandByScalar(-0.004);
  };
  const stairs = [];
  for (const mesh of structure.group.children) {
    if (/concrete-frame-(1\.2\/0\.2\/0\.27|3\.3\/0\.2\/0\.8|4\/0\.2\/0\.5)$/.test(mesh.name)) {
      for (let index = 0; index < mesh.count; index++) stairs.push(instanceBox(mesh, index));
    }
  }
  assert.ok(stairs.length > 0, 'Stair flights and landings must be represented');
  for (const mesh of services.group.children) {
    for (let index = 0; index < mesh.count; index++) {
      const box = instanceBox(mesh, index);
      assert.ok(stairs.every((stair) => !stair.intersectsBox(box)), `${mesh.name} instance ${index} intersects the stair`);
    }
  }
  structure.dispose();
  services.dispose();
});

test('completed construction omits temporary equipment and concealed reinforcement from drawing', () => {
  const model = builders[2][1](THREE);
  model.setProgress(0.9);
  for (const name of ['telescopic-slab-props', 'prop-bearing-plates', 'plywood-and-timber-formwork']) {
    const mesh = model.group.getObjectByName(name);
    assert.equal(mesh.count, 0);
    assert.equal(mesh.visible, false);
  }
  const reinforcement = model.group.getObjectByName('column-reinforcement');
  assert.ok(reinforcement.count > 0, 'Roof starter bars stay visible');
  assert.ok(reinforcement.count < reinforcement.instanceMatrix.count / 10, 'Concealed cages must not waste GPU work');
  model.dispose();
});
const builders = [
  ['concrete', await loadBuilder('concrete-structure-three', 'createConcreteStructure')],
  ['services', await loadBuilder('building-services-three', 'createBuildingServices')],
  ['site equipment', await loadBuilder('construction-details-three', 'createConstructionDetails')],
];
const matrices = (model) => {
  const values = [];
  model.group.traverse((object) => {
    if (object.isInstancedMesh) values.push(object.count, ...object.instanceMatrix.array.slice(0, object.count * 16));
  });
  return values;
};

for (const [name, createModel] of builders) {
test(`${name}: scroll scrubbing restores exact placement after reversing or jumping`, () => {
  const model = createModel(THREE);
  model.setProgress(0.42);
  const middle = matrices(model);
  model.setProgress(1);
  const complete = matrices(model);
  model.setProgress(0.42);
  assert.deepEqual(matrices(model), middle);
  model.setProgress(0.9);
  assert.deepEqual(matrices(model), complete, 'The final portion of the page must hold a completed frame');
  model.setProgress(-1);
  const initial = matrices(model);
  assert.ok(initial.every(Number.isFinite));
  model.setProgress(Number.NaN);
  assert.deepEqual(matrices(model), initial);
  model.dispose();
});

test(`${name}: releases its GPU resources and preserves external textures`, () => {
  const texture = new THREE.Texture();
  let externalTextureDisposals = 0;
  texture.addEventListener('dispose', () => externalTextureDisposals++);
  const model = createModel(THREE, texture);
  const geometries = new Set();
  const materials = new Set();
  model.group.traverse((object) => {
    if (object.isMesh) {
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    }
  });
  let geometryDisposals = 0;
  let materialDisposals = 0;
  for (const geometry of geometries) geometry.addEventListener('dispose', () => geometryDisposals++);
  for (const material of materials) material.addEventListener('dispose', () => materialDisposals++);
  model.dispose();
  assert.equal(geometryDisposals, geometries.size);
  assert.equal(materialDisposals, materials.size);
  assert.equal(externalTextureDisposals, 0);
  assert.equal(model.group.children.length, 0);
  texture.dispose();
});
}
