import { buildTikTokAuthorizeUrl } from '../../../lib/tiktok-api.js';

function unauthorized() {
  return new Response('Unauthorized', { status: 401 });
}

export async function onRequestGet(context) {
  const setupSecret = context.env.TIKTOK_OAUTH_SETUP_SECRET;
  const provided = new URL(context.request.url).searchParams.get('secret');

  if (!setupSecret || provided !== setupSecret) {
    return unauthorized();
  }

  if (!context.env.TIKTOK_CLIENT_KEY) {
    return new Response('TIKTOK_CLIENT_KEY is not configured in Cloudflare.', { status: 503 });
  }

  const state = crypto.randomUUID();
  const authorizeUrl = buildTikTokAuthorizeUrl(context.env, state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl,
      'Set-Cookie': `tiktok_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}
