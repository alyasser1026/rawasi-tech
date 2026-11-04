import React, { useState, useMemo } from 'react';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import RawasiSmartTable from '@/components/rawasismarttable';
import { BrickWall } from 'lucide-react';

export default function MaterialsTab({ logic }: { logic: any }) {
  const materials = logic.projectDetails.materials || [];
  const boqItems = logic.projectDetails.boq || [];

  // 1️⃣ حالة التحكم في فلتر البند الإنشائي
  const [selectedBoqId, setSelectedBoqId] = useState('الكل');

  // 2️⃣ خريطة سريعة (Map) لربط الـ boq_id باسم البند الهندسي الصريح
  const boqMap = useMemo(() => {
    const map: Record<string, string> = {};
    boqItems.forEach((b: any) => {
      map[b.id] = b.work_item;
    });
    return map;
  }, [boqItems]);

  // 3️⃣ تصفية الخامات ديناميكياً بناءً على البند المختار
  const filteredMaterials = useMemo(() => {
    if (selectedBoqId === 'الكل') return materials;
    return materials.filter((m: any) => m.boq_id === selectedBoqId);
  }, [materials, selectedBoqId]);

  // 4️⃣ حساب السامري (الإحصائيات) ليتحدث تلقائياً مع الفلترة
  const summaryStats = useMemo(() => {
    const totalCost = filteredMaterials.reduce((sum: number, m: any) => sum + Number(m.total_price || 0), 0);
    const totalQuantitiesCount = filteredMaterials.length;
    return { totalCost, totalQuantitiesCount };
  }, [filteredMaterials]);

  // 5️⃣ استخراج البنود الإنشائية التي تم سحب خامات عليها بالفعل لملء الفلتر بدون تكرار
  const uniqueBoqOptions = useMemo(() => {
    const ids = Array.from(new Set(materials.map((m: any) => m.boq_id).filter(Boolean)));
    return ids.map(id => ({
      id: id as string,
      name: boqMap[id as string] || 'بند عام / غير محدد'
    }));
  }, [materials, boqMap]);

  // تجهيز أعمدة الجدول الذكي بعد إضافة عمود "البند الإنشائي"
  const materialsColumns = [
      { 
        header: 'تاريخ السحب', 
        render: (row: any) => row.date || row.created_at?.split('T')[0] || '---' 
      },
      { 
        header: 'البند الهندسي (WBS)', 
        render: (row: any) => (
          <span style={{ fontWeight: 800, color: THEME.coffeeMain, fontSize: 'var(--fs-sm)' }}>
            {boqMap[row.boq_id] || 'بند عام / غير مصنف'}
          </span>
        ) 
      },
      { 
        header: 'اسم الخامة', 
        render: (row: any) => <strong style={{ color: THEME.primary }}>{row.material_name || row.item_name}</strong> 
      },
      { 
        header: 'الكمية المسحوبة', 
        render: (row: any) => <span style={{ fontWeight: 900 }}>{row.quantity} {row.unit}</span> 
      },
      { 
        header: 'سعر الوحدة', 
        render: (row: any) => formatCurrency(row.unit_price) 
      },
      { 
        header: 'إجمالي التكلفة', 
        render: (row: any) => <span style={{ fontWeight: 900, color: THEME.danger, fontSize: 'var(--fs-md)' }}>{formatCurrency(row.total_price)}</span> 
      },
      { 
        header: 'المورد / ملاحظات', 
        render: (row: any) => <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 700 }}>{row.supplier_name || row.notes || '---'}</span> 
      },
  ];

  return (
    <div>
      {/* 📊 أولاً: كروت السامري الإحصائي المتغير مع الفلتر */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))', gap: '1.25rem', marginBottom: '1.5625rem' }}>
        <div style={{ backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', padding: '1.25rem', borderRadius: '14px', borderBottom: `4px solid ${THEME.goldAccent}`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <span style={{ display: 'block', fontSize: 'var(--fs-sm)', color: '#64748b', fontWeight: 800, marginBottom: '0.3125rem' }}>تكلفة الخامات (للبند المحدد حالياً)</span>
          <strong style={{ fontSize: 'var(--fs-2xl)', color: THEME.coffeeDark, fontWeight: 900 }}>{formatCurrency(summaryStats.totalCost)}</strong>
        </div>
        
        <div style={{ backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', padding: '1.25rem', borderRadius: '14px', borderBottom: `4px solid #475569`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <span style={{ display: 'block', fontSize: 'var(--fs-sm)', color: '#64748b', fontWeight: 800, marginBottom: '0.3125rem' }}>إجمالي عدد حركات وخطوط السحب</span>
          <strong style={{ fontSize: 'var(--fs-2xl)', color: '#1e293b', fontWeight: 900 }}>{summaryStats.totalQuantitiesCount} <span style={{fontSize:'var(--fs-md)', color:'#64748b'}}>حركة صرف</span></strong>
        </div>
      </div>

      {/* 📋 ثانياً: صندوق التحكم والجدول الذكي */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        
        {/* 🔍 شريط الفلترة العبكري بالبند */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1.25rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, color: THEME.coffeeDark, fontWeight: 900, fontSize: 'var(--fs-lg)' }}>بيان حركة وتفاصيل الخامات والمواد المنصرفة</h3>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#64748b', whiteSpace: 'nowrap' }}>فلترة حسب البند:</span>
            <select 
              value={selectedBoqId} 
              onChange={(e) => setSelectedBoqId(e.target.value)}
              style={{ 
                padding: '0.625rem 1.25rem', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', 
                fontWeight: 800, backgroundColor: 'white', color: '#1e293b', 
                boxShadow: '0 4px 10px rgba(0,0,0,0.02)', outline: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)'
              }}
            >
              <option value="الكل">كل بنود المقايسة</option>
              {uniqueBoqOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* عرض الجدول المفلتر أو رسالة خلو البيانات */}
        {filteredMaterials.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.125rem', color: '#94a3b8', fontWeight: 900 }}>
                <div style={{ fontSize: 'var(--fs-display)', marginBottom: '0.625rem' }}><BrickWall size={34} aria-hidden="true" /></div>
                لا توجد خامات مسحوبة مسجلة تحت هذا التصنيف حالياً.
            </div>
        ) : (
            <RawasiSmartTable data={filteredMaterials} columns={materialsColumns} />
        )}
      </div>
    </div>
  );
}