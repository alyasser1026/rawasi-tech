"use client";
import React from 'react';
import { THEME } from '@/lib/theme';

interface SmartFilterProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  searchPlaceholder?: string;
  dateFrom: string;
  setDateFrom: (val: string) => void;
  dateTo: string;
  setDateTo: (val: string) => void;
  extraFilters?: React.ReactNode; // لو حبيت تضيف فلتر إضافي زي Dropdown للحالة
}

export default function SmartFilter({
  searchQuery, setSearchQuery, searchPlaceholder = "بحث عام...",
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  extraFilters
}: SmartFilterProps) {
  return (
    <div style={{ display: 'flex', gap: '15px', alignItems: 'center', background: 'white', padding: '15px', borderRadius: '15px', border: `2px solid ${THEME.border}`, flexWrap: 'wrap', marginBottom: '25px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
        
        {/* 🔍 مربع البحث النصي */}
        <div style={{ flex: '1 1 300px' }}>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '12px 15px', borderRadius: '10px', border: `1px solid ${THEME.border}`, outline: 'none', fontWeight: 900, fontSize: 'var(--fs-lg)', color: THEME.primary, background: '#f8fafc' }}
          />
        </div>

        {/* 📅 فلتر التاريخ (من - إلى) */}
        <div style={{ display: 'flex', gap: '10px', flex: '1 1 350px', alignItems: 'center' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '5px 12px', borderRadius: '10px', border: `1px solid ${THEME.border}` }}>
               <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, marginLeft: '10px', whiteSpace: 'nowrap' }}>من تاريخ:</span>
               <input
                 type="date"
                 value={dateFrom}
                 onChange={(e) => setDateFrom(e.target.value)}
                 style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontWeight: 900, fontSize: 'var(--fs-md)', color: THEME.primary }}
               />
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '5px 12px', borderRadius: '10px', border: `1px solid ${THEME.border}` }}>
               <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, marginLeft: '10px', whiteSpace: 'nowrap' }}>إلى تاريخ:</span>
               <input
                 type="date"
                 value={dateTo}
                 onChange={(e) => setDateTo(e.target.value)}
                 style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontWeight: 900, fontSize: 'var(--fs-md)', color: THEME.primary }}
               />
            </div>
        </div>

        {/* 🔽 أي فلاتر إضافية (اختياري) */}
        {extraFilters && (
            <div style={{ flex: '1 1 200px' }}>
                {extraFilters}
            </div>
        )}
    </div>
  );
}