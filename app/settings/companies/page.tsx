"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, Building2, CircleCheck, Info, Landmark, Pencil, Plus, RefreshCw, Save, ShieldCheck, Trash2, Users } from 'lucide-react';
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import KpiStrip from '@/components/KpiStrip';
import PhiDialog from '@/components/PhiDialog';
import LoadingScreen from '@/components/LoadingScreen';
import { useConfirm } from '@/components/ConfirmContext';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/notify';
import { useCompany } from '@/lib/CompanyContext';
import { usePermissions } from '@/lib/PermissionsContext';
import type { Company, CompanyInput, CompanyRole } from '@/types/company';

type Member = { user_id: string; full_name: string | null; email: string | null; role: CompanyRole; is_active: boolean; is_default: boolean; system_role: string };
type Candidate = { user_id: string; full_name: string | null; email: string | null; system_role: string };
const personName = (p: { full_name: string | null; email: string | null }) => p.full_name || p.email || 'مستخدم بدون اسم';

const EMPTY_FORM: CompanyInput = {
  code: '', name: '', legal_name: '', tax_number: '', cr_number: '',
  currency: 'SAR', country: 'SA', email: '', phone: '', address: '',
  brand_color: '#F97316', fiscal_year_start: '',
};

const CURRENCIES = [
  ['SAR', 'ريال سعودي'], ['AED', 'درهم إماراتي'], ['EGP', 'جنيه مصري'],
  ['KWD', 'دينار كويتي'], ['USD', 'دولار أمريكي'], ['EUR', 'يورو'],
] as const;
const COUNTRIES = [
  ['SA', 'السعودية'], ['AE', 'الإمارات'], ['EG', 'مصر'], ['KW', 'الكويت'],
] as const;

const toForm = (c: Company): CompanyInput => ({
  code: c.code ?? '', name: c.name ?? '', legal_name: c.legal_name ?? '',
  tax_number: c.tax_number ?? '', cr_number: c.cr_number ?? '',
  currency: c.currency ?? 'SAR', country: c.country ?? 'SA',
  email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '',
  brand_color: c.brand_color ?? '#F97316', fiscal_year_start: c.fiscal_year_start ?? '',
});

/** Same rules as the checks in the database, so most mistakes are caught before saving. */
function validate(form: CompanyInput): string | null {
  const code = form.code.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{1,19}$/.test(code)) return 'كود الشركة من 2 إلى 20 حرفًا إنجليزيًا أو رقمًا، بدون مسافات (مثال: PHI).';
  const name = form.name.trim();
  if (name.length < 2 || name.length > 200) return 'اكتب اسم الشركة (حرفين على الأقل).';
  const vat = form.tax_number.trim();
  if (form.country === 'SA' && vat && !/^3\d{13}3$/.test(vat)) return 'الرقم الضريبي السعودي 15 رقمًا يبدأ وينتهي بالرقم 3.';
  const cr = form.cr_number.trim();
  if (form.country === 'SA' && cr && !/^\d{10}$/.test(cr)) return 'رقم السجل التجاري 10 أرقام.';
  if (!/^#[0-9a-fA-F]{6}$/.test(form.brand_color)) return 'لون الهوية غير صالح.';
  const email = form.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'البريد الإلكتروني غير صالح.';
  return null;
}

