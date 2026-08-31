const COOKIE_NAME = 'media_kit_access';
const ACCESS_MAX_AGE = 60 * 60 * 24 * 365;

function parseCookies(header) {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((part) => {
      const [key, ...rest] = part.trim().split('=');
      return [key, rest.join('=')];
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

function parseAccessCookie(raw) {
  if (!raw) return null;
  const pipeIndex = raw.lastIndexOf('|');
  if (pipeIndex <= 0) return null;

  try {
    const email = decodeURIComponent(raw.slice(0, pipeIndex)).toLowerCase();
    const token = raw.slice(pipeIndex + 1);
    if (!email || !token) return null;
    return { email, token };
  } catch {
    return null;
  }
}

export async function hasMediaKitAccess(request, env) {
  if (!env.OUTREACH_KV) return true;

  const cookies = parseCookies(request.headers.get('Cookie'));
  const parsed = parseAccessCookie(cookies[COOKIE_NAME]);
  if (!parsed) return false;

  try {
    const expected = await accessToken(parsed.email, env);
    return parsed.token === expected;
  } catch {
    return false;
  }
}

export async function createAccessCookieHeader(email, env) {
  const normalized = normalizeSubscriberEmail(email);
  const token = await accessToken(normalized, env);
  const value = `${encodeURIComponent(normalized)}|${token}`;
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ACCESS_MAX_AGE}`;
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
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}
