"use client";

import React, { useState } from 'react';
import BimViewer3D, { BimElementData } from '@/components/bim/BimViewer3D';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import { 
  Building2, 
  Layers, 
  Sparkles, 
  Box, 
  FileCheck2, 
  Cpu, 
  ShieldCheck, 
  CheckCircle2,
  HardHat,
  ArrowRight
} from 'lucide-react';

interface BimTabProps {
  logic: any;
}

export default function BimTab({ logic }: BimTabProps) {
  const project = logic.selectedProject;
  const [selectedBimElement, setSelectedBimElement] = useState<BimElementData | null>(null);

  if (!project) return null;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <style>{`
        .bim-card {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(15px);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.8);
          padding: 1.25rem;
          margin-bottom: 1.25rem;
        }
        .bim-kpi-card {
          background: rgba(255, 255, 255, 0.6);
          backdrop-filter: blur(10px);
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.7);
          padding: 1rem;
          text-align: center;
        }
      `}</style>

      {/* Top Engineering & Cost Summary Bar */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))',
          gap: '0.9375rem',
          marginBottom: '1.25rem'
        }}
      >
        <div className="bim-kpi-card">
          <div style={{ fontSize: 'var(--fs-xs, 12px)', color: '#64748b', fontWeight: 800 }}>نموذج الوحدة</div>
          <div style={{ fontSize: 'var(--fs-lg, 16px)', fontWeight: 900, color: THEME.primary }}>
            {project.unit_type || 'فيلا سكنية فاخرة'}
          </div>
        </div>

        <div className="bim-kpi-card">
          <div style={{ fontSize: 'var(--fs-xs, 12px)', color: '#64748b', fontWeight: 800 }}>مسطح الدور التقديري</div>
          <div style={{ fontSize: 'var(--fs-lg, 16px)', fontWeight: 900, color: '#0284c7' }}>
            {project.unit_area ? `${project.unit_area} م²` : '320 م²'}
          </div>
        </div>

        <div className="bim-kpi-card">
          <div style={{ fontSize: 'var(--fs-xs, 12px)', color: '#64748b', fontWeight: 800 }}>إجمالي الخرسانات المسلحة</div>
          <div style={{ fontSize: 'var(--fs-lg, 16px)', fontWeight: 900, color: '#c2410c' }}>
            ~135 م³
          </div>
        </div>

        <div className="bim-kpi-card">
          <div style={{ fontSize: 'var(--fs-xs, 12px)', color: '#64748b', fontWeight: 800 }}>حديد التسليح التقديري</div>
          <div style={{ fontSize: 'var(--fs-lg, 16px)', fontWeight: 900, color: '#16a34a' }}>
            ~15.2 طن
          </div>
        </div>

        <div className="bim-kpi-card">
          <div style={{ fontSize: 'var(--fs-xs, 12px)', color: '#64748b', fontWeight: 800 }}>الميزانية المعتمدة</div>
          <div style={{ fontSize: 'var(--fs-lg, 16px)', fontWeight: 900, color: THEME.goldAccent }}>
            {formatCurrency(project.estimated_budget || 0)}
          </div>
        </div>
      </div>

      {/* Main 3D BIM Viewer */}
      <div style={{ marginBottom: '1.5rem' }}>
        <BimViewer3D 
          projectTitle={`${project.Property} - استعراض النموذج الهندسي 3D BIM`}
          height="650px"
          onElementSelect={(elem) => setSelectedBimElement(elem)}
        />
      </div>

      {/* Bottom Insights & Architecture Features */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))',
          gap: '1.25rem'
        }}
      >
        {/* Feature 1: Free Autodesk Alternative */}
        <div className="bim-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Cpu size={18} color="#c2410c" />
            <h4 style={{ margin: 0, fontWeight: 900, color: THEME.coffeeDark, fontSize: 'var(--fs-sm, 14px)' }}>
              محرك BIM مفتوح المصدر (100% Free)
            </h4>
          </div>
          <p style={{ margin: 0, fontSize: 'var(--fs-xs, 12px)', color: '#64748b', lineHeight: 1.6 }}>
            يعمل مباشرة في المتصفح باستخدام مكتبة Three.js دون أي حاجة لاشتراكات Autodesk Forge أو BIM 360 المكلفة. يدعم استعراض العناصر الإنشائية، تفعيل الأشعة السينية للهيكل، ورفع ملفات GLB / GLTF / OBJ من جهازك فوراً.
          </p>
        </div>

        {/* Feature 2: Interactive Element Inspection */}
        <div className="bim-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Box size={18} color="#0284c7" />
            <h4 style={{ margin: 0, fontWeight: 900, color: THEME.coffeeDark, fontSize: 'var(--fs-sm, 14px)' }}>
              حصر الكميات ومطابقة بنود المقايسة
            </h4>
          </div>
          <p style={{ margin: 0, fontSize: 'var(--fs-xs, 12px)', color: '#64748b', lineHeight: 1.6 }}>
            انقر على أي عمود، سقف، أو قاعدة في النموذج ثلاثي الأبعاد لاستخراج الأبعاد الهندسية، الحجم التقديري بالمتر المكعب، وحساب تكلفة البند الإنشائي فورياً وربطه بجدول الكميات (BOQ).
          </p>
        </div>

        {/* Feature 3: Section Slicing */}
        <div className="bim-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Layers size={18} color="#16a34a" />
            <h4 style={{ margin: 0, fontWeight: 900, color: THEME.coffeeDark, fontSize: 'var(--fs-sm, 14px)' }}>
              القطاعات المستعرضة وفحص الأدوار
            </h4>
          </div>
          <p style={{ margin: 0, fontSize: 'var(--fs-xs, 12px)', color: '#64748b', lineHeight: 1.6 }}>
            استخدم أداة "القطاع الهندسي" لعمل مسح أفقي منسوبي بالارتفاع، والتحكم في إخفاء وإظهار الطبقات الهندسية (أساسات، أعمدة، كمرات، مباني، واجهات) بضغطة زر واحدة.
          </p>
        </div>
      </div>
    </div>
  );
}
