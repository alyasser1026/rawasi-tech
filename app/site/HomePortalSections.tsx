"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PRODUCT_CATEGORIES,
  SMART_BUNDLES,
  type ProductCategoryId,
  type WebsiteMaintenanceService,
  type WebsiteProduct,
  type WebsiteProperty,
} from './store-catalog';
import type { Commitment, Faq, Service } from './site-content';

export type HomePortalSectionId =
  | 'maintenance'
  | 'contracting'
  | 'real_estate'
  | 'building_materials'
  | 'smart_tech'
  | 'general_info';

interface PortalDef {
  id: HomePortalSectionId;
  icon: string;
  badge: string;
  title: string;
  subtitle: string;
  highlights: string[];
  ctaLabel: string;
  accent: string;
}

const PORTAL_SECTIONS: PortalDef[] = [
  {
    id: 'maintenance',
    icon: '🛠️',
    badge: 'التأسيس والإصلاح والصيانة',
    title: 'قسم الصيانة والتنفيذ',
    subtitle: 'تنفيذ وصيانة الكهرباء والسباكة والدهانات والسيراميك والرخام والجبس والتكييف المخفي بضمان هندسي.',
    highlights: ['كشف أعطال وتسريبات بدون تكسير', 'صيانة وتأسيس 10 تخصصات هندسية', 'توصيات فنية ومقايسة فورية'],
    ctaLabel: 'ادخل لقسم الصيانة والتنفيذ',
    accent: '#0284c7',
  },
  {
    id: 'contracting',
    icon: '🏗️',
    badge: 'عظم · تشطيبات · MEP',
    title: 'قسم المقاولات',
    subtitle: 'منظومة مقاولات متكاملة 3×1 للفلل والأبراج والمقرات التجارية: إنشاءات وتشطيب فندقي وتكييف مخفي.',
    highlights: ['حاسبة تكلفة ومواد فورية للمشروع', 'مخططات تنفيذية قبل بدء العمل', 'تسليم مفتاح بإشراف مهندس مقيم'],
    ctaLabel: 'ادخل لقسم المقاولات والحاسبة',
    accent: '#c75517',
  },
  {
    id: 'real_estate',
    icon: '🏢',
    badge: 'شقق · دوبلكس · معارض',
    title: 'قسم العقارات',
    subtitle: 'وحدات سكنية فاخرة ودوبلكس بحديقة ومعارض تجارية جاهزة أو بأنظمة سداد مرنة وتشطيب موثّق.',
    highlights: ['وحدات شاملة السمارت هوم وحساسات الأمان', 'حاسبة أقساط ومقدم فورية', 'معاينة هندسية ومجسم 3D للمبنى'],
    ctaLabel: 'استكشف قسم العقارات والوحدات',
    accent: '#d97706',
  },
  {
    id: 'building_materials',
    icon: '🧱',
    badge: 'بيع وشراء الجملة والقطاعي',
    title: 'قسم بيع وشراء مواد البناء',
    subtitle: 'اطلب خامات البناء والتشطيب المعتمدة بأفضل سعر، أو اعرض خاماتك وفائض المشاريع للبيع لإدارة المشتريات.',
    highlights: ['شراء دهانات ومعجون وبورسلان ورخام وكابلات', 'أسعار جملة وتوريد مباشر للموقع', 'بوابة عرض بيع خامات الموردين والفائض'],
    ctaLabel: 'تصفح سوق بيع وشراء مواد البناء',
    accent: '#ea580c',
  },
  {
    id: 'smart_tech',
    icon: '📱',
    badge: 'منزل ذكي وأمان 24/7',
    title: 'قسم التكنولوجيا والسمارت هوم',
    subtitle: 'تحويل منزلك لمنزل ذكي بالكامل بدون تكسير: أقفال ببصمة وكاميرا، تيار خفيف، وحساسات غاز ومياه وحريق.',
    highlights: ['مُصمم باقة السمارت هوم التفاعلي', 'حساسات غاز ومياه بمحبس غلق تلقائي', 'كاميرات 4K وإنتركم مرئي على الجوال'],
    ctaLabel: 'صمّم منزلك الذكي الآن',
    accent: '#059669',
  },
  {
    id: 'general_info',
    icon: '📚',
    badge: 'موسوعة ونصائح وأدوات',
    title: 'قسم معلومات عامة',
    subtitle: 'كل ما تحتاجه قبل البناء والتشطيب: نصائح هندسية ذهبية، دليل الفحص والاستلام، حاسبات مجانية وأسئلة شائعة.',
    highlights: ['نصائح مهندسين توفر 20% من أخطاء الموقع', 'دليل التنفيذ والفحص وقوائم الاستلام', 'حاسبات خرسانة وحديد ودهان وبلاط مجانية'],
    ctaLabel: 'تصفح المعلومات والدليل الهندسي',
    accent: '#4f46e5',
  },
];

const GENERAL_ENGINEERING_TIPS = [
  {
    tag: '⚡ كهرباء وسمارت هوم',
    title: 'لا تغلق علب الكهرباء بدون سلك النيوترال (Neutral)',
    tip: 'وجود سلك نيوترال داخل كل علبة مفتاح + خراطيم تيار خفيف مستقلة بمسافة 20 سم عن الكهرباء يتيح لك تحويل منزلك لسمارت هوم في أي وقت مستقبلاً بدون تكسير.',
  },
  {
    tag: '🚰 السباكة والعزل',
    title: 'اختبار الضغط 10 بار قبل اللياسة والسيراميك',
    tip: 'لا تسمح أبداً بتقفيل أي حمام قبل كبس مواسير التغذية 10 بار لمدة 24 ساعة وتجربة غمر العزل المائي 48 ساعة وتصوير المسارات فيديو للرجوع إليها عند الصيانة.',
  },
  {
    tag: '🟫 البورسلان والرخام',
    title: 'ممنوع تركيب البورسلان بالأسمنت والماء العادي',
    tip: 'البورسلان قص الليزر لا يمتص الماء؛ يجب لصقه بمادة لاصقة مرنة C2TE مع دهان ظهر البلاطة الكبيرة واستخدام الكلبسات وميزان الليزر لمنع التطبيل.',
  },
  {
    tag: '🎨 الدهانات والمعجون',
    title: 'البرايمر والمعجون المناسب يضاعف عمر الدهان',
    tip: 'استخدم معجون جدران أسمنتي (فتونيت داخلي) لتسوية الخرسانات، يليها فيلر وبرايمر أصلي ثم 3 سكاكين معجون وصنفرة بالكشاف قبل الوجه النهائي القابل للغسيل.',
  },
  {
    tag: '❄️ التكييف المخفي',
    title: 'P-Trap للصرف وفتحات صيانة مخفية بالجبس',
    tip: 'لا توصل صرف التكييف على صفاية الحمام مباشرة بدون جراب مائي P-Trap لمنع الروائح، واترك فتحة Access Panel أسفل كل ماكينة كونسيلد لسهولة الصيانة الدورية.',
  },
  {
    tag: '🚨 الأمان ضد الكوارث',
    title: 'محبس الفصل التلقائي أهم من صافرة الإنذار',
    tip: 'حساس تسرب المياه أو الغاز وحده ينبهك فقط؛ لكن ربطه بمحبس إغلاق أوتوماتيكي يحمي شقتك وتشطيباتك ويمنع الغرق أو الحريق حتى أثناء سفرك.',
  },
];

interface HomePortalSectionsProps {
  activeSection: HomePortalSectionId;
  onSelectSection: (id: HomePortalSectionId) => void;
  services: Service[];
  commitments: Commitment[];
  steps: { n: string; title: string; text: string }[];
  faqs: Faq[];
  products: WebsiteProduct[];
  properties: WebsiteProperty[];
  maintenanceServices: WebsiteMaintenanceService[];
  whatsappNumber: string;
  onAddToCart: (product: WebsiteProduct, qty: number, withInstall: boolean) => void;
  onAddBundleToCart: (items: { product: WebsiteProduct; qty: number }[], withInstall: boolean) => void;
  cartCount: number;
  onOpenCart: () => void;
}

