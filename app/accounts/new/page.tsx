"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/notify';

const THEME = {
  primary: '#0f172a',
  accent: '#c2410c',
  accentLight: '#fb923c',
  white: '#ffffff',
  slate: '#94a3b8'
};

export default function AddAccountPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [parentAccounts, setParentAccounts] = useState<any[]>([]);
  
  // 👈 ضفنا account_type هنا
  const [formData, setFormData] = useState({ 
    name: '', 
    code: '', 
    parent_id: '', 
    is_transactional: 'true',
    account_type: 'أصول' 
  });

  useEffect(() => {
    const fetchParents = async () => {
      const { data } = await supabase.from('accounts').select('id, name, code').eq('is_transactional', false);
      if (data) setParentAccounts(data);
    };
    fetchParents();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.from('accounts').insert([{
        name: formData.name,
        code: formData.code,
        parent_id: formData.parent_id || null,
        is_transactional: formData.is_transactional === 'true',
        account_type: formData.account_type // 👈 تم إرسال القيمة لقاعدة البيانات
      }]);
      
      if (error) throw error;
      
      notify('تم إضافة الحساب بنجاح!');
      router.push('/accounts');
    } catch (err: any) {
      notify('خطأ: ' + err.message);
    } finally { setIsLoading(false); }
  };

  return (
    <div className="page-wrapper phi-light-form">
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Cairo', sans-serif; }
        .page-wrapper {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          direction: rtl; background-image: linear-gradient(rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.95)), url('/ryc_login.jpeg');
          background-size: cover; background-position: center;
        }
        .glass-card {
          width: 100%; max-width: 500px; background: rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(20px); border: 1px solid ${THEME.accent}44;
          border-radius: 14px; padding: 40px; box-shadow: 0 25px 50px rgba(0,0,0,0.5);
        }
        .header { text-align: left; margin-bottom: 30px; }
        .header img { height: 60px; margin-bottom: 10px; }
        .input-group { position: relative; margin-bottom: 25px; }
        .standard-input {
          width: 100%; padding: 15px; background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px;
          color: white; outline: none; text-align: right; appearance: none;
        }
        .standard-input:focus { border-color: ${THEME.accent}; }
        .standard-input option { background: ${THEME.primary}; color: white; }
        .floating-label {
          position: absolute; right: 15px; top: 50%; transform: translateY(-50%);
          color: ${THEME.slate}; font-weight: 700; pointer-events: none; transition: 0.2s ease-all;
        }
        .forced-float, .standard-input:focus ~ .floating-label, .standard-input:not(:placeholder-shown) ~ .floating-label {
          top: -12px !important; right: 12px !important; font-size: var(--fs-sm) !important;
          color: ${THEME.accent} !important; background: #151c2c !important;
          padding: 0 10px !important; border-radius: 4px !important; transform: translateY(0) !important;
        }
        .btn-submit {
          width: 100%; padding: 15px; background: linear-gradient(135deg, ${THEME.accent}, ${THEME.accentLight});
          color: ${THEME.primary}; border: none; border-radius: 12px; font-weight: 900; cursor: pointer;
        }
      `}</style>
      <div className="glass-card">
        <div className="header">
          <img src="/company-logo.svg" alt="Logo" />
          <h1 style={{color:'white', fontSize:'var(--fs-2xl)'}}>إضافة حساب جديد</h1>
        </div>
        <form onSubmit={handleSubmit}>
          
          <div className="input-group">
            <input type="text" className="standard-input" placeholder=" " required
              value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            <label className="floating-label">اسم الحساب</label>
          </div>

          <div className="input-group">
            <input type="text" className="standard-input" placeholder=" " required
              value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} />
            <label className="floating-label">رقم الحساب (الكود)</label>
          </div>

          {/* 👈 حقل طبيعة الحساب الجديد */}
          <div className="input-group">
            <select className="standard-input" value={formData.account_type} onChange={(e) => setFormData({...formData, account_type: e.target.value})}>
              <option value="أصول">أصول (Assets)</option>
              <option value="التزامات">التزامات (Liabilities)</option>
              <option value="حقوق ملكية">حقوق ملكية (Equity)</option>
              <option value="إيرادات">إيرادات (Revenues)</option>
              <option value="مصروفات">مصروفات (Expenses)</option>
            </select>
            <label className="floating-label forced-float">طبيعة الحساب</label>
          </div>

          <div className="input-group">
            <select className="standard-input" value={formData.parent_id} onChange={(e) => setFormData({...formData, parent_id: e.target.value})}>
              <option value="">بدون حساب أب (رئيسي)</option>
              {parentAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
            </select>
            <label className="floating-label forced-float">الحساب الرئيسي (الأب)</label>
          </div>

          <div className="input-group">
            <select className="standard-input" value={formData.is_transactional} onChange={(e) => setFormData({...formData, is_transactional: e.target.value})}>
              <option value="true">حساب فرعي (حركة)</option>
              <option value="false">حساب رئيسي (تجميعي)</option>
            </select>
            <label className="floating-label forced-float">نوع الحساب</label>
          </div>

          <button type="submit" className="btn-submit" disabled={isLoading}>{isLoading ? 'جاري الحفظ...' : 'حفظ الحساب'}</button>
        </form>
      </div>
    </div>
  );
}
