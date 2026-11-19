import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';

const source = fs.readFileSync(new URL('../app/site/concrete-structure-three.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
const { createConcreteStructure } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const matrices = (model) => Array.from(model.group.getObjectByName('concrete-frame').instanceMatrix.array);

test('scroll scrubbing restores the exact structure after reversing or jumping', () => {
  const model = createConcreteStructure(THREE);
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

test('a structure releases its own GPU resources and preserves the shared surface texture', () => {
  const texture = new THREE.Texture();
  let externalTextureDisposals = 0;
  texture.addEventListener('dispose', () => externalTextureDisposals++);
  const model = createConcreteStructure(THREE, texture);
  const concrete = model.group.getObjectByName('concrete-frame');
  let geometryDisposals = 0;
  let materialDisposals = 0;
  concrete.geometry.addEventListener('dispose', () => geometryDisposals++);
  concrete.material.addEventListener('dispose', () => materialDisposals++);
  model.dispose();
  assert.equal(geometryDisposals, 1);
  assert.equal(materialDisposals, 1);
  assert.equal(externalTextureDisposals, 0);
  assert.equal(model.group.children.length, 0);
  texture.dispose();
});
