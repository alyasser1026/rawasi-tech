import { supabase } from './supabase';

export async function adminUsersRequest(method: 'POST' | 'PUT' | 'PATCH', body: unknown) {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) throw new Error('يلزم تسجيل الدخول لإدارة المستخدمين.');
  return fetch('/api/admin/users', {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body)
  });
}
