"use client";
import React from 'react';
import { createPortal } from 'react-dom';
import { THEME } from '@/lib/theme';

export default function AddProjectModal({ logic, mounted }: { logic: any, mounted: boolean }) {
  if (!mounted || !logic.isAddProjectModalOpen || typeof document === 'undefined') return null;

  // 🎯 تحديد إذا كانت العملية تعديل أم إضافة
  const isEditing = !!logic.currentProjectRecord.id;

  return createPortal(
    <div 
      style={{ position: 'fixed', inset: 0, zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, rgba(40, 24, 10, 0.4) 0%, rgba(15, 7, 0, 0.9) 100%)', backdropFilter: 'blur(20px)', direction: 'rtl' }} 
      onClick={() => logic.setIsAddProjectModalOpen(false)}
    >
      <style>{`
        .glass-input-field {
            width: 100%; padding: 14px; border-radius: 12px;
            background: rgba(248, 250, 252, 0.8);
            border: 1px solid #e2e8f0;
            outline: none; transition: 0.2s; font-weight: 700; color: #1e293b;
        }
        .glass-input-field:focus { background: #fff; border-color: ${THEME.goldAccent}; box-shadow: 0 0 0 4px rgba(194,65,12, 0.15); }
        .modal-label { font-size: 13px; font-weight: 900; color: ${THEME.coffeeDark}; display: block; margin-bottom: 8px; }
        
        .btn-glass-save { background: linear-gradient(135deg, ${THEME.goldAccent}, ${THEME.coffeeMain}); color: white; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 900; font-size: 14px; cursor: pointer; transition: 0.3s; box-shadow: 0 10px 25px rgba(194,65,12, 0.4); }
        .btn-glass-save:hover:not(:disabled) { transform: translateY(-3px); filter: brightness(1.1); }
        
        .btn-glass-cancel { background: #f1f5f9; color: #64748b; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 900; font-size: 14px; cursor: pointer; transition: 0.3s; }
        .btn-glass-cancel:hover { background: #e2e8f0; transform: translateY(-2px); }
      `}</style>

      <div 
        className="cinematic-scroll" 
        onClick={(e) => e.stopPropagation()} 
        style={{ background: 'rgba(255, 255, 255, 0.95)', padding: '40px', borderRadius: '35px', width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 40px 100px rgba(0,0,0,0.5)', position: 'relative' }}
      >
        <h2 style={{ fontWeight: 900, color: THEME.coffeeDark, marginBottom: '25px', fontSize: '26px', borderBottom: `2px dashed ${THEME.goldAccent}50`, paddingBottom: '15px' }}>
            {isEditing ? '✏️ تعديل بيانات المشروع' : '➕ إضافة مشروع / عقار جديد'}
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
           
           <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
             <div>
                <label className="modal-label"># كود المشروع</label>
                <input type="text" className="glass-input-field" placeholder="مثال: PRJ-001" value={logic.currentProjectRecord.project_code || ''} onChange={e => logic.setCurrentProjectRecord({...logic.currentProjectRecord, project_code: e.target.value})} />
             </div>
             <div>
                <label className="modal-label">🏢 اسم العقار / المشروع (إلزامي)</label>
                <input type="text" className="glass-input-field" placeholder="اسم العقار أو المشروع" value={logic.currentProjectRecord.Property || ''} onChange={e => logic.setCurrentProjectRecord({...logic.currentProjectRecord, Property: e.target.value})} />
             </div>
           </div>

           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', background: '#fffbeb', padding: '20px', borderRadius: '20px', border: '1px solid #fef3c7' }}>
             <div>
                <label className="modal-label" style={{ color: '#b45309' }}>🏠 نوع النموذج (Type)</label>
                <input type="text" className="glass-input-field" placeholder="مثال: Type A, فيلا مزدوجة..." value={logic.currentProjectRecord.unit_type || ''} onChange={e => logic.setCurrentProjectRecord({...logic.currentProjectRecord, unit_type: e.target.value})} />
             </div>
             <div>
                <label className="modal-label" style={{ color: '#b45309' }}>📏 مساحة العقار (م٢)</label>
                <input type="number" className="glass-input-field" placeholder="مثال: 250" value={logic.currentProjectRecord.unit_area || ''} onChange={e => logic.setCurrentProjectRecord({...logic.currentProjectRecord, unit_area: e.target.value})} />
             </div>
           </div>

           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
             <div>
                <label className="modal-label">👤 العميل المالك</label>
                <select className="glass-input-field" value={logic.currentProjectRecord.client_id || ''} onChange={e => logic.setCurrentProjectRecord({...logic.currentProjectRecord, client_id: e.target.value})}>
                    <option value="">-- اختر العميل --</option>
                    {logic.clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
             </div>
             <div>
                <label className="modal-label">👷 مدير المشروع</label>
                <input type="text" className="glass-input-field" placeholder="اسم مدير المشروع" value={logic.currentProjectRecord.project_manager || ''} onChange={e => logic.setCurrentProjectRecord({...logic.currentProjectRecord, project_manager: e.target.value})} />
             </div>
           </div>

           {/* 🚀 الحقول الجديدة: المهندس المسئول */}
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', background: '#f8fafc', padding: '15px', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
             <div>
                <label className="modal-label" style={{ color: '#0f172a' }}>👨‍🔧 المهندس المسئول (بالموقع)</label>
                <input type="text" className="glass-input-field" placeholder="اسم المهندس المشرف" value={logic.currentProjectRecord.engineer_in_charge || ''} onChange={e => logic.setCurrentProjectRecord({...logic.currentProjectRecord, engineer_in_charge: e.target.value})} />
             </div>
             <div>
                <label className="modal-label" style={{ color: '#0f172a' }}>📱 جوال المهندس</label>
                <input type="text" className="glass-input-field" placeholder="مثال: 05xxxxxxxx" value={logic.currentProjectRecord.engineer_phone || ''} onChange={e => logic.setCurrentProjectRecord({...logic.currentProjectRecord, engineer_phone: e.target.value})} />
             </div>
           </div>

           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
             <div>
                <label className="modal-label">📅 تاريخ البدء</label>
                <input type="date" className="glass-input-field" value={logic.currentProjectRecord.start_date || ''} onChange={e => logic.setCurrentProjectRecord({...logic.currentProjectRecord, start_date: e.target.value})} />
             </div>
             <div>
                <label className="modal-label">🏁 تاريخ الانتهاء المتوقع</label>
                <input type="date" className="glass-input-field" value={logic.currentProjectRecord.end_date || ''} onChange={e => logic.setCurrentProjectRecord({...logic.currentProjectRecord, end_date: e.target.value})} />
             </div>
           </div>

           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', background: '#f8fafc', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
             <div>
                <label className="modal-label" style={{ color: '#0369a1' }}>💰 قيمة التعاقد</label>
                <input type="number" className="glass-input-field" placeholder="0.00" value={logic.currentProjectRecord.contract_value || ''} onChange={e => logic.setCurrentProjectRecord({...logic.currentProjectRecord, contract_value: e.target.value})} />
             </div>
             <div>
                <label className="modal-label" style={{ color: '#0369a1' }}>📊 الميزانية التقديرية</label>
                <input type="number" className="glass-input-field" placeholder="0.00" value={logic.currentProjectRecord.estimated_budget || ''} onChange={e => logic.setCurrentProjectRecord({...logic.currentProjectRecord, estimated_budget: e.target.value})} />
             </div>
             <div>
                <label className="modal-label" style={{ color: '#0369a1' }}>💵 الدفعة المقدمة</label>
                <input type="number" className="glass-input-field" placeholder="0.00" value={logic.currentProjectRecord.down_payment || ''} onChange={e => logic.setCurrentProjectRecord({...logic.currentProjectRecord, down_payment: e.target.value})} />
             </div>
           </div>

           <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '20px' }}>
             <div>
                <label className="modal-label">📍 عنوان الموقع</label>
                <input type="text" className="glass-input-field" placeholder="عنوان العقار بالتفصيل" value={logic.currentProjectRecord.location_address || ''} onChange={e => logic.setCurrentProjectRecord({...logic.currentProjectRecord, location_address: e.target.value})} />
             </div>
             <div>
                <label className="modal-label">📈 الحالة</label>
                <select className="glass-input-field" value={logic.currentProjectRecord.status || 'قيد الدراسة'} onChange={e => logic.setCurrentProjectRecord({...logic.currentProjectRecord, status: e.target.value})}>
                    <option value="قيد الدراسة">قيد الدراسة</option>
                    <option value="جاري تجهيز الموقع">جاري تجهيز الموقع</option>
                    <option value="قيد التنفيذ">قيد التنفيذ</option>
                    <option value="متوقف مؤقتا">متوقف مؤقتا</option>
                </select>
             </div>
             <div>
                <label className="modal-label">⚙️ المرحلة الحالية</label>
                <input type="text" className="glass-input-field" placeholder="مثال: الحفر" value={logic.currentProjectRecord.current_stage || ''} onChange={e => logic.setCurrentProjectRecord({...logic.currentProjectRecord, current_stage: e.target.value})} />
             </div>
           </div>

           <div>
              <label className="modal-label">📝 ملاحظات عامة</label>
              <textarea className="glass-input-field" rows={3} placeholder="أي تفاصيل أخرى..." value={logic.currentProjectRecord.notes || ''} onChange={e => logic.setCurrentProjectRecord({...logic.currentProjectRecord, notes: e.target.value})}></textarea>
           </div>

           {/* 💾 أزرار الحفظ والإلغاء */}
           <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
             <button onClick={logic.handleSaveProject} disabled={logic.isSavingProject} className="btn-glass-save" style={{ flex: 2 }}>
               {logic.isSavingProject ? '⏳ جاري الحفظ...' : (isEditing ? '💾 حفظ التعديلات' : '✅ اعتماد المشروع')}
             </button>
             <button onClick={() => {
                 logic.setIsAddProjectModalOpen(false);
                 logic.setCurrentProjectRecord({ project_code: '', Property: '', unit_type: '', unit_area: '', client_id: '', contract_value: '', estimated_budget: '', down_payment: '', start_date: '', end_date: '', location_address: '', project_manager: '', engineer_in_charge: '', engineer_phone: '', status: 'قيد الدراسة', current_stage: 'تجهيز الموقع', notes: '' });
             }} className="btn-glass-cancel" style={{ flex: 1 }}>
               إلغاء
             </button>
           </div>
        </div>
      </div>
    </div>,
    document.body
  );
}