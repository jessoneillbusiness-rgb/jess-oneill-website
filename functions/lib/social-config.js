/**
 * Backup follower counts when a live lookup fails.
 * Instagram and TikTok use a live count whenever one can be fetched.
 * These numbers, or the matching Cloudflare env vars, are the backup.
 * Facebook uses FACEBOOK_FOLLOWER_COUNT first when that variable is set.
 */

/** Set a number here, or use FACEBOOK_FOLLOWER_COUNT in Cloudflare env vars. */
export const FACEBOOK_FOLLOWER_FALLBACK = 20000;

/** Last live Instagram count. Used only when GraphQL / Graph API are blocked. */
export const INSTAGRAM_FOLLOWER_FALLBACK = 25044;

/** Last live TikTok count. Used only when the profile lookup fails. */
export const TIKTOK_FOLLOWER_FALLBACK = 81100;

function resolveCount(fromEnv, fallback) {
  if (fromEnv !== undefined && fromEnv !== '') {
    const parsed = Number.parseInt(String(fromEnv), 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }

  if (fallback !== null && fallback >= 0) {
    return fallback;
  }

  return null;
}

export function hasFacebookFollowerOverride(env = {}) {
  const fromEnv = env?.FACEBOOK_FOLLOWER_COUNT;
  return fromEnv !== undefined && fromEnv !== null && String(fromEnv).trim() !== '';
}

export function resolveFacebookFollowers(env = {}) {
  return resolveCount(env.FACEBOOK_FOLLOWER_COUNT, FACEBOOK_FOLLOWER_FALLBACK);
}

export function resolveInstagramFollowers(env = {}) {
  return resolveCount(env.INSTAGRAM_FOLLOWER_COUNT, INSTAGRAM_FOLLOWER_FALLBACK);
}

export function resolveTikTokFollowers(env = {}) {
  return resolveCount(env.TIKTOK_FOLLOWER_COUNT, TIKTOK_FOLLOWER_FALLBACK);
}
