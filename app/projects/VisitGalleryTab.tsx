"use client";

import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/notify';
import TelegramAttachmentField from '@/components/TelegramAttachmentField';
import { resolveAttachmentForViewing } from '@/lib/attachments/telegramAttachments';

interface VisitPhoto {
  id: string;
  photo_url: string;
  caption: string | null;
  visit_date: string;
  client_visible: boolean;
  reviewed_at: string | null;
}

/** صورة مصغّرة تُحمَّل بجلسة المستخدم (المرفقات محمية). */
function Thumb({ url }: { url: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    let obj: string | null = null;
    resolveAttachmentForViewing(url)
      .then(v => {
        if (!alive) { if (v.revokeAfterUse) URL.revokeObjectURL(v.objectUrl); return; }
        if (v.revokeAfterUse) obj = v.objectUrl;
        setSrc(v.objectUrl);
      })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; if (obj) URL.revokeObjectURL(obj); };
  }, [url]);
  if (failed) return <div style={{ aspectRatio: '4/3', display: 'grid', placeItems: 'center', background: '#f1f5f9', color: '#64748b', fontSize: '.8rem' }}>تعذّر تحميل الصورة</div>;
  if (!src) return <div style={{ aspectRatio: '4/3', background: '#f1f5f9' }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />;
}

/**
 * معرض صور الزيارات العادية — يراجعه المسؤول ويعتمد منه ما يظهر للعميل.
 * منفصل تمامًا عن صور "المشاكل ومعالجتها" في تاب الزيارات الميدانية، والتي لا تظهر للعميل إطلاقًا.
 */
