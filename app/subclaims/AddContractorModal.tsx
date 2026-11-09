"use client";
import React, { useState, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HardHat, X, Save, User, Phone, Hash, FileText, MapPin, Briefcase } from 'lucide-react';
import { useDialogFocus } from '@/hooks/useDialogFocus';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<any> | void;
  isSaving?: boolean;
}

const COMMON_SPECIALTIES = [
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

export default function AddContractorModal({ isOpen, onClose, onSave, isSaving = false }: Props) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();

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
    if (isOpen) {
      const randPart = Math.floor(1000 + Math.random() * 9000);
      setForm({
        name: '',
        code: `SUB-${randPart}`,
        job_role: 'نجارة مسلحة',
        phone: '',
        identity_number: '',
        address: '',
        notes: ''
      });
    }
  }, [isOpen]);

  useDialogFocus(panelRef, isOpen && mounted, onClose);

  if (!isOpen || !mounted) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
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
          maxWidth: '38rem',
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
                إضافة مقاول باطن جديد
              </h2>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)' }}>
                تسجيل مقاول جديد في قاعدة البيانات لإسناد أوامر الشغل وإصدار المستخلصات
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

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
            {/* Grid 1: Name and Code */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
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
                <label
                  htmlFor={`${id}-code`}
                  style={{ display: 'block', fontSize: '0.86rem', fontWeight: 800, marginBottom: '0.375rem' }}
                >
                  كود المقاول <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Hash size={16} style={{ position: 'absolute', right: '12px', color: '#94a3b8' }} />
                  <input
                    id={`${id}-code`}
                    type="text"
                    required
                    placeholder="SUB-001"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
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
                    onChange={(e) => setForm({ ...form, job_role: e.target.value })}
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
                    placeholder="مثال: الرياض - حي النرجس"
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
              <span>{isSaving ? 'جاري الحفظ…' : 'حفظ المقاول'}</span>
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body
  );
}