/** Turns database errors into messages the user can act on. */
function describeError(err: unknown): string {
  const e = err as { code?: string; message?: string } | null;
  const msg = e?.message ?? '';
  if (e?.code === '42501') return 'ليست لديك صلاحية لتنفيذ هذا الإجراء على الشركة.';
  if (msg.includes('companies_code_key')) return 'هذا الكود مستخدم لشركة أخرى.';
  if (msg.includes('companies_tax_number_key')) return 'هذا الرقم الضريبي مسجل لشركة أخرى.';
  if (msg.includes('companies_sa_vat_format')) return 'الرقم الضريبي السعودي 15 رقمًا يبدأ وينتهي بالرقم 3.';
  if (msg.includes('companies_sa_cr_format')) return 'رقم السجل التجاري 10 أرقام.';
  if (msg.includes('companies_code_format')) return 'كود الشركة من 2 إلى 20 حرفًا إنجليزيًا أو رقمًا، بدون مسافات.';
  if (msg.includes('default company cannot be deactivated')) return 'لا يمكن إيقاف الشركة الافتراضية؛ اجعل شركة أخرى افتراضية أولًا.';
  if (msg.includes('already has a chart of accounts')) return 'هذه الشركة لها دليل حسابات بالفعل.';
  if (msg.includes('keep at least one admin')) return 'لازم يفضل في الشركة مدير واحد على الأقل.';
  if (msg.includes('User not found or inactive')) return 'المستخدم غير موجود أو موقوف.';
  if (e?.code === 'PGRST202' || msg.includes('Could not find the function')) return 'ميزة تعدد الشركات لم تُفعَّل في قاعدة البيانات بعد.';
  return 'تعذر حفظ بيانات الشركة. حاول مرة أخرى.';
}