export default function VisitGalleryTab({ logic }: { logic: any }) {
  const queryClient = useQueryClient();
  const projectId: string | undefined = logic?.selectedProject?.id;
  const [newUrl, setNewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [busy, setBusy] = useState(false);

  const key = ['project_visit_photos', projectId];
  const { data: photos = [], isLoading, error } = useQuery({
    queryKey: key,
    enabled: Boolean(projectId),
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_visit_photos')
        .select('id, photo_url, caption, visit_date, client_visible, reviewed_at')
        .eq('project_id', projectId)
        .order('visit_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as VisitPhoto[];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  const addPhoto = async () => {
    if (!projectId || !newUrl) return;
    setBusy(true);
    const { error } = await supabase.from('project_visit_photos').insert([
      { project_id: projectId, photo_url: newUrl, caption: caption.trim() || null, visit_date: date },
    ]);
    setBusy(false);
    if (error) { notify('تعذّرت إضافة الصورة: ' + error.message, 'error'); return; }
    notify('أُضيفت الصورة للمعرض (غير معتمدة للعميل حتى تراجعها)', 'success');
    setNewUrl(null); setCaption('');
    refresh();
  };

  const setApproved = async (ids: string[], approved: boolean) => {
    if (!ids.length) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('project_visit_photos')
      .update({ client_visible: approved, reviewed_by: u.user?.id ?? null, reviewed_at: new Date().toISOString() })
      .in('id', ids);
    if (error) { notify('تعذّر التحديث: ' + error.message, 'error'); return; }
    refresh();
  };

  const remove = async (id: string) => {
    if (!window.confirm('حذف هذه الصورة من المعرض؟')) return;
    const { error } = await supabase.from('project_visit_photos').delete().eq('id', id);
    if (error) { notify('تعذّر الحذف: ' + error.message, 'error'); return; }
    refresh();
  };

  if (!projectId) return <div style={{ padding: '2rem', color: '#64748b' }}>اختر مشروعًا أولًا.</div>;

  const pending = photos.filter(p => !p.client_visible);
  const approved = photos.filter(p => p.client_visible);
  const shown = filter === 'pending' ? pending : filter === 'approved' ? approved : photos;
  const missingTable = error && ['42P01', 'PGRST205'].includes((error as any).code);

  const btn: React.CSSProperties = { padding: '.5rem .9rem', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: '.85rem' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '1.25rem' }}>
        <h3 style={{ margin: 0, fontWeight: 900 }}>معرض صور الزيارات (يراه العميل بعد الاعتماد)</h3>
        <p style={{ margin: '.35rem 0 1rem', color: '#64748b', fontSize: '.85rem', lineHeight: 1.7 }}>
          ارفع هنا صور الزيارات العادية فقط. صور المشاكل ومعالجتها تبقى في تاب الزيارات الميدانية ولا تظهر للعميل أبدًا.
          أي صورة جديدة تبدأ <b>غير معتمدة</b>، ولا تظهر في بوابة العميل إلا بعد أن تعتمدها.
        </p>
        <TelegramAttachmentField module="site_visits" value={newUrl} onChange={setNewUrl} label="صورة زيارة عادية" caption={`معرض زيارات: ${logic?.selectedProject?.Property || ''}`} allowStamp={false} />
        {newUrl && (
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginTop: '.8rem', alignItems: 'center' }}>
            <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="وصف قصير (اختياري) مثل: صب أعمدة الدور الأول" style={{ flex: '1 1 260px', padding: '.6rem .8rem', borderRadius: 10, border: '1px solid #cbd5e1', fontFamily: 'inherit' }} />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ padding: '.55rem .8rem', borderRadius: 10, border: '1px solid #cbd5e1', fontFamily: 'inherit' }} />
            <button type="button" disabled={busy} onClick={addPhoto} style={{ ...btn, background: '#ea580c', borderColor: '#ea580c', color: '#fff' }}>إضافة للمعرض</button>
          </div>
        )}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
          {([['all', `الكل (${photos.length})`], ['pending', `بانتظار المراجعة (${pending.length})`], ['approved', `معتمدة للعميل (${approved.length})`]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setFilter(k)} style={{ ...btn, background: filter === k ? '#0f172a' : '#fff', color: filter === k ? '#fff' : '#334155' }}>{l}</button>
          ))}
          <span style={{ flex: 1 }} />
          {pending.length > 0 && <button type="button" style={{ ...btn, color: '#15803d', borderColor: '#86efac' }} onClick={() => setApproved(pending.map(p => p.id), true)}>اعتماد كل غير المعتمد</button>}
        </div>

        {missingTable && <p style={{ color: '#b45309', fontWeight: 700 }}>جدول المعرض غير مفعّل بعد في قاعدة البيانات (نفّذ ملف client-portal.sql).</p>}
        {isLoading && <p style={{ color: '#64748b' }}>جاري التحميل…</p>}
        {!isLoading && !missingTable && shown.length === 0 && <p style={{ color: '#64748b' }}>لا توجد صور في هذا القسم.</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '1rem' }}>
          {shown.map(p => (
            <div key={p.id} style={{ border: `2px solid ${p.client_visible ? '#86efac' : '#e2e8f0'}`, borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
              <Thumb url={p.photo_url} />
              <div style={{ padding: '.7rem .8rem' }}>
                <div style={{ fontWeight: 800, fontSize: '.88rem', minHeight: '1.3rem' }}>{p.caption || 'بدون وصف'}</div>
                <div style={{ color: '#64748b', fontSize: '.78rem', marginBottom: '.6rem' }}>{p.visit_date}</div>
                <div style={{ display: 'flex', gap: '.4rem' }}>
                  <button type="button" style={{ ...btn, flex: 1, background: p.client_visible ? '#dcfce7' : '#fff', color: p.client_visible ? '#15803d' : '#334155' }} onClick={() => setApproved([p.id], !p.client_visible)}>
                    {p.client_visible ? '✓ معتمدة للعميل' : 'اعتماد للعميل'}
                  </button>
                  <button type="button" style={{ ...btn, color: '#b91c1c' }} onClick={() => remove(p.id)} aria-label="حذف">حذف</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
