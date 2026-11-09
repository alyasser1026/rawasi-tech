"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/notify';
import { Lock, Unlock, RefreshCw, ArrowRight } from 'lucide-react';
import { getAccountTypeByCode, generateNextAccountCode } from '@/lib/accountCodeGenerator';

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
  const [allAccounts, setAllAccounts] = useState<any[]>([]);
  const [parentAccounts, setParentAccounts] = useState<any[]>([]);
  const [isCodeAuto, setIsCodeAuto] = useState(true);
  
  const [formData, setFormData] = useState({ 
    name: '', 
    code: '', 
    parent_id: '', 
    is_transactional: 'true',
    account_type: 'أصول' 
  });

  useEffect(() => {
    const fetchAccounts = async () => {
      const { data } = await supabase.from('accounts').select('id, name, code, parent_id, is_transactional').order('code');
      if (data) {
        setAllAccounts(data);
        setParentAccounts(data);
        const existingCodes = data.map((a: any) => a.code);
        const initialCode = generateNextAccountCode({ parentCode: null, accountType: 'أصول', existingCodes });
        setFormData(prev => ({ ...prev, code: initialCode }));
      }
    };
    fetchAccounts();
  }, []);

  const handleParentChange = (parentId: string) => {
    const parent = allAccounts.find(a => a.id === parentId);
    const derivedType = parent ? getAccountTypeByCode(parent.code) : formData.account_type;
    const existingCodes = allAccounts.map(a => a.code);
    const nextCode = isCodeAuto 
      ? generateNextAccountCode({ parentCode: parent?.code, accountType: derivedType, existingCodes })
      : formData.code;

    setFormData(prev => ({
      ...prev,
      parent_id: parentId,
      account_type: derivedType,
      code: nextCode
    }));
  };

  const handleAccountTypeChange = (type: string) => {
    const existingCodes = allAccounts.map(a => a.code);
    const nextCode = (!formData.parent_id && isCodeAuto)
      ? generateNextAccountCode({ parentCode: null, accountType: type, existingCodes })
      : formData.code;

    setFormData(prev => ({
      ...prev,
      account_type: type,
      code: nextCode
    }));
  };

  const regenerateCode = () => {
    const parent = allAccounts.find(a => a.id === formData.parent_id);
    const existingCodes = allAccounts.map(a => a.code);
    const nextCode = generateNextAccountCode({
      parentCode: parent?.code,
      accountType: formData.account_type,
      existingCodes
    });
    setFormData(prev => ({ ...prev, code: nextCode }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      notify('الرجاء إدخال اسم وكود الحساب');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from('accounts').insert([{
        name: formData.name.trim(),
        code: formData.code.trim(),
        parent_id: formData.parent_id || null,
        is_transactional: formData.is_transactional === 'true',
        account_type: formData.account_type
      }]);
      
      if (error) throw error;
      
      notify('تم إضافة الحساب وتوليد الكود بنجاح!');
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
          width: 100%; max-width: 31.25rem; background: rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(20px); border: 1px solid ${THEME.accent}44;
          border-radius: 14px; padding: 2.5rem; box-shadow: 0 25px 50px rgba(0,0,0,0.5);
        }
        .header { text-align: left; margin-bottom: 1.875rem; }
        .header img { height: 3.75rem; margin-bottom: 0.625rem; }
        .input-group { position: relative; margin-bottom: 1.5625rem; }
        .standard-input {
          width: 100%; padding: 0.9375rem; background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px;
          color: white; outline: none; text-align: right; appearance: none;
        }
        .standard-input:focus { border-color: ${THEME.accent}; }
        .standard-input option { background: ${THEME.primary}; color: white; }
        .floating-label {
          position: absolute; right: 0.9375rem; top: 50%; transform: translateY(-50%);
          color: ${THEME.slate}; font-weight: 700; pointer-events: none; transition: 0.2s ease-all;
        }
        .forced-float, .standard-input:focus ~ .floating-label, .standard-input:not(:placeholder-shown) ~ .floating-label {
          top: -0.75rem !important; right: 0.75rem !important; font-size: var(--fs-sm) !important;
          color: ${THEME.accent} !important; background: #151c2c !important;
          padding: 0 0.625rem !important; border-radius: 4px !important; transform: translateY(0) !important;
        }
        .btn-submit {
          width: 100%; padding: 0.9375rem; background: linear-gradient(135deg, ${THEME.accent}, ${THEME.accentLight});
          color: ${THEME.primary}; border: none; border-radius: 12px; font-weight: 900; cursor: pointer;
        }
      `}</style>
      <div className="glass-card">
        <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <img src="/company-logo.svg" alt="Logo" />
            <h1 style={{color:'white', fontSize:'var(--fs-2xl)'}}>إضافة حساب جديد</h1>
            <p style={{ color: THEME.slate, fontSize: 'var(--fs-xs)', marginTop: '0.25rem' }}>توليد تلقائي ذكي لرقم الحساب حسب شجرة الحسابات</p>
          </div>
          <button 
            type="button" 
            onClick={() => router.push('/accounts')}
            style={{ 
              background: 'rgba(255, 255, 255, 0.1)', 
              border: '1px solid rgba(255, 255, 255, 0.2)', 
              color: 'white', 
              padding: '0.5rem 0.75rem', 
              borderRadius: '8px', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: 'var(--fs-xs)'
            }}
          >
            <ArrowRight size={14} />
            <span>رجوع للشجرة</span>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          
          <div className="input-group">
            <input type="text" className="standard-input" placeholder=" " required
              value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            <label className="floating-label">اسم الحساب *</label>
          </div>

          <div className="input-group">
            <select className="standard-input" value={formData.parent_id} onChange={(e) => handleParentChange(e.target.value)}>
              <option value="">بدون حساب أب (حساب رئيسي جذري)</option>
              {parentAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} - {acc.name} {!acc.is_transactional ? '📁 [تجميعي]' : '📄 [فرعي]'}
                </option>
              ))}
            </select>
            <label className="floating-label forced-float">الحساب الرئيسي (الأب)</label>
          </div>

          <div className="input-group">
            <select className="standard-input" value={formData.account_type} onChange={(e) => handleAccountTypeChange(e.target.value)}>
              <option value="أصول">1 - أصول (Assets)</option>
              <option value="التزامات">2 - التزامات (Liabilities)</option>
              <option value="حقوق ملكية">3 - حقوق ملكية (Equity)</option>
              <option value="إيرادات">4 - إيرادات (Revenues)</option>
              <option value="مصروفات">5 - مصروفات (Expenses)</option>
            </select>
            <label className="floating-label forced-float">طبيعة الحساب</label>
          </div>

          <div className="input-group">
            <select className="standard-input" value={formData.is_transactional} onChange={(e) => setFormData({...formData, is_transactional: e.target.value})}>
              <option value="true">حساب فرعي (يقبل قيود وحركات مالية)</option>
              <option value="false">حساب رئيسي (تجميعي للمستويات الأدنى)</option>
            </select>
            <label className="floating-label forced-float">نوع الحساب</label>
          </div>

          {/* كود الحساب الذكي */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: THEME.slate, fontWeight: 700 }}>رقم الحساب (الكود) *</span>
              <span style={{
                fontSize: '0.7rem',
                padding: '0.15rem 0.4rem',
                borderRadius: '999px',
                fontWeight: 700,
                background: isCodeAuto ? 'rgba(16, 185, 129, 0.2)' : 'rgba(234, 88, 12, 0.2)',
                color: isCodeAuto ? '#34d399' : '#fb923c'
              }}>
                {isCodeAuto ? '⚡ تلقائي ذكي' : '✍️ يدوي'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input 
                type="text" 
                className="standard-input" 
                style={{ 
                  flex: 1, 
                  fontFamily: 'monospace', 
                  fontSize: 'var(--fs-md)', 
                  fontWeight: 900, 
                  letterSpacing: '0.08em',
                  background: isCodeAuto ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.08)' 
                }}
                required
                value={formData.code} 
                onChange={(e) => {
                  setIsCodeAuto(false);
                  setFormData({ ...formData, code: e.target.value });
                }} 
              />
              <button
                type="button"
                onClick={() => setIsCodeAuto(!isCodeAuto)}
                title={isCodeAuto ? "قفل التوليد للتحرير اليدوي" : "تفعيل التوليد التلقائي"}
                style={{
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: isCodeAuto ? 'rgba(194, 65, 12, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                  color: isCodeAuto ? '#fb923c' : THEME.slate,
                  cursor: 'pointer'
                }}
              >
                {isCodeAuto ? <Lock size={16} /> : <Unlock size={16} />}
              </button>
              <button
                type="button"
                onClick={regenerateCode}
                title="إعادة التوليد"
                style={{
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          <button type="submit" className="btn-submit" disabled={isLoading}>{isLoading ? 'جاري الحفظ...' : 'حفظ الحساب'}</button>
        </form>
      </div>
    </div>
  );
}
