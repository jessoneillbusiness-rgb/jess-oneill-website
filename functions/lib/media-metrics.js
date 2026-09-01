/**
 * Shared media metrics fetcher for the media kit page and outreach drafts.
 * Instagram and TikTok stats are fetched and computed automatically.
 * Facebook uses manual fallback until Meta API access is available.
 */

import { resolveFacebookFollowers } from './social-config.js';
import {
  computeInstagramInsights,
  computeTikTokInsights,
  fetchInstagramProfile,
  fetchTikTokProfile,
} from './platform-metrics.js';

const FACEBOOK_PAGE_ID = '61575124581812';

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    }),
  ]);
}

async function fetchFacebook(env) {
  const token = env?.FACEBOOK_ACCESS_TOKEN;
  const pageId = env?.FACEBOOK_PAGE_ID || FACEBOOK_PAGE_ID;

  if (token && pageId) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}?fields=followers_count,fan_count&access_token=${token}`,
      );
      if (response.ok) {
        const data = await response.json();
        const followers = data.followers_count ?? data.fan_count ?? null;
        if (followers !== null) {
          return { followers, automated: true };
        }
      }
    } catch {
      // fall through
    }
  }

  const manual = resolveFacebookFollowers(env);
  return manual !== null
    ? { followers: manual, automated: false }
    : null;
}

export async function getMediaMetrics(env = {}, options = {}) {
  const timeoutMs = options.timeoutMs ?? 8000;
  const includeFacebookInTotal = options.includeFacebookInTotal ?? false;
  const fetchTimeout = Math.min(timeoutMs - 1000, 5000);

  const metricsPromise = (async () => {
    const [instagramProfile, tiktokProfile, facebook] = await Promise.all([
      fetchInstagramProfile(env, { timeoutMs: fetchTimeout }),
      fetchTikTokProfile(env, { timeoutMs: fetchTimeout }),
      fetchFacebook(env),
    ]);

    const instagramInsights = instagramProfile
      ? computeInstagramInsights(instagramProfile, env)
      : computeInstagramInsights(null, env);
    const tiktokInsights = tiktokProfile
      ? computeTikTokInsights(tiktokProfile, env)
      : computeTikTokInsights(null, env);

    const instagramFollowers = instagramProfile?.followers ?? null;
    const tiktokFollowers = tiktokProfile?.followers ?? null;
    const facebookFollowers = facebook?.followers ?? null;

    const automatedAudience = (instagramFollowers ?? 0) + (tiktokFollowers ?? 0);
    const totalAudience = includeFacebookInTotal
      ? automatedAudience + (facebookFollowers ?? 0)
      : automatedAudience;

    return {
      updatedAt: new Date().toISOString(),
      platforms: {
        instagram: instagramProfile
          ? { ...instagramProfile, timeline: undefined, insights: instagramInsights }
          : { insights: instagramInsights },
        tiktok: tiktokProfile
          ? { ...tiktokProfile, insights: tiktokInsights }
          : { insights: tiktokInsights },
        facebook: facebook
          ? {
              followers: facebook.followers,
              automated: facebook.automated,
            }
          : null,
      },
      totals: {
        audience: totalAudience || null,
        automatedAudience: automatedAudience || null,
        tiktokLikes: tiktokProfile?.totalLikes ?? null,
        instagramPosts: instagramProfile?.posts ?? null,
        tiktokVideos: tiktokProfile?.videos ?? null,
      },
    };
  })();

  return withTimeout(metricsPromise, timeoutMs, 'Media metrics');
}
