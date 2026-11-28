import { supabase } from './supabase';

export async function adminUsersRequest(method: 'GET' | 'POST' | 'PUT' | 'PATCH', body?: unknown) {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) throw new Error('يلزم تسجيل الدخول لإدارة المستخدمين.');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
  };
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }
  return fetch('/api/admin/users', {
    method,
    headers,
    ...(method !== 'GET' && body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
