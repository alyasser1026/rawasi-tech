"use client";
import React from 'react';
import { useBulkBudgetLogic } from './bulk_budget_logic';
import LoadingScreen from '@/components/LoadingScreen';
import SecureAction from '@/components/SecureAction';
import { Building, House } from 'lucide-react';

export default function BulkBudgetPage() {
  const logic = useBulkBudgetLogic();

  return (
    <div className="clean-page enterprise-page print-container" style={{ direction: 'rtl', padding: '1.25rem' }}>
      <style>{`
        .glass-header {
          background: var(--surface-card, #ffffff);
          border: none;
          border-radius: var(--phi-radius-card, 18px);
          padding: 1.25rem;
          margin-bottom: 1.25rem;
          box-shadow: var(--shadow-ambient);
          display: flex;
          align-items: center;
          gap: 1.25rem;
          flex-wrap: wrap;
        }
        .header-title { 
          font-size: var(--fs-xl); 
          font-weight: 800; 
          color: var(--text-primary, #0f172a); 
          margin: 0; 
          display: flex; 
          align-items: center; 
          gap: 0.625rem; 
        }
        
        .filters-row { display: flex; gap: 1.25rem; flex: 1; align-items: flex-end; flex-wrap: wrap; }
        .filter-group { display: flex; flex-direction: column; gap: 0.375rem; flex: 1; min-width: 11.25rem; }
        .filter-group label { font-size: var(--fs-xs); font-weight: 800; color: var(--text-secondary, #475569); }
        
        .styled-select {
          height: 2.75rem;
          padding: 0 0.875rem;
          border-radius: 12px;
          border: none;
          background: var(--surface-sunken, #f8fafc);
          box-shadow: var(--shadow-sunken, inset 0 2px 4px rgba(0,0,0,0.06));
          font-size: var(--fs-sm);
          font-weight: 700;
          color: var(--text-primary, #1e293b);
          outline: none;
          transition: all 0.2s;
          cursor: pointer;
        }
        .styled-select:focus { 
          box-shadow: 0 0 0 3px rgba(194, 65, 12, 0.2); 
        }

        .btn-save {
          background: linear-gradient(135deg, var(--accent-ink, #c2410c), #a16207);
          color: white;
          border: none;
          height: 2.75rem;
          padding: 0 1.5rem;
          border-radius: 12px;
          font-weight: 800;
          font-size: var(--fs-sm);
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          box-shadow: var(--shadow-elevation);
        }
        .btn-save:hover { transform: translateY(-1px); filter: brightness(1.1); box-shadow: var(--shadow-ambient); }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }

        .table-container {
          background: var(--surface-card, #ffffff);
          border-radius: var(--phi-radius-card, 18px);
          border: none;
          box-shadow: var(--shadow-ambient);
          overflow: hidden;
          overflow-x: auto;
        }
        .bulk-table { width: 100%; border-collapse: collapse; }
        .bulk-table th {
          background: var(--table-head-bg, var(--surface-card, #ffffff));
          padding: 0.875rem 1rem;
          text-align: right;
          font-weight: 800;
          color: var(--text-secondary, #334155);
          font-size: var(--fs-sm);
          border-bottom: 1px solid var(--table-zebra-bg, rgba(0,0,0,0.04));
          white-space: nowrap;
        }
        .bulk-table td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--table-zebra-bg, rgba(0,0,0,0.03));
          vertical-align: middle;
        }
        .bulk-table tr:hover { background: var(--table-hover-bg, rgba(0,0,0,0.015)); }
        
        .styled-input {
          width: 100%;
          height: 2.75rem;
          padding: 0 0.75rem;
          border-radius: 10px;
          border: none;
          background: var(--surface-sunken, #f8fafc);
          box-shadow: var(--shadow-sunken, inset 0 1px 3px rgba(0,0,0,0.06));
          font-size: var(--fs-sm);
          font-weight: 700;
          color: var(--text-primary, #0f172a);
          transition: all 0.2s;
          text-align: center;
          outline: none;
        }
        .styled-input:focus {
          box-shadow: 0 0 0 3px rgba(194, 65, 12, 0.2);
        }
        .villa-name { font-weight: 800; color: var(--text-primary, #0f172a); font-size: var(--fs-md); display: flex; align-items: center; gap: 0.5rem; }
      `}</style>

      <div className="glass-header">
        <h1 className="header-title">
          <span style={{ color: 'var(--accent-ink, #c2410c)' }}><Building size={20} aria-hidden="true" /></span> التعديل الجماعي للموازنات
        </h1>
        
        <div className="filters-row">
          <div className="filter-group">
            <label>نوع البند (Item Type)</label>
            <input 
              type="text"
              list="types-list"
              className="styled-input" 
              style={{ textAlign: 'right' }}
              value={logic.selectedType} 
              onChange={e => logic.setSelectedType(e.target.value)}
              placeholder="اختر أو اكتب نوع جديد..."
            />
            <datalist id="types-list">
              {logic.types.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>

          <div className="filter-group">
            <label>البند (Work Item)</label>
            <input 
              type="text"
              list="items-list"
              className="styled-input" 
              style={{ textAlign: 'right' }}
              value={logic.selectedWorkItem} 
              onChange={e => logic.setSelectedWorkItem(e.target.value)}
              disabled={!logic.selectedType}
              placeholder="اختر أو اكتب بند جديد..."
            />
            <datalist id="items-list">
              {logic.workItems.map(w => <option key={w} value={w} />)}
            </datalist>
          </div>

          <div className="filter-group">
            <label>نموذج الفيلا (Type)</label>
            <select 
              className="styled-select" 
              value={logic.selectedUnitType} 
              onChange={e => logic.setSelectedUnitType(e.target.value)}
            >
              <option value="">-- كل النماذج --</option>
              {logic.availableUnitTypes.map(ut => <option key={ut} value={ut}>{ut}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label>حالة التسجيل</label>
            <select 
              className="styled-select" 
              value={logic.registrationFilter} 
              onChange={e => logic.setRegistrationFilter(e.target.value)}
            >
              <option value="all">الكل</option>
              <option value="registered">مسجل فقط</option>
              <option value="unregistered">غير مسجل فقط</option>
            </select>
          </div>
        </div>

        <SecureAction module="boqbudget" action="edit">
          <button 
            className="btn-save" 
            onClick={logic.handleBulkSave}
            disabled={logic.isSaving || logic.budgets.length === 0}
          >
            {logic.isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات الجماعية'}
          </button>
        </SecureAction>
      </div>

      {logic.loading ? (
        <LoadingScreen message="جاري جلب الفلل والموازنات..." fullScreen={false} />
      ) : logic.budgets.length > 0 ? (
        <div className="table-container">
          <table className="bulk-table">
            <thead>
              <tr>
                <th>الفيلا / المشروع</th>
                <th style={{ width: '7.5rem' }}>الكمية</th>
                <th style={{ width: '7.5rem' }}>سعر الوحدة</th>
                <th style={{ width: '8.75rem' }}>موازنة الخامات</th>
                <th style={{ width: '8.75rem' }}>موازنة العمالة</th>
                <th style={{ width: '8.75rem' }}>موازنة المصروفات</th>
              </tr>
            </thead>
            <tbody>
              {logic.budgets.map(b => (
                <tr key={b.id}>
                  <td>
                    <div className="villa-name">
                      <span style={{ color: 'var(--accent-ink, #c2410c)' }}><House size={16} aria-hidden="true" /></span> 
                      {b.projects?.Property || 'بدون فيلا'}
                      {b.projects?.unit_type && <span style={{ fontSize: 'var(--fs-xs)', background: 'var(--accent-soft-bg, rgba(202, 138, 4, 0.1))', color: 'var(--accent-ink, #c2410c)', padding: '2px 0.5rem', borderRadius: '8px', fontWeight: 800 }}>{b.projects.unit_type}</span>}
                      {b._isNew && <span style={{ fontSize: 'var(--fs-xs)', background: 'var(--surface-sunken, #e2e8f0)', color: 'var(--text-secondary, #475569)', padding: '2px 0.375rem', borderRadius: '8px', fontWeight: 800 }}>غير مسجل</span>}
                    </div>
                  </td>
                  <td>
                    <input 
                      type="number" 
                      className="styled-input" 
                      value={b.contract_quantity || 0}
                      onChange={e => logic.handleFieldChange(b.id, 'contract_quantity', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td>
                    <input 
                      type="number" 
                      className="styled-input" 
                      value={b.unit_contract_price || 0}
                      onChange={e => logic.handleFieldChange(b.id, 'unit_contract_price', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td>
                    <input 
                      type="number" 
                      className="styled-input" 
                      value={b.estimated_material_cost || 0}
                      onChange={e => logic.handleFieldChange(b.id, 'estimated_material_cost', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td>
                    <input 
                      type="number" 
                      className="styled-input" 
                      value={b.estimated_labor_cost || 0}
                      onChange={e => logic.handleFieldChange(b.id, 'estimated_labor_cost', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td>
                    <input 
                      type="number" 
                      className="styled-input" 
                      value={b.estimated_expenses_cost || 0}
                      onChange={e => logic.handleFieldChange(b.id, 'estimated_expenses_cost', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : logic.selectedWorkItem ? (
        <div style={{ textAlign: 'center', padding: '3.125rem', background: 'var(--surface-card, #ffffff)', borderRadius: 'var(--phi-radius-card, 18px)', boxShadow: 'var(--shadow-ambient)' }}>
          <h3 style={{ color: 'var(--text-primary)' }}>لا توجد موازنات مسجلة لهذا البند في الفلل الحالية.</h3>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '3.125rem', background: 'var(--surface-card, #ffffff)', borderRadius: 'var(--phi-radius-card, 18px)', color: 'var(--text-secondary, #64748b)', boxShadow: 'var(--shadow-ambient)' }}>
          <h3>يرجى اختيار نوع البند ثم البند لعرض وتعديل موازنات الفلل</h3>
        </div>
      )}
    </div>
  );
}
