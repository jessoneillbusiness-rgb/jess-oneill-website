/**
 * Instagram public profile fetch via GraphQL, mobile web API, HTML scrape, and Graph API.
 */

import { resolveInstagramFollowers } from './social-config.js';

export const INSTAGRAM_USERNAME = 'jess.oneill';
export const INSTAGRAM_USER_ID = '40011571';
export const INSTAGRAM_APP_ID = '936619743392459';

/** PolarisProfilePageContentQuery — current Instagram web GraphQL profile doc. */
const INSTAGRAM_PROFILE_DOC_ID = '27937681195819736';

const FACEBOOK_PAGE_ID = '61575124581812';

const DESKTOP_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

const MOBILE_HEADERS = {
  'User-Agent':
    'Instagram 76.0.0.15.395 Android (24/7.0; 640dpi; 1440x2560; samsung; SM-G930F; herolte; samsungexynos8890; en_US; 138226743)',
  'X-IG-App-ID': INSTAGRAM_APP_ID,
  'X-IG-WWW-Claim': '0',
  'X-Requested-With': 'XMLHttpRequest',
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
};

const HTML_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
};

function withTimeout(promise, timeoutMs, label) {
  if (timeoutMs == null) return promise;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    }),
  ]);
}

export function parseCompactCount(value) {
  const match = String(value ?? '')
    .trim()
    .match(/^([\d.,]+)\s*([KkMm])?$/);
  if (!match) return null;
  const n = Number.parseFloat(match[1].replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  const suffix = (match[2] || '').toLowerCase();
  if (suffix === 'k') return Math.round(n * 1000);
  if (suffix === 'm') return Math.round(n * 1_000_000);
  return Math.round(n);
}

export function mapInstagramUser(user, fallbackUsername = INSTAGRAM_USERNAME) {
  if (!user) return null;

  const followers = user.edge_followed_by?.count ?? user.follower_count ?? null;
  if (followers == null && !user.username && !user.pk && !user.id) return null;

  return {
    followers,
    following: user.edge_follow?.count ?? user.following_count ?? null,
    posts: user.edge_owner_to_timeline_media?.count ?? user.media_count ?? null,
    username: user.username ?? fallbackUsername,
    timeline: user.edge_owner_to_timeline_media?.edges ?? [],
  };
}

export function parseInstagramPayload(data) {
  return mapInstagramUser(data?.data?.user ?? data?.graphql?.user ?? data?.user);
}

export function parseInstagramHtml(html, fallbackUsername = INSTAGRAM_USERNAME) {
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
        username: fallbackUsername,
        timeline: [],
      };
    }
  }

  const compact =
    html.match(/([\d.,]+\s*[KkMm]?)\s+Followers/i) ??
    html.match(/content="([\d.,]+\s*[KkMm]?)\s+Followers/i);
  if (compact) {
    const followers = parseCompactCount(compact[1]);
    if (followers != null) {
      return {
        followers,
        username: fallbackUsername,
        timeline: [],
      };
    }
  }

  return null;
}

