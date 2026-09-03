/**
 * Live social follower counts API (Cloudflare Pages Function)
 * Refreshes from Instagram, TikTok, and Facebook — cached up to 1 hour.
 */

import { fetchInstagramFollowerCount, INSTAGRAM_USERNAME } from '../lib/instagram-api.js';
import { resolveFacebookFollowers } from '../lib/social-config.js';

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

async function fetchTikTok(username) {
  const response = await fetch(`https://www.tiktok.com/@${encodeURIComponent(username)}`, {
    headers: {
      ...BROWSER_HEADERS,
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) return null;

  const html = await response.text();
  const match =
    html.match(/"followerCount":(\d+)/) ?? html.match(/"followerCount":"(\d+)"/);

  return match ? Number.parseInt(match[1], 10) : null;
}

async function fetchFacebook(env) {
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

async function fetchChannelCount(channel, env) {
  try {
    switch (channel.id) {
      case 'instagram':
        return await fetchInstagramFollowerCount(channel.username, env);
      case 'tiktok':
        return await fetchTikTok(channel.username);
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
  cacheUrl.searchParams.set('_cache', 'ig-mobile-v1');
  const cacheKey = new Request(cacheUrl, { method: 'GET' });

  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }

  const results = await Promise.all(
    CHANNELS.map(async (channel) => {
      const count = await fetchChannelCount(channel, context.env);
      return { id: channel.id, name: channel.name, count };
    }),
  );

  const available = results.filter((r) => r.count !== null);
  const total = available.reduce((sum, r) => sum + r.count, 0);
  const allSuccess = results.every((r) => r.count !== null);
  const cacheSeconds = allSuccess ? 3600 : 600;

  const body = JSON.stringify({
    channels: results,
    total,
    updatedAt: new Date().toISOString(),
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
