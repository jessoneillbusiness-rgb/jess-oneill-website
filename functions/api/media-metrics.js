/**
 * Media metrics API — auto-updated stats for the public media kit page.
 */

import { getMediaMetrics } from '../lib/media-metrics.js';
import { accessDeniedResponse, hasMediaKitAccess } from '../lib/media-kit-access.js';
import { resolveFacebookFollowers } from '../lib/social-config.js';

export async function onRequestGet(context) {
  if (!(await hasMediaKitAccess(context.request, context.env))) {
    return accessDeniedResponse();
  }

  const cache = caches.default;
  const cacheUrl = new URL(context.request.url);
  cacheUrl.searchParams.set('_fb', String(resolveFacebookFollowers(context.env) ?? ''));
  const cacheKey = new Request(cacheUrl, { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const metrics = await getMediaMetrics(context.env);
  const body = JSON.stringify(metrics);

  const response = new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=120',
      'Access-Control-Allow-Origin': '*',
    },
  });

  await cache.put(cacheKey, response.clone());
  return response;
}
