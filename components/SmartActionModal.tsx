"use client";
import { useState } from 'react';
import { Folder } from 'lucide-react';
import { notify } from '@/lib/notify';

interface SmartActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteData: { id: number; name: string } | null;
}

export default function SmartActionModal({ isOpen, onClose, siteData }: SmartActionModalProps) {
  const [activeTab, setActiveTab] = useState<'financial' | 'labor' | 'attachments'>('financial');
  
  // States لحساب التكلفة التلقائية للخامات
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);

  if (!isOpen || !siteData) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        
        {/* 🔝 الهيدر */}
        <div style={styles.header}>
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--fs-xl)', color: '#ffffff' }}>{siteData.name}</h2>
            <small style={{ color: '#94a3b8' }}>تسجيل حركة يومية مفصلة</small>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* 📑 شريط التبويبات (Tabs) */}
        <div style={styles.tabsContainer}>
          <button 
            style={{...styles.tab, borderBottom: activeTab === 'financial' ? '3px solid #f97316' : 'none', color: activeTab === 'financial' ? '#f97316' : '#94a3b8'}}
            onClick={() => setActiveTab('financial')}
          >
            الخامات والماليات
          </button>
          <button 
            style={{...styles.tab, borderBottom: activeTab === 'labor' ? '3px solid #10b981' : 'none', color: activeTab === 'labor' ? '#10b981' : '#94a3b8'}}
            onClick={() => setActiveTab('labor')}
          >
            العمالة والإنتاجية
          </button>
          <button 
            style={{...styles.tab, borderBottom: activeTab === 'attachments' ? '3px solid #38bdf8' : 'none', color: activeTab === 'attachments' ? '#38bdf8' : '#94a3b8'}}
            onClick={() => setActiveTab('attachments')}
          >
            المرفقات والملاحظات
          </button>
        </div>

        {/* 📝 محتوى التبويبات */}
        <div style={styles.body}>
          
          {/* التبويب الأول: الماليات */}
          {activeTab === 'financial' && (
            <div className="animate-fade-in">
              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>نوع الحركة</label>
                  <select style={styles.input}>
                    <option>صرف (شراء خامات)</option>
                    <option>تحصيل (دفعة من المالك)</option>
                    <option>سلفة موقع</option>
                  </select>
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>التاريخ</label>
                  <input type="date" style={styles.input} defaultValue={new Date().toISOString().split('T')[0]} />
                </div>
              </div>

              <div style={styles.sectionBox}>
                <h4 style={styles.secTitle}>تفاصيل البند (آلة حاسبة مدمجة)</h4>
                <div style={styles.row}>
                  <div style={styles.field}>
                    <label style={styles.label}>اسم الصنف / البيان</label>
                    <input type="text" placeholder="مثال: أسمنت بورتلاندي" style={styles.input} />
                  </div>
                </div>
                <div style={{...styles.row, marginTop: '0.9375rem'}}>
                  <div style={styles.field}>
                    <label style={styles.label}>الكمية</label>
                    <input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} style={styles.input} />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>سعر الوحدة</label>
                    <input type="number" value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} style={styles.input} />
                  </div>
                  <div style={styles.totalBox}>
                    <span style={{fontSize: 'var(--fs-xs)', color: '#94a3b8'}}>الإجمالي التلقائي</span>
                    <strong style={{fontSize: 'var(--fs-xl)', color: '#f97316'}}>{(qty * unitPrice).toLocaleString()} ج.م</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* التبويب الثاني: العمالة والإنتاجية */}
          {activeTab === 'labor' && (
            <div className="animate-fade-in">
              <div style={{...styles.sectionBox, boxShadow: 'inset 0 0 0 1px rgba(16, 185, 129, 0.2)'}}>
                <h4 style={{...styles.secTitle, color: '#10b981'}}>سحب بيانات التقرير اليومي</h4>
                <div style={styles.row}>
                  <div style={styles.field}>
                    <label style={styles.label}>بند الأعمال المنفذ</label>
                    <select style={styles.input}>
                      <option>محارة واجهات</option>
                      <option>تأسيس سباكة</option>
                      <option>صبة خرسانة</option>
                    </select>
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>حجم الإنجاز (متر/مقطوعية)</label>
                    <input type="number" placeholder="مثال: 150" style={styles.input} />
                  </div>
                </div>
                
                <div style={styles.divider}></div>
                
                <div style={styles.row}>
                  <div style={styles.autoField}>
                    <span style={styles.autoLabel}>إجمالي عمالة اليوم</span>
                    <p style={styles.autoText}><b>18 عامل / فني</b></p>
                  </div>
                  <div style={styles.autoField}>
                    <span style={styles.autoLabel}>تكلفة اليوميات التقديرية</span>
                    <p style={styles.autoText}><b style={{color: '#fb7185'}}>5,400 ج.م</b></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* التبويب الثالث: المرفقات */}
          {activeTab === 'attachments' && (
            <div className="animate-fade-in">
              <div style={styles.sectionBox}>
                <h4 style={styles.secTitle}>إرفاق مستندات (فواتير/صور موقع)</h4>
                <div style={styles.uploadArea}>
                  <div style={{fontSize: 'var(--fs-3xl)', marginBottom: '0.625rem', color: '#f97316'}}><Folder size={26} aria-hidden="true" /></div>
                  <p style={{margin: '0 0 0.625rem 0', fontSize: 'var(--fs-sm)', color: '#94a3b8'}}>اضغط هنا لرفع صورة الفاتورة أو المستخلص</p>
                  <input type="file" style={styles.fileInput} />
                </div>
              </div>
              
              <div style={styles.field}>
                <label style={styles.label}>ملاحظات مدير المشروع</label>
                <textarea placeholder="سجل أي عجز في الخامات أو ملاحظات استلام..." style={styles.textarea}></textarea>
              </div>
            </div>
          )}

        </div>

        {/* 💾 الفوتر وزر الحفظ */}
        <div style={styles.footer}>
          <button style={styles.saveBtn} onClick={() => {
            notify('تم تشفير البيانات وترحيلها بنجاح!');
            onClose();
          }}>
            حفظ واعتماد الحركة
          </button>
        </div>

      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(5, 7, 10, 0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(16px)', direction: 'rtl', padding: '0.9375rem' },
  card: { background: 'linear-gradient(180deg, #181c24 0%, #12141a 60%, #0c0e12 100%)', width: '100%', maxWidth: '46.875rem', maxHeight: '95vh', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 70px -15px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.08)', color: '#f3f4f6' },
  
  header: { padding: '1.25rem 1.5625rem', backgroundColor: 'transparent', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' },
  closeBtn: { background: 'none', border: 'none', color: '#94a3b8', fontSize: 'var(--fs-2xl)', cursor: 'pointer' },
  
  tabsContainer: { display: 'flex', backgroundColor: 'rgba(0, 0, 0, 0.3)', borderBottom: '1px solid rgba(255, 255, 255, 0.04)' },
  tab: { flex: 1, padding: '0.9375rem 0.625rem', background: 'none', border: 'none', fontWeight: 'bold', fontSize: 'var(--fs-md)', cursor: 'pointer', transition: '0.3s' },
  
  body: { padding: '1.5625rem', overflowY: 'auto', flex: 1 },
  
  sectionBox: { backgroundColor: 'rgba(255, 255, 255, 0.02)', border: 'none', padding: '1.25rem', borderRadius: '14px', marginBottom: '1.25rem', boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)' },
  secTitle: { margin: '0 0 0.9375rem 0', fontSize: 'var(--fs-lg)', color: '#f97316', fontWeight: 'bold' },
  
  row: { display: 'flex', gap: '0.9375rem', flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: '9.375rem' },
  label: { fontSize: 'var(--fs-sm)', color: '#94a3b8', fontWeight: 'bold' },
  input: { padding: '0.75rem 0.9375rem', borderRadius: '10px', border: 'none', outline: 'none', backgroundColor: '#0a0c10', color: '#f3f4f6', fontSize: 'var(--fs-md)', boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.03)' },
  
  totalBox: { flex: 1, minWidth: '9.375rem', backgroundColor: 'rgba(249, 115, 22, 0.08)', border: 'none', borderRadius: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0.625rem', boxShadow: 'inset 0 0 0 1px rgba(249, 115, 22, 0.25)' },
  
  divider: { height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.05)', margin: '1.25rem 0' },
  
  autoField: { flex: 1, padding: '0.9375rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '10px', border: 'none', textAlign: 'center', boxShadow: 'inset 0 0 0 1px rgba(16, 185, 129, 0.2)' },
  autoLabel: { display: 'inline-block', padding: '0.25rem 0.625rem', background: '#10b981', color: '#fff', borderRadius: '14px', fontSize: 'var(--fs-xs)', marginBottom: '0.625rem' },
  autoText: { margin: 0, fontSize: 'var(--fs-lg)', color: '#f3f4f6' },
  
  uploadArea: { border: '1px dashed rgba(255, 255, 255, 0.15)', borderRadius: '12px', padding: '1.875rem', textAlign: 'center', backgroundColor: 'rgba(255, 255, 255, 0.02)', position: 'relative', cursor: 'pointer' },
  fileInput: { position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' },
  textarea: { width: '100%', height: '6.25rem', padding: '0.9375rem', borderRadius: '10px', border: 'none', outline: 'none', resize: 'none', boxSizing: 'border-box', backgroundColor: '#0a0c10', color: '#f3f4f6', boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.03)' },
  
  footer: { padding: '1.25rem 1.5625rem', backgroundColor: 'transparent', borderTop: '1px solid rgba(255, 255, 255, 0.05)' },
  saveBtn: { width: '100%', padding: '1rem', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: 'var(--fs-lg)', transition: '0.3s', boxShadow: '0 8px 25px rgba(249, 115, 22, 0.35)' }
};
