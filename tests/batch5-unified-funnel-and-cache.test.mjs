import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function loadTsModule(relativePath, imports = {}, env = {}, extraGlobals = {}) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const exports = {};
  const sandbox = {
    console,
    process: { env },
    setTimeout,
    clearTimeout,
    ...extraGlobals,
  };
  const fn = vm.runInNewContext(`(function(exports, require) { ${outputText}\n })`, sandbox);
  fn(exports, (specifier) => {
    assert(Object.hasOwn(imports, specifier), `Unmocked dependency: ${specifier}`);
    return imports[specifier];
  });
  return exports;
}

const catalogStub = {
  DEFAULT_MAINTENANCE_SERVICES: [],
  PRODUCT_CATEGORIES: [
    { id: 'electrical', title: 'الكهرباء والإنارة', shortTitle: 'الكهرباء' },
    { id: 'tools_hardware', title: 'العدد والأدوات', shortTitle: 'العدد' },
  ],
  SMART_BUNDLES: [],
  LEGACY_DUMMY_PRODUCT_IDS: new Set(),
  getProductImageUrl: () => '/products/default.png',
};

test('5.1 unified synonym resolution merges DB additions with core synonyms & honors feature flag', () => {
  const catalogServer = loadTsModule(
    '../lib/store-catalog-server.ts',
    { '@/app/site/store-catalog': catalogStub },
    {}
  );

  const dynMap = new Map([
    ['شنيور', ['شنيور', 'مثقاب', 'دريل']],
    ['سويتش ذكي', ['سويتش ذكي', 'مفتاح واي فاي']],
    ['فيشه', ['فيشه', 'ماخذ', 'بريزه']],
  ]);

  // Core query preserves core set, while unified query includes BOTH core & DB extra additions ('ماخذ')
  const unifiedPlug = catalogServer.resolveUnifiedSynonymsForQuery('فيشة', dynMap);
  assert(unifiedPlug.expandedTokens.includes('سوكيت'));
  assert(unifiedPlug.expandedTokens.includes('ماخذ'));
  assert(unifiedPlug.matchedKeys.includes('فيشه'));

  // Multi-word DB phrase & slang DB row resolve seamlessly
  const unifiedDrill = catalogServer.resolveUnifiedSynonymsForQuery('شنيور', dynMap);
  assert(unifiedDrill.expandedTokens.includes('مثقاب'));
  assert(unifiedDrill.expandedTokens.includes('دريل'));

  const unifiedPhrase = catalogServer.resolveUnifiedSynonymsForQuery('سويتش ذكي للغرفة', dynMap);
  assert(unifiedPhrase.matchedKeys.includes('سويتش ذكي'));
  assert(unifiedPhrase.expandedTokens.includes('مفتاح واي فاي'));

  // Kill-switch restores legacy fallback behavior
  const disabledServer = loadTsModule(
    '../lib/store-catalog-server.ts',
    { '@/app/site/store-catalog': catalogStub },
    { NEXT_PUBLIC_DISABLE_UNIFIED_SYNONYM_FUNNEL: 'true' }
  );
  assert.equal(disabledServer.isUnifiedSynonymFunnelDisabled(), true);
  const disabledRes = disabledServer.resolveUnifiedSynonymsForQuery('فيشة', dynMap);
  assert.equal(disabledRes.expandedTokens.includes('ماخذ'), false);
});

test('5.1 catalog-relevance honors unified synonymTokens without bypassing policy/family guards', () => {
  const relevance = loadTsModule('../lib/copilot/catalog-relevance.ts');
  const drillProduct = {
    id: 'p-drill-1',
    code: 'DRL-500',
    name: 'مثقاب كهربائي دقاق 650 وات',
    category: 'tools_hardware',
    subCategory: 'معدات كهربائية',
    brand: 'Bosch',
    inStock: true,
  };

  // Without DB synonymTokens, raw query 'شنيور' doesn't match literal 'مثقاب'
  assert.equal(relevance.isRelevantCatalogProduct(drillProduct, 'عايز شنيور'), false);
  // With unified synonymTokens passed from server, relevance matches cleanly
  const kept = relevance.filterRelevantCatalogProducts([drillProduct], 'عايز شنيور', {
    synonymTokens: ['شنيور', 'مثقاب', 'دريل'],
  });
  assert.equal(kept.length, 1);

  // Policy guard still blocks product cards even if synonymTokens provided
  const blockedPolicy = relevance.filterRelevantCatalogProducts([drillProduct], 'بتشحنوا للمحافظات؟', {
    synonymTokens: ['شنيور', 'مثقاب'],
  });
  assert.equal(blockedPolicy.length, 0);
});

test('5.1 copilot conversion funnel tracks synonym -> cart -> order/handoff without PII', async () => {
  const relevance = loadTsModule('../lib/copilot/catalog-relevance.ts');
  const handoff = loadTsModule('../lib/copilot/handoff.ts');
  const dynMap = new Map([['شنيور', ['شنيور', 'مثقاب', 'دريل']]]);

  const catalogServerMock = {
    normalizeArabicSearch: (v) => String(v || '').toLowerCase().trim(),
    isUnifiedSynonymFunnelDisabled: () => false,
    ensureStoreSynonymsLoaded: async () => dynMap,
    resolveUnifiedSynonymsForQuery: (q) => ({
      expandedTokens: q.includes('شنيور') ? ['شنيور', 'مثقاب', 'دريل'] : [],
      matchedSynonymTerms: q.includes('شنيور') ? ['مثقاب', 'دريل'] : [],
      matchedKeys: q.includes('شنيور') ? ['شنيور'] : [],
    }),
    queryStoreCatalog: async () => {
      throw new Error('Unexpected storage fallback');
    },
  };

  const mockProductRow = {
    id: 'p-drill-1',
    code: 'DRL-500',
    name: 'مثقاب كهربائي 650 وات',
    category: 'tools_hardware',
    sub_category: 'معدات',
    brand: 'Ingco',
    unit: 'قطعة',
    price: 1850,
    old_price: null,
    install_price: 0,
    currency: 'ج.م',
    in_stock: true,
    featured: true,
    image_url: '/products/default.png',
    specs: ['650 وات'],
    short_description: 'مثقاب احترافي',
  };

  const sbMock = {
    from(table) {
      if (table === 'store_catalog_products') {
        return {
          select() {
            return {
              async in(_field, values) {
                return {
                  data: values.includes('p-drill-1') || values.includes('DRL-500')
                    ? [{ id: 'p-drill-1', code: 'DRL-500', in_stock: true }]
                    : [],
                  error: null,
                };
              },
            };
          },
        };
      }
      assert.equal(table, 'user_requests');
      return {
        insert() {
          return {
            select() {
              return {
                async single() {
                  return { data: { id: 'esc-1' }, error: null };
                },
              };
            },
          };
        },
      };
    },
    async rpc(name) {
      if (name === 'copilot_search_products') {
        return { data: [mockProductRow], error: null };
      }
      if (name === 'copilot_estimate_order') {
        return {
          data: {
            items: [
              {
                productId: 'p-drill-1',
                code: 'DRL-500',
                name: 'مثقاب كهربائي 650 وات',
                unit: 'قطعة',
                qty: 2,
                price: 1850,
                installPrice: 0,
                withInstall: false,
                currency: 'ج.م',
                lineSupplyTotal: 3700,
                lineInstallTotal: 0,
                lineTotal: 3700,
                installNeedsQuote: false,
              },
            ],
            missing_items: [],
            supply_subtotal: 3700,
            install_subtotal: 0,
            grand_total: 3700,
            total_saved: 0,
            currency: 'ج.م',
            has_unpriced_items: false,
            has_installation: false,
          },
          error: null,
        };
      }
      if (name === 'copilot_submit_order_or_service') {
        return {
          data: {
            ok: true,
            id: 'ord-1',
            refCode: 'ORD-2026-0001',
            order: { items: [{ id: 'p-drill-1' }], totalAmount: 3700, currency: 'ج.م' },
          },
          error: null,
        };
      }
      return { data: [], error: null };
    },
  };

  const tools = loadTsModule('../lib/store-copilot-tools.ts', {
    '@supabase/supabase-js': { createClient() { throw new Error('Unexpected client'); } },
    '@/lib/copilot/chat-knowledge': { searchSiteKnowledge: () => [] },
    '@/lib/copilot/training-store': { getCachedCopilotTraining: async () => ({}), matchCopilotKnowledge: () => [] },
    '@/app/site/store-catalog': catalogStub,
    '@/app/site/delivery-location': { sanitizeDeliveryLocation: (v) => v || null },
    '@/lib/store-catalog-server': catalogServerMock,
    '@/lib/copilot/handoff': handoff,
    '@/lib/copilot/catalog-relevance': relevance,
    '@/lib/store-order-telegram': {
      sendCopilotEscalationTelegram: async () => true,
      sendStoreTelegramNotification: async () => true,
    },
  });

  tools.resetCopilotConversionMetricsForTest();
  const ctx = {
    sessionId: 'COP-SECRET-SESSION-999',
    customerName: 'عميل سري لا يجب ظهوره',
    customerPhone: '01099887766',
    customerMessages: ['عايز شنيور', 'اسمي عميل سري', '01099887766', 'حولني لمهندس', 'أكد الطلب'],
    products: [],
    estimate: null,
    cartAction: null,
    submittedOrder: null,
    escalated: false,
    handoffRequested: true,
    submissionRequested: true,
    actions: [],
    toolsUsed: [],
  };

  const searchRes = await tools.execSearchProducts(sbMock, { query: 'عايز شنيور' }, ctx);
  assert.equal(searchRes.status, 'found');
  assert.equal(searchRes.totalReturned, 1);

  const cartRes = await tools.execPrepareCartAction(sbMock, { items: [{ productId: 'p-drill-1', code: 'DRL-500', qty: 2 }] }, ctx);
  assert.equal(cartRes.ok, true);

  const submitRes = await tools.execSubmitOrderOrService(sbMock, { items: [{ productId: 'p-drill-1', code: 'DRL-500', qty: 2 }] }, ctx);
  assert.equal(submitRes.ok, true);

  const escRes = await tools.execEscalateToEngineer(sbMock, { reason: 'استفسار فني' }, ctx);
  assert.equal(escRes.ok, true);

  const metrics = tools.getCopilotConversionMetrics();
  assert.equal(metrics.totalSearches, 1);
  assert.equal(metrics.synonymMatchedSearches, 1);
  assert.equal(metrics.foundSearches, 1);
  assert.equal(metrics.cartActionsCount, 1);
  assert.equal(metrics.cartItemsAddedTotal, 2);
  assert.equal(metrics.synonymAssistedCartActions, 1);
  assert.equal(metrics.submittedOrdersCount, 1);
  assert.equal(metrics.synonymAssistedSubmissions, 1);
  assert.equal(metrics.escalationsCount, 1);
  assert.equal(metrics.synonymAssistedEscalations, 1);
  assert.deepEqual({ ...metrics.topSynonymTerms[0] }, {
    key: 'شنيور',
    searches: 1,
    carts: 1,
    orders: 1,
    escalations: 1,
  });

  // Strict PII check: telemetry output never contains raw sessionId, customerName, or customerPhone
  const serialized = JSON.stringify(metrics);
  assert.equal(serialized.includes('COP-SECRET-SESSION-999'), false);
  assert.equal(serialized.includes('عميل سري'), false);
  assert.equal(serialized.includes('01099887766'), false);
});

