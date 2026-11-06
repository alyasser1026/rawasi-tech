const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nonAdminRoles = new Set(['manager', 'staff', 'contractor', 'client']);
const refreshBeforeExpirySeconds = 60;

function jwtRole(token) {
  if (typeof token !== 'string' || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) return null;
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).role;
  } catch {
    return null;
  }
}

function isSupabaseOrigin(value) {
  try {
    const url = new URL(value);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return (url.protocol === 'https:' || (url.protocol === 'http:' && loopback)) &&
      !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
  } catch {
    return false;
  }
}

function validSession(session) {
  return jwtRole(session?.access_token) === 'authenticated' &&
    typeof session?.refresh_token === 'string' && session.refresh_token.length > 0 &&
    Number.isFinite(session?.expires_at) && session.expires_at > Date.now() / 1000;
}

/** Keeps the bot's dedicated user's Auth session in memory. Authorization is checked anew per request. */
export function createCopilotCompanyAccess({ supabaseUrl, publicKey, email, password, companyId, createClient, fetchImpl = fetch } = {}) {
  const company = typeof companyId === 'string' ? companyId.trim().toLowerCase() : '';
  const key = typeof publicKey === 'string' ? publicKey.trim() : '';
  const login = typeof email === 'string' ? email.trim() : '';
  if (!isSupabaseOrigin(supabaseUrl) || !UUID.test(company) || !/^\S+@\S+$/.test(login) ||
    typeof password !== 'string' || !password.trim() || typeof createClient !== 'function' ||
    (!/^sb_publishable_[\w-]+$/.test(key) && jwtRole(key) !== 'anon')) {
    return async () => null;
  }

  let client;
  let session;
  let pending;

  const fetchScoped = (input, init = {}) => {
    const timeout = AbortSignal.timeout(12000);
    return fetchImpl(input, { ...init, redirect: 'error', signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
  };

  async function verify() {
    try {
      client ??= createClient(supabaseUrl, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { 'x-company-id': company }, fetch: fetchScoped },
      });

      if (!session || session.expires_at <= Date.now() / 1000 + refreshBeforeExpirySeconds) {
        const { data, error } = session
          ? await client.auth.refreshSession({ refresh_token: session.refresh_token })
          : await client.auth.signInWithPassword({ email: login, password });
        session = !error && validSession(data?.session) ? data.session : undefined;
        if (!session) return null;
      }

      const accessToken = session.access_token;
      const { data, error } = await client.auth.getUser(accessToken);
      const user = data?.user;
      if (error || user?.role !== 'authenticated' || !UUID.test(user.id) || session.user?.id !== user.id) {
        session = undefined;
        return null;
      }

      const profileResult = await client.from('profiles').select('id,role,is_active,is_admin,permissions')
        .eq('id', user.id).single();
      const profile = profileResult.data;
      if (profileResult.error || profile?.id !== user.id || profile.is_active !== true ||
        profile.is_admin !== false || !nonAdminRoles.has(profile.role)) return null;

      const memberships = await client.rpc('get_user_accessible_companies');
      if (memberships.error || !Array.isArray(memberships.data)) return null;
      const membership = memberships.data.find(membership =>
        membership?.id === company && membership.is_active === true && membership.role === 'member'
      );
      if (!membership) return null;

      const permissions = profile.permissions && typeof profile.permissions === 'object' && !Array.isArray(profile.permissions)
        ? profile.permissions : {};
      return {
        accessToken, companyId: company, userId: user.id, permissions,
        ...(typeof membership.name === 'string' && { companyName: membership.name }),
      };
    } catch {
      session = undefined;
      return null;
    }
  }

  return async function resolveCompanyAccess() {
    // Avoid refreshing the same in-memory session twice if requests overlap.
    pending ??= verify().finally(() => { pending = undefined; });
    return pending;
  };
}
