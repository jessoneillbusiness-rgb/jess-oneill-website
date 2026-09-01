/**
 * Proxy Instagram CDN images so they load on the site (avoids hotlink blocking).
 */

const ALLOWED_HOSTS = ['cdninstagram.com', 'fbcdn.net'];

function isAllowedInstagramImageUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    return ALLOWED_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export async function onRequestGet(context) {
  const src = new URL(context.request.url).searchParams.get('src');
  if (!src || !isAllowedInstagramImageUrl(src)) {
    return new Response('Invalid image URL', { status: 400 });
  }

  const cache = caches.default;
  const cacheKey = new Request(context.request.url, { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const upstream = await fetch(src, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://www.instagram.com/',
        Accept: 'image/*,*/*;q=0.8',
      },
    });

    if (!upstream.ok) {
      return new Response('Image unavailable', { status: upstream.status });
    }

    const response = new Response(upstream.body, {
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
      },
    });

    await cache.put(cacheKey, response.clone());
    return response;
  } catch {
    return new Response('Image fetch failed', { status: 502 });
  }
}
