'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePlus2, Printer, TriangleAlert } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useReactToPrint } from 'react-to-print';
import PhiDialog from '@/components/PhiDialog';
import { useCompany } from '@/lib/CompanyContext';
import { usePermissions } from '@/lib/PermissionsContext';
import { notify } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import styles from './invoice-adjustment.module.css';

type NoteType = 'credit' | 'debit';
type Amount = string | number;
type AdjustmentLine = {
  id: string | null;
  line_index: number;
  description: string | null;
  base_amount: Amount;
  remaining_base: Amount;
  review_reason: string | null;
};
type AdjustmentOptions = {
  invoice_id: string;
  invoice_number: string;
  paid_amount: Amount;
  net_adjustment: Amount;
  balance: Amount;
  unreversed_materials?: Amount;
  lines: AdjustmentLine[];
  review_reason: string | null;
};
type IssuedNote = {
  id: string;
  invoice_id: string;
  invoice_number: string;
  note_type: NoteType;
  note_number: string;
  note_date: string;
  issued_at: string;
  reason: string;
  base_amount: Amount;
  tax_amount: Amount;
  gross_amount: Amount;
  retention_amount: Amount;
  material_reversal_amount?: Amount;
  receivable_amount: Amount;
  seller_name: string;
  seller_tax_number: string;
};

const noteLabels: Record<NoteType, string> = { credit: 'إشعار دائن', debit: 'إشعار مدين' };
const currency = new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 2 });
const formatAmount = (amount: Amount) => currency.format(Number(amount));
const dateFormat = new Intl.DateTimeFormat('ar-SA', { calendar: 'gregory', timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' });
const taxDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' });
const lineKey = (line: AdjustmentLine) => line.id ?? `legacy-${line.line_index}`;

function getNoteQr(note: IssuedNote) {
  const issuedAt = new Date(note.issued_at);
  if (Number.isNaN(issuedAt.getTime())) return null;
  const encoder = new TextEncoder();
  const fields = [note.seller_name, note.seller_tax_number, issuedAt.toISOString(), Number(note.gross_amount).toFixed(2), Number(note.tax_amount).toFixed(2)];
  const bytes: number[] = [];
  for (const [index, value] of fields.entries()) {
    const encoded = encoder.encode(value);
    if (!encoded.length || encoded.length > 255) return null;
    bytes.push(index + 1, encoded.length, ...encoded);
  }
  return btoa(String.fromCharCode(...bytes));
}

function NoteDocument({ note }: { note: IssuedNote }) {
  const qr = getNoteQr(note);
  return <article className={styles.document} dir="rtl">
    <header className={styles.documentHeader}>
      <div><p>{note.seller_name}</p><h2>{noteLabels[note.note_type]} ضريبي</h2><strong><bdi>{note.note_number}</bdi></strong></div>
      {qr && <QRCodeSVG value={qr} size={94} level="M" title={`رمز الاستجابة السريعة للإشعار ${note.note_number}`} />}
    </header>
    {!qr && <p role="alert">تعذر تكوين الرمز من بيانات الإصدار المحفوظة.</p>}
    <dl className={styles.documentData}>
      <div><dt>الرقم الضريبي للبائع</dt><dd><bdi>{note.seller_tax_number}</bdi></dd></div>
      <div><dt>الفاتورة الأصلية</dt><dd><bdi>{note.invoice_number}</bdi></dd></div>
      <div><dt>تاريخ الإشعار</dt><dd><bdi>{note.note_date}</bdi></dd></div>
      <div><dt>وقت الإصدار</dt><dd>{dateFormat.format(new Date(note.issued_at))}</dd></div>
    </dl>
    <h3>سبب الإشعار</h3><p className={styles.reason}>{note.reason}</p>
    <dl className={styles.documentData}>
      <div><dt>المبلغ قبل الضريبة</dt><dd>{formatAmount(note.base_amount)}</dd></div>
      <div><dt>ضريبة القيمة المضافة</dt><dd>{formatAmount(note.tax_amount)}</dd></div>
      <div><dt>الإجمالي شامل الضريبة</dt><dd>{formatAmount(note.gross_amount)}</dd></div>
      {Number(note.retention_amount) !== 0 && <div><dt>تعديل مبلغ الضمان</dt><dd>{formatAmount(note.retention_amount)}</dd></div>}
      {Number(note.material_reversal_amount || 0) > 0 && <div><dt>رد رصيد خامات العميل (217)</dt><dd>{formatAmount(note.material_reversal_amount!)}</dd></div>}
      <div><dt>أثر الإشعار على ذمة العميل</dt><dd>{note.note_type === 'credit' ? 'تخفيض ' : 'زيادة '}{formatAmount(note.receivable_amount)}</dd></div>
    </dl>
  </article>;
}

export default function InvoiceAdjustmentModal({ invoiceId, companyId, onClose }: { invoiceId: string; companyId: string; onClose: () => void }) {
  const { activeCompanyId, activeCompany } = useCompany();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [noteType, setNoteType] = useState<NoteType>('credit');
  const [lineSelection, setLineSelection] = useState('');
  const [noteDate, setNoteDate] = useState(() => taxDay.format(new Date()));
  const [base, setBase] = useState('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<IssuedNote | null>(null);
  const pendingRequest = useRef<{ payload: string; id: string } | null>(null);
  const printContent = useRef<HTMLDivElement>(null);
  const print = useReactToPrint({
    contentRef: printContent,
    documentTitle: preview?.note_number ?? 'invoice-adjustment',
    pageStyle: '@page { size: A4 portrait; margin: 12mm; } body { color: #111; background: #fff; }',
    onPrintError: () => notify.error('تعذرت طباعة الإشعار.'),
  });
  const canView = companyId === activeCompanyId && can('invoices', 'view');
  const canIssue = canView && can('invoices', 'post');
  const registered = Boolean(activeCompany?.tax_number?.trim());
  const optionsKey = ['invoice-adjustment-options', companyId, invoiceId];
  const listKey = ['invoice-adjustment-notes', companyId, invoiceId];
  const optionsQuery = useQuery({
    queryKey: optionsKey, enabled: canIssue,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_invoice_adjustment_options', { p_invoice_id: invoiceId });
      if (error) throw new Error(error.message);
      if (data?.invoice_id !== invoiceId || !Array.isArray(data?.lines)) throw new Error('تعذر التحقق من بيانات الفاتورة.');
      return data as AdjustmentOptions;
    },
  });
  const notesQuery = useQuery({
    queryKey: listKey, enabled: canView,
    queryFn: async () => {
      const { data, error } = await supabase.from('invoice_adjustment_notes')
        .select('id,invoice_id,invoice_number,note_type,note_number,note_date,issued_at,reason,base_amount,tax_amount,gross_amount,retention_amount,material_reversal_amount,receivable_amount,seller_name,seller_tax_number')
        .eq('company_id', companyId).eq('invoice_id', invoiceId).order('issued_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as IssuedNote[];
    },
  });
  const options = optionsQuery.data;
  const lines = options?.lines ?? [];
  const selectedLine = lines.find(line => lineKey(line) === lineSelection) ?? (lines.length === 1 ? lines[0] : undefined);
  const validBase = /^\d+(\.\d{1,2})?$/.test(base) && Number(base) > 0;
  const creditTooLarge = noteType === 'credit' && selectedLine && validBase && Number(base) > Number(selectedLine.remaining_base);
  const canSubmit = Boolean(canIssue && registered && options && !options.review_reason && selectedLine && !selectedLine.review_reason &&
    !creditTooLarge && validBase && noteDate && reason.trim() && !optionsQuery.isFetching && !optionsQuery.isError);
  const issue = useMutation({
    mutationFn: async () => {
      if (!canSubmit || !selectedLine) throw new Error('راجع بيانات الإشعار قبل الإصدار.');
      const args = { p_invoice_id: invoiceId, p_invoice_line_id: selectedLine.id, p_note_type: noteType,
        p_note_date: noteDate, p_base_amount: Number(base), p_reason: reason.trim() };
      const payload = JSON.stringify(args);
      if (pendingRequest.current?.payload !== payload) pendingRequest.current = { payload, id: crypto.randomUUID() };
      const { data, error } = await supabase.rpc('issue_invoice_adjustment', { ...args, p_request_id: pendingRequest.current.id });
      if (error) throw new Error(error.message);
      if (data?.invoice_id !== invoiceId || !data.id) throw new Error('تعذر تأكيد الإصدار. أعد نفس المحاولة للتحقق.');
      return data as IssuedNote;
    },
    onSuccess: note => {
      setBase('');
      setReason('');
      setPreview(note);
      pendingRequest.current = null;
      for (const key of [listKey, optionsKey, ['invoices'], ['vat-return']]) void queryClient.invalidateQueries({ queryKey: key });
      notify.success(`تم ترحيل ${noteLabels[note.note_type]} ${note.note_number}`);
    },
  });

  if (!canView) return null;
  const invoiceNumber = options?.invoice_number ?? notesQuery.data?.[0]?.invoice_number;
  const showForm = canIssue && registered && options && !options.review_reason && lines.length > 0;
  return <PhiDialog open onClose={onClose} title={preview ? noteLabels[preview.note_type] : 'إشعارات الفاتورة'}
    subtitle={invoiceNumber ? `الفاتورة ${invoiceNumber}` : undefined} icon={<FilePlus2 size={20} />} size="xl"
    busy={issue.isPending} cancelLabel="إغلاق"
    onSubmit={preview || !showForm ? undefined : () => { if (canSubmit && !issue.isPending) issue.mutate(); }}
    footer={preview ? <>
      <button type="button" className="ent-button" onClick={() => setPreview(null)}>رجوع للإشعارات</button>
      <button type="button" className="ent-button ent-primary" onClick={() => print()}><Printer size={16} aria-hidden="true" />طباعة A4</button>
    </> : showForm ? <button type="submit" className="ent-button ent-primary" disabled={!canSubmit || issue.isPending}>{issue.isPending ? 'جاري الترحيل…' : 'إصدار وترحيل الإشعار'}</button> : undefined}>
    {preview ? <div ref={printContent}><NoteDocument note={preview} /></div> : <div className={styles.content} dir="rtl">
      {canIssue && !registered && <p className={styles.notice}><TriangleAlert size={17} aria-hidden="true" />أدخل الرقم الضريبي للشركة في إعداداتها قبل إصدار إشعار ضريبي.</p>}
      {canIssue && optionsQuery.isPending && <p role="status">جاري التحقق من بنود الفاتورة…</p>}
      {canIssue && optionsQuery.isError && <div className={styles.notice} role="alert"><span>{optionsQuery.error.message}</span>
        <button type="button" className="ent-button" onClick={() => void optionsQuery.refetch()}>إعادة التحقق</button></div>}
      {options?.review_reason && <p className={styles.notice}><TriangleAlert size={17} aria-hidden="true" />{options.review_reason}</p>}
      {options && <dl className={styles.balance}>
        <div><dt>المدفوع</dt><dd>{formatAmount(options.paid_amount)}</dd></div>
        <div><dt>صافي أثر الإشعارات</dt><dd>{formatAmount(options.net_adjustment)}</dd></div>
        <div><dt>الرصيد بعد الإشعارات</dt><dd>{formatAmount(options.balance)}</dd></div>
        {Number(options.unreversed_materials || 0) > 0 && <div><dt>خامات عميل مسواة (217)</dt><dd>{formatAmount(options.unreversed_materials!)}</dd></div>}
      </dl>}
      {showForm && <section className="ent-form-section" aria-labelledby="new-invoice-adjustment-title">
        <h3 id="new-invoice-adjustment-title">إصدار إشعار على بند من الفاتورة</h3>
        <div className="ent-form-grid">
          <div className="ent-form-field"><label htmlFor="adjustment-type">نوع الإشعار</label>
            <select id="adjustment-type" value={noteType} onChange={event => setNoteType(event.target.value === 'debit' ? 'debit' : 'credit')} disabled={issue.isPending}>
              <option value="credit">إشعار دائن يخفض الرصيد</option><option value="debit">إشعار مدين يزيد الرصيد</option>
            </select>
          </div>
          <div className="ent-form-field"><label htmlFor="adjustment-date">تاريخ الإشعار</label>
            <input id="adjustment-date" type="date" required value={noteDate} onChange={event => setNoteDate(event.target.value)} disabled={issue.isPending} />
          </div>
          <div className="ent-form-field ent-form-full"><label htmlFor="adjustment-line">البند الأصلي</label>
            <select id="adjustment-line" required value={selectedLine ? lineKey(selectedLine) : ''} onChange={event => setLineSelection(event.target.value)} disabled={issue.isPending}>
              <option value="">اختر البند</option>
              {lines.map(line => <option key={lineKey(line)} value={lineKey(line)}>{line.description || `بند ${line.line_index}`} — {formatAmount(line.base_amount)}</option>)}
            </select>
            {selectedLine?.review_reason && <small className="ent-field-note">{selectedLine.review_reason}</small>}
          </div>
          <div className="ent-form-field ent-form-full"><label htmlFor="adjustment-base">مبلغ التعديل قبل الضريبة (ريال)</label>
            <input id="adjustment-base" dir="ltr" type="number" min="0.01" step="0.01" inputMode="decimal" required value={base}
              onChange={event => setBase(event.target.value)} disabled={issue.isPending} />
            {noteType === 'credit' && selectedLine && <small className="ent-field-note">المتبقي من أصل البند قبل الضريبة {formatAmount(selectedLine.remaining_base)}. يُتحقق أيضًا من رصيد الفاتورة عند الترحيل.</small>}
            {creditTooLarge && <small className="ent-field-note" role="alert">المبلغ أكبر من المتبقي على هذا البند.</small>}
          </div>
          <div className="ent-form-field ent-form-full"><label htmlFor="adjustment-reason">سبب إصدار الإشعار</label>
            <textarea id="adjustment-reason" required value={reason} onChange={event => setReason(event.target.value)} disabled={issue.isPending} />
            <small className="ent-field-note">يحسب النظام الضريبة وأثر الضمان من بيانات البند ويثبت القيد عند الإصدار.</small>
          </div>
          {issue.isError && <p className={`ent-form-full ${styles.notice}`} role="alert">{issue.error.message}</p>}
        </div>
      </section>}
      <section className="ent-panel" aria-labelledby="issued-invoice-adjustments-title">
        <div className="ent-panel-heading"><h2 id="issued-invoice-adjustments-title">الإشعارات الصادرة</h2></div>
        {notesQuery.isPending ? <p className={styles.empty} role="status">جاري تحميل الإشعارات…</p> : notesQuery.isError ?
          <div className={styles.notice} role="alert"><span>{notesQuery.error.message}</span><button type="button" className="ent-button" onClick={() => void notesQuery.refetch()}>إعادة التحميل</button></div> :
          notesQuery.data.length ? <ul className={styles.issuedList}>{notesQuery.data.map(note => <li key={note.id}>
            <div><strong>{noteLabels[note.note_type]} <bdi>{note.note_number}</bdi></strong><small>{note.note_date} · {formatAmount(note.gross_amount)}</small></div>
            <button type="button" className="ent-button" onClick={() => setPreview(note)}><Printer size={16} aria-hidden="true" />عرض وطباعة</button>
          </li>)}</ul> : <p className={styles.empty}>لم يصدر أي إشعار لهذه الفاتورة.</p>}
      </section>
    </div>}
  </PhiDialog>;
}
