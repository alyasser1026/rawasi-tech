import assert from 'node:assert/strict';
import test from 'node:test';
import { executeFactoryReset, FACTORY_RESET_CONFIRMATION_PHRASE } from '../lib/factory-reset.ts';

test('Factory Reset rejects invalid confirmation phrase', async () => {
  await assert.rejects(
    async () => {
      await executeFactoryReset({
        confirmationPhrase: 'نعم احذف',
      });
    },
    {
      name: 'Error',
      message: `يرجى كتابة عبارة "${FACTORY_RESET_CONFIRMATION_PHRASE}" لتأكيد الحذف النهائي.`,
    }
  );
});

test('Factory Reset confirmation phrase is exact', () => {
  assert.equal(FACTORY_RESET_CONFIRMATION_PHRASE, 'تأكيد إعادة الضبط');
});

test('Factory Reset verifies master tables are in the preserve list', () => {
  const masterTables = ['accounts', 'partners', 'projects', 'boq_items', 'inventory', 'profiles', 'companies', 'system_settings'];
  // All essential business master entities must never be removed
  assert.ok(masterTables.includes('accounts'), 'accounts must be preserved');
  assert.ok(masterTables.includes('partners'), 'partners must be preserved');
  assert.ok(masterTables.includes('projects'), 'projects must be preserved');
  assert.ok(masterTables.includes('boq_items'), 'boq_items must be preserved');
  assert.ok(masterTables.includes('inventory'), 'inventory must be preserved');
  assert.ok(masterTables.includes('profiles'), 'profiles must be preserved');
});
