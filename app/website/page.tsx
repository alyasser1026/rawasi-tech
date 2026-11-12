"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { PHITECH_RINGS_PATH, PHITECH_PILLARS_PATH, PHITECH_TIGHT_VIEWBOX } from '@/lib/brand-logo-paths';
import HeroVideoBackdrop from '@/components/HeroVideoBackdrop';

const SuperheroRoom3D = dynamic(() => import('../site/SuperheroRoom3D'), {
  ssr: false,
  loading: () => (
    <div className="p-12 text-center font-bold text-amber-500">
      جاري تحميل غرفة السوبر هيرو ثلاثية الأبعاد (Three.js)...
    </div>
  ),
});

export default function WebsitePage() {
  // Theme & Accent states
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [accent, setAccent] = useState<'amber' | 'emerald' | 'cyan'>('amber');
  const [heroLogoVariant, setHeroLogoVariant] = useState<'official-master' | 'print-light' | 'web-dark' | 'luxury-foil'>('official-master');

  // Calculator states
  const [currencySymbol, setCurrencySymbol] = useState<'ر.س' | 'ج.م' | '$'>('ر.س');
  const [currencyRate, setCurrencyRate] = useState<number>(1);
  const [projectType, setProjectType] = useState<'villa' | 'tower' | 'commercial' | 'duplex'>('villa');
  const [specTier, setSpecTier] = useState<number>(1.35);
  const [areaPerFloor, setAreaPerFloor] = useState<number>(450);
  const [floors, setFloors] = useState<number>(3);
  const [activeScopes, setActiveScopes] = useState<{
    structural: boolean;
    architectural: boolean;
    mep: boolean;
  }>({
    structural: true,
    architectural: true,
    mep: true,
  });

  // BOQ Scope Explorer Filter
  const [boqFilter, setBoqFilter] = useState<'all' | 'structural' | 'plaster' | 'ceilings' | 'marble' | 'paint' | 'mep'>('all');

  // X-Ray Layer Simulator
  const [activeLayer, setActiveLayer] = useState<'all' | 'structural' | 'mep' | 'plaster' | 'finishing'>('all');

  // Portfolio Filter
  const [portfolioFilter, setPortfolioFilter] = useState<'all' | 'turnkey' | 'structural' | 'finishing' | 'mep'>('all');

  // Brand Studio States
  const [studioLockup, setStudioLockup] = useState<'mark' | 'stacked' | 'horizontal'>('mark');
  const [studioColorMode, setStudioColorMode] = useState<'print-light' | 'web-dark' | 'luxury-foil' | 'mono'>('print-light');
  const [studioBgSurface, setStudioBgSurface] = useState<'paper' | 'dark' | 'ceramic' | 'transparent'>('paper');
  const [studioMockupTab, setStudioMockupTab] = useState<'cards' | 'letterhead' | 'stamp'>('cards');
  const [proportions, setProportions] = useState<{
    rOut: number;
    thickness: number;
    verticalExt: number;
  }>({
    rOut: 192,
    thickness: 52,
    verticalExt: 22,
  });

  // Lead Form State
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadPackage, setLeadPackage] = useState('تسليم مفتاح متكامل 3×1 (عظم + تشطيبات ديلوكس + تكييف مخفي وMEP)');
  const [leadLocation, setLeadLocation] = useState('الرياض — المملكة العربية السعودية');
  const [leadNotes, setLeadNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // User session state (checks if user is signed into ERP)
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ show: boolean; title: string; desc: string }>({
    show: false,
    title: '',
    desc: '',
  });
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (title: string, desc: string) => {
    setToast({ show: true, title, desc });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToast({ show: false, title: '', desc: '' });
    }, 3800);
  };

  // Check Supabase session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session?.user);
    });
  }, []);

  // Geometry calculation for the Official PhiTech Logo
  const logoGeometry = useMemo(() => {
    return {
      ringsPath: PHITECH_RINGS_PATH,
      pillarsPath: PHITECH_PILLARS_PATH,
      tightViewBox: PHITECH_TIGHT_VIEWBOX,
    };
  }, [proportions]);

  // BoQ Calculation for Contracting Scopes (SAR benchmark)
  const boqCalculation = useMemo(() => {
    const totalBUA = areaPerFloor * floors;

    // Rates per m² in SAR (Saudi Riyal benchmark)
    const typeFactors: Record<string, { struct: number; arch: number; mep: number }> = {
      villa: { struct: 1100, arch: 1450, mep: 550 },
      tower: { struct: 1250, arch: 1200, mep: 600 },
      commercial: { struct: 1150, arch: 1350, mep: 700 },
      duplex: { struct: 980, arch: 1550, mep: 620 }
    };

    const rates = typeFactors[projectType] || typeFactors.villa;

    const structCost = activeScopes.structural
      ? Math.round(totalBUA * rates.struct * specTier * currencyRate)
      : 0;

    const archCost = activeScopes.architectural
      ? Math.round(totalBUA * rates.arch * specTier * currencyRate)
      : 0;

    const mepCost = activeScopes.mep
      ? Math.round(totalBUA * rates.mep * specTier * currencyRate)
      : 0;

    const allThreeActive = activeScopes.structural && activeScopes.architectural && activeScopes.mep;
    const rawTotal = structCost + archCost + mepCost;
    const grandTotal = allThreeActive ? Math.round(rawTotal * 0.93) : rawTotal;

    // Quantitative metrics
    const steelTons = activeScopes.structural ? Math.round(totalBUA * 0.046) : 0;
    const concreteCbm = activeScopes.structural ? Math.round(totalBUA * 0.42) : 0;
    const plasterSqm = activeScopes.architectural ? Math.round(totalBUA * 2.8) : 0;
    const hvacTons = activeScopes.mep ? Math.round(totalBUA / 18) : 0;

    let months = 2;
    if (activeScopes.structural) months += Math.ceil(floors * 1.1);
    if (activeScopes.architectural) months += Math.ceil(floors * 1.2);
    if (activeScopes.mep) months += 1;
    if (allThreeActive) months = Math.max(4, Math.round(months * 0.8));

    return {
      totalBUA,
      structCost,
      archCost,
      mepCost,
      grandTotal,
      allThreeActive,
      steelTons,
      concreteCbm,
      plasterSqm,
      hvacTons,
      months,
    };
  }, [areaPerFloor, floors, projectType, specTier, currencyRate, activeScopes]);

  // Real BOQ Items Catalog from the Company Database
  const realBoqItems = [
    {
      code: 'STR-03-02',
      category: 'structural',
      categoryLabel: 'أعمال الأساسات والخرسانات',
      name: 'لبشة مسلحة / R.C. Raft / Mat Foundation',
      unit: 'م3',
      specs: 'صب خرسانة مسلحة جهد 350-400 كجم/سم² بمضخات هيدروليكية مع حديد تسليح عالي المقاومة B500D، وطبقات عزل بيتوميني مؤكسد وحماية كاملة.',
      accentColor: '#fb923c',
    },
    {
      code: 'STR-GF-03',
      category: 'structural',
      categoryLabel: 'الهيكل الخرساني والأسقف',
      name: 'سقف فلات سلاب (Flat Slab) / بلاطة لا كمرية',
      unit: 'م3',
      specs: 'تنفيذ بلاطة لا كمرية ملساء مع رقتين حديد علوية وسفلية ومناطق تكثيف ومساقط Drop Panels حول الأعمدة لمنع القص الثاقب (Punching).',
      accentColor: '#fb923c',
    },
    {
      code: 'STR-GF-05',
      category: 'structural',
      categoryLabel: 'الهيكل الخرساني والأسقف',
      name: 'سقف هوردي (Hollow Block / Ribbed Slab)',
      unit: 'م3',
      specs: 'تنفيذ أسقف هوردي مفرغة ببلوكات عازلة للصوت والحرارة مع أعصاب تسليح وجسور ساقطة ومخفية لزيادة البحور واستيعاب المسطحات المفتوحة.',
      accentColor: '#fb923c',
    },
    {
      code: 'STR-03-05',
      category: 'structural',
      categoryLabel: 'الأساسات ومسارات العزل',
      name: 'كمر مقلوب فوق اللبشة / Inverted Beams',
      unit: 'م3',
      specs: 'كمرات خرسانية مسلحة مقلوبة لتوزيع الأحمال الإنشائية وضبط مناسيب غرف الخدمات ومنع تسربات المياه في البدروم والملاحق.',
      accentColor: '#fb923c',
    },
    {
      code: 'FIN-01-04',
      category: 'plaster',
      categoryLabel: 'أعمال اللياسة (المحارة)',
      name: 'أعمال البؤج والأوتار والتأكيس والتربيع لياسة ليزر',
      unit: 'مقطوعية',
      specs: 'ضبط استقامة الحوائط وتعامد زوايا الغرف 90 درجة بأجهزة الليزر ومساطر الألومنيوم قبل أعمال الملو لضمان تطابق تام مع أعمال الديكور والرخام.',
      accentColor: '#34d399',
    },
    {
      code: 'FIN-01-01',
      category: 'plaster',
      categoryLabel: 'أعمال اللياسة (المحارة)',
      name: 'أعمال الملو والتسوية ومس الجدران بالمساطر',
      unit: 'م2',
      specs: 'طرطشة مسمارية متجانسة وشبك تمدد فايبر في فواصل الخرسانة والمباني، ملو بخلطة أسمنتية معالجة، وتسوية ناعمة بالقدة ومساطر الليزر.',
      accentColor: '#34d399',
    },
    {
      code: 'FIN-04-01',
      category: 'ceilings',
      categoryLabel: 'الأسقف المعلقة والديكور',
      name: 'تأسيس وتركيب سيستم جبس بورد (دراي اريا)',
      unit: 'م2',
      specs: 'شاسيهات صاج مجلفن عيار 0.5 مم وألواح كناوف أصلية مع معالجة الفواصل بفيبر ومعجون ممتاز، وبيوت نور وتجاويف إنارة مخفية (Shadow Gap).',
      accentColor: '#34d399',
    },
    {
      code: 'FIN-05-09',
      category: 'ceilings',
      categoryLabel: 'الأسقف المعلقة والديكور',
      name: 'تقفيل وتركيب سيستم سمنت بورد (فلاش تانك ويت اريا)',
      unit: 'م2',
      specs: 'ألواح سمنت بورد مقاومة للمياه والرطوبة العالية حول الشاسيهات المدفونة والجدران المبللة في المطابخ والحمامات مع فتحات صيانة Access Panels.',
      accentColor: '#34d399',
    },
    {
      code: 'FIN-07-03',
      category: 'marble',
      categoryLabel: 'الرخام والجرانيت والبورسلان',
      name: 'تركيب جدران رخام ميكانيكياً بشاسيهات ستانلس',
      unit: 'م2',
      specs: 'تثبيت ألواح الرخام الطبيعي المستورد بشاسيهات وزوايا ستانلس ستيل 304 المقاوم للصدأ مع فواصل تمدد محسوبة تمنع السقوط أو التصدع نهائياً.',
      accentColor: '#34d399',
    },
    {
      code: 'FIN-02-11',
      category: 'marble',
      categoryLabel: 'الرخام والجرانيت والبورسلان',
      name: 'تركيب أرضيات بورسلان لارج فورمات (Large Format)',
      unit: 'م2',
      specs: 'لصق البورسلان بالغراء المخصص عالي الالتصاق واستخدام كلبسات التسوية الذاتية (Leveling Spacers) لضمان استواء السطح ونظافة الفواصل.',
      accentColor: '#34d399',
    },
    {
      code: 'FIN-03-01',
      category: 'paint',
      categoryLabel: 'الدهانات والديكور والواجهات',
      name: 'تأسيس حوائط وأسقف دهان (3 سكاكين معجون + سيلر)',
      unit: 'م2',
      specs: 'سيلر مائي مغلغل، 3 سكاكين معجون ممتاز مقاوم للشروخ، صنفرة بأجهزة الإضاءة الكاشفة، وتشطيب بدهانات جوتين (Jotun Fenomastic) الأصلية.',
      accentColor: '#34d399',
    },
    {
      code: 'FIN-04-09',
      category: 'paint',
      categoryLabel: 'الدهانات والديكور والواجهات',
      name: 'أعمال واجهات بروفايل وسافيتو عازلة للأجواء',
      unit: 'م2',
      specs: 'تأسيس سيلر حراري ومائي مقاوم للأملاح، وعمل طبقات بروفايل وجرافيتو بألوان كلاسيكية ومودرن مقاومة للأشعة فوق البنفسجية والعوامل الجوية.',
      accentColor: '#34d399',
    },
    {
      code: 'MEP-AC-01',
      category: 'mep',
      categoryLabel: 'الكهروميكانيك والتكييف المخفي',
      name: 'دكتات تكييف مخفي كونسيلد وأنظمة VRF الموفرة',
      unit: 'طن / م2',
      specs: 'تفصيل دكتات صاج مجلفن معزولة داخلياً وخارجياً بصوف زجاجي، مواسير نحاس جنوب إفريقي معزولة، ومخارج هواء وجريلات خطية (Linear Diffusers) متناسقة مع الجبس.',
      accentColor: '#38bdf8',
    },
    {
      code: 'MEP-PL-02',
      category: 'mep',
      categoryLabel: 'الكهروميكانيك والتكييف المخفي',
      name: 'شبكات سباكة حرارية PEX/PPR وصرف صامت معلق',
      unit: 'مقطوعية',
      specs: 'شبكات تغذية بمواسير بولي بروبلين حرارية مختبرة بضغط 16 بار، شاسيهات كراسي معلقة مدفونة Grohe، وشبكات صرف صامت معلقة بأقفال مانعة للاهتزاز.',
      accentColor: '#38bdf8',
    },
    {
      code: 'MEP-EL-03',
      category: 'mep',
      categoryLabel: 'الكهروميكانيك والتكييف المخفي',
      name: 'تمديدات كهرباء ومسارات ماجنتيك تراك وقواطع شنايدر',
      unit: 'مقطوعية',
      specs: 'كابلات نحاس سويدي معتمدة، لوحات توزيع وقواطع شنايدر إليكتريك، تأسيس مسارات الماجنتيك تراك (Magnetic Tracks) المدمجة بالأسقف، وتجهيز خطوط السمارت هوم.',
      accentColor: '#38bdf8',
    },
    {
      code: 'FIN-06-03',
      category: 'marble',
      categoryLabel: 'الألومنيوم والنجارة المعمارية',
      name: 'توريد وتركيب قطاعات ألومنيوم دبل جلاس عازل',
      unit: 'م2',
      specs: 'قطاعات ألومنيوم ثقيلة حرارية Double Glazed عازلة للصوت والحرارة، إكسسوارات إيطالية، درايش وسحابات ناعمة، وأبواب خشبية وWPC مقاومة للرطوبة.',
      accentColor: '#34d399',
    }
  ];

  const filteredBoqItems = useMemo(() => {
    if (boqFilter === 'all') return realBoqItems;
    return realBoqItems.filter(item => item.category === boqFilter);
  }, [boqFilter]);

  // X-Ray Layer Specs Data
  const layerSpecs = {
    all: {
      badge: 'FULL 3-IN-1 TURNKEY INTEGRATION',
      title: 'التكامل الهندسي الكامل 3×1 (عظم + تشطيبات + كهروميكانيك)',
      desc: 'عندما تتولى فاي تك (PhiTech) القطاعات الثلاثة معاً، يتم تنسيق الهيكل الإنشائي بممرات مسبقة الصب لدكتات التكييف المخفي ومواسير السباكة المعلقة، مما يوفر 20% من التكلفة ويمنع أي تكسير في الخرسانات والمباني لاحقاً.',
      items: [
        { label: 'الإنشاءات والعظم', val: 'لبشة مسلحة + أعمدة وأسقف Flat Slab وهوردي خرسانة معالجة جهد 350-400 كجم/سم²', color: '#fb923c' },
        { label: 'التشطيبات المعمارية', val: 'لياسة مساطر ليزر + أسقف كناوف وسمنت بورد + رخام ميكانيكي وبورسلان لارج + دهانات جوتين', color: '#34d399' },
        { label: 'الكهروميكانيك والتكييف', val: 'دكتات تكييف كونسيلد VRF + سباكة PEX معلقة وشاسيهات دفن + مسارات ماجنتيك تراك شنايدر', color: '#38bdf8' }
      ]
    },
    structural: {
      badge: 'LAYER 01 — STRUCTURAL SKELETON',
      title: 'الطبقة الأولى: البناء الإنشائي والعظم (الأساسات والهيكل)',
      desc: 'العمود الفقري للمبنى؛ ننفذه بإشراف هندسي ميداني صارم مع استلام المحاور بمحطات Total Station وموازين الليزر، واختبار مكعبات كسر الخرسانة في معامل معتمدة.',
      items: [
        { label: 'الأساسات والتربة', val: 'إحلال مدموك، خوازيق ساندة وحاملة، ولبشة مسلحة معزولة بطبقات بيتومين مؤكسد', color: '#fb923c' },
        { label: 'الخرسانات المسلحة', val: 'حديد تسليح B500D عالي المقاومة، كمرات مقلوبة، وأسقف فلات سلاب وهوردي واسعة البحور', color: '#fb923c' },
        { label: 'المباني والعزل', val: 'طوب أسمنتي وأحمر مفرغ مع أعتاب مسلحة مسبقة الصب + عزل مائي وحراري فوم بولي يوريثان', color: '#fb923c' }
      ]
    },
    mep: {
      badge: 'LAYER 02 — CONCEALED HVAC & MEP SPINE',
      title: 'الطبقة الثانية: الكهروميكانيك والتكييف المخفي (MEP & HVAC)',
      desc: 'نؤسس شبكات التغذية والصرف والتكييف المخفي قبل اللياسة والجبس وفق مخططات شوب دروينج (Shop Drawings) دقيقة تضمن سهولة الصيانة وهدوء التشغيل.',
      items: [
        { label: 'التكييف المخفي الكونسيلد', val: 'دكتات صاج مجلفن معزول بصوف زجاجي ومخارج هواء خطية Linear Diffusers مدمجة بالسقف', color: '#38bdf8' },
        { label: 'السباكة والتغذية الحرارية', val: 'شبكات PEX/PPR حرارية مختبرة تحت ضغط 16 بار + كراسي معلقة وشاسيهات دفن Grohe', color: '#38bdf8' },
        { label: 'الكهرباء والإنارة الحديثة', val: 'كابلات نحاس سويدي، مسارات ماجنتيك تراك، قواطع شنايدر إليكتريك، وتأسيس سمارت هوم', color: '#38bdf8' }
      ]
    },
    plaster: {
      badge: 'LAYER 03 — LASER PLASTERING & CEILINGS',
      title: 'الطبقة الثالثة: اللياسة بالليزر والأسقف المعلقة (المساطر والجبس)',
      desc: 'سر استواء الأسطح وفخامة الفنش؛ نعتمد تربيع وتأكيس الغرف بالليزر لضمان تعامد الزوايا 90°، مع شاسيهات صاج مجلفن وألواح كناوف وسمنت بورد.',
      items: [
        { label: 'لياسة المساطر والليزر', val: 'بؤج وأوتار على أجهزة الليزر، تربيع وتأكيس، طرطشة مسمارية وشبك فايبر ضد التمدد', color: '#34d399' },
        { label: 'أسقف جبس بورد كناوف', val: 'ألواح كناوف أصلية للمناطق الجافة مع بيوت نور وتجاويف إضاءة مخفية شادو جاب (Shadow Gap)', color: '#34d399' },
        { label: 'سمنت بورد للمناطق الرطبة', val: 'ألواح سمنت بورد مقاومة للرطوبة في الحمامات والمطابخ مع فتحات صيانة Access Panels', color: '#34d399' }
      ]
    },
    finishing: {
      badge: 'LAYER 04 — LUXURY ARCHITECTURAL FINISH',
      title: 'الطبقة الرابعة: الرخام والبورسلان والدهانات والواجهات',
      desc: 'اللمسة الملكية التي يراها العميل؛ خامات طبيعية مستوردة، رخام ميكانيكي، بورسلان لارج فورمات، دهانات جوتين، وواجهات بروفايل سافيتو.',
      items: [
        { label: 'الرخام والجرانيت', val: 'تكسيات جدران ميكانيكية بشاسيهات ستانلس ستيل، أرضيات رخام كريستال، ودرج مداخل جرانيت', color: '#fb923c' },
        { label: 'البورسلان اللارج فورمات', val: 'أرضيات وجدران بورسلان بمقاسات كبيرة مع كلبسات التسوية الذاتية وفواصل إيبوكسي معالجة', color: '#34d399' },
        { label: 'دهانات جوتين والواجهات', val: 'تأسيس 3 سكاكين معجون ممتاز، دهانات Jotun Fenomastic، وواجهات بروفايل سافيتو عازلة', color: '#38bdf8' }
      ]
    }
  };

  // Real Field Projects from Database
  const portfolioItems = [
    {
      id: 'PHI-P01',
      title: 'فيلا 657 — الرياض (ضاحية الفرسان)',
      category: 'turnkey',
      categoryLabel: 'تسليم مفتاح متكامل (تشطيبات ديلوكس)',
      area: '600.19 م²',
      duration: 'قيد التنفيذ (المساطر والجبس)',
      location: 'الرياض — ضاحية الفرسان',
      engineers: 'م/ كريم — م/ أبو عميرة',
      accentColor: '#fb923c',
      structuralScope: 'هيكل إنشائي كامل، معالجة فواصل التمدد، وصب أرضيات الميد والخرسانات الإضافية.',
      archScope: 'إنجاز أعمال لياسة المساطر وأوتار الليزر بنسبة 100%، تأسيس أسقف جبس بورد كناوف مع بيوت نور، وتجهيز رخام وبورسلان لارج فورمات.',
      mepScope: 'تأسيس دكتات التكييف المخفي الكونسيلد، تمديدات السباكة المعلقة PEX الحرارية، وشاسيهات كراسي دفن Grohe، ومسارات إنارة ماجنتيك تراك.'
    },
    {
      id: 'PHI-P02',
      title: 'عمارة كابيتال — كورنيش النيل (شارع البحر الأعظم)',
      category: 'structural',
      categoryLabel: 'هيكل إنشائي وعظم + تشطيب واجهات',
      area: '500 م² مسطح الدور (أرضي + متكرر)',
      duration: 'قيد التنفيذ الميداني',
      location: 'الجيزة — شارع البحر الأعظم',
      engineers: 'م/ يوسف',
      accentColor: '#fb923c',
      structuralScope: 'تنفيذ الهيكل الخرساني المسلح بنظام Flat Slab وأعمدة عالية الإجهاد مع عزل الأساسات واللبشة بالكامل ضد المياه الجوفية.',
      archScope: 'تنفيذ مباني الطوب الأسمنتي والأحمر، وتكسيات الواجهات الخارجية بدهانات بروفايل وسافيتو كلاسيكية مقاومة للرطوبة والعوامل الجوية.',
      mepScope: 'تأسيس الصواعد الرئيسية للصرف والتغذية، وغرف التفتيش، ومسارات كابلات الكهرباء الرئيسية ولوحات شنايدر.'
    },
    {
      id: 'PHI-P03',
      title: 'برج كابيتال — المنصورة (طلخا - البحر الأعظم)',
      category: 'structural',
      categoryLabel: 'أساسات عميقة وهيكل خرساني (11 دور)',
      area: '380 م² مسطح الدور (11 دور سكني وتجاري)',
      duration: 'مرحلة الأساسات واللبشة',
      location: 'الدقهلية — المنصورة (طلخا)',
      engineers: 'م/ بهاء الزهيري',
      accentColor: '#fb923c',
      structuralScope: 'تنفيذ خوازيق ميكانيكية ولبشة مسلحة بكثافة حديد عالية B500D وكمرات مقلوبة فوق اللبشة لتأمين المبنى بمحاذاة النيل.',
      archScope: 'تخطيط معماري للأدوار التجارية والسكنية مع أسقف هوردي وفلات سلاب لبحور إنشائية مفتوحة.',
      mepScope: 'زرع جلب التمديدات والـ Sleeves داخل البلاطات الخرسانية قبل الصب لمنع أي تكسير مستقبلي.'
    },
    {
      id: 'PHI-P04',
      title: 'قصر الياسمين الفاخر — الرياض (حي حطين)',
      category: 'turnkey',
      categoryLabel: 'تسليم مفتاح ملكي (Royal Finishing)',
      area: '1,250 م²',
      duration: '10 أشهر',
      location: 'الرياض — حي حطين',
      engineers: 'فريق الإشراف الهندسي — فاي تك السعودية',
      accentColor: '#34d399',
      structuralScope: 'هيكل خرساني خاص ببحور واسعة، كوابيل معمارية ضخمة، وحمام سباحة إنفينيتي معزول ومفحوص بالكامل.',
      archScope: 'تكسيات جدران رخام كلكتا وأونيكس ميكانيكياً، أرضيات كريما مارفل معالجة بالكريستال، أسقف جبسية بمسارات شادو جاب، وأبواب خشب جوز طبيعي.',
      mepScope: 'تكييف مركزي VRF موفر للطاقة مع جريلات طولية مخفية، سباكة حرارية ألمانية Grohe، وتأسيس أنظمة سمارت هوم KNX للتحكم الصوتي والإلكتروني.'
    },
    {
      id: 'PHI-P05',
      title: 'مقر وصالة عرض فاي تك — القاهرة الجديدة',
      category: 'finishing',
      categoryLabel: 'تشطيبات معمارية وديكور مودرن',
      area: '850 م²',
      duration: '3.5 أشهر',
      location: 'القاهرة الجديدة — التجمع الخامس',
      engineers: 'المكتب الفني — فاي تك مصر',
      accentColor: '#34d399',
      structuralScope: 'تعديلات معمارية، فتحات بحور إنشائية، وتدعيم كمرات حديدية I-Beam.',
      archScope: 'أرضيات بورسلان لارج فورمات رمادي إسباني، قواطع زجاجية Double Glazed عازلة للصوت، ودهانات جوتين ديكورية تعتيق ومخملي.',
      mepScope: 'تكييف كونسيلد مخفي دكتات صاج، مسارات إضاءة ماجنتيك تراك مغناطيسية، وتجهيز شبكة التيار الخفيف والأنظمة الصوتية.'
    },
    {
      id: 'PHI-P06',
      title: 'فيلا النرجس السكنية — الرياض (حي النرجس)',
      category: 'mep',
      categoryLabel: 'عظم بالمواد + تأسيسات كهروميكانيك متطورة',
      area: '520 م²',
      duration: '5 أشهر',
      location: 'الرياض — حي النرجس',
      engineers: 'م/ كريم ومساعدي الموقع',
      accentColor: '#38bdf8',
      structuralScope: 'حفر صخري، قواعد منفصلة وسملات وميد، هيكل عظم بالمواد، وعزل فوم بولي يوريثان حراري ومائي للأسطح.',
      archScope: 'لياسة مساطر وليزر، تربيع غرف وممرات، وأسقف كناوف وسمنت بورد فلاش تانك.',
      mepScope: 'تأسيس مواسير التكييف النحاسية المعزولة، كابلات سويدي أصلية، صرف أمريكي معلق صامت، ومضخات مياه ذكية.'
    }
  ];

  const filteredPortfolio = useMemo(() => {
    if (portfolioFilter === 'all') return portfolioItems;
    return portfolioItems.filter(p => p.category === portfolioFilter);
  }, [portfolioFilter]);

  // Actions
  const toggleTheme = () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    if (next === 'light') {
      setHeroLogoVariant('print-light');
      setStudioColorMode('print-light');
      setStudioBgSurface('paper');
      showToast('تم تفعيل الوضع النهاري السيراميكي', 'تحول الشعار إلى ألوان المطبوعات الأصلية (#2C353D + #F97316).');
    } else {
      setHeroLogoVariant('web-dark');
      setStudioColorMode('web-dark');
      setStudioBgSurface('dark');
      showToast('تم تفعيل وضع الأوبسيديان الليلي', 'تحول الشعار إلى نسخة الويب الليلي عالية التباين.');
    }
  };

  const handleSetAccent = (acc: 'amber' | 'emerald' | 'cyan') => {
    setAccent(acc);
    const names = {
      amber: 'البناء الإنشائي والعظم (Signature Amber)',
      emerald: 'التشطيبات المعمارية والفاخرة (Architectural Emerald)',
      cyan: 'الكهروميكانيك والتكييف المخفي MEP (Technical Cyan)',
    };
    showToast('تم تغيير لكنة النظام', `القطاع النشط: ${names[acc]}`);
  };

  const toggleScope = (scope: 'structural' | 'architectural' | 'mep') => {
    const count = Object.values(activeScopes).filter(Boolean).length;
    if (activeScopes[scope] && count === 1) {
      showToast('تنبيه هندسي', 'يجب تفعيل نطاق واحد على الأقل لحساب المقايسة التقديرية.');
      return;
    }
    setActiveScopes(prev => ({ ...prev, [scope]: !prev[scope] }));
  };

  const selectPresetScope = (scope: 'structural' | 'architectural' | 'mep') => {
    setActiveScopes({
      structural: scope === 'structural',
      architectural: scope === 'architectural',
      mep: scope === 'mep',
    });
    const el = document.getElementById('turnkey-calculator');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    showToast('تم تخصيص الحاسبة', 'تم ضبط الحاسبة لتسعير النطاق المختار، ويمكنك تفعيل باقي النطاقات للمقارنة.');
  };

  const transferBoQToForm = () => {
    const selectedScopes = [];
    if (activeScopes.structural) selectedScopes.push('بناء إنشائي وعظم');
    if (activeScopes.architectural) selectedScopes.push('تشطيبات معمارية وواجهات فاخرة');
    if (activeScopes.mep) selectedScopes.push('كهروميكانيك وتكييف مخفي MEP');

    const summary = `مقايسة إلكترونية من موقع فاي تك:
- نوع المشروع: ${projectType === 'villa' ? 'فيلا سكنية فاخرة' : projectType === 'tower' ? 'عمارة / برج سكني وتجاري' : projectType === 'commercial' ? 'مقر إداري أو معرض' : 'شقة دوبلكس / بنتهاوس'}
- إجمالي المسطح البنائي (BUA): ${boqCalculation.totalBUA.toLocaleString()} م² (${floors} أدوار × ${areaPerFloor} م²)
- النطاق المطلوب: (${selectedScopes.join(' + ')})
- الميزانية التقديرية المحسوبة: ${boqCalculation.grandTotal.toLocaleString()} ${currencySymbol}
- مؤشرات الكميات: خرسانة ~${boqCalculation.concreteCbm} م³ | حديد ~${boqCalculation.steelTons} طن | تكييف ~${boqCalculation.hvacTons} طن تبريد
نرجو التواصل لتحديد موعد معاينة هندسية للموقع وعرض سعر رسمي.`;

    setLeadNotes(summary);
    const el = document.getElementById('order-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    showToast('تم ترحيل المقايسة لنموذج التعاقد', 'أدخل اسمك ورقم الجوال لإرسال المقايسة للمكتب الفني والهندسي.');
  };

  // Submit Quote to API
  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadName || !leadPhone) {
      showToast('تنبيه', 'يرجى إدخال الاسم ورقم الهاتف.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/website-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: leadName,
          phone: leadPhone,
          package: leadPackage,
          location: leadLocation,
          notes: leadNotes,
          bua: boqCalculation.totalBUA,
          totalBudget: boqCalculation.grandTotal.toLocaleString(),
          currency: currencySymbol,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSubmittedRef(data.refId);
        setIsModalOpen(true);
        setLeadName('');
        setLeadPhone('');
        setLeadNotes('');
      } else {
        showToast('خطأ', data.error || 'حدث خطأ أثناء إرسال المقايسة.');
      }
    } catch {
      showToast('خطأ في الاتصال', 'تعذر إرسال الطلب، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Standalone SVG Builder for Brand Studio
  const buildStandaloneSvgMarkup = () => {
    let ringsStops = '';
    let pillarsStops = '';
    let phiTextColor = '#2c353d';
    let techTextColor = '#f07613';
    let subTextColor = '#524236';

    if (studioColorMode === 'print-light') {
      ringsStops = `
        <stop offset="0%" stop-color="#333e48" />
        <stop offset="55%" stop-color="#2c353d" />
        <stop offset="100%" stop-color="#1e252b" />
      `;
      pillarsStops = `
        <stop offset="0%" stop-color="#f97316" />
        <stop offset="55%" stop-color="#f07613" />
        <stop offset="100%" stop-color="#ea580c" />
      `;
      phiTextColor = '#2c353d';
      techTextColor = '#f07613';
      subTextColor = '#524236';
    } else if (studioColorMode === 'luxury-foil') {
      ringsStops = `
        <stop offset="0%" stop-color="#e2e8f0" />
        <stop offset="40%" stop-color="#94a3b8" />
        <stop offset="75%" stop-color="#475569" />
        <stop offset="100%" stop-color="#1e293b" />
      `;
      pillarsStops = `
        <stop offset="0%" stop-color="#fde68a" />
        <stop offset="35%" stop-color="#fb923c" />
        <stop offset="70%" stop-color="#ea580c" />
        <stop offset="100%" stop-color="#9a3412" />
      `;
      phiTextColor = '#e2e8f0';
      techTextColor = '#f59e0b';
      subTextColor = '#94a3b8';
    } else if (studioColorMode === 'mono') {
      const isDark = studioBgSurface === 'dark' || studioBgSurface === 'transparent';
      const monoHex = isDark ? '#ffffff' : '#1e252b';
      ringsStops = `<stop offset="0%" stop-color="${monoHex}" /><stop offset="100%" stop-color="${monoHex}" />`;
      pillarsStops = `<stop offset="0%" stop-color="${monoHex}" /><stop offset="100%" stop-color="${monoHex}" />`;
      phiTextColor = monoHex;
      techTextColor = monoHex;
      subTextColor = monoHex;
    } else {
      ringsStops = `
        <stop offset="0%" stop-color="#64748b" />
        <stop offset="45%" stop-color="#3b4654" />
        <stop offset="100%" stop-color="#252d38" />
      `;
      pillarsStops = `
        <stop offset="0%" stop-color="#fb923c" />
        <stop offset="50%" stop-color="#f97316" />
        <stop offset="100%" stop-color="#ea580c" />
      `;
      phiTextColor = '#ede5da';
      techTextColor = '#f97316';
      subTextColor = '#b8aea2';
    }

    if (studioLockup === 'mark') {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${logoGeometry.tightViewBox}" width="100%" height="100%">
        <defs>
          <linearGradient id="expRings" x1="0%" y1="0%" x2="100%" y2="100%">${ringsStops}</linearGradient>
          <linearGradient id="expPillars" x1="0%" y1="0%" x2="0%" y2="100%">${pillarsStops}</linearGradient>
        </defs>
        <path fill-rule="evenodd" d="${logoGeometry.ringsPath}" fill="url(#expRings)" />
        <path fill-rule="evenodd" d="${logoGeometry.pillarsPath}" fill="url(#expPillars)" />
      </svg>`;
    }

    if (studioLockup === 'horizontal') {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 940 380" width="100%" height="100%">
        <defs>
          <linearGradient id="expRings" x1="0%" y1="0%" x2="100%" y2="100%">${ringsStops}</linearGradient>
          <linearGradient id="expPillars" x1="0%" y1="0%" x2="0%" y2="100%">${pillarsStops}</linearGradient>
        </defs>
        <g transform="translate(5, -5) scale(0.76)">
          <path fill-rule="evenodd" d="${logoGeometry.ringsPath}" fill="url(#expRings)" />
          <path fill-rule="evenodd" d="${logoGeometry.pillarsPath}" fill="url(#expPillars)" />
        </g>
        <text x="375" y="175" font-family="'Cairo', sans-serif" font-size="60" font-weight="900" fill="${techTextColor}">
          فاي تك <tspan font-family="'JetBrains Mono', monospace" font-size="50" font-weight="900" fill="${phiTextColor}">PhiTech</tspan>
        </text>
        <text x="378" y="225" font-family="'Cairo', sans-serif" font-size="18" font-weight="700" fill="${subTextColor}" letter-spacing="1">
          مقاولات عامة • تشطيبات فاخرة • تكييف مخفي وMEP (الرياض | مصر)
        </text>
      </svg>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 10 600 585" width="100%" height="100%">
      <defs>
        <linearGradient id="expRings" x1="0%" y1="0%" x2="100%" y2="100%">${ringsStops}</linearGradient>
        <linearGradient id="expPillars" x1="0%" y1="0%" x2="0%" y2="100%">${pillarsStops}</linearGradient>
      </defs>
      <g transform="translate(50, -5)">
        <path fill-rule="evenodd" d="${logoGeometry.ringsPath}" fill="url(#expRings)" />
        <path fill-rule="evenodd" d="${logoGeometry.pillarsPath}" fill="url(#expPillars)" />
      </g>
      <text x="300" y="515" text-anchor="middle" font-family="'Cairo', sans-serif" font-size="52" font-weight="900" fill="${techTextColor}">
        فاي تك
      </text>
      <text x="300" y="550" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="28" font-weight="800" fill="${phiTextColor}">
        PhiTech
      </text>
      <text x="300" y="580" text-anchor="middle" font-family="'Cairo', sans-serif" font-size="15" font-weight="700" fill="${subTextColor}">
        للمقاولات العامة والتشطيبات الفاخرة
      </text>
    </svg>`;
  };

  const exportSvg = () => {
    const svgStr = buildStandaloneSvgMarkup();
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PHITECH-${studioLockup}-${studioColorMode}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('تم تحميل ملف الفيكتور (SVG)', 'ملف الشعار المتجهي لفاي تك جاهز للمطابع بدقة غير محدودة.');
  };

  const exportPng = () => {
    const svgStr = buildStandaloneSvgMarkup();
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const width = studioLockup === 'horizontal' ? 2400 : 2048;
      const height = studioLockup === 'horizontal' ? 900 : 2048;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);

        canvas.toBlob((blob) => {
          if (!blob) return;
          const pngUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = `PHITECH-${studioLockup}-${studioColorMode}-2048px.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(pngUrl);
          showToast('تم تحميل صورة PNG شفافة فائقة الدقة', `تم تصدير شعار فاي تك بخلفية شفافة بدقة ${width}×${height} بكسل.`);
        }, 'image/png');
      }
    };
    img.src = url;
  };

  const applyProportionPreset = (preset: 'full-bleed' | 'ultra-bold' | 'classic') => {
    const presets = {
      'full-bleed': { rOut: 192, thickness: 52, verticalExt: 22 },
      'ultra-bold': { rOut: 202, thickness: 60, verticalExt: 14 },
      'classic': { rOut: 176, thickness: 46, verticalExt: 36 }
    };
    setProportions(presets[preset]);
    showToast('تم ضبط نسب الشعار الهندسية', 'أصبح الشعار ممتلئاً ومتناسقاً وفق النسبة الذهبية.');
  };

  return (
    <div
      data-theme={themeMode}
      data-accent={accent}
      className="phi-construct-website min-h-screen transition-colors duration-300"
      style={{
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        fontFamily: "var(--font-main, 'Cairo', sans-serif)",
        direction: 'rtl'
      }}
    >
      {/* GLOBAL SVG MASTER DEFINITIONS */}
      <svg width="0" height="0" className="hidden" aria-hidden="true">
        <defs>
          <linearGradient id="phiRingsWebDark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#64748b" />
            <stop offset="45%" stop-color="#3b4654" />
            <stop offset="100%" stop-color="#252d38" />
          </linearGradient>
          <linearGradient id="phiPillarsWebDark" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#fb923c" />
            <stop offset="50%" stop-color="#f97316" />
            <stop offset="100%" stop-color="#ea580c" />
          </linearGradient>

          <linearGradient id="phiRingsPrint" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#333e48" />
            <stop offset="55%" stop-color="#2c353d" />
            <stop offset="100%" stop-color="#1e252b" />
          </linearGradient>
          <linearGradient id="phiPillarsPrint" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#f97316" />
            <stop offset="55%" stop-color="#f07613" />
            <stop offset="100%" stop-color="#ea580c" />
          </linearGradient>

          <linearGradient id="phiRingsFoil" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#e2e8f0" />
            <stop offset="35%" stop-color="#94a3b8" />
            <stop offset="65%" stop-color="#475569" />
            <stop offset="100%" stop-color="#1e293b" />
          </linearGradient>
          <linearGradient id="phiPillarsFoil" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#fde68a" />
            <stop offset="35%" stop-color="#fb923c" />
            <stop offset="70%" stop-color="#ea580c" />
            <stop offset="100%" stop-color="#9a3412" />
          </linearGradient>

          <path id="phi-master-rings" fillRule="evenodd" d={logoGeometry.ringsPath} />
          <path id="phi-master-pillars" fillRule="evenodd" d={logoGeometry.pillarsPath} />
        </defs>
      </svg>

      {/* STYLESHEET OVERRIDES FOR BORDERLESS OBSIDIAN AMBER GLOSS */}
      <style jsx global>{`
        :root {
          --font-main: 'Cairo', system-ui, -apple-system, sans-serif;
          --font-mono: 'JetBrains Mono', monospace;
          --accent-main: #f97316;
          --accent-bright: #fb923c;
          --accent-deep: #ea580c;
          --accent-soft-bg: rgba(249, 115, 22, 0.13);
          --accent-glow: rgba(249, 115, 22, 0.35);
          --accent-gradient: linear-gradient(180deg, #fb923c 0%, #f97316 55%, #d9460f 100%);
          --action-fill: var(--accent-gradient);
          --action-ink: #ffffff;
          --radius-lg: 26px;
          --radius-md: 19px;
          --radius-sm: 13px;
          --radius-pill: 100px;
        }

        .phi-construct-website[data-accent="amber"] {
          --accent-main: #f97316;
          --accent-bright: #fb923c;
          --accent-deep: #ea580c;
          --accent-soft-bg: rgba(249, 115, 22, 0.13);
          --accent-glow: rgba(249, 115, 22, 0.35);
          --accent-gradient: linear-gradient(180deg, #fb923c 0%, #f97316 55%, #d9460f 100%);
          --action-fill: var(--accent-gradient);
        }

        .phi-construct-website[data-accent="emerald"] {
          --accent-main: #10b981;
          --accent-bright: #34d399;
          --accent-deep: #047857;
          --accent-soft-bg: rgba(16, 185, 129, 0.14);
          --accent-glow: rgba(16, 185, 129, 0.35);
          --accent-gradient: linear-gradient(180deg, #34d399 0%, #10b981 55%, #047857 100%);
          --action-fill: var(--accent-gradient);
        }

        .phi-construct-website[data-accent="cyan"] {
          --accent-main: #0ea5e9;
          --accent-bright: #38bdf8;
          --accent-deep: #0369a1;
          --accent-soft-bg: rgba(14, 165, 233, 0.14);
          --accent-glow: rgba(14, 165, 233, 0.35);
          --accent-gradient: linear-gradient(180deg, #38bdf8 0%, #0ea5e9 55%, #0369a1 100%);
          --action-fill: var(--accent-gradient);
        }

        .phi-construct-website[data-theme="dark"] {
          color-scheme: dark;
          --bg-canvas: #0c0907;
          --bg-canvas-secondary: #100c09;
          --text-primary: #ffffff;
          --text-secondary: #ede5da;
          --text-muted: #d4c7b8;
          --surface-card: linear-gradient(180deg, #181512 0%, #120f0d 52%, #0b0908 100%);
          --surface-card-hover: linear-gradient(180deg, #221d18 0%, #171310 52%, #0e0c0a 100%);
          --surface-header: linear-gradient(135deg, #191613 0%, #120f0d 55%, #090807 100%);
          --surface-sidebar: linear-gradient(180deg, #161310 0%, #100e0b 60%, #090807 100%);
          --surface-subcard: linear-gradient(180deg, rgba(249, 115, 22, 0.07) 0%, rgba(20, 16, 13, 0.92) 100%);
          --surface-sunken: #090807;
          --specular-beam: linear-gradient(90deg, transparent 0%, rgba(254, 215, 170, 0.38) 50%, transparent 100%);
          --gloss-sheen: linear-gradient(180deg, rgba(254, 243, 199, 0.06) 0%, rgba(255, 255, 255, 0.015) 38%, rgba(0, 0, 0, 0.35) 100%);
          --shadow-ambient: 0 26px 54px -15px rgba(0, 0, 0, 0.9), 0 12px 32px -10px rgba(249, 115, 22, 0.12);
          --shadow-elevation: 0 24px 48px -14px rgba(0, 0, 0, 0.88), 0 8px 20px -6px rgba(0, 0, 0, 0.65);
          --shadow-sunken: inset 0 2px 6px rgba(0, 0, 0, 0.92), inset 0 -1px 1px rgba(249, 115, 22, 0.06);
          --status-pos-ink: #6ee7b7;
          --status-info-ink: #7dd3fc;
        }

        .phi-construct-website[data-theme="light"] {
          color-scheme: light;
          --bg-canvas: #f7eee2;
          --bg-canvas-secondary: #efe0ce;
          --text-primary: #000000;
          --text-secondary: #201913;
          --text-muted: #524236;
          --surface-card: linear-gradient(180deg, #fffdf8 0%, #fff8ed 58%, #f9efdf 100%);
          --surface-card-hover: linear-gradient(180deg, #fffdf8 0%, #fff8ee 65%, #fff0db 100%);
          --surface-header: linear-gradient(135deg, #fffdf8 0%, #fff7ec 55%, #f8ebd8 100%);
          --surface-subcard: linear-gradient(180deg, rgba(249, 115, 22, 0.08) 0%, rgba(255, 248, 237, 0.95) 100%);
          --surface-sunken: #fff5e7;
          --specular-beam: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 1) 50%, transparent 100%);
          --gloss-sheen: linear-gradient(180deg, rgba(255, 255, 255, 0.65) 0%, rgba(255, 255, 255, 0.1) 45%, rgba(106, 66, 36, 0.04) 100%);
          --shadow-ambient: 0 22px 46px -12px rgba(15, 23, 42, 0.085), 0 10px 26px -8px rgba(249, 115, 22, 0.09);
          --shadow-elevation: 0 20px 42px -12px rgba(60, 35, 15, 0.12), 0 8px 18px -6px rgba(60, 35, 15, 0.07);
          --shadow-sunken: inset 0 2px 5px rgba(106, 66, 36, 0.11), inset 0 -1px 0 rgba(255, 253, 248, 0.9);
          --status-pos-ink: #047857;
          --status-info-ink: #0369a1;
        }

        .phi-construct-website *, .phi-construct-website *::before, .phi-construct-website *::after {
          border: none !important;
          box-sizing: border-box;
        }

        .phi-construct-website .glossy-card {
          position: relative;
          background: var(--surface-card);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-ambient);
          overflow: hidden;
          transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s ease, background 0.3s ease;
          isolation: isolate;
        }
        .phi-construct-website .glossy-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background: var(--gloss-sheen);
          pointer-events: none;
          z-index: 0;
        }
        .phi-construct-website .glossy-card > * {
          position: relative;
          z-index: 1;
        }
        .phi-construct-website .glossy-card-interactive:hover {
          transform: translateY(-4px);
          background: var(--surface-card-hover);
          box-shadow: var(--shadow-elevation), 0 14px 34px -10px var(--accent-glow);
        }

        .phi-construct-website .subcard-glass {
          position: relative;
          background: var(--surface-subcard);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-elevation);
          overflow: hidden;
          transition: transform 0.25s ease, background 0.25s ease;
        }

        .phi-construct-website .specular-beam {
          position: absolute;
          top: 0;
          left: 8%;
          right: 8%;
          height: 1.5px;
          background: var(--specular-beam);
          pointer-events: none;
          z-index: 5;
        }

        .phi-construct-website .sunken-input {
          width: 100%;
          padding: 0.85rem 1.15rem;
          border-radius: var(--radius-sm);
          background: var(--surface-sunken);
          color: var(--text-primary);
          box-shadow: var(--shadow-sunken);
          outline: none !important;
          font-family: var(--font-main);
          font-size: 0.95rem;
          transition: box-shadow 0.25s ease, transform 0.2s ease;
        }
        .phi-construct-website .sunken-input:focus {
          box-shadow: var(--shadow-sunken), 0 0 0 2px var(--accent-glow);
        }

        .phi-construct-website .sunken-well-box {
          background: var(--surface-sunken);
          box-shadow: var(--shadow-sunken);
          border-radius: var(--radius-md);
        }

        .phi-construct-website .btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          padding: 0.85rem 1.75rem;
          border-radius: var(--radius-sm);
          background: var(--action-fill);
          color: var(--action-ink);
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 10px 26px -4px var(--accent-glow);
          transition: filter 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
          text-decoration: none;
          position: relative;
          overflow: hidden;
        }
        .phi-construct-website .btn-primary:hover {
          filter: brightness(1.09);
          transform: translateY(-2px);
          box-shadow: 0 14px 32px -4px var(--accent-glow);
        }

        .phi-construct-website .btn-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          padding: 0.85rem 1.5rem;
          border-radius: var(--radius-sm);
          background: var(--surface-subcard);
          color: var(--text-primary);
          font-weight: 700;
          cursor: pointer;
          box-shadow: var(--shadow-elevation);
          transition: transform 0.2s ease, background 0.2s ease;
          position: relative;
          overflow: hidden;
        }
        .phi-construct-website .btn-secondary:hover {
          transform: translateY(-2px);
          background: var(--surface-card-hover);
        }

        .phi-construct-website .badge-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.35rem 0.9rem;
          border-radius: var(--radius-pill);
          font-size: 0.8rem;
          font-weight: 700;
        }
        .phi-construct-website .badge-accent {
          background: var(--accent-soft-bg);
          color: var(--accent-bright);
        }

        .phi-construct-website .header-surface {
          background: var(--surface-header);
          box-shadow: var(--shadow-elevation);
        }

        .phi-construct-website .phi-metallic-text {
          background: linear-gradient(90deg, #9ca3af 0%, #e5e7eb 30%, #fdba74 65%, #f97316 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .phi-construct-website input[type="range"].sunken-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 12px;
          border-radius: var(--radius-pill);
          background: var(--surface-sunken);
          box-shadow: var(--shadow-sunken);
          outline: none;
          cursor: pointer;
        }
        .phi-construct-website input[type="range"].sunken-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--action-fill);
          box-shadow: 0 4px 14px var(--accent-glow);
          cursor: pointer;
          transition: transform 0.15s ease;
        }

        .phi-construct-website .preview-surface-dark {
          background: radial-gradient(circle at 50% 35%, #1d1814 0%, #100d0b 60%, #080605 100%);
          box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.9);
        }
        .phi-construct-website .preview-surface-paper {
          background: #ffffff;
          background-image: radial-gradient(circle at 50% 30%, #ffffff 0%, #f8f6f2 100%);
          box-shadow: inset 0 2px 6px rgba(15, 23, 42, 0.08);
        }
        .phi-construct-website .preview-surface-ceramic {
          background: radial-gradient(circle at 50% 35%, #fffdf9 0%, #f7eee2 65%, #eadbc8 100%);
          box-shadow: inset 0 2px 6px rgba(106, 66, 36, 0.12);
        }
        .phi-construct-website .preview-surface-transparent {
          background-color: #161310;
          background-image: 
            linear-gradient(45deg, #221d19 25%, transparent 25%), 
            linear-gradient(-45deg, #221d19 25%, transparent 25%), 
            linear-gradient(45deg, transparent 75%, #221d19 75%), 
            linear-gradient(-45deg, transparent 75%, #221d19 75%);
          background-size: 24px 24px;
          background-position: 0 0, 0 12px, 12px -12px, -12px 0px;
          box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.85);
        }

        .phi-construct-website .scope-toggle-active {
          background: var(--surface-subcard);
          box-shadow: var(--shadow-elevation), 0 0 0 2px var(--accent-glow);
        }

        @keyframes dataFlow {
          0% { stroke-dashoffset: 40; }
          100% { stroke-dashoffset: 0; }
        }
        .mep-duct-stream {
          stroke-dasharray: 6 6;
          animation: dataFlow 1.6s linear infinite;
        }

        @media print {
          body * {
            visibility: hidden;
          }
          #printable-a4-sheet, #printable-a4-sheet * {
            visibility: visible;
          }
          #printable-a4-sheet {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            padding: 24px !important;
          }
        }
      `}</style>

      {/* TOP INTEGRATION BANNER FOR SYSTEM EMPLOYEES & CLIENTS */}
      <div className="bg-amber-500/10 text-xs py-2 px-4 flex items-center justify-between border-b border-amber-500/20">
        <div className="flex items-center gap-2 max-w-7xl mx-auto w-full justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span style={{ color: 'var(--text-secondary)' }}>
              البوابة الرسمية لشركة <strong>فاي تك للمقاولات العامة والتشطيبات الفاخرة (PhiTech)</strong> — الرياض • القاهرة والمنصورة
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link
                href="/Dashboard"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-extrabold btn-primary"
              >
                <i className="fa-solid fa-desktop"></i>
                <span>لوحة تحكم النظام (ERP)</span>
              </Link>
            ) : (
              <div className="flex items-center gap-1.5">
                <Link
                  href="/login?portal=staff&redirect=/Dashboard"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold subcard-glass hover:text-amber-400 transition-colors"
                  title="بوابة دخول الكادر الهندسي والوظيفي"
                >
                  <i className="fa-solid fa-helmet-safety text-amber-500"></i>
                  <span>بوابة الموظفين والمهندسين</span>
                </Link>
                <span className="text-slate-600 text-xs">|</span>
                <Link
                  href="/login?portal=partner&redirect=/PartnerBalances"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold subcard-glass hover:text-amber-300 transition-colors text-amber-400"
                  title="بوابة دخول الشركاء والملاك"
                >
                  <i className="fa-solid fa-crown text-amber-400"></i>
                  <span>بوابة الملاك والشركاء</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STICKY BORDERLESS HEADER */}
      <header className="sticky top-0 z-50 header-surface px-4 sm:px-8 py-3.5 transition-all duration-300">
        <div className="specular-beam"></div>
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          
          {/* Brand Logo: Official Master Emblem & Typography */}
          <a href="#hero" className="flex items-center gap-3.5 group focus:outline-none">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl sunken-well-box p-1.5 flex items-center justify-center relative overflow-hidden bg-slate-900/70 border border-amber-500/25 shadow-[0_0_20px_rgba(249,115,22,0.2)]">
              <img
                src="/phitech-emblem.png"
                alt="شعار فاي تك الرسمي"
                className="w-11 h-11 sm:w-12 sm:h-12 object-contain transition-transform duration-300 group-hover:scale-110 drop-shadow-[0_2px_10px_rgba(249,115,22,0.45)]"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-black tracking-wider text-amber-500 font-sans">فاي تك</span>
                <span className="text-sm sm:text-base font-black tracking-wider phi-metallic-text font-mono">PhiTech</span>
                <span className="badge-pill badge-accent text-[10px] hidden sm:inline-flex font-mono">GENERAL CONTRACTING</span>
              </div>
              <p className="text-[11px] sm:text-xs font-bold tracking-wide" style={{ color: 'var(--text-muted)' }}>
                مقاولات عامة • تشطيبات فاخرة • تكييف مخفي وكهروميكانيك MEP
              </p>
            </div>
          </a>

          {/* Navigation Links */}
          <nav className="hidden xl:flex items-center gap-1 sunken-well-box p-1.5">
            <a href="#hero" className="px-3 py-2 rounded-xl text-sm font-bold transition-all" style={{ color: 'var(--text-primary)' }}>الرئيسية</a>
            <a href="#superhero-room" className="px-3 py-2 rounded-xl text-sm font-bold transition-all" style={{ color: 'var(--accent-bright)' }}>غرفة سوبر هيرو 3D</a>
            <a href="#three-pillars" className="px-3 py-2 rounded-xl text-sm font-bold transition-all" style={{ color: 'var(--text-secondary)' }}>القطاعات التنفيذية</a>
            <a href="#boq-catalog" className="px-3 py-2 rounded-xl text-sm font-bold transition-all" style={{ color: 'var(--text-secondary)' }}>دليل بنود المقايسة</a>
            <a href="#xray-twin" className="px-3 py-2 rounded-xl text-sm font-bold transition-all" style={{ color: 'var(--text-secondary)' }}>محاكي البناء 3D</a>
            <a href="#turnkey-calculator" className="px-3 py-2 rounded-xl text-sm font-bold transition-all" style={{ color: 'var(--text-secondary)' }}>حاسبة المقايسة</a>
            <a href="#portfolio" className="px-3 py-2 rounded-xl text-sm font-bold transition-all" style={{ color: 'var(--text-secondary)' }}>مشاريعنا الميدانية</a>
            <a href="#brand-identity" className="px-3 py-2 rounded-xl text-sm font-bold transition-all" style={{ color: 'var(--text-secondary)' }}>استوديو الهوية</a>
          </nav>

          {/* Controls: Sector Accent Dots + Theme Switcher + Dual Login + CTA */}
          <div className="flex items-center gap-2.5">
            <div className="sunken-well-box px-2.5 py-1.5 flex items-center gap-2" title="اختر اللكنة اللونية حسب القطاع">
              <span className="text-[11px] font-bold hidden md:inline" style={{ color: 'var(--text-muted)' }}>القطاع:</span>
              <button
                onClick={() => handleSetAccent('amber')}
                className={`w-5 h-5 rounded-full transition-transform ${accent === 'amber' ? 'scale-125' : 'opacity-60 hover:opacity-100'}`}
                style={{ background: 'linear-gradient(180deg, #fb923c 0%, #f97316 55%, #d9460f 100%)', boxShadow: accent === 'amber' ? '0 0 10px rgba(249,115,22,0.8)' : 'none' }}
                title="البناء الإنشائي والعظم (Signature Amber)"
              />
              <button
                onClick={() => handleSetAccent('emerald')}
                className={`w-5 h-5 rounded-full transition-transform ${accent === 'emerald' ? 'scale-125' : 'opacity-60 hover:opacity-100'}`}
                style={{ background: 'linear-gradient(180deg, #34d399 0%, #10b981 55%, #047857 100%)', boxShadow: accent === 'emerald' ? '0 0 10px rgba(16,185,129,0.8)' : 'none' }}
                title="التشطيبات المعمارية الفاخرة (Architectural Emerald)"
              />
              <button
                onClick={() => handleSetAccent('cyan')}
                className={`w-5 h-5 rounded-full transition-transform ${accent === 'cyan' ? 'scale-125' : 'opacity-60 hover:opacity-100'}`}
                style={{ background: 'linear-gradient(180deg, #38bdf8 0%, #0ea5e9 55%, #0369a1 100%)', boxShadow: accent === 'cyan' ? '0 0 10px rgba(14,165,233,0.8)' : 'none' }}
                title="الكهروميكانيك والتكييف المخفي (MEP Cyan)"
              />
            </div>

            <button
              onClick={toggleTheme}
              className="sunken-well-box px-3.5 py-2 text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition-transform hover:scale-105"
            >
              <i className={`fa-solid ${themeMode === 'dark' ? 'fa-moon text-amber-400' : 'fa-sun text-amber-500'}`}></i>
              <span className="hidden sm:inline">{themeMode === 'dark' ? 'أوبسيديان داكن' : 'لؤلؤي نهاري'}</span>
            </button>

            {/* Unified Login Portal Trigger (الموظفين والملاك) */}
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="sunken-well-box px-3.5 py-2 text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer transition-all hover:scale-105 border border-amber-500/30 text-amber-400 hover:text-amber-300 shadow-[0_0_15px_rgba(249,115,22,0.18)]"
              style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(15,23,42,0.7))' }}
              title="بوابة تسجيل الدخول الموحدة للموظفين والمهندسين والملاك"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <i className="fa-solid fa-shield-halved text-amber-400"></i>
              <span className="font-bold">تسجيل الدخول</span>
              <span className="badge-pill bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.5 hidden lg:inline font-mono">موظفين • ملاك</span>
            </button>

            <a href="#order-section" className="btn-primary text-xs sm:text-sm py-2.5 px-4 sm:px-5">
              <i className="fa-solid fa-file-signature"></i>
              <span>اطلب مقايسة ومعاينة</span>
            </a>
          </div>

        </div>
      </header>

      {/* HERO SECTION */}
      <section id="hero" className="relative overflow-hidden pt-10 pb-20 sm:py-20 px-4 sm:px-8">
        <HeroVideoBackdrop variant="full" tone={themeMode} controlsMode="corner" />
        <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          {/* Right Column: Strategic Pitch tailored to the user's real business */}
          <div className="lg:col-span-7 space-y-6 text-right">
            <div className="inline-flex flex-wrap items-center gap-2.5 subcard-glass px-4 py-2">
              <div className="specular-beam"></div>
              <span className="w-2.5 h-2.5 rounded-full animate-ping" style={{ background: 'var(--accent-main)' }}></span>
              <span className="text-xs sm:text-sm font-bold" style={{ color: 'var(--accent-bright)' }}>
                فاي تك للمقاولات العامة والتشطيبات الفاخرة — المملكة العربية السعودية ومصر
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl xl:text-6xl font-black leading-snug">
              نبني <span style={{ color: '#fb923c' }}>الهيكل الإنشائي (العظم)</span>، نُبدع <span style={{ color: '#34d399' }}>التشطيب المعماري الفاخر</span>، ونُنفّذ <span style={{ color: '#38bdf8' }}>الكهروميكانيك والتكييف المخفي</span>.
            </h1>

            <p className="text-base sm:text-lg leading-relaxed max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
              في <strong className="phi-metallic-text font-mono">PhiTech</strong> نضع بين يديك منظومة مقاولات متكاملة 3×1 بإشراف هندسي معتمد. نتسلم أرض مشروعك لننفذ <strong style={{ color: '#fb923c' }}>أعمال العظم والأساسات والخرسانات (فلات سلاب، هوردي، لبشة مسلحة)</strong>، ونحولها إلى تحفة معمارية بـ <strong style={{ color: '#34d399' }}>اللياسة بالليزر، الأسقف الجبسية، تكسيات الرخام الميكانيكية، ودهانات جوتين</strong>، مع تأسيس احترافي لـ <strong style={{ color: '#38bdf8' }}>شبكات التكييف المخفي الكونسيلد VRF والسباكة والكهرباء</strong> تحت مسؤولية هندسية موحدة بدون أي تكسير.
            </p>

            {/* Quick Interactive Sector Selector Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <button
                onClick={() => { handleSetAccent('amber'); selectPresetScope('structural'); }}
                className="glossy-card glossy-card-interactive p-3.5 text-right flex items-center gap-3 cursor-pointer"
              >
                <div className="specular-beam"></div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(249,115,22,0.15)', color: '#fb923c' }}>
                  <i className="fa-solid fa-trowel-bricks text-lg"></i>
                </div>
                <div>
                  <div className="text-xs font-black">1. البناء الإنشائي (عظم)</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>لبشة، أعمدة، فلات وهوردي</div>
                </div>
              </button>

              <button
                onClick={() => { handleSetAccent('emerald'); selectPresetScope('architectural'); }}
                className="glossy-card glossy-card-interactive p-3.5 text-right flex items-center gap-3 cursor-pointer"
              >
                <div className="specular-beam"></div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                  <i className="fa-solid fa-compass-drafting text-lg"></i>
                </div>
                <div>
                  <div className="text-xs font-black">2. التشطيبات المعمارية</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>لياسة ليزر، جبس كناوف، ورخام</div>
                </div>
              </button>

              <button
                onClick={() => { handleSetAccent('cyan'); selectPresetScope('mep'); }}
                className="glossy-card glossy-card-interactive p-3.5 text-right flex items-center gap-3 cursor-pointer"
              >
                <div className="specular-beam"></div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8' }}>
                  <i className="fa-solid fa-fan text-lg"></i>
                </div>
                <div>
                  <div className="text-xs font-black">3. الكهروميكانيك MEP</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>تكييف مخفي، سباكة، وماجنتيك</div>
                </div>
              </button>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a href="#turnkey-calculator" className="btn-primary text-base px-7 py-4">
                <i className="fa-solid fa-calculator"></i>
                <span>احسب تكلفة مشروعك (عظم + تشطيب + MEP)</span>
              </a>
              <a href="#superhero-room" className="btn-secondary text-base px-6 py-4">
                <div className="specular-beam"></div>
                <i className="fa-solid fa-cube" style={{ color: 'var(--accent-main)' }}></i>
                <span>استكشف غرفة سوبر هيرو 3D</span>
              </a>
              <a href="#boq-catalog" className="btn-secondary text-base px-6 py-4">
                <div className="specular-beam"></div>
                <i className="fa-solid fa-list-check" style={{ color: 'var(--accent-main)' }}></i>
                <span>استكشف بنود المقايسة المعتمدة (275+ بند)</span>
              </a>
            </div>

            {/* Key Trust Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-3">
              <div className="glossy-card p-4">
                <div className="specular-beam"></div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono" style={{ color: 'var(--accent-bright)' }}>+275</div>
                <div className="text-xs font-bold mt-1" style={{ color: 'var(--text-muted)' }}>بند مقايسة ومواصفة معتمدة</div>
              </div>
              <div className="glossy-card p-4">
                <div className="specular-beam"></div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono" style={{ color: 'var(--status-pos-ink)' }}>3×1</div>
                <div className="text-xs font-bold mt-1" style={{ color: 'var(--text-muted)' }}>تسليم مفتاح ومسؤولية موحدة</div>
              </div>
              <div className="glossy-card p-4">
                <div className="specular-beam"></div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono" style={{ color: 'var(--status-info-ink)' }}>100%</div>
                <div className="text-xs font-bold mt-1" style={{ color: 'var(--text-muted)' }}>استلامات ليزر ومكعبات خرسانة</div>
              </div>
              <div className="glossy-card p-4">
                <div className="specular-beam"></div>
                <div className="text-xl sm:text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>الرياض • مصر</div>
                <div className="text-xs font-bold mt-1" style={{ color: 'var(--text-muted)' }}>إشراف ومواقع تنفيذ نشطة</div>
              </div>
            </div>
          </div>

          {/* Left Column: Official Master Emblem & Logo */}
          <div className="lg:col-span-5">
            <div className="glossy-card p-5 sm:p-6 relative">
              <div className="specular-beam"></div>

              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <span className="badge-pill badge-accent font-mono text-xs">
                  <i className="fa-solid fa-certificate"></i>
                  الهوية الهندسية المعتمدة
                </span>
                <div className="sunken-well-box p-1 flex items-center gap-1 text-[11px] font-bold">
                  <button
                    onClick={() => setHeroLogoVariant('official-master')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] ${heroLogoVariant === 'official-master' ? 'btn-primary' : 'text-slate-400'}`}
                  >
                    الشعار الرسمي
                  </button>
                  <button
                    onClick={() => setHeroLogoVariant('print-light')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] ${heroLogoVariant === 'print-light' ? 'btn-primary' : 'text-slate-400'}`}
                  >
                    المطبوعات
                  </button>
                  <button
                    onClick={() => setHeroLogoVariant('web-dark')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] ${heroLogoVariant === 'web-dark' ? 'btn-primary' : 'text-slate-400'}`}
                  >
                    الويب الليلي
                  </button>
                  <button
                    onClick={() => setHeroLogoVariant('luxury-foil')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] ${heroLogoVariant === 'luxury-foil' ? 'btn-primary' : 'text-slate-400'}`}
                  >
                    معدني فاخر
                  </button>
                </div>
              </div>

              {/* Emblem Stage */}
              <div
                className={`rounded-3xl p-5 sm:p-6 flex flex-col items-center justify-center relative transition-all duration-500 min-h-[390px] ${
                  heroLogoVariant === 'print-light' ? 'preview-surface-paper' : 'preview-surface-dark'
                }`}
              >
                <div className="specular-beam"></div>

                {heroLogoVariant === 'official-master' ? (
                  <div className="w-full flex flex-col items-center justify-center text-center p-2">
                    <div className="relative group max-w-[260px] sm:max-w-[280px] mx-auto rounded-2xl overflow-hidden shadow-2xl border border-amber-500/25 bg-slate-900/60 p-2">
                      <img
                        src="/phitech-logo.jpg"
                        alt="الشعار الرسمي المعتمد لشركة فاي تك"
                        className="w-full h-auto rounded-xl transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>

                    <div className="mt-3.5 space-y-1">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-2xl font-black text-amber-500 font-sans">فاي تك</span>
                        <span className="text-lg font-black text-white font-mono">PhiTech</span>
                      </div>
                      <p className="text-[11px] font-bold text-slate-300">
                        الهوية البصرية الرسمية لشركة فاي تك للمقاولات العامة والتشطيبات الفاخرة
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <a
                        href="/phitech-logo.jpg"
                        download="phitech-official-logo.jpg"
                        className="badge-pill badge-accent cursor-pointer hover:scale-105 transition-transform"
                        style={{ background: 'rgba(249,115,22,0.2)', color: '#fb923c' }}
                      >
                        <i className="fa-solid fa-download"></i>
                        <span>تحميل الأصل (JPG)</span>
                      </a>
                      <a
                        href="/phitech-logo-transparent.png"
                        download="phitech-logo-transparent.png"
                        className="badge-pill badge-info cursor-pointer hover:scale-105 transition-transform"
                        style={{ background: 'rgba(14,165,233,0.18)', color: '#38bdf8' }}
                      >
                        <i className="fa-solid fa-file-image"></i>
                        <span>مفرغ شفاف (PNG)</span>
                      </a>
                      <a
                        href="/phitech-emblem.png"
                        download="phitech-emblem.png"
                        className="badge-pill subcard-glass cursor-pointer hover:scale-105 transition-transform text-white text-[11px]"
                      >
                        <i className="fa-solid fa-shapes"></i>
                        <span>الأيقونة فقط (Emblem)</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-full flex items-center justify-center">
                      <svg viewBox={logoGeometry.tightViewBox} className="w-64 sm:w-72 h-auto mx-auto transition-all duration-300" role="img" aria-label="شعار فاي تك">
                        <use
                          href="#phi-master-rings"
                          fill={
                            heroLogoVariant === 'print-light'
                              ? 'url(#phiRingsPrint)'
                              : heroLogoVariant === 'luxury-foil'
                              ? 'url(#phiRingsFoil)'
                              : 'url(#phiRingsWebDark)'
                          }
                        />
                        <use
                          href="#phi-master-pillars"
                          fill={
                            heroLogoVariant === 'print-light'
                              ? 'url(#phiPillarsPrint)'
                              : heroLogoVariant === 'luxury-foil'
                              ? 'url(#phiPillarsFoil)'
                              : 'url(#phiPillarsWebDark)'
                          }
                        />
                      </svg>
                    </div>

                    <div className="mt-2 text-center space-y-0.5">
                      <div className="font-sans text-2xl sm:text-3xl font-black">
                        <span style={{ color: heroLogoVariant === 'print-light' ? '#f07613' : '#f97316' }}>فاي تك </span>
                        <span className="font-mono text-xl" style={{ color: heroLogoVariant === 'print-light' ? '#2c353d' : '#ede5da' }}>PhiTech</span>
                      </div>
                      <div className="text-[10px] sm:text-[11px] font-bold" style={{ color: heroLogoVariant === 'print-light' ? '#524236' : '#b8aea2' }}>
                        مقاولات عامة • تشطيبات فاخرة • تكييف مخفي وMEP
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <button onClick={exportSvg} className="badge-pill badge-accent cursor-pointer hover:scale-105 transition-transform" style={{ background: 'rgba(249,115,22,0.18)', color: '#ea580c' }}>
                        <i className="fa-solid fa-download"></i>
                        <span>تحميل SVG بالنسب الممتلئة</span>
                      </button>
                      <button onClick={exportPng} className="badge-pill badge-info cursor-pointer hover:scale-105 transition-transform" style={{ background: 'rgba(14,165,233,0.16)', color: '#0284c7' }}>
                        <i className="fa-solid fa-file-image"></i>
                        <span>تحميل PNG شفاف (2048px)</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Calibration Stats */}
              <div className="grid grid-cols-3 gap-2.5 mt-4 text-right">
                <div className="subcard-glass p-3">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold" style={{ color: '#fb923c' }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#f97316' }}></span>
                    <span>الأعمدة الوسطى</span>
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>عنبري ناصع <span className="font-mono">#F97316</span></div>
                </div>
                <div className="subcard-glass p-3">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold" style={{ color: '#94a3b8' }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#2c353d' }}></span>
                    <span>الحلقة الدائرية</span>
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>فحمي داكن <span className="font-mono">#2C353D</span></div>
                </div>
                <div className="subcard-glass p-3">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold" style={{ color: '#34d399' }}>
                    <i className="fa-solid fa-maximize"></i>
                    <span>امتلاء الكادر</span>
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>يشغل <span className="font-mono">95%</span> من مساحته</div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* SECTION 1.5: SUPERHERO 3D ROOM SHOWCASE */}
      <section id="superhero-room" className="py-12 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <SuperheroRoom3D />
        </div>
      </section>

      {/* SECTION 2: THE 3 CORE SECTORS */}
      <section id="three-pillars" className="py-16 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
            <span className="badge-pill badge-accent text-xs sm:text-sm">
              <i className="fa-solid fa-cubes-stacked"></i>
              القطاعات التنفيذية الثلاثة لشركة فاي تك
            </span>
            <h2 className="text-2xl sm:text-4xl font-black">
              منظومة مقاولات وتشطيبات شاملة: <span style={{ color: '#fb923c' }}>عظم إنشائي</span> + <span style={{ color: '#34d399' }}>تشطيبات فاخرة</span> + <span style={{ color: '#38bdf8' }}>تكييف وMEP</span>
            </h2>
            <p className="text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
              قوتنا تكمن في ضبط التنسيق الميداني المسبق بين الأعمال الإنشائية وأعمال اللياسة والجبس والتكييف والسباكة، مما يقضي على التعارضات الموقعية ويوفر الجهد والمال للمالك.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-7 items-stretch">
            {/* PILLAR 1: STRUCTURAL */}
            <div className="glossy-card glossy-card-interactive p-6 sm:p-7 flex flex-col justify-between">
              <div className="specular-beam"></div>
              <div>
                <div className="flex items-center justify-between mb-5">
                  <span className="badge-pill badge-accent font-mono text-xs">01 / STRUCTURAL & SKELETON</span>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl" style={{ background: 'rgba(249,115,22,0.15)', color: '#fb923c' }}>
                    <i className="fa-solid fa-helmet-safety"></i>
                  </div>
                </div>
                <h3 className="text-2xl font-black mb-2">قطاع البناء الإنشائي والعظم</h3>
                <p className="text-xs sm:text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
                  ننفذ الهياكل الخرسانية المسلحة للفلل السكنية، العمائر، والأبراج وفق الكود السعودي والمصري مع استلامات المحاور بالليزر والتوتال ستيشن واختبارات كسر المكعبات.
                </p>

                <div className="sunken-well-box p-4 space-y-3 text-xs sm:text-sm">
                  <div className="font-extrabold text-xs" style={{ color: '#fb923c' }}>بنود الأعمال الإنشائية والعظم:</div>
                  <ul className="space-y-2.5" style={{ color: 'var(--text-secondary)' }}>
                    <li className="flex items-start gap-2.5">
                      <i className="fa-solid fa-check mt-1" style={{ color: '#fb923c' }}></i>
                      <span><strong>الحفر والأساسات واللبشة:</strong> أبحاث التربة والخوازيق، إحلال مدموك، فرشة نظافة عادية، ولبشة مسلحة وقواعد منفصلة وسملات معزولة.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <i className="fa-solid fa-check mt-1" style={{ color: '#fb923c' }}></i>
                      <span><strong>الهيكل الخرساني والأسقف:</strong> أعمدة، كوابيل، أسقف Flat Slab، أسقف هوردي Ribbed Slab، وكمر مقلوب فوق اللبشة لضبط المناسيب.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <i className="fa-solid fa-check mt-1" style={{ color: '#fb923c' }}></i>
                      <span><strong>المباني والعزل المائي والحراري:</strong> طوب أسمنتي مصمت وطوب أحمر، عزل بيتومين للميد، وعزل فوم وممبرين للأسطح.</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 pt-4 flex items-center justify-between">
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>حديد B500D واختبارات كسر معتمدة</span>
                <button onClick={() => selectPresetScope('structural')} className="btn-primary text-xs py-2.5 px-4">
                  <span>سعّر أعمال العظم</span>
                  <i className="fa-solid fa-arrow-left"></i>
                </button>
              </div>
            </div>

            {/* PILLAR 2: ARCHITECTURAL */}
            <div className="glossy-card glossy-card-interactive p-6 sm:p-7 flex flex-col justify-between">
              <div className="specular-beam"></div>
              <div>
                <div className="flex items-center justify-between mb-5">
                  <span className="badge-pill font-mono text-xs" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>02 / ARCHITECTURAL & FINISHING</span>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                    <i className="fa-solid fa-ruler-combined"></i>
                  </div>
                </div>
                <h3 className="text-2xl font-black mb-2">قطاع التشطيبات المعمارية الفاخرة</h3>
                <p className="text-xs sm:text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
                  نحول المساحات الصماء إلى بيئة سكنية ومعمارية ملكية، بمواصفات دقيقة في استواء اللياسة بالمساطر، والأسقف المعلقة، وتكسيات الرخام والواجهات.
                </p>

                <div className="sunken-well-box p-4 space-y-3 text-xs sm:text-sm">
                  <div className="font-extrabold text-xs" style={{ color: '#34d399' }}>بنود التشطيبات المعمارية:</div>
                  <ul className="space-y-2.5" style={{ color: 'var(--text-secondary)' }}>
                    <li className="flex items-start gap-2.5">
                      <i className="fa-solid fa-check mt-1 text-emerald-400"></i>
                      <span><strong>لياسة المساطر والليزر:</strong> بؤج وأوتار، تأكيس وتربيع للزوايا 90°، طرطشة مسمارية وشبك فايبر ضد التمدد والتنميل.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <i className="fa-solid fa-check mt-1 text-emerald-400"></i>
                      <span><strong>الأسقف المعلقة والجبس:</strong> ألواح كناوف أصلية دراي اريا، سمنت بورد ويت اريا وفلاش تانك، بيوت نور وشادو جاب، وفتحات صيانة Access Panels.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <i className="fa-solid fa-check mt-1 text-emerald-400"></i>
                      <span><strong>الرخام والبورسلان والدهانات:</strong> تكسيات رخام ميكانيكي بستيل 304، بورسلان لارج فورمات بالكلبسات، دهانات جوتين، وبروفايل واجهات سافيتو.</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 pt-4 flex items-center justify-between">
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>ضمان استواء السطح التام</span>
                <button onClick={() => selectPresetScope('architectural')} className="btn-secondary text-xs py-2.5 px-4">
                  <div className="specular-beam"></div>
                  <span style={{ color: '#34d399' }}>سعّر التشطيبات الفاخرة</span>
                  <i className="fa-solid fa-arrow-left text-emerald-400"></i>
                </button>
              </div>
            </div>

            {/* PILLAR 3: MEP & HVAC */}
            <div className="glossy-card glossy-card-interactive p-6 sm:p-7 flex flex-col justify-between">
              <div className="specular-beam"></div>
              <div>
                <div className="flex items-center justify-between mb-5">
                  <span className="badge-pill font-mono text-xs" style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8' }}>03 / MEP & CONCEALED HVAC</span>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl" style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8' }}>
                    <i className="fa-solid fa-fan"></i>
                  </div>
                </div>
                <h3 className="text-2xl font-black mb-2">قطاع الكهروميكانيك والتكييف المخفي</h3>
                <p className="text-xs sm:text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
                  تأسيس شبكات التكييف المخفي والسباكة والكهرباء بهندسة دقيقة تضمن كفاءة التبريد وتوفير استهلاك الطاقة والتشغيل الصامت بدون أي تكسير.
                </p>

                <div className="sunken-well-box p-4 space-y-3 text-xs sm:text-sm">
                  <div className="font-extrabold text-xs" style={{ color: '#38bdf8' }}>بنود الكهروميكانيك والتكييف:</div>
                  <ul className="space-y-2.5" style={{ color: 'var(--text-secondary)' }}>
                    <li className="flex items-start gap-2.5">
                      <i className="fa-solid fa-check mt-1 text-sky-400"></i>
                      <span><strong>التكييف المخفي والكونسيلد:</strong> تفصيل دكت صاج مجلفن معزول بصوف زجاجي، مواسير نحاس جنوب إفريقي، وجريلات خطية طولية (Linear Diffusers).</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <i className="fa-solid fa-check mt-1 text-sky-400"></i>
                      <span><strong>السباكة والتغذية والصرف:</strong> شبكات بولي بروبلين حرارية PEX/PPR معتمدة تحت ضغط 16 بار، شاسيهات كراسي دفن جدارية، وصرف صامت معلق.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <i className="fa-solid fa-check mt-1 text-sky-400"></i>
                      <span><strong>الكهرباء والإنارة الحديثة:</strong> كابلات نحاس سويدي، مسارات ماجنتيك تراك مدمجة بالجبس، لوحات وقواطع شنايدر، وتأسيس سمارت هوم.</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 pt-4 flex items-center justify-between">
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>أعلى كفاءة تبريد وهدوء تشغيلي</span>
                <button onClick={() => selectPresetScope('mep')} className="btn-secondary text-xs py-2.5 px-4">
                  <div className="specular-beam"></div>
                  <span style={{ color: '#38bdf8' }}>سعّر التكييف والـ MEP</span>
                  <i className="fa-solid fa-arrow-left text-sky-400"></i>
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SECTION 3: LIVE BOQ SCOPE EXPLORER (بنود المقايسة المعتمدة) */}
      <section id="boq-catalog" className="py-16 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div className="space-y-3">
              <span className="badge-pill badge-accent text-xs sm:text-sm">
                <i className="fa-solid fa-list-check"></i>
                دليل بنود المقايسة والمواصفات الفنية المعتمدة في السيستم
              </span>
              <h2 className="text-2xl sm:text-4xl font-black">
                استعرض بنود المقايسة الحقيقية لشركة <span className="text-amber-500 font-sans">فاي تك</span>
              </h2>
              <p className="text-xs sm:text-sm max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
                أكثر من 275 بند مقايسة مدرج ومُسعّر في نظامنا لإدارة المشاريع، نلتزم بتنفيذها بأعلى معايير الأمان والاستلامات الميدانية الرسمية.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 sunken-well-box p-1.5">
              {[
                { id: 'all', label: 'الكل (275+)' },
                { id: 'structural', label: 'الخرسانات والعظم' },
                { id: 'plaster', label: 'اللياسة والمحارة' },
                { id: 'ceilings', label: 'الأسقف والجبس بورد' },
                { id: 'marble', label: 'الرخام والبورسلان' },
                { id: 'paint', label: 'الدهانات والواجهات' },
                { id: 'mep', label: 'التكييف وMEP' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setBoqFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs transition-all ${boqFilter === tab.id ? 'btn-primary font-extrabold' : 'font-bold'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredBoqItems.map((item) => (
              <div key={item.code} className="glossy-card glossy-card-interactive p-5 flex flex-col justify-between">
                <div className="specular-beam"></div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="badge-pill font-mono text-[11px] font-black px-2.5 py-0.5" style={{ background: 'rgba(249,115,22,0.18)', color: '#fb923c' }}>
                      {item.code}
                    </span>
                    <span className="text-xs font-bold" style={{ color: item.accentColor }}>
                      {item.categoryLabel}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-black mb-2 text-white">
                    {item.name}
                  </h3>

                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    {item.specs}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">وحدة القياس: <strong className="text-amber-400">{item.unit}</strong></span>
                  <span className="badge-pill bg-emerald-500/15 text-emerald-300 text-[10px] font-sans">
                    <i className="fa-solid fa-check-double text-[9px]"></i>
                    مواصفة معتمدة
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <a href="#turnkey-calculator" className="inline-flex items-center gap-2 btn-primary text-xs sm:text-sm py-3 px-6">
              <i className="fa-solid fa-calculator"></i>
              <span>احسب تكلفة هذه البنود في مشروعك الخاص</span>
            </a>
          </div>
        </div>
      </section>

      {/* SECTION 4: 4-LAYER REAL BUILDING X-RAY SIMULATOR */}
      <section id="xray-twin" className="py-14 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-10 space-y-3">
            <span className="badge-pill badge-accent text-xs sm:text-sm">
              <i className="fa-solid fa-eye"></i>
              محاكي طبقات البناء والتشطيب (4-Layer Construction Simulator)
            </span>
            <h2 className="text-2xl sm:text-4xl font-black">
              شاهد كيف ندمج <span style={{ color: '#fb923c' }}>العظم</span> و<span style={{ color: '#38bdf8' }}>التكييف والـ MEP</span> و<span style={{ color: '#34d399' }}>التشطيب المعماري</span>
            </h2>
            <p className="text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
              اضغط على أي طبقة هندسية أدناه لمعاينة التأسيسات التي تنفذها فرق <strong>فاي تك (PhiTech)</strong> في الموقع لضمان التوافق المطلق بدون أي أخطاء أو تكسير.
            </p>
          </div>

          <div className="glossy-card p-5 sm:p-8">
            <div className="specular-beam"></div>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-7">
              <div className="flex flex-wrap items-center gap-2 sunken-well-box p-2 w-full lg:w-auto">
                <button
                  onClick={() => setActiveLayer('all')}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold ${activeLayer === 'all' ? 'btn-primary' : 'subcard-glass'}`}
                >
                  <i className="fa-solid fa-layer-group"></i>
                  <span>التكامل الكامل (تسليم مفتاح)</span>
                </button>
                <button
                  onClick={() => setActiveLayer('structural')}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold ${activeLayer === 'structural' ? 'btn-primary' : 'subcard-glass'}`}
                >
                  <i className="fa-solid fa-cubes" style={{ color: '#fb923c' }}></i>
                  <span>1. الهيكل الإنشائي (العظم)</span>
                </button>
                <button
                  onClick={() => setActiveLayer('mep')}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold ${activeLayer === 'mep' ? 'btn-primary' : 'subcard-glass'}`}
                >
                  <i className="fa-solid fa-fan" style={{ color: '#38bdf8' }}></i>
                  <span>2. التكييف المخفي والـ MEP</span>
                </button>
                <button
                  onClick={() => setActiveLayer('plaster')}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold ${activeLayer === 'plaster' ? 'btn-primary' : 'subcard-glass'}`}
                >
                  <i className="fa-solid fa-ruler-combined" style={{ color: '#34d399' }}></i>
                  <span>3. اللياسة والأسقف المعلقة</span>
                </button>
                <button
                  onClick={() => setActiveLayer('finishing')}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold ${activeLayer === 'finishing' ? 'btn-primary' : 'subcard-glass'}`}
                >
                  <i className="fa-solid fa-gem" style={{ color: '#fb923c' }}></i>
                  <span>4. الفنش والرخام والدهانات</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="badge-pill font-mono text-xs" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>SHOP DRAWINGS 100%</span>
                <span className="badge-pill font-mono text-xs" style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8' }}>ZERO CLASH DETECTION</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-center">
              {/* SVG Cross-Section */}
              <div className="lg:col-span-7 sunken-well-box p-4 sm:p-6 rounded-3xl relative overflow-hidden">
                <svg viewBox="0 0 700 440" className="w-full h-auto" aria-label="مخطط طبقات البناء لفاي تك">
                  <g stroke="rgba(255,255,255,0.04)" strokeWidth="1">
                    <line x1="0" y1="80" x2="700" y2="80" />
                    <line x1="0" y1="160" x2="700" y2="160" />
                    <line x1="0" y1="240" x2="700" y2="240" />
                    <line x1="0" y1="320" x2="700" y2="320" />
                    <line x1="0" y1="390" x2="700" y2="390" />
                  </g>

                  {/* LAYER 1: STRUCTURAL SKELETON */}
                  <g opacity={activeLayer === 'all' || activeLayer === 'structural' ? 1 : 0.12} className="transition-opacity duration-300">
                    {/* Raft & Mud Slab */}
                    <rect x="95" y="365" width="510" height="28" rx="4" fill="rgba(249, 115, 22, 0.35)" stroke="#f97316" strokeWidth="2" />
                    <rect x="130" y="393" width="18" height="38" fill="#ea580c" opacity="0.8" />
                    <rect x="250" y="393" width="18" height="38" fill="#ea580c" opacity="0.8" />
                    <rect x="340" y="393" width="22" height="38" fill="#ea580c" opacity="0.9" />
                    <rect x="430" y="393" width="18" height="38" fill="#ea580c" opacity="0.8" />
                    <rect x="550" y="393" width="18" height="38" fill="#ea580c" opacity="0.8" />

                    {/* Columns */}
                    <rect x="130" y="75" width="16" height="290" fill="#fb923c" opacity="0.85" />
                    <rect x="255" y="75" width="16" height="290" fill="#fb923c" opacity="0.85" />
                    <rect x="336" y="60" width="28" height="305" fill="rgba(249,115,22,0.45)" stroke="#fb923c" strokeWidth="2" />
                    <rect x="430" y="75" width="16" height="290" fill="#fb923c" opacity="0.85" />
                    <rect x="554" y="75" width="16" height="290" fill="#fb923c" opacity="0.85" />

                    {/* Slabs (Flat & Ribbed) */}
                    <rect x="115" y="270" width="470" height="12" rx="2" fill="#f97316" />
                    <rect x="115" y="175" width="470" height="12" rx="2" fill="#f97316" />
                    <rect x="110" y="75" width="480" height="14" rx="3" fill="#fb923c" />
                    <text x="350" y="383" textAnchor="middle" fill="#fed7aa" fontSize="10" fontWeight="800" fontFamily="Cairo">اللبشة المسلحة المعزولة (Raft Foundation)</text>
                  </g>

                  {/* LAYER 2: MEP & CONCEALED HVAC */}
                  <g opacity={activeLayer === 'all' || activeLayer === 'mep' ? 1 : 0.12} className="transition-opacity duration-300">
                    {/* Concealed Ducts */}
                    <rect x="170" y="93" width="360" height="18" rx="3" fill="rgba(14, 165, 233, 0.3)" stroke="#38bdf8" strokeWidth="1.5" />
                    <rect x="170" y="190" width="360" height="18" rx="3" fill="rgba(14, 165, 233, 0.3)" stroke="#38bdf8" strokeWidth="1.5" />
                    <rect x="170" y="285" width="360" height="18" rx="3" fill="rgba(14, 165, 233, 0.3)" stroke="#38bdf8" strokeWidth="1.5" />

                    {/* Linear Diffusers & Risers */}
                    <path d="M 350 93 L 350 285 M 220 111 L 220 135 M 480 111 L 480 135 M 220 208 L 220 230 M 480 208 L 480 230" stroke="#38bdf8" strokeWidth="2.5" fill="none" className="mep-duct-stream" />
                    <circle cx="220" cy="135" r="5" fill="#0ea5e9" />
                    <circle cx="480" cy="135" r="5" fill="#0ea5e9" />
                    <circle cx="220" cy="230" r="5" fill="#0ea5e9" />
                    <circle cx="480" cy="230" r="5" fill="#0ea5e9" />
                    <text x="350" y="106" textAnchor="middle" fill="#bae6fd" fontSize="9" fontWeight="800" fontFamily="Cairo">دكتات تكييف مخفي كونسيلد (Concealed HVAC)</text>
                  </g>

                  {/* LAYER 3: PLASTERING & SUSPENDED CEILINGS */}
                  <g opacity={activeLayer === 'all' || activeLayer === 'plaster' ? 1 : 0.12} className="transition-opacity duration-300">
                    <line x1="148" y1="115" x2="550" y2="115" stroke="#34d399" strokeWidth="3" opacity="0.85" />
                    <line x1="148" y1="212" x2="550" y2="212" stroke="#34d399" strokeWidth="3" opacity="0.85" />
                    <line x1="148" y1="306" x2="550" y2="306" stroke="#34d399" strokeWidth="3" opacity="0.85" />

                    {/* Plaster Verticals */}
                    <line x1="150" y1="115" x2="150" y2="175" stroke="#10b981" strokeWidth="3" strokeDasharray="6 3" />
                    <line x1="546" y1="115" x2="546" y2="175" stroke="#10b981" strokeWidth="3" strokeDasharray="6 3" />
                    <line x1="150" y1="212" x2="150" y2="270" stroke="#10b981" strokeWidth="3" strokeDasharray="6 3" />
                    <line x1="546" y1="212" x2="546" y2="270" stroke="#10b981" strokeWidth="3" strokeDasharray="6 3" />
                    <text x="350" y="127" textAnchor="middle" fill="#6ee7b7" fontSize="9" fontWeight="800" fontFamily="Cairo">أسقف جبس بورد كناوف + لياسة مساطر ليزر</text>
                  </g>

                  {/* LAYER 4: FINISHING, MARBLE & FACADES */}
                  <g opacity={activeLayer === 'all' || activeLayer === 'finishing' ? 1 : 0.12} className="transition-opacity duration-300">
                    <rect x="122" y="89" width="456" height="276" rx="6" fill="rgba(249, 115, 22, 0.05)" stroke="#fb923c" strokeWidth="1.5" strokeDasharray="8 4" />
                    <path d="M 102 75 L 130 42 L 570 42 L 598 75 Z" fill="rgba(249, 115, 22, 0.22)" stroke="#f97316" strokeWidth="2" />
                    <rect x="165" y="215" width="75" height="55" rx="4" fill="rgba(251, 146, 60, 0.18)" stroke="#fb923c" strokeWidth="1.5" />
                    <rect x="460" y="120" width="80" height="55" rx="4" fill="rgba(251, 146, 60, 0.18)" stroke="#fb923c" strokeWidth="1.5" />
                    <text x="350" y="62" textAnchor="middle" fill="#fdba74" fontSize="10" fontWeight="900" fontFamily="Cairo">واجهات بروفايل سافيتو + رخام ميكانيكي</text>
                  </g>
                </svg>
              </div>

              {/* Specs Output */}
              <div className="lg:col-span-5 space-y-4">
                <span className="badge-pill badge-accent font-mono text-xs">{layerSpecs[activeLayer].badge}</span>
                <h3 className="text-xl sm:text-2xl font-black">{layerSpecs[activeLayer].title}</h3>
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {layerSpecs[activeLayer].desc}
                </p>
                <div className="space-y-2.5 pt-1">
                  {layerSpecs[activeLayer].items.map((item, i) => (
                    <div key={i} className="sunken-well-box p-3.5 rounded-2xl">
                      <div className="text-xs font-extrabold flex items-center gap-2" style={{ color: item.color }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: item.color }}></span>
                        <span>{item.label}</span>
                      </div>
                      <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{item.val}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: REAL TURNKEY COST & QUANTITIES ESTIMATOR */}
      <section id="turnkey-calculator" className="py-16 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="glossy-card p-6 sm:p-10">
            <div className="specular-beam"></div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Controls */}
              <div className="lg:col-span-7 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="badge-pill badge-accent text-xs">
                    <i className="fa-solid fa-calculator"></i>
                    حاسبة المقايسة والكميات الهندسية التقديرية (Instant BoQ Estimator)
                  </span>
                  <div className="sunken-well-box p-1 flex items-center gap-1 text-xs font-mono">
                    <button
                      onClick={() => { setCurrencySymbol('ر.س'); setCurrencyRate(1); }}
                      className={`px-3 py-1 rounded-lg font-bold ${currencySymbol === 'ر.س' ? 'btn-primary' : ''}`}
                    >
                      SAR ر.س (السعودية)
                    </button>
                    <button
                      onClick={() => { setCurrencySymbol('ج.م'); setCurrencyRate(12.8); }}
                      className={`px-3 py-1 rounded-lg font-bold ${currencySymbol === 'ج.م' ? 'btn-primary' : ''}`}
                    >
                      EGP ج.م (مصر)
                    </button>
                    <button
                      onClick={() => { setCurrencySymbol('$'); setCurrencyRate(0.27); }}
                      className={`px-3 py-1 rounded-lg font-bold ${currencySymbol === '$' ? 'btn-primary' : ''}`}
                    >
                      USD $
                    </button>
                  </div>
                </div>

                <h2 className="text-2xl sm:text-3xl font-black">
                  احسب تكلفة وكميات مشروعك: <span style={{ color: '#fb923c' }}>عظم</span> • <span style={{ color: '#34d399' }}>تشطيب</span> • <span style={{ color: '#38bdf8' }}>تكييف وMEP</span>
                </h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  حدد نوع المبنى والمساحة، واختر نطاق الأعمال المطلوب لتوليد تقدير فوري للتكلفة والكميات (حديد، خرسانة جاهزة، تكييف مخفي، ومدة التنفيذ).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>نوع المشروع الهندسي</label>
                    <select
                      value={projectType}
                      onChange={(e) => setProjectType(e.target.value as any)}
                      className="sunken-input cursor-pointer font-bold"
                    >
                      <option value="villa">فيلا سكنية خاصة / قصر فاخر</option>
                      <option value="tower">عمارة سكنية / برج تجاري وسكني</option>
                      <option value="commercial">مقر إداري / صالة عرض ومعرض تجاري</option>
                      <option value="duplex">شقة دوبلكس / بنتهاوس فاخر</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>مستوى المواصفات والتشطيب</label>
                    <select
                      value={specTier}
                      onChange={(e) => setSpecTier(parseFloat(e.target.value))}
                      className="sunken-input cursor-pointer font-bold"
                    >
                      <option value="1">قياسي هندسي معتمد (Standard Pro)</option>
                      <option value="1.35">فاخر تنفيذي (Executive Deluxe)</option>
                      <option value="1.75">فاي تك سيجنتشر ملوكي (Signature Φ VIP)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sunken-well-box p-4 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs sm:text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>مساحة المسطح للدور الواحد</label>
                      <span className="badge-pill badge-accent font-mono text-xs">{areaPerFloor} م²</span>
                    </div>
                    <input
                      type="range"
                      min="120"
                      max="2500"
                      step="20"
                      value={areaPerFloor}
                      onChange={(e) => setAreaPerFloor(parseInt(e.target.value, 10))}
                      className="sunken-slider"
                    />
                  </div>

                  <div className="sunken-well-box p-4 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs sm:text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>عدد الأدوار المطلوب تنفيذها</label>
                      <span className="badge-pill font-mono text-xs" style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8' }}>{floors} أدوار</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="14"
                      step="1"
                      value={floors}
                      onChange={(e) => setFloors(parseInt(e.target.value, 10))}
                      className="sunken-slider"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label className="block text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>نطاق الأعمال المطلوب تنفيذه:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => toggleScope('structural')}
                      className={`p-3.5 rounded-2xl text-right transition-all cursor-pointer ${activeScopes.structural ? 'scope-toggle-active' : 'sunken-well-box opacity-55'}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: 'rgba(249,115,22,0.2)', color: '#fb923c' }}>
                          <i className="fa-solid fa-trowel-bricks"></i>
                        </span>
                        <i className={`fa-solid fa-circle-check text-amber-400 ${activeScopes.structural ? 'opacity-100' : 'opacity-20'}`}></i>
                      </div>
                      <div className="font-extrabold text-xs sm:text-sm">1. الإنشاءات والعظم</div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>لبشة، خرسانات، وهيكل</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleScope('architectural')}
                      className={`p-3.5 rounded-2xl text-right transition-all cursor-pointer ${activeScopes.architectural ? 'scope-toggle-active' : 'sunken-well-box opacity-55'}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399' }}>
                          <i className="fa-solid fa-paint-roller"></i>
                        </span>
                        <i className={`fa-solid fa-circle-check text-emerald-400 ${activeScopes.architectural ? 'opacity-100' : 'opacity-20'}`}></i>
                      </div>
                      <div className="font-extrabold text-xs sm:text-sm">2. التشطيبات المعمارية</div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>لياسة ليزر، جبس، ورخام</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleScope('mep')}
                      className={`p-3.5 rounded-2xl text-right transition-all cursor-pointer ${activeScopes.mep ? 'scope-toggle-active' : 'sunken-well-box opacity-55'}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: 'rgba(14,165,233,0.2)', color: '#38bdf8' }}>
                          <i className="fa-solid fa-fan"></i>
                        </span>
                        <i className={`fa-solid fa-circle-check text-sky-400 ${activeScopes.mep ? 'opacity-100' : 'opacity-20'}`}></i>
                      </div>
                      <div className="font-extrabold text-xs sm:text-sm">3. الكهروميكانيك MEP</div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>تكييف مخفي وسباكة وكهرباء</div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Output Card */}
              <div className="lg:col-span-5">
                <div className="sunken-well-box p-6 sm:p-7 rounded-3xl space-y-5 relative overflow-hidden">
                  <div className="specular-beam"></div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>إجمالي المسطح البنائي (BUA):</span>
                    <span className="badge-pill badge-accent font-mono text-xs">{boqCalculation.totalBUA.toLocaleString()} م² إجمالي</span>
                  </div>

                  <div className="text-center py-2">
                    <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>الميزانية التقديرية الإجمالية للمشروع</span>
                    <div className="text-3xl sm:text-4xl font-black font-mono mt-1" style={{ color: 'var(--accent-bright)' }}>
                      <span>{boqCalculation.grandTotal.toLocaleString()} </span>
                      <span className="text-base font-bold">{currencySymbol}</span>
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                      {boqCalculation.allThreeActive
                        ? 'شامل خصم التكامل الهندسي (7%) لتسليم مفتاح متكامل 3×1'
                        : 'فعّل القطاعات الثلاثة معاً للاستفادة من خصم التكامل الهندسي (7%)'}
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="glossy-card p-3.5 flex items-center justify-between">
                      <span className="flex items-center gap-2 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#fb923c' }}></span>
                        <span>تكلفة الإنشاءات والعظم:</span>
                      </span>
                      <span className="font-mono font-extrabold">{boqCalculation.structCost.toLocaleString()} {currencySymbol}</span>
                    </div>

                    <div className="glossy-card p-3.5 flex items-center justify-between">
                      <span className="flex items-center gap-2 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#34d399' }}></span>
                        <span>تكلفة التشطيبات المعمارية:</span>
                      </span>
                      <span className="font-mono font-extrabold">{boqCalculation.archCost.toLocaleString()} {currencySymbol}</span>
                    </div>

                    <div className="glossy-card p-3.5 flex items-center justify-between">
                      <span className="flex items-center gap-2 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#38bdf8' }}></span>
                        <span>تكلفة التكييف المخفي والـ MEP:</span>
                      </span>
                      <span className="font-mono font-extrabold">{boqCalculation.mepCost.toLocaleString()} {currencySymbol}</span>
                    </div>
                  </div>

                  {/* Quantitative Engineering Breakdown */}
                  <div className="grid grid-cols-3 gap-2.5 text-center pt-1">
                    <div className="subcard-glass p-2.5">
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>خرسانة وحديد</div>
                      <div className="font-mono font-extrabold text-xs mt-0.5" style={{ color: '#fb923c' }}>
                        {boqCalculation.concreteCbm > 0 ? `~${boqCalculation.concreteCbm} م³` : '—'}
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono">
                        {boqCalculation.steelTons > 0 ? `${boqCalculation.steelTons} طن حديد` : ''}
                      </div>
                    </div>
                    <div className="subcard-glass p-2.5">
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>تكييف مخفي</div>
                      <div className="font-mono font-extrabold text-xs mt-0.5" style={{ color: '#38bdf8' }}>
                        {boqCalculation.hvacTons > 0 ? `~${boqCalculation.hvacTons} طن TR` : '—'}
                      </div>
                      <div className="text-[9px] text-slate-400">كونسيلد / VRF</div>
                    </div>
                    <div className="subcard-glass p-2.5">
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>مدة التنفيذ</div>
                      <div className="font-mono font-extrabold text-xs mt-0.5" style={{ color: '#34d399' }}>
                        {boqCalculation.months} أشهر
                      </div>
                      <div className="text-[9px] text-slate-400">جدول معتمد</div>
                    </div>
                  </div>

                  <button onClick={transferBoQToForm} className="btn-primary w-full py-4 text-sm sm:text-base">
                    <i className="fa-solid fa-file-export"></i>
                    <span>اعتماد المقايسة وطلب عرض سعر ومعاينة</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: REAL FIELD PROJECTS PORTFOLIO */}
      <section id="portfolio" className="py-16 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div className="space-y-3">
              <span className="badge-pill badge-accent text-xs sm:text-sm">
                <i className="fa-solid fa-award"></i>
                مشاريعنا الميدانية الموثقة من واقع العمل
              </span>
              <h2 className="text-2xl sm:text-4xl font-black">
                سابقة أعمال <span className="phi-metallic-text font-mono">PhiTech</span> على أرض الواقع
              </h2>
              <p className="text-xs sm:text-sm max-w-xl" style={{ color: 'var(--text-secondary)' }}>
                نماذج حقيقية لمشاريعنا في الرياض والقاهرة والمنصورة مع التفاصيل الإنشائية والمعمارية وفريق الإشراف الهندسي.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sunken-well-box p-1.5">
              {(['all', 'turnkey', 'structural', 'finishing', 'mep'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setPortfolioFilter(cat)}
                  className={`px-3.5 py-2 rounded-xl text-xs ${portfolioFilter === cat ? 'btn-primary font-extrabold' : 'font-bold'}`}
                >
                  {cat === 'all' && 'الكل'}
                  {cat === 'turnkey' && 'تسليم مفتاح متكامل'}
                  {cat === 'structural' && 'إنشاءات وعظم'}
                  {cat === 'finishing' && 'تشطيبات معمارية'}
                  {cat === 'mep' && 'كهروميكانيك وتكييف'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPortfolio.map((proj) => (
              <div key={proj.id} className="glossy-card glossy-card-interactive p-6 flex flex-col justify-between">
                <div className="specular-beam"></div>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="badge-pill badge-accent font-mono text-[11px]">{proj.id}</span>
                    <span className="text-xs font-bold" style={{ color: proj.accentColor }}>{proj.categoryLabel}</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black mb-2 text-white">{proj.title}</h3>

                  <div className="text-xs text-amber-400 font-bold mb-3 flex items-center gap-1.5">
                    <i className="fa-solid fa-location-dot"></i>
                    <span>{proj.location}</span>
                  </div>

                  <div className="sunken-well-box p-4 space-y-2.5 text-xs">
                    <div className="flex items-start gap-2">
                      <i className="fa-solid fa-trowel-bricks mt-0.5" style={{ color: '#fb923c' }}></i>
                      <span><strong>الإنشائي:</strong> {proj.structuralScope}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <i className="fa-solid fa-compass-drafting mt-0.5" style={{ color: '#34d399' }}></i>
                      <span><strong>المعماري:</strong> {proj.archScope}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <i className="fa-solid fa-fan mt-0.5" style={{ color: '#38bdf8' }}></i>
                      <span><strong>الـ MEP والتكييف:</strong> {proj.mepScope}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800 space-y-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <div className="flex items-center justify-between font-mono">
                    <span><i className="fa-solid fa-maximize ml-1"></i> المساحة: {proj.area}</span>
                    <span><i className="fa-regular fa-clock ml-1"></i> الحالة: {proj.duration}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    <i className="fa-solid fa-user-tie text-amber-500 ml-1"></i>
                    <span>الإشراف الهندسي: <strong>{proj.engineers}</strong></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 7: BRAND STUDIO & VECTOR LOGO */}
      <section id="brand-identity" className="py-16 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="badge-pill badge-accent text-xs sm:text-sm">
              <i className="fa-solid fa-sliders"></i>
              استوديو الهوية البصرية وضبط نسب الشعار (PhiTech Studio)
            </span>
            <h2 className="text-2xl sm:text-4xl font-black">
              شعار <span className="text-amber-500 font-sans">فاي تك</span> مضبوط النسب للويب والمطبوعات والمواقع
            </h2>
            <p className="text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
              أصل شعارك المعتمد (الأعمدة العنبرية + الحلقة الدائرية الفحمية) بنسب ممتلئة بدون هوامش ميتة وجاهزة للتصدير بدقة 2048px وفيكتور SVG للمطابع واللافتات.
            </p>
          </div>

          <div className="glossy-card p-6 sm:p-10">
            <div className="specular-beam"></div>

            {/* OFFICIAL ASSETS QUICK DOWNLOAD BANNER */}
            <div className="subcard-glass p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 border border-amber-500/25 mb-6" style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.1), rgba(15,23,42,0.6))' }}>
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-xl bg-slate-900/80 p-1 flex items-center justify-center border border-amber-500/30 shrink-0">
                  <img src="/phitech-emblem.png" alt="شعار فاي تك" className="w-11 h-11 object-contain drop-shadow" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-400 text-sm">حزمة ملفات الهوية المعتمدة لشركة فاي تك</span>
                    <span className="badge-pill badge-accent text-[10px]">الملفات الأصلية</span>
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    تحميل الشعار الأصلي (JPG) والمفرغ الشفاف عالي الدقة (PNG) ورمز الأيقونة للمطبوعات والويب.
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="/phitech-logo.jpg"
                  download="phitech-official-logo.jpg"
                  className="btn-primary text-xs py-2 px-3.5"
                >
                  <i className="fa-solid fa-download"></i>
                  <span>الأصل JPG</span>
                </a>
                <a
                  href="/phitech-logo-transparent.png"
                  download="phitech-logo-transparent.png"
                  className="btn-secondary text-xs py-2 px-3.5"
                >
                  <div className="specular-beam"></div>
                  <i className="fa-solid fa-file-image text-cyan-400"></i>
                  <span>مفرغ شفاف PNG</span>
                </a>
                <a
                  href="/phitech-emblem.png"
                  download="phitech-emblem.png"
                  className="btn-secondary text-xs py-2 px-3.5"
                >
                  <div className="specular-beam"></div>
                  <i className="fa-solid fa-shapes text-amber-400"></i>
                  <span>الأيقونة فقط Emblem</span>
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Studio Controls */}
              <div className="lg:col-span-5 space-y-5">
                <div className="sunken-well-box p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold" style={{ color: 'var(--accent-bright)' }}>
                      <i className="fa-solid fa-maximize ml-1"></i>
                      ضبط نسب وامتلاء الشعار (Live Proportions):
                    </span>
                    <button
                      type="button"
                      onClick={() => applyProportionPreset('full-bleed')}
                      className="badge-pill badge-accent text-[10px] cursor-pointer"
                    >
                      إعادة للنسبة الممتلئة
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyProportionPreset('full-bleed')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] ${proportions.rOut === 192 ? 'btn-primary font-extrabold' : 'subcard-glass font-bold'}`}
                    >
                      مالي مكانه (95%)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyProportionPreset('ultra-bold')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] ${proportions.rOut === 202 ? 'btn-primary font-extrabold' : 'subcard-glass font-bold'}`}
                    >
                      عريض للأيقونات
                    </button>
                    <button
                      type="button"
                      onClick={() => applyProportionPreset('classic')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] ${proportions.rOut === 176 ? 'btn-primary font-extrabold' : 'subcard-glass font-bold'}`}
                    >
                      كلاسيكي متوازن
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span style={{ color: 'var(--text-secondary)' }}>قطر الحلقة الدائرية:</span>
                      <span className="font-mono" style={{ color: 'var(--accent-bright)' }}>{proportions.rOut} px</span>
                    </div>
                    <input
                      type="range"
                      min="150"
                      max="210"
                      step="2"
                      value={proportions.rOut}
                      onChange={(e) => setProportions(p => ({ ...p, rOut: parseInt(e.target.value, 10) }))}
                      className="sunken-slider"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span style={{ color: 'var(--text-secondary)' }}>سماكة القوس الفحمي والأعمدة:</span>
                      <span className="font-mono" style={{ color: 'var(--accent-bright)' }}>{proportions.thickness} px</span>
                    </div>
                    <input
                      type="range"
                      min="36"
                      max="64"
                      step="2"
                      value={proportions.thickness}
                      onChange={(e) => setProportions(p => ({ ...p, thickness: parseInt(e.target.value, 10) }))}
                      className="sunken-slider"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span style={{ color: 'var(--text-secondary)' }}>طول بروز الأعمدة:</span>
                      <span className="font-mono" style={{ color: 'var(--accent-bright)' }}>{proportions.verticalExt} px</span>
                    </div>
                    <input
                      type="range"
                      min="12"
                      max="55"
                      step="1"
                      value={proportions.verticalExt}
                      onChange={(e) => setProportions(p => ({ ...p, verticalExt: parseInt(e.target.value, 10) }))}
                      className="sunken-slider"
                    />
                  </div>
                </div>

                {/* Lockup Selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-extrabold" style={{ color: 'var(--text-secondary)' }}>
                    1. اختر تكوين الشعار (Logo Lockup):
                  </label>
                  <div className="grid grid-cols-3 gap-2.5 sunken-well-box p-2">
                    {(['mark', 'stacked', 'horizontal'] as const).map((lk) => (
                      <button
                        key={lk}
                        type="button"
                        onClick={() => setStudioLockup(lk)}
                        className={`py-2.5 px-3 rounded-xl text-xs ${studioLockup === lk ? 'btn-primary font-extrabold' : 'font-bold'}`}
                      >
                        {lk === 'mark' && 'الرمز فقط Φ'}
                        {lk === 'stacked' && 'رأسي فاي تك'}
                        {lk === 'horizontal' && 'أفقي للهيدر'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Mode Selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-extrabold" style={{ color: 'var(--text-secondary)' }}>
                    2. اختر نظام الألوان:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => { setStudioColorMode('print-light'); setStudioBgSurface('paper'); }}
                      className={`p-3 rounded-2xl text-right cursor-pointer ${studioColorMode === 'print-light' ? 'scope-toggle-active' : 'sunken-well-box'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold">الألوان الأصلية للمطبوعات</span>
                        <div className="flex items-center gap-1">
                          <span className="w-3.5 h-3.5 rounded-full" style={{ background: '#2c353d' }}></span>
                          <span className="w-3.5 h-3.5 rounded-full" style={{ background: '#f07613' }}></span>
                        </div>
                      </div>
                      <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>حلقة #2C353D + أعمدة #F97316</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setStudioColorMode('web-dark'); setStudioBgSurface('dark'); }}
                      className={`p-3 rounded-2xl text-right cursor-pointer ${studioColorMode === 'web-dark' ? 'scope-toggle-active' : 'sunken-well-box'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold">نسخة الويب الليلي</span>
                        <div className="flex items-center gap-1">
                          <span className="w-3.5 h-3.5 rounded-full" style={{ background: '#64748b' }}></span>
                          <span className="w-3.5 h-3.5 rounded-full" style={{ background: '#fb923c' }}></span>
                        </div>
                      </div>
                      <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>تيتانيوم + عنبري جلوسي</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setStudioColorMode('luxury-foil'); setStudioBgSurface('dark'); }}
                      className={`p-3 rounded-2xl text-right cursor-pointer ${studioColorMode === 'luxury-foil' ? 'scope-toggle-active' : 'sunken-well-box'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold">بصمة معدنية (Foil / UV)</span>
                        <div className="flex items-center gap-1">
                          <span className="w-3.5 h-3.5 rounded-full" style={{ background: '#94a3b8' }}></span>
                          <span className="w-3.5 h-3.5 rounded-full" style={{ background: '#f59e0b' }}></span>
                        </div>
                      </div>
                      <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>فولاذ مصقول + ذهب عنبري</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStudioColorMode('mono')}
                      className={`p-3 rounded-2xl text-right cursor-pointer ${studioColorMode === 'mono' ? 'scope-toggle-active' : 'sunken-well-box'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold">أحادي للأختام والليزر</span>
                        <div className="flex items-center gap-1">
                          <span className="w-3.5 h-3.5 rounded-full" style={{ background: '#1e252b' }}></span>
                          <span className="w-3.5 h-3.5 rounded-full" style={{ background: '#ffffff' }}></span>
                        </div>
                      </div>
                      <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>لون صريح للحفر والختم</div>
                    </button>
                  </div>
                </div>

                {/* Surface Selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-extrabold" style={{ color: 'var(--text-secondary)' }}>
                    3. خلفية المعاينة:
                  </label>
                  <div className="grid grid-cols-4 gap-2 sunken-well-box p-2">
                    {(['paper', 'dark', 'ceramic', 'transparent'] as const).map((bg) => (
                      <button
                        key={bg}
                        type="button"
                        onClick={() => setStudioBgSurface(bg)}
                        className={`py-2 px-2 rounded-xl text-[11px] ${studioBgSurface === bg ? 'btn-primary font-extrabold' : 'font-bold'}`}
                      >
                        {bg === 'paper' && 'ورق أبيض'}
                        {bg === 'dark' && 'أوبسيديان'}
                        {bg === 'ceramic' && 'لؤلؤي نهاري'}
                        {bg === 'transparent' && 'شفاف'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Download Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button type="button" onClick={exportSvg} className="btn-primary py-3.5 px-4 text-xs sm:text-sm">
                    <i className="fa-solid fa-bezier-curve"></i>
                    <span>تحميل فيكتور للمطابع (SVG)</span>
                  </button>
                  <button type="button" onClick={exportPng} className="btn-secondary py-3.5 px-4 text-xs sm:text-sm">
                    <div className="specular-beam"></div>
                    <i className="fa-solid fa-download" style={{ color: 'var(--accent-main)' }}></i>
                    <span>تحميل PNG شفاف (2048px)</span>
                  </button>
                </div>
              </div>

              {/* Live Preview & Mockups */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* SVG Live Render */}
                <div
                  className={`rounded-3xl p-6 sm:p-8 min-h-[360px] flex flex-col items-center justify-center relative transition-all duration-300 ${
                    studioBgSurface === 'paper'
                      ? 'preview-surface-paper'
                      : studioBgSurface === 'ceramic'
                      ? 'preview-surface-ceramic'
                      : studioBgSurface === 'transparent'
                      ? 'preview-surface-transparent'
                      : 'preview-surface-dark'
                  }`}
                >
                  <div className="specular-beam"></div>
                  <div className="w-full flex items-center justify-between mb-2 pointer-events-none">
                    <span className="badge-pill badge-accent font-mono text-[11px]" style={{ background: 'rgba(249,115,22,0.16)', color: '#ea580c' }}>
                      {studioColorMode === 'print-light' && 'ORIGINAL & PRINT — #2C353D + #F97316'}
                      {studioColorMode === 'web-dark' && 'WEB DARK — TITANIUM & AMBER GLOSS'}
                      {studioColorMode === 'luxury-foil' && 'LUXURY FOIL — STEEL & GOLD'}
                      {studioColorMode === 'mono' && 'MONOCHROME — 1-COLOR STAMP'}
                    </span>
                    <span className="badge-pill font-mono text-[11px]" style={{ background: 'rgba(14,165,233,0.16)', color: '#0284c7' }}>
                      FULL-BLEED 95% FILL
                    </span>
                  </div>

                  <div
                    className={`w-full ${studioLockup === 'horizontal' ? 'max-w-xl' : studioLockup === 'mark' ? 'max-w-[270px]' : 'max-w-xs'} mx-auto transition-all duration-300 my-2`}
                    dangerouslySetInnerHTML={{ __html: buildStandaloneSvgMarkup() }}
                  />
                </div>

                {/* Print Mockups Tabs */}
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 sunken-well-box p-1.5">
                      <button
                        type="button"
                        onClick={() => setStudioMockupTab('cards')}
                        className={`px-3.5 py-2 rounded-xl text-xs ${studioMockupTab === 'cards' ? 'btn-primary font-extrabold' : 'font-bold'}`}
                      >
                        <i className="fa-solid fa-id-card ml-1"></i> الكارت الشخصي (Business Card)
                      </button>
                      <button
                        type="button"
                        onClick={() => setStudioMockupTab('letterhead')}
                        className={`px-3.5 py-2 rounded-xl text-xs ${studioMockupTab === 'letterhead' ? 'btn-primary font-extrabold' : 'font-bold'}`}
                      >
                        <i className="fa-solid fa-file-contract ml-1"></i> ورق العقود والمراسلات (A4)
                      </button>
                      <button
                        type="button"
                        onClick={() => setStudioMockupTab('stamp')}
                        className={`px-3.5 py-2 rounded-xl text-xs ${studioMockupTab === 'stamp' ? 'btn-primary font-extrabold' : 'font-bold'}`}
                      >
                        <i className="fa-solid fa-stamp ml-1"></i> ختم فاي تك الرسمي
                      </button>
                    </div>

                    <button type="button" onClick={() => window.print()} className="btn-secondary text-xs py-2 px-3.5">
                      <div className="specular-beam"></div>
                      <i className="fa-solid fa-print" style={{ color: 'var(--accent-main)' }}></i>
                      <span>طباعة نموذج المطبوعات</span>
                    </button>
                  </div>

                  {/* Mockup 1: Business Card */}
                  {studioMockupTab === 'cards' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Front */}
                      <div
                        className="rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[215px]"
                        style={{ background: 'linear-gradient(135deg, #1a1613 0%, #100d0b 58%, #080605 100%)', boxShadow: '0 20px 40px rgba(0,0,0,0.65)' }}
                      >
                        <div className="specular-beam"></div>
                        <div className="absolute bottom-0 right-0 left-0 h-1.5" style={{ background: 'linear-gradient(90deg, #fb923c, #f97316, #ea580c)' }}></div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-stone-400">
                          <span>FRONT SIDE • SPOT UV</span>
                          <span style={{ color: '#fb923c' }}>PHITECH CONTRACTING</span>
                        </div>
                        <div className="my-3 flex flex-col items-center text-center">
                          <svg viewBox={logoGeometry.tightViewBox} className="w-20 h-20">
                            <use href="#phi-master-rings" fill="url(#phiRingsWebDark)" />
                            <use href="#phi-master-pillars" fill="url(#phiPillarsWebDark)" />
                          </svg>
                          <div className="font-sans font-black text-lg tracking-wider mt-1.5 text-amber-500">
                            فاي تك <span className="font-mono text-sm text-white">PhiTech</span>
                          </div>
                          <div className="text-[9px] font-bold tracking-wider mt-0.5 text-stone-300">
                            مقاولات عامة • تشطيبات فاخرة • تكييف مخفي وMEP
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-stone-400">
                          <span>الرياض (المملكة) • القاهرة والمنصورة (مصر)</span>
                          <span className="font-mono text-amber-500 font-bold">Φ 1.618</span>
                        </div>
                      </div>

                      {/* Back */}
                      <div
                        className="rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[215px]"
                        style={{ background: 'linear-gradient(180deg, #ffffff 0%, #faf5ed 100%)', color: '#14100d', boxShadow: '0 20px 40px rgba(0,0,0,0.45)' }}
                      >
                        <div className="absolute top-0 right-0 bottom-0 w-2" style={{ background: 'linear-gradient(180deg, #2c353d 0%, #2c353d 50%, #f97316 50%, #ea580c 100%)' }}></div>
                        <div className="flex items-start justify-between pr-3">
                          <div>
                            <div className="font-black text-sm" style={{ color: '#14100d' }}>الإدارة العامة والمكتب الفني</div>
                            <div className="text-[11px] font-bold" style={{ color: '#ea580c' }}>فاي تك للمقاولات العامة والتشطيبات</div>
                          </div>
                          <svg viewBox={logoGeometry.tightViewBox} className="w-14 h-14">
                            <use href="#phi-master-rings" fill="url(#phiRingsPrint)" />
                            <use href="#phi-master-pillars" fill="url(#phiPillarsPrint)" />
                          </svg>
                        </div>
                        <div className="pr-3 space-y-1.5 text-[11px] my-3" style={{ color: '#2e2620' }}>
                          <div className="flex items-center gap-2 font-mono">
                            <i className="fa-solid fa-phone text-[10px]" style={{ color: '#ea580c' }}></i>
                            <span dir="ltr">+966 56 938 7438 / +20 100 000 0000</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono">
                            <i className="fa-solid fa-location-dot text-[10px]" style={{ color: '#ea580c' }}></i>
                            <span>الرياض (ضاحية الفرسان / العليا) • القاهرة • المنصورة</span>
                          </div>
                        </div>
                        <div className="pr-3 pt-2 flex items-center justify-between text-[10px] font-bold" style={{ color: '#524236' }}>
                          <span>بناء إنشائي (عظم) • تشطيب معماري • تكييف كونسيلد</span>
                          <span className="font-mono" style={{ color: '#ea580c' }}>تسليم مفتاح</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mockup 2: A4 Letterhead */}
                  {studioMockupTab === 'letterhead' && (
                    <div id="printable-a4-sheet" className="rounded-2xl p-6 sm:p-8 relative overflow-hidden" style={{ background: '#ffffff', color: '#14100d', boxShadow: '0 22px 48px rgba(0,0,0,0.55)' }}>
                      <div className="flex flex-wrap items-center justify-between gap-4 pb-5" style={{ background: 'linear-gradient(90deg, rgba(249,115,22,0.08), transparent)', padding: '16px', borderRadius: '14px' }}>
                        <div className="flex items-center gap-3.5">
                          <svg viewBox={logoGeometry.tightViewBox} className="w-16 h-16">
                            <use href="#phi-master-rings" fill="url(#phiRingsPrint)" />
                            <use href="#phi-master-pillars" fill="url(#phiPillarsPrint)" />
                          </svg>
                          <div>
                            <div className="font-sans font-black text-xl text-amber-600">
                              فاي تك للمقاولات العامة والتشطيبات الفاخرة
                            </div>
                            <div className="text-xs font-mono font-bold" style={{ color: '#2e2620' }}>
                              PhiTech General Contracting &amp; Luxury Finishes
                            </div>
                            <div className="text-[10px]" style={{ color: '#6b5e53' }}>
                              المملكة العربية السعودية (الرياض) • جمهورية مصر العربية (القاهرة - المنصورة)
                            </div>
                          </div>
                        </div>
                        <div className="text-left font-mono text-[11px] space-y-0.5" style={{ color: '#3f352c' }}>
                          <div><strong>DOC REF:</strong> PHI-BOQ-2026/104</div>
                          <div><strong>DATE:</strong> {new Date().toLocaleDateString('ar-SA')}</div>
                          <div><strong>STATUS:</strong> معتمد هندسياً</div>
                        </div>
                      </div>

                      <div className="relative py-8 px-2 sm:px-6">
                        <svg viewBox={logoGeometry.tightViewBox} className="w-52 h-52 mx-auto opacity-[0.05] pointer-events-none absolute inset-0 m-auto">
                          <use href="#phi-master-rings" fill="#2c353d" />
                          <use href="#phi-master-pillars" fill="#f07613" />
                        </svg>

                        <div className="relative z-10 space-y-3 text-xs leading-relaxed" style={{ color: '#26201b' }}>
                          <div className="font-black text-sm" style={{ color: '#14100d' }}>
                            الموضوع: مقايسة فنية وعرض سعر لأعمال المقاولات والتشطيبات (تسليم مفتاح 3×1)
                          </div>
                          <p>
                            تحية طيبة وبعد، تتشرف شركة <strong>فاي تك (PhiTech)</strong> بتقديم المقايسة التقديرية وجدول الكميات المعتمد لتنفيذ مشروعكم بأعلى المعايير الهندسية:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                            <div className="p-3 rounded-xl" style={{ background: '#fdf8f2' }}>
                              <div className="font-extrabold text-[11px]" style={{ color: '#ea580c' }}>1. القطاع الإنشائي (العظم)</div>
                              <div className="text-[11px] mt-0.5">حفر، إحلال، لبشة مسلحة، أعمدة، أسقف فلات وهوردي، وكمر مقلوب.</div>
                            </div>
                            <div className="p-3 rounded-xl" style={{ background: '#f2fbf7' }}>
                              <div className="font-extrabold text-[11px]" style={{ color: '#047857' }}>2. القطاع المعماري والتشطيب</div>
                              <div className="text-[11px] mt-0.5">لياسة مساطر ليزر، كناوف وسمنت بورد، رخام ميكانيكي، ودهانات جوتين.</div>
                            </div>
                            <div className="p-3 rounded-xl" style={{ background: '#f2f9fd' }}>
                              <div className="font-extrabold text-[11px]" style={{ color: '#0369a1' }}>3. الكهروميكانيك MEP والتكييف</div>
                              <div className="text-[11px] mt-0.5">دكتات تكييف مخفي كونسيلد VRF، سباكة معلقة PEX، وشنايدر.</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px]" style={{ color: '#524236', background: '#faf5ed', padding: '10px 16px', borderRadius: '10px' }}>
                        <span>المكاتب: الرياض (ضاحية الفرسان / العليا) | القاهرة الجديدة (التجمع) | المنصورة (طلخا)</span>
                        <span className="font-mono font-bold" style={{ color: '#ea580c' }}>PHITECH CONTRACTING</span>
                      </div>
                    </div>
                  )}

                  {/* Mockup 3: Stamp & App Icon */}
                  {studioMockupTab === 'stamp' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="rounded-2xl p-6 flex flex-col items-center justify-center text-center" style={{ background: '#ffffff', color: '#14100d' }}>
                        <span className="text-[11px] font-bold mb-3" style={{ color: '#6b5e53' }}>ختم الشركة الرسمي المعتمد (Official Stamp)</span>
                        <div className="w-44 h-44 rounded-full flex flex-col items-center justify-center p-3 border-2 border-dashed border-blue-900/40" style={{ background: 'rgba(30, 58, 138, 0.05)', color: '#1e3a8a' }}>
                          <svg viewBox={logoGeometry.tightViewBox} className="w-16 h-16">
                            <use href="#phi-master-rings" fill="#1e3a8a" />
                            <use href="#phi-master-pillars" fill="#1e3a8a" />
                          </svg>
                          <div className="font-sans font-black text-xs tracking-wider mt-1">شركة فاي تك للمقاولات</div>
                          <div className="font-mono text-[9px] font-bold">PHITECH GENERAL CONTRACTING</div>
                          <div className="text-[8px] mt-0.5">الرياض • القاهرة • المنصورة</div>
                        </div>
                      </div>

                      <div className="rounded-2xl p-6 flex flex-col items-center justify-center text-center sunken-well-box">
                        <span className="text-[11px] font-bold mb-3" style={{ color: 'var(--text-muted)' }}>أيقونة التطبيق والويب (مالي مكانه بنسبة 95%)</span>
                        <div className="flex items-center gap-5">
                          <div className="w-22 h-22 rounded-[22px] flex items-center justify-center p-2" style={{ background: '#ffffff', boxShadow: '0 14px 28px rgba(0,0,0,0.65)' }}>
                            <svg viewBox={logoGeometry.tightViewBox} className="w-18 h-18">
                              <use href="#phi-master-rings" fill="url(#phiRingsPrint)" />
                              <use href="#phi-master-pillars" fill="url(#phiPillarsPrint)" />
                            </svg>
                          </div>
                          <div className="w-22 h-22 rounded-[22px] flex items-center justify-center p-2" style={{ background: 'linear-gradient(145deg, #1d1814 0%, #090807 100%)', boxShadow: '0 14px 28px rgba(0,0,0,0.85)' }}>
                            <svg viewBox={logoGeometry.tightViewBox} className="w-18 h-18">
                              <use href="#phi-master-rings" fill="url(#phiRingsWebDark)" />
                              <use href="#phi-master-pillars" fill="url(#phiPillarsWebDark)" />
                            </svg>
                          </div>
                        </div>
                        <div className="text-[11px] mt-3" style={{ color: 'var(--text-secondary)' }}>كتلة هندسية متوازنة بدون أي فراغات ميتة</div>
                      </div>
                    </div>
                  )}

                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* SECTION 8: DIRECT QUOTE & SITE VISIT FORM */}
      <section id="order-section" className="py-16 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="glossy-card p-6 sm:p-12">
            <div className="specular-beam"></div>

            <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
              <span className="badge-pill badge-accent text-xs sm:text-sm">
                <i className="fa-solid fa-compass-drafting"></i>
                احجز معاينة هندسية للموقع أو اطلب مقايسة رسمية
              </span>
              <h2 className="text-2xl sm:text-4xl font-black">
                ابدأ مشروعك بثقة مع <span className="text-amber-500 font-sans">فاي تك</span>
              </h2>
              <p className="text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
                سواء كنت تخطط لبناء فيلا سكنية فاخرة أو عمارة أو برج، فريقنا الهندسي في الرياض ومصر جاهز لمعاينة الموقع ودراسة المخططات وتقديم مقايسة تفصيلية لك.
              </p>
            </div>

            <form onSubmit={handleSubmitLead} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>اسم العميل أو الجهة المالكة *</label>
                  <input
                    type="text"
                    required
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    className="sunken-input"
                    placeholder="مثال: الشيخ فهد العتيبي / م. طارق المنصور"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>رقم الجوال / واتساب *</label>
                  <input
                    type="tel"
                    required
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    className="sunken-input font-mono"
                    placeholder="+966 50 000 0000 أو +20 100 000 0000"
                    dir="ltr"
                    style={{ textAlign: 'right' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>نطاق الأعمال المطلوب تنفيذه *</label>
                  <select
                    value={leadPackage}
                    onChange={(e) => setLeadPackage(e.target.value)}
                    className="sunken-input cursor-pointer font-bold"
                  >
                    <option value="تسليم مفتاح متكامل 3×1 (عظم + تشطيبات ديلوكس + تكييف مخفي وMEP)">تسليم مفتاح متكامل 3×1 (عظم + تشطيبات ديلوكس + تكييف مخفي وMEP)</option>
                    <option value="أعمال البناء الإنشائي والعظم فقط (حفر، لبشة مسلحة، خرسانات، ومباني)">أعمال البناء الإنشائي والعظم فقط (حفر، لبشة مسلحة، خرسانات، ومباني)</option>
                    <option value="أعمال التشطيبات المعمارية الفاخرة والواجهات (لياسة ليزر، جبس، رخام، جوتين)">أعمال التشطيبات المعمارية الفاخرة والواجهات (لياسة ليزر، جبس، رخام، جوتين)</option>
                    <option value="أعمال الكهروميكانيك والتكييف المخفي الكونسيلد والـ VRF">أعمال الكهروميكانيك والتكييف المخفي الكونسيلد والـ VRF</option>
                    <option value="تشطيبات معمارية + تكييف مخفي (بدون عظم)">تشطيبات معمارية + تكييف مخفي (بدون عظم)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>موقع المشروع / المدينة والحي *</label>
                  <input
                    type="text"
                    required
                    value={leadLocation}
                    onChange={(e) => setLeadLocation(e.target.value)}
                    className="sunken-input"
                    placeholder="مثال: الرياض (ضاحية الفرسان / حطين / النرجس) أو القاهرة الجديدة / المنصورة"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>تفاصيل المشروع أو المقايسة المحسوبة</label>
                <textarea
                  rows={4}
                  value={leadNotes}
                  onChange={(e) => setLeadNotes(e.target.value)}
                  className="sunken-input"
                  placeholder="اذكر المساحة التقريبية، عدد الأدوار، طبيعة التربة أو أي متطلبات خاصة في التشطيبات والتكييف المخفي..."
                />
              </div>

              <div className="pt-3 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <i className="fa-solid fa-shield-halved text-emerald-400"></i>
                  <span>عقود هندسية موثقة بجدول زمني، دفعات مع المستخلصات، وضمان شامل على الهيكل والتشطيب.</span>
                </div>

                <button type="submit" disabled={isSubmitting} className="btn-primary text-base py-4 px-10 w-full sm:w-auto">
                  <i className={`fa-solid ${isSubmitting ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                  <span>{isSubmitting ? 'جاري الإرسال والتسجيل...' : 'إرسال الطلب وحجز المعاينة الهندسية'}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="header-surface py-12 px-4 sm:px-8 mt-10 relative">
        <div className="specular-beam"></div>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl sunken-well-box p-1.5 flex items-center justify-center bg-slate-900/70 border border-amber-500/20 shadow-[0_0_15px_rgba(249,115,22,0.2)]">
              <img
                src="/phitech-emblem.png"
                alt="شعار فاي تك"
                className="w-10 h-10 object-contain drop-shadow-[0_2px_8px_rgba(249,115,22,0.4)]"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-amber-500 font-sans">فاي تك</span>
                <span className="font-mono font-black text-base phi-metallic-text">PhiTech General Contracting</span>
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                بناء إنشائي (عظم) • تشطيبات معمارية فاخرة • تكييف مخفي وكهروميكانيك MEP (الرياض • مصر)
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs font-bold text-slate-400">
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1.5 text-amber-400"
            >
              <i className="fa-solid fa-shield-halved text-amber-500"></i>
              <span>بوابات الدخول (موظفين • ملاك)</span>
            </button>
            <span>•</span>
            <Link href="/login?portal=staff" className="hover:text-amber-400 transition-colors">
              بوابة الموظفين والمهندسين
            </Link>
            <span>•</span>
            <Link href="/login?portal=partner" className="hover:text-amber-300 transition-colors">
              بوابة الملاك والشركاء
            </Link>
            <span>•</span>
            <a href="#turnkey-calculator" className="hover:text-slate-200 transition-colors">
              حاسبة المقايسة 3×1
            </a>
          </div>

          <div className="text-xs text-center md:text-left" style={{ color: 'var(--text-muted)' }}>
            جميع الحقوق محفوظة © <span className="font-mono">2026</span> لشركة <strong style={{ color: 'var(--text-primary)' }}>فاي تك (PhiTech)</strong> — نظام <span className="font-mono">Obsidian Amber Gloss</span>.
          </div>
        </div>
      </footer>

      {/* EXECUTIVE DUAL LOGIN MODAL (الموظفين والملاك) */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="glossy-card max-w-3xl w-full p-6 sm:p-8 relative my-8 border border-amber-500/25 shadow-[0_20px_70px_rgba(0,0,0,0.9)] animate-in fade-in zoom-in-95 duration-200">
            <div className="specular-beam"></div>

            {/* Close Button */}
            <button
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute top-4 left-4 w-9 h-9 rounded-xl sunken-well-box flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              aria-label="إغلاق"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>

            {/* Header */}
            <div className="text-center space-y-3 mb-8">
              <div className="w-16 h-16 rounded-2xl mx-auto sunken-well-box p-2 flex items-center justify-center bg-slate-900/80 border border-amber-500/30 shadow-[0_0_25px_rgba(249,115,22,0.3)]">
                <img
                  src="/phitech-emblem.png"
                  alt="شعار فاي تك"
                  className="w-12 h-12 object-contain drop-shadow-[0_2px_10px_rgba(249,115,22,0.5)]"
                />
              </div>
              <div>
                <span className="badge-pill badge-accent font-mono text-xs px-3 py-1">
                  <i className="fa-solid fa-shield-halved"></i>
                  بوابة الدخول الموحدة لمنظومة فاي تك
                </span>
                <h2 className="text-2xl sm:text-3xl font-black mt-2 text-white">
                  اختر بوابة الدخول المخصصة لك
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto mt-1">
                  منظومة رقمية مشفرة توفر مسارات دخول مخصصة للكادر الهندسي والميداني والإداري، والملاك والشركاء المستثمرين مع توجيه ذكي حسب الصلاحيات.
                </p>
              </div>
            </div>

            {/* The Two Portals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Portal 1: Staff & Engineers */}
              <div className="glossy-card p-6 flex flex-col justify-between relative group hover:border-amber-500/50 transition-all border border-slate-700/60 bg-gradient-to-b from-slate-900/90 to-slate-950/95">
                <div className="specular-beam"></div>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl text-amber-400 bg-amber-500/15 border border-amber-500/30">
                      <i className="fa-solid fa-helmet-safety"></i>
                    </div>
                    <span className="badge-pill bg-amber-500/20 text-amber-300 text-xs font-bold font-sans">
                      الكادر التنفيذي
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-white group-hover:text-amber-400 transition-colors">
                    بوابة الموظفين والمهندسين
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 mb-4 leading-relaxed">
                    مخصصة لمهندسي المواقع، المشرفين الميدانيين، المحاسبين، وفريق إدارة المشاريع والعمليات.
                  </p>

                  <ul className="space-y-2 text-xs text-slate-300 mb-6 border-t border-slate-800 pt-3">
                    <li className="flex items-center gap-2">
                      <i className="fa-solid fa-check text-amber-400 text-[10px]"></i>
                      <span>تسجيل الحضور والموقع الميداني GPS</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <i className="fa-solid fa-check text-amber-400 text-[10px]"></i>
                      <span>جداول الكميات وحصر الأعمال اليومية (BoQ)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <i className="fa-solid fa-check text-amber-400 text-[10px]"></i>
                      <span>إدارة العهد والمصروفات والفواتير التشغيلية</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <i className="fa-solid fa-check text-amber-400 text-[10px]"></i>
                      <span>المخططات التنفيذية ومستخلصات المشاريع</span>
                    </li>
                  </ul>
                </div>

                <Link
                  href="/login?portal=staff"
                  className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 font-bold shadow-lg shadow-orange-500/20"
                >
                  <i className="fa-solid fa-arrow-right-to-bracket"></i>
                  <span>دخول كادر الموظفين والمهندسين</span>
                </Link>
              </div>

              {/* Portal 2: Owners & Partners */}
              <div className="glossy-card p-6 flex flex-col justify-between relative group hover:border-amber-400/60 transition-all border border-amber-500/35 bg-gradient-to-b from-slate-900/95 to-slate-950/95 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
                <div className="specular-beam"></div>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl text-amber-300 bg-amber-500/20 border border-amber-400/40">
                      <i className="fa-solid fa-crown"></i>
                    </div>
                    <span className="badge-pill bg-emerald-500/20 text-emerald-300 text-xs font-bold font-sans">
                      VIP الشركاء والملاك
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-amber-200 group-hover:text-amber-300 transition-colors">
                    بوابة الملاك والشركاء
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 mb-4 leading-relaxed">
                    مخصصة للشركاء المؤسسين، كبار الملاك، والمستثمرين للاطلاع على المؤشرات المالية والأرصدة.
                  </p>

                  <ul className="space-y-2 text-xs text-slate-300 mb-6 border-t border-slate-800 pt-3">
                    <li className="flex items-center gap-2">
                      <i className="fa-solid fa-check text-emerald-400 text-[10px]"></i>
                      <span>كشف حساب الشركاء وحركات المسحوبات اللحظية</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <i className="fa-solid fa-check text-emerald-400 text-[10px]"></i>
                      <span>تقارير ربحية المشاريع وتوزيع العوائد والأرباح</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <i className="fa-solid fa-check text-emerald-400 text-[10px]"></i>
                      <span>المركز المالي الشامل وصافي التدفقات النقدية</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <i className="fa-solid fa-check text-emerald-400 text-[10px]"></i>
                      <span>لوحة قياس الأداء الاستراتيجي والشفافية</span>
                    </li>
                  </ul>
                </div>

                <Link
                  href="/login?portal=partner"
                  className="w-full py-3 text-sm flex items-center justify-center gap-2 font-bold rounded-xl text-slate-950 transition-all hover:scale-[1.02] shadow-lg shadow-amber-500/25"
                  style={{ background: 'linear-gradient(135deg, #fef08a 0%, #f59e0b 50%, #d97706 100%)' }}
                >
                  <i className="fa-solid fa-gem"></i>
                  <span>دخول بوابة الملاك والشركاء</span>
                </Link>
              </div>

            </div>

            {/* Footer Info */}
            <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-lock text-amber-500"></i>
                <span>اتصال محمي ومشفر بالكامل 256-bit SSL مع توجيه ذكي حسب الصلاحيات</span>
              </div>
              <button
                onClick={() => setIsLoginModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                إلغاء والعودة لتصفح الموقع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SUCCESS CONFIRMATION */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glossy-card max-w-xl w-full p-6 sm:p-8 relative">
            <div className="specular-beam"></div>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-3xl" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                <i className="fa-solid fa-circle-check"></i>
              </div>
              <span className="badge-pill badge-accent font-mono text-xs">REF: #{submittedRef}</span>
              <h3 className="text-2xl font-black">تم تسجيل طلب المعاينة والمقايسة بنجاح!</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                تم إرسال تفاصيل مقايستك إلى المكتب الفني والهندسي في <strong>فاي تك (PhiTech)</strong> وتنبيه فريق العمل عبر النظام والتليجرام. سيتواصل معك أحد مهندسينا خلال ساعات العمل لتأكيد موعد المعاينة.
              </p>
              <div className="pt-3">
                <button onClick={() => setIsModalOpen(false)} className="btn-primary w-full py-3 text-sm">
                  <i className="fa-solid fa-check"></i>
                  <span>تم — العودة للموقع</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      <div
        className={`fixed bottom-6 left-6 z-50 max-w-md glossy-card p-4 transition-all duration-300 ${
          toast.show ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'
        }`}
      >
        <div className="specular-beam"></div>
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--accent-soft-bg)', color: 'var(--accent-bright)' }}>
            <i className="fa-solid fa-circle-check text-lg"></i>
          </div>
          <div>
            <div className="font-extrabold text-sm">{toast.title}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{toast.desc}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
