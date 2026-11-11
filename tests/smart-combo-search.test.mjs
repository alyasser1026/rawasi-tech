import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeComboText,
  tokenizeComboQuery,
  toSqlWildcardToken,
  buildSupabaseTokenOrQueries,
  filterAndRankComboRows,
  resolveComboEffectiveQuery,
} from '../lib/smartComboSearch.ts';

const SAMPLE_BOQ_ITEMS = [
  {
    id: '8f-02',
    item_code: 'STR-8F-02',
    item_name: 'كوابيل (كانتليڤر) سقف الدور الثامن / 8th Floor Cantilevers',
    main_category: 'الأعمال الإنشائية',
    sub_category: 'الدور الثامن (8th Floor)',
  },
  {
    id: '8f-03',
    item_code: 'STR-8F-03',
    item_name: 'سقف فلات الدور الثامن / 8th Floor Flat Slab',
    main_category: 'الأعمال الإنشائية',
    sub_category: 'الدور الثامن (8th Floor)',
  },
  {
    id: '9f-01',
    item_code: 'STR-9F-01',
    item_name: 'أعمدة الدور التاسع / 9th Floor Columns',
    main_category: 'الأعمال الإنشائية',
    sub_category: 'الدور التاسع (9th Floor)',
  },
  {
    id: '4f-06',
    item_code: 'STR-4F-06',
    item_name: 'كمر مقلوب (انفيرتيد بيم) الدور الرابع / 4th Floor Inverted Beams',
    main_category: 'الأعمال الإنشائية',
    sub_category: 'الدور الرابع (4th Floor)',
  },
  {
    id: '4f-02',
    item_code: 'STR-4F-02',
    item_name: 'كوابيل (كانتليڤر) سقف الدور الرابع / 4th Floor Cantilevers',
    main_category: 'الأعمال الإنشائية',
    sub_category: 'الدور الرابع (4th Floor)',
  },
  {
    id: '4f-01',
    item_code: 'STR-4F-01',
    item_name: 'أعمدة الدور الرابع / 4th Floor Columns',
    main_category: 'الأعمال الإنشائية',
    sub_category: 'الدور الرابع (4th Floor)',
  },
  {
    id: '4f-03',
    item_code: 'STR-4F-03',
    item_name: 'سقف فلات الدور الرابع / 4th Floor Flat Slab',
    main_category: 'الأعمال الإنشائية',
    sub_category: 'الدور الرابع (4th Floor)',
  },
  {
    id: '4f-04',
    item_code: 'STR-4F-04',
    item_name: 'سقف كمري الدور الرابع / 4th Floor Solid Slab',
    main_category: 'الأعمال الإنشائية',
    sub_category: 'الدور الرابع (4th Floor)',
  },
  {
    id: '4f-05',
    item_code: 'STR-4F-05',
    item_name: 'سقف هوردي الدور الرابع / 4th Floor Hollow Block (Ribbed) Slab',
    main_category: 'الأعمال الإنشائية',
    sub_category: 'الدور الرابع (4th Floor)',
  },
  {
    id: '3-01',
    item_code: 'STR-03-01',
    item_name: 'فرشة نظافة عادية / Plain Concrete (P.C.) Blinding / Mud Slab',
    main_category: 'الأعمال الإنشائية',
    sub_category: 'أعمال الأساسات والخرسانة العادية (Foundations & Blinding Works)',
  },
];

test('resolveComboEffectiveQuery preserves live freeText search even when parent echoes initialDisplay', () => {
  // Regression for typing "الراب" in BoqFormModal where onSelect("الراب") echoes into initialDisplay
  const liveTyping = resolveComboEffectiveQuery({
    query: 'الراب',
    isUserTyping: true,
    lastSelected: 'الراب',
    initialDisplay: 'الراب',
    displayCol: 'item_name',
  });
  assert.equal(liveTyping, 'الراب');

  // When not actively typing (e.g. focused existing record), returns '' so dropdown shows browseable list
  const existingRecordFocus = resolveComboEffectiveQuery({
    query: 'أعمدة الدور الرابع / 4th Floor Columns',
    isUserTyping: false,
    lastSelected: SAMPLE_BOQ_ITEMS[5],
    initialDisplay: 'أعمدة الدور الرابع / 4th Floor Columns',
    displayCol: 'item_name',
  });
  assert.equal(existingRecordFocus, '');
});

