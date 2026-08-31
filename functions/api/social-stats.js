/**
 * Live social follower counts API (Cloudflare Pages Function)
 * Refreshes from Instagram, TikTok, and Facebook — cached up to 1 hour.
 */

import { resolveFacebookFollowers } from '../lib/social-config.js';

const FACEBOOK_PAGE_ID = '61575124581812';
const INSTAGRAM_USERNAME = 'jess.oneill';

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

function parseInstagramPayload(data) {
  const user = data?.data?.user;
  if (!user) return null;
  return user.edge_followed_by?.count ?? user.follower_count ?? null;
}

function parseInstagramHtml(html) {
  const patterns = [
    /"edge_followed_by":\{"count":(\d+)\}/,
    /"follower_count":(\d+)/,
    /"edge_followed_by":\s*\{\s*"count"\s*:\s*(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return Number.parseInt(match[1], 10);
  }

  return null;
}

async function fetchInstagramViaGraph(token, pageId, instagramUserId) {
  if (instagramUserId) {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${instagramUserId}?fields=followers_count&access_token=${token}`,
    );
    if (response.ok) {
      const data = await response.json();
      if (data.followers_count != null) return data.followers_count;
    }
  }

  if (pageId) {
    const pageResponse = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account&access_token=${token}`,
    );
    if (pageResponse.ok) {
      const pageData = await pageResponse.json();
      const igId = pageData.instagram_business_account?.id;
      if (igId) {
        const igResponse = await fetch(
          `https://graph.facebook.com/v21.0/${igId}?fields=followers_count&access_token=${token}`,
        );
        if (igResponse.ok) {
          const igData = await igResponse.json();
          return igData.followers_count ?? null;
        }
      }
    }
  }

  return null;
}

async function fetchInstagram(username, env) {
  const token = env.FACEBOOK_ACCESS_TOKEN;
  const pageId = env.FACEBOOK_PAGE_ID || FACEBOOK_PAGE_ID;
  const instagramUserId = env.INSTAGRAM_USER_ID;

  if (token) {
    const graphCount = await fetchInstagramViaGraph(token, pageId, instagramUserId);
    if (graphCount !== null) return graphCount;
  }

  const igHeaders = {
    ...BROWSER_HEADERS,
    'X-IG-App-ID': '936619743392459',
    Referer: `https://www.instagram.com/${username}/`,
    Origin: 'https://www.instagram.com',
  };

  const apiUrls = [
    `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
  ];

  for (const url of apiUrls) {
    try {
      const response = await fetch(url, { headers: igHeaders });
      if (!response.ok) continue;

      const data = await response.json();
      const count = parseInstagramPayload(data);
      if (count !== null) return count;
    } catch {
      // try next endpoint
    }
  }

  try {
    const response = await fetch(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
      headers: {
        ...BROWSER_HEADERS,
        Accept: 'text/html,application/xhtml+xml',
        Referer: 'https://www.instagram.com/',
      },
    });

    if (response.ok) {
      const html = await response.text();
      const count = parseInstagramHtml(html);
      if (count !== null) return count;
    }
  } catch {
    // fall through
  }

  return null;
}

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
        return await fetchInstagram(channel.username, env);
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
  const cacheKey = new Request(context.request.url, { method: 'GET' });

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
