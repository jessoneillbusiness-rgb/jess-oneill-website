import {
  createAccessCookieHeaders,
  hasMediaKitAccess,
  json,
  normalizeSubscriberEmail,
} from '../../lib/media-kit-access.js';
import { addMediaKitSubscriber } from '../../lib/subscriber-store.js';

export async function onRequestGet(context) {
  const hasAccess = await hasMediaKitAccess(context.request, context.env);
  return json({
    hasAccess,
    kvConfigured: Boolean(context.env.OUTREACH_KV),
  });
}

export async function onRequestPost(context) {
  if (!context.env.OUTREACH_KV) {
    return json(
      {
        error:
          'Media kit access is not configured yet. Add OUTREACH_KV in Cloudflare Pages settings.',
      },
      503,
    );
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  try {
    const email = normalizeSubscriberEmail(body.email);
    const subscriber = await addMediaKitSubscriber(context.env, {
      email,
      name: body.name,
      company: body.company,
      newsletter: body.newsletter === true,
    });

    const cookies = await createAccessCookieHeaders(email, context.env);
    const headers = new Headers({ 'Content-Type': 'application/json' });
    for (const cookie of cookies) {
      headers.append('Set-Cookie', cookie);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        hasAccess: true,
        subscriber: {
          email: subscriber.email,
          newsletter: subscriber.newsletter,
        },
      }),
      { status: 200, headers },
    );
  } catch (error) {
    return json({ error: error.message || 'Could not grant access' }, 400);
  }
}