export default function CompaniesSettingsPage() {
  const router = useRouter();
  const { companies: memberships, activeCompany, activeCompanyId, switchCompany, refreshCompanies } = useCompany();
  const { role: systemRole, loading: permissionsLoading } = usePermissions();
  const isPlatformAdmin = systemRole === 'super_admin' || systemRole === 'admin';

  const [rows, setRows] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyInput>(EMPTY_FORM);
  const [makeDefault, setMakeDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copyAccounts, setCopyAccounts] = useState(true);
  const { showConfirm } = useConfirm();

  // Members dialog
  const [membersOf, setMembersOf] = useState<Company | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [newMember, setNewMember] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<CompanyRole>('member');
  const [memberBusy, setMemberBusy] = useState(false);

  // RLS returns every company to system administrators and only their own companies to everyone else.
  const loadCompanies = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('companies')
      .select('id, code, name, legal_name, tax_number, cr_number, currency, country, email, phone, address, logo_url, brand_color, fiscal_year_start, is_active, is_default, created_at, updated_at')
      .order('is_default', { ascending: false })
      .order('name');
    if (error) {
      console.error('Could not load companies:', error);
      setLoadError(error.code === '42P01' || error.code === 'PGRST205' ? 'ميزة تعدد الشركات لم تُفعَّل في قاعدة البيانات بعد.' : 'تعذر تحميل الشركات.');
      setRows([]);
    } else {
      setLoadError(null);
      setRows((data ?? []) as Company[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadCompanies(); }, [loadCompanies]);

  const roleById = useMemo(() => new Map(memberships.map(c => [c.id, c.role])), [memberships]);
  const canEdit = useCallback((id: string) => isPlatformAdmin || roleById.get(id) === 'admin', [isPlatformAdmin, roleById]);

  const openCreate = useCallback(() => {
    if (!isPlatformAdmin) { notify.warning('إضافة الشركات متاحة لمدير النظام فقط.'); return; }
    setEditing(null);
    setForm(EMPTY_FORM);
    setMakeDefault(false);
    setIsActive(true);
    setCopyAccounts(true);
    setDialogOpen(true);
  }, [isPlatformAdmin]);

  const openEdit = (company: Company) => {
    setEditing(company);
    setForm(toForm(company));
    setMakeDefault(company.is_default);
    setIsActive(company.is_active);
    setDialogOpen(true);
  };

  // The company switcher links here with ?action=new.
  useEffect(() => {
    if (permissionsLoading) return;
    if (new URLSearchParams(window.location.search).get('action') !== 'new') return;
    router.replace('/settings/companies');
    openCreate();
  }, [permissionsLoading, openCreate, router]);

  const save = async () => {
    const problem = validate(form);
    if (problem) { notify.warning(problem); return; }
    const payload: Record<string, unknown> = { ...form, code: form.code.trim().toUpperCase() };
    setSaving(true);
    try {
      if (editing) {
        if (isPlatformAdmin) {
          if (isActive !== editing.is_active) payload.is_active = isActive;
          if (makeDefault && !editing.is_default) payload.is_default = true;
        }
        const { error } = await supabase.rpc('update_company', { p_company_id: editing.id, p_changes: payload });
        if (error) throw error;
        notify.success(`تم حفظ بيانات «${form.name.trim()}»`);
      } else {
        if (copyAccounts && activeCompanyId) payload.copy_accounts_from = activeCompanyId;
        const { data: newId, error } = await supabase.rpc('create_company', { p_company: payload });
        if (error) throw error;
        if (makeDefault && newId) {
          const { error: defaultError } = await supabase.rpc('update_company', { p_company_id: newId, p_changes: { is_default: true } });
          if (defaultError) notify.warning('أُضيفت الشركة، لكن تعذر جعلها الافتراضية.');
        }
        notify.success(`تمت إضافة «${form.name.trim()}» وأصبحت مديرًا لها`);
      }
      setDialogOpen(false);
      await Promise.all([loadCompanies(), refreshCompanies()]);
    } catch (err) {
      console.error('Saving company failed:', err);
      notify.error(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  // Reloads the app on the chosen company.
  const handleSwitch = (company: Company) => { void switchCompany(company.id); };

  const loadMembers = useCallback(async (company: Company) => {
    setMembersLoading(true);
    const [m, c] = await Promise.all([
      supabase.rpc('list_company_members', { p_company_id: company.id }),
      supabase.rpc('list_company_member_candidates', { p_company_id: company.id }),
    ]);
    if (m.error || c.error) {
      console.error('Could not load members:', m.error || c.error);
      notify.error('تعذر تحميل أعضاء الشركة.');
    } else {
      setMembers((m.data ?? []) as Member[]);
      setCandidates((c.data ?? []) as Candidate[]);
    }
    setMembersLoading(false);
  }, []);

  const openMembers = (company: Company) => {
    setMembersOf(company);
    setMembers([]);
    setCandidates([]);
    setNewMember('');
    setNewMemberRole('member');
    void loadMembers(company);
  };

  const runMemberAction = async (action: () => PromiseLike<{ error: unknown }>, success: string) => {
    if (!membersOf) return;
    setMemberBusy(true);
    try {
      const { error } = await action();
      if (error) throw error;
      notify.success(success);
      await Promise.all([loadMembers(membersOf), refreshCompanies()]);
    } catch (err) {
      console.error('Member update failed:', err);
      notify.error(describeError(err));
    } finally {
      setMemberBusy(false);
    }
  };

  const addMember = () => {
    if (!membersOf || !newMember) { notify.warning('اختر المستخدم الذي تريد إضافته.'); return; }
    const person = candidates.find(c => c.user_id === newMember);
    void runMemberAction(
      () => supabase.rpc('add_company_member', { p_company_id: membersOf.id, p_user_id: newMember, p_role: newMemberRole }),
      `تمت إضافة ${person ? personName(person) : 'المستخدم'} إلى «${membersOf.name}»`,
    ).then(() => setNewMember(''));
  };

  const changeRole = (member: Member, role: CompanyRole) => {
    if (!membersOf || role === member.role) return;
    void runMemberAction(
      () => supabase.rpc('set_company_member_role', { p_company_id: membersOf.id, p_user_id: member.user_id, p_role: role }),
      `تم تغيير صلاحية ${personName(member)}`,
    );
  };

  const removeMember = (member: Member) => {
    if (!membersOf) return;
    const company = membersOf;
    showConfirm({
      title: 'إزالة عضو من الشركة',
      message: `${personName(member)} لن يرى بيانات «${company.name}» بعد الآن. يمكن إضافته مرة أخرى لاحقًا.`,
      type: 'warning',
      confirmText: 'إزالة',
      onConfirm: () => void runMemberAction(
        () => supabase.rpc('remove_company_member', { p_company_id: company.id, p_user_id: member.user_id }),
        `تمت إزالة ${personName(member)} من «${company.name}»`,
      ),
    });
  };

  const field = (key: keyof CompanyInput) => ({
    value: form[key],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [key]: e.target.value })),
  });

  const activeCount = rows.filter(c => c.is_active).length;
  const summary = useMemo(() => <KpiStrip items={[
    { label: 'الشركات', value: rows.length.toLocaleString('en-US'), tone: 'brand', icon: <Building2 />, hint: `${activeCount.toLocaleString('en-US')} نشطة` },
    { label: 'الشركة الحالية', value: activeCompany?.code ?? '—', tone: 'info', icon: <CircleCheck />, hint: activeCompany?.name ?? 'لا توجد شركة مفتوحة' },
    { label: 'صلاحيتك', value: isPlatformAdmin ? 'مدير النظام' : roleById.get(activeCompanyId ?? '') === 'admin' ? 'مدير الشركة' : 'عضو', tone: 'neutral', icon: <ShieldCheck />, hint: isPlatformAdmin ? 'تدير كل الشركات' : 'حسب عضويتك في كل شركة' },
    { label: 'فصل البيانات', value: 'مفعّل', tone: 'success', icon: <Landmark />, hint: 'كل شركة لها حساباتها وقيودها' },
  ]} />, [rows.length, activeCount, activeCompany, isPlatformAdmin, roleById, activeCompanyId]);

  const actions = useMemo(() => <>
    {isPlatformAdmin && <button type="button" className="ent-button ent-primary" onClick={openCreate}><Plus size={16} aria-hidden="true" />إضافة شركة</button>}
    <button type="button" className="ent-button" onClick={() => { void loadCompanies(); void refreshCompanies(); }} disabled={loading}><RefreshCw size={16} aria-hidden="true" />{loading ? 'جاري التحديث…' : 'تحديث'}</button>
  </>, [isPlatformAdmin, openCreate, loadCompanies, refreshCompanies, loading]);

  return (
    <MasterPage title="الشركات" subtitle="الشركات المسجلة في النظام، وبياناتها الرسمية، والتبديل بينها" icon={<Building2 aria-hidden="true" />}>
      <RawasiSidebarManager summary={summary} actions={actions} watchDeps={[rows, activeCompanyId, isPlatformAdmin, loading, memberships]} />

      {loading ? <LoadingScreen message="جاري تحميل الشركات..." fullScreen={false} /> : (
        <section className="ent-panel" aria-labelledby="companies-title">
          <div className="ent-panel-heading">
            <div className="ent-panel-title"><h2 id="companies-title">الشركات المسجلة</h2><small>{rows.length.toLocaleString('en-US')} شركة</small></div>
          </div>
          <p className="ent-field-note" style={{ margin: '0 1rem 0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <Info size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: '0.15rem' }} />
            كل شركة لها حساباتها وشركاؤها ومشاريعها وقيودها، وكل الشاشات تعرض بيانات الشركة المفتوحة فقط. الترحيل يستخدم دليل حسابات الشركة المفتوحة؛ لو حساب مطلوب ناقص، أضفه من شجرة الحسابات ثم أعد المحاولة.
          </p>
          {loadError && <div className="ent-overpaid" role="alert" style={{ margin: '0 1rem 1rem' }}>{loadError}</div>}
          {rows.length ? <div className="ent-table-scroll"><table className="ent-table">
            <thead><tr><th>الكود</th><th>الشركة</th><th>الرقم الضريبي</th><th>السجل التجاري</th><th>العملة</th><th>صلاحيتك</th><th>الحالة</th><th><span className="sr-only">إجراءات</span></th></tr></thead>
            <tbody>{rows.map(company => {
              const isCurrent = company.id === activeCompanyId;
              const memberRole = roleById.get(company.id);
              return <tr key={company.id}>
                <td dir="ltr" style={{ fontWeight: 800 }}><span aria-hidden="true" style={{ display: 'inline-block', width: '0.6rem', height: '0.6rem', borderRadius: '50%', background: company.brand_color || '#F97316', marginInlineEnd: '0.4rem' }} />{company.code}</td>
                <td><strong>{company.name}</strong>{company.legal_name && <div className="ent-muted">{company.legal_name}</div>}</td>
                <td dir="ltr">{company.tax_number || <span className="ent-muted">غير مسجل</span>}</td>
                <td dir="ltr">{company.cr_number || <span className="ent-muted">غير مسجل</span>}</td>
                <td>{company.currency}</td>
                <td>{memberRole === 'admin' ? 'مدير الشركة' : memberRole === 'member' ? 'عضو' : isPlatformAdmin ? 'مدير النظام' : '—'}</td>
                <td>
                  {!company.is_active ? <span className="phi-badge is-out">موقوفة</span>
                    : isCurrent ? <span className="phi-badge is-in">الحالية</span>
                    : <span className="ent-muted">نشطة</span>}
                  {company.is_default && <div className="ent-muted">الافتراضية</div>}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {company.is_active && memberRole && !isCurrent && <button type="button" className="ent-button" onClick={() => void handleSwitch(company)}><ArrowLeftRight size={15} aria-hidden="true" />فتح</button>}
                  {canEdit(company.id) && <button type="button" className="ent-icon-button" onClick={() => openMembers(company)} aria-label={`أعضاء ${company.name}`} title="الأعضاء"><Users size={16} /></button>}
                  {canEdit(company.id) && <button type="button" className="ent-icon-button" onClick={() => openEdit(company)} aria-label={`تعديل بيانات ${company.name}`} title="تعديل البيانات"><Pencil size={16} /></button>}
                </td>
              </tr>;
            })}</tbody>
          </table></div> : !loadError && <div className="ent-empty"><Building2 size={30} aria-hidden="true" /><h3>لا توجد شركات متاحة لك</h3><p>{isPlatformAdmin ? 'أضف أول شركة من زر «إضافة شركة».' : 'اطلب من مدير النظام إضافتك إلى شركة.'}</p></div>}
        </section>
      )}

      <PhiDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        busy={saving}
        size="lg"
        icon={<Building2 size={22} />}
        title={editing ? 'تعديل بيانات الشركة' : 'إضافة شركة'}
        subtitle={editing ? `${editing.code} — ${editing.name}` : 'ستصبح مديرًا للشركة الجديدة تلقائيًا'}
        onSubmit={() => void save()}
        footer={<button type="submit" className="ent-button ent-primary" disabled={saving}><Save size={16} aria-hidden="true" />{saving ? 'جاري الحفظ…' : editing ? 'حفظ التعديلات' : 'إضافة الشركة'}</button>}
      >
        <section className="ent-form-section">
          <h3><Building2 size={17} aria-hidden="true" />البيانات الأساسية</h3>
          <div className="ent-form-grid">
            <div className="ent-form-field"><label htmlFor="co-code">كود الشركة *</label><input id="co-code" dir="ltr" required maxLength={20} placeholder="PHI" {...field('code')} /><span className="ent-field-note">حروف إنجليزية وأرقام بدون مسافات</span></div>
            <div className="ent-form-field"><label htmlFor="co-name">الاسم التجاري *</label><input id="co-name" required maxLength={200} {...field('name')} /></div>
            <div className="ent-form-field ent-form-full"><label htmlFor="co-legal">الاسم القانوني (كما في السجل التجاري)</label><input id="co-legal" maxLength={200} {...field('legal_name')} /></div>
          </div>
        </section>
        <div className="ent-form-divider" />
        <section className="ent-form-section">
          <h3><Landmark size={17} aria-hidden="true" />البيانات الرسمية</h3>
          <div className="ent-form-grid">
            <div className="ent-form-field"><label htmlFor="co-vat">الرقم الضريبي</label><input id="co-vat" dir="ltr" inputMode="numeric" maxLength={15} placeholder="3XXXXXXXXXXXXX3" {...field('tax_number')} /><span className="ent-field-note">يظهر في الفواتير الضريبية — اتركه فارغًا لو غير مسجل</span></div>
            <div className="ent-form-field"><label htmlFor="co-cr">السجل التجاري</label><input id="co-cr" dir="ltr" inputMode="numeric" maxLength={10} {...field('cr_number')} /></div>
            <div className="ent-form-field"><label htmlFor="co-country">الدولة</label><select id="co-country" {...field('country')}>{COUNTRIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div className="ent-form-field"><label htmlFor="co-currency">العملة</label><select id="co-currency" {...field('currency')}>{CURRENCIES.map(([v, l]) => <option key={v} value={v}>{v} — {l}</option>)}</select><span className="ent-field-note">كل المبالغ في الشاشات والتقارير والتفقيط بتظهر بالعملة دي لما الشركة تكون مفتوحة. تغييرها مش بيحوّل المبالغ المسجلة.</span></div>
            <div className="ent-form-field"><label htmlFor="co-fy">بداية السنة المالية</label><input id="co-fy" type="date" {...field('fiscal_year_start')} /></div>
            <div className="ent-form-field"><label htmlFor="co-color">لون الهوية</label><input id="co-color" type="color" {...field('brand_color')} /></div>
          </div>
        </section>
        <div className="ent-form-divider" />
        <section className="ent-form-section">
          <h3><Users size={17} aria-hidden="true" />بيانات التواصل</h3>
          <div className="ent-form-grid">
            <div className="ent-form-field"><label htmlFor="co-email">البريد الإلكتروني</label><input id="co-email" type="email" dir="ltr" {...field('email')} /></div>
            <div className="ent-form-field"><label htmlFor="co-phone">الهاتف</label><input id="co-phone" type="tel" dir="ltr" {...field('phone')} /></div>
            <div className="ent-form-field ent-form-full"><label htmlFor="co-address">العنوان</label><textarea id="co-address" rows={2} {...field('address')} /></div>
          </div>
        </section>
        {isPlatformAdmin && <>
          <div className="ent-form-divider" />
          <section className="ent-form-section">
            <h3><ShieldCheck size={17} aria-hidden="true" />إعدادات مدير النظام</h3>
            <div className="ent-form-grid">
              {!editing && activeCompany && <label className="phi-check"><input type="checkbox" checked={copyAccounts} onChange={(e: ChangeEvent<HTMLInputElement>) => setCopyAccounts(e.target.checked)} />انسخ دليل الحسابات من «{activeCompany.name}»</label>}
              <label className="phi-check"><input type="checkbox" checked={makeDefault} disabled={!!editing?.is_default} onChange={(e: ChangeEvent<HTMLInputElement>) => setMakeDefault(e.target.checked)} />الشركة الافتراضية للنظام</label>
              {editing && <label className="phi-check"><input type="checkbox" checked={isActive} disabled={editing.is_default} onChange={(e: ChangeEvent<HTMLInputElement>) => setIsActive(e.target.checked)} />الشركة نشطة</label>}
            </div>
            {!editing && <span className="ent-field-note">بدون دليل حسابات لن تعمل القيود والفواتير في الشركة الجديدة؛ يمكنك تعديل الحسابات بعد النسخ.</span>}
            {editing?.is_default && <span className="ent-field-note">لإيقاف هذه الشركة أو إلغاء كونها الافتراضية، اجعل شركة أخرى افتراضية أولًا.</span>}
          </section>
        </>}
      </PhiDialog>

      <PhiDialog
        open={!!membersOf}
        onClose={() => setMembersOf(null)}
        busy={memberBusy}
        size="lg"
        icon={<Users size={22} />}
        title="أعضاء الشركة"
        subtitle={membersOf ? `${membersOf.code} — ${membersOf.name}` : undefined}
        cancelLabel="إغلاق"
      >
        <section className="ent-form-section">
          <h3><Plus size={17} aria-hidden="true" />إضافة عضو</h3>
          <div className="ent-form-grid cols-3">
            <div className="ent-form-field" style={{ gridColumn: 'span 2' }}>
              <label htmlFor="member-user">المستخدم</label>
              <select id="member-user" value={newMember} onChange={(e: ChangeEvent<HTMLSelectElement>) => setNewMember(e.target.value)} disabled={membersLoading || memberBusy}>
                <option value="">{candidates.length ? 'اختر مستخدمًا…' : 'كل المستخدمين أعضاء بالفعل'}</option>
                {candidates.map(c => <option key={c.user_id} value={c.user_id}>{personName(c)}{c.email && c.full_name ? ` — ${c.email}` : ''}{c.system_role === 'client' ? ' (بانتظار التفعيل)' : ''}</option>)}
              </select>
            </div>
            <div className="ent-form-field">
              <label htmlFor="member-role">الصلاحية</label>
              <select id="member-role" value={newMemberRole} onChange={(e: ChangeEvent<HTMLSelectElement>) => setNewMemberRole(e.target.value as CompanyRole)} disabled={memberBusy}>
                <option value="member">عضو</option>
                <option value="admin">مدير الشركة</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
            <span className="ent-field-note">العضو يرى بيانات الشركة حسب صلاحيات الشاشات المحددة له في «فريق العمل». مدير الشركة يعدّل بياناتها وأعضاءها.</span>
            <button type="button" className="ent-button ent-primary" onClick={addMember} disabled={!newMember || memberBusy}><Plus size={15} aria-hidden="true" />إضافة</button>
          </div>
        </section>
        <div className="ent-form-divider" />
        <section className="ent-form-section">
          <h3><Users size={17} aria-hidden="true" />الأعضاء <span className="ent-muted">{members.filter(m => m.is_active).length.toLocaleString('en-US')}</span></h3>
          {membersLoading ? <p className="ent-muted">جاري التحميل…</p> : members.length ? <div className="ent-table-scroll"><table className="ent-table">
            <thead><tr><th>الاسم</th><th>الصلاحية في الشركة</th><th>الحالة</th><th><span className="sr-only">إجراءات</span></th></tr></thead>
            <tbody>{members.map(m => <tr key={m.user_id}>
              <td><strong>{personName(m)}</strong>{m.full_name && m.email && <div className="ent-muted" dir="ltr">{m.email}</div>}</td>
              <td>{m.is_active
                ? <select aria-label={`صلاحية ${personName(m)}`} value={m.role} onChange={(e: ChangeEvent<HTMLSelectElement>) => changeRole(m, e.target.value as CompanyRole)} disabled={memberBusy}>
                    <option value="member">عضو</option>
                    <option value="admin">مدير الشركة</option>
                  </select>
                : <span className="ent-muted">{m.role === 'admin' ? 'مدير الشركة' : 'عضو'}</span>}</td>
              <td>{m.is_active ? <span className="phi-badge is-in">نشط</span> : <span className="phi-badge is-out">أُزيل</span>}</td>
              <td>{m.is_active && <button type="button" className="ent-icon-button" onClick={() => removeMember(m)} disabled={memberBusy} aria-label={`إزالة ${personName(m)}`} title="إزالة من الشركة"><Trash2 size={16} /></button>}</td>
            </tr>)}</tbody>
          </table></div> : <p className="ent-muted">لا يوجد أعضاء.</p>}
        </section>
      </PhiDialog>
    </MasterPage>
  );
}
