/**
 * Automated Instagram and TikTok metrics from public profile data.
 * Env vars override computed insight values when set.
 */

import {
  fetchTikTokRecentVideos,
  fetchTikTokUserInfo,
  resolveTikTokAccessToken,
} from './tiktok-api.js';
import { getTikTokTokens } from './tiktok-token-store.js';

export const INSTAGRAM_USERNAME = 'jess.oneill';
export const TIKTOK_USERNAME = 'imjesschillin';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Accept: '*/*',
};

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    }),
  ]);
}

function envNumber(env, key) {
  const value = env?.[key];
  if (value === undefined || value === '') return null;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value, digits = 0) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function pickInsight(env, envKey, computed) {
  const fromEnv = envNumber(env, envKey);
  if (fromEnv !== null) return fromEnv;
  return computed ?? null;
}

function parseInstagramHtml(html) {
  const patterns = [
    /"edge_followed_by":\{"count":(\d+)\}/,
    /"follower_count":(\d+)/,
    /"edge_followed_by":\s*\{\s*"count"\s*:\s*(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return {
        followers: Number.parseInt(match[1], 10),
        username: INSTAGRAM_USERNAME,
      };
    }
  }

  return null;
}

function parseInstagramTimelineFromHtml(html) {
  const marker = '"edge_owner_to_timeline_media":';
  const start = html.indexOf(marker);
  if (start === -1) return [];

  const edgesMarker = '"edges":[';
  const edgesStart = html.indexOf(edgesMarker, start);
  if (edgesStart === -1) return [];

  const arrayStart = edgesStart + edgesMarker.length - 1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = arrayStart; index < html.length; index += 1) {
    const char = html[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '[') depth += 1;
    if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        try {
          const edges = JSON.parse(html.slice(arrayStart, index + 1));
          return Array.isArray(edges) ? edges : [];
        } catch {
          return [];
        }
      }
    }
  }

  return [];
}

function mapInstagramUser(user) {
  if (!user) return null;

  return {
    followers: user.edge_followed_by?.count ?? null,
    following: user.edge_follow?.count ?? null,
    posts: user.edge_owner_to_timeline_media?.count ?? null,
    username: user.username ?? INSTAGRAM_USERNAME,
    timeline: user.edge_owner_to_timeline_media?.edges ?? [],
  };
}

/** Map recent Instagram timeline edges to homepage feed items. */
export function mapInstagramFeedItems(timeline = [], limit = 10) {
  const items = [];

  for (const edge of timeline) {
    if (items.length >= limit) break;

    const node = edge?.node;
    const shortcode = node?.shortcode;
    if (!shortcode) continue;

    const imageUrl =
      node.thumbnail_src ??
      node.display_url ??
      node.display_resources?.[node.display_resources.length - 1]?.src ??
      null;

    if (!imageUrl) continue;

    const username = node.owner?.username ?? INSTAGRAM_USERNAME;
    const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text ?? '';

    items.push({
      id: node.id ?? shortcode,
      shortcode,
      url: `https://www.instagram.com/p/${shortcode}/`,
      imageUrl,
      alt: caption.trim() || `Instagram post by @${username}`,
      isVideo: Boolean(node.is_video ?? node.__typename === 'GraphVideo'),
      isCarousel: node.__typename === 'GraphSidecar',
    });
  }

  return items;
}

export function computeInstagramInsights(profile, env = {}) {
  const followers = profile?.followers;
  const posts = profile?.timeline ?? [];
  const nowSec = Date.now() / 1000;
  const thirtyDaysAgo = nowSec - 30 * 86400;

  const engagementRates = [];
  const videoViews = [];
  const postReach = [];
  let monthlyViews = 0;

  for (const edge of posts) {
    const node = edge?.node;
    if (!node) continue;

    const likes = node.edge_liked_by?.count ?? node.edge_media_preview_like?.count ?? 0;
    const comments = node.edge_media_to_comment?.count ?? 0;
    const views = node.video_view_count ?? 0;
    const timestamp = node.taken_at_timestamp ?? 0;

    if (followers) {
      engagementRates.push(((likes + comments) / followers) * 100);
    }

    if (views > 0) {
      videoViews.push(views);
      postReach.push(views);
    } else {
      postReach.push(likes + comments);
    }

    if (timestamp >= thirtyDaysAgo && views > 0) {
      monthlyViews += views;
    }
  }

  const computed = {
    avgReach: round(average(postReach)),
    avgEngagement: round(average(engagementRates), 1),
    monthlyViews: monthlyViews > 0 ? monthlyViews : null,
  };

  return {
    avgReach: pickInsight(env, 'INSTAGRAM_AVG_REACH', computed.avgReach),
    avgEngagement: pickInsight(env, 'INSTAGRAM_AVG_ENGAGEMENT_RATE', computed.avgEngagement),
    monthlyViews: pickInsight(env, 'INSTAGRAM_MONTHLY_VIEWS', computed.monthlyViews),
  };
}

function parseTikTokUniversalData(html) {
  const match = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.+?)<\/script>/,
  );
  if (!match) return null;

  try {
    const data = JSON.parse(match[1]);
    const userDetail = data?.__DEFAULT_SCOPE__?.['webapp.user-detail'];
    const userInfo = userDetail?.userInfo;
    if (!userInfo) return null;

    const stats = userInfo.stats ?? userInfo.statsV2 ?? {};
    const readCount = (key) => {
      const value = stats[key];
      if (value == null || value === '') return null;
      const parsed = Number.parseInt(String(value), 10);
      return Number.isFinite(parsed) ? parsed : null;
    };

    return {
      followers: readCount('followerCount'),
      following: readCount('followingCount'),
      totalLikes: readCount('heartCount') ?? readCount('heart'),
      videos: readCount('videoCount'),
      username: userInfo.user?.uniqueId ?? TIKTOK_USERNAME,
    };
  } catch {
    return null;
  }
}

function parseTikTokHtml(html) {
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
}

export function computeTikTokInsights(profile, env = {}, videos = []) {
  const followers = profile?.followers;

  if (videos.length > 0) {
    const viewCounts = videos.map((video) => video.view_count).filter((value) => value != null);
    const likeCounts = videos.map((video) => video.like_count).filter((value) => value != null);
    const engagementRates = [];
    const nowSec = Date.now() / 1000;
    const thirtyDaysAgo = nowSec - 30 * 86400;
    let monthlyViews = 0;

    for (const video of videos) {
      const createTime = Number(video.create_time ?? 0);
      const views = Number(video.view_count ?? 0);
      const likes = Number(video.like_count ?? 0);
      const comments = Number(video.comment_count ?? 0);
      const shares = Number(video.share_count ?? 0);

      if (createTime >= thirtyDaysAgo) {
        monthlyViews += views;
      }

      if (followers && followers > 0) {
        engagementRates.push(((likes + comments + shares) / followers) * 100);
      }
    }

    const computed = {
      avgViews: round(average(viewCounts)),
      avgLikesPerVideo: round(average(likeCounts)),
      avgEngagement: round(average(engagementRates), 1),
      monthlyViews: monthlyViews > 0 ? monthlyViews : null,
    };

    return {
      avgViews: pickInsight(env, 'TIKTOK_AVG_VIEWS', computed.avgViews),
      avgLikesPerVideo: pickInsight(env, 'TIKTOK_AVG_LIKES_PER_VIDEO', computed.avgLikesPerVideo),
      avgEngagement: pickInsight(env, 'TIKTOK_AVG_ENGAGEMENT_RATE', computed.avgEngagement),
      monthlyViews: pickInsight(env, 'TIKTOK_MONTHLY_VIEWS', computed.monthlyViews),
    };
  }

  const totalLikes = profile?.totalLikes;
  const videosCount = profile?.videos;

  let avgLikesPerVideo = null;
  let avgEngagement = null;

  if (totalLikes != null && videosCount != null && videosCount > 0) {
    avgLikesPerVideo = round(totalLikes / videosCount);
  }

  if (avgLikesPerVideo != null && followers != null && followers > 0) {
    avgEngagement = round((avgLikesPerVideo / followers) * 100, 1);
  }

  return {
    avgViews: pickInsight(env, 'TIKTOK_AVG_VIEWS', null),
    avgLikesPerVideo: pickInsight(env, 'TIKTOK_AVG_LIKES_PER_VIDEO', avgLikesPerVideo),
    avgEngagement: pickInsight(env, 'TIKTOK_AVG_ENGAGEMENT_RATE', avgEngagement),
    monthlyViews: pickInsight(env, 'TIKTOK_MONTHLY_VIEWS', null),
  };
}

const FACEBOOK_PAGE_ID = '61575124581812';

