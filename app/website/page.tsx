"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function WebsitePage() {
  // Theme & Accent states
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [accent, setAccent] = useState<'amber' | 'emerald' | 'cyan'>('amber');
  const [heroLogoVariant, setHeroLogoVariant] = useState<'print-light' | 'web-dark' | 'luxury-foil'>('print-light');

  // Calculator states
  const [currencySymbol, setCurrencySymbol] = useState<'ج.م' | 'ر.س' | '$'>('ج.م');
  const [currencyRate, setCurrencyRate] = useState<number>(1);
  const [projectType, setProjectType] = useState<'villa' | 'hq' | 'mall' | 'datacenter'>('hq');
  const [specTier, setSpecTier] = useState<number>(1.35);
  const [areaPerFloor, setAreaPerFloor] = useState<number>(450);
  const [floors, setFloors] = useState<number>(3);
  const [activeScopes, setActiveScopes] = useState<{
    structural: boolean;
    architectural: boolean;
    technology: boolean;
  }>({
    structural: true,
    architectural: true,
    technology: true,
  });

  // X-Ray Layer Simulator
  const [activeLayer, setActiveLayer] = useState<'all' | 'structural' | 'architectural' | 'technology'>('all');

  // Portfolio Filter
  const [portfolioFilter, setPortfolioFilter] = useState<'all' | 'turnkey' | 'structural' | 'architectural' | 'technology'>('all');

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
  const [leadPackage, setLeadPackage] = useState('تسليم مفتاح متكامل 3×1 (عضم + تشطيبات + تقنية معلومات)');
  const [leadLocation, setLeadLocation] = useState('');
  const [leadNotes, setLeadNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  // Geometry calculation for the Attached Exact Logo ("مالي مكانه")
  const logoGeometry = useMemo(() => {
    const cx = 250;
    const cy = 250;
    const { rOut, thickness, verticalExt } = proportions;
    const rIn = Math.max(70, rOut - thickness);

    const centerGap = 10;
    const stemWidth = Math.round(thickness * 0.66);
    const xLeftInner = cx - centerGap / 2;
    const xLeftOuter = xLeftInner - stemWidth;
    const xRightInner = cx + centerGap / 2;
    const xRightOuter = xRightInner + stemWidth;

    const serifWidth = Math.round(stemWidth * 0.82);
    const serifHeight = Math.round(stemWidth * 0.78);
    const xLeftSerif = xLeftOuter - serifWidth;
    const xRightSerif = xRightOuter + serifWidth;

    const topCircleY = cy - rOut;
    const bottomCircleY = cy + rOut;
    const topY = Math.round(topCircleY - verticalExt);
    const topSerifBottomY = topY + serifHeight;

    const dxTotal = xRightOuter - xLeftOuter;
    const bottomLeftTipY = Math.round(bottomCircleY + verticalExt + 16);
    const bottomRightOuterY = bottomLeftTipY - dxTotal;
    const bottomRightInnerY = bottomLeftTipY - (xRightInner - xLeftOuter);
    const bottomLeftInnerY = bottomLeftTipY - (xLeftInner - xLeftOuter);

    const notchGap = Math.max(16, Math.round(stemWidth * 0.56));
    const xLeftNotch = xLeftOuter - notchGap;

    const dyCircle = (r: number, x: number) => {
      const d = Math.abs(x - cx);
      if (d >= r) return 0;
      return Math.sqrt(r * r - d * d);
    };

    const yLeftTopOut = (cy - dyCircle(rOut, xLeftNotch)).toFixed(1);
    const yLeftTopIn = (cy - dyCircle(rIn, xLeftNotch)).toFixed(1);
    const yLeftBotOut = (cy + dyCircle(rOut, xLeftOuter)).toFixed(1);
    const yLeftBotIn = (cy + dyCircle(rIn, xLeftOuter)).toFixed(1);

    const yRightTopOut = (cy - dyCircle(rOut, xRightOuter)).toFixed(1);
    const yRightTopIn = (cy - dyCircle(rIn, xRightOuter)).toFixed(1);
    const yRightBotOut = (cy + dyCircle(rOut, xRightOuter)).toFixed(1);
    const yRightBotIn = (cy + dyCircle(rIn, xRightOuter)).toFixed(1);

    const ringsPath = [
      `M ${xLeftNotch} ${yLeftTopOut}`,
      `A ${rOut} ${rOut} 0 0 0 ${xLeftOuter} ${yLeftBotOut}`,
      `L ${xLeftOuter} ${yLeftBotIn}`,
      `A ${rIn} ${rIn} 0 0 1 ${xLeftNotch} ${yLeftTopIn}`,
      `Z`,
      `M ${xRightOuter} ${yRightTopOut}`,
      `A ${rOut} ${rOut} 0 0 1 ${xRightOuter} ${yRightBotOut}`,
      `L ${xRightOuter} ${yRightBotIn}`,
      `A ${rIn} ${rIn} 0 0 0 ${xRightOuter} ${yRightTopIn}`,
      `Z`
    ].join(' ');

    const pillarsPath = [
      `M ${xLeftSerif} ${topY}`,
      `L ${xLeftInner} ${topY}`,
      `L ${xLeftInner} ${bottomLeftInnerY}`,
      `L ${xLeftOuter} ${bottomLeftTipY}`,
      `L ${xLeftOuter} ${topSerifBottomY}`,
      `L ${xLeftSerif} ${topSerifBottomY}`,
      `Z`,
      `M ${xRightInner} ${topY}`,
      `L ${xRightSerif} ${topY}`,
      `L ${xRightSerif} ${topSerifBottomY}`,
      `L ${xRightOuter} ${topSerifBottomY}`,
      `L ${xRightOuter} ${bottomRightOuterY}`,
      `L ${xRightInner} ${bottomRightInnerY}`,
      `Z`
    ].join(' ');

    const pad = 8;
    const minX = (cx - rOut) - pad;
    const maxX = (cx + rOut) + pad;
    const minY = topY - pad;
    const maxY = bottomLeftTipY + pad;
    const vbWidth = maxX - minX;
    const vbHeight = maxY - minY;
    const tightViewBox = `${minX} ${minY} ${vbWidth} ${vbHeight}`;

    return { ringsPath, pillarsPath, tightViewBox };
  }, [proportions]);

  // BoQ Calculation
  const boqCalculation = useMemo(() => {
    const totalBUA = areaPerFloor * floors;

    const typeFactors: Record<string, { struct: number; arch: number; tech: number }> = {
      villa: { struct: 5800, arch: 6500, tech: 1850 },
      hq: { struct: 6200, arch: 7200, tech: 2900 },
      mall: { struct: 6800, arch: 7500, tech: 2600 },
      datacenter: { struct: 7400, arch: 6200, tech: 6800 }
    };

    const rates = typeFactors[projectType] || typeFactors.hq;

    const structCost = activeScopes.structural
      ? Math.round(totalBUA * rates.struct * specTier * currencyRate)
      : 0;

    const archCost = activeScopes.architectural
      ? Math.round(totalBUA * rates.arch * specTier * currencyRate)
      : 0;

    const techCost = activeScopes.technology
      ? Math.round(totalBUA * rates.tech * specTier * currencyRate)
      : 0;

    const allThreeActive = activeScopes.structural && activeScopes.architectural && activeScopes.technology;
    const rawTotal = structCost + archCost + techCost;
    const grandTotal = allThreeActive ? Math.round(rawTotal * 0.93) : rawTotal;

    const steelTons = activeScopes.structural ? Math.round(totalBUA * 0.044) : 0;
    const itPoints = activeScopes.technology ? Math.round(totalBUA * 0.14) : 0;
    let months = 2;
    if (activeScopes.structural) months += Math.ceil(floors * 1.2);
    if (activeScopes.architectural) months += Math.ceil(floors * 1.1);
    if (activeScopes.technology) months += 1;
    if (allThreeActive) months = Math.max(4, Math.round(months * 0.78));

    return {
      totalBUA,
      structCost,
      archCost,
      techCost,
      grandTotal,
      allThreeActive,
      steelTons,
      itPoints,
      months,
    };
  }, [areaPerFloor, floors, projectType, specTier, currencyRate, activeScopes]);

  // X-Ray Layer Specs Data
  const layerSpecs = {
    all: {
      badge: 'FULL 3-IN-1 TURNKEY INTEGRATION',
      title: 'التكامل الهندسي الكامل (عضم + تشطيبات + تقنية معلومات)',
      desc: 'عندما تتولى PHI CONSTRUCT القطاعات الثلاثة معاً، يتم تصميم الهيكل الخرساني بممرات مدمجة مسبقاً للتكييف المركزي وكابلات الألياف الضوئية، مما يوفر 22% من التكلفة ويمنع أي تكسير أثناء التشطيب.',
      items: [
        { label: 'الإنشاءات والعضم', val: 'لبشة مسلحة + أعمدة وأسقف Flat Slab خرسانة جهد 400 كجم/سم²', color: '#fb923c' },
        { label: 'العمارة والتشطيبات', val: 'واجهات زجاجية عازلة + رخام مستورد + تكييف مركزي VRF', color: '#34d399' },
        { label: 'تقنية المعلومات IT', val: 'شبكة Fiber Optics + غرفة سيرفرات Tier-III + أتمتة BMS ذكية', color: '#38bdf8' }
      ]
    },
    structural: {
      badge: 'LAYER 01 — STRUCTURAL SKELETON',
      title: 'الطبقة الأولى: البناء الإنشائي والعضم (الأساسات والهيكل)',
      desc: 'العمود الفقري للمنشأة؛ ننفذه بإشراف استشاريين إنشائيين مع اختبارات الموجات فوق الصوتية ومكعبات الخرسانة واستلام المحاور بأجهزة Total Station.',
      items: [
        { label: 'الأساسات العميقة والسطحية', val: 'إحلال مدموك، خوازيق ساندة وحاملة، ولبشة مسلحة معزولة بالكامل', color: '#fb923c' },
        { label: 'الخرسانات المسلحة', val: 'حديد تسليح B500D عالي المقاومة وخرسانة جاهزة بمضخات هيدروليكية', color: '#fb923c' },
        { label: 'المباني والعزل', val: 'مباني طوب طفلي وأسمنتي على ميزان الليزر + عزل مائي وحراري للأسطح', color: '#fb923c' }
      ]
    },
    architectural: {
      badge: 'LAYER 02 — ARCHITECTURAL & FINISHING',
      title: 'الطبقة الثانية: الغلاف المعماري والتشطيبات الفاخرة',
      desc: 'تحويل المساحات الصماء إلى بيئة معمارية راقية تجمع بين فخامة الخامات الطبيعية وكفاءة الأنظمة الكهروميكانيكية.',
      items: [
        { label: 'الواجهات الخارجية', val: 'قطاعات ألومنيوم حرارية Double Glazed + تكسيات كلادينج وحجر طبيعي', color: '#34d399' },
        { label: 'الأرضيات والتجاليد', val: 'رخام إيطالي وإسباني بالوترجيت + تجاليد خشب جوز وأسقف معلقة صوتية', color: '#34d399' },
        { label: 'الإلكتروميكانيك MEP', val: 'أنظمة تكييف مخفي، تهوية نقية، شبكات تغذية وصرف معزولة صوتياً', color: '#34d399' }
      ]
    },
    technology: {
      badge: 'LAYER 03 — IT & SMART BUILDING SPINE',
      title: 'الطبقة الثالثة: تقنية المعلومات والأنظمة الذكية (IT & BMS)',
      desc: 'نؤسس بنية تحتية رقمية تجعل المبنى ذكياً، آمناً، وجاهزاً للمستقبل سواء كان مقراً إدارياً للشركات أو قصراً سكنياً ذكياً.',
      items: [
        { label: 'البنية التحتية للشبكات', val: 'كابلات هيكلية Cat6A/Cat7 وألياف ضوئية Fiber إلى كل طابق وغرفة', color: '#38bdf8' },
        { label: 'مراكز البيانات والسيرفرات', val: 'تجهيز غرف السيرفرات برفوف ذكية، أرضيات مرفوعة، وإطفاء غاز FM200', color: '#38bdf8' },
        { label: 'الأتمتة والأمن الذكي', val: 'نظام KNX/BMS للتحكم في الإضاءة والطاقة + كاميرات ذكاء اصطناعي وبوابات دخول', color: '#38bdf8' }
      ]
    }
  };

  // Portfolio items
  const portfolioItems = [
    {
      id: 'PHI-P01',
      title: 'المقر الإقليمي لشركة تكنولوجيا مالية — التجمع الخامس',
      category: 'turnkey',
      categoryLabel: 'تسليم مفتاح 3×1 (عضم + تشطيب + IT)',
      area: '4,200 م²',
      duration: '11 شهراً',
      accentColor: '#fb923c',
      structuralScope: 'تنفيذ بدروم + أرضي + 4 أدوار متكررة بنظام Flat Slab مع كور مصاعد خرساني.',
      archScope: 'واجهات زجاجية Structural Glazing، أرضيات رخام وبورسلين، وقاعات اجتماعات معزولة صوتياً.',
      itScope: 'تأسيس مركز بيانات Tier-III، تمديد 650 نقطة شبكة Cat6A، ونظام BMS للتحكم المركزي في التكييف والإضاءة.'
    },
    {
      id: 'PHI-P02',
      title: 'قصر أوبسيديان الذكي — الشيخ زايد',
      category: 'turnkey',
      categoryLabel: 'تسليم مفتاح 3×1 (عضم + تشطيب + سمارت هوم)',
      area: '1,450 م²',
      duration: '9 أشهر',
      accentColor: '#34d399',
      structuralScope: 'حفر صخري، لبشة مسلحة، هيكل خرساني ببحور واسعة (Post-Tension) وحمام سباحة إنفينيتي.',
      archScope: 'تشطيب فائق الفخامة برخام أونيكس، تجاليد خشب طبيعي، وتكييف VRF مخفي بالكامل.',
      itScope: 'منظومة KNX Smart Home شاملة للإضاءة والستائر والصوتيات، مع شبكة Wi-Fi 7 تغطي القصر والحدائق.'
    },
    {
      id: 'PHI-P03',
      title: 'تجهيز مركز البيانات والبنية التحتية — برج فاي الإداري',
      category: 'technology',
      categoryLabel: 'تقنية معلومات وأنظمة ذكية (IT & Data Center)',
      area: '2,800 م²',
      duration: '4 أشهر',
      accentColor: '#38bdf8',
      structuralScope: 'تدعيم إنشائي لأرضية غرفة السيرفرات لتحمل أوزان وحدات الـ UPS والبطاريات.',
      archScope: 'تركيب أرضيات مرفوعة Raised Floors، حوائط مقاومة للحريق لمدة ساعتين، وتبريد دقيق.',
      itScope: 'ربط ألياف ضوئية Fiber Backbone، تركيب 14 راك سيرفرات، نظام إطفاء غازي، وبوابات دخول بالبصمة والوجه.'
    },
    {
      id: 'PHI-P04',
      title: 'الهيكل الخرساني لمجمع فاي الطبي التجاري',
      category: 'structural',
      categoryLabel: 'بناء إنشائي وعضم (Structural Skeleton)',
      area: '6,500 م²',
      duration: '7 أشهر',
      accentColor: '#fb923c',
      structuralScope: 'تنفيذ 2 بدروم جراج + أرضي تجاري + 5 أدوار عيادات ومراكز أشعة بخرسانة عالية الإجهاد.',
      archScope: 'تأسيس مباني الواجهات والمناور وعزل الأساسات والأسطح بالكامل.',
      itScope: 'زرع مسارات وصواعد التيار الخفيف والـ Fiber داخل البلاطات الخرسانية قبل الصب.'
    },
    {
      id: 'PHI-P05',
      title: 'التشطيب المعماري والهوية البصرية لمقر مجموعة استشارية',
      category: 'architectural',
      categoryLabel: 'عمارة وتشطيبات داخلية فاخرة',
      area: '1,100 م²',
      duration: '3.5 أشهر',
      accentColor: '#34d399',
      structuralScope: 'تعديلات معمارية وتدعيم فتحات بكمر حديدي I-Beam.',
      archScope: 'أرضيات رخام وبورسلين، قواطع زجاجية دبل جلاس، أسقف جبسية بمسارات إضاءة مغناطيسية، وفرش مكتبي.',
      itScope: 'تجهيز قاعات المؤتمرات المرئية Video Conferencing ونظام الصوتيات الداخلي.'
    },
    {
      id: 'PHI-P06',
      title: 'مبنى المختبرات الذكية وحاضنة الأعمال التكنولوجية',
      category: 'technology',
      categoryLabel: 'مبنى ذكي وبنية تحتية رقمية',
      area: '3,200 م²',
      duration: '6 أشهر',
      accentColor: '#38bdf8',
      structuralScope: 'إنشاء قاعات بدون أعمدة داخلية باستخدام كمرات سابقة الإجهاد.',
      archScope: 'واجهات ألومنيوم كيرتن وول وتشطيبات مضادة للكهرباء الاستاتيكية.',
      itScope: 'شبكة ألياف ضوئية بسرعة 40Gbps، حساسات جودة هواء وحرارة، وتحكم ذكي في استهلاك الطاقة.'
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
      amber: 'الإنشاءات والعضم (Signature Amber)',
      emerald: 'العمارة والتشطيبات (Architectural Emerald)',
      cyan: 'تقنية المعلومات والأنظمة الذكية (Technical Cyan)',
    };
    showToast('تم تغيير لكنة النظام', `القطاع اللوني النشط: ${names[acc]}`);
  };

  const toggleScope = (scope: 'structural' | 'architectural' | 'technology') => {
    const count = Object.values(activeScopes).filter(Boolean).length;
    if (activeScopes[scope] && count === 1) {
      showToast('تنبيه هندسي', 'يجب تفعيل قطاع واحد على الأقل لحساب المقايسة التقديرية.');
      return;
    }
    setActiveScopes(prev => ({ ...prev, [scope]: !prev[scope] }));
  };

  const selectPresetScope = (scope: 'structural' | 'architectural' | 'technology') => {
    setActiveScopes({
      structural: scope === 'structural',
      architectural: scope === 'architectural',
      technology: scope === 'technology',
    });
    const el = document.getElementById('turnkey-calculator');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    showToast('تم تخصيص الحاسبة', 'تم ضبط الحاسبة لتسعير القطاع المختار، ويمكنك تفعيل باقي القطاعات للمقارنة.');
  };

  const transferBoQToForm = () => {
    const selectedScopes = [];
    if (activeScopes.structural) selectedScopes.push('بناء إنشائي وعضم');
    if (activeScopes.architectural) selectedScopes.push('تشطيبات معمارية وواجهات');
    if (activeScopes.technology) selectedScopes.push('تقنية معلومات وأنظمة ذكية IT');

    const summary = `مقايسة إلكترونية من الموقع:\n- إجمالي المسطح البنائي: ${boqCalculation.totalBUA.toLocaleString()} م²\n- النطاق المطلوب: (${selectedScopes.join(' + ')})\n- الميزانية التقديرية المحسوبة: ${boqCalculation.grandTotal.toLocaleString()} ${currencySymbol}\nنرجو التواصل لتحديد موعد معاينة هندسية وعرض سعر تفصيلي.`;

    setLeadNotes(summary);
    const el = document.getElementById('order-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    showToast('تم ترحيل المقايسة لنموذج التعاقد', 'أدخل اسمك ورقم الجوال لإرسال المقايسة لفريقنا الهندسي.');
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
        setLeadLocation('');
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
    let constructTextColor = '#f07613';
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
      constructTextColor = '#f07613';
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
      constructTextColor = '#f59e0b';
      subTextColor = '#94a3b8';
    } else if (studioColorMode === 'mono') {
      const isDark = studioBgSurface === 'dark' || studioBgSurface === 'transparent';
      const monoHex = isDark ? '#ffffff' : '#1e252b';
      ringsStops = `<stop offset="0%" stop-color="${monoHex}" /><stop offset="100%" stop-color="${monoHex}" />`;
      pillarsStops = `<stop offset="0%" stop-color="${monoHex}" /><stop offset="100%" stop-color="${monoHex}" />`;
      phiTextColor = monoHex;
      constructTextColor = monoHex;
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
      constructTextColor = '#f97316';
      subTextColor = '#b8aea2';
    }

    if (studioLockup === 'mark') {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${logoGeometry.tightViewBox}" width="100%" height="100%">
        <defs>
          <linearGradient id="expRings" x1="0%" y1="0%" x2="100%" y2="100%">${ringsStops}</linearGradient>
          <linearGradient id="expPillars" x1="0%" y1="0%" x2="0%" y2="100%">${pillarsStops}</linearGradient>
        </defs>
        <path d="${logoGeometry.ringsPath}" fill="url(#expRings)" />
        <path d="${logoGeometry.pillarsPath}" fill="url(#expPillars)" />
      </svg>`;
    }

    if (studioLockup === 'horizontal') {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 940 380" width="100%" height="100%">
        <defs>
          <linearGradient id="expRings" x1="0%" y1="0%" x2="100%" y2="100%">${ringsStops}</linearGradient>
          <linearGradient id="expPillars" x1="0%" y1="0%" x2="0%" y2="100%">${pillarsStops}</linearGradient>
        </defs>
        <g transform="translate(5, -5) scale(0.76)">
          <path d="${logoGeometry.ringsPath}" fill="url(#expRings)" />
          <path d="${logoGeometry.pillarsPath}" fill="url(#expPillars)" />
        </g>
        <text x="375" y="185" font-family="'JetBrains Mono', 'Cairo', sans-serif" font-size="66" font-weight="900" letter-spacing="5">
          <tspan fill="${phiTextColor}">PHI </tspan><tspan fill="${constructTextColor}">CONSTRUCT</tspan>
        </text>
        <text x="378" y="232" font-family="'JetBrains Mono', 'Cairo', sans-serif" font-size="19" font-weight="700" fill="${subTextColor}" letter-spacing="4.2">
          STRUCTURAL • ARCHITECTURAL • IT SYSTEMS
        </text>
      </svg>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 10 600 575" width="100%" height="100%">
      <defs>
        <linearGradient id="expRings" x1="0%" y1="0%" x2="100%" y2="100%">${ringsStops}</linearGradient>
        <linearGradient id="expPillars" x1="0%" y1="0%" x2="0%" y2="100%">${pillarsStops}</linearGradient>
      </defs>
      <g transform="translate(50, -5)">
        <path d="${logoGeometry.ringsPath}" fill="url(#expRings)" />
        <path d="${logoGeometry.pillarsPath}" fill="url(#expPillars)" />
      </g>
      <text x="300" y="520" text-anchor="middle" font-family="'JetBrains Mono', 'Cairo', sans-serif" font-size="46" font-weight="900" letter-spacing="6">
        <tspan fill="${phiTextColor}">PHI </tspan><tspan fill="${constructTextColor}">CONSTRUCT</tspan>
      </text>
      <text x="300" y="556" text-anchor="middle" font-family="'JetBrains Mono', 'Cairo', sans-serif" font-size="15" font-weight="700" fill="${subTextColor}" letter-spacing="3.8">
        GENERAL CONTRACTING &amp; CONSTRUCTION MGMT.
      </text>
    </svg>`;
  };

  const exportSvg = () => {
    const svgStr = buildStandaloneSvgMarkup();
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PHI-CONSTRUCT-${studioLockup}-${studioColorMode}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('تم تحميل ملف الفيكتور (SVG)', 'ملف الشعار المتجهي جاهز للمطابع بدقة غير محدودة.');
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
          a.download = `PHI-CONSTRUCT-${studioLockup}-${studioColorMode}-2048px.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(pngUrl);
          showToast('تم تحميل صورة PNG شفافة فائقة الدقة', `تم تصدير الشعار بخلفية شفافة بدقة ${width}×${height} بكسل.`);
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
    showToast('تم ضبط نسب الشعار الهندسية', 'أصبح الشعار ممتلئاً ومتناسقاً بدون هوامش ميتة.');
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

          <path id="phi-master-rings" d={logoGeometry.ringsPath} />
          <path id="phi-master-pillars" d={logoGeometry.pillarsPath} />
        </defs>
      </svg>

      {/* STYLESHEET OVERRIDES FOR BORDERLESS UI */}
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
        .it-data-stream {
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
              البوابة الرسمية المعتمدة لشركة <strong>PHI CONSTRUCT</strong> — مدمجة لحظياً بنظام إدارة العمليات والمشاريع
            </span>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/Dashboard"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-extrabold btn-primary"
              >
                <i className="fa-solid fa-desktop"></i>
                <span>لوحة تحكم النظام (ERP)</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold subcard-glass hover:text-amber-400 transition-colors"
              >
                <i className="fa-solid fa-lock"></i>
                <span>دخول المهندسين والموظفين (ERP Login)</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* STICKY BORDERLESS HEADER */}
      <header className="sticky top-0 z-50 header-surface px-4 sm:px-8 py-3.5 transition-all duration-300">
        <div className="specular-beam"></div>
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          
          {/* Brand Logo: Full-Bleed Vector Monogram */}
          <a href="#hero" className="flex items-center gap-3.5 group focus:outline-none">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl sunken-well-box p-1 flex items-center justify-center relative overflow-hidden">
              <svg viewBox={logoGeometry.tightViewBox} className="w-12 h-12 sm:w-13 sm:h-13 transition-transform duration-300 group-hover:scale-105" aria-label="PHI CONSTRUCT Logo">
                <use href="#phi-master-rings" fill={themeMode === 'light' ? 'url(#phiRingsPrint)' : 'url(#phiRingsWebDark)'} />
                <use href="#phi-master-pillars" fill={themeMode === 'light' ? 'url(#phiPillarsPrint)' : 'url(#phiPillarsWebDark)'} />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-black tracking-wider phi-metallic-text font-mono">PHI CONSTRUCT</span>
                <span className="badge-pill badge-accent text-[11px] hidden sm:inline-flex font-mono">BOLD FULL-BLEED Φ</span>
              </div>
              <p className="text-[11px] sm:text-xs font-bold tracking-wide" style={{ color: 'var(--text-muted)' }}>
                إنشاءات خرسانية (عضم) • تشطيبات معمارية • تقنية معلومات
              </p>
            </div>
          </a>

          {/* Navigation Links */}
          <nav className="hidden xl:flex items-center gap-1 sunken-well-box p-1.5">
            <a href="#hero" className="px-3.5 py-2 rounded-xl text-sm font-bold transition-all" style={{ color: 'var(--text-primary)' }}>الرئيسية</a>
            <a href="#three-pillars" className="px-3.5 py-2 rounded-xl text-sm font-bold transition-all" style={{ color: 'var(--text-secondary)' }}>القطاعات الثلاثة</a>
            <a href="#xray-twin" className="px-3.5 py-2 rounded-xl text-sm font-bold transition-all" style={{ color: 'var(--text-secondary)' }}>محاكي البناء 3D</a>
            <a href="#turnkey-calculator" className="px-3.5 py-2 rounded-xl text-sm font-bold transition-all" style={{ color: 'var(--text-secondary)' }}>حاسبة المقايسة</a>
            <a href="#portfolio" className="px-3.5 py-2 rounded-xl text-sm font-bold transition-all" style={{ color: 'var(--text-secondary)' }}>سابقة الأعمال</a>
            <a href="#brand-identity" className="px-3.5 py-2 rounded-xl text-sm font-bold transition-all" style={{ color: 'var(--accent-bright)' }}>استوديو الشعار والمطبوعات</a>
          </nav>

          {/* Controls: Sector Accent Dots + Theme Switcher + CTA */}
          <div className="flex items-center gap-2.5">
            <div className="sunken-well-box px-2.5 py-1.5 flex items-center gap-2" title="اختر اللكنة اللونية حسب القطاع">
              <span className="text-[11px] font-bold hidden md:inline" style={{ color: 'var(--text-muted)' }}>القطاع:</span>
              <button
                onClick={() => handleSetAccent('amber')}
                className={`w-5 h-5 rounded-full transition-transform ${accent === 'amber' ? 'scale-125' : 'opacity-60 hover:opacity-100'}`}
                style={{ background: 'linear-gradient(180deg, #fb923c 0%, #f97316 55%, #d9460f 100%)', boxShadow: accent === 'amber' ? '0 0 10px rgba(249,115,22,0.8)' : 'none' }}
                title="الإنشاءات والعضم (Signature Amber)"
              />
              <button
                onClick={() => handleSetAccent('emerald')}
                className={`w-5 h-5 rounded-full transition-transform ${accent === 'emerald' ? 'scale-125' : 'opacity-60 hover:opacity-100'}`}
                style={{ background: 'linear-gradient(180deg, #34d399 0%, #10b981 55%, #047857 100%)', boxShadow: accent === 'emerald' ? '0 0 10px rgba(16,185,129,0.8)' : 'none' }}
                title="العمارة والتشطيبات (Architectural Emerald)"
              />
              <button
                onClick={() => handleSetAccent('cyan')}
                className={`w-5 h-5 rounded-full transition-transform ${accent === 'cyan' ? 'scale-125' : 'opacity-60 hover:opacity-100'}`}
                style={{ background: 'linear-gradient(180deg, #38bdf8 0%, #0ea5e9 55%, #0369a1 100%)', boxShadow: accent === 'cyan' ? '0 0 10px rgba(14,165,233,0.8)' : 'none' }}
                title="تقنية المعلومات والأنظمة الذكية (Technical Cyan)"
              />
            </div>

            <button
              onClick={toggleTheme}
              className="sunken-well-box px-3.5 py-2 text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition-transform hover:scale-105"
            >
              <i className={`fa-solid ${themeMode === 'dark' ? 'fa-moon text-amber-400' : 'fa-sun text-amber-500'}`}></i>
              <span className="hidden sm:inline">{themeMode === 'dark' ? 'أوبسيديان داكن' : 'لؤلؤي نهاري'}</span>
            </button>

            <a href="#order-section" className="btn-primary text-xs sm:text-sm py-2.5 px-4 sm:px-5">
              <i className="fa-solid fa-file-signature"></i>
              <span>اطلب عرض سعر</span>
            </a>
          </div>

        </div>
      </header>

      {/* HERO SECTION */}
      <section id="hero" className="relative pt-10 pb-16 sm:py-20 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          {/* Right Column: Strategic Pitch */}
          <div className="lg:col-span-7 space-y-6 text-right">
            <div className="inline-flex flex-wrap items-center gap-2.5 subcard-glass px-4 py-2">
              <div className="specular-beam"></div>
              <span className="w-2.5 h-2.5 rounded-full animate-ping" style={{ background: 'var(--accent-main)' }}></span>
              <span className="text-xs sm:text-sm font-bold" style={{ color: 'var(--accent-bright)' }}>
                منظومة البناء المتكامل 3×1: إنشاءات (عضم) • تشطيبات معمارية • تقنية معلومات
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl xl:text-6xl font-black leading-tight tracking-tight">
              نبني <span style={{ color: '#fb923c' }}>الهيكل الخرساني</span>، نُبدع <span style={{ color: '#34d399' }}>التشطيب المعماري</span>، ونُشغّل <span style={{ color: '#38bdf8' }}>البنية التكنولوجية</span>.
            </h1>

            <p className="text-base sm:text-lg leading-relaxed max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
              في <strong className="phi-metallic-text font-mono">PHI CONSTRUCT</strong> نختصر عليك تعدد المقاولين وتضارب المواعيد. نتسلم أرض مشروعك لننفذ <strong style={{ color: 'var(--accent-bright)' }}>أعمال الإنشاءات والعضم</strong> بأعلى معايير الأمان الهندسي، ونحولها إلى تحفة بـ <strong style={{ color: '#34d399' }}>التشطيبات المعمارية والواجهات الفاخرة</strong>، وندمج بداخلها أحدث <strong style={{ color: '#38bdf8' }}>شبكات تقنية المعلومات، مراكز البيانات، وأنظمة المباني الذكية (BMS &amp; IT)</strong> تحت إدارة هندسية واحدة.
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
                  <div className="text-xs font-black">1. البناء الإنشائي (عضم)</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>حفر، أساسات، خرسانات ومباني</div>
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
                  <div className="text-xs font-black">2. العمارة والتشطيبات</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>ديكور، واجهات، رخام وMEP</div>
                </div>
              </button>

              <button
                onClick={() => { handleSetAccent('cyan'); selectPresetScope('technology'); }}
                className="glossy-card glossy-card-interactive p-3.5 text-right flex items-center gap-3 cursor-pointer"
              >
                <div className="specular-beam"></div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8' }}>
                  <i className="fa-solid fa-network-wired text-lg"></i>
                </div>
                <div>
                  <div className="text-xs font-black">3. تقنية المعلومات IT</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>فايبر، داتا سنتر، ومباني ذكية</div>
                </div>
              </button>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a href="#turnkey-calculator" className="btn-primary text-base px-7 py-4">
                <i className="fa-solid fa-calculator"></i>
                <span>احسب تكلفة مشروعك (عضم + تشطيب + IT)</span>
              </a>
              <a href="#brand-identity" className="btn-secondary text-base px-6 py-4">
                <div className="specular-beam"></div>
                <i className="fa-solid fa-swatchbook" style={{ color: 'var(--accent-main)' }}></i>
                <span>استوديو الشعار والمطبوعات (SVG / PNG)</span>
              </a>
            </div>

            {/* Key Trust Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-3">
              <div className="glossy-card p-4">
                <div className="specular-beam"></div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono" style={{ color: 'var(--accent-bright)' }}>+165</div>
                <div className="text-xs font-bold mt-1" style={{ color: 'var(--text-muted)' }}>مشروع إنشائي ومعماري وتقني</div>
              </div>
              <div className="glossy-card p-4">
                <div className="specular-beam"></div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono" style={{ color: 'var(--status-pos-ink)' }}>3×1</div>
                <div className="text-xs font-bold mt-1" style={{ color: 'var(--text-muted)' }}>مسؤولية هندسية موحدة</div>
              </div>
              <div className="glossy-card p-4">
                <div className="specular-beam"></div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono" style={{ color: 'var(--status-info-ink)' }}>TIER-III</div>
                <div className="text-xs font-bold mt-1" style={{ color: 'var(--text-muted)' }}>معيار البنية التحتية للـ IT</div>
              </div>
              <div className="glossy-card p-4">
                <div className="specular-beam"></div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono" style={{ color: 'var(--text-primary)' }}>99.6%</div>
                <div className="text-xs font-bold mt-1" style={{ color: 'var(--text-muted)' }}>التزام بالجدول والمواصفات</div>
              </div>
            </div>
          </div>

          {/* Left Column: Clean Full-Bleed Vector Emblem */}
          <div className="lg:col-span-5">
            <div className="glossy-card p-5 sm:p-6 relative">
              <div className="specular-beam"></div>

              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <span className="badge-pill badge-accent font-mono text-xs">
                  <i className="fa-solid fa-expand"></i>
                  نسب قياسية ممتلئة — مالي مكانه
                </span>
                <div className="sunken-well-box p-1 flex items-center gap-1 text-[11px] font-bold">
                  <button
                    onClick={() => setHeroLogoVariant('print-light')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] ${heroLogoVariant === 'print-light' ? 'btn-primary' : 'text-slate-400'}`}
                  >
                    الأصلي والمطبوعات
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

              {/* Vector Emblem Stage */}
              <div
                className={`rounded-3xl p-5 sm:p-6 flex flex-col items-center justify-center relative transition-all duration-500 min-h-[390px] ${
                  heroLogoVariant === 'print-light' ? 'preview-surface-paper' : 'preview-surface-dark'
                }`}
              >
                <div className="specular-beam"></div>

                <div className="w-full flex items-center justify-center">
                  <svg viewBox={logoGeometry.tightViewBox} className="w-64 sm:w-72 h-auto mx-auto transition-all duration-300" role="img" aria-label="شعار فاي كونستركت">
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
                  <div className="font-mono text-2xl sm:text-3xl font-black tracking-[0.16em]">
                    <span style={{ color: heroLogoVariant === 'print-light' ? '#2c353d' : '#ede5da' }}>PHI </span>
                    <span style={{ color: heroLogoVariant === 'print-light' ? '#f07613' : '#f97316' }}>CONSTRUCT</span>
                  </div>
                  <div className="font-mono text-[10px] sm:text-[11px] font-bold tracking-[0.15em]" style={{ color: heroLogoVariant === 'print-light' ? '#524236' : '#b8aea2' }}>
                    STRUCTURAL • ARCHITECTURAL • IT SYSTEMS
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

      {/* SECTION 2: THE 3 CORE SECTORS */}
      <section id="three-pillars" className="py-16 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
            <span className="badge-pill badge-accent text-xs sm:text-sm">
              <i className="fa-solid fa-cubes-stacked"></i>
              القطاعات التنفيذية الثلاثة لشركة PHI CONSTRUCT
            </span>
            <h2 className="text-2xl sm:text-4xl font-black">
              منظومة مقاولات شاملة: <span style={{ color: '#fb923c' }}>عضم</span> + <span style={{ color: '#34d399' }}>تشطيبات</span> + <span style={{ color: '#38bdf8' }}>تقنية معلومات</span>
            </h2>
            <p className="text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
              تفرّدنا الهندسي يكمن في دمج المقاولات الإنشائية والمعمارية مع هندسة تقنية المعلومات منذ اللحظة الأولى للتصميم، مما يمنع تكسير الحوائط لاحقاً ويضمن مبنى ذكياً متكاملاً.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-7 items-stretch">
            {/* PILLAR 1 */}
            <div className="glossy-card glossy-card-interactive p-6 sm:p-7 flex flex-col justify-between">
              <div className="specular-beam"></div>
              <div>
                <div className="flex items-center justify-between mb-5">
                  <span className="badge-pill badge-accent font-mono text-xs">01 / STRUCTURAL &amp; SKELETON</span>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl" style={{ background: 'rgba(249,115,22,0.15)', color: '#fb923c' }}>
                    <i className="fa-solid fa-helmet-safety"></i>
                  </div>
                </div>
                <h3 className="text-2xl font-black mb-2">قطاع البناء الإنشائي والعضم</h3>
                <p className="text-xs sm:text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
                  ننفذ الهياكل الخرسانية والمعدنية للمشاريع السكنية، الإدارية، والتجارية وفق الكود المصري والعالمي مع ضبط صارم للجودة والأمان الإنشائي.
                </p>

                <div className="sunken-well-box p-4 space-y-3 text-xs sm:text-sm">
                  <div className="font-extrabold text-xs" style={{ color: '#fb923c' }}>نطاق الأعمال الإنشائية (العضم):</div>
                  <ul className="space-y-2.5" style={{ color: 'var(--text-secondary)' }}>
                    <li className="flex items-start gap-2.5">
                      <i className="fa-solid fa-check mt-1" style={{ color: '#fb923c' }}></i>
                      <span><strong>أعمال الحفر والأساسات:</strong> الجسات، الإحلال، الخوازيق، واللبشة المسلحة معزولة بالكامل.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <i className="fa-solid fa-check mt-1" style={{ color: '#fb923c' }}></i>
                      <span><strong>الهيكل الخرساني:</strong> أعمدة، كور مصاعد، وأسقف Flat Slab وPost-Tension.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <i className="fa-solid fa-check mt-1" style={{ color: '#fb923c' }}></i>
                      <span><strong>التأسيس المسبق للـ IT و MEP:</strong> زرع مسارات الكابلات والـ Sleeves داخل الخرسانة.</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 pt-4 flex items-center justify-between">
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>اختبارات إجهاد خرسانة معتمدة</span>
                <button onClick={() => selectPresetScope('structural')} className="btn-primary text-xs py-2.5 px-4">
                  <span>سعّر أعمال العضم</span>
                  <i className="fa-solid fa-arrow-left"></i>
                </button>
              </div>
            </div>

            {/* PILLAR 2 */}
            <div className="glossy-card glossy-card-interactive p-6 sm:p-7 flex flex-col justify-between">
              <div className="specular-beam"></div>
              <div>
                <div className="flex items-center justify-between mb-5">
                  <span className="badge-pill font-mono text-xs" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>02 / ARCHITECTURAL &amp; FINISHING</span>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                    <i className="fa-solid fa-ruler-combined"></i>
                  </div>
                </div>
                <h3 className="text-2xl font-black mb-2">قطاع العمارة والتشطيبات الفاخرة</h3>
                <p className="text-xs sm:text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
                  نحول الهيكل الخرساني إلى تحفة معمارية نابضة بالحياة، بدايةً من التصميم ثلاثي الأبعاد والواجهات حتى أدق تفاصيل الفرش والإضاءة.
                </p>

                <div className="sunken-well-box p-4 space-y-3 text-xs sm:text-sm">
                  <div className="font-extrabold text-xs" style={{ color: '#34d399' }}>نطاق الأعمال المعمارية:</div>
                  <ul className="space-y-2.5" style={{ color: 'var(--text-secondary)' }}>
                    <li className="flex items-start gap-2.5">
                      <i className="fa-solid fa-check mt-1 text-emerald-400"></i>
                      <span><strong>الواجهات المعمارية:</strong> واجهات زجاجية Curtain Walls، كلادينج، وتكسيات حجر طبيعي.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <i className="fa-solid fa-check mt-1 text-emerald-400"></i>
                      <span><strong>التشطيبات الداخلية:</strong> رخام إيطالي بالوترجيت، باركيه، وتجاليد خشبية فاخرة.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <i className="fa-solid fa-check mt-1 text-emerald-400"></i>
                      <span><strong>أنظمة الكهروميكانيك MEP:</strong> تكييف مركزي ومخفي VRF، وسباكة مدفونة Grohe.</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 pt-4 flex items-center justify-between">
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>تسليم مفتاح مطابق للـ 3D</span>
                <button onClick={() => selectPresetScope('architectural')} className="btn-secondary text-xs py-2.5 px-4">
                  <div className="specular-beam"></div>
                  <span style={{ color: '#34d399' }}>سعّر التشطيبات</span>
                  <i className="fa-solid fa-arrow-left text-emerald-400"></i>
                </button>
              </div>
            </div>

            {/* PILLAR 3 */}
            <div className="glossy-card glossy-card-interactive p-6 sm:p-7 flex flex-col justify-between">
              <div className="specular-beam"></div>
              <div>
                <div className="flex items-center justify-between mb-5">
                  <span className="badge-pill font-mono text-xs" style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8' }}>03 / IT &amp; SMART INFRASTRUCTURE</span>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl" style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8' }}>
                    <i className="fa-solid fa-server"></i>
                  </div>
                </div>
                <h3 className="text-2xl font-black mb-2">قطاع تقنية المعلومات والأنظمة الذكية</h3>
                <p className="text-xs sm:text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
                  نبني العقل الرقمي والشبكة العصبية للمنشأة، لنقدم للشركات والقصور والمولات بنية تحتية فائقة السرعة والأمان.
                </p>

                <div className="sunken-well-box p-4 space-y-3 text-xs sm:text-sm">
                  <div className="font-extrabold text-xs" style={{ color: '#38bdf8' }}>نطاق أعمال تقنية المعلومات:</div>
                  <ul className="space-y-2.5" style={{ color: 'var(--text-secondary)' }}>
                    <li className="flex items-start gap-2.5">
                      <i className="fa-solid fa-check mt-1 text-sky-400"></i>
                      <span><strong>غرف السيرفرات والداتا سنتر:</strong> تمديد ألياف ضوئية Fiber Optics وشبكات Cat6A/Cat7.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <i className="fa-solid fa-check mt-1 text-sky-400"></i>
                      <span><strong>المباني الذكية BMS &amp; KNX:</strong> تحكم ذكي في الإضاءة والتكييف والطاقة عبر الجوال.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <i className="fa-solid fa-check mt-1 text-sky-400"></i>
                      <span><strong>التيار الخفيف والأمن ELV:</strong> كاميرات IP بالذكاء الاصطناعي وبوابات Access Control.</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 pt-4 flex items-center justify-between">
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>معايير Fluke Networks</span>
                <button onClick={() => selectPresetScope('technology')} className="btn-secondary text-xs py-2.5 px-4">
                  <div className="specular-beam"></div>
                  <span style={{ color: '#38bdf8' }}>سعّر البنية التكنولوجية</span>
                  <i className="fa-solid fa-arrow-left text-sky-400"></i>
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SECTION 3: 3-LAYER BUILDING X-RAY SIMULATOR */}
      <section id="xray-twin" className="py-14 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-10 space-y-3">
            <span className="badge-pill badge-accent text-xs sm:text-sm">
              <i className="fa-solid fa-eye"></i>
              التوأم الرقمي لطبقات التنفيذ (3-Layer Building X-Ray)
            </span>
            <h2 className="text-2xl sm:text-4xl font-black">
              شاهد كيف ندمج <span style={{ color: '#fb923c' }}>العضم</span> و<span style={{ color: '#34d399' }}>التشطيبات</span> و<span style={{ color: '#38bdf8' }}>التكنولوجيا</span> في مبنى واحد
            </h2>
            <p className="text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
              اضغط على أي طبقة هندسية أدناه لاستكشاف العناصر التي تنفذها فرق <strong>PHI CONSTRUCT</strong> داخل المشروع وكيف تتكامل معاً دون أي تعارض.
            </p>
          </div>

          <div className="glossy-card p-5 sm:p-8">
            <div className="specular-beam"></div>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-7">
              <div className="flex flex-wrap items-center gap-2 sunken-well-box p-2 w-full lg:w-auto">
                <button
                  onClick={() => setActiveLayer('all')}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold ${activeLayer === 'all' ? 'btn-primary' : 'subcard-glass'}`}
                >
                  <i className="fa-solid fa-layer-group"></i>
                  <span>التكامل الكامل (3×1)</span>
                </button>
                <button
                  onClick={() => setActiveLayer('structural')}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold ${activeLayer === 'structural' ? 'btn-primary' : 'subcard-glass'}`}
                >
                  <i className="fa-solid fa-cubes" style={{ color: '#fb923c' }}></i>
                  <span>1. الهيكل الإنشائي (العضم)</span>
                </button>
                <button
                  onClick={() => setActiveLayer('architectural')}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold ${activeLayer === 'architectural' ? 'btn-primary' : 'subcard-glass'}`}
                >
                  <i className="fa-solid fa-building" style={{ color: '#34d399' }}></i>
                  <span>2. الغلاف المعماري والتشطيبات</span>
                </button>
                <button
                  onClick={() => setActiveLayer('technology')}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold ${activeLayer === 'technology' ? 'btn-primary' : 'subcard-glass'}`}
                >
                  <i className="fa-solid fa-network-wired" style={{ color: '#38bdf8' }}></i>
                  <span>3. الشبكة العصبية وتقنية المعلومات</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="badge-pill font-mono text-xs" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>BIM LEVEL 300/400</span>
                <span className="badge-pill font-mono text-xs" style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8' }}>ZERO CLASH DETECTION</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-center">
              {/* SVG Cross-Section */}
              <div className="lg:col-span-7 sunken-well-box p-4 sm:p-6 rounded-3xl relative overflow-hidden">
                <svg viewBox="0 0 700 440" className="w-full h-auto" aria-label="مخطط طبقات المبنى">
                  <g stroke="rgba(255,255,255,0.04)" strokeWidth="1">
                    <line x1="0" y1="80" x2="700" y2="80" />
                    <line x1="0" y1="160" x2="700" y2="160" />
                    <line x1="0" y1="240" x2="700" y2="240" />
                    <line x1="0" y1="320" x2="700" y2="320" />
                    <line x1="0" y1="390" x2="700" y2="390" />
                  </g>

                  {/* LAYER 1: STRUCTURAL */}
                  <g opacity={activeLayer === 'all' || activeLayer === 'structural' ? 1 : 0.15} className="transition-opacity duration-300">
                    <rect x="95" y="365" width="510" height="28" rx="4" fill="rgba(249, 115, 22, 0.28)" stroke="#f97316" strokeWidth="2" />
                    <rect x="130" y="393" width="18" height="38" fill="#ea580c" opacity="0.7" />
                    <rect x="250" y="393" width="18" height="38" fill="#ea580c" opacity="0.7" />
                    <rect x="340" y="393" width="22" height="38" fill="#ea580c" opacity="0.85" />
                    <rect x="430" y="393" width="18" height="38" fill="#ea580c" opacity="0.7" />
                    <rect x="550" y="393" width="18" height="38" fill="#ea580c" opacity="0.7" />

                    <rect x="130" y="75" width="16" height="290" fill="#fb923c" opacity="0.85" />
                    <rect x="255" y="75" width="16" height="290" fill="#fb923c" opacity="0.85" />
                    <rect x="336" y="60" width="28" height="305" fill="rgba(249,115,22,0.45)" stroke="#fb923c" strokeWidth="2" />
                    <rect x="430" y="75" width="16" height="290" fill="#fb923c" opacity="0.85" />
                    <rect x="554" y="75" width="16" height="290" fill="#fb923c" opacity="0.85" />

                    <rect x="115" y="270" width="470" height="12" rx="2" fill="#f97316" />
                    <rect x="115" y="175" width="470" height="12" rx="2" fill="#f97316" />
                    <rect x="110" y="75" width="480" height="14" rx="3" fill="#fb923c" />
                  </g>

                  {/* LAYER 2: ARCHITECTURAL */}
                  <g opacity={activeLayer === 'all' || activeLayer === 'architectural' ? 1 : 0.15} className="transition-opacity duration-300">
                    <rect x="122" y="89" width="456" height="276" rx="6" fill="rgba(16, 185, 129, 0.09)" stroke="#10b981" strokeWidth="2" strokeDasharray="10 4" />
                    <line x1="148" y1="102" x2="550" y2="102" stroke="#34d399" strokeWidth="3" opacity="0.85" />
                    <line x1="148" y1="198" x2="550" y2="198" stroke="#34d399" strokeWidth="3" opacity="0.85" />
                    <line x1="148" y1="292" x2="550" y2="292" stroke="#34d399" strokeWidth="3" opacity="0.85" />
                    <path d="M 102 75 L 130 42 L 570 42 L 598 75 Z" fill="rgba(16, 185, 129, 0.22)" stroke="#34d399" strokeWidth="2" />
                    <rect x="165" y="198" width="75" height="72" rx="4" fill="rgba(52, 211, 153, 0.16)" stroke="#34d399" strokeWidth="1.5" />
                    <rect x="460" y="102" width="80" height="73" rx="4" fill="rgba(52, 211, 153, 0.16)" stroke="#34d399" strokeWidth="1.5" />
                  </g>

                  {/* LAYER 3: IT & BMS */}
                  <g opacity={activeLayer === 'all' || activeLayer === 'technology' ? 1 : 0.15} className="transition-opacity duration-300">
                    <rect x="282" y="202" width="136" height="64" rx="8" fill="rgba(14, 165, 233, 0.25)" stroke="#38bdf8" strokeWidth="2" />
                    <text x="350" y="226" textAnchor="middle" fill="#7dd3fc" fontSize="11" fontWeight="800" fontFamily="JetBrains Mono">DATA CENTER TIER-III</text>
                    <text x="350" y="246" textAnchor="middle" fill="#e0f2fe" fontSize="10" fontWeight="700" fontFamily="Cairo">غرفة السيرفرات والـ BMS</text>

                    <path d="M 350 202 L 350 60 M 350 135 L 185 135 M 350 135 L 505 135 M 350 320 L 200 320 M 350 320 L 510 320 M 350 266 L 350 355" stroke="#38bdf8" strokeWidth="3" fill="none" className="it-data-stream" />
                    <circle cx="185" cy="135" r="8" fill="#0ea5e9" />
                    <circle cx="505" cy="135" r="8" fill="#0ea5e9" />
                    <circle cx="200" cy="320" r="8" fill="#0ea5e9" />
                    <circle cx="510" cy="320" r="8" fill="#0ea5e9" />
                    <circle cx="350" cy="60" r="9" fill="#38bdf8" />
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

      {/* SECTION 4: TURNKEY COST & TIMELINE CALCULATOR */}
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
                    حاسبة المقايسة الهندسية الفورية (Instant BoQ Estimator)
                  </span>
                  <div className="sunken-well-box p-1 flex items-center gap-1 text-xs font-mono">
                    <button
                      onClick={() => { setCurrencySymbol('ج.م'); setCurrencyRate(1); }}
                      className={`px-3 py-1 rounded-lg font-bold ${currencySymbol === 'ج.م' ? 'btn-primary' : ''}`}
                    >
                      EGP ج.م
                    </button>
                    <button
                      onClick={() => { setCurrencySymbol('ر.س'); setCurrencyRate(0.078); }}
                      className={`px-3 py-1 rounded-lg font-bold ${currencySymbol === 'ر.س' ? 'btn-primary' : ''}`}
                    >
                      SAR ر.س
                    </button>
                    <button
                      onClick={() => { setCurrencySymbol('$'); setCurrencyRate(0.021); }}
                      className={`px-3 py-1 rounded-lg font-bold ${currencySymbol === '$' ? 'btn-primary' : ''}`}
                    >
                      USD $
                    </button>
                  </div>
                </div>

                <h2 className="text-2xl sm:text-3xl font-black">
                  احسب تكلفة وكميات مشروعك: <span style={{ color: '#fb923c' }}>عضم</span> • <span style={{ color: '#34d399' }}>تشطيب</span> • <span style={{ color: '#38bdf8' }}>تكنولوجيا</span>
                </h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  حدد نوع المبنى والمساحة، واختر نطاق الأعمال المطلوب (يمكنك اختيار قطاع واحد أو دمج القطاعات الثلاثة معاً بنظام تسليم المفتاح).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>نوع المشروع الهندسي</label>
                    <select
                      value={projectType}
                      onChange={(e) => setProjectType(e.target.value as any)}
                      className="sunken-input cursor-pointer font-bold"
                    >
                      <option value="villa">فيلا سكنية خاصة / قصر</option>
                      <option value="hq">مقر شركة / مبنى إداري ذكي</option>
                      <option value="mall">مول تجاري / مركز طبي متكامل</option>
                      <option value="datacenter">مبنى تقني / مركز بيانات ومختبرات</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>مستوى المواصفات والتجهيز</label>
                    <select
                      value={specTier}
                      onChange={(e) => setSpecTier(parseFloat(e.target.value))}
                      className="sunken-input cursor-pointer font-bold"
                    >
                      <option value="1">قياسي هندسي معتمد (Standard Pro)</option>
                      <option value="1.35">فاخر متقدم (Executive Luxury)</option>
                      <option value="1.75">فائق الفخامة والذكاء (Signature Φ VIP)</option>
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
                      max="3000"
                      step="30"
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
                      max="15"
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
                      <div className="font-extrabold text-xs sm:text-sm">1. الإنشاءات والعضم</div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>حفر، خرسانات، ومباني</div>
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
                      <div className="font-extrabold text-xs sm:text-sm">2. التشطيبات والعمارة</div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>واجهات، ديكور، وMEP</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleScope('technology')}
                      className={`p-3.5 rounded-2xl text-right transition-all cursor-pointer ${activeScopes.technology ? 'scope-toggle-active' : 'sunken-well-box opacity-55'}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: 'rgba(14,165,233,0.2)', color: '#38bdf8' }}>
                          <i className="fa-solid fa-microchip"></i>
                        </span>
                        <i className={`fa-solid fa-circle-check text-sky-400 ${activeScopes.technology ? 'opacity-100' : 'opacity-20'}`}></i>
                      </div>
                      <div className="font-extrabold text-xs sm:text-sm">3. تقنية المعلومات IT</div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>فايبر، سمارت، وداتا سنتر</div>
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
                        ? 'شامل خصم التكامل الهندسي (7%) لتنفيذ القطاعات الثلاثة معاً'
                        : 'فعّل القطاعات الثلاثة معاً للحصول على خصم التكامل الهندسي (7%)'}
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="glossy-card p-3.5 flex items-center justify-between">
                      <span className="flex items-center gap-2 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#fb923c' }}></span>
                        <span>تكلفة الإنشاءات والعضم:</span>
                      </span>
                      <span className="font-mono font-extrabold">{boqCalculation.structCost.toLocaleString()} {currencySymbol}</span>
                    </div>

                    <div className="glossy-card p-3.5 flex items-center justify-between">
                      <span className="flex items-center gap-2 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#34d399' }}></span>
                        <span>تكلفة التشطيبات والواجهات:</span>
                      </span>
                      <span className="font-mono font-extrabold">{boqCalculation.archCost.toLocaleString()} {currencySymbol}</span>
                    </div>

                    <div className="glossy-card p-3.5 flex items-center justify-between">
                      <span className="flex items-center gap-2 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#38bdf8' }}></span>
                        <span>تكلفة تقنية المعلومات والـ BMS:</span>
                      </span>
                      <span className="font-mono font-extrabold">{boqCalculation.techCost.toLocaleString()} {currencySymbol}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 text-center pt-1">
                    <div className="subcard-glass p-2.5">
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>حديد وخرسانة</div>
                      <div className="font-mono font-extrabold text-xs mt-0.5" style={{ color: '#fb923c' }}>
                        {boqCalculation.steelTons > 0 ? `~${boqCalculation.steelTons} طن` : 'غير مشمول'}
                      </div>
                    </div>
                    <div className="subcard-glass p-2.5">
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>نقاط ذكية وشبكات</div>
                      <div className="font-mono font-extrabold text-xs mt-0.5" style={{ color: '#38bdf8' }}>
                        {boqCalculation.itPoints > 0 ? `${boqCalculation.itPoints} نقطة` : 'غير مشمول'}
                      </div>
                    </div>
                    <div className="subcard-glass p-2.5">
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>المدة الزمنية</div>
                      <div className="font-mono font-extrabold text-xs mt-0.5" style={{ color: '#34d399' }}>
                        {boqCalculation.months} أشهر
                      </div>
                    </div>
                  </div>

                  <button onClick={transferBoQToForm} className="btn-primary w-full py-4 text-sm sm:text-base">
                    <i className="fa-solid fa-file-export"></i>
                    <span>اعتماد المقايسة وطلب عرض سعر رسمي</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: PORTFOLIO & DELIVERED PROJECTS */}
      <section id="portfolio" className="py-16 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div className="space-y-3">
              <span className="badge-pill badge-accent text-xs sm:text-sm">
                <i className="fa-solid fa-award"></i>
                نماذج من مشاريعنا المنفذة
              </span>
              <h2 className="text-2xl sm:text-4xl font-black">
                سابقة أعمال <span className="phi-metallic-text">PHI CONSTRUCT</span> على أرض الواقع
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sunken-well-box p-1.5">
              {(['all', 'turnkey', 'structural', 'architectural', 'technology'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setPortfolioFilter(cat)}
                  className={`px-3.5 py-2 rounded-xl text-xs ${portfolioFilter === cat ? 'btn-primary font-extrabold' : 'font-bold'}`}
                >
                  {cat === 'all' && 'الكل'}
                  {cat === 'turnkey' && 'تسليم مفتاح (3×1)'}
                  {cat === 'structural' && 'إنشاءات وعضم'}
                  {cat === 'architectural' && 'تشطيبات معمارية'}
                  {cat === 'technology' && 'تقنية معلومات IT'}
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
                  <h3 className="text-lg sm:text-xl font-black mb-4">{proj.title}</h3>

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
                      <i className="fa-solid fa-server mt-0.5" style={{ color: '#38bdf8' }}></i>
                      <span><strong>التكنولوجي IT:</strong> {proj.itScope}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 flex items-center justify-between text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                  <span><i className="fa-solid fa-maximize ml-1"></i> المساحة: {proj.area}</span>
                  <span><i className="fa-regular fa-clock ml-1"></i> التنفيذ: {proj.duration}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 6: BRAND STUDIO */}
      <section id="brand-identity" className="py-16 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="badge-pill badge-accent text-xs sm:text-sm">
              <i className="fa-solid fa-sliders"></i>
              استوديو ضبط نسب وألوان الشعار (Full-Bleed Logo &amp; Print Studio)
            </span>
            <h2 className="text-2xl sm:text-4xl font-black">
              شعار <span className="phi-metallic-text">PHI CONSTRUCT</span> مضبوط النسب («مالي مكانه») للويب والمطبوعات
            </h2>
            <p className="text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
              حافظنا على نفس تصميم وألوان شعارك المعتمد (الأعمدة البرتقالية العنبرية + الحلقة الدائرية الفحمية الداكنة)، مع تكبير القطر وزيادة سماكة الكتل وتقليص الفراغات الهامشية.
            </p>
          </div>

          <div className="glossy-card p-6 sm:p-10">
            <div className="specular-beam"></div>

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
                        {lk === 'stacked' && 'رأسي كامل'}
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
                      {studioColorMode === 'web-dark' && 'WEB DARK — SLATE TITANIUM & AMBER'}
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
                        <i className="fa-solid fa-file-contract ml-1"></i> ورق المراسلات والعقود (A4)
                      </button>
                      <button
                        type="button"
                        onClick={() => setStudioMockupTab('stamp')}
                        className={`px-3.5 py-2 rounded-xl text-xs ${studioMockupTab === 'stamp' ? 'btn-primary font-extrabold' : 'font-bold'}`}
                      >
                        <i className="fa-solid fa-stamp ml-1"></i> ختم الشركة وأيقونة الويب
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
                          <span style={{ color: '#fb923c' }}>WWW.PHICONSTRUCT.COM</span>
                        </div>
                        <div className="my-3 flex flex-col items-center text-center">
                          <svg viewBox={logoGeometry.tightViewBox} className="w-20 h-20">
                            <use href="#phi-master-rings" fill="url(#phiRingsWebDark)" />
                            <use href="#phi-master-pillars" fill="url(#phiPillarsWebDark)" />
                          </svg>
                          <div className="font-mono font-black text-base tracking-[0.2em] mt-1.5">
                            <span style={{ color: '#ede5da' }}>PHI </span>
                            <span style={{ color: '#f97316' }}>CONSTRUCT</span>
                          </div>
                          <div className="text-[9px] font-bold tracking-wider mt-0.5 text-stone-300">
                            إنشاءات خرسانية • تشطيبات معمارية • تقنية معلومات
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-stone-400">
                          <span>3-IN-1 TURNKEY CONTRACTING</span>
                          <span className="font-mono">ISO 9001 • BIM 400</span>
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
                            <div className="font-black text-sm" style={{ color: '#14100d' }}>م. الاستشاري / رئيس مجلس الإدارة</div>
                            <div className="text-[11px] font-bold" style={{ color: '#ea580c' }}>PHI CONSTRUCT</div>
                          </div>
                          <svg viewBox={logoGeometry.tightViewBox} className="w-14 h-14">
                            <use href="#phi-master-rings" fill="url(#phiRingsPrint)" />
                            <use href="#phi-master-pillars" fill="url(#phiPillarsPrint)" />
                          </svg>
                        </div>
                        <div className="pr-3 space-y-1.5 text-[11px] my-3" style={{ color: '#2e2620' }}>
                          <div className="flex items-center gap-2 font-mono">
                            <i className="fa-solid fa-phone text-[10px]" style={{ color: '#ea580c' }}></i>
                            <span dir="ltr">+20 100 000 0000 / +966 50 000 0000</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono">
                            <i className="fa-solid fa-envelope text-[10px]" style={{ color: '#ea580c' }}></i>
                            <span>info@phiconstruct.com</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <i className="fa-solid fa-location-dot text-[10px]" style={{ color: '#ea580c' }}></i>
                            <span>القاهرة الجديدة — التجمع الخامس | الرياض — حي العليا</span>
                          </div>
                        </div>
                        <div className="pr-3 pt-2 flex items-center justify-between text-[10px] font-bold" style={{ color: '#524236' }}>
                          <span>بناء إنشائي (عضم) • عمارة وتشطيبات • شبكات وIT</span>
                          <span className="font-mono" style={{ color: '#ea580c' }}>Φ 1.618</span>
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
                            <div className="font-mono font-black text-lg tracking-[0.16em]">
                              <span style={{ color: '#2c353d' }}>PHI </span>
                              <span style={{ color: '#f07613' }}>CONSTRUCT</span>
                            </div>
                            <div className="text-xs font-extrabold" style={{ color: '#2e2620' }}>
                              فاي كونستركت للمقاولات العامة والإنشاءات وتقنية المعلومات
                            </div>
                            <div className="text-[10px] font-mono" style={{ color: '#6b5e53' }}>
                              STRUCTURAL SKELETON • ARCHITECTURAL FINISHING • IT INFRASTRUCTURE
                            </div>
                          </div>
                        </div>
                        <div className="text-left font-mono text-[11px] space-y-0.5" style={{ color: '#3f352c' }}>
                          <div><strong>DOC REF:</strong> PHI-BOQ-2026/089</div>
                          <div><strong>DATE:</strong> {new Date().toLocaleDateString('ar-EG')}</div>
                          <div><strong>CR / TAX ID:</strong> 748-920-114</div>
                        </div>
                      </div>

                      <div className="relative py-8 px-2 sm:px-6">
                        <svg viewBox={logoGeometry.tightViewBox} className="w-52 h-52 mx-auto opacity-[0.05] pointer-events-none absolute inset-0 m-auto">
                          <use href="#phi-master-rings" fill="#2c353d" />
                          <use href="#phi-master-pillars" fill="#f07613" />
                        </svg>

                        <div className="relative z-10 space-y-3 text-xs leading-relaxed" style={{ color: '#26201b' }}>
                          <div className="font-black text-sm" style={{ color: '#14100d' }}>
                            الموضوع: عرض سعر فني ومالي لأعمال التنفيذ المتكامل (إنشائي + معماري + تقنية معلومات)
                          </div>
                          <p>
                            تحية طيبة وبعد، تتشرف شركة <strong>PHI CONSTRUCT</strong> بتقديم المقايسة التقديرية والجدول الزمني لتنفيذ مشروعكم وفق أعلى الأكواد الهندسية المعتمدة:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                            <div className="p-3 rounded-xl" style={{ background: '#fdf8f2' }}>
                              <div className="font-extrabold text-[11px]" style={{ color: '#ea580c' }}>1. القطاع الإنشائي (العضم)</div>
                              <div className="text-[11px] mt-0.5">حفر، إحلال، لبشة مسلحة، وأعمدة وأسقف خرسانية.</div>
                            </div>
                            <div className="p-3 rounded-xl" style={{ background: '#f2fbf7' }}>
                              <div className="font-extrabold text-[11px]" style={{ color: '#047857' }}>2. القطاع المعماري والتشطيب</div>
                              <div className="text-[11px] mt-0.5">واجهات زجاجية وكلادينج، رخام، وتكييف VRF.</div>
                            </div>
                            <div className="p-3 rounded-xl" style={{ background: '#f2f9fd' }}>
                              <div className="font-extrabold text-[11px]" style={{ color: '#0369a1' }}>3. تقنية المعلومات IT</div>
                              <div className="text-[11px] mt-0.5">شبكات فايبر، غرفة سيرفرات، ومباني ذكية BMS.</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px]" style={{ color: '#524236', background: '#faf5ed', padding: '10px 16px', borderRadius: '10px' }}>
                        <span>المقر الرئيسي: القاهرة الجديدة — التجمع الخامس | الرياض — حي العليا</span>
                        <span className="font-mono font-bold" style={{ color: '#ea580c' }}>www.phiconstruct.com | info@phiconstruct.com</span>
                      </div>
                    </div>
                  )}

                  {/* Mockup 3: Stamp & App Icon */}
                  {studioMockupTab === 'stamp' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="rounded-2xl p-6 flex flex-col items-center justify-center text-center" style={{ background: '#ffffff', color: '#14100d' }}>
                        <span className="text-[11px] font-bold mb-3" style={{ color: '#6b5e53' }}>نسخة الأختام الرسمية والحفر بالليزر (1-Color Stamp)</span>
                        <div className="w-40 h-40 rounded-full flex flex-col items-center justify-center p-3" style={{ background: 'rgba(30, 58, 138, 0.06)', color: '#1e3a8a' }}>
                          <svg viewBox={logoGeometry.tightViewBox} className="w-20 h-20">
                            <use href="#phi-master-rings" fill="#1e3a8a" />
                            <use href="#phi-master-pillars" fill="#1e3a8a" />
                          </svg>
                          <div className="font-mono font-black text-[11px] tracking-widest mt-1">PHI CONSTRUCT</div>
                          <div className="text-[9px] font-bold">مقاولات عامة وتقنية معلومات</div>
                        </div>
                      </div>

                      <div className="rounded-2xl p-6 flex flex-col items-center justify-center text-center sunken-well-box">
                        <span className="text-[11px] font-bold mb-3" style={{ color: 'var(--text-muted)' }}>أيقونة الموقع والتطبيق (مالي مكانه في المربع)</span>
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
                        <div className="text-[11px] mt-3" style={{ color: 'var(--text-secondary)' }}>كتلة ممتلئة ومتوازنة بدون هوامش ضائعة</div>
                      </div>
                    </div>
                  )}

                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: DIRECT QUOTE & CONSULTATION FORM */}
      <section id="order-section" className="py-16 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="glossy-card p-6 sm:p-12">
            <div className="specular-beam"></div>

            <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
              <span className="badge-pill badge-accent text-xs sm:text-sm">
                <i className="fa-solid fa-compass-drafting"></i>
                احجز معاينة هندسية مجانية أو اطلب عرض سعر رسمي
              </span>
              <h2 className="text-2xl sm:text-4xl font-black">
                ابدأ تنفيذ مشروعك مع <span className="phi-metallic-text">PHI CONSTRUCT</span>
              </h2>
              <p className="text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
                سواء كنت تخطط لبناء هيكل خرساني (عضم)، أو تشطيب معماري فاخر، أو تجهيز بنية تحتية لتقنية المعلومات والأنظمة الذكية، فريقنا الهندسي جاهز لدراسة مشروعك فوراً.
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
                    placeholder="مثال: م. طارق المنصور / شركة الرؤية"
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
                    placeholder="+20 100 000 0000"
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
                    <option value="تسليم مفتاح متكامل 3×1 (عضم + تشطيبات + تقنية معلومات)">تسليم مفتاح متكامل 3×1 (عضم + تشطيبات + تقنية معلومات)</option>
                    <option value="أعمال البناء الإنشائي والعضم فقط (حفر وخرسانات ومباني)">أعمال البناء الإنشائي والعضم فقط (حفر وخرسانات ومباني)</option>
                    <option value="أعمال العمارة والتشطيبات الفاخرة والواجهات (Turnkey Finishing)">أعمال العمارة والتشطيبات الفاخرة والواجهات (Turnkey Finishing)</option>
                    <option value="أعمال تقنية المعلومات والشبكات والمباني الذكية (IT & Smart BMS)">أعمال تقنية المعلومات والشبكات والمباني الذكية (IT &amp; Smart BMS)</option>
                    <option value="تشطيبات معمارية + بنية تحتية لتقنية المعلومات (بدون عضم)">تشطيبات معمارية + بنية تحتية لتقنية المعلومات (بدون عضم)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>موقع المشروع / المدينة *</label>
                  <input
                    type="text"
                    required
                    value={leadLocation}
                    onChange={(e) => setLeadLocation(e.target.value)}
                    className="sunken-input"
                    placeholder="مثال: القاهرة الجديدة / العاصمة الإدارية / الشيخ زايد / الرياض"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>تفاصيل المشروع أو المقايسة المحسوبة</label>
                <textarea
                  rows={3}
                  value={leadNotes}
                  onChange={(e) => setLeadNotes(e.target.value)}
                  className="sunken-input"
                  placeholder="اذكر المساحة التقريبية، عدد الأدوار، أو أي متطلبات خاصة في الإنشاءات أو التشطيب أو شبكات الـ IT..."
                />
              </div>

              <div className="pt-3 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <i className="fa-solid fa-shield-halved text-emerald-400"></i>
                  <span>عقود هندسية موثقة بجدول زمني وضمان شامل على الإنشاءات والتشطيبات والشبكات.</span>
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
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl sunken-well-box flex items-center justify-center font-mono font-black text-xl" style={{ color: 'var(--accent-bright)' }}>
              Φ
            </div>
            <div>
              <div className="font-mono font-black text-base phi-metallic-text">PHI CONSTRUCT</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>بناء إنشائي (عضم) • عمارة وتشطيبات • تقنية معلومات وأنظمة ذكية</div>
            </div>
          </div>

          <div className="text-xs text-center sm:text-left" style={{ color: 'var(--text-muted)' }}>
            جميع الحقوق محفوظة © <span className="font-mono">2026</span> لشركة <strong style={{ color: 'var(--text-primary)' }}>PHI CONSTRUCT</strong> — مدمجة بنظام <span className="font-mono">Obsidian Amber Gloss UI</span>.
          </div>
        </div>
      </footer>

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
                تم إرسال تفاصيل مقايستك إلى المكتب الفني والإداري في <strong>PHI CONSTRUCT</strong> وتم ربطها بنظام التنبيهات المباشر. سيتواصل معك أحد مهندسينا خلال ساعات العمل.
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
