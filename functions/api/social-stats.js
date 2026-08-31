/**
 * Live social follower counts API (Cloudflare Pages Function)
 * Refreshes from Instagram, TikTok, and Facebook (when configured) — cached 1 hour.
 */

const CHANNELS = [
  { id: 'instagram', name: 'Instagram', username: 'jess.oneill' },
  { id: 'tiktok', name: 'TikTok', username: 'imjesschillin' },
  { id: 'facebook', name: 'Facebook', username: 'Jess-Oneill' },
];

const CACHE_SECONDS = 3600;

async function fetchInstagram(username) {
  const response = await fetch(
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JessONeillSite/1.0)',
        'X-IG-App-ID': '936619743392459',
        Accept: '*/*',
      },
    },
  );

  if (!response.ok) return null;

  const data = await response.json();
  return data?.data?.user?.edge_followed_by?.count ?? null;
}

async function fetchTikTok(username) {
  const response = await fetch(`https://www.tiktok.com/@${encodeURIComponent(username)}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html',
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
  const pageId = env.FACEBOOK_PAGE_ID;

  if (token && pageId) {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}?fields=followers_count,fan_count&access_token=${token}`,
    );
    if (response.ok) {
      const data = await response.json();
      return data.followers_count ?? data.fan_count ?? null;
    }
  }

  const manual = env.FACEBOOK_FOLLOWER_COUNT;
  if (manual) {
    const parsed = Number.parseInt(manual, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

async function fetchChannelCount(channel, env) {
  try {
    switch (channel.id) {
      case 'instagram':
        return await fetchInstagram(channel.username);
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

  const body = JSON.stringify({
    channels: results,
    total,
    updatedAt: new Date().toISOString(),
  });

  const response = new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
      'Access-Control-Allow-Origin': '*',
    },
  });

  await cache.put(cacheKey, response.clone());
  return response;
}
