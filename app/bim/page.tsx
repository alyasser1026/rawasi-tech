"use client";

import React, { useState } from 'react';
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import BimViewer3D, { BimElementData } from '@/components/bim/BimViewer3D';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import LoadingScreen from '@/components/LoadingScreen';
import { 
  Building2, 
  Layers, 
  Box, 
  Cpu, 
  ShieldCheck, 
  Download, 
  Sparkles,
  ExternalLink,
  ChevronDown,
  Info
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function StandaloneBimPage() {
  const router = useRouter();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedElement, setSelectedElement] = useState<BimElementData | null>(null);

  // Fetch all active projects
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['bim_page_projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, Property, unit_type, unit_area, estimated_budget, status, current_stage')
        .order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    }
  });

  const currentProject = projects.find(p => p.id === selectedProjectId);

  const sidebarContent = (
    <div className="summary-glass-card">
      <h4 style={{ color: THEME.coffeeDark, margin: '0 0 0.9375rem 0', fontSize: 'var(--fs-md)' }}>
        🏛️ استوديو BIM 3D
      </h4>
      <div style={styles.sideStat}>
        <span>إجمالي المشاريع</span>
        <strong>{projects.length} مشروع</strong>
      </div>
      <div style={styles.sideStat}>
        <span>المحرك الهندسي</span>
        <strong style={{ color: '#0284c7' }}>Three.js WebGL</strong>
      </div>
      <div style={styles.sideStat}>
        <span>تكلفة التراخيص</span>
        <strong style={{ color: '#16a34a' }}>0.00 ريال (مجاني)</strong>
      </div>
      <div style={{ marginTop: '1.25rem', padding: '0.75rem', background: 'rgba(194, 65, 12, 0.1)', borderRadius: '10px', border: '1px solid rgba(194, 65, 12, 0.2)', fontSize: 'var(--fs-xs, 12px)', color: '#9a3412', lineHeight: 1.5 }}>
        💡 <strong>بديل Autodesk المجاني:</strong> يدعم استعراض الموديلات دون اشتراكات Forge، مع فحص التسليح، القطاعات الرأسية، وحصر كميات الخرسانات.
      </div>
    </div>
  );

  return (
    <div className="clean-page">
      <MasterPage 
        title="استعراض النماذج ثلاثية الأبعاد (3D BIM)" 
        subtitle="بيئة هندسية تفاعلية مفتوحة المصدر لعرض الهياكل الإنشائية والمعمارية وحصر الكميات"
      >
        <RawasiSidebarManager 
          summary={sidebarContent}
          watchDeps={[projects.length, selectedProjectId]}
        />

        <style>{`
          .summary-glass-card { background: rgba(255, 255, 255, 0.1); padding: 1.25rem; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.2); }
          .bim-select-bar { display: flex; justify-content: space-between; align-items: center; background: rgba(255, 255, 255, 0.6); backdrop-filter: blur(15px); padding: 0.9375rem 1.25rem; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.8); margin-bottom: 1.25rem; flex-wrap: wrap; gap: 10px; }
          .bim-select-input { padding: 0.625rem 1rem; border-radius: 12px; border: 1px solid #cbd5e1; background: #fff; font-weight: 800; font-size: var(--fs-sm, 14px); color: #1e293b; outline: none; cursor: pointer; min-width: 260px; }
        `}</style>

        {/* Project Selector Bar */}
        <div className="bim-select-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--fs-sm, 14px)', fontWeight: 900, color: THEME.coffeeDark }}>
              اختر المشروع أو النموذج الهندسي:
            </span>
            <select 
              className="bim-select-input"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              <option value="all">نموذج فيلا قياسي افتراضي (النموذج الهندسي A)</option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.Property} {proj.unit_type ? `(${proj.unit_type})` : ''} - {proj.status}
                </option>
              ))}
            </select>
          </div>

          {currentProject && (
            <button 
              onClick={() => router.push('/projects')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: THEME.coffeeDark,
                color: THEME.goldAccent,
                border: 'none',
                padding: '8px 14px',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: 'var(--fs-xs, 12px)',
                cursor: 'pointer'
              }}
            >
              <Building2 size={15} />
              غرفة عمليات {currentProject.Property}
            </button>
          )}
        </div>

        {/* 3D BIM Viewer Component */}
        {isLoading ? (
          <LoadingScreen message="جاري تهيئة الاستوديو الهندسي ثلاثي الأبعاد..." fullScreen={false} />
        ) : (
          <div style={{ marginBottom: '1.5rem' }}>
            <BimViewer3D 
              projectTitle={currentProject ? `${currentProject.Property} - ${currentProject.unit_type || 'نموذج فيلا'}` : "فيلا سكنية - الهيكل الإنشائي والمعماري 3D"}
              height="700px"
              onElementSelect={(elem) => setSelectedElement(elem)}
            />
          </div>
        )}

        {/* Technical Features & Capabilities Strip */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))',
            gap: '1.25rem'
          }}
        >
          <div style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(15px)', borderRadius: '16px', padding: '1.25rem', border: '1px solid rgba(255,255,255,0.8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>🏗️</span>
              <h4 style={{ margin: 0, fontWeight: 900, color: THEME.coffeeDark }}>شجرة الطبقات الإنشائية (Layers)</h4>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--fs-xs, 12px)', color: '#64748b', lineHeight: 1.6 }}>
              عزل وتحكم كامل في عناصر المشروع: القواعد المنفصلة، رقاب الأعمدة، الميدات، أعمدة الأدوار، الأسقف المسلحة، السلالم الخرسانية، المباني، والواجهات المعمارية.
            </p>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(15px)', borderRadius: '16px', padding: '1.25rem', border: '1px solid rgba(255,255,255,0.8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>⚡</span>
              <h4 style={{ margin: 0, fontWeight: 900, color: THEME.coffeeDark }}>أشعة سينية X-Ray للحديد</h4>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--fs-xs, 12px)', color: '#64748b', lineHeight: 1.6 }}>
              تشفيف الحوائط والتشطيبات الخارجية بضغطة زر واحدة لمعاينة الهيكل الخرساني الحامل من الداخل والتأكد من استمرارية الأعمدة والميدات دون تعارض.
            </p>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(15px)', borderRadius: '16px', padding: '1.25rem', border: '1px solid rgba(255,255,255,0.8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>📂</span>
              <h4 style={{ margin: 0, fontWeight: 900, color: THEME.coffeeDark }}>دعم صيغ الـ 3D الخارجية</h4>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--fs-xs, 12px)', color: '#64748b', lineHeight: 1.6 }}>
              إمكانية سحب وإفلات أو رفع أي ملف ثلاثي الأبعاد بصيغ GLB أو GLTF أو OBJ مباشرة من جهازك وعرضه وتدويره ومطابقته فورياً.
            </p>
          </div>
        </div>
      </MasterPage>
    </div>
  );
}

const styles = {
  sideStat: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    background: '#f3f5f8', 
    padding: '0.75rem', 
    borderRadius: '12px', 
    marginBottom: '0.625rem', 
    fontSize: 'var(--fs-sm)', 
    color: THEME.coffeeDark, 
    fontWeight: 700 
  }
};
