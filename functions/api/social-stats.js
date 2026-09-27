/**
 * Live social follower counts API (Cloudflare Pages Function)
 * Refreshes from Instagram, TikTok, and Facebook.
 * FACEBOOK_FOLLOWER_COUNT bypasses this cache when it changes.
 */

import { fetchInstagramFollowerCount, INSTAGRAM_USERNAME } from '../lib/instagram-api.js';
import {
  hasFacebookFollowerOverride,
  resolveFacebookFollowers,
  resolveInstagramFollowers,
  resolveTikTokFollowers,
} from '../lib/social-config.js';

const FACEBOOK_PAGE_ID = '61575124581812';

const CHANNELS = [
  { id: 'instagram', name: 'Instagram', username: INSTAGRAM_USERNAME },
  { id: 'tiktok', name: 'TikTok', username: 'imjesschillin' },
  { id: 'facebook', name: 'Facebook' },
];

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Accept: '*/*',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
};

async function fetchTikTok(username, env, meta) {
  try {
    const response = await fetch(`https://www.tiktok.com/@${encodeURIComponent(username)}`, {
      headers: {
        ...BROWSER_HEADERS,
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (response.ok) {
      const html = await response.text();
      const match =
        html.match(/"followerCount":(\d+)/) ?? html.match(/"followerCount":"(\d+)"/);
      if (match) {
        if (meta) meta.fallback = false;
        return Number.parseInt(match[1], 10);
      }
    }
  } catch {
    // use the backup count
  }

  if (meta) meta.fallback = true;
  return resolveTikTokFollowers(env);
}

async function fetchFacebook(env) {
  if (hasFacebookFollowerOverride(env)) {
    return resolveFacebookFollowers(env);
  }

  const token = env.FACEBOOK_ACCESS_TOKEN;
  const pageId = env.FACEBOOK_PAGE_ID || FACEBOOK_PAGE_ID;

  if (token && pageId) {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}?fields=followers_count,fan_count&access_token=${token}`,
    );
    if (response.ok) {
      const data = await response.json();
      const count = data.followers_count ?? data.fan_count ?? null;
      if (count !== null) return count;
    }
  }

  const manual = resolveFacebookFollowers(env);
  if (manual !== null) return manual;

  return null;
}

async function fetchChannelCount(channel, env, options = {}) {
  try {
    switch (channel.id) {
      case 'instagram':
        return await fetchInstagramFollowerCount(channel.username, env, options);
      case 'tiktok':
        return await fetchTikTok(channel.username, env, options.meta);
      case 'facebook':
        return await fetchFacebook(env);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export async function onRequestGet(context) {
  const cache = caches.default;
  const cacheUrl = new URL(context.request.url);
  const instagramFallback = resolveInstagramFollowers(context.env);
  const tiktokFallback = resolveTikTokFollowers(context.env);
  cacheUrl.searchParams.set('_cache', 'followers-v8');
  cacheUrl.searchParams.set('_fb', String(resolveFacebookFollowers(context.env) ?? ''));
  cacheUrl.searchParams.set('_ig', String(instagramFallback ?? ''));
  cacheUrl.searchParams.set('_tt', String(tiktokFallback ?? ''));
  const cacheKey = new Request(cacheUrl, { method: 'GET' });
  const debugEnabled = cacheUrl.searchParams.get('debug') === '1';
  const instagramDebug = {};
  const tiktokMeta = { fallback: false };

  const cached = await cache.match(cacheKey);
  if (cached && !debugEnabled) {
    return cached;
  }

  const results = await Promise.all(
    CHANNELS.map(async (channel) => {
      const count = await fetchChannelCount(channel, context.env, {
        timeoutMs: 12000,
        debug: channel.id === 'instagram' ? instagramDebug : null,
        meta: channel.id === 'tiktok' ? tiktokMeta : null,
      });
      return { id: channel.id, name: channel.name, count };
    }),
  );

  const available = results.filter((r) => r.count !== null);
  const total = available.reduce((sum, r) => sum + r.count, 0);
  const allSuccess = results.every((r) => r.count !== null);
  const usedFallback = instagramDebug.source === 'fallback' || tiktokMeta.fallback;
  const cacheSeconds = allSuccess && !usedFallback ? 3600 : 60;

  const body = JSON.stringify({
    channels: results,
    total,
    updatedAt: new Date().toISOString(),
    ...(debugEnabled ? { instagramDebug } : {}),
  });

  const response = new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${cacheSeconds}`,
      'Access-Control-Allow-Origin': '*',
    },
  });

  await cache.put(cacheKey, response.clone());
  return response;
}
