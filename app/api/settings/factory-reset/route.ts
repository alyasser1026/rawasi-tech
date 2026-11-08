import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { executeFactoryReset, FACTORY_RESET_CONFIRMATION_PHRASE } from '@/lib/factory-reset';
import { authorizeAdminRequest } from '@/lib/admin-authorization';

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || 'placeholder',
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

export async function POST(req: Request) {
  try {
    const authResult = await authorizeAdminRequest(req, getSupabaseAdmin);
    if (authResult.error) {
      return authResult.error;
    }

    const body = await req.json().catch(() => ({}));
    const { confirmationPhrase, companyId, resetAllCompanies } = body;

    if (confirmationPhrase !== FACTORY_RESET_CONFIRMATION_PHRASE) {
      return NextResponse.json(
        {
          error: `تأكيد غير صحيح. يرجى كتابة عبارة "${FACTORY_RESET_CONFIRMATION_PHRASE}" تماماً لإتمام العملية.`,
        },
        { status: 400 }
      );
    }

    // Get active user ID from token
    const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    let userId: string | null = null;
    if (token) {
      const { data: { user } } = await authResult.client.auth.getUser(token);
      userId = user?.id || null;
    }

    const effectiveCompanyId = companyId || req.headers.get('x-company-id') || null;

    const result = await executeFactoryReset({
      companyId: effectiveCompanyId,
      resetAllCompanies: Boolean(resetAllCompanies),
      confirmationPhrase,
      performedByUserId: userId,
    });

    // تسجيل العملية في سجل المراقبة (Audit Logs)
    try {
      await authResult.client.from('audit_logs').insert({
        table_name: 'system_factory_reset',
        action: 'FACTORY_RESET',
        new_data: {
          clearedCounts: result.clearedCounts,
          totalCleared: result.totalCleared,
          preservedCounts: result.preservedCounts,
          companyId: effectiveCompanyId,
          resetAllCompanies: Boolean(resetAllCompanies),
        },
        changed_by: userId,
        company_id: effectiveCompanyId,
      });
    } catch (auditErr: any) {
      console.warn('[FactoryReset] Non-fatal error recording audit log:', auditErr?.message);
    }

    return NextResponse.json({
      success: true,
      report: result,
    });
  } catch (err: any) {
    console.error('[FactoryReset API Error]:', err);
    return NextResponse.json(
      { error: err?.message || 'حدث خطأ غير متوقع أثناء تنفيذ إعادة ضبط المصنع.' },
      { status: 500 }
    );
  }
}
