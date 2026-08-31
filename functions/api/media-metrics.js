/**
 * Media metrics API — auto-updated stats for the public media kit page.
 */

import { getMediaMetrics } from '../../lib/media-metrics.js';

export async function onRequestGet(context) {
  const cache = caches.default;
  const cacheKey = new Request(context.request.url, { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const metrics = await getMediaMetrics(context.env);
  const body = JSON.stringify(metrics);

  const response = new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });

  await cache.put(cacheKey, response.clone());
  return response;
}
