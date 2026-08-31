const DEFAULT_INTRO =
  "I'm Jess O'Neill, a NYC-based creator focused on travel, food, beauty, and lifestyle with an engaged audience across Instagram, TikTok, Facebook, and my site.";

function formatCompact(value) {
  if (value == null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatList(items) {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function platformSummary(name, platform) {
  const followers = platform?.followers;
  if (!followers) return null;

  const details = [`${formatCompact(followers)} followers`];
  const insights = platform?.insights ?? {};

  if (insights.avgReach) details.push(`${formatCompact(insights.avgReach)} avg. reach/post`);
  if (insights.avgViews) details.push(`${formatCompact(insights.avgViews)} avg. views/video`);
  if (insights.monthlyViews) details.push(`${formatCompact(insights.monthlyViews)} monthly views`);
  if (insights.avgEngagement) details.push(`${insights.avgEngagement}% avg. engagement`);
  if (insights.monthlyReach) details.push(`${formatCompact(insights.monthlyReach)} monthly reach`);
  if (insights.pageViews) details.push(`${formatCompact(insights.pageViews)} page views`);
  if (platform?.totalLikes && !insights.avgViews) {
    details.push(`${formatCompact(platform.totalLikes)} total likes`);
  }

  return `${name} (${details.join(', ')})`;
}

export function buildMetricsIntroParagraph(metrics) {
  const ig = metrics?.platforms?.instagram;
  const tt = metrics?.platforms?.tiktok;
  const fb = metrics?.platforms?.facebook;
  const total = metrics?.totals?.audience;

  const platforms = [
    platformSummary('Instagram', ig),
    platformSummary('TikTok', tt),
    platformSummary('Facebook', fb),
  ].filter(Boolean);

  if (!platforms.length) return DEFAULT_INTRO;

  const totalPhrase = total
    ? `with a combined audience of ${formatCompact(total)}+ across `
    : 'with an audience across ';

  return `I'm Jess O'Neill, a NYC-based lifestyle creator ${totalPhrase}${formatList(platforms)}.`;
}

export { DEFAULT_INTRO };
