const COOKIE_EMAIL = 'media_kit_email';
const COOKIE_TOKEN = 'media_kit_token';
const ACCESS_MAX_AGE = 60 * 60 * 24 * 365;

function parseCookies(header) {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((part) => {
      const [key, ...rest] = part.trim().split('=');
      return [key, decodeURIComponent(rest.join('='))];
    }),
  );
}

function sessionSecret(env) {
  return String(env.OUTREACH_SESSION_SECRET || env.MEDIA_KIT_ACCESS_SECRET || 'media-kit-default-secret');
}

async function accessToken(email, env) {
  const data = new TextEncoder().encode(`${sessionSecret(env)}:media-kit:${email.toLowerCase()}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function normalizeSubscriberEmail(email) {
  const value = String(email ?? '')
    .trim()
    .toLowerCase();
  if (!value || !value.includes('@') || !value.includes('.')) {
    throw new Error('A valid email address is required');
  }
  return value;
}

export async function hasMediaKitAccess(request, env) {
  if (!env.OUTREACH_KV) return true;

  const cookies = parseCookies(request.headers.get('Cookie'));
  const email = cookies[COOKIE_EMAIL];
  const token = cookies[COOKIE_TOKEN];
  if (!email || !token) return false;

  try {
    const expected = await accessToken(email, env);
    return token === expected;
  } catch {
    return false;
  }
}

export async function createAccessCookieHeaders(email, env) {
  const normalized = normalizeSubscriberEmail(email);
  const token = await accessToken(normalized, env);
  const secure = 'Secure';
  const base = `Path=/; HttpOnly; ${secure}; SameSite=Lax; Max-Age=${ACCESS_MAX_AGE}`;

  return [
    `${COOKIE_EMAIL}=${encodeURIComponent(normalized)}; ${base}`,
    `${COOKIE_TOKEN}=${token}; ${base}`,
  ];
}

export function accessDeniedResponse() {
  return new Response(JSON.stringify({ error: 'Media kit access required' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}
