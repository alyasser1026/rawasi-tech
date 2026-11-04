"use client";
import { useToast } from '@/lib/toast-context'; 
import { processExcelInBackend } from './restore_action'; // 👈 السر هنا: بننادي على الباك إند

export function useRestoreLogic() {
  const { showToast } = useToast();

  const processExcelRestore = async (file: File): Promise<any> => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      // هنا المتصفح بيبطل تفكير ويرمي الملف للسيرفر (restore_action.ts) يعالجه براحته
      const result = await processExcelInBackend(formData);

      if (result.success) {
        showToast(`تم استيراد ${result.total} سجل بنجاح عبر السيرفر`, 'success');
        return { success: true };
      } else {
        showToast(result.error || "فشل الاستيراد في السيرفر", 'error');
        return { success: false, message: result.error };
      }

    } catch (error: any) {
      const msg = error.message || "حدث خطأ في الاتصال بالباك إند";
      showToast(msg, 'error');
      return { success: false, message: msg };
    }
  };

  const processJSONRestore = async (file: File): Promise<any> => {
       showToast("ميزة استعادة JSON جاري تحديثها", 'warning');
       return { success: false, message: "ميزة استعادة JSON جاري تحديثها" };
  };

  return { processExcelRestore, processJSONRestore };
}