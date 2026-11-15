import test from 'node:test';
import assert from 'node:assert/strict';
import { getMaterialCategoryPrefix, generateNextMaterialCode } from '../lib/materialCodeGenerator.ts';

test('Material Code Generator: derives prefixes correctly by category', () => {
  assert.equal(getMaterialCategoryPrefix(''), 'MAT');
  assert.equal(getMaterialCategoryPrefix('عام'), 'MAT');

  // Steel / Iron
  assert.equal(getMaterialCategoryPrefix('حديد تسليح 16 مم'), 'STL');
  assert.equal(getMaterialCategoryPrefix('صاج مجلفن'), 'STL');

  // Cement / Masonry
  assert.equal(getMaterialCategoryPrefix('اسمنت بورتلاندي'), 'CMT');
  assert.equal(getMaterialCategoryPrefix('طوب اسمنتي مصمت'), 'CMT');

  // Plumbing
  assert.equal(getMaterialCategoryPrefix('مواسير تغذية PPR'), 'PLM');
  assert.equal(getMaterialCategoryPrefix('سباكة وصرف'), 'PLM');

  // Electrical
  assert.equal(getMaterialCategoryPrefix('اسلاك سويدي 4 مم'), 'ELE');
  assert.equal(getMaterialCategoryPrefix('قواطع كهرباء شنايدر'), 'ELE');

  // Paints & Putty
  assert.equal(getMaterialCategoryPrefix('فتونايت داخلي'), 'PNT');
  assert.equal(getMaterialCategoryPrefix('معجون دهانات جوتن'), 'PNT');

  // Ceramics
  assert.equal(getMaterialCategoryPrefix('بورسلان هندي ليزر'), 'CER');
  assert.equal(getMaterialCategoryPrefix('رخام جلالة فص'), 'CER');

  // Wood
  assert.equal(getMaterialCategoryPrefix('خشب سويد 2 بوصة'), 'WOD');

  // HVAC
  assert.equal(getMaterialCategoryPrefix('نحاس تكييف مولر أمريكي'), 'HVAC');
});

test('Material Code Generator: generates sequential next code correctly', () => {
  // First item with no existing codes
  assert.equal(generateNextMaterialCode([], 'MAT'), 'MAT-001');

  // Existing MAT-001 -> MAT-002
  assert.equal(generateNextMaterialCode(['MAT-001'], 'MAT'), 'MAT-002');

  // With gaps MAT-001, MAT-005 -> MAT-006
  assert.equal(generateNextMaterialCode(['MAT-001', 'MAT-002', 'MAT-005'], 'MAT'), 'MAT-006');

  // Category prefix PNT
  assert.equal(generateNextMaterialCode(['PNT-001', 'PNT-002'], 'PNT'), 'PNT-003');

  // Ignores empty or null values safely
  assert.equal(generateNextMaterialCode(['', null, undefined, 'MAT-010'], 'MAT'), 'MAT-011');
});
