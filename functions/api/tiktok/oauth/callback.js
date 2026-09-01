import { exchangeTikTokCode } from '../../../lib/tiktok-api.js';
import { saveTikTokTokens } from '../../../lib/tiktok-token-store.js';

function parseCookies(header) {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((part) => {
      const [key, ...rest] = part.trim().split('=');
      return [key, rest.join('=')];
    }),
  );
}

function htmlPage(title, body, extraHeaders = {}) {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 560px; margin: 4rem auto; padding: 0 1.5rem; color: #111; line-height: 1.6; }
    h1 { font-size: 1.5rem; margin-bottom: 0.75rem; }
    p { color: #444; }
    .ok { color: #0abab5; }
    .err { color: #b42318; }
  </style>
</head>
<body>${body}</body>
</html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...extraHeaders,
      },
    },
  );
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  if (error) {
    return htmlPage(
      'TikTok connection failed',
      `<h1 class="err">TikTok connection failed</h1><p>${errorDescription || error}</p>`,
    );
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookies = parseCookies(context.request.headers.get('Cookie'));
  const expectedState = cookies.tiktok_oauth_state;

  if (!code || !state || !expectedState || state !== expectedState) {
    return htmlPage(
      'TikTok connection failed',
      '<h1 class="err">Invalid OAuth state</h1><p>Please start again from the TikTok connect link.</p>',
    );
  }

  try {
    const tokens = await exchangeTikTokCode(context.env, code);
    const saved = await saveTikTokTokens(context.env, tokens);

    if (!saved) {
      return htmlPage(
        'TikTok connected — action needed',
        `<h1 class="ok">TikTok authorized</h1>
         <p>Add these to Cloudflare environment variables (encrypted):</p>
         <ul>
           <li><strong>TIKTOK_REFRESH_TOKEN</strong> = your refresh token</li>
           <li><strong>TIKTOK_OPEN_ID</strong> = ${tokens.open_id ?? ''}</li>
         </ul>
         <p>Also ensure <strong>OUTREACH_KV</strong> is bound so tokens refresh automatically next time.</p>`,
      );
    }

    return htmlPage(
      'TikTok connected',
      `<h1 class="ok">TikTok connected</h1>
       <p>Your TikTok account is linked. Media kit stats will now use the TikTok API for followers, views, and engagement.</p>
       <p>You can close this tab.</p>`,
      {
        'Set-Cookie': 'tiktok_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
      },
    );
  } catch (err) {
    return htmlPage(
      'TikTok connection failed',
      `<h1 class="err">TikTok connection failed</h1><p>${err.message || 'Could not save TikTok tokens'}</p>`,
    );
  }
}
