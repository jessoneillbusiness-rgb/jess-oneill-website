/**
 * Recent Instagram posts for homepage grid (unofficial web API).
 * Cached up to 1 hour when successful, 10 minutes on partial failure.
 */

import {
  fetchInstagramProfile,
  mapInstagramFeedItems,
  INSTAGRAM_USERNAME,
} from '../lib/platform-metrics.js';

const FEED_LIMIT = 10;

function proxyImageUrl(imageUrl) {
  return `/api/instagram-image?src=${encodeURIComponent(imageUrl)}`;
}

export async function onRequestGet(context) {
  const cache = caches.default;
  const cacheKey = new Request(context.request.url, { method: 'GET' });

  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }

  const profile = await fetchInstagramProfile(context.env, { timeoutMs: 5000 });
  const posts = mapInstagramFeedItems(profile?.timeline ?? [], FEED_LIMIT).map((post) => ({
    ...post,
    imageUrl: proxyImageUrl(post.imageUrl),
  }));
  const cacheSeconds = posts.length > 0 ? 3600 : 600;

  const body = JSON.stringify({
    username: profile?.username ?? INSTAGRAM_USERNAME,
    profileUrl: `https://www.instagram.com/${profile?.username ?? INSTAGRAM_USERNAME}/`,
    posts,
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
