/**
 * Discover brand partnership leads from Instagram creator profiles (unofficial web API).
 */

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Accept: '*/*',
};

const SPONSOR_PATTERNS = [
  /\#ad\b/i,
  /\#sponsored\b/i,
  /\#gifted\b/i,
  /\#partner\b/i,
  /paid\s+partnership/i,
  /\badvertisement\b/i,
  /\#advert\b/i,
];

const SKIP_USERNAMES = new Set([
  'instagram',
  'facebook',
  'meta',
  'tiktok',
  'youtube',
  'spotify',
  'amazon',
  'pinterest',
  'twitter',
  'x',
]);

const MAX_CREATORS_PER_SCAN = 8;
const MAX_POSTS_PER_CREATOR = 24;

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    }),
  ]);
}

export function normalizeInstagramUsername(value) {
  return String(value ?? '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
}

function mapInstagramUser(user, fallbackUsername) {
  if (!user) return null;

  return {
    username: user.username ?? fallbackUsername,
    fullName: user.full_name ?? '',
    timeline: user.edge_owner_to_timeline_media?.edges ?? [],
  };
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
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
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

export async function fetchCreatorTimeline(username, options = {}) {
  const normalized = normalizeInstagramUsername(username);
  if (!normalized) return null;

  const timeoutMs = options.timeoutMs ?? 5000;
  const apiUrls = [
    `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(normalized)}`,
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(normalized)}`,
  ];

  const headers = {
    ...BROWSER_HEADERS,
    'X-IG-App-ID': '936619743392459',
    Referer: `https://www.instagram.com/${normalized}/`,
    Origin: 'https://www.instagram.com',
  };

  for (const url of apiUrls) {
    try {
      const response = await withTimeout(fetch(url, { headers }), timeoutMs, 'Instagram profile');
      if (!response.ok) continue;

      const data = await response.json();
      const profile = mapInstagramUser(data?.data?.user, normalized);
      if (profile?.timeline?.length) return profile;
    } catch {
      // try next endpoint
    }
  }

  try {
    const response = await withTimeout(
      fetch(`https://www.instagram.com/${encodeURIComponent(normalized)}/`, {
        headers: {
          ...BROWSER_HEADERS,
          Accept: 'text/html,application/xhtml+xml',
          Referer: 'https://www.instagram.com/',
        },
      }),
      timeoutMs,
      'Instagram HTML profile',
    );

    if (!response.ok) return null;

    const html = await response.text();
    const timeline = parseInstagramTimelineFromHtml(html);
    if (!timeline.length) return null;

    return {
      username: normalized,
      fullName: '',
      timeline,
    };
  } catch {
    return null;
  }
}

function captionHasSponsorSignal(caption) {
  return SPONSOR_PATTERNS.some((pattern) => pattern.test(caption));
}

function extractTaggedUsernames(node) {
  return (node?.edge_media_to_tagged_user?.edges ?? [])
    .map((edge) => edge?.node?.user?.username)
    .filter(Boolean)
    .map((value) => normalizeInstagramUsername(value));
}

function extractMentionedUsernames(caption) {
  const matches = caption.match(/@([a-zA-Z0-9._]+)/g) ?? [];
  return matches.map((value) => normalizeInstagramUsername(value.slice(1)));
}

function isLikelyBrand(username, creatorUsername) {
  if (!username || username === creatorUsername) return false;
  if (SKIP_USERNAMES.has(username)) return false;
  return true;
}

function collectPostSignals(node, caption) {
  const signals = [];
  if (captionHasSponsorSignal(caption)) signals.push('sponsored caption');
  if (node?.is_paid_partnership) signals.push('paid partnership label');
  if (node?.commerciality_status === 'paid_partnership') signals.push('paid partnership label');

  const tagged = extractTaggedUsernames(node);
  if (tagged.length) signals.push('brand tagged');

  return { signals, tagged };
}

function formatBrandName(username, fullName) {
  if (fullName?.trim()) return fullName.trim();
  return username
    .replace(/[._]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function analyzeCreatorPosts(profile, maxPosts = MAX_POSTS_PER_CREATOR) {
  const creatorUsername = normalizeInstagramUsername(profile.username);
  const brandMap = new Map();

  for (const edge of profile.timeline.slice(0, maxPosts)) {
    const node = edge?.node;
    const shortcode = node?.shortcode;
    if (!shortcode) continue;

    const caption = node?.edge_media_to_caption?.edges?.[0]?.node?.text ?? '';
    const { signals, tagged } = collectPostSignals(node, caption);
    const isSponsored =
      captionHasSponsorSignal(caption) ||
      node?.is_paid_partnership ||
      node?.commerciality_status === 'paid_partnership';

    if (!isSponsored) continue;

    const brandUsernames = new Set([
      ...tagged,
      ...extractMentionedUsernames(caption),
    ]);

    const candidates = [...brandUsernames].filter((username) =>
      isLikelyBrand(username, creatorUsername),
    );

    if (!candidates.length) {
      const key = `unknown:${creatorUsername}:${shortcode}`;
      brandMap.set(key, {
        brandUsername: '',
        brandName: 'Unknown brand',
        brandUrl: '',
        instagramHandle: '',
        creators: [
          {
            username: creatorUsername,
            postUrl: `https://www.instagram.com/p/${shortcode}/`,
            captionSnippet: caption.slice(0, 180),
            signals,
          },
        ],
        postCount: 1,
        isUnknown: true,
      });
      continue;
    }

    for (const brandUsername of candidates) {
      const key = brandUsername;
      const existing = brandMap.get(key) ?? {
        brandUsername,
        brandName: formatBrandName(brandUsername),
        brandUrl: `https://www.instagram.com/${brandUsername}/`,
        instagramHandle: brandUsername,
        creators: [],
        postCount: 0,
        isUnknown: false,
      };

      existing.creators.push({
        username: creatorUsername,
        postUrl: `https://www.instagram.com/p/${shortcode}/`,
        captionSnippet: caption.slice(0, 180),
        signals,
      });
      existing.postCount += 1;
      brandMap.set(key, existing);
    }
  }

  return [...brandMap.values()];
}

export async function discoverBrandsFromCreators(usernames, options = {}) {
  const normalized = [...new Set(usernames.map(normalizeInstagramUsername).filter(Boolean))].slice(
    0,
    MAX_CREATORS_PER_SCAN,
  );

  const brandMap = new Map();
  const creatorResults = [];

  for (const creatorUsername of normalized) {
    const profile = await fetchCreatorTimeline(creatorUsername, options);
    if (!profile) {
      creatorResults.push({
        username: creatorUsername,
        ok: false,
        error: 'Could not fetch profile (private, rate-limited, or unavailable)',
      });
      continue;
    }

    const brands = analyzeCreatorPosts(profile, options.maxPosts ?? MAX_POSTS_PER_CREATOR);
    creatorResults.push({
      username: creatorUsername,
      ok: true,
      sponsoredPosts: brands.reduce((sum, brand) => sum + brand.postCount, 0),
      brandsFound: brands.filter((brand) => !brand.isUnknown).length,
    });

    for (const brand of brands) {
      const key = brand.brandUsername || brand.creators[0]?.postUrl;
      const existing = brandMap.get(key);
      if (!existing) {
        brandMap.set(key, brand);
        continue;
      }

      existing.creators.push(...brand.creators);
      existing.postCount += brand.postCount;
    }
  }

  const brands = [...brandMap.values()].sort((a, b) => b.postCount - a.postCount);

  return {
    brands,
    creators: creatorResults,
    scannedCount: normalized.length,
    brandCount: brands.filter((brand) => !brand.isUnknown).length,
    updatedAt: new Date().toISOString(),
  };
}

export function brandLeadToContact(brand) {
  const primary = brand.creators[0];
  const creatorList = [...new Set(brand.creators.map((item) => `@${item.username}`))].join(', ');
  const postLinks = brand.creators
    .slice(0, 3)
    .map((item) => item.postUrl)
    .join('\n');

  const notes = [
    brand.instagramHandle ? `Instagram: https://www.instagram.com/${brand.instagramHandle}/` : '',
    `Seen in sponsored posts from ${creatorList}.`,
    primary?.captionSnippet ? `Caption: ${primary.captionSnippet}` : '',
    postLinks ? `Posts:\n${postLinks}` : '',
    'PR email not found yet — add manually when ready.',
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    name: '',
    email: '',
    company: brand.brandName || formatBrandName(brand.brandUsername),
    role: 'PR / Partnerships',
    category: '',
    notes,
    instagramHandle: brand.instagramHandle,
    isLead: true,
    source: 'instagram-discovery',
  };
}
