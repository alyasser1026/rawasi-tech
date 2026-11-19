import { createHmac, timingSafeEqual } from 'node:crypto';

export const documentTypes = {
  payment: { table: 'payment_vouchers', numberColumn: 'voucher_number', postedFlag: true, label: 'سند صرف' },
  receipt: { table: 'receipt_vouchers', numberColumn: 'receipt_number', postedFlag: false, label: 'سند قبض' },
  invoice: { table: 'invoices', numberColumn: 'invoice_number', postedFlag: false, label: 'فاتورة' },
  claim: { table: 'sub_claims', numberColumn: 'claim_number', postedFlag: true, label: 'مستخلص أعمال' },
} as const;

export type DocumentVerificationKind = keyof typeof documentTypes;

export const documentUuidPattern = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

export interface DocumentVerificationTarget {
  kind: DocumentVerificationKind;
  documentId: string;
  companyId: string;
}

export interface VerifiedDocument {
  docType: string;
  docNumber: string;
  date: string;
  status: string;
}

export function isVerificationKind(value: unknown): value is DocumentVerificationKind {
  return typeof value === 'string' && Object.hasOwn(documentTypes, value);
}

const postedStatuses = new Set(['posted', 'معتمد', 'مُعتمد', 'مرحل', 'مُرحّل', 'مرحّل']);

export function isPostedDocument(row: { is_posted?: boolean; status?: string | null }): boolean {
  return row.is_posted === true || postedStatuses.has(row.status?.trim().toLowerCase() ?? '');
}

function tokenSignature(payload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update('phitech-document-verification/v1:').update(payload).digest();
}

function encodeDocumentId(id: string): string {
  return Buffer.from(id.replaceAll('-', ''), 'hex').toString('base64url');
}

function decodeDocumentId(encoded: string): string | null {
  const bytes = Buffer.from(encoded, 'base64url');
  if (bytes.length !== 16 || bytes.toString('base64url') !== encoded) return null;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function signDocumentToken(target: DocumentVerificationTarget, secret: string): string {
  const payload = ['v1', target.kind, encodeDocumentId(target.documentId), encodeDocumentId(target.companyId)].join('.');
  return `${payload}.${tokenSignature(payload, secret).toString('base64url')}`;
}

export function readDocumentToken(token: string, secret: string): DocumentVerificationTarget | null {
  const match = /^v1\.([a-z]+)\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match || !isVerificationKind(match[1])) return null;
  const supplied = Buffer.from(match[4], 'base64url');
  const payload = token.slice(0, -match[4].length - 1);
  const expected = tokenSignature(payload, secret);
  if (supplied.toString('base64url') !== match[4] || !timingSafeEqual(supplied, expected)) return null;
  const documentId = decodeDocumentId(match[2]);
  const companyId = decodeDocumentId(match[3]);
  return documentId && companyId ? { kind: match[1], documentId, companyId } : null;
}
