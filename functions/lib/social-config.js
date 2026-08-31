/**
 * Manual social stat fallbacks until platform APIs are fully connected.
 * Cloudflare env vars always take priority when set.
 */

/** Set a number here, or use FACEBOOK_FOLLOWER_COUNT in Cloudflare env vars. */
export const FACEBOOK_FOLLOWER_FALLBACK = 16000;

export function resolveFacebookFollowers(env = {}) {
  const fromEnv = env.FACEBOOK_FOLLOWER_COUNT;
  if (fromEnv !== undefined && fromEnv !== '') {
    const parsed = Number.parseInt(String(fromEnv), 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }

  if (FACEBOOK_FOLLOWER_FALLBACK !== null && FACEBOOK_FOLLOWER_FALLBACK >= 0) {
    return FACEBOOK_FOLLOWER_FALLBACK;
  }

  return null;
}
