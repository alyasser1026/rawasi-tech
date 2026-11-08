"use server";
import { executeFactoryReset, FACTORY_RESET_CONFIRMATION_PHRASE } from '@/lib/factory-reset';
import type { FactoryResetResult } from '@/lib/factory-reset';
import { supabase } from '@/lib/supabase';

export async function requestFactoryResetAction(payload: {
  confirmationPhrase: string;
  companyId?: string | null;
  resetAllCompanies?: boolean;
}): Promise<FactoryResetResult> {
  if (payload.confirmationPhrase !== FACTORY_RESET_CONFIRMATION_PHRASE) {
    throw new Error(`يرجى كتابة عبارة "${FACTORY_RESET_CONFIRMATION_PHRASE}" لتأكيد الحذف.`);
  }

  // التحقق من صلاحيات المستخدم في الخادم
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_admin, is_active')
      .eq('id', user.id)
      .single();

    if (
      profile &&
      (profile.is_active === false || !(profile.is_admin || ['admin', 'super_admin'].includes(profile.role)))
    ) {
      throw new Error('هذه العملية الحساسة تتطلب صلاحية مدير نشط (Admin).');
    }
  }

  return await executeFactoryReset({
    companyId: payload.companyId || null,
    resetAllCompanies: Boolean(payload.resetAllCompanies),
    confirmationPhrase: payload.confirmationPhrase,
    performedByUserId: user?.id || null,
  });
}
