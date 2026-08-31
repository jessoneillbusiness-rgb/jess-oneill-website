function parseCookies(header) {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((part) => {
      const [key, ...rest] = part.trim().split('=');
      return [key, rest.join('=')];
    }),
  );
}

async function hashSession(password, secret) {
  const data = new TextEncoder().encode(`${secret}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createSessionCookie(password, env) {
  const configured = env.OUTREACH_ADMIN_PASSWORD;
  if (!configured || password !== configured) return null;

  const secret = env.OUTREACH_SESSION_SECRET || 'outreach-default-secret';
  const token = await hashSession(password, secret);

  return `outreach_auth=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`;
}

export async function isAuthenticated(request, env) {
  const configured = env.OUTREACH_ADMIN_PASSWORD;
  if (!configured) return false;

  const cookies = parseCookies(request.headers.get('Cookie'));
  const secret = env.OUTREACH_SESSION_SECRET || 'outreach-default-secret';
  const expected = await hashSession(configured, secret);

  return cookies.outreach_auth === expected;
}

export function authError() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}
