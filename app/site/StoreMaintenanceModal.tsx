"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import type { DeliveryLocation } from './delivery-location';
import type { WebsiteMaintenanceService } from './store-catalog';
import { CheckIcon, CloseIcon } from './StoreIcons';

const DeliveryLocationPicker = dynamic(() => import('./DeliveryLocationPicker'), {
  ssr: false,
});

interface StoreMaintenanceModalProps {
  selectedMaintenance: WebsiteMaintenanceService;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  mntRef: string | null;
  mntMode: string;
  setMntMode: (v: string) => void;
  mntName: string;
  setMntName: (v: string) => void;
  mntPhone: string;
  setMntPhone: (v: string) => void;
  mntCity: string;
  setMntCity: (v: string) => void;
  mntAddress: string;
  setMntAddress: (v: string) => void;
  mntLocation: DeliveryLocation | null;
  setMntLocation: (v: DeliveryLocation | null) => void;
  mntDate: string;
  setMntDate: (v: string) => void;
  mntNotes: string;
  setMntNotes: (v: string) => void;
  mntBusy: boolean;
  mntErr: string;
}

export default function StoreMaintenanceModal({
  selectedMaintenance,
  onClose,
  onSubmit,
  mntRef,
  mntMode,
  setMntMode,
  mntName,
  setMntName,
  mntPhone,
  setMntPhone,
  mntCity,
  setMntCity,
  mntAddress,
  setMntAddress,
  mntLocation,
  setMntLocation,
  mntDate,
  setMntDate,
  mntNotes,
  setMntNotes,
  mntBusy,
  mntErr,
}: StoreMaintenanceModalProps) {
  return (
    <div className="st-modal-overlay" onClick={onClose}>
      <div className="st-modal-card" onClick={(e) => e.stopPropagation()}>
        {mntRef ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '9999px',
                background: '#dcfce7',
                color: '#059669',
                display: 'grid',
                placeItems: 'center',
                marginInline: 'auto',
              }}
            >
              <CheckIcon size={22} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.16rem', fontWeight: 800, color: '#14181b' }}>
              تم تسجيل طلب التنفيذ والصيانة بنجاح
            </h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#525e6a', lineHeight: 1.7 }}>
              رقم المرجع: <strong style={{ fontFamily: 'ui-monospace, Consolas, monospace', color: '#14181b' }}>{mntRef}</strong>
              <br />
              سيتواصل معك المهندس المختص على الرقم <strong dir="ltr">{mntPhone}</strong> لتحديد موعد المعاينة.
            </p>
            <button type="button" onClick={onClose} className="pw-btn pw-btn-primary pw-btn-lg">
              إغلاق
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="st-modal-head">
              <h3>حجز خدمة تنفيذ أو صيانة هندسية</h3>
              <button type="button" className="st-modal-close" onClick={onClose} aria-label="إغلاق">
                <CloseIcon />
              </button>
            </div>

            <div className="st-modal-service-box">
              <strong>{selectedMaintenance.title}</strong>
              <span>
                الكود: {selectedMaintenance.code} · {selectedMaintenance.warrantyLabel}
              </span>
            </div>

            <select className="st-modal-input" value={mntMode} onChange={(e) => setMntMode(e.target.value)}>
              <option value="تنفيذ وتأسيس جديد">تنفيذ وتأسيس جديد</option>
              <option value="صيانة وإصلاح عطل">صيانة وإصلاح عطل</option>
              <option value="صيانة دورية / فحص وقائي">صيانة دورية / فحص وقائي</option>
              <option value="طوارئ سريعة">طوارئ سريعة</option>
            </select>

            <div className="st-modal-grid2">
              <input
                className="st-modal-input"
                value={mntName}
                onChange={(e) => setMntName(e.target.value)}
                placeholder="الاسم الكامل *"
                required
              />
              <input
                className="st-modal-input"
                value={mntPhone}
                onChange={(e) => setMntPhone(e.target.value)}
                placeholder="رقم الجوال *"
                dir="ltr"
                inputMode="tel"
                required
                style={{ textAlign: 'right' }}
              />
            </div>

            <div className="st-modal-grid2">
              <input
                className="st-modal-input"
                value={mntCity}
                onChange={(e) => setMntCity(e.target.value)}
                placeholder="المدينة والمنطقة"
              />
              <input
                className="st-modal-input"
                value={mntDate}
                onChange={(e) => setMntDate(e.target.value)}
                placeholder="الموعد المفضل (مثال: غداً 4 عصراً)"
              />
            </div>

            <input
              className="st-modal-input"
              value={mntAddress}
              onChange={(e) => setMntAddress(e.target.value)}
              placeholder="العنوان التفصيلي للموقع"
            />

            <DeliveryLocationPicker value={mntLocation} onChange={setMntLocation} />

            <textarea
              className="st-modal-input"
              value={mntNotes}
              onChange={(e) => setMntNotes(e.target.value)}
              placeholder="وصف العطل أو الأعمال المطلوب تنفيذها (مساحة تقريبية / تفاصيل)"
              rows={3}
              style={{ resize: 'vertical' }}
            />

            {mntErr && <div className="st-modal-err">{mntErr}</div>}

            <button type="submit" disabled={mntBusy} className="pw-btn pw-btn-primary pw-btn-lg">
              {mntBusy ? 'جاري إرسال الطلب...' : 'اعتماد وإرسال طلب التنفيذ والصيانة'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