test('normalizeComboText and SQL wildcard generation tolerate Arabic spelling variants safely', () => {
  assert.equal(normalizeComboText('أَعْمِدَةُ الدَّورِ الرَّابِع / 4th'), 'اعمده الدور الرابع / 4th');
  assert.equal(normalizeComboText('كانتليڤر ٤'), 'كانتليفر 4');

  assert.equal(toSqlWildcardToken('الراب'), '_لر_ب');
  assert.equal(toSqlWildcardToken('اعمده'), '_عمد_');
  assert.equal(toSqlWildcardToken('كانتليفر'), 'ك_نتل__ر');
  assert.equal(toSqlWildcardToken('اه'), 'اه'); // Never degrades to all-wildcards '__'
  assert.equal(toSqlWildcardToken('فيلا'), 'فيل_'); // Keeps enough anchor chars

  const orClauses = buildSupabaseTokenOrQueries(
    'item_name,item_code,main_category,sub_category',
    'سقف الرابع (فلات)'
  );
  assert.equal(orClauses.length, 3);
  for (const clause of orClauses) {
    assert.ok(!/[()]/.test(clause), `PostgREST delimiter leaked into clause: ${clause}`);
  }
  assert.deepEqual(tokenizeComboQuery('رخام / جرانيت'), ['رخام', 'جرانيت']);
});

test('filterAndRankComboRows returns only 4th floor BOQ items in natural code order for "الراب"', () => {
  const results = filterAndRankComboRows(SAMPLE_BOQ_ITEMS, {
    query: 'الراب',
    searchCols: 'item_name,item_code,main_category,sub_category',
    displayCol: 'item_name',
    table: 'boq_items',
  });

  assert.deepEqual(
    results.map((r) => r.item_code),
    ['STR-4F-01', 'STR-4F-02', 'STR-4F-03', 'STR-4F-04', 'STR-4F-05', 'STR-4F-06']
  );
});

test('filterAndRankComboRows handles multi-word and hamza/taa-normalized Arabic queries on boq_items', () => {
  const multiWord = filterAndRankComboRows(SAMPLE_BOQ_ITEMS, {
    query: 'سقف الرابع',
    searchCols: 'item_name,item_code,main_category,sub_category',
    displayCol: 'item_name',
    table: 'boq_items',
  });
  assert.deepEqual(
    multiWord.map((r) => r.item_code),
    ['STR-4F-03', 'STR-4F-04', 'STR-4F-05', 'STR-4F-02']
  );

  const hamzaTaa = filterAndRankComboRows(SAMPLE_BOQ_ITEMS, {
    query: 'اعمده الرابع',
    searchCols: 'item_name,item_code,main_category,sub_category',
    displayCol: 'item_name',
    table: 'boq_items',
  });
  assert.deepEqual(hamzaTaa.map((r) => r.item_code), ['STR-4F-01']);

  const veeVariant = filterAndRankComboRows(SAMPLE_BOQ_ITEMS, {
    query: 'كانتليفر الرابع',
    searchCols: 'item_name,item_code,main_category,sub_category',
    displayCol: 'item_name',
    table: 'boq_items',
  });
  assert.deepEqual(veeVariant.map((r) => r.item_code), ['STR-4F-02']);

  const codePrefix = filterAndRankComboRows(SAMPLE_BOQ_ITEMS, {
    query: 'str-4f',
    searchCols: 'item_name,item_code,main_category,sub_category',
    displayCol: 'item_name',
    table: 'boq_items',
  });
  assert.equal(codePrefix.length, 6);
  assert.equal(codePrefix[0].item_code, 'STR-4F-01');
});

test('filterAndRankComboRows enforces accounts, chained filters, customFilter, and deduplication', () => {
  const rows = [
    { id: '1', name: 'حساب رئيسي', is_transactional: false, project_id: 'p1' },
    { id: '2', name: 'بنك مصر', is_transactional: true, project_id: 'p1' },
    { id: '2', name: 'بنك مصر', is_transactional: true, project_id: 'p1' },
    { id: '3', name: 'بنك القاهرة', is_transactional: true, project_id: 'p2' },
  ];

  const filtered = filterAndRankComboRows(rows, {
    query: 'بنك',
    searchCols: 'name',
    displayCol: 'name',
    table: 'accounts',
    filterColumn: 'project_id',
    filterValue: 'p1',
    customFilter: 'id=neq.999',
  });

  assert.deepEqual(filtered.map((r) => r.id), ['2']);
});
