const TOKEN_KEY = 'tiktok:tokens';

function requireKv(env) {
  return env.OUTREACH_KV ?? null;
}

async function readJson(kv, key, fallback) {
  const raw = await kv.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function getTikTokTokens(env) {
  const kv = requireKv(env);
  if (kv) {
    const stored = await readJson(kv, TOKEN_KEY, null);
    if (stored?.refresh_token) return stored;
  }

  const refreshToken = env.TIKTOK_REFRESH_TOKEN;
  if (!refreshToken) return null;

  return {
    refresh_token: refreshToken,
    access_token: env.TIKTOK_ACCESS_TOKEN ?? null,
    expires_at: env.TIKTOK_ACCESS_TOKEN_EXPIRES_AT
      ? Number.parseInt(env.TIKTOK_ACCESS_TOKEN_EXPIRES_AT, 10)
      : 0,
    open_id: env.TIKTOK_OPEN_ID ?? null,
  };
}

export async function saveTikTokTokens(env, tokens) {
  const kv = requireKv(env);
  if (!kv) return false;

  await kv.put(TOKEN_KEY, JSON.stringify(tokens));
  return true;
}
