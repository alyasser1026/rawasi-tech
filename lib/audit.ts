import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/notify';

export const logCustomAuditEvent = async (
    tableName: string,
    action: string,
    recordId: string | null = null,
    oldData: any = null,
    newData: any = null,
    userId: string | null = null
) => {
    try {
        let finalUserId = userId;
        
        if (!finalUserId) {
            const { data: { user } } = await supabase.auth.getUser();
            finalUserId = user?.id || null;
        }

        if (!finalUserId) {
            console.error('No user found for audit log.');
            return;
        }

        const { error } = await supabase.from('audit_logs').insert({
            table_name: tableName,
            action: action,
            record_id: recordId,
            old_data: oldData,
            new_data: newData,
            changed_by: finalUserId
        });
        
        if (error) {
            console.error('Insert error:', error);
            notify(`خطأ في التسجيل في اللوج: ${error.message}`);
        }
    } catch (error: any) {
        console.error('Failed to log custom audit event:', error);
        notify(`خطأ غير متوقع: ${error.message}`);
    }
};
