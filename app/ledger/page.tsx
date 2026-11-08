"use client";
import React from 'react';
import { useLedgerLogic } from './ledger_logic';
import MasterPage from '@/components/MasterPage';
import RawasiSmartTable from '@/components/rawasismarttable';
import SmartCombo from '@/components/SmartCombo';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import { formatCurrency } from '@/lib/helpers';
import { Printer } from 'lucide-react';

export default function AccountLedger() {
  const logic = useLedgerLogic();

  // 🏗️ تعريف أعمدة الجدول (مع حراس الرندر)
  const columns = [
    { 
      header: 'التاريخ', 
      render: (row: any) => row ? <span>{row.journal_headers?.entry_date}</span> : null
    },
    { 
      header: 'البيان / المشروع', 
      render: (row: any) => row ? (
        <div>
          <div style={{ fontWeight: 900, color: 'var(--text-primary)' }}>{row.notes || row.journal_headers?.description || row.item_name || 'بدون بيان'}</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
            {row.projects?.name || row.projects?.Property || 'مصاريف إدارية'} | {row.partners?.name || 'عام'}
          </div>
        </div>
      ) : null
    },
    { 
      header: 'مدين (+)', 
      render: (row: any) => row ? <span style={{ color: 'var(--status-positive)', fontWeight: 700 }}>{row.debit > 0 ? formatCurrency(row.debit) : '-'}</span> : null
    },
    { 
      header: 'دائن (-)', 
      render: (row: any) => row ? <span style={{ color: 'var(--status-negative)', fontWeight: 700 }}>{row.credit > 0 ? formatCurrency(row.credit) : '-'}</span> : null
    },
    { 
      header: 'الرصيد المتراكم', 
      render: (row: any) => row ? <b style={{ fontWeight: 900, color: 'var(--text-primary)' }}>{formatCurrency(row.runningBalance)}</b> : null
    }
  ];

  return (
    <div className="clean-page enterprise-page">
      <MasterPage title="كشف حساب تفصيلي" subtitle="استعراض حركات الأستاذ العام والتحليل المالي">
        
        <RawasiSidebarManager 
          summary={
            <div className="ledger-balance-summary">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', width: '100%' }}>
                <div>
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-secondary)' }}>إجمالي رصيد الحساب</span>
                  <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                    {formatCurrency(logic.currentBalance)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div className="ledger-stat-pill">
                    <span className="ledger-stat-label">حركة مدينة</span>
                    <span className="ledger-stat-val positive">{formatCurrency(logic.totalDebit)}</span>
                  </div>
                  <div className="ledger-stat-pill">
                    <span className="ledger-stat-label">حركة دائنة</span>
                    <span className="ledger-stat-val negative">{formatCurrency(logic.totalCredit)}</span>
                  </div>
                </div>
              </div>
            </div>
          }
        />

        <style>{`
          .ledger-control-panel {
            position: relative;
            z-index: 100;
            background: var(--surface-card);
            padding: clamp(1rem, 3vw, 1.875rem);
            border-radius: var(--phi-radius-card, 18px);
            border: none !important;
            box-shadow: var(--shadow-ambient);
            margin-bottom: 1.5625rem;
            display: flex;
            flex-wrap: wrap;
            align-items: flex-end;
            gap: 1.25rem;
            overflow: hidden;
          }
          .ledger-control-panel::before {
            content: '';
            position: absolute;
            top: 0; left: 8%; right: 8%;
            height: 1.5px;
            background: var(--specular-beam);
            pointer-events: none;
          }
          .ledger-balance-summary {
            background: var(--surface-card);
            color: var(--text-primary);
            border: none !important;
            box-shadow: var(--shadow-ambient);
            padding: 1.25rem 1.5rem;
            border-radius: var(--phi-radius-card, 18px);
            position: relative;
            overflow: hidden;
          }
          .ledger-balance-summary::before {
            content: '';
            position: absolute;
            top: 0; left: 8%; right: 8%;
            height: 1.5px;
            background: var(--specular-beam);
            pointer-events: none;
          }
          .ledger-stat-pill {
            background: var(--surface-sunken);
            box-shadow: var(--shadow-sunken);
            padding: 0.625rem 1.125rem;
            border-radius: 12px;
            border: none;
            min-width: 9rem;
          }
          .ledger-stat-label {
            font-size: var(--fs-xs);
            color: var(--text-secondary);
            font-weight: 800;
            display: block;
            margin-bottom: 0.25rem;
          }
          .ledger-stat-val {
            font-size: var(--fs-md);
            font-weight: 900;
            display: block;
          }
          .ledger-stat-val.positive { color: var(--status-positive); }
          .ledger-stat-val.negative { color: var(--status-negative); }
          .ledger-empty {
            background: var(--surface-card);
            color: var(--text-secondary);
            border: none !important;
            box-shadow: var(--shadow-ambient);
            border-radius: var(--phi-radius-card, 18px);
            text-align: center;
            padding: clamp(2.5rem, 8vw, 5rem) 1rem;
            position: relative;
            overflow: hidden;
          }
          .ledger-empty::before {
            content: '';
            position: absolute;
            top: 0; left: 8%; right: 8%;
            height: 1.5px;
            background: var(--specular-beam);
            pointer-events: none;
          }
          .table-glass-wrapper {
            background: var(--surface-card);
            border-radius: var(--phi-radius-card, 18px);
            padding: 0.75rem;
            border: none !important;
            box-shadow: var(--shadow-ambient);
            position: relative;
            overflow: hidden;
          }
          .table-glass-wrapper::before {
            content: '';
            position: absolute;
            top: 0; left: 8%; right: 8%;
            height: 1.5px;
            background: var(--specular-beam);
            pointer-events: none;
          }
          @media print {
            .ledger-movements .rawasi-printable-table :is(th, td, td *) { color: #000 !important; }
          }
        `}</style>

        {/* 🎯 لوحة التحكم المركزية */}
        <div className="ledger-control-panel no-print">
          <div style={{ flex: '1 1 20rem', minWidth: 0 }}>
            <SmartCombo 
              label="ابحث واختر الحساب المالي للمراجعة"
              table="accounts"
              displayCol="name"
              searchCols="name,code"
              placeholder="اكتب اسم الحساب أو الكود (مثلاً: البنك، العهدة...)"
              onSelect={(val: any) => logic.setSelectedAccountId(val?.id || '')}
            />
          </div>
          <button 
            onClick={() => window.print()}
            className="ent-button ent-primary"
            style={{ height: '3.125rem', padding: '0 1.5rem', borderRadius: '12px', fontWeight: 900 }}
          >
            <Printer size={16} aria-hidden="true" />
            <span>طباعة الكشف</span>
          </button>
        </div>

        {/* الجدول الماسي */}
        {!logic.selectedAccountId ? (
            <div className="ledger-empty">
               <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  يرجى اختيار حساب من القائمة أعلاه لعرض كشف الحساب
               </div>
               <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', fontWeight: 700 }}>
                  يمكنك البحث باسم الحساب أو رقمه من دليل الحسابات
               </div>
            </div>
        ) : (
            <div className="ledger-movements table-glass-wrapper">
              <RawasiSmartTable
                data={logic.entries}
                columns={columns}
                isLoading={logic.isLoading}
                enableExport={true}
              />
            </div>
        )}

      </MasterPage>
    </div>
  );
}
