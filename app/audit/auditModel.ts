import { supabase } from '@/lib/supabase';

export interface HealthRadarItem {
  id: string;
  identifier?: string;
  date?: string;
  description?: string;
  amount?: number;
  header_id?: string;
}

export interface HealthRadarCheck {
  id: string;
  title_ar: string;
  severity: 'critical' | 'medium' | 'warning';
  count: number;
  action_url: string;
  items: HealthRadarItem[];
}

export interface HealthRadarSummary {
  total_issues: number;
  critical_count: number;
  medium_count: number;
  warning_count: number;
  scanned_at: string;
  checks: HealthRadarCheck[];
}

export interface CompanyDocument {
  id: string;
  document_number: string;
  title: string;
  doc_type: string;
  doc_type_ar?: string;
  issue_date: string | null;
  expiry_date: string;
  days_left: number;
  status: 'expired' | 'critical' | 'upcoming' | 'safe' | 'renewed';
  alert_days_before: number;
  is_renewed: boolean;
  renewal_date?: string | null;
  partner_id?: string | null;
  partner_name?: string | null;
  project_id?: string | null;
  project_name?: string | null;
  asset_id?: string | null;
  asset_name?: string | null;
  attachment_url?: string | null;
  notes?: string | null;
}

export interface RetentionGuarantee {
  project_id: string;
  project_name: string;
  client_name?: string;
  handover_date?: string | null;
  warranty_months: number;
  release_date: string;
  days_left: number;
  status: 'overdue' | 'due_soon' | 'active';
  client_retention_unreleased: number;
  sub_retention_unreleased: number;
  total_retention_unreleased: number;
}

export interface DocumentExpiryAlertsResponse {
  summary: {
    total_documents: number;
    expired_count: number;
    critical_count: number;
    upcoming_count: number;
    retention_due_count: number;
  };
  documents: CompanyDocument[];
  retention_guarantees: RetentionGuarantee[];
}

/**
 * Fetch system health radar checks and anomaly counts
 */
export async function fetchSystemHealthRadar(): Promise<HealthRadarSummary> {
  const { data, error } = await supabase.rpc('get_system_health_radar');
  if (error) throw error;
  return data as HealthRadarSummary;
}

/**
 * Fetch document expiry alerts and retention release trackers
 */
export async function fetchDocumentExpiryAlerts(thresholdDays: number = 30): Promise<DocumentExpiryAlertsResponse> {
  const { data, error } = await supabase.rpc('get_document_expiry_alerts', {
    p_days_threshold: thresholdDays
  });
  if (error) throw error;
  return data as DocumentExpiryAlertsResponse;
}

/**
 * Create or edit a company document
 */
export async function upsertCompanyDocument(doc: {
  id?: string;
  document_number: string;
  title: string;
  doc_type: string;
  expiry_date: string;
  issue_date?: string | null;
  alert_days_before?: number;
  partner_id?: string | null;
  project_id?: string | null;
  asset_id?: string | null;
  attachment_url?: string | null;
  notes?: string | null;
}) {
  const { data, error } = await supabase.rpc('upsert_company_document', {
    p_id: doc.id || null,
    p_document_number: doc.document_number,
    p_title: doc.title,
    p_doc_type: doc.doc_type,
    p_expiry_date: doc.expiry_date,
    p_issue_date: doc.issue_date || null,
    p_alert_days_before: doc.alert_days_before || 30,
    p_partner_id: doc.partner_id || null,
    p_project_id: doc.project_id || null,
    p_asset_id: doc.asset_id || null,
    p_attachment_url: doc.attachment_url || null,
    p_notes: doc.notes || null,
  });
  if (error) throw error;
  return data;
}

/**
 * Mark a document as renewed or extend its expiry date
 */
export async function markCompanyDocumentRenewed(documentId: string, newExpiryDate?: string) {
  const { data, error } = await supabase.rpc('mark_company_document_renewed', {
    p_document_id: documentId,
    p_new_expiry_date: newExpiryDate || null
  });
  if (error) throw error;
  return data;
}

/**
 * Trigger daily health and expiry scan manually
 */
export async function runDailyScanManually(): Promise<number> {
  const { data, error } = await supabase.rpc('run_daily_health_and_expiry_scans');
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}
