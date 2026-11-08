"use client";
import React, { useState, useEffect } from 'react';
import GlassContainer from '@/components/GlassContainer';
import { THEME } from '@/lib/theme';
import { supabase, getActiveCompanyId } from '@/lib/supabase';
import {
  AlertTriangle,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Database,
  Building2,
  Users,
  FolderGit2,
  FileSpreadsheet,
  Layers,
  ArrowRight
} from 'lucide-react';

export const FACTORY_RESET_CONFIRMATION_PHRASE = 'تأكيد إعادة الضبط';

interface FactoryResetResult {
  success: boolean;
  message: string;
  clearedCounts: Record<string, number>;
  preservedCounts: Record<string, number>;
  totalCleared: number;
  executedAt: string;
}

export default function FactoryResetManager() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [resetAllCompanies, setResetAllCompanies] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [report, setReport] = useState<FactoryResetResult | null>(null);

  // Live counts state
  const [activeCompany, setActiveCompany] = useState<{ id: string; name: string } | null>(null);
  const [liveCounts, setLiveCounts] = useState({
    operational: {
      journal_headers: 0,
      journal_lines: 0,
      expenses: 0,
      invoices: 0,
      payment_vouchers: 0,
      receipt_vouchers: 0,
      sub_claims: 0,
      labor_daily_logs: 0,
      material_receipts: 0,
      material_issues: 0,
      payroll_slips: 0,
      violations: 0,
    },
    master: {
      accounts: 0,
      partners: 0,
      projects: 0,
      boq_items: 0,
      inventory: 0,
      profiles: 0,
    }
  });

  const fetchLiveStats = async () => {
    setIsLoadingCounts(true);
    try {
      const companyId = getActiveCompanyId();
      
      // Fetch company name
      if (companyId) {
        const { data: comp } = await supabase.from('companies').select('id, name').eq('id', companyId).single();
        if (comp) setActiveCompany(comp);
      }

      // Fetch operational counts
      const opTables = [
        'journal_headers', 'journal_lines', 'expenses', 'invoices',
        'payment_vouchers', 'receipt_vouchers', 'sub_claims',
        'labor_daily_logs', 'material_receipts', 'material_issues',
        'payroll_slips', 'violations'
      ];
      const newOp: any = {};
      for (const t of opTables) {
        let q = supabase.from(t).select('*', { count: 'exact', head: true });
        if (companyId) q = q.eq('company_id', companyId);
        const { count } = await q;
        newOp[t] = count || 0;
      }

      // Fetch master counts
      const masterTables = ['accounts', 'partners', 'projects', 'boq_items', 'inventory', 'profiles'];
      const newMaster: any = {};
      for (const t of masterTables) {
        let q = supabase.from(t).select('*', { count: 'exact', head: true });
        if (companyId && !['profiles'].includes(t)) q = q.eq('company_id', companyId);
        const { count } = await q;
        newMaster[t] = count || 0;
      }

      setLiveCounts({ operational: newOp, master: newMaster });
    } catch (e) {
      console.error('Failed to load stats:', e);
    } finally {
      setIsLoadingCounts(false);
    }
  };

  useEffect(() => {
    fetchLiveStats();
  }, []);

  const totalTransactionalRecords = Object.values(liveCounts.operational).reduce((a, b) => a + b, 0);

  const handleExecuteReset = async () => {
    if (confirmationInput.trim() !== FACTORY_RESET_CONFIRMATION_PHRASE) {
      setErrorMsg(`يرجى كتابة "${FACTORY_RESET_CONFIRMATION_PHRASE}" بدقة.`);
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const companyId = getActiveCompanyId();

      const res = await fetch('/api/settings/factory-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...(companyId ? { 'x-company-id': companyId } : {}),
        },
        body: JSON.stringify({
          confirmationPhrase: confirmationInput.trim(),
          companyId: resetAllCompanies ? null : companyId,
          resetAllCompanies,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشلت عملية إعادة ضبط المصنع.');
      }

      setReport(data.report);
      setIsModalOpen(false);
      setConfirmationInput('');
      fetchLiveStats();
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء تنفيذ إعادة ضبط المصنع.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* بطاقة منطقة الخطر الرئيسية */}
      <GlassContainer>
        <div style={{
          border: '2px solid #ef4444',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(254, 242, 242, 0.7), rgba(255, 255, 255, 0.95))',
          padding: '1.75rem',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.1), 0 8px 10px -6px rgba(239, 68, 68, 0.1)'
        }}>
          
          {/* شريط خلفي جمالي */}
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            left: 0,
            height: '6px',
            background: 'linear-gradient(90deg, #ef4444, #dc2626, #b91c1c)'
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <div style={{
                background: '#fee2e2',
                color: '#dc2626',
                padding: '0.75rem',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.15)'
              }}>
                <AlertTriangle size={28} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  إعادة ضبط المصنع (Factory Reset)
                  <span style={{
                    fontSize: 'var(--fs-xs)',
                    background: '#dc2626',
                    color: 'white',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '20px',
                    fontWeight: 800
                  }}>منطقة العمليات الحساسة</span>
                </h3>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: 'var(--fs-sm)', color: '#7f1d1d', fontWeight: 700 }}>
                  تصفير وحذف كافة القيود المحاسبية والحركات التشغيلية، مع الحفاظ التام على شجرة الحسابات والشركاء والمشاريع وبنود المقايسات.
                </p>
              </div>
            </div>

            <button
              onClick={fetchLiveStats}
              disabled={isLoadingCounts}
              style={{
                background: 'white',
                border: '1px solid #fca5a5',
                color: '#b91c1c',
                padding: '0.5rem 0.875rem',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: 'var(--fs-xs)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                transition: '0.2s'
              }}
              title="تحديث الإحصائيات"
            >
              <RefreshCw size={14} className={isLoadingCounts ? 'spin' : ''} />
              تحديث الإحصائيات
            </button>
          </div>

          {/* شبكة الإحصائيات الحية */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem',
            margin: '1.25rem 0'
          }}>
            {/* بطاقة العمليات الحركية التي ستُحذف */}
            <div style={{
              background: '#fff',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              padding: '1rem',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px dashed #fee2e2', paddingBottom: '0.5rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#dc2626', fontWeight: 900, fontSize: 'var(--fs-sm)' }}>
                  <Trash2 size={16} /> الحركات والقيود الحالية (سيتم تصفيرها)
                </span>
                <span style={{
                  background: '#fef2f2',
                  color: '#b91c1c',
                  fontWeight: 900,
                  fontSize: 'var(--fs-sm)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '6px'
                }}>
                  {totalTransactionalRecords} سجل
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 700 }}>
                <div>• القيود المحاسبية: <strong style={{ color: '#0f172a' }}>{liveCounts.operational.journal_headers}</strong></div>
                <div>• أسطر القيود: <strong style={{ color: '#0f172a' }}>{liveCounts.operational.journal_lines}</strong></div>
                <div>• المصروفات العامة: <strong style={{ color: '#0f172a' }}>{liveCounts.operational.expenses}</strong></div>
                <div>• فواتير العملاء: <strong style={{ color: '#0f172a' }}>{liveCounts.operational.invoices}</strong></div>
                <div>• سندات الصرف: <strong style={{ color: '#0f172a' }}>{liveCounts.operational.payment_vouchers}</strong></div>
                <div>• سندات القبض: <strong style={{ color: '#0f172a' }}>{liveCounts.operational.receipt_vouchers}</strong></div>
                <div>• مستخلصات المقاولين: <strong style={{ color: '#0f172a' }}>{liveCounts.operational.sub_claims}</strong></div>
                <div>• يوميات العمالة: <strong style={{ color: '#0f172a' }}>{liveCounts.operational.labor_daily_logs}</strong></div>
              </div>
            </div>

            {/* بطاقة البيانات التعريفية المحمية */}
            <div style={{
              background: '#fff',
              border: '1px solid #bbf7d0',
              borderRadius: '12px',
              padding: '1rem',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px dashed #dcfce7', paddingBottom: '0.5rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#16a34a', fontWeight: 900, fontSize: 'var(--fs-sm)' }}>
                  <ShieldCheck size={16} /> البيانات التعريفية المحمية (لن تُمَس نهائياً)
                </span>
                <span style={{
                  background: '#f0fdf4',
                  color: '#15803d',
                  fontWeight: 900,
                  fontSize: 'var(--fs-xs)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '6px'
                }}>
                  محمية 100%
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: 'var(--fs-xs)', color: '#475569', fontWeight: 700 }}>
                <div>• شجرة الحسابات: <strong style={{ color: '#15803d' }}>{liveCounts.master.accounts} حساب</strong></div>
                <div>• دليل الشركاء والموظفين: <strong style={{ color: '#15803d' }}>{liveCounts.master.partners} شريك</strong></div>
                <div>• المشاريع المعتمدة: <strong style={{ color: '#15803d' }}>{liveCounts.master.projects} مشروع</strong></div>
                <div>• بنود المقايسات: <strong style={{ color: '#15803d' }}>{liveCounts.master.boq_items} بند</strong></div>
                <div>• كتالوج المواد: <strong style={{ color: '#15803d' }}>{liveCounts.master.inventory} مادة</strong></div>
                <div>• المستخدمين والنظام: <strong style={{ color: '#15803d' }}>{liveCounts.master.profiles} مستخدم</strong></div>
              </div>
            </div>
          </div>

          {/* سياق الشركة المستهدفة */}
          {activeCompany && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: 'var(--fs-xs)',
              color: '#991b1b',
              fontWeight: 800,
              background: '#fef2f2',
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              marginBottom: '1.25rem'
            }}>
              <Building2 size={16} />
              المنشأة المستهدفة حالياً: <span style={{ textDecoration: 'underline' }}>{activeCompany.name}</span>
            </div>
          )}

          {/* زر تشغيل نافذة الحذف */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                setErrorMsg(null);
                setConfirmationInput('');
                setIsModalOpen(true);
              }}
              style={{
                background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                color: 'white',
                border: 'none',
                padding: '0.875rem 1.75rem',
                borderRadius: '12px',
                fontWeight: 900,
                fontSize: 'var(--fs-md)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <Trash2 size={18} />
              إعادة ضبط المصنع (حذف كافة القيود والعمليات)
            </button>
          </div>

        </div>
      </GlassContainer>

      {/* تقرير ما بعد الإنجاز (إن وُجد) */}
      {report && (
        <GlassContainer>
          <div style={{
            background: '#f0fdf4',
            border: '2px solid #22c55e',
            borderRadius: '16px',
            padding: '1.5rem',
            animation: 'fadeIn 0.4s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ background: '#dcfce7', color: '#16a34a', padding: '0.5rem', borderRadius: '10px' }}>
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 900, color: '#15803d' }}>
                  اكتملت عملية إعادة ضبط المصنع بنجاح!
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--fs-sm)', color: '#166534', fontWeight: 700 }}>
                  {report.message}
                </p>
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1rem',
              border: '1px solid #bbf7d0',
              marginBottom: '1rem'
            }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: 'var(--fs-xs)', color: '#475569', fontWeight: 900 }}>
                تفاصيل السجلات المحذوفة والمصفّرة:
              </h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.5rem',
                fontSize: 'var(--fs-xs)',
                fontWeight: 700
              }}>
                {Object.entries(report.clearedCounts).map(([name, count]) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', background: '#f8fafc', padding: '0.35rem 0.6rem', borderRadius: '6px' }}>
                    <span style={{ color: '#475569' }}>{name}:</span>
                    <strong style={{ color: count > 0 ? '#dc2626' : '#94a3b8' }}>{count}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: '#15803d',
                  color: 'white',
                  border: 'none',
                  padding: '0.625rem 1.25rem',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: 'var(--fs-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem'
                }}
              >
                <RefreshCw size={14} /> تحديث واجهة النظام
              </button>
              <button
                onClick={() => setReport(null)}
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  padding: '0.625rem 1rem',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: 'var(--fs-sm)',
                  cursor: 'pointer'
                }}
              >
                إغلاق التقرير
              </button>
            </div>
          </div>
        </GlassContainer>
      )}

      {/* نافذة التأكيد المحمية (Confirmation Modal) */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            maxWidth: '560px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            border: '2px solid #ef4444'
          }}>
            
            {/* ترويسة المودال */}
            <div style={{
              background: '#fee2e2',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #fecaca',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <div style={{ background: '#dc2626', color: 'white', padding: '0.5rem', borderRadius: '10px' }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 900, color: '#991b1b' }}>
                  تأكيد إجراء إعادة ضبط المصنع
                </h3>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: 'var(--fs-xs)', color: '#b91c1c', fontWeight: 700 }}>
                  إجراء حساس ونهائي لا يمكن التراجع عنه
                </p>
              </div>
            </div>

            {/* محتوى المودال */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              
              <div style={{
                background: '#fff1f2',
                border: '1px solid #fda4af',
                borderRadius: '12px',
                padding: '0.875rem 1rem',
                fontSize: 'var(--fs-xs)',
                color: '#9f1239',
                lineHeight: 1.6,
                fontWeight: 700
              }}>
                ⚠️ <strong>تنبيه صارم:</strong> سيتم مسح كافة القيود اليومية المحاسبية، فواتير المبيعات، سندات الصرف والقبض، مستخلصات المقاولين، المصروفات، يوميات العمالة، وسجلات استلام وصرف الخامات.
                <br />
                ✅ <strong>البيانات الآمنة:</strong> شجرة الحسابات (الدليل المالي)، دليل الشركاء والعملاء والموردين، المشاريع، بنود المقايسات، وكتالوج المواد ستبقى محفوظة ومتاحة كما هي.
              </div>

              {/* حقل التحقق من العبارة */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#334155', marginBottom: '0.5rem' }}>
                  لتأكيد التنفيذ، يرجى كتابة العبارة التالية بدقة:
                  <span style={{
                    display: 'inline-block',
                    marginRight: '0.35rem',
                    background: '#f1f5f9',
                    color: '#dc2626',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    fontWeight: 900
                  }}>
                    {FACTORY_RESET_CONFIRMATION_PHRASE}
                  </span>
                </label>
                <input
                  type="text"
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  placeholder={`اكتب هنا: ${FACTORY_RESET_CONFIRMATION_PHRASE}`}
                  disabled={isProcessing}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    border: `2px solid ${confirmationInput.trim() === FACTORY_RESET_CONFIRMATION_PHRASE ? '#22c55e' : '#cbd5e1'}`,
                    outline: 'none',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 800,
                    boxSizing: 'border-box',
                    transition: '0.2s',
                    background: confirmationInput.trim() === FACTORY_RESET_CONFIRMATION_PHRASE ? '#f0fdf4' : 'white'
                  }}
                />
              </div>

              {/* خيار النطاق */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: 'var(--fs-xs)', color: '#475569', fontWeight: 800 }}>
                <input
                  type="checkbox"
                  checked={resetAllCompanies}
                  onChange={(e) => setResetAllCompanies(e.target.checked)}
                  disabled={isProcessing}
                  style={{ width: '1rem', height: '1rem' }}
                />
                تطبيق إعادة الضبط على جميع الشركات (وليس الشركة الحالية فقط)
              </label>

              {/* رسالة الخطأ */}
              {errorMsg && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  padding: '0.75rem',
                  fontSize: 'var(--fs-xs)',
                  color: '#b91c1c',
                  fontWeight: 800
                }}>
                  {errorMsg}
                </div>
              )}

              {/* أزرار الإجراء */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isProcessing}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '10px',
                    fontWeight: 800,
                    fontSize: 'var(--fs-sm)',
                    cursor: 'pointer'
                  }}
                >
                  إلغاء
                </button>

                <button
                  type="button"
                  onClick={handleExecuteReset}
                  disabled={isProcessing || confirmationInput.trim() !== FACTORY_RESET_CONFIRMATION_PHRASE}
                  style={{
                    background: confirmationInput.trim() === FACTORY_RESET_CONFIRMATION_PHRASE
                      ? 'linear-gradient(135deg, #dc2626, #991b1b)'
                      : '#cbd5e1',
                    color: 'white',
                    border: 'none',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '10px',
                    fontWeight: 900,
                    fontSize: 'var(--fs-sm)',
                    cursor: confirmationInput.trim() === FACTORY_RESET_CONFIRMATION_PHRASE && !isProcessing ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: confirmationInput.trim() === FACTORY_RESET_CONFIRMATION_PHRASE ? '0 4px 12px rgba(220, 38, 38, 0.3)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw size={16} className="spin" />
                      جاري التنفيذ والحذف الآمن...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      تأكيد الحذف وتصفير القيود الآن
                    </>
                  )}
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      <style>{`
        .spin { animation: spin 1.2s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}
