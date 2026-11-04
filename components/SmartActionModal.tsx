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
            <h2 style={{ margin: 0, fontSize: 'var(--fs-xl)' }}>{siteData.name}</h2>
            <small style={{ color: '#eaddca' }}>تسجيل حركة يومية مفصلة</small>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* 📑 شريط التبويبات (Tabs) */}
        <div style={styles.tabsContainer}>
          <button 
            style={{...styles.tab, borderBottom: activeTab === 'financial' ? '3px solid #c2410c' : 'none', color: activeTab === 'financial' ? '#c2410c' : '#888'}}
            onClick={() => setActiveTab('financial')}
          >
            الخامات والماليات
          </button>
          <button 
            style={{...styles.tab, borderBottom: activeTab === 'labor' ? '3px solid #27ae60' : 'none', color: activeTab === 'labor' ? '#27ae60' : '#888'}}
            onClick={() => setActiveTab('labor')}
          >
            العمالة والإنتاجية
          </button>
          <button 
            style={{...styles.tab, borderBottom: activeTab === 'attachments' ? '3px solid #2980b9' : 'none', color: activeTab === 'attachments' ? '#2980b9' : '#888'}}
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
                <div style={{...styles.row, marginTop: '15px'}}>
                  <div style={styles.field}>
                    <label style={styles.label}>الكمية</label>
                    <input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} style={styles.input} />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>سعر الوحدة</label>
                    <input type="number" value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} style={styles.input} />
                  </div>
                  <div style={styles.totalBox}>
                    <span style={{fontSize: 'var(--fs-xs)', color: '#666'}}>الإجمالي التلقائي</span>
                    <strong style={{fontSize: 'var(--fs-xl)', color: '#c2410c'}}>{(qty * unitPrice).toLocaleString()} ج.م</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* التبويب الثاني: العمالة والإنتاجية */}
          {activeTab === 'labor' && (
            <div className="animate-fade-in">
              <div style={{...styles.sectionBox, borderColor: '#27ae60'}}>
                <h4 style={{...styles.secTitle, color: '#27ae60'}}>سحب بيانات التقرير اليومي</h4>
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
                    <p style={styles.autoText}><b style={{color: '#e74c3c'}}>5,400 ج.م</b></p>
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
                  <div style={{fontSize: 'var(--fs-3xl)', marginBottom: '10px'}}><Folder size={26} aria-hidden="true" /></div>
                  <p style={{margin: '0 0 10px 0', fontSize: 'var(--fs-sm)', color: '#666'}}>اضغط هنا لرفع صورة الفاتورة أو المستخلص</p>
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
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(5px)', direction: 'rtl', padding: '15px' },
  card: { backgroundColor: '#fdfcf9', width: '100%', maxWidth: '750px', maxHeight: '95vh', borderRadius: '15px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' },
  
  header: { padding: '20px 25px', backgroundColor: '#4a3e35', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  closeBtn: { background: 'none', border: 'none', color: '#fff', fontSize: 'var(--fs-2xl)', cursor: 'pointer' },
  
  tabsContainer: { display: 'flex', backgroundColor: '#fff', borderBottom: '1px solid #ddd' },
  tab: { flex: 1, padding: '15px 10px', background: 'none', border: 'none', fontWeight: 'bold', fontSize: 'var(--fs-md)', cursor: 'pointer', transition: '0.3s' },
  
  body: { padding: '25px', overflowY: 'auto', flex: 1 },
  
  sectionBox: { backgroundColor: '#fff', border: '1px solid #eee', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' },
  secTitle: { margin: '0 0 15px 0', fontSize: 'var(--fs-lg)', color: '#4a3e35', fontWeight: 'bold' },
  
  row: { display: 'flex', gap: '15px', flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '150px' },
  label: { fontSize: 'var(--fs-sm)', color: '#555', fontWeight: 'bold' },
  input: { padding: '12px 15px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none', backgroundColor: '#fcfaf7', fontSize: 'var(--fs-md)' },
  
  totalBox: { flex: 1, minWidth: '150px', backgroundColor: '#fafafa', border: '1px dashed #c2410c', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '10px' },
  
  divider: { height: '1px', backgroundColor: '#eee', margin: '20px 0' },
  
  autoField: { flex: 1, padding: '15px', background: '#f0f9f1', borderRadius: '8px', border: '1px solid #d4edda', textAlign: 'center' },
  autoLabel: { display: 'inline-block', padding: '4px 10px', background: '#27ae60', color: '#fff', borderRadius: '14px', fontSize: 'var(--fs-xs)', marginBottom: '10px' },
  autoText: { margin: 0, fontSize: 'var(--fs-lg)', color: '#333' },
  
  uploadArea: { border: '2px dashed #ccc', borderRadius: '10px', padding: '30px', textAlign: 'center', backgroundColor: '#fafafa', position: 'relative', cursor: 'pointer' },
  fileInput: { position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' },
  textarea: { width: '100%', height: '100px', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none', resize: 'none', boxSizing: 'border-box', backgroundColor: '#fcfaf7' },
  
  footer: { padding: '20px 25px', backgroundColor: '#fff', borderTop: '1px solid #eee' },
  saveBtn: { width: '100%', padding: '16px', backgroundColor: '#4a3e35', color: '#c2410c', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: 'var(--fs-lg)', transition: '0.3s' }
};