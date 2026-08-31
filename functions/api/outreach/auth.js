import { createSessionCookie, json } from '../../lib/outreach-auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.OUTREACH_ADMIN_PASSWORD) {
    return json(
      { error: 'Outreach is not configured. Set OUTREACH_ADMIN_PASSWORD in Cloudflare environment variables.' },
      503,
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const cookie = await createSessionCookie(body.password ?? '', env);
  if (!cookie) {
    return json({ error: 'Invalid password' }, 401);
  }

  return json({ ok: true }, 200, { 'Set-Cookie': cookie });
}

export async function onRequestDelete() {
  return json(
    { ok: true },
    200,
    { 'Set-Cookie': 'outreach_auth=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' },
  );
}
