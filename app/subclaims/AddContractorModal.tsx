"use client";
import React, { useState, useEffect, useId, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  HardHat, X, Save, User, Phone, Hash, MapPin, Briefcase,
  Search, Users, Link2, UserPlus, CheckCircle2, Lock, Unlock, RefreshCw, AlertTriangle
} from 'lucide-react';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import { supabase } from '@/lib/supabase';
import { generateNextPartnerCode } from '@/lib/partnerCodeGenerator';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<any> | void;
  isSaving?: boolean;
}

const COMMON_SPECIALTIES = [
  'مقاول باطن عام',
  'نجارة مسلحة',
  'حدادة مسلحة',
  'أعمال خرسانات وصب',
  'بؤج ومحارة (لياسة)',
  'سباكة وتغذية وصرف',
  'أعمال كهرباء وإنارة',
  'عزل مائي وحراري',
  'تركيب بورسلين ورخام',
  'جبس بورد وأسقف معلقة',
  'دهانات وتشطيبات نهائية',
  'أعمال مباني وبلوك',
  'أعمال حديد وديكور',
  'مقاول عام / أعمال متكاملة'
];

function normalizeArabicText(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function AddContractorModal({ isOpen, onClose, onSave, isSaving = false }: Props) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const [mode, setMode] = useState<'link' | 'create'>('link');
  const [partnersList, setPartnersList] = useState<any[]>([]);
  const [isLoadingPartners, setIsLoadingPartners] = useState(false);
  const [partnerSearch, setPartnerSearch] = useState('');
  const [selectedExistingPartner, setSelectedExistingPartner] = useState<any | null>(null);
  const [linkSpecialty, setLinkSpecialty] = useState('');

  const [isCodeAuto, setIsCodeAuto] = useState(true);
  const [form, setForm] = useState({
    name: '',
    code: '',
    job_role: 'نجارة مسلحة',
    phone: '',
    identity_number: '',
    address: '',
    notes: ''
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setMode('link');
    setPartnerSearch('');
    setSelectedExistingPartner(null);
    setLinkSpecialty('');
    setIsCodeAuto(true);

    const loadPartners = async () => {
      setIsLoadingPartners(true);
      try {
        const { data } = await supabase
          .from('partners')
          .select('*')
          .order('name', { ascending: true });
        if (!cancelled && data) {
          setPartnersList(data);
          const existingCodes = data.map((p: any) => p.code);
          const nextCode = generateNextPartnerCode('مقاول', 'نجارة مسلحة', existingCodes);
          setForm({
            name: '',
            code: nextCode,
            job_role: 'نجارة مسلحة',
            phone: '',
            identity_number: '',
            address: '',
            notes: ''
          });
        }
      } finally {
        if (!cancelled) setIsLoadingPartners(false);
      }
    };

    void loadPartners();
    return () => { cancelled = true; };
  }, [isOpen]);

  const sortedAndFilteredPartners = useMemo(() => {
    const q = normalizeArabicText(partnerSearch);
    const matches = (partnersList || []).filter((p: any) => {
      if (!q) return true;
      const haystack = normalizeArabicText(`${p.name || ''} ${p.code || ''} ${p.job_role || ''} ${p.phone || ''} ${p.partner_type || ''}`);
      return haystack.includes(q);
    });

    // ترتيب: مقاولي الباطن المسجلين في البارتنر أولاً، ثم باقي الشركاء
    return [...matches].sort((a: any, b: any) => {
      const aIsContractor = /مقاول/i.test(String(a.partner_type || '') + ' ' + String(a.job_role || ''));
      const bIsContractor = /مقاول/i.test(String(b.partner_type || '') + ' ' + String(b.job_role || ''));
      if (aIsContractor && !bIsContractor) return -1;
      if (!aIsContractor && bIsContractor) return 1;
      return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
    });
  }, [partnersList, partnerSearch]);

  const potentialDuplicatePartner = useMemo(() => {
    const clean = normalizeArabicText(form.name);
    if (!clean || clean.length < 2) return null;
    return partnersList.find((p: any) => normalizeArabicText(p.name) === clean || normalizeArabicText(p.name).includes(clean));
  }, [partnersList, form.name]);

  useDialogFocus(panelRef, isOpen && mounted, onClose);

  if (!isOpen || !mounted) return null;

  const regenerateCreateCode = (role?: string) => {
    const existingCodes = partnersList.map((p: any) => p.code);
    const nextCode = generateNextPartnerCode('مقاول', role ?? form.job_role, existingCodes);
    setForm((prev) => ({ ...prev, code: nextCode }));
  };

  const handleLinkSubmit = (partner: any, overrideSpecialty?: string) => {
    if (isSaving) return;
    onSave({
      mode: 'link',
      partnerId: partner.id,
      job_role: overrideSpecialty?.trim() || partner.job_role || undefined
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || isSaving) return;
    onSave({
      mode: 'create',
      ...form
    });
  };

  return createPortal(
    <div
      className="ent-dialog-backdrop no-print"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        direction: 'rtl'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        style={{
          background: 'var(--surface-card, #ffffff)',
          color: 'var(--text-primary, #0f172a)',
          borderRadius: '18px',
          width: '100%',
          maxWidth: '44rem',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          border: '1px solid rgba(226, 232, 240, 0.8)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface-sunken, #f8fafc)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: '#fef3c7',
                color: '#b45309',
                display: 'grid',
                placeItems: 'center'
              }}
            >
              <HardHat size={22} />
            </div>
            <div>
              <h2 id={`${id}-title`} style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900 }}>
                ربط أو إضافة مقاول باطن (مرتبط بقائمة البارتنر)
              </h2>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)' }}>
                اختر مقاولاً مسجلاً في قائمة الشركاء (البارتنر) أو أنشئ مقاولاً جديداً بكود تسلسلي تلقائي
              </p>
            </div>
          </div>
          <button
            type="button"
            className="ent-icon-button"
            onClick={onClose}
            disabled={isSaving}
            style={{
              background: 'none',
              border: 'none',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              color: '#64748b',
              padding: '6px',
              borderRadius: '8px'
            }}
            aria-label="إغلاق"
          >
            <X size={20} />
          </button>
        </header>

        {/* Tabs Switch */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.5rem',
            padding: '0.85rem 1.5rem',
            background: '#f1f5f9',
            borderBottom: '1px solid #e2e8f0'
          }}
        >
          <button
            type="button"
            onClick={() => setMode('link')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1rem',
              borderRadius: '10px',
              border: 'none',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: mode === 'link' ? '#0f172a' : '#ffffff',
              color: mode === 'link' ? '#ffffff' : '#475569',
              boxShadow: mode === 'link' ? '0 4px 12px rgba(15, 23, 42, 0.2)' : '0 1px 3px rgba(0,0,0,0.06)'
            }}
          >
            <Users size={16} />
            <span>قائمة الشركاء (البارتنر) ({partnersList.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('create')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1rem',
              borderRadius: '10px',
              border: 'none',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: mode === 'create' ? '#2563eb' : '#ffffff',
              color: mode === 'create' ? '#ffffff' : '#475569',
              boxShadow: mode === 'create' ? '0 4px 12px rgba(37, 99, 235, 0.2)' : '0 1px 3px rgba(0,0,0,0.06)'
            }}
          >
            <UserPlus size={16} />
            <span>تسجيل مقاول جديد في البارتنر</span>
          </button>
        </div>

        {/* Mode 1: Pick or Link from Partners */}
        {mode === 'link' ? (
          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', flex: 1 }}>
            {/* Search Box */}
            <div style={{ position: 'relative' }}>
              <Search size={17} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                value={partnerSearch}
                onChange={(e) => setPartnerSearch(e.target.value)}
                placeholder="ابحث بالاسم، الكود (مثل CON-001)، التخصص، أو رقم الهاتف..."
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.75rem 2.6rem 0.75rem 1rem',
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  outline: 'none'
                }}
              />
            </div>

            {/* Selected partner promotion confirmation bar */}
            {selectedExistingPartner && (
              <div
                style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  background: '#eff6ff',
                  border: '1.5px solid #93c5fd',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 900, color: '#1e40af', fontSize: '0.95rem' }}>
                    تأكيد ربط «{selectedExistingPartner.name}» ({selectedExistingPartner.code || 'بدون كود'}) كمقاول باطن
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedExistingPartner(null)}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}
                  >
                    إلغاء التحديد
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={linkSpecialty}
                    onChange={(e) => setLinkSpecialty(e.target.value)}
                    placeholder="التخصص (مثال: مقاول نجارة مسلحة، حدادة...)"
                    style={{
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #93c5fd',
                      fontWeight: 700,
                      fontSize: '0.88rem'
                    }}
                  />
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleLinkSubmit(selectedExistingPartner, linkSpecialty)}
                    style={{
                      padding: '0.55rem 1.25rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#2563eb',
                      color: '#fff',
                      fontWeight: 800,
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <Link2 size={15} />
                    <span>{isSaving ? 'جاري الربط...' : 'اعتماد وربط كمقاول'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Partners List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', maxHeight: '22rem', overflowY: 'auto', paddingLeft: '0.25rem' }}>
              {isLoadingPartners ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontWeight: 700 }}>
                  جاري تحميل قائمة البارتنر...
                </div>
              ) : sortedAndFilteredPartners.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed #cbd5e1', borderRadius: '12px', color: '#64748b' }}>
                  <p style={{ margin: '0 0 0.75rem 0', fontWeight: 700 }}>لم يتم العثور على شريك مطابق في البارتنر.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, name: partnerSearch.trim() }));
                      setMode('create');
                    }}
                    style={{
                      padding: '0.55rem 1.15rem',
                      borderRadius: '10px',
                      border: 'none',
                      background: '#2563eb',
                      color: '#fff',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    + تسجيل «{partnerSearch || 'مقاول جديد'}» في البارتنر والمقاولين
                  </button>
                </div>
              ) : (
                sortedAndFilteredPartners.map((p: any) => {
                  const isContractor = /مقاول/i.test(String(p.partner_type || ''));
                  const hasContractorRole = /مقاول/i.test(String(p.job_role || ''));
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        if (isContractor) {
                          handleLinkSubmit(p);
                        } else {
                          setSelectedExistingPartner(p);
                          setLinkSpecialty(p.job_role || 'مقاول باطن');
                        }
                      }}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.85rem 1rem',
                        borderRadius: '12px',
                        border: selectedExistingPartner?.id === p.id
                          ? '2px solid #2563eb'
                          : isContractor
                            ? '1.5px solid #bbf7d0'
                            : '1px solid #e2e8f0',
                        background: isContractor ? '#f0fdf4' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: isContractor ? '#dcfce7' : '#f1f5f9',
                            color: isContractor ? '#15803d' : '#475569',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 900
                          }}
                        >
                          {isContractor ? <CheckCircle2 size={18} /> : <User size={18} />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>{p.name}</span>
                            {p.code && (
                              <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', background: '#e2e8f0', color: '#334155', padding: '0.1rem 0.45rem', borderRadius: '6px' }}>
                                {p.code}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, marginTop: '0.15rem' }}>
                            {p.job_role || 'بدون تخصص محدد'}
                            {p.phone ? ` • ${p.phone}` : ''}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            padding: '0.25rem 0.65rem',
                            borderRadius: '999px',
                            background: isContractor ? '#dcfce7' : hasContractorRole ? '#fef3c7' : '#f1f5f9',
                            color: isContractor ? '#166534' : hasContractorRole ? '#92400e' : '#475569'
                          }}
                        >
                          {isContractor ? 'مقاول مسجل ✓' : (p.partner_type || 'شريك')}
                        </span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: isContractor ? '#15803d' : '#2563eb' }}>
                          {isContractor ? 'فتح الملف ←' : 'ربط ←'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* Mode 2: Create Brand New Contractor (Syncs to Partners + Subclaims) */
          <form onSubmit={handleCreateSubmit} style={{ overflowY: 'auto', flex: 1 }}>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
              {potentialDuplicatePartner && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    background: '#fffbeb',
                    border: '1px solid #fcd34d',
                    color: '#92400e',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={16} />
                    <span>«{potentialDuplicatePartner.name}» مسجل مسبقاً في البارتنر ({potentialDuplicatePartner.partner_type}).</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('link');
                      setPartnerSearch(potentialDuplicatePartner.name);
                      setSelectedExistingPartner(potentialDuplicatePartner);
                      setLinkSpecialty(potentialDuplicatePartner.job_role || 'مقاول باطن');
                    }}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#d97706',
                      color: '#fff',
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    ربط مباشر بدون تكرار
                  </button>
                </div>
              )}

              {/* Grid 1: Name and Code */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr', gap: '1rem' }}>
                <div>
                  <label
                    htmlFor={`${id}-name`}
                    style={{ display: 'block', fontSize: '0.86rem', fontWeight: 800, marginBottom: '0.375rem' }}
                  >
                    اسم المقاول / المؤسسة <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <User size={16} style={{ position: 'absolute', right: '12px', color: '#94a3b8' }} />
                    <input
                      id={`${id}-name`}
                      type="text"
                      required
                      placeholder="مثال: مؤسسة الأمل أو المعلم أحمد"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.625rem 2.25rem 0.625rem 0.75rem',
                        borderRadius: '10px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.92rem',
                        fontWeight: 700,
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                    <label htmlFor={`${id}-code`} style={{ fontSize: '0.86rem', fontWeight: 800, margin: 0 }}>
                      كود المقاول *
                    </label>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: isCodeAuto ? '#059669' : '#c2410c' }}>
                      {isCodeAuto ? '⚡ تلقائي' : '✍️ يدوي'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                      <Hash size={15} style={{ position: 'absolute', right: '10px', color: '#94a3b8' }} />
                      <input
                        id={`${id}-code`}
                        type="text"
                        required
                        placeholder="CON-001"
                        value={form.code}
                        onChange={(e) => {
                          setIsCodeAuto(false);
                          setForm({ ...form, code: e.target.value });
                        }}
                        style={{
                          width: '100%',
                          padding: '0.625rem 2rem 0.625rem 0.5rem',
                          borderRadius: '10px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '0.9rem',
                          fontFamily: 'monospace',
                          fontWeight: 800,
                          outline: 'none'
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCodeAuto(!isCodeAuto)}
                      title={isCodeAuto ? 'قفل التوليد للتحرير اليدوي' : 'تفعيل التوليد التلقائي'}
                      style={{
                        padding: '0.6rem',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        background: isCodeAuto ? '#fef3c7' : '#ffffff',
                        color: isCodeAuto ? '#b45309' : '#64748b',
                        cursor: 'pointer'
                      }}
                    >
                      {isCodeAuto ? <Lock size={15} /> : <Unlock size={15} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => regenerateCreateCode()}
                      title="إعادة التوليد التسلسلي"
                      style={{
                        padding: '0.6rem',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        cursor: 'pointer'
                      }}
                    >
                      <RefreshCw size={15} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Grid 2: Specialty and Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1rem' }}>
                <div>
                  <label
                    htmlFor={`${id}-specialty`}
                    style={{ display: 'block', fontSize: '0.86rem', fontWeight: 800, marginBottom: '0.375rem' }}
                  >
                    التخصص / المهنة <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Briefcase size={16} style={{ position: 'absolute', right: '12px', color: '#94a3b8' }} />
                    <select
                      id={`${id}-specialty`}
                      value={form.job_role}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm({ ...form, job_role: val });
                        if (isCodeAuto) regenerateCreateCode(val);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.625rem 2.25rem 0.625rem 0.75rem',
                        borderRadius: '10px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.92rem',
                        fontWeight: 700,
                        outline: 'none',
                        background: '#fff'
                      }}
                    >
                      {COMMON_SPECIALTIES.map((sp) => (
                        <option key={sp} value={sp}>
                          {sp}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor={`${id}-phone`}
                    style={{ display: 'block', fontSize: '0.86rem', fontWeight: 800, marginBottom: '0.375rem' }}
                  >
                    رقم الهاتف / الجوال
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Phone size={16} style={{ position: 'absolute', right: '12px', color: '#94a3b8' }} />
                    <input
                      id={`${id}-phone`}
                      type="tel"
                      placeholder="05xxxxxxx"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      dir="ltr"
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.75rem 0.625rem 2.25rem',
                        borderRadius: '10px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.92rem',
                        fontWeight: 700,
                        outline: 'none',
                        textAlign: 'right'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Grid 3: Identity / Commercial Reg & Address */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '1rem' }}>
                <div>
                  <label
                    htmlFor={`${id}-idnum`}
                    style={{ display: 'block', fontSize: '0.86rem', fontWeight: 800, marginBottom: '0.375rem' }}
                  >
                    رقم الهوية / السجل التجاري
                  </label>
                  <input
                    id={`${id}-idnum`}
                    type="text"
                    placeholder="اختياري"
                    value={form.identity_number}
                    onChange={(e) => setForm({ ...form, identity_number: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.75rem',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.92rem',
                      fontWeight: 700,
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor={`${id}-addr`}
                    style={{ display: 'block', fontSize: '0.86rem', fontWeight: 800, marginBottom: '0.375rem' }}
                  >
                    المدينة / العنوان
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <MapPin size={16} style={{ position: 'absolute', right: '12px', color: '#94a3b8' }} />
                    <input
                      id={`${id}-addr`}
                      type="text"
                      placeholder="مثال: القاهرة / الرياض"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.625rem 2.25rem 0.625rem 0.75rem',
                        borderRadius: '10px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.92rem',
                        fontWeight: 700,
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <footer
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid var(--border-color, #e2e8f0)',
                background: 'var(--surface-sunken, #f8fafc)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.75rem'
              }}
            >
              <button
                type="button"
                className="ent-button"
                onClick={onClose}
                disabled={isSaving}
                style={{
                  padding: '0.55rem 1.25rem',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#475569',
                  fontWeight: 700,
                  cursor: isSaving ? 'not-allowed' : 'pointer'
                }}
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSaving || !form.name.trim()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 1.5rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#2563eb',
                  color: '#fff',
                  fontWeight: 800,
                  cursor: isSaving || !form.name.trim() ? 'not-allowed' : 'pointer',
                  opacity: isSaving || !form.name.trim() ? 0.6 : 1,
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                }}
              >
                <Save size={16} />
                <span>{isSaving ? 'جاري الحفظ…' : 'حفظ المقاول في البارتنر والمقاولين'}</span>
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
