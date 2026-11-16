/**
 * Unified naming and report numbering utilities for all PDFs, printouts,
 * vouchers, Excel sheets, CSVs, and archives downloaded from PhiTech ERP.
 *
 * Ensures every downloaded document includes both its document/report type
 * and a clear voucher/report number so files are never confused or overwritten.
 */

export interface ReportRefOptions {
  explicitCode?: string | null;
  prefix?: string;
  issueDate?: string;
  seedParts?: Array<string | number | null | undefined>;
}

export interface DocumentFileNameOptions {
  docType: string;
  docNumber?: string | null;
  subject?: string | null;
  prefix?: string;
  issueDate?: string;
  seedParts?: Array<string | number | null | undefined>;
  ext?: string;
}

export interface DocumentFileNameResult {
  refCode: string;
  docType: string;
  baseName: string;
  fileName: string;
}

const EMPTY_PLACEHOLDERS = new Set(['---', '—', '-', 'غير محدد', 'null', 'undefined']);

/**
 * Strips parenthetical English suffixes like `سند قبض (Receipt Voucher)`
 * so the Arabic document type remains concise in filenames.
 */
export function extractArabicDocType(rawTitle: string): string {
  const trimmed = String(rawTitle || '').trim();
  const m = /^(.*?)\s*\([A-Za-z][^()]*\)\s*$/.exec(trimmed);
  return (m && m[1] ? m[1].trim() : trimmed) || 'مستند_فاي_تك';
}

/**
 * Sanitizes a segment so it is safe on Windows, macOS, Linux, and browsers
 * while preserving readable Arabic and Latin identifiers.
 */
export function sanitizeFileNameSegment(value: unknown, maxLen = 64): string {
  if (value === null || value === undefined) return '';
  let text = String(value).trim();
  if (!text || EMPTY_PLACEHOLDERS.has(text.toLowerCase()) || EMPTY_PLACEHOLDERS.has(text)) {
    return '';
  }

  text = text
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[\/\\:]+/g, '-')
    .replace(/[*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/-+/g, '-')
    .replace(/^[._\-\s]+|[._\-\s]+$/g, '');

  if (maxLen > 0 && text.length > maxLen) {
    text = text.slice(0, maxLen).replace(/[._\-]+$/g, '');
  }
  return text;
}

/**
 * Normalizes a date input (`YYYY-MM-DD`, `DD/MM/YYYY`, ISO string, or omitted)
 * into chronological `YYYYMMDD` digits for consistent report codes.
 */
export function formatDateDigits(issueDate?: string): string {
  const raw = String(issueDate || '').trim();
  if (raw) {
    const iso = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(raw);
    if (iso) {
      return `${iso[1]}${iso[2].padStart(2, '0')}${iso[3].padStart(2, '0')}`;
    }
    const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(raw);
    if (dmy) {
      return `${dmy[3]}${dmy[2].padStart(2, '0')}${dmy[1].padStart(2, '0')}`;
    }
    const digitsOnly = raw.replace(/[^0-9]/g, '');
    if (digitsOnly.length >= 8) {
      return digitsOnly.slice(0, 8);
    }
  }

  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Generates a deterministic 4-digit suffix (`1000`–`9999`) from context parts
 * so identical reports share the same ID between print header and downloads,
 * while different scopes/filters get distinct report numbers.
 */
function hashSeedParts(parts: Array<string | number | null | undefined>): string {
  const joined = parts
    .map((p) => (p === null || p === undefined ? '' : String(p).trim()))
    .filter(Boolean)
    .join('|') || 'PHITECH';

  let hash = 2166136261;
  for (let i = 0; i < joined.length; i++) {
    hash ^= joined.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const normalized = (Math.abs(hash) % 9000) + 1000;
  return String(normalized);
}

/**
 * Resolves the report or voucher reference number:
 * uses an explicit database number when provided, or computes a structured
 * `<PREFIX>-<YYYYMMDD>-<HASH>` report code.
 */
export function computeReportRefCode({
  explicitCode,
  prefix = 'PHI-REP',
  issueDate,
  seedParts = [],
}: ReportRefOptions = {}): string {
  const cleanExplicit = sanitizeFileNameSegment(explicitCode, 48);
  if (cleanExplicit) {
    return cleanExplicit;
  }

  const cleanPrefix = sanitizeFileNameSegment(prefix || 'PHI-REP', 16).toUpperCase() || 'PHI-REP';
  const dateDigits = formatDateDigits(issueDate);
  const codeHash = hashSeedParts([cleanPrefix, dateDigits, ...seedParts]);
  return `${cleanPrefix}-${dateDigits}-${codeHash}`;
}

/**
 * Builds a complete, OS-safe filename guaranteed to include both the document/report
 * type and its voucher/report reference number (`<Type>_<Number>[_<Subject>][.<ext>]`).
 */
export function buildDocumentFileName({
  docType,
  docNumber,
  subject,
  prefix,
  issueDate,
  seedParts = [],
  ext,
}: DocumentFileNameOptions): DocumentFileNameResult {
  const extractedType = extractArabicDocType(docType);
  const cleanType = sanitizeFileNameSegment(extractedType, 56) || 'مستند_فاي_تك';
  const refCode = computeReportRefCode({
    explicitCode: docNumber,
    prefix: prefix || 'PHI-REP',
    issueDate,
    seedParts: [cleanType, subject, ...seedParts],
  });
  const cleanNumber = sanitizeFileNameSegment(refCode, 48);
  const cleanSubject = subject ? sanitizeFileNameSegment(subject, 36) : '';

  const segments: string[] = [cleanType];
  if (cleanNumber && !cleanType.includes(cleanNumber)) {
    segments.push(cleanNumber);
  }
  if (cleanSubject && !cleanType.includes(cleanSubject) && !cleanNumber.includes(cleanSubject)) {
    segments.push(cleanSubject);
  }

  const baseName = segments.filter(Boolean).join('_');
  const cleanExt = ext ? sanitizeFileNameSegment(ext.replace(/^\./, ''), 12) : '';
  const fileName = cleanExt ? `${baseName}.${cleanExt}` : baseName;

  return {
    refCode,
    docType: cleanType,
    baseName,
    fileName,
  };
}

/**
 * Formats an RFC 5987 UTF-8 Content-Disposition attachment header with ASCII fallback.
 */
export function buildContentDispositionAttachment(fileName: string): string {
  const safeFull = sanitizeFileNameSegment(fileName.replace(/\.pdf$/i, ''), 96) || 'PhiTech_Document';
  const utf8Name = `${safeFull}.pdf`;
  const asciiFallback = utf8Name.replace(/[^\x20-\x7E]/g, '_') || 'PhiTech_Document.pdf';
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(utf8Name)}`;
}
