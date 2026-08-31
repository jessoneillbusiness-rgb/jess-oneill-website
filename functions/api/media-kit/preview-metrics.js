import { getMediaMetrics } from '../../lib/media-metrics.js';
import { json } from '../../lib/media-kit-access.js';

function compact(value) {
  if (value == null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function pickPlatform(platform) {
  if (!platform) return null;
  const insights = platform.insights ?? {};

  return {
    followers: platform.followers ?? null,
    followersLabel: compact(platform.followers),
    totalLikes: platform.totalLikes ?? null,
    totalLikesLabel: compact(platform.totalLikes),
    avgViews: insights.avgViews ?? null,
    avgViewsLabel: compact(insights.avgViews),
    avgReach: insights.avgReach ?? null,
    avgReachLabel: compact(insights.avgReach),
    monthlyViews: insights.monthlyViews ?? null,
    monthlyViewsLabel: compact(insights.monthlyViews),
  };
}

export async function onRequestGet(context) {
  try {
    const metrics = await getMediaMetrics(context.env, { timeoutMs: 5000 });

    return json({
      totalAudience: metrics.totals?.audience ?? null,
      totalAudienceLabel: compact(metrics.totals?.audience),
      tiktokLikes: metrics.totals?.tiktokLikes ?? null,
      tiktokLikesLabel: compact(metrics.totals?.tiktokLikes),
      platforms: {
        instagram: pickPlatform(metrics.platforms?.instagram),
        tiktok: pickPlatform(metrics.platforms?.tiktok),
        facebook: pickPlatform(metrics.platforms?.facebook),
      },
    });
  } catch {
    return json({
      totalAudience: null,
      totalAudienceLabel: null,
      tiktokLikes: null,
      tiktokLikesLabel: null,
      platforms: {
        instagram: null,
        tiktok: null,
        facebook: null,
      },
    });
  }
}
