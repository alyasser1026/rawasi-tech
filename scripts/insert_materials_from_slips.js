const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = (env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/))[1].trim();
const supabase = createClient(url, key);

const companyId = '72918f4d-10c3-43a0-884e-2f84f1224335';

const itemsToAdd = [
  {
    item_code: 'MAT-001',
    item_name: 'كيس معجون جدران اسمنتي',
    main_category: 'فتونايت داخلي',
    default_unit: 'كيس',
    default_unit_price: 25,
    notes: 'كود الإذن: 683ME | الإستخدام: فتونيت داخلي',
    company_id: companyId
  },
  {
    item_code: 'MAT-002',
    item_name: 'بستلة همبل فيلر داخلي',
    main_category: 'معجون جاهز داخلي حوائط',
    default_unit: 'بستلة',
    default_unit_price: 0,
    notes: 'كود الإذن: 38840 | الإستخدام: معجون جاهز داخلي حوائط',
    company_id: companyId
  },
  {
    item_code: 'MAT-003',
    item_name: 'بستلة كوتكس فيلر شقوق',
    main_category: 'معجون فواصل جبس وشروخ',
    default_unit: 'بستلة',
    default_unit_price: 0,
    notes: 'كود الإذن: 383ME | الإستخدام: معجون فواصل جبس وشروخ',
    company_id: companyId
  },
  {
    item_code: 'MAT-004',
    item_name: 'بستلة همبل معجون الفواصل (معجون داخلي للجبسون بورد)',
    main_category: 'معجون داخلي للجبس',
    default_unit: 'بستلة',
    default_unit_price: 0,
    notes: 'كود الإذن: 381ME | الإستخدام: معجون داخلي للجبس',
    company_id: companyId
  },
  {
    item_code: 'MAT-005',
    item_name: 'بستلة همبل برو برايمر',
    main_category: 'برايمر داخلي',
    default_unit: 'بستلة',
    default_unit_price: 0,
    notes: 'كود الإذن: 28832 | الإستخدام: برايمر داخلي',
    company_id: companyId
  },
  {
    item_code: 'MAT-006',
    item_name: 'بستلة مايسترو مات املشن (مائي)',
    main_category: 'دهان مط اسقف',
    default_unit: 'بستلة',
    default_unit_price: 0,
    notes: 'كود الإذن: 595ME | الإستخدام: دهان مط اسقف',
    company_id: companyId
  },
  {
    item_code: 'MAT-007',
    item_name: 'بستلة توباز',
    main_category: 'دهان مقاوم للبكتيريا اسقف',
    default_unit: 'بستلة',
    default_unit_price: 0,
    notes: 'كود الإذن: 58803 | الإستخدام: دهان مقاوم للبكتيريا اسقف',
    company_id: companyId
  },
  {
    item_code: 'MAT-008',
    item_name: 'بستلة مايسترو مات ايملشن NCS 500',
    main_category: 'دهان وجه اول مط حوائط',
    default_unit: 'بستلة',
    default_unit_price: 0,
    notes: 'كود الإذن: 594ME | الإستخدام: دهان وجه اول مط حوائط',
    company_id: companyId
  },
  {
    item_code: 'MAT-009',
    item_name: 'بستلة توباز سيلك إيملشن',
    main_category: 'دهان وجه اخير ربع لامع حوائط',
    default_unit: 'بستلة',
    default_unit_price: 0,
    notes: 'كود الإذن: 589ME | الإستخدام: دهان وجه اخير ربع لامع حوائط',
    company_id: companyId
  },
  {
    item_code: 'MAT-010',
    item_name: 'بستلة همبل فيلر',
    main_category: 'معجون خارجي',
    default_unit: 'بستلة',
    default_unit_price: 0,
    notes: 'كود الإذن: 38900 | الإستخدام: معجون خارجي',
    company_id: companyId
  },
  {
    item_code: 'MAT-011',
    item_name: 'بستلة توباز برايمر',
    main_category: 'برايمر خارجي',
    default_unit: 'بستلة',
    default_unit_price: 0,
    notes: 'كود الإذن: 28830 | الإستخدام: برايمر خارجي',
    company_id: companyId
  },
  {
    item_code: 'MAT-012',
    item_name: 'بستلة كازا راستيكا (3MM)',
    main_category: 'بروفايل خارجي',
    default_unit: 'بستلة',
    default_unit_price: 0,
    notes: 'كود الإذن: 58950 | الإستخدام: بروفايل خارجي',
    company_id: companyId
  },
  {
    item_code: 'MAT-013',
    item_name: 'بستلة مايسترو مات ايملشن رال 7016',
    main_category: 'دهان اسود خارجي',
    default_unit: 'بستلة',
    default_unit_price: 0,
    notes: 'كود الإذن: 594ME | الإستخدام: دهان اسود خارجي',
    company_id: companyId
  },
  {
    item_code: 'MAT-014',
    item_name: 'بكرة تيب دوكو عريض',
    main_category: 'تيب دوكو ولاصق حماية',
    default_unit: 'بكرة',
    default_unit_price: 0,
    notes: 'الاستخدام: بكرة تيب دوكو عريض لاصق حماية',
    company_id: companyId
  },
  {
    item_code: 'MAT-015',
    item_name: 'جوينت تيب جبس',
    main_category: 'فواصل وشريط جبس بورد',
    default_unit: 'بكرة',
    default_unit_price: 0,
    notes: 'الاستخدام: جوينت تيب فواصل جبسون بورد (Joint Tape)',
    company_id: companyId
  },
  {
    item_code: 'MAT-016',
    item_name: 'كورنر تيب جبس',
    main_category: 'زوايا وشريط جبس بورد',
    default_unit: 'بكرة',
    default_unit_price: 0,
    notes: 'الاستخدام: كورنر تيب زوايا جبسون بورد (Corner Tape)',
    company_id: companyId
  }
];

(async () => {
  for (const item of itemsToAdd) {
    const { data: existing } = await supabase
      .from('material_items')
      .select('id, item_code, item_name')
      .eq('item_code', item.item_code);

    if (existing && existing.length > 0) {
      console.log('Updating existing item:', existing[0].item_code, item.item_name);
      const { error } = await supabase
        .from('material_items')
        .update({
          item_code: item.item_code,
          item_name: item.item_name,
          main_category: item.main_category,
          default_unit: item.default_unit,
          notes: item.notes,
          company_id: item.company_id
        })
        .eq('id', existing[0].id);
      if (error) console.error('Update error for ' + item.item_code + ':', error.message);
    } else {
      console.log('Inserting new item:', item.item_code, item.item_name);
      const { error } = await supabase
        .from('material_items')
        .insert([item]);
      if (error) console.error('Insert error for ' + item.item_code + ':', error.message);
    }
  }

  const { data: allItems } = await supabase.from('material_items').select('*').order('item_code');
  console.log('\n--- SUCCESS! Total items in DB now:', allItems?.length, '---');
  allItems?.forEach(i => console.log(i.item_code, ':', i.item_name, '|', i.main_category, '|', i.default_unit));
})();
