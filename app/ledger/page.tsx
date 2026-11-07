"use client";
import React from 'react';
import { useLedgerLogic } from './ledger_logic';
import MasterPage from '@/components/MasterPage';
import RawasiSmartTable from '@/components/rawasismarttable';
import SmartCombo from '@/components/SmartCombo';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import { formatCurrency } from '@/lib/helpers';

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
    <MasterPage title="كشف حساب تفصيلي" subtitle="استعراض حركات الأستاذ العام والتحليل المالي">
      
      <RawasiSidebarManager 
        summary={
          <div className="ledger-balance-summary">
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-secondary)' }}>إجمالي رصيد الحساب</span>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, marginTop: '0.3125rem' }}>
              {formatCurrency(logic.currentBalance)}
            </div>
            <div style={{ height: '1px', background: 'var(--control-edge)', margin: '0.9375rem 0' }} />
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
                حركة مدينة: {formatCurrency(logic.totalDebit)} <br/>
                حركة دائنة: {formatCurrency(logic.totalCredit)}
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
          border-radius: 14px;
          border: 1px solid var(--control-edge);
          margin-bottom: 1.5625rem;
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          gap: 1.25rem;
        }
        .ledger-balance-summary {
          background: var(--surface-subcard);
          color: var(--text-primary);
          border: 1px solid var(--control-edge);
          padding: 1.25rem;
          border-radius: 14px;
        }
        .ledger-empty {
          background: var(--surface-card);
          color: var(--text-secondary);
          border: 1px solid var(--control-edge);
          border-radius: 14px;
          text-align: center;
          padding: clamp(2.5rem, 8vw, 6.25rem) 1rem;
          font-weight: 900;
        }
        @media print {
          .ledger-movements .rawasi-printable-table :is(th, td, td *) { color: #000 !important; }
        }
      `}</style>

      {/* 🎯 لوحة التحكم المركزية */}
      <div className="ledger-control-panel no-print">
        <div style={{ flex: '1 1 16rem', minWidth: 0 }}>
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
          style={{ 
            padding: '0.875rem 1.5625rem', borderRadius: '14px', border: 'none', 
            background: 'var(--action-fill)', color: 'var(--action-ink)',
            fontWeight: 900, cursor: 'pointer', height: '3.25rem'
          }}
        >
          طباعة الكشف
        </button>
      </div>

      {/* الجدول الماسي */}
      {!logic.selectedAccountId ? (
          <div className="ledger-empty">
             يرجى اختيار حساب من القائمة أعلاه لعرض كشف الحساب.
          </div>
      ) : (
          <div className="ledger-movements">
            <RawasiSmartTable
              data={logic.entries}
              columns={columns}
              isLoading={logic.isLoading}
              enableExport={true}
            />
          </div>
      )}

    </MasterPage>
  );
}