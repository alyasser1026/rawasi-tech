"use client";

import React, { useState } from 'react';
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import BimViewer3D, { BimElementData } from '@/components/bim/BimViewer3D';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
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
      <h4 style={{ color: 'var(--text-primary)', margin: '0 0 0.9375rem 0', fontSize: 'var(--fs-md)' }}>
        🏛️ استوديو BIM 3D
      </h4>
      <div style={styles.sideStat}>
        <span>إجمالي المشاريع</span>
        <strong>{projects.length} مشروع</strong>
      </div>
      <div style={styles.sideStat}>
        <span>المحرك الهندسي</span>
        <strong style={{ color: 'var(--status-info)' }}>Three.js WebGL</strong>
      </div>
      <div style={styles.sideStat}>
        <span>تكلفة التراخيص</span>
        <strong style={{ color: 'var(--status-positive)' }}>0.00 ريال (مجاني)</strong>
      </div>
      <div style={{ marginTop: '1.25rem', padding: '0.75rem', background: 'var(--surface-subcard)', borderRadius: '10px', border: 'none', boxShadow: 'var(--shadow-sunken)', fontSize: 'var(--fs-xs, 12px)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        💡 <strong style={{ color: 'var(--accent-ink)' }}>بديل Autodesk المجاني:</strong> يدعم استعراض الموديلات دون اشتراكات Forge، مع فحص التسليح، القطاعات الرأسية، وحصر كميات الخرسانات.
      </div>
    </div>
  );

  return (
    <div className="clean-page enterprise-page">
      <MasterPage 
        title="استعراض النماذج ثلاثية الأبعاد (3D BIM)" 
        subtitle="بيئة هندسية تفاعلية مفتوحة المصدر لعرض الهياكل الإنشائية والمعمارية وحصر الكميات"
      >
        <RawasiSidebarManager 
          summary={sidebarContent}
          watchDeps={[projects.length, selectedProjectId]}
        />

        <style>{`
          .bim-select-bar { display: flex; justify-content: space-between; align-items: center; padding: 0.9375rem 1.25rem; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 10px; }
          .bim-select-input { padding: 0.625rem 1rem; border-radius: 12px; border: none !important; box-shadow: var(--shadow-sunken); background: var(--surface-sunken); font-weight: 800; font-size: var(--fs-sm, 14px); color: var(--text-primary); cursor: pointer; min-width: min(260px, 100%); max-width: 100%; }
        `}</style>

        {/* Project Selector Bar */}
        <div className="ent-panel bim-select-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', maxWidth: '100%' }}>
            <label htmlFor="bim-project-select" style={{ fontSize: 'var(--fs-sm, 14px)', fontWeight: 900, color: 'var(--text-primary)' }}>
              اختر المشروع أو النموذج الهندسي:
            </label>
            <select 
              id="bim-project-select"
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
            <button className="ent-button ent-primary" onClick={() => router.push('/projects')}>
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(18rem, 100%), 1fr))',
            gap: '1.25rem'
          }}
        >
          <div className="ent-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>🏗️</span>
              <h4 style={{ margin: 0, fontWeight: 900, color: 'var(--text-primary)' }}>شجرة الطبقات الإنشائية (Layers)</h4>
            </div>
            <p style={styles.featureDescription}>
              عزل وتحكم كامل في عناصر المشروع: القواعد المنفصلة، رقاب الأعمدة، الميدات، أعمدة الأدوار، الأسقف المسلحة، السلالم الخرسانية، المباني، والواجهات المعمارية.
            </p>
          </div>

          <div className="ent-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>⚡</span>
              <h4 style={{ margin: 0, fontWeight: 900, color: 'var(--text-primary)' }}>أشعة سينية X-Ray للحديد</h4>
            </div>
            <p style={styles.featureDescription}>
              تشفيف الحوائط والتشطيبات الخارجية بضغطة زر واحدة لمعاينة الهيكل الخرساني الحامل من الداخل والتأكد من استمرارية الأعمدة والميدات دون تعارض.
            </p>
          </div>

          <div className="ent-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>📂</span>
              <h4 style={{ margin: 0, fontWeight: 900, color: 'var(--text-primary)' }}>دعم صيغ الـ 3D الخارجية</h4>
            </div>
            <p style={styles.featureDescription}>
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
    background: 'var(--surface-subcard)',
    padding: '0.75rem', 
    borderRadius: '12px', 
    marginBottom: '0.625rem', 
    fontSize: 'var(--fs-sm)', 
    color: 'var(--text-primary)',
    fontWeight: 700 
  },
  featureDescription: {
    margin: 0,
    fontSize: 'var(--fs-xs, 12px)',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
  }
};