async function fetchInstagramViaGraph(env) {
  const token = env?.FACEBOOK_ACCESS_TOKEN;
  const pageId = env?.FACEBOOK_PAGE_ID || FACEBOOK_PAGE_ID;
  const instagramUserId = env?.INSTAGRAM_USER_ID;
  if (!token) return null;

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

async function fetchInstagramFollowerFallback(env, timeoutMs) {
  const graphFollowers = await fetchInstagramViaGraph(env);
  if (graphFollowers != null) {
    return {
      followers: graphFollowers,
      username: INSTAGRAM_USERNAME,
      timeline: [],
    };
  }

  try {
    const response = await withTimeout(
      fetch(`https://www.instagram.com/${INSTAGRAM_USERNAME}/`, {
        headers: {
          ...BROWSER_HEADERS,
          Accept: 'text/html,application/xhtml+xml',
          Referer: 'https://www.instagram.com/',
        },
      }),
      timeoutMs,
      'Instagram HTML fallback',
    );

    if (response.ok) {
      const html = await response.text();
      const fallback = parseInstagramHtml(html);
      const timeline = parseInstagramTimelineFromHtml(html);
      if (fallback || timeline.length) {
        return {
          followers: fallback?.followers ?? null,
          username: INSTAGRAM_USERNAME,
          timeline,
        };
      }
    }
  } catch {
    // fall through
  }

  return null;
}

export async function fetchInstagramProfile(env = {}, options = {}) {
  const timeoutMs = options.timeoutMs ?? 3500;
  const manualFollowers = envNumber(env, 'INSTAGRAM_FOLLOWER_COUNT');
  const manualPosts = envNumber(env, 'INSTAGRAM_POST_COUNT');

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
      const response = await withTimeout(
        fetch(url, { headers }),
        timeoutMs,
        'Instagram profile',
      );
      if (!response.ok) continue;

      const data = await response.json();
      const profile = mapInstagramUser(data?.data?.user);
      if (!profile) continue;

      if (profile.followers == null && manualFollowers != null) {
        profile.followers = manualFollowers;
      }
      if (profile.posts == null && manualPosts != null) {
        profile.posts = manualPosts;
      }

      return profile;
    } catch {
      // try next endpoint
    }
  }

  const followerFallback = await fetchInstagramFollowerFallback(env, timeoutMs);
  if (followerFallback) {
    return {
      ...followerFallback,
      posts: manualPosts,
    };
  }

  if (manualFollowers != null) {
    return {
      followers: manualFollowers,
      posts: manualPosts,
      username: INSTAGRAM_USERNAME,
      timeline: [],
    };
  }

  return null;
}

async function fetchTikTokProfileFromApi(env, timeoutMs) {
  const tokens = await getTikTokTokens(env);
  if (!tokens?.refresh_token && !tokens?.access_token) return null;
  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) return null;

  try {
    const accessToken = await resolveTikTokAccessToken(env);
    if (!accessToken) return null;

    const [user, recentVideos] = await Promise.all([
      withTimeout(fetchTikTokUserInfo(accessToken), timeoutMs, 'TikTok user info'),
      withTimeout(
        fetchTikTokRecentVideos(accessToken, { maxVideos: 60 }),
        timeoutMs,
        'TikTok video list',
      ),
    ]);

    if (!user) return null;

    return {
      followers: user.follower_count ?? null,
      following: user.following_count ?? null,
      totalLikes: user.likes_count ?? null,
      videos: user.video_count ?? null,
      username: user.username ?? TIKTOK_USERNAME,
      recentVideos,
      source: 'api',
    };
  } catch {
    return null;
  }
}

export async function fetchTikTokProfile(env = {}, options = {}) {
  const timeoutMs = options.timeoutMs ?? 3500;
  const manualFollowers = envNumber(env, 'TIKTOK_FOLLOWER_COUNT');
  const manualLikes = envNumber(env, 'TIKTOK_TOTAL_LIKES');
  const manualVideos = envNumber(env, 'TIKTOK_VIDEO_COUNT');

  const apiProfile = await fetchTikTokProfileFromApi(env, Math.max(timeoutMs, 6000));
  if (apiProfile) {
    return {
      followers: apiProfile.followers ?? manualFollowers,
      following: apiProfile.following ?? null,
      totalLikes: apiProfile.totalLikes ?? manualLikes,
      videos: apiProfile.videos ?? manualVideos,
      username: apiProfile.username ?? TIKTOK_USERNAME,
      recentVideos: apiProfile.recentVideos ?? [],
      source: 'api',
    };
  }

  try {
    const response = await withTimeout(
      fetch(`https://www.tiktok.com/@${encodeURIComponent(TIKTOK_USERNAME)}`, {
        headers: {
          ...BROWSER_HEADERS,
          Accept: 'text/html,application/xhtml+xml',
        },
      }),
      timeoutMs,
      'TikTok profile',
    );

    if (!response.ok) throw new Error('TikTok fetch failed');

    const html = await response.text();
    const parsed = parseTikTokUniversalData(html) ?? parseTikTokHtml(html);

    return {
      followers: parsed.followers ?? manualFollowers,
      following: parsed.following ?? null,
      totalLikes: parsed.totalLikes ?? manualLikes,
      videos: parsed.videos ?? manualVideos,
      username: parsed.username ?? TIKTOK_USERNAME,
      recentVideos: [],
      source: 'scrape',
    };
  } catch {
    if (manualFollowers != null) {
      return {
        followers: manualFollowers,
        totalLikes: manualLikes,
        videos: manualVideos,
        username: TIKTOK_USERNAME,
        recentVideos: [],
        source: 'manual',
      };
    }
    return null;
  }
}