export function parseInstagramTimelineFromHtml(html) {
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

export async function fetchInstagramViaGraph(env = {}) {
  const token = env?.FACEBOOK_ACCESS_TOKEN;
  const pageId = env?.FACEBOOK_PAGE_ID || FACEBOOK_PAGE_ID;
  const instagramUserId = env?.INSTAGRAM_USER_ID || INSTAGRAM_USER_ID;
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

async function fetchInstagramViaGraphql(username, env, timeoutMs, debug) {
  const userId = env?.INSTAGRAM_USER_ID || INSTAGRAM_USER_ID;
  if (!userId) return null;

  const query = instagramGraphqlQuery(userId);
  const urls = [
    `https://www.instagram.com/graphql/query?${query}`,
    `https://i.instagram.com/graphql/query?${query}`,
  ];

  const headers = {
    ...DESKTOP_HEADERS,
    'X-IG-App-ID': INSTAGRAM_APP_ID,
    Accept: '*/*',
    Origin: 'https://www.instagram.com',
    Referer: `https://www.instagram.com/${username}/`,
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
  };

  let lastError = null;
  for (const url of urls) {
    try {
      const response = await withTimeout(
        fetch(url, { headers }),
        timeoutMs,
        'Instagram GraphQL profile',
      );
      if (debug) debug.graphqlStatus = response.status;
      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        continue;
      }
      const data = await response.json();
      const profile = mapInstagramUser(data?.data?.user, username);
      if (profile?.followers != null) {
        if (debug) debug.source = 'graphql';
        return profile;
      }
      lastError = 'missing follower_count';
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  if (debug) debug.graphqlError = lastError;

  try {
    const proxied = await fetchInstagramViaJina(username, query, timeoutMs, debug);
    if (proxied?.followers != null) return proxied;
  } catch (error) {
    if (debug) debug.jinaError = error instanceof Error ? error.message : String(error);
  }

  return null;
}

function instagramGraphqlQuery(userId) {
  const variables = {
    id: String(userId),
    render_surface: 'PROFILE',
    __relay_internal__pv__PolarisCannesGuardianExperienceEnabledrelayprovider: true,
    __relay_internal__pv__PolarisCASB976ProfileEnabledrelayprovider: false,
    __relay_internal__pv__PolarisRepostsConsumptionEnabledrelayprovider: false,
    __relay_internal__pv__PolarisWebSchoolsEnabledrelayprovider: false,
    enable_integrity_filters: true,
  };
  return `doc_id=${INSTAGRAM_PROFILE_DOC_ID}&variables=${encodeURIComponent(JSON.stringify(variables))}&server_timestamps=true`;
}

async function fetchInstagramViaJina(username, query, timeoutMs, debug) {
  const target = `https://www.instagram.com/graphql/query?${query}`;
  const response = await withTimeout(
    fetch(`https://r.jina.ai/${target}`, {
      headers: {
        Accept: 'text/plain',
        'User-Agent': DESKTOP_HEADERS['User-Agent'],
      },
    }),
    timeoutMs,
    'Instagram Jina proxy',
  );

  if (debug) debug.jinaStatus = response.status;
  if (!response.ok) return null;

  const text = await response.text();
  const jsonStart = text.indexOf('{"data"');
  if (jsonStart === -1) return null;

  const data = JSON.parse(text.slice(jsonStart));
  const profile = mapInstagramUser(data?.data?.user, username);
  if (profile?.followers != null && debug) debug.source = 'jina-graphql';
  return profile;
}

async function fetchJsonProfile(url, headers, timeoutMs, label) {
  const response = await withTimeout(fetch(url, { headers }), timeoutMs, label);
  if (!response.ok) return null;
  const data = await response.json();
  return parseInstagramPayload(data);
}

export async function fetchInstagramWebProfile(username = INSTAGRAM_USERNAME, options = {}) {
  const timeoutMs = options.timeoutMs ?? 12000;
  const env = options.env ?? {};
  const debug = options.debug ?? null;

  try {
    const graphqlProfile = await fetchInstagramViaGraphql(username, env, timeoutMs, debug);
    if (graphqlProfile?.followers != null) return graphqlProfile;
  } catch (error) {
    if (debug) debug.graphqlError = error instanceof Error ? error.message : String(error);
  }

  const igHeaders = {
    ...MOBILE_HEADERS,
    Referer: `https://www.instagram.com/${username}/`,
    Origin: 'https://www.instagram.com',
  };

  const apiUrls = [
    `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
  ];

  for (const url of apiUrls) {
    try {
      const profile = await fetchJsonProfile(url, igHeaders, timeoutMs, 'Instagram mobile profile');
      if (profile?.followers != null) return profile;
    } catch {
      // try next endpoint
    }
  }

  try {
    const response = await withTimeout(
      fetch(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
        headers: {
          ...HTML_HEADERS,
          Referer: 'https://www.instagram.com/',
        },
      }),
      timeoutMs,
      'Instagram HTML profile',
    );

    if (response.ok) {
      const html = await response.text();
      const fallback = parseInstagramHtml(html, username);
      const timeline = parseInstagramTimelineFromHtml(html);
      if (fallback || timeline.length) {
        return {
          followers: fallback?.followers ?? null,
          username,
          timeline,
        };
      }
    }
  } catch {
    // fall through
  }

  return null;
}

export async function fetchInstagramFollowerCount(username = INSTAGRAM_USERNAME, env = {}, options = {}) {
  const timeoutMs = options.timeoutMs ?? 12000;
  const debug = options.debug ?? null;

  try {
    const graphCount = await fetchInstagramViaGraph(env);
    if (graphCount != null) {
      if (debug) debug.source = 'meta-graph';
      return graphCount;
    }
  } catch (error) {
    if (debug) debug.graphError = error instanceof Error ? error.message : String(error);
  }

  try {
    const profile = await fetchInstagramWebProfile(username, { env, timeoutMs, debug });
    if (profile?.followers != null) return profile.followers;
  } catch (error) {
    if (debug) debug.webError = error instanceof Error ? error.message : String(error);
  }

  if (debug) debug.source = 'fallback';
  return resolveInstagramFollowers(env);
}