export default function HomePortalSections({
  activeSection,
  onSelectSection,
  services,
  commitments,
  steps,
  faqs,
  products,
  properties,
  maintenanceServices,
  whatsappNumber,
  onAddToCart,
  onAddBundleToCart,
  cartCount,
  onOpenCart,
}: HomePortalSectionsProps) {
  const waDigits = (whatsappNumber || '201558888744').replace(/\D/g, '') || '201558888744';
  const openWhatsApp = (message: string) => {
    window.open(`https://wa.me/${waDigits}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  // --- Section 1 (Maintenance) filters ---
  const [mntCat, setMntCat] = useState<string>('all');
  const filteredMaintenance = useMemo(() => {
    return maintenanceServices.filter((m) => m.available !== false && (mntCat === 'all' || m.category === mntCat));
  }, [maintenanceServices, mntCat]);

  // --- Section 2 (Contracting Calculator) state ---
  const [calcType, setCalcType] = useState<'villa' | 'tower' | 'commercial' | 'duplex'>('villa');
  const [calcArea, setCalcArea] = useState<number>(350);
  const [calcFloors, setCalcFloors] = useState<number>(2);
  const [calcTier, setCalcTier] = useState<'standard' | 'deluxe' | 'royal'>('deluxe');
  const [calcScopes, setCalcScopes] = useState({ structural: true, finishing: true, mep: true });

  const contractingStats = useMemo(() => {
    const totalBua = calcArea * calcFloors;
    const tierFactor = calcTier === 'standard' ? 1 : calcTier === 'deluxe' ? 1.35 : 1.75;
    const baseRates = {
      villa: { struct: 1100, arch: 1450, mep: 550 },
      tower: { struct: 1250, arch: 1200, mep: 600 },
      commercial: { struct: 1150, arch: 1350, mep: 700 },
      duplex: { struct: 980, arch: 1550, mep: 620 },
    }[calcType];
    const structEst = calcScopes.structural ? Math.round(totalBua * baseRates.struct * tierFactor) : 0;
    const finishEst = calcScopes.finishing ? Math.round(totalBua * baseRates.arch * tierFactor) : 0;
    const mepEst = calcScopes.mep ? Math.round(totalBua * baseRates.mep * tierFactor) : 0;
    const allOn = calcScopes.structural && calcScopes.finishing && calcScopes.mep;
    const subtotal = structEst + finishEst + mepEst;
    const total = allOn ? Math.round(subtotal * 0.93) : subtotal;
    const concreteCbm = calcScopes.structural ? Math.round(totalBua * 0.42) : 0;
    const steelTons = calcScopes.structural ? Math.round(totalBua * 0.046) : 0;
    const paintBuckets = calcScopes.finishing ? Math.max(4, Math.round((totalBua * 2.8) / 45)) : 0;
    const hvacTons = calcScopes.mep ? Math.max(2, Math.round(totalBua / 18)) : 0;
    let months = 1;
    if (calcScopes.structural) months += Math.ceil(calcFloors * 1.1);
    if (calcScopes.finishing) months += Math.ceil(calcFloors * 1.2);
    if (calcScopes.mep) months += 1;
    if (allOn) months = Math.max(3, Math.round(months * 0.8));
    return { totalBua, total, concreteCbm, steelTons, paintBuckets, hvacTons, months, allOn };
  }, [calcType, calcArea, calcFloors, calcTier, calcScopes]);

  // --- Section 3 (Real Estate) filters & installment calculator ---
  const [propFilter, setPropFilter] = useState<string>('all');
  const [estUnitPrice, setEstUnitPrice] = useState<number>(4500000);
  const [estDownPct, setEstDownPct] = useState<number>(25);
  const [estYears, setEstYears] = useState<number>(3);

  const filteredProperties = useMemo(() => {
    if (propFilter === 'all') return properties;
    return properties.filter((p) => p.type === propFilter);
  }, [properties, propFilter]);

  const installmentCalc = useMemo(() => {
    const downPayment = Math.round((estUnitPrice * estDownPct) / 100);
    const remaining = Math.max(0, estUnitPrice - downPayment);
    const monthsCount = Math.max(12, estYears * 12);
    const monthly = Math.round(remaining / monthsCount);
    const quarterly = Math.round(remaining / Math.max(4, estYears * 4));
    return { downPayment, remaining, monthly, quarterly };
  }, [estUnitPrice, estDownPct, estYears]);

  // --- Section 4 (Building Materials Buy & Sell) state ---
  const [materialsMode, setMaterialsMode] = useState<'buy' | 'sell'>('buy');
  const [materialCatFilter, setMaterialCatFilter] = useState<'all' | ProductCategoryId>('all');
  const [materialInstallMap, setMaterialInstallMap] = useState<Record<string, boolean>>({});
  const [sellMaterialName, setSellMaterialName] = useState('');
  const [sellQty, setSellQty] = useState('');
  const [sellUnit, setSellUnit] = useState('بستلة / كيس / طن');
  const [sellPrice, setSellPrice] = useState('');
  const [sellCity, setSellCity] = useState('الرياض / القاهرة / المنصورة');
  const [sellPhone, setSellPhone] = useState('');
  const [sellNotes, setSellNotes] = useState('');
  const [sellSubmitted, setSellSubmitted] = useState(false);

  const buildingMaterialCategories: ProductCategoryId[] = [
    'paint',
    'ceramics',
    'marble',
    'electrical',
    'plumbing',
    'decor',
  ];

  const materialProducts = useMemo(() => {
    return products.filter((p) => {
      if (!buildingMaterialCategories.includes(p.category)) return false;
      if (materialCatFilter !== 'all' && p.category !== materialCatFilter) return false;
      return true;
    });
  }, [products, materialCatFilter]);

  // --- Section 5 (Smart Home Configurator) state ---
  const [shRooms, setShRooms] = useState<number>(3);
  const [shAcs, setShAcs] = useState<number>(3);
  const [shIncludeLock, setShIncludeLock] = useState<boolean>(true);
  const [shIncludeSafety, setShIncludeSafety] = useState<boolean>(true);
  const [shCamerasCount, setShCamerasCount] = useState<number>(4);

  const smartProducts = useMemo(() => {
    return products.filter((p) => ['smart_home', 'low_current', 'safety_sensors'].includes(p.category));
  }, [products]);

  const handleAddConfiguredSmartPackage = () => {
    const itemsToAdd: { product: WebsiteProduct; qty: number }[] = [];
    const hub = products.find((p) => p.id === 'sm-01');
    const smartSwitch = products.find((p) => p.id === 'sm-03');
    const acIr = products.find((p) => p.id === 'sm-04');
    const lock = products.find((p) => p.id === 'sm-02');
    const gas = products.find((p) => p.id === 'sf-01');
    const water = products.find((p) => p.id === 'sf-02');
    const smoke = products.find((p) => p.id === 'sf-03');
    const cam = products.find((p) => p.id === 'lc-01');

    if (hub) itemsToAdd.push({ product: hub, qty: 1 });
    if (smartSwitch) itemsToAdd.push({ product: smartSwitch, qty: Math.max(1, shRooms) });
    if (acIr && shAcs > 0) itemsToAdd.push({ product: acIr, qty: shAcs });
    if (lock && shIncludeLock) itemsToAdd.push({ product: lock, qty: 1 });
    if (shIncludeSafety) {
      if (gas) itemsToAdd.push({ product: gas, qty: 1 });
      if (water) itemsToAdd.push({ product: water, qty: 1 });
      if (smoke) itemsToAdd.push({ product: smoke, qty: 2 });
    }
    if (cam && shCamerasCount > 0) {
      itemsToAdd.push({ product: cam, qty: Math.max(1, Math.ceil(shCamerasCount / 4)) });
    }
    if (itemsToAdd.length > 0) {
      onAddBundleToCart(itemsToAdd, true);
    }
  };

  // --- Featured Products & Interactive Advisor state ---
  const [featuredTab, setFeaturedTab] = useState<'all' | 'smart' | 'mep' | 'finishing'>('all');
  const [featuredInstallMap, setFeaturedInstallMap] = useState<Record<string, boolean>>({});
  const [advisorGoal, setAdvisorGoal] = useState<'build' | 'finish' | 'smart' | 'maintain'>('finish');
  const [advisorArea, setAdvisorArea] = useState<number>(200);
  const [advisorTier, setAdvisorTier] = useState<'economic' | 'luxury' | 'vip'>('luxury');

  const featuredProducts = useMemo(() => {
    const base = products.filter((p) => p.featured);
    const list = base.length > 0 ? base : products.slice(0, 8);
    if (featuredTab === 'all') return list.slice(0, 8);
    if (featuredTab === 'smart') {
      return products.filter((p) => ['smart_home', 'low_current', 'safety_sensors'].includes(p.category)).slice(0, 8);
    }
    if (featuredTab === 'mep') {
      return products.filter((p) => ['electrical', 'plumbing'].includes(p.category)).slice(0, 8);
    }
    return products.filter((p) => ['paint', 'ceramics', 'marble', 'decor'].includes(p.category)).slice(0, 8);
  }, [products, featuredTab]);

  const advisorResult = useMemo(() => {
    const mult = advisorTier === 'economic' ? 1 : advisorTier === 'luxury' ? 1.35 : 1.75;
    if (advisorGoal === 'build') {
      return {
        headline: `تأسيس وإنشاء متكامل لمساحة ${advisorArea} م²`,
        duration: `${Math.max(4, Math.round(advisorArea / 45))} شهور تقريباً`,
        metrics: [
          { label: 'حديد تسليح تقديري', val: `${Math.round(advisorArea * 0.048)} طن` },
          { label: 'خرسانة مسلحة', val: `${Math.round(advisorArea * 0.44)} م³` },
          { label: 'تكييف مقترح', val: `${Math.max(2, Math.round(advisorArea / 18))} طن تبريد` },
        ],
        recommendation: 'نوصي بالتعاقد المتكامل 3×1 (عظم + MEP + تشطيب) لتوفير 7% مباشرة ومنع أي تكسير أثناء التأسيس.',
        targetSection: 'contracting' as HomePortalSectionId,
      };
    }
    if (advisorGoal === 'finish') {
      return {
        headline: `خطة تشطيب هندسية لمساحة ${advisorArea} م²`,
        duration: `${Math.max(6, Math.round((advisorArea / 25) * mult))} أسابيع`,
        metrics: [
          { label: 'بلاط/بورسلان مطلوب', val: `${Math.round(advisorArea * 1.15)} م²` },
          { label: 'معجون أسمنتي ودهان', val: `${Math.round(advisorArea * 2.8)} م² دهان` },
          { label: 'تأسيس مفاتيح ذكية', val: `${Math.max(8, Math.round(advisorArea / 18))} نقطة` },
        ],
        recommendation: 'نوصي باختيار اللياسة بالليزر + عزل الحمامات A+B + لصق البورسلان بالمادة المرنة C2TE + تأسيس سمارت هوم.',
        targetSection: 'building_materials' as HomePortalSectionId,
      };
    }
    if (advisorGoal === 'smart') {
      return {
        headline: `ترقية وحدة ${advisorArea} م² إلى Smart Home متكامل`,
        duration: `من يوم إلى 3 أيام عمل بدون تكسير`,
        metrics: [
          { label: 'شاشة تحكم + Hub', val: '1 وحدة رئيسية Zigbee' },
          { label: 'مفاتيح ذكية + تكييف IR', val: `${Math.max(4, Math.round(advisorArea / 35))} وحدة` },
          { label: 'حماية غاز/مياه/حريق', val: 'درع أمان ذكي كامل' },
        ],
        recommendation: 'نوصي ببروتوكول Zigbee مع محبس فصل غاز ومياه أوتوماتيكي وقفل باب ذكي بالكاميرا لضمان الأمان الكامل.',
        targetSection: 'smart_tech' as HomePortalSectionId,
      };
    }
    return {
      headline: `برنامج صيانة وترميم هندسي لمساحة ${advisorArea} م²`,
      duration: 'معاينة خلال 24 ساعة + تقرير فني مكتوب',
      metrics: [
        { label: 'فحص حراري وضغط سباكة', val: 'مشمول بالمعاينة' },
        { label: 'تقييم لوحة القواطع', val: 'RCCB + موازنة أحمال' },
        { label: 'تغطية الضمان الهندسي', val: 'ضمان موثّق على الإصلاح' },
      ],
      recommendation: 'نوصي بإجراء فحص حراري للوحة القواطع واختبار ضغط مواسير المياه لمعالجة أي تسرب خفي من جذوره.',
      targetSection: 'maintenance' as HomePortalSectionId,
    };
  }, [advisorGoal, advisorArea, advisorTier]);

  const handlePortalClick = (id: HomePortalSectionId) => {
    onSelectSection(id);
    const el = document.getElementById('portal-explorer');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSellSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellMaterialName.trim() || !sellPhone.trim()) return;
    setSellSubmitted(true);
    const msg = [
      '📦 عرض بيع / توريد مواد بناء — موقع فاي تك',
      `الخامة / الصنف: ${sellMaterialName}`,
      `الكمية: ${sellQty || 'غير محدد'} (${sellUnit})`,
      `السعر المعروض: ${sellPrice || 'عند التواصل'}`,
      `الموقع / المدينة: ${sellCity}`,
      `هاتف المورد / البائع: ${sellPhone}`,
      sellNotes && `تفاصيل إضافية: ${sellNotes}`,
    ]
      .filter(Boolean)
      .join('\n');

    void fetch('/api/website-store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderType: 'material_sell_offer',
        customerName: `مورد خامات (${sellCity})`,
        customerPhone: sellPhone,
        notes: msg,
        totalAmount: Number(sellPrice) || 0,
      }),
    }).catch(() => {});

    openWhatsApp(msg);
  };

  const activePortalMeta = PORTAL_SECTIONS.find((p) => p.id === activeSection) || PORTAL_SECTIONS[0];

  return (
    <>
      {/* 1. بوابة الأقسام الستة الرئيسية — تظهر فور فتح الموقع */}
      <section id="portals" className="pw-section pw-portal-gateway" aria-labelledby="portals-heading">
        <div className="pw-wrap">
          <div className="pw-head">
            <p className="pw-eyebrow">بوابة خدمات فاي تك الشاملة — اختر قسمك مباشرة</p>
            <h2 id="portals-heading">6 أقسام متخصصة تغطي احتياجك الهندسي والعقاري بالكامل</h2>
            <p>
              اضغط على القسم الذي تبحث عنه للدخول فوراً إلى التفاصيل الكاملة، الأسعار والباقات، حاسبات الكميات، وطلب التنفيذ أو الصيانة أو الشراء.
            </p>
          </div>

          <div className="pw-portal-grid" role="tablist" aria-label="أقسام الموقع الرئيسية">
            {PORTAL_SECTIONS.map((sec, idx) => {
              const isSelected = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handlePortalClick(sec.id)}
                  className={`pw-portal-card ${isSelected ? 'is-active' : ''}`}
                  style={{ '--portal-accent': sec.accent } as React.CSSProperties}
                >
                  <div className="pw-portal-card-top">
                    <span className="pw-portal-icon" aria-hidden="true">
                      {sec.icon}
                    </span>
                    <span className="pw-portal-badge">{sec.badge}</span>
                    <span className="pw-portal-num">0{idx + 1}</span>
                  </div>
                  <h3>{sec.title}</h3>
                  <p className="pw-portal-desc">{sec.subtitle}</p>
                  <ul className="pw-portal-list">
                    {sec.highlights.map((item) => (
                      <li key={item}>
                        <span className="pw-portal-dot" aria-hidden="true">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="pw-portal-cta">
                    <span>{isSelected ? '✓ القسم مفتوح بالأسفل — تصفح التفاصيل' : sec.ctaLabel}</span>
                    <span aria-hidden="true">↓</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. مستكشف تفاصيل القسم المختار */}
      <section id="portal-explorer" className="pw-section pw-tint" aria-live="polite">
        <div className="pw-wrap">
          {/* Quick Switcher Pill Bar */}
          <div className="pw-explorer-switcher" role="navigation" aria-label="التبديل السريع بين الأقسام">
            {PORTAL_SECTIONS.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => onSelectSection(sec.id)}
                className={`pw-explorer-pill ${activeSection === sec.id ? 'is-active' : ''}`}
              >
                <span>{sec.icon}</span>
                <span>{sec.title}</span>
              </button>
            ))}
          </div>

          {/* Explorer Header */}
          <div className="pw-explorer-header">
            <div className="pw-explorer-title-group">
              <span className="pw-explorer-hero-icon">{activePortalMeta.icon}</span>
              <div>
                <span className="pw-explorer-kicker">{activePortalMeta.badge}</span>
                <h2>{activePortalMeta.title}</h2>
                <p>{activePortalMeta.subtitle}</p>
              </div>
            </div>
            <div className="pw-explorer-quick-links">
              <button
                type="button"
                onClick={() =>
                  openWhatsApp(`السلام عليكم، أستفسر عن تفاصيل (${activePortalMeta.title}) من موقع فاي تك.`)
                }
                className="pw-btn pw-btn-primary"
                style={{ minHeight: '42px', padding: '0 18px', fontSize: '0.88rem' }}
              >
                💬 تواصل مباشر مع القسم عبر واتساب
              </button>
              {cartCount > 0 && (
                <button
                  type="button"
                  onClick={onOpenCart}
                  className="pw-btn pw-btn-ghost"
                  style={{ minHeight: '42px', padding: '0 16px', fontSize: '0.88rem' }}
                >
                  🛍️ السلة ({cartCount})
                </button>
              )}
            </div>
          </div>

          {/* A. قسم الصيانة والتنفيذ */}
          {activeSection === 'maintenance' && (
            <div className="pw-explorer-body">
              <div className="pw-chip-bar">
                <button
                  type="button"
                  className={`pw-chip ${mntCat === 'all' ? 'is-on' : ''}`}
                  onClick={() => setMntCat('all')}
                >
                  كل البنود ({maintenanceServices.length})
                </button>
                <button
                  type="button"
                  className={`pw-chip ${mntCat === 'hvac' ? 'is-on' : ''}`}
                  onClick={() => setMntCat('hvac')}
                >
                  ❄️ التكييف المخفي والاسبليت
                </button>
                {PRODUCT_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`pw-chip ${mntCat === c.id ? 'is-on' : ''}`}
                    onClick={() => setMntCat(c.id)}
                  >
                    {c.icon} {c.shortTitle}
                  </button>
                ))}
              </div>

              <div className="pw-mnt-grid">
                {filteredMaintenance.map((srv) => (
                  <article key={srv.id} className="pw-mnt-card">
                    <div className="pw-mnt-card-head">
                      <span className="pw-mnt-icon">{srv.icon}</span>
                      <div>
                        <span className="pw-mnt-code">{srv.code} · {srv.badge}</span>
                        <h3>{srv.title}</h3>
                      </div>
                    </div>

                    <div className="pw-mnt-cols">
                      <div className="pw-mnt-box is-exec">
                        <strong>🛠️ نطاق التنفيذ والتأسيس:</strong>
                        <ul>
                          {srv.executionScope.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="pw-mnt-box is-repair">
                        <strong>🔧 نطاق الصيانة والإصلاح:</strong>
                        <ul>
                          {srv.maintenanceScope.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="pw-mnt-tip">
                      <strong>💡 {srv.recommendation.split(':')[0]}:</strong>
                      <span>{srv.recommendation.split(':').slice(1).join(':')}</span>
                    </div>

                    <div className="pw-mnt-foot">
                      <span className="pw-mnt-warranty">🛡️ {srv.warrantyLabel}</span>
                      <div className="pw-mnt-actions">
                        <button
                          type="button"
                          onClick={() =>
                            openWhatsApp(
                              `مرحباً فاي تك، أحتاج طلب (${srv.title} - كود ${srv.code}). أرجو التواصل لتحديد موعد المعاينة.`
                            )
                          }
                          className="pw-btn pw-btn-primary"
                          style={{ minHeight: '38px', padding: '0 14px', fontSize: '0.82rem' }}
                        >
                          📅 حجز معاينة / صيانة
                        </button>
                        <Link
                          href="/store?tab=maintenance"
                          className="pw-btn pw-btn-ghost"
                          style={{ minHeight: '38px', padding: '0 14px', fontSize: '0.82rem' }}
                        >
                          التفاصيل الكاملة ←
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* B. قسم المقاولات */}
          {activeSection === 'contracting' && (
            <div className="pw-explorer-body">
              <div className="pw-cards" style={{ marginBottom: '26px' }}>
                {services.map((s) => (
                  <article key={s.id} className="pw-card">
                    <div className="pw-icon">
                      {s.id === 'structure' ? '🏗️' : s.id === 'finishing' ? '🏛️' : '❄️'}
                    </div>
                    <h3>{s.title}</h3>
                    <p>{s.summary}</p>
                    <ul>
                      {s.items.map((item) => (
                        <li key={item}>
                          <span style={{ color: 'var(--o)', fontWeight: 900 }}>✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>

              {/* حاسبة المقاولات السريعة 3×1 */}
              <div className="pw-calc-box">
                <div className="pw-calc-head">
                  <div>
                    <span className="pw-explorer-kicker">أداة التسعير الهندسي التفاعلية 3×1</span>
                    <h3>احسب مقايسة مشروعك (عظم + تشطيب + كهروميكانيك) خلال ثوانٍ</h3>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <a href="#capital-tower" className="pw-btn pw-btn-ghost" style={{ minHeight: '38px', padding: '0 14px', fontSize: '0.82rem' }}>
                      🏢 المجسم 3D
                    </a>
                    <a href="#bim" className="pw-btn pw-btn-ghost" style={{ minHeight: '38px', padding: '0 14px', fontSize: '0.82rem' }}>
                      📐 نموذج BIM
                    </a>
                  </div>
                </div>

                <div className="pw-calc-grid">
                  <div className="pw-calc-controls">
                    <div className="pw-seg">
                      {(
                        [
                          { id: 'villa', label: 'فيلا سكنية' },
                          { id: 'tower', label: 'عمارة / برج' },
                          { id: 'duplex', label: 'دوبلكس / شقة' },
                          { id: 'commercial', label: 'تجاري / إداري' },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className={calcType === t.id ? 'is-on' : ''}
                          onClick={() => setCalcType(t.id)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    <div className="pw-calc-sliders">
                      <label className="pw-range">
                        <span>مساحة الدور الواحد: <strong>{calcArea} م²</strong></span>
                        <input
                          type="range"
                          min={80}
                          max={1500}
                          step={10}
                          value={calcArea}
                          onChange={(e) => setCalcArea(Number(e.target.value))}
                        />
                      </label>
                      <label className="pw-range">
                        <span>عدد الأدوار: <strong>{calcFloors} {calcFloors === 1 ? 'دور' : 'أدوار'}</strong></span>
                        <input
                          type="range"
                          min={1}
                          max={12}
                          step={1}
                          value={calcFloors}
                          onChange={(e) => setCalcFloors(Number(e.target.value))}
                        />
                      </label>
                    </div>

                    <div className="pw-calc-scopes">
                      <label className={`pw-scope-toggle ${calcScopes.structural ? 'is-on' : ''}`}>
                        <input
                          type="checkbox"
                          checked={calcScopes.structural}
                          onChange={() =>
                            setCalcScopes((p) =>
                              !p.finishing && !p.mep && p.structural ? p : { ...p, structural: !p.structural }
                            )
                          }
                        />
                        <span>🏗️ الإنشاءات والعظم</span>
                      </label>
                      <label className={`pw-scope-toggle ${calcScopes.finishing ? 'is-on' : ''}`}>
                        <input
                          type="checkbox"
                          checked={calcScopes.finishing}
                          onChange={() =>
                            setCalcScopes((p) =>
                              !p.structural && !p.mep && p.finishing ? p : { ...p, finishing: !p.finishing }
                            )
                          }
                        />
                        <span>✨ التشطيبات المعمارية</span>
                      </label>
                      <label className={`pw-scope-toggle ${calcScopes.mep ? 'is-on' : ''}`}>
                        <input
                          type="checkbox"
                          checked={calcScopes.mep}
                          onChange={() =>
                            setCalcScopes((p) =>
                              !p.structural && !p.finishing && p.mep ? p : { ...p, mep: !p.mep }
                            )
                          }
                        />
                        <span>❄️ تكييف مخفي وكهروميكانيك MEP</span>
                      </label>
                    </div>

                    <div className="pw-seg">
                      {(
                        [
                          { id: 'standard', label: 'مواصفة قياسية معتمدة' },
                          { id: 'deluxe', label: 'تشطيب ديلوكس فاخر' },
                          { id: 'royal', label: 'ملكي Ultra VIP + سمارت' },
                        ] as const
                      ).map((tier) => (
                        <button
                          key={tier.id}
                          type="button"
                          className={calcTier === tier.id ? 'is-on' : ''}
                          onClick={() => setCalcTier(tier.id)}
                        >
                          {tier.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pw-calc-summary">
                    <div className="pw-calc-summary-top">
                      <span>إجمالي المسطح البنائي (BUA)</span>
                      <strong>{contractingStats.totalBua.toLocaleString()} م²</strong>
                      {contractingStats.allOn && (
                        <span className="pw-discount-pill">🎁 يشمل خصم التكامل 3×1 (توفير 7% ومنع التكسير)</span>
                      )}
                    </div>

                    <div className="pw-calc-metrics">
                      <div><small>خرسانة تقريبية</small><strong>{contractingStats.concreteCbm} م³</strong></div>
                      <div><small>حديد تسليح</small><strong>{contractingStats.steelTons} طن</strong></div>
                      <div><small>دهانات (بستلة)</small><strong>{contractingStats.paintBuckets} بستلة</strong></div>
                      <div><small>قدرة تكييف</small><strong>{contractingStats.hvacTons} طن</strong></div>
                      <div><small>المدة المتوقعة</small><strong>{contractingStats.months} شهر</strong></div>
                      <div><small>باقة المقايسة</small><strong>{calcTier === 'standard' ? 'قياسي' : calcTier === 'deluxe' ? 'ديلوكس' : 'VIP'}</strong></div>
                    </div>

                    <button
                      type="button"
                      className="pw-btn pw-btn-primary"
                      style={{ width: '100%' }}
                      onClick={() =>
                        openWhatsApp(
                          `طلب عرض سعر رسمي لمشروع (${calcType}) بمسطح ${contractingStats.totalBua} م² (${calcFloors} أدوار × ${calcArea} م²) — مستوى (${calcTier}) — النطاق: ${[
                            calcScopes.structural && 'عظم',
                            calcScopes.finishing && 'تشطيبات',
                            calcScopes.mep && 'MEP',
                          ]
                            .filter(Boolean)
                            .join(' + ')}.`
                        )
                      }
                    >
                      📲 اطلب تسعير ومعاينة هذه المقايسة على واتساب
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* C. قسم العقارات */}
          {activeSection === 'real_estate' && (
            <div className="pw-explorer-body">
              <div className="pw-chip-bar">
                {[
                  { id: 'all', label: `كل الوحدات (${properties.length})` },
                  { id: 'apartment', label: 'شقق سكنية واستثمارية' },
                  { id: 'duplex', label: 'دوبلكس بحديقة' },
                  { id: 'commercial', label: 'معارض ووحدات تجارية' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`pw-chip ${propFilter === f.id ? 'is-on' : ''}`}
                    onClick={() => setPropFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
                <Link
                  href="/real-estate"
                  className="pw-chip"
                  style={{ borderColor: 'var(--o)', color: 'var(--o)', fontWeight: 900 }}
                >
                  🏢 فتح صفحة العقارات الكاملة ←
                </Link>
              </div>

              <div className="pw-re-grid">
                {filteredProperties.map((prop) => (
                  <article key={prop.id} className="pw-re-card">
                    <div>
                      <div className="pw-re-card-top">
                        <span className="pw-badge">{prop.code} · {prop.typeLabel}</span>
                        {prop.badge && <span className="pw-re-hot">{prop.badge}</span>}
                      </div>
                      <h3>{prop.title}</h3>
                      <p className="pw-re-sub">{prop.subtitle}</p>

                      <div className="pw-re-specs">
                        <div><small>المساحة</small><strong>{prop.areaSqm} م²</strong></div>
                        <div><small>الغرف / الحمام</small><strong>{prop.bedrooms > 0 ? `${prop.bedrooms} غرف · ${prop.bathrooms} حمام` : 'معرض مفتوح'}</strong></div>
                        <div><small>الموقع</small><strong>{prop.city}</strong></div>
                        <div><small>التشطيب</small><strong>{prop.finishingLabel}</strong></div>
                      </div>

                      <ul className="pw-re-features">
                        {prop.features.map((feat) => (
                          <li key={feat}>✓ {feat}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="pw-re-foot">
                      <span className="pw-re-terms">
                        💳 مقدم {prop.downPaymentPct || 25}% · تقسيط حتى {prop.installmentYears || 3} سنوات ({prop.deliveryLabel})
                      </span>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="pw-btn pw-btn-primary"
                          style={{ minHeight: '38px', padding: '0 14px', fontSize: '0.82rem' }}
                          onClick={() =>
                            openWhatsApp(
                              `استفسار عقاري عن (${prop.title} - كود ${prop.code} - مساحة ${prop.areaSqm} م²). أرجو تزويدي بالمسقط المعماري وتفاصيل السعر والسداد.`
                            )
                          }
                        >
                          📋 طلب عرض السعر والمعاينة
                        </button>
                        <a
                          href="#capital-tower"
                          className="pw-btn pw-btn-ghost"
                          style={{ minHeight: '38px', padding: '0 12px', fontSize: '0.82rem' }}
                        >
                          🏙️ المجسم 3D
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {/* حاسبة الأقساط التفاعلية */}
              <div className="pw-calc-box" style={{ marginTop: '24px' }}>
                <div className="pw-calc-head">
                  <div>
                    <span className="pw-explorer-kicker">أداة التخطيط المالي للعقار</span>
                    <h3>حاسبة المقدم والأقساط العقارية</h3>
                  </div>
                </div>
                <div className="pw-calc-sliders" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px' }}>
                  <label className="pw-range">
                    <span>قيمة الوحدة التقديرية: <strong>{estUnitPrice.toLocaleString()}</strong></span>
                    <input
                      type="range"
                      min={1500000}
                      max={15000000}
                      step={250000}
                      value={estUnitPrice}
                      onChange={(e) => setEstUnitPrice(Number(e.target.value))}
                    />
                  </label>
                  <label className="pw-range">
                    <span>نسبة المقدم: <strong>{estDownPct}%</strong></span>
                    <input
                      type="range"
                      min={10}
                      max={60}
                      step={5}
                      value={estDownPct}
                      onChange={(e) => setEstDownPct(Number(e.target.value))}
                    />
                  </label>
                  <label className="pw-range">
                    <span>سنوات السداد: <strong>{estYears} سنوات</strong></span>
                    <input
                      type="range"
                      min={1}
                      max={6}
                      step={1}
                      value={estYears}
                      onChange={(e) => setEstYears(Number(e.target.value))}
                    />
                  </label>
                </div>
                <div className="pw-calc-metrics" style={{ marginTop: '14px', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                  <div><small>قيمة المقدم ({estDownPct}%)</small><strong>{installmentCalc.downPayment.toLocaleString()}</strong></div>
                  <div><small>المبلغ المتبقي</small><strong>{installmentCalc.remaining.toLocaleString()}</strong></div>
                  <div><small>قسط شهري تقديري</small><strong>{installmentCalc.monthly.toLocaleString()}</strong></div>
                  <div><small>أو قسط ربع سنوي</small><strong>{installmentCalc.quarterly.toLocaleString()}</strong></div>
                </div>
              </div>
            </div>
          )}

          {/* D. قسم بيع وشراء مواد البناء */}
          {activeSection === 'building_materials' && (
            <div className="pw-explorer-body">
              <div className="pw-seg" style={{ marginBottom: '18px' }}>
                <button
                  type="button"
                  className={materialsMode === 'buy' ? 'is-on' : ''}
                  onClick={() => setMaterialsMode('buy')}
                >
                  🛒 شراء وتوريد مواد البناء والتشطيبات لمشروعك
                </button>
                <button
                  type="button"
                  className={materialsMode === 'sell' ? 'is-on' : ''}
                  onClick={() => setMaterialsMode('sell')}
                >
                  🤝 بيع مواد بناء / تقديم عرض أسعار مورد أو فائض موقع
                </button>
              </div>

              {materialsMode === 'buy' ? (
                <>
                  <div className="pw-chip-bar">
                    <button
                      type="button"
                      className={`pw-chip ${materialCatFilter === 'all' ? 'is-on' : ''}`}
                      onClick={() => setMaterialCatFilter('all')}
                    >
                      كل خامات البناء والتشطيب ({materialProducts.length})
                    </button>
                    {PRODUCT_CATEGORIES.filter((c) => buildingMaterialCategories.includes(c.id)).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`pw-chip ${materialCatFilter === c.id ? 'is-on' : ''}`}
                        onClick={() => setMaterialCatFilter(c.id)}
                      >
                        {c.icon} {c.shortTitle}
                      </button>
                    ))}
                  </div>

                  {/* باقة دهانات ومعجون المشاريع المميزة (متوافقة مع أذون الصرف المعتمدة) */}
                  <div className="pw-materials-highlight">
                    <div>
                      <strong>🎨 توريد باقات المعجون والدهانات المعتمدة للمشاريع والفلل (بالكميات):</strong>
                      <span>
                        كيس معجون جدران أسمنتي (فتونيت داخلي) · بستلة همبل فيلر ومعجون فواصل جبس · كوتكس فيلر شقوق · برايمر همبل وتوباز · مايسترو مات إملشن · بروفايل كازا راستيكا 3MM · تيب دوكو وجوينت وكورنر تيب.
                      </span>
                    </div>
                    <button
                      type="button"
                      className="pw-btn pw-btn-primary"
                      style={{ minHeight: '40px', padding: '0 16px', fontSize: '0.84rem', whiteSpace: 'nowrap' }}
                      onClick={() =>
                        openWhatsApp(
                          'السلام عليكم، أرغب في تسعيرة جملة لتوريد خامات المعجون والدهانات (فتونيت، همبل فيلر، توباز، مايسترو، وبروفايل) لمشروعي.'
                        )
                      }
                    >
                      📦 اطلب عرض سعر جملة للكميات
                    </button>
                  </div>

                  <div className="pw-prod-grid">
                    {materialProducts.map((p) => {
                      const withInstall = Boolean(materialInstallMap[p.id]);
                      return (
                        <article key={p.id} className="pw-prod-card">
                          <div>
                            <div className="pw-prod-top">
                              <span className="pw-prod-code">{p.code}</span>
                              {p.badge && <span className="pw-prod-badge">{p.badge}</span>}
                            </div>
                            <h3>{p.name}</h3>
                            <p className="pw-prod-desc">{p.description}</p>
                            <ul className="pw-prod-specs">
                              {p.specs.slice(0, 3).map((s) => (
                                <li key={s}>• {s}</li>
                              ))}
                            </ul>
                          </div>

                          <div className="pw-prod-foot">
                            <label className="pw-prod-install-check">
                              <input
                                type="checkbox"
                                checked={withInstall}
                                onChange={() =>
                                  setMaterialInstallMap((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                                }
                              />
                              <span>شامل التركيب / التنفيذ الهندسي</span>
                            </label>
                            <div className="pw-prod-actions">
                              <button
                                type="button"
                                className="pw-btn pw-btn-primary"
                                style={{ flex: 1, minHeight: '38px', padding: '0 12px', fontSize: '0.82rem' }}
                                onClick={() => onAddToCart(p, 1, withInstall)}
                              >
                                🛒 أضف للسلة ({p.unit})
                              </button>
                              <button
                                type="button"
                                className="pw-btn pw-btn-ghost"
                                style={{ minHeight: '38px', padding: '0 12px', fontSize: '0.82rem' }}
                                onClick={() =>
                                  openWhatsApp(`أحتاج عرض سعر لمنتج: ${p.name} (${p.code}) — الوحدة: ${p.unit}`)
                                }
                              >
                                السعر
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="pw-calc-box">
                  <div className="pw-calc-head">
                    <div>
                      <span className="pw-explorer-kicker">منصة المشتريات والتوريدات — فاي تك</span>
                      <h3>اعرض مواد بناء أو خامات تشطيب للبيع / التوريد لمشاريعنا</h3>
                      <p style={{ color: 'var(--ink-2)', fontSize: '0.92rem', marginTop: '4px' }}>
                        سواء كنت شركة توريد، مصنعاً، تاجراً، أو تملك كميات فائضة عن موقعك (حديد، أسمنت، دهانات، بورسلان، كابلات، مواسير)، سجّل العرض وسيتم مراجعته من إدارة المشتريات.
                      </p>
                    </div>
                  </div>

                  <form className="pw-form" onSubmit={handleSellSubmit}>
                    <div className="pw-grid2">
                      <label className="pw-field">
                        <span>اسم الخامة / الصنف المعروض للبيع *</span>
                        <input
                          required
                          placeholder="مثال: 200 كيس معجون فتونيت أو 50 بستلة دهان همبل"
                          value={sellMaterialName}
                          onChange={(e) => setSellMaterialName(e.target.value)}
                        />
                      </label>
                      <label className="pw-field">
                        <span>رقم الجوال / الواتساب للتواصل *</span>
                        <input
                          required
                          dir="ltr"
                          placeholder="+20... / +966..."
                          value={sellPhone}
                          onChange={(e) => setSellPhone(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="pw-grid-fields">
                      <label className="pw-field">
                        <span>الكمية المتوفرة</span>
                        <input
                          placeholder="مثال: 100"
                          value={sellQty}
                          onChange={(e) => setSellQty(e.target.value)}
                        />
                      </label>
                      <label className="pw-field">
                        <span>الوحدة</span>
                        <input
                          value={sellUnit}
                          onChange={(e) => setSellUnit(e.target.value)}
                        />
                      </label>
                      <label className="pw-field">
                        <span>السعر المعروض (اختياري)</span>
                        <input
                          placeholder="السعر للوحدة أو الإجمالي"
                          value={sellPrice}
                          onChange={(e) => setSellPrice(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="pw-grid2">
                      <label className="pw-field">
                        <span>المدينة / موقع التخزين</span>
                        <input
                          value={sellCity}
                          onChange={(e) => setSellCity(e.target.value)}
                        />
                      </label>
                      <label className="pw-field">
                        <span>تفاصيل الحالة أو المواصفة</span>
                        <input
                          placeholder="تاريخ الصلاحية، الماركة، الفاتورة الضريبية..."
                          value={sellNotes}
                          onChange={(e) => setSellNotes(e.target.value)}
                        />
                      </label>
                    </div>
                    <button type="submit" className="pw-btn pw-btn-primary">
                      🤝 إرسال عرض البيع لإدارة المشتريات عبر واتساب والنظام
                    </button>
                    {sellSubmitted && (
                      <div className="pw-answer" style={{ padding: '12px 16px' }}>
                        <span>✓ تم تجهيز وإرسال عرض البيع بنجاح لإدارة المشتريات في فاي تك.</span>
                      </div>
                    )}
                  </form>
                </div>
              )}
            </div>
          )}

          {/* E. قسم التكنولوجيا والسمارت هوم */}
          {activeSection === 'smart_tech' && (
            <div className="pw-explorer-body">
              {/* Smart Home Configurator */}
              <div className="pw-calc-box" style={{ marginBottom: '26px', borderColor: 'rgba(5,150,105,0.35)' }}>
                <div className="pw-calc-head">
                  <div>
                    <span className="pw-explorer-kicker" style={{ color: '#059669' }}>أداة التخصيص الذكي — بدون تكسير</span>
                    <h3>صمّم منظومة السمارت هوم والأمان لوحدتك في 4 اختيارات</h3>
                  </div>
                </div>
                <div className="pw-calc-grid">
                  <div className="pw-calc-controls">
                    <div className="pw-calc-sliders">
                      <label className="pw-range">
                        <span>عدد الغرف / خطوط الإضاءة الذكية: <strong>{shRooms} غرف</strong></span>
                        <input type="range" min={1} max={10} value={shRooms} onChange={(e) => setShRooms(Number(e.target.value))} />
                      </label>
                      <label className="pw-range">
                        <span>عدد التكييفات للتحكم عن بُعد: <strong>{shAcs} تكييفات</strong></span>
                        <input type="range" min={0} max={8} value={shAcs} onChange={(e) => setShAcs(Number(e.target.value))} />
                      </label>
                      <label className="pw-range">
                        <span>كاميرات مراقبة IP 4K: <strong>{shCamerasCount} كاميرات</strong></span>
                        <input type="range" min={0} max={16} step={4} value={shCamerasCount} onChange={(e) => setShCamerasCount(Number(e.target.value))} />
                      </label>
                    </div>
                    <div className="pw-calc-scopes">
                      <label className={`pw-scope-toggle ${shIncludeLock ? 'is-on' : ''}`}>
                        <input type="checkbox" checked={shIncludeLock} onChange={() => setShIncludeLock((v) => !v)} />
                        <span>🔐 قفل باب ذكي بالكاميرا والبصمة</span>
                      </label>
                      <label className={`pw-scope-toggle ${shIncludeSafety ? 'is-on' : ''}`}>
                        <input type="checkbox" checked={shIncludeSafety} onChange={() => setShIncludeSafety((v) => !v)} />
                        <span>🚨 درع الأمان (محابس غاز ومياه تلقائية + دخان)</span>
                      </label>
                    </div>
                  </div>
                  <div className="pw-calc-summary">
                    <div className="pw-calc-summary-top">
                      <span>تكوين الباقة الذكية المقترحة لك</span>
                      <strong>{shRooms} غرف ذكية + {shCamerasCount} كاميرا</strong>
                    </div>
                    <ul className="pw-prod-specs" style={{ marginBottom: '12px' }}>
                      <li>✓ شاشة تحكم مركزية 4 بوصة + Zigbee Hub</li>
                      <li>✓ {shRooms} مفاتيح لمس ذكية Wi-Fi/Zigbee</li>
                      {shAcs > 0 && <li>✓ {shAcs} وحدة تحكم ذكي بالتكييفات عبر الجوال</li>}
                      {shIncludeLock && <li>✓ قفل باب ذكي 6×1 يرسل صورة الزائر لجوالك</li>}
                      {shIncludeSafety && <li>✓ حساس غاز + حساسين مياه بمحبس فصل أوتوماتيكي + حساسات حريق</li>}
                    </ul>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button type="button" className="pw-btn pw-btn-primary" onClick={handleAddConfiguredSmartPackage}>
                        🛒 إضافة الباقة المصممة للسلة (شامل البرمجة)
                      </button>
                      <button
                        type="button"
                        className="pw-btn pw-btn-ghost"
                        onClick={() =>
                          openWhatsApp(
                            `أريد تسعير ومعاينة باقة سمارت هوم مخصصة: ${shRooms} غرف، ${shAcs} تكييفات، ${shCamerasCount} كاميرات${shIncludeLock ? '، قفل باب ذكي' : ''}${shIncludeSafety ? '، حساسات الغاز والمياه والحريق' : ''}.`
                          )
                        }
                      >
                        📲 استشارة مهندس السمارت هوم عبر واتساب
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pw-prod-grid">
                {smartProducts.map((p) => (
                  <article key={p.id} className="pw-prod-card">
                    <div>
                      <div className="pw-prod-top">
                        <span className="pw-prod-code">{p.code}</span>
                        {p.badge && <span className="pw-prod-badge">{p.badge}</span>}
                      </div>
                      <h3>{p.name}</h3>
                      <p className="pw-prod-desc">{p.description}</p>
                      <ul className="pw-prod-specs">
                        {p.specs.slice(0, 3).map((s) => (
                          <li key={s}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="pw-prod-foot">
                      <div className="pw-prod-actions">
                        <button
                          type="button"
                          className="pw-btn pw-btn-primary"
                          style={{ flex: 1, minHeight: '38px', padding: '0 12px', fontSize: '0.82rem' }}
                          onClick={() => onAddToCart(p, 1, true)}
                        >
                          🛒 أضف مع البرمجة والتركيب
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* F. قسم معلومات عامة */}
          {activeSection === 'general_info' && (
            <div className="pw-explorer-body">
              <div className="pw-info-shortcuts">
                <a href="#checklist" className="pw-info-shortcut-card">
                  <span>📋</span>
                  <div>
                    <strong>دليل التنفيذ الهندسي وقوائم الاستلام</strong>
                    <small>تسلسل كل بند وما يُراجع قبل الصب والتشطيب</small>
                  </div>
                </a>
                <a href="#tools" className="pw-info-shortcut-card">
                  <span>📐</span>
                  <div>
                    <strong>حاسبات المهندس المجانية</strong>
                    <small>احسب كميات الخرسانة والحديد والبلاط والدهان</small>
                  </div>
                </a>
                <Link href="/verify" className="pw-info-shortcut-card">
                  <span>🔐</span>
                  <div>
                    <strong>التحقق من صحة المستندات والعقود</strong>
                    <small>بوابة التحقق الرقمية لمستندات فاي تك الرسمية</small>
                  </div>
                </Link>
              </div>

              <h3 style={{ fontSize: '1.15rem', fontWeight: 900, margin: '24px 0 14px' }}>
                💡 نصائح هندسية ذهبية توفر عليك الوقت والتكلفة وأخطاء المواقع
              </h3>
              <div className="pw-tips-grid">
                {GENERAL_ENGINEERING_TIPS.map((item) => (
                  <article key={item.title} className="pw-tip-card">
                    <span className="pw-tip-tag">{item.tag}</span>
                    <h4>{item.title}</h4>
                    <p>{item.tip}</p>
                  </article>
                ))}
              </div>

              <div className="pw-info-meta-row">
                <div className="pw-contact-card" style={{ flex: 1 }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '12px' }}>🛡️ التزامات فاي تك في كل موقع</h4>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {commitments.map((cm) => (
                      <li key={cm.title} style={{ display: 'block', padding: '0 0 10px', borderBottom: '1px solid var(--line)' }}>
                        <strong style={{ display: 'block', marginBottom: '2px' }}>{cm.title}</strong>
                        <span style={{ fontSize: '0.88rem', color: 'var(--ink-2)' }}>{cm.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pw-contact-card" style={{ flex: 1 }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '12px' }}>⏳ مراحل العمل من المعاينة للتسليم</h4>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {steps.map((st) => (
                      <li key={st.n} style={{ display: 'flex', justifyContent: 'flex-start', gap: '10px', padding: '0 0 10px', borderBottom: '1px solid var(--line)' }}>
                        <span style={{ color: 'var(--o)', fontWeight: 900 }}>{st.n}</span>
                        <div>
                          <strong style={{ display: 'block', marginBottom: '2px' }}>{st.title}</strong>
                          <span style={{ fontSize: '0.88rem', color: 'var(--ink-2)' }}>{st.text}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pw-faq" style={{ marginTop: '24px', maxWidth: '100%' }}>
                {faqs.map((f) => (
                  <details key={f.q}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. مستشار فاي تك التفاعلي — خطط لمشروعك في 30 ثانية */}
      <section className="pw-section" aria-labelledby="advisor-heading">
        <div className="pw-wrap">
          <div className="pw-advisor-shell">
            <div className="pw-advisor-left">
              <p className="pw-eyebrow">تجربة تفاعلية فورية</p>
              <h2 id="advisor-heading">مستشار فاي تك التفاعلي — خطط لمشروعك في 30 ثانية</h2>
              <p className="pw-muted" style={{ marginBottom: '18px' }}>
                حدد هدفك ومساحة وحدتك ليقترح عليك النظام الخطة الهندسية المثلى والكميات الأولية والمدة الزمنية المتوقعة.
              </p>

              <div className="pw-seg" style={{ marginBottom: '16px' }}>
                {(
                  [
                    { id: 'build', label: '🏗️ بناء وتأسيس' },
                    { id: 'finish', label: '🎨 تشطيب متكامل' },
                    { id: 'smart', label: '📱 سمارت هوم وأمان' },
                    { id: 'maintain', label: '🛠️ صيانة وترميم' },
                  ] as const
                ).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={advisorGoal === g.id ? 'is-on' : ''}
                    onClick={() => setAdvisorGoal(g.id)}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              <label className="pw-range" style={{ marginBottom: '16px' }}>
                <span>المساحة التقريبية للوحدة / المشروع: <strong>{advisorArea} م²</strong></span>
                <input
                  type="range"
                  min={60}
                  max={1000}
                  step={10}
                  value={advisorArea}
                  onChange={(e) => setAdvisorArea(Number(e.target.value))}
                />
              </label>

              <div className="pw-seg">
                {(
                  [
                    { id: 'economic', label: 'باقة اقتصادية عملية' },
                    { id: 'luxury', label: 'باقة ديلوكس هندسية' },
                    { id: 'vip', label: 'باقة فندقية الترا VIP' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={advisorTier === t.id ? 'is-on' : ''}
                    onClick={() => setAdvisorTier(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pw-advisor-right">
              <span className="pw-badge">النتيجة الهندسية المقترحة</span>
              <h3>{advisorResult.headline}</h3>
              <p className="pw-advisor-duration">⏱️ المدة التنفيذية المقدرة: <strong>{advisorResult.duration}</strong></p>

              <div className="pw-advisor-metrics">
                {advisorResult.metrics.map((m) => (
                  <div key={m.label}>
                    <small>{m.label}</small>
                    <strong>{m.val}</strong>
                  </div>
                ))}
              </div>

              <div className="pw-mnt-tip" style={{ marginBottom: '14px' }}>
                <strong>💡 توصية المستشار الهندسي:</strong>
                <span>{advisorResult.recommendation}</span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <button
                  type="button"
                  className="pw-btn pw-btn-primary"
                  onClick={() => handlePortalClick(advisorResult.targetSection)}
                >
                  افتح القسم المناسب الآن ↑
                </button>
                <button
                  type="button"
                  className="pw-btn pw-btn-ghost"
                  onClick={() =>
                    openWhatsApp(
                      `نتيجة مستشار فاي تك: ${advisorResult.headline} (مستوى ${advisorTier}). أرجو التواصل لإعداد المقايسة النهائية.`
                    )
                  }
                >
                  📲 إرسال التوصية على واتساب
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. أهم العروض والباقات الحصرية */}
      <section className="pw-section pw-tint" aria-labelledby="offers-heading">
        <div className="pw-wrap">
          <div className="pw-head">
            <p className="pw-eyebrow">عروض وباقات فاي تك الحصرية</p>
            <h2 id="offers-heading">أهم الباقات الذكية والعروض التوفيرية</h2>
            <p>باقات مجمعة بعناية من المهندسين لتوفير الوقت وضمان توافق جميع الأجهزة والخامات مع تركيب وبرمجة شاملة.</p>
          </div>

          <div className="pw-offers-grid">
            {SMART_BUNDLES.map((bundle) => (
              <article key={bundle.id} className="pw-offer-card">
                <div>
                  <span className="pw-re-hot">{bundle.badge}</span>
                  <h3>{bundle.title}</h3>
                  <p>{bundle.subtitle}</p>
                  <ul className="pw-re-features">
                    {bundle.items.map((it) => (
                      <li key={it}>✓ {it}</li>
                    ))}
                  </ul>
                </div>
                <div className="pw-offer-actions">
                  <button
                    type="button"
                    className="pw-btn pw-btn-primary"
                    onClick={() => {
                      const itemsList: { product: WebsiteProduct; qty: number }[] = [];
                      for (const ref of bundle.productIds) {
                        const found = products.find((p) => p.id === ref.productId);
                        if (found) itemsList.push({ product: found, qty: ref.qty });
                      }
                      if (itemsList.length > 0) onAddBundleToCart(itemsList, true);
                    }}
                  >
                    🛒 أضف الباقة كاملة للسلة
                  </button>
                  <button
                    type="button"
                    className="pw-btn pw-btn-ghost"
                    onClick={() =>
                      openWhatsApp(`أريد الاستفسار عن عرض (${bundle.title}) وسعر التوريد والتركيب.`)
                    }
                  >
                    استفسار واتساب
                  </button>
                </div>
              </article>
            ))}

            <article className="pw-offer-card is-highlight">
              <div>
                <span className="pw-re-hot">🔥 عرض التعاقد المتكامل 3×1</span>
                <h3>خصم 7% على التعاقد الهندسي المتكامل + مخططات Shop Drawings</h3>
                <p>
                  عند تنفيذ الإنشاءات والتشطيبات والكهروميكانيك مع فاي تك تحصل على خصم مباشر على الإجمالي ومخططات تنفيذية مجانية تمنع التكسير.
                </p>
                <ul className="pw-re-features">
                  <li>✓ تنسيق كامل لمسارات التكييف المخفي والسباكة قبل الصب واللياسة</li>
                  <li>✓ ضمان موحّد من جهة تنفيذ واحدة وإشراف هندسي يومي</li>
                  <li>✓ تقارير تقدم دورية ومتابعة عبر بوابة العملاء</li>
                </ul>
              </div>
              <div className="pw-offer-actions">
                <button
                  type="button"
                  className="pw-btn pw-btn-primary"
                  onClick={() => handlePortalClick('contracting')}
                >
                  🏗️ احسب عرضك الآن
                </button>
                <a href="#contact" className="pw-btn pw-btn-ghost">
                  احجز معاينة
                </a>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* 5. أهم المنتجات المختارة من المتجر */}
      <section className="pw-section" aria-labelledby="featured-products-heading">
        <div className="pw-wrap">
          <div className="pw-head">
            <p className="pw-eyebrow">أهم المنتجات الأكثر طلباً</p>
            <h2 id="featured-products-heading">خامات التشطيب وأجهزة السمارت هوم وحساسات الأمان</h2>
            <p>أضف المنتجات مباشرة إلى سلتك مع خيار التركيب والبرمجة الهندسية المعتمدة أو افتح المتجر الكامل.</p>
          </div>

          <div className="pw-chip-bar" style={{ justifyContent: 'center' }}>
            {[
              { id: 'all', label: '⭐ المختارات الأبرز' },
              { id: 'smart', label: '📱 سمارت هوم وكاميرات وحساسات' },
              { id: 'mep', label: '⚡ كهرباء وإنارة وسباكة' },
              { id: 'finishing', label: '🎨 دهانات وبورسلان ورخام وديكور' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                className={`pw-chip ${featuredTab === t.id ? 'is-on' : ''}`}
                onClick={() => setFeaturedTab(t.id as typeof featuredTab)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="pw-prod-grid">
            {featuredProducts.map((p) => {
              const withInstall = Boolean(featuredInstallMap[p.id]);
              return (
                <article key={p.id} className="pw-prod-card">
                  <div>
                    <div className="pw-prod-top">
                      <span className="pw-prod-code">{p.code}</span>
                      {p.badge && <span className="pw-prod-badge">{p.badge}</span>}
                    </div>
                    <h3>{p.name}</h3>
                    <p className="pw-prod-desc">{p.description}</p>
                    <ul className="pw-prod-specs">
                      {p.specs.slice(0, 3).map((s) => (
                        <li key={s}>• {s}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="pw-prod-foot">
                    <label className="pw-prod-install-check">
                      <input
                        type="checkbox"
                        checked={withInstall}
                        onChange={() =>
                          setFeaturedInstallMap((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                        }
                      />
                      <span>توريد + تركيب هندسي</span>
                    </label>
                    <div className="pw-prod-actions">
                      <button
                        type="button"
                        className="pw-btn pw-btn-primary"
                        style={{ flex: 1, minHeight: '38px', padding: '0 12px', fontSize: '0.82rem' }}
                        onClick={() => onAddToCart(p, 1, withInstall)}
                      >
                        🛒 أضف للسلة
                      </button>
                      <button
                        type="button"
                        className="pw-btn pw-btn-ghost"
                        style={{ minHeight: '38px', padding: '0 12px', fontSize: '0.82rem' }}
                        onClick={() =>
                          openWhatsApp(`أريد طلب وسعر المنتج: ${p.name} (${p.code})`)
                        }
                      >
                        السعر
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginTop: '28px' }}>
            <Link href="/store" className="pw-btn pw-btn-primary">
              🛒 فتح متجر المنتجات الكامل ({products.length} منتج)
            </Link>
            <Link href="/store?tab=maintenance" className="pw-btn pw-btn-ghost">
              🛠️ صفحة التنفيذ والصيانة الشاملة
            </Link>
            <Link href="/real-estate" className="pw-btn pw-btn-ghost">
              🏢 صفحة عروض العقارات والوحدات ({properties.length})
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
