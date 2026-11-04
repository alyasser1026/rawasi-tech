"use client";
import React from 'react';
import { useBulkBudgetLogic } from './bulk_budget_logic';
import LoadingScreen from '@/components/LoadingScreen';
import SecureAction from '@/components/SecureAction';
import { Building, House } from 'lucide-react';

const THEME = {
  primary: '#0f172a',
  accent: '#c2410c',
  sand: '#f8fafc',
  border: '#e2e8f0',
};

export default function BulkBudgetPage() {
  const logic = useBulkBudgetLogic();

  return (
    <div className="clean-page" style={{ direction: 'rtl', padding: '20px' }}>
      <style>{`
        .clean-page { min-height: 100vh; background: linear-gradient(135deg, #f8fafc, #e2e8f0); font-family: 'Cairo', sans-serif; }
        .glass-header {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(15px);
          border: 1px solid rgba(255,255,255,0.8);
          border-radius: 14px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.05);
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        .header-title { font-size: var(--fs-2xl); font-weight: 800; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 10px; }
        
        .filters-row { display: flex; gap: 20px; flex: 1; align-items: flex-end; }
        .filter-group { display: flex; flex-direction: column; gap: 8px; flex: 1; }
        .filter-group label { font-size: var(--fs-md); font-weight: 700; color: #475569; }
        .styled-select {
          padding: 12px 15px;
          border-radius: 12px;
          border: 1px solid #cbd5e1;
          background: rgba(255,255,255,0.8);
          font-size: var(--fs-lg);
          color: #1e293b;
          outline: none;
          transition: all 0.3s;
          cursor: pointer;
        }
        .styled-select:focus { border-color: ${THEME.accent}; box-shadow: 0 0 0 3px rgba(202, 138, 4, 0.2); }

        .btn-save {
          background: linear-gradient(135deg, ${THEME.accent}, #a16207);
          color: white;
          border: none;
          padding: 12px 25px;
          border-radius: 12px;
          font-weight: 700;
          font-size: var(--fs-lg);
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 8px 15px rgba(202, 138, 4, 0.3);
        }
        .btn-save:hover { transform: translateY(-2px); box-shadow: 0 12px 20px rgba(202, 138, 4, 0.4); }
        .btn-save:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        .table-container {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(15px);
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.8);
          box-shadow: 0 10px 30px rgba(0,0,0,0.05);
          overflow: hidden;
          overflow-x: auto;
        }
        .bulk-table { width: 100%; border-collapse: collapse; }
        .bulk-table th {
          background: rgba(15, 23, 42, 0.03);
          padding: 15px;
          text-align: right;
          font-weight: 800;
          color: #334155;
          font-size: var(--fs-md);
          border-bottom: 2px solid ${THEME.border};
          white-space: nowrap;
        }
        .bulk-table td {
          padding: 12px 15px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }
        .bulk-table tr:hover { background: rgba(255,255,255,0.9); }
        
        .styled-input {
          width: 100%;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          font-size: var(--fs-md);
          transition: all 0.2s;
          text-align: center;
        }
        .styled-input:focus {
          border-color: ${THEME.accent};
          background: white;
          outline: none;
          box-shadow: 0 0 0 3px rgba(202, 138, 4, 0.15);
        }
        .villa-name { font-weight: 700; color: #0f172a; font-size: var(--fs-lg); display: flex; align-items: center; gap: 8px; }
      `}</style>

      <div className="glass-header">
        <h1 className="header-title">
          <span><Building size={16} aria-hidden="true" /></span> التعديل الجماعي للموازنات
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
                <th style={{ width: '120px' }}>الكمية</th>
                <th style={{ width: '120px' }}>سعر الوحدة</th>
                <th style={{ width: '140px' }}>موازنة الخامات</th>
                <th style={{ width: '140px' }}>موازنة العمالة</th>
                <th style={{ width: '140px' }}>موازنة المصروفات</th>
              </tr>
            </thead>
            <tbody>
              {logic.budgets.map(b => (
                <tr key={b.id}>
                  <td>
                    <div className="villa-name">
                      <span style={{color: THEME.accent}}><House size={16} aria-hidden="true" /></span> 
                      {b.projects?.Property || 'بدون فيلا'}
                      {b.projects?.unit_type && <span style={{ fontSize: 'var(--fs-sm)', background: 'rgba(202, 138, 4, 0.1)', color: THEME.accent, padding: '2px 8px', borderRadius: '10px' }}>{b.projects.unit_type}</span>}
                      {b._isNew && <span style={{ fontSize: 'var(--fs-xs)', background: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '10px' }}>غير مسجل</span>}
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
        <div style={{ textAlign: 'center', padding: '50px', background: 'rgba(255,255,255,0.5)', borderRadius: '14px' }}>
          <h3>لا توجد موازنات مسجلة لهذا البند في الفلل الحالية.</h3>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '50px', background: 'rgba(255,255,255,0.5)', borderRadius: '14px', color: '#64748b' }}>
          <h3>يرجى اختيار نوع البند ثم البند لعرض وتعديل موازنات الفلل</h3>
        </div>
      )}
    </div>
  );
}
