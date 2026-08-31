/**
 * Media metrics API — auto-updated stats for the public media kit page.
 * Reach/impressions require Meta/TikTok Business API tokens via env vars.
 */

const FACEBOOK_PAGE_ID = '61575124581812';
const INSTAGRAM_USERNAME = 'jess.oneill';
const TIKTOK_USERNAME = 'imjesschillin';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Accept: '*/*',
};

function envNumber(env, key) {
  const value = env[key];
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchInstagram() {
  const urls = [
    `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(INSTAGRAM_USERNAME)}`,
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(INSTAGRAM_USERNAME)}`,
  ];

  const headers = {
    ...BROWSER_HEADERS,
    'X-IG-App-ID': '936619743392459',
    Referer: `https://www.instagram.com/${INSTAGRAM_USERNAME}/`,
    Origin: 'https://www.instagram.com',
  };

  for (const url of urls) {
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) continue;
      const data = await response.json();
      const user = data?.data?.user;
      if (!user) continue;

      return {
        followers: user.edge_followed_by?.count ?? null,
        following: user.edge_follow?.count ?? null,
        posts: user.edge_owner_to_timeline_media?.count ?? null,
        username: user.username ?? INSTAGRAM_USERNAME,
      };
    } catch {
      // try next
    }
  }

  return null;
}

async function fetchTikTok() {
  try {
    const response = await fetch(`https://www.tiktok.com/@${encodeURIComponent(TIKTOK_USERNAME)}`, {
      headers: { ...BROWSER_HEADERS, Accept: 'text/html,application/xhtml+xml' },
    });
    if (!response.ok) return null;

    const html = await response.text();
    const pick = (key) => {
      const match =
        html.match(new RegExp(`"${key}":(\\d+)`)) ??
        html.match(new RegExp(`"${key}":"(\\d+)"`));
      return match ? Number.parseInt(match[1], 10) : null;
    };

    return {
      followers: pick('followerCount'),
      following: pick('followingCount'),
      totalLikes: pick('heartCount') ?? pick('heart'),
      videos: pick('videoCount'),
      username: TIKTOK_USERNAME,
    };
  } catch {
    return null;
  }
}

async function fetchFacebook(env) {
  const token = env.FACEBOOK_ACCESS_TOKEN;
  const pageId = env.FACEBOOK_PAGE_ID || FACEBOOK_PAGE_ID;

  if (token && pageId) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}?fields=followers_count,fan_count&access_token=${token}`,
      );
      if (response.ok) {
        const data = await response.json();
        const followers = data.followers_count ?? data.fan_count ?? null;
        if (followers !== null) {
          return { followers, pageId };
        }
      }
    } catch {
      // fall through
    }
  }

  const manual = envNumber(env, 'FACEBOOK_FOLLOWER_COUNT');
  return manual !== null ? { followers: manual, pageId } : null;
}

export async function onRequestGet(context) {
  const cache = caches.default;
  const cacheKey = new Request(context.request.url, { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const { env } = context;

  const [instagram, tiktok, facebook] = await Promise.all([
    fetchInstagram(),
    fetchTikTok(),
    fetchFacebook(env),
  ]);

  const insights = {
    instagram: {
      avgReach: envNumber(env, 'INSTAGRAM_AVG_REACH'),
      avgEngagement: envNumber(env, 'INSTAGRAM_AVG_ENGAGEMENT_RATE'),
      monthlyViews: envNumber(env, 'INSTAGRAM_MONTHLY_VIEWS'),
    },
    tiktok: {
      avgViews: envNumber(env, 'TIKTOK_AVG_VIEWS'),
      avgEngagement: envNumber(env, 'TIKTOK_AVG_ENGAGEMENT_RATE'),
      monthlyViews: envNumber(env, 'TIKTOK_MONTHLY_VIEWS'),
    },
    facebook: {
      monthlyReach: envNumber(env, 'FACEBOOK_MONTHLY_REACH'),
      pageViews: envNumber(env, 'FACEBOOK_PAGE_VIEWS'),
    },
  };

  const totalAudience =
    (instagram?.followers ?? 0) + (tiktok?.followers ?? 0) + (facebook?.followers ?? 0);

  const body = JSON.stringify({
    updatedAt: new Date().toISOString(),
    platforms: {
      instagram: instagram
        ? { ...instagram, insights: insights.instagram }
        : { insights: insights.instagram },
      tiktok: tiktok ? { ...tiktok, insights: insights.tiktok } : { insights: insights.tiktok },
      facebook: facebook
        ? { ...facebook, insights: insights.facebook }
        : { insights: insights.facebook },
    },
    totals: {
      audience: totalAudience || null,
      tiktokLikes: tiktok?.totalLikes ?? null,
      instagramPosts: instagram?.posts ?? null,
      tiktokVideos: tiktok?.videos ?? null,
    },
  });

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
