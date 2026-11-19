import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  documentTypes,
  documentUuidPattern,
  isPostedDocument,
  isVerificationKind,
  readDocumentToken,
  signDocumentToken,
  type DocumentVerificationTarget,
  type VerifiedDocument,
} from '@/lib/document-verification';

export const runtime = 'nodejs';

const unverifiedMessage = 'تعذر التحقق من المستند. امسح رمز التحقق الموجود في أحدث نسخة معتمدة.';
const unavailableMessage = 'خدمة التحقق غير متاحة الآن. يرجى المحاولة لاحقاً.';
const responseHeaders = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
};

function reply(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: responseHeaders });
}

function readConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const signingKey = process.env.DOCUMENT_VERIFICATION_SECRET?.trim() || serviceKey;
  return { url, publicKey, serviceKey, signingKey };
}

async function findIssuedDocument(
  client: SupabaseClient,
  target: DocumentVerificationTarget,
): Promise<VerifiedDocument | null> {
  const { kind, documentId, companyId } = target;
  const doc = documentTypes[kind];
  const { data, error } = await client
    .from(doc.table)
    .select(`id, company_id, ${doc.numberColumn}, date, status${doc.postedFlag ? ', is_posted' : ''}`)
    .eq('id', documentId)
    .eq('company_id', companyId)
    .maybeSingle()
    .overrideTypes<{
      id: string;
      company_id: string;
      date: string | null;
      status: string | null;
      is_posted?: boolean;
      voucher_number?: string | null;
      receipt_number?: string | null;
      invoice_number?: string | null;
      claim_number?: string | null;
    }, { merge: false }>();

  if (error) throw error;
  const docNumber = data?.[doc.numberColumn];
  if (!data || !isPostedDocument(data) || !docNumber || !data.date) return null;
  return {
    docType: doc.label,
    docNumber,
    date: data.date,
    status: 'معتمد',
  };
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const token = (params.get('doc') ?? '').trim();
  if (!token) return reply({ success: false, message: 'امسح رمز التحقق أو أدخل الكود المطبوع بجواره.' }, 400);

  const { url, serviceKey, signingKey } = readConfig();
  // Reject legacy numbers and invalid codes without querying accounting tables.
  if (!token.startsWith('v1.')) return reply({ success: true, found: false, message: unverifiedMessage });
  if (!url || !serviceKey || !signingKey) return reply({ success: false, message: unavailableMessage }, 503);
  const target = readDocumentToken(token, signingKey);
  if (!target) return reply({ success: true, found: false, message: unverifiedMessage });

  try {
    const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const data = await findIssuedDocument(client, target);
    return data
      ? reply({ success: true, found: true, data: { ...data, verifiedAt: new Date().toISOString() } })
      : reply({ success: true, found: false, message: unverifiedMessage });
  } catch {
    return reply({ success: false, message: unavailableMessage }, 503);
  }
}

// Issue a link only for an approved record visible through the caller's company RLS.
export async function POST(req: Request) {
  const accessToken = req.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!accessToken) return reply({ success: false, message: 'يلزم تسجيل الدخول لإصدار رابط التحقق.' }, 401);

  const companyId = req.headers.get('x-company-id')?.trim() ?? '';
  const body = await req.json().catch(() => null);
  const { kind, documentId } = body || {};
  if (!isVerificationKind(kind) || typeof documentId !== 'string' ||
      !documentUuidPattern.test(documentId) || !documentUuidPattern.test(companyId)) {
    return reply({ success: false, message: 'معرّف المستند أو الشركة غير صالح.' }, 400);
  }

  const { url, publicKey, signingKey } = readConfig();
  if (!url || !publicKey || !signingKey) return reply({ success: false, message: unavailableMessage }, 503);
  try {
    const client = createClient(url, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}`, 'x-company-id': companyId } },
    });
    const { data: { user }, error: authError } = await client.auth.getUser(accessToken);
    if (authError || !user) return reply({ success: false, message: 'جلسة الدخول غير صالحة.' }, 401);

    const target = { kind, documentId, companyId };
    const document = await findIssuedDocument(client, target);
    if (!document) return reply({ success: false, message: unverifiedMessage }, 404);
    return reply({ success: true, token: signDocumentToken(target, signingKey) });
  } catch {
    return reply({ success: false, message: unavailableMessage }, 503);
  }
}