test('5.2 company-cache isolates keys, clears non-active IDB caches on switch & resets on sign-out', async () => {
  let activeId = 'comp-a';
  const deletedIdbKeys = [];
  const idbStore = new Map([
    ['phi_rq_cache_v2_comp-a', { payload: 'A' }],
    ['phi_rq_cache_v2_comp-b', { payload: 'B' }],
    ['phi_rq_cache_v2_default', { payload: 'D' }],
    ['unrelated_key', { keep: true }],
  ]);

  const storageMap = new Map([
    ['phi_active_company_id', 'comp-a'],
    ['phi_cached_companies_user1', '[{"id":"comp-a"}]'],
    ['phi_lang', 'ar'],
    ['phi_theme_mode', 'dark'],
  ]);
  const storageMock = {
    get length() { return storageMap.size; },
    key(i) { return Array.from(storageMap.keys())[i] ?? null; },
    getItem(k) { return storageMap.get(k) ?? null; },
    removeItem(k) { storageMap.delete(k); },
  };

  const cacheMod = loadTsModule('../lib/company-cache.ts', {
    'idb-keyval': { keys: async () => Array.from(idbStore.keys()), del: async (k) => idbStore.delete(k) },
    './supabase': { ACTIVE_COMPANY_STORAGE_KEY: 'phi_active_company_id', getActiveCompanyId: () => activeId },
  });

  assert.equal(cacheMod.getCompanyCacheKey('comp-a'), 'phi_rq_cache_v2_comp-a');
  assert.equal(cacheMod.getCompanyCacheKey('comp-b'), 'phi_rq_cache_v2_comp-b');

  let cancelCount = 0;
  let clearCount = 0;
  const queryClientMock = {
    cancelQueries: async () => { cancelCount++; },
    clear: () => { clearCount++; },
  };

  // Switch from comp-a -> comp-b: keeps comp-b IDB entry, purges comp-a & default, preserves unrelated_key & UI prefs
  const switchRes = await cacheMod.clearCompanyScopedClientCaches({
    keepCompanyId: 'comp-b',
    clearAuthCompanySelection: false,
    queryClient: queryClientMock,
    idbKeysFn: async () => Array.from(idbStore.keys()),
    idbDelFn: async (k) => { deletedIdbKeys.push(String(k)); idbStore.delete(k); },
    storage: storageMock,
  });

  assert.equal(switchRes.skipped, false);
  assert.equal(cancelCount, 1);
  assert.equal(clearCount, 1);
  assert(switchRes.clearedIdbKeys.includes('phi_rq_cache_v2_comp-a'));
  assert(switchRes.clearedIdbKeys.includes('phi_rq_cache_v2_default'));
  assert.equal(idbStore.has('phi_rq_cache_v2_comp-b'), true);
  assert.equal(idbStore.has('unrelated_key'), true);
  assert.equal(storageMap.get('phi_lang'), 'ar');

  // Sign-out cleanup: deletes all phi_rq_cache_v2_* entries and clears phi_active_company_id + cached companies
  const signOutRes = await cacheMod.clearCompanyScopedClientCaches({
    keepCompanyId: null,
    clearAuthCompanySelection: true,
    queryClient: queryClientMock,
    idbKeysFn: async () => Array.from(idbStore.keys()),
    idbDelFn: async (k) => { idbStore.delete(k); },
    storage: storageMock,
  });
  assert.equal(idbStore.has('phi_rq_cache_v2_comp-b'), false);
  assert.equal(idbStore.has('unrelated_key'), true);
  assert.equal(storageMap.has('phi_active_company_id'), false);
  assert.equal(storageMap.has('phi_cached_companies_user1'), false);
  assert.equal(storageMap.get('phi_lang'), 'ar');
  assert.equal(storageMap.get('phi_theme_mode'), 'dark');

  // Feature flag kill-switch disables cleanup safely
  storageMap.set('phi_disable_company_cache_isolation', 'true');
  storageMap.set('phi_active_company_id', 'comp-a');
  const skippedRes = await cacheMod.clearCompanyScopedClientCaches({
    keepCompanyId: null,
    clearAuthCompanySelection: true,
    queryClient: queryClientMock,
    idbKeysFn: async () => ['phi_rq_cache_v2_comp-a'],
    idbDelFn: async () => { throw new Error('Should not delete when disabled'); },
    storage: storageMock,
  });
  assert.equal(skippedRes.skipped, true);
  assert.equal(storageMap.has('phi_active_company_id'), true);
});
