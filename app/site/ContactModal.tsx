"use client";

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  collectClientDeviceDetails,
  rememberVisitorContact,
} from '@/lib/client-device-info';

export interface ContactModalSiteConfig {
  name: string;
  nameEn: string;
  offices: string[];
  contact: {
    phone: string;
    whatsapp: string;
    email: string;
    address: string;
    hours: string;
  };
}

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  site: ContactModalSiteConfig;
}

export default function ContactModal({ isOpen, onClose, site }: ContactModalProps) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [kind, setKind] = useState('فيلا');
  const [place, setPlace] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  const c = site.contact;
  const waDigits = (c.whatsapp || '').replace(/\D/g, '');
  const telHref = c.phone ? `tel:${c.phone.replace(/\s+/g, '')}` : '';

  const buildInquiryMessage = () =>
    [
      'طلب معاينة ومقايسة',
      `الاسم: ${name || '—'}`,
      phone && `الهاتف: ${phone}`,
      `نوع المشروع: ${kind}`,
      place && `الموقع: ${place}`,
      notes && `تفاصيل: ${notes}`,
    ]
      .filter(Boolean)
      .join('\n');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    rememberVisitorContact({ name: cleanName, phone: cleanPhone });

    void collectClientDeviceDetails(false)
      .then((deviceDetails) =>
        fetch('/api/notify/visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'lead_action',
            action: 'inquiry_form',
            label: 'إرسال طلب معاينة ومقايسة',
            name: cleanName,
            phone: cleanPhone,
            projectKind: kind,
            projectLocation: place.trim(),
            notes: notes.trim(),
            deviceDetails,
          }),
          keepalive: true,
        })
      )
      .catch(() => {});

    const text = buildInquiryMessage();
    if (waDigits) {
      window.open(
        `https://wa.me/${waDigits}?text=${encodeURIComponent(text)}`,
        '_blank',
        'noopener,noreferrer'
      );
    } else if (c.email) {
      window.location.href = `mailto:${c.email}?subject=${encodeURIComponent('طلب معاينة ومقايسة')}&body=${encodeURIComponent(text)}`;
    }
    onClose();
  };

  return createPortal(
    <div
      className="phi-contact-overlay"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="phi-contact-modal-title"
      onClick={onClose}
    >
      <style>{`
        .phi-contact-overlay {
          position: fixed;
          inset: 0;
          z-index: 2147482000;
          background: rgba(11, 16, 22, 0.72);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          overflow-y: auto;
        }

        .phi-contact-card {
          position: relative;
          width: 100%;
          max-width: 600px;
          background: #ffffff;
          color: #14181b;
          border: 1px solid #e3e6e9;
          border-radius: 24px;
          padding: 24px 26px 22px;
          box-shadow: 0 32px 72px -18px rgba(10, 15, 20, 0.48);
          overflow: hidden;
          animation: phiContactPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          max-height: calc(100dvh - 32px);
          overflow-y: auto;
        }

        @keyframes phiContactPop {
          from { opacity: 0; transform: translateY(10px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .phi-contact-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #c75517 0%, #f97316 55%, #ffb074 100%);
        }

        .phi-contact-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .phi-contact-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .phi-contact-brand img {
          width: 34px;
          height: 34px;
          object-fit: contain;
        }

        .phi-contact-brand strong {
          display: block;
          font-size: 1.05rem;
          font-weight: 900;
          color: #14181b;
          line-height: 1.25;
        }

        .phi-contact-brand small {
          display: block;
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          color: #c75517;
        }

        .phi-contact-close {
          width: 36px;
          height: 36px;
          border-radius: 11px;
          border: 1px solid #e3e6e9;
          background: #f8fafc;
          color: #47525c;
          display: grid;
          place-items: center;
          cursor: pointer;
          font-weight: 900;
          transition: all 0.16s ease;
        }

        .phi-contact-close:hover {
          background: #fee2e2;
          border-color: #fecaca;
          color: #b91c1c;
        }

        .phi-contact-eyebrow {
          font-size: 0.76rem;
          font-weight: 900;
          color: #c75517;
          margin-bottom: 4px;
        }

        .phi-contact-head h2 {
          margin: 0 0 6px;
          font-size: 1.38rem;
          font-weight: 900;
          color: #14181b;
          line-height: 1.35;
        }

        .phi-contact-head h2 em {
          font-style: normal;
          color: #c75517;
        }

        .phi-contact-head p {
          margin: 0 0 14px;
          font-size: 0.86rem;
          color: #5b6670;
          line-height: 1.65;
        }

        .phi-contact-quick {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 14px;
        }

        .phi-contact-qbtn {
          flex: 1 1 150px;
          min-height: 42px;
          padding: 8px 12px;
          border-radius: 12px;
          font-size: 0.82rem;
          font-weight: 800;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          transition: transform 0.15s ease, filter 0.15s ease;
          border: 1px solid transparent;
        }

        .phi-contact-qbtn:hover {
          transform: translateY(-1px);
          filter: brightness(0.97);
        }

        .phi-contact-qbtn.is-wa {
          background: #ecfdf5;
          color: #065f46;
          border-color: #a7f3d0;
        }

        .phi-contact-qbtn.is-tel {
          background: #fff7ed;
          color: #9a3412;
          border-color: #fed7aa;
        }

        .phi-contact-qbtn.is-mail {
          background: #f1f5f9;
          color: #1e293b;
          border-color: #cbd5e1;
        }

        .phi-contact-meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 8px 14px;
          padding: 10px 14px;
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid #e3e6e9;
          margin-bottom: 16px;
          font-size: 0.78rem;
          color: #47525c;
        }

        .phi-contact-offices {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .phi-contact-offices span {
          padding: 2px 9px;
          border-radius: 999px;
          background: #ffffff;
          border: 1px solid #e3e6e9;
          font-weight: 800;
          color: #14181b;
          font-size: 0.73rem;
        }

        .phi-contact-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .phi-contact-grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .phi-contact-field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .phi-contact-field span {
          font-size: 0.78rem;
          font-weight: 800;
          color: #334155;
        }

        .phi-contact-field input,
        .phi-contact-field select,
        .phi-contact-field textarea {
          width: 100%;
          border: 1.5px solid #e3e6e9;
          background: #f8fafc;
          color: #14181b;
          border-radius: 12px;
          padding: 10px 12px;
          font: inherit;
          font-size: 0.9rem;
          font-weight: 600;
          outline: none;
          transition: border-color 0.16s ease, background 0.16s ease;
        }

        .phi-contact-field textarea {
          min-height: 78px;
          resize: vertical;
        }

        .phi-contact-field input:focus,
        .phi-contact-field select:focus,
        .phi-contact-field textarea:focus {
          border-color: #c75517;
          background: #ffffff;
        }

        .phi-contact-submit {
          min-height: 46px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #c75517 0%, #f97316 100%);
          color: #ffffff;
          font: inherit;
          font-size: 0.95rem;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 12px 24px -12px rgba(199, 85, 23, 0.8);
          transition: filter 0.16s ease, transform 0.15s ease;
        }

        .phi-contact-submit:hover {
          filter: brightness(1.06);
          transform: translateY(-1px);
        }

        .phi-contact-note {
          margin: 0;
          font-size: 0.74rem;
          color: #64748b;
          text-align: center;
          line-height: 1.55;
        }

        @media (max-width: 560px) {
          .phi-contact-card {
            padding: 20px 16px 18px;
            border-radius: 20px;
          }
          .phi-contact-grid2 {
            grid-template-columns: 1fr;
          }
          .phi-contact-field input,
          .phi-contact-field select,
          .phi-contact-field textarea {
            font-size: 16px !important;
          }
        }
      `}</style>

      <div className="phi-contact-card" onClick={(e) => e.stopPropagation()}>
        <div className="phi-contact-bar" aria-hidden="true" />

        <div className="phi-contact-top">
          <div className="phi-contact-brand">
            <img src="/brand/phitech-mark-color.svg" alt="" />
            <div>
              <strong>{site.name}</strong>
              <small>{site.nameEn}</small>
            </div>
          </div>
          <button
            type="button"
            className="phi-contact-close"
            onClick={onClose}
            aria-label="إغلاق نافذة التواصل"
          >
            ✕
          </button>
        </div>

        <div className="phi-contact-head">
          <div className="phi-contact-eyebrow">تواصل مباشر</div>
          <h2 id="phi-contact-modal-title">
            ابدأ بمعاينة <em>ومقايسة</em> لمشروعك
          </h2>
          <p>اختر وسيلة التواصل السريع أو أرسل تفاصيل مشروعك، وسيتواصل معك فريقنا الهندسي فوراً.</p>
        </div>

        {(waDigits || telHref || c.email) && (
          <div className="phi-contact-quick">
            {waDigits && (
              <a
                href={`https://wa.me/${waDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="phi-contact-qbtn is-wa"
              >
                <span>💬</span>
                <span>واتساب مباشر</span>
              </a>
            )}
            {telHref && (
              <a href={telHref} className="phi-contact-qbtn is-tel">
                <span>📞</span>
                <span dir="ltr">{c.phone}</span>
              </a>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`} className="phi-contact-qbtn is-mail">
                <span>✉️</span>
                <span dir="ltr">{c.email}</span>
              </a>
            )}
          </div>
        )}

        {(c.hours || c.address || site.offices.length > 0) && (
          <div className="phi-contact-meta">
            <div>
              {c.hours && <div>🕒 {c.hours}</div>}
              {c.address && !site.offices.length && <div>📍 {c.address}</div>}
            </div>
            {site.offices.length > 0 && (
              <div className="phi-contact-offices">
                {site.offices.map((office) => (
                  <span key={office}>{office}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {(waDigits || c.email) && (
          <form className="phi-contact-form" onSubmit={handleSubmit}>
            <div className="phi-contact-grid2">
              <label className="phi-contact-field">
                <span>الاسم</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="الاسم الكريم"
                />
              </label>
              <label className="phi-contact-field">
                <span>رقم الهاتف</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  placeholder="+20 / +966"
                />
              </label>
            </div>

            <div className="phi-contact-grid2">
              <label className="phi-contact-field">
                <span>نوع المشروع</span>
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  {['فيلا', 'عمارة / برج', 'تشطيب وحدة', 'مبنى تجاري', 'أخرى'].map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
              <label className="phi-contact-field">
                <span>موقع المشروع</span>
                <input
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="المدينة / الحي"
                />
              </label>
            </div>

            <label className="phi-contact-field">
              <span>تفاصيل إضافية</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="اكتب المساحة التقريبية أو الأعمال المطلوبة..."
              />
            </label>

            <button type="submit" className="phi-contact-submit">
              {waDigits ? 'إرسال الطلب عبر واتساب ←' : 'إرسال الطلب بالبريد ←'}
            </button>
            <p className="phi-contact-note">
              سيُفتح تطبيق {waDigits ? 'واتساب' : 'البريد الإلكتروني'} بالرسالة جاهزة لتراجعها وترسلها بنفسك.
            </p>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
