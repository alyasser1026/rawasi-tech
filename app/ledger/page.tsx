"use client";
import React from 'react';
import { useLedgerLogic } from './ledger_logic';
import MasterPage from '@/components/MasterPage';
import RawasiSmartTable from '@/components/rawasismarttable';
import SmartCombo from '@/components/SmartCombo';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import { formatCurrency } from '@/lib/helpers';
import { THEME } from '@/lib/theme';

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
          <div style={{ fontWeight: 900, color: THEME.primary }}>{row.notes || row.journal_headers?.description || row.item_name || 'بدون بيان'}</div>
          <div style={{ fontSize: '11px', opacity: 0.7, color: '#64748b' }}>
            {row.projects?.name || row.projects?.Property || 'مصاريف إدارية'} | {row.partners?.name || 'عام'}
          </div>
        </div>
      ) : null
    },
    { 
      header: 'مدين (+)', 
      render: (row: any) => row ? <span style={{ color: THEME.success, fontWeight: 700 }}>{row.debit > 0 ? formatCurrency(row.debit) : '-'}</span> : null
    },
    { 
      header: 'دائن (-)', 
      render: (row: any) => row ? <span style={{ color: THEME.ruby, fontWeight: 700 }}>{row.credit > 0 ? formatCurrency(row.credit) : '-'}</span> : null
    },
    { 
      header: 'الرصيد المتراكم', 
      render: (row: any) => row ? <b style={{ fontWeight: 900, color: THEME.coffeeDark }}>{formatCurrency(row.runningBalance)}</b> : null
    }
  ];

  return (
    <MasterPage title="كشف حساب تفصيلي" subtitle="استعراض حركات الأستاذ العام والتحليل المالي">
      
      <RawasiSidebarManager 
        summary={
          <div className="summary-card">
            <span style={{ fontSize: '12px', fontWeight: 800, opacity: 0.8 }}>إجمالي رصيد الحساب</span>
            <div style={{ fontSize: '24px', fontWeight: 900, marginTop: '5px' }}>
              {formatCurrency(logic.currentBalance)}
            </div>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', margin: '15px 0' }} />
            <div style={{ fontSize: '11px', opacity: 0.7 }}>
                حركة مدينة: {formatCurrency(logic.totalDebit)} <br/>
                حركة دائنة: {formatCurrency(logic.totalCredit)}
            </div>
          </div>
        }
      />

      <style>{`
        .control-panel {
          position: relative; /* السحر هنا: تفعيل التموضع النسبي */
          z-index: 100;      /* رفع الحاوية فوق مستوى الجدول */
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(15px);
          padding: 30px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.8);
          margin-bottom: 25px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.03);
          display: flex;
          align-items: flex-end;
          gap: 20px;
        }
        .summary-card {
          background: linear-gradient(135deg, ${THEME.coffeeDark}, ${THEME.primary});
          color: white;
          padding: 20px;
          border-radius: 14px;
          box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }
      `}</style>

      {/* 🎯 لوحة التحكم المركزية */}
      <div className="control-panel">
        <div style={{ flex: 1 }}>
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
            padding: '14px 25px', borderRadius: '14px', border: 'none', 
            background: THEME.coffeeDark, color: THEME.goldAccent, 
            fontWeight: 900, cursor: 'pointer', height: '52px'
          }}
        >
          طباعة الكشف
        </button>
      </div>

      {/* الجدول الماسي */}
      {!logic.selectedAccountId ? (
          <div style={{ textAlign: 'center', padding: '100px', color: '#94a3b8', background: 'white', borderRadius: '14px', fontWeight: 900 }}>
             يرجى اختيار حساب من القائمة أعلاه لعرض كشف الحساب.
          </div>
      ) : (
          <RawasiSmartTable 
            data={logic.entries}
            columns={columns}
            isLoading={logic.isLoading}
            enableExport={true}
          />
      )}

    </MasterPage>
  );
}