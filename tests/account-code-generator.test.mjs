import test from 'node:test';
import assert from 'node:assert/strict';
import { getAccountTypeByCode, generateNextAccountCode } from '../lib/accountCodeGenerator.ts';

test('Account Code Generator: derives account type correctly from code prefix', () => {
  assert.equal(getAccountTypeByCode('1'), 'أصول');
  assert.equal(getAccountTypeByCode('11'), 'أصول');
  assert.equal(getAccountTypeByCode('1291'), 'أصول');

  assert.equal(getAccountTypeByCode('2'), 'التزامات');
  assert.equal(getAccountTypeByCode('211'), 'التزامات');

  assert.equal(getAccountTypeByCode('3'), 'حقوق ملكية');
  assert.equal(getAccountTypeByCode('31'), 'حقوق ملكية');

  assert.equal(getAccountTypeByCode('4'), 'إيرادات');
  assert.equal(getAccountTypeByCode('41'), 'إيرادات');

  assert.equal(getAccountTypeByCode('5'), 'مصروفات');
  assert.equal(getAccountTypeByCode('512'), 'مصروفات');
  assert.equal(getAccountTypeByCode('520'), 'مصروفات');
});

test('Account Code Generator: generates sequential sub-account codes under parent', () => {
  // Parent 129 (Banks) with 1291, 1292 -> next 1293
  const bankCodes = ['1', '11', '12', '122', '129', '1291', '1292'];
  assert.equal(generateNextAccountCode({ parentCode: '129', existingCodes: bankCodes }), '1293');

  // Parent 11 (Fixed Assets) with 111, 112, 113, 114 -> next 115
  const assetCodes = ['1', '11', '111', '112', '113', '114'];
  assert.equal(generateNextAccountCode({ parentCode: '11', existingCodes: assetCodes }), '115');

  // Parent 12 (Current Assets) with 122..129 -> next 1210
  const currentAssetCodes = ['1', '12', '122', '123', '124', '125', '126', '127', '128', '129'];
  assert.equal(generateNextAccountCode({ parentCode: '12', existingCodes: currentAssetCodes }), '1210');

  // Parent 217 with NO existing children -> next 2171
  assert.equal(generateNextAccountCode({ parentCode: '217', existingCodes: ['2', '21', '217'] }), '2171');

  // Parent with padded children (e.g. 5101, 5102) -> next 5103
  const paddedCodes = ['51', '5101', '5102'];
  assert.equal(generateNextAccountCode({ parentCode: '51', existingCodes: paddedCodes }), '5103');
});

test('Account Code Generator: handles root accounts without parent', () => {
  assert.equal(generateNextAccountCode({ parentCode: null, accountType: 'أصول', existingCodes: ['1', '2', '3', '4', '5'] }), '1');
  assert.equal(generateNextAccountCode({ parentCode: null, accountType: 'التزامات', existingCodes: [] }), '2');
  assert.equal(generateNextAccountCode({ parentCode: null, accountType: 'حقوق ملكية', existingCodes: [] }), '3');
  assert.equal(generateNextAccountCode({ parentCode: null, accountType: 'إيرادات', existingCodes: [] }), '4');
  assert.equal(generateNextAccountCode({ parentCode: null, accountType: 'مصروفات', existingCodes: [] }), '5');
});
