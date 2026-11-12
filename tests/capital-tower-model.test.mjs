import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function loadTsModule(relPath) {
  const source = read(relPath);
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  const mod = { exports: {} };
  const fn = vm.runInThisContext(`(function(exports, require, module){ ${outputText} })`);
  fn(mod.exports, () => ({}), mod);
  return mod.exports;
}

test('Capital Tower units match brochure specifications (140m², 185m², 205m²)', () => {
  const model = loadTsModule('app/site/capital-tower-model.ts');

  assert.equal(model.CAPITAL_APARTMENTS.apt01.areaSqm, 140);
  assert.equal(model.CAPITAL_APARTMENTS.apt01.bedrooms, 3);
  assert.equal(model.CAPITAL_APARTMENTS.apt01.bathrooms, 2);

  assert.equal(model.CAPITAL_APARTMENTS.apt02.areaSqm, 185);
  assert.equal(model.CAPITAL_APARTMENTS.apt02.bedrooms, 3);
  assert.equal(model.CAPITAL_APARTMENTS.apt02.bathrooms, 3);

  assert.equal(model.CAPITAL_APARTMENTS.apt03.areaSqm, 205);
  assert.equal(model.CAPITAL_APARTMENTS.apt03.bedrooms, 3);
  assert.equal(model.CAPITAL_APARTMENTS.apt03.bathrooms, 2);

  assert.equal(model.TOTAL_NET_RESIDENTIAL_AREA, 530);
  assert.equal(model.TOWER_DIMS.residentialFloors, 12);
  assert.equal(model.TOWER_DIMS.totalFloorsIncludingPodium, 13);
});

test('Capital Tower typical floor covers all 3 apartments + core geometry and BIM IFC metadata', () => {
  const model = loadTsModule('app/site/capital-tower-model.ts');
  const owners = new Set(model.TYPICAL_FLOOR_ZONES.map((z) => z.owner));
  assert.deepEqual([...owners].sort(), ['apt01', 'apt02', 'apt03', 'core']);

  const furnitureOwners = new Set(model.TYPICAL_FURNITURE.map((f) => f.owner));
  assert.deepEqual([...furnitureOwners].sort(), ['apt01', 'apt02', 'apt03']);

  const bimLayerIds = model.BIM_LAYERS.map((l) => l.id);
  assert.deepEqual(bimLayerIds, ['structure', 'core', 'masonry', 'mep', 'finish']);

  assert.ok(model.TOWER_SPEC_CARDS.facade.ifc.includes('IfcCurtainWall'));
  assert.ok(model.TOWER_SPEC_CARDS.core.ifc.includes('IfcTransportElement'));
  assert.ok(model.TOWER_SPEC_CARDS.foundation.ifc.includes('IfcFooting'));
  assert.ok(model.TOWER_SPEC_CARDS.duct.ifc.includes('IfcDuctSegment'));
  assert.ok(model.TOWER_SPEC_CARDS.pipe.ifc.includes('IfcPipeSegment'));
});

test('CapitalTower3D and BimModel share capital-tower-three geometry builders and support 3D -> BIM conversion', () => {
  const ct3d = read('app/site/CapitalTower3D.tsx');
  const bim = read('app/site/BimModel.tsx');
  const phiSite = read('app/site/PhiSite.tsx');
  const website = read('app/website/page.tsx');

  assert.match(ct3d, /buildTowerExteriorScene/);
  assert.match(ct3d, /buildEntranceLobbyScene/);
  assert.match(ct3d, /buildTypicalFloorCutawayScene/);
  assert.match(ct3d, /buildCapitalTowerBimAssembly/);
  assert.match(ct3d, /data-testid="toggle-3d-to-bim"/);

  assert.match(bim, /buildCapitalTowerBimAssembly/);
  assert.doesNotMatch(phiSite, /غرفة سوبر هيرو/);
  assert.doesNotMatch(website, /غرفة سوبر هيرو/);
  assert.match(phiSite, /#capital-tower/);
  assert.match(phiSite, /برج كابيتال 3D/);
  assert.match(website, /#capital-tower/);
});
