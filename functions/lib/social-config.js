/**
 * Manual social stat fallbacks until platform APIs are fully connected.
 * Cloudflare env vars always take priority when set.
 */

/** Set a number here, or use FACEBOOK_FOLLOWER_COUNT in Cloudflare env vars. */
export const FACEBOOK_FOLLOWER_FALLBACK = 20000;

/** Public Instagram count when live GraphQL / Graph API are blocked. */
export const INSTAGRAM_FOLLOWER_FALLBACK = 19900;

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
