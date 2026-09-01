/**
 * TikTok Display API — user stats and recent video metrics.
 * Requires OAuth once via /api/tiktok/oauth/start (stores tokens in OUTREACH_KV).
 */

import { getTikTokTokens, saveTikTokTokens } from './tiktok-token-store.js';

const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/';
const VIDEO_LIST_URL = 'https://open.tiktokapis.com/v2/video/list/';

const USER_FIELDS = [
  'open_id',
  'username',
  'display_name',
  'is_verified',
  'follower_count',
  'following_count',
  'likes_count',
  'video_count',
].join(',');

const VIDEO_FIELDS = [
  'id',
  'create_time',
  'view_count',
  'like_count',
  'comment_count',
  'share_count',
].join(',');

function requireClientCredentials(env) {
  const clientKey = env.TIKTOK_CLIENT_KEY;
  const clientSecret = env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) return null;
  return { clientKey, clientSecret };
}

function redirectUri(env) {
  return (
    env.TIKTOK_REDIRECT_URI?.trim() ||
    'https://www.jess-oneill.com/api/tiktok/oauth/callback'
  );
}

async function postTokenRequest(body) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: new URLSearchParams(body),
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error_description || data.error || 'TikTok token request failed');
  }

  return data;
}

export async function exchangeTikTokCode(env, code) {
  const credentials = requireClientCredentials(env);
  if (!credentials) {
    throw new Error('TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET must be configured');
  }

  const data = await postTokenRequest({
    client_key: credentials.clientKey,
    client_secret: credentials.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri(env),
  });

  const now = Date.now();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    open_id: data.open_id,
    scope: data.scope,
    expires_at: now + Number(data.expires_in ?? 86400) * 1000,
    refresh_expires_at: now + Number(data.refresh_expires_in ?? 31536000) * 1000,
    updated_at: new Date().toISOString(),
  };
}

export async function refreshTikTokAccessToken(env, refreshToken) {
  const credentials = requireClientCredentials(env);
  if (!credentials) {
    throw new Error('TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET must be configured');
  }

  const data = await postTokenRequest({
    client_key: credentials.clientKey,
    client_secret: credentials.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const now = Date.now();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refreshToken,
    open_id: data.open_id,
    scope: data.scope,
    expires_at: now + Number(data.expires_in ?? 86400) * 1000,
    refresh_expires_at: now + Number(data.refresh_expires_in ?? 31536000) * 1000,
    updated_at: new Date().toISOString(),
  };
}

export async function resolveTikTokAccessToken(env) {
  const stored = await getTikTokTokens(env);
  if (!stored?.refresh_token && !stored?.access_token) return null;

  const now = Date.now();
  if (stored.access_token && stored.expires_at && stored.expires_at > now + 60_000) {
    return stored.access_token;
  }

  if (!stored.refresh_token) return stored.access_token ?? null;

  const refreshed = await refreshTikTokAccessToken(env, stored.refresh_token);
  await saveTikTokTokens(env, { ...stored, ...refreshed });
  return refreshed.access_token;
}

async function parseTikTokResponse(response) {
  const data = await response.json();
  if (!response.ok || (data.error?.code && data.error.code !== 'ok')) {
    throw new Error(data.error?.message || 'TikTok API request failed');
  }
  return data.data ?? {};
}

export async function fetchTikTokUserInfo(accessToken) {
  const url = new URL(USER_INFO_URL);
  url.searchParams.set('fields', USER_FIELDS);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await parseTikTokResponse(response);
  return data.user ?? null;
}

export async function fetchTikTokRecentVideos(accessToken, options = {}) {
  const maxVideos = options.maxVideos ?? 60;
  const pageSize = 20;
  const videos = [];
  let cursor = options.cursor ?? undefined;
  let hasMore = true;

  while (hasMore && videos.length < maxVideos) {
    const url = new URL(VIDEO_LIST_URL);
    url.searchParams.set('fields', VIDEO_FIELDS);

    const body = { max_count: Math.min(pageSize, maxVideos - videos.length) };
    if (cursor) body.cursor = cursor;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await parseTikTokResponse(response);
    videos.push(...(data.videos ?? []));
    cursor = data.cursor;
    hasMore = Boolean(data.has_more);
    if (!data.videos?.length) break;
  }

  return videos;
}

export function buildTikTokAuthorizeUrl(env, state) {
  const clientKey = env.TIKTOK_CLIENT_KEY;
  if (!clientKey) {
    throw new Error('TIKTOK_CLIENT_KEY is not configured');
  }

  const scopes = [
    'user.info.basic',
    'user.info.profile',
    'user.info.stats',
    'video.list',
  ].join(',');

  const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
  url.searchParams.set('client_key', clientKey);
  url.searchParams.set('scope', scopes);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri(env));
  url.searchParams.set('state', state);
  return url.toString();
}

export function isTikTokApiConfigured(env) {
  return Boolean(
    env.TIKTOK_CLIENT_KEY &&
      env.TIKTOK_CLIENT_SECRET &&
      (env.TIKTOK_REFRESH_TOKEN || env.OUTREACH_KV),
  );
}
