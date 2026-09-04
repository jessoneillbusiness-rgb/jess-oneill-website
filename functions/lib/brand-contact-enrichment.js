/**
 * Find likely PR / partnership emails from brand websites (no paid API).
 */

import { findBrandEmailOverride } from './brand-pr-overrides.js';
import { findTargetBrand } from './target-brand-list.js';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const EMAIL_PATTERN =
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.(?:com|co|io|net|org|beauty|us|uk|ca|info|media|agency|group|global|world|studio|shop|store|life|health|wellness|fit|food|drink|beauty|skin|hair|care|beauty|studio|beauty|co\.uk|com\.au)/gi;

const BLOCKED_LOCALS = new Set([
  'example',
  'email',
  'name',
  'youremail',
  'your.email',
  'your',
  'user',
  'firstnamelastname',
  'loremipsum',
  'support',
  'help',
  'customerservice',
  'customer.service',
  'customercare',
  'clientcare',
  'service',
  'cs',
  'compliance',
  'noreply',
  'no-reply',
  'donotreply',
  'privacy',
  'legal',
  'abuse',
  'webmaster',
  'postmaster',
  'sentry',
  'wixpress',
  'shopify',
  'myshopify',
  'orderinformation',
  'pizzainformation',
]);

const BLOCKED_DOMAINS = new Set([
  'stagheaddesigns.com',
  'afterpay.com',
  'example.com',
  'email.com',
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'worldpantry.com',
  'apr-in.com',
  'beautyselection.co',
  'orveonglobal.com',
  'amorepacific.com',
  'sokoglam.com',
  'rarebeautybrands.com',
]);

const PRIORITY_PREFIXES = [
  'press',
  'media',
  'pr',
  'publicrelations',
  'public.relations',
  'partnerships',
  'partners',
  'partner',
  'collab',
  'collabs',
  'influencer',
  'influencers',
  'creator',
  'creators',
  'talent',
  'marketing',
  'brand',
  'communications',
  'comms',
  'affiliate',
  'social',
  'ambassador',
];

const PRESS_PATHS = [
  '/press',
  '/pages/press',
  '/pages/media',
  '/media',
  '/contact',
  '/pages/contact',
  '/partnerships',
  '/pages/partnerships',
  '/collaborations',
  '/pages/collaborations',
  '/influencers',
  '/pages/influencers',
  '/about',
  '/pages/about-us',
];

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    }),
  ]);
}

function normalizeDomain(value) {
  return String(value ?? '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/u003e/gi, '');
}

function cleanEmail(email) {
  return String(email ?? '')
    .toLowerCase()
    .replace(/^mailto:/, '')
    .replace(/u003e/gi, '')
    .trim();
}

function extractEmails(html) {
  const decoded = decodeHtmlEntities(html);
  const mailtos = [...decoded.matchAll(/mailto:([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi)].map(
    (match) => cleanEmail(match[1]),
  );
  const inline = [...decoded.matchAll(EMAIL_PATTERN)].map((match) => cleanEmail(match[0]));
  return [...new Set([...mailtos, ...inline])];
}

function domainMatches(emailDomain, brandDomain) {
  if (emailDomain === brandDomain) return true;
  if (emailDomain.endsWith(`.${brandDomain}`)) return true;
  const brandRoot = brandDomain.split('.').slice(-2).join('.');
  const emailRoot = emailDomain.split('.').slice(-2).join('.');
  return brandRoot === emailRoot;
}

function isUsefulEmail(email, brandDomain) {
  const lower = cleanEmail(email);
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return false;
  if (lower.includes('sentry.io') || lower.includes('wix.com') || lower.includes('shopify.com')) {
    return false;
  }
  const [local, domain] = lower.split('@');
  if (!local || !domain) return false;
  if (BLOCKED_LOCALS.has(local)) return false;
  if (BLOCKED_DOMAINS.has(domain)) return false;
  if (local.includes('privacy') || local.includes('legal')) return false;
  if (!domainMatches(domain, brandDomain) && scoreEmail(lower, brandDomain) < 80) return false;
  return true;
}

function scoreEmail(email, domain) {
  const lower = cleanEmail(email);
  const [local, emailDomain] = lower.split('@');
  let score = 0;

  for (let index = 0; index < PRIORITY_PREFIXES.length; index += 1) {
    const prefix = PRIORITY_PREFIXES[index];
    if (local === prefix || local.startsWith(`${prefix}.`) || local.startsWith(`${prefix}+`)) {
      score += 100 - index;
    }
  }

  if (domainMatches(emailDomain, domain)) score += 40;
  if (local.includes('press') || local.includes('media') || local.includes('partner')) score += 20;
  if (local.includes('influencer') || local.includes('creator') || local.includes('gifting')) score += 15;
  if (local.includes('info') || local.includes('hello') || local.includes('contact')) score += 5;
  if (emailDomain.includes('mailchimp') || emailDomain.includes('klaviyo')) score -= 50;
  if (!domainMatches(emailDomain, domain)) score -= 30;

  return score;
}

async function fetchPage(url, timeoutMs = 5000) {
  const response = await withTimeout(
    fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' }),
    timeoutMs,
    url,
  );
  if (!response.ok) return null;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) return null;
  const html = await response.text();
  return html.slice(0, 500_000);
}

function rankEmails(emails, domain) {
  return [...new Set(emails.map(cleanEmail))]
    .filter((email) => isUsefulEmail(email, domain))
    .map((email) => ({ email, score: scoreEmail(email, domain), source: 'website' }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
}

export async function enrichBrandContacts(domain, options = {}) {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) {
    return { domain: '', emails: [], bestEmail: null, pagesChecked: [], error: 'Invalid domain' };
  }

  const timeoutMs = options.timeoutMs ?? 5000;
  const pagesChecked = [];
  const collected = [];

  const urls = [
    `https://www.${normalizedDomain}`,
    `https://${normalizedDomain}`,
    ...PRESS_PATHS.flatMap((path) => [
      `https://www.${normalizedDomain}${path}`,
      `https://${normalizedDomain}${path}`,
    ]),
  ];

  for (const url of urls) {
    try {
      const html = await fetchPage(url, timeoutMs);
      if (!html) continue;
      pagesChecked.push(url);
      collected.push(...extractEmails(html));
      if (rankEmails(collected, normalizedDomain)[0]?.score >= 100) break;
    } catch {
      // try next URL
    }
  }

  const ranked = rankEmails(collected, normalizedDomain);
  return {
    domain: normalizedDomain,
    emails: ranked,
    bestEmail: ranked[0]?.email ?? null,
    pagesChecked,
  };
}

export async function enrichBrandList(brands, options = {}) {
  const results = [];
  for (const brand of brands) {
    const result = await enrichBrandContacts(brand.domain, options);
    results.push({
      name: brand.name,
      domain: brand.domain,
      category: brand.category ?? '',
      instagramHandle: brand.instagramHandle ?? '',
      ...result,
    });
  }
  return results;
}

const MAX_DISCOVERY_SCRAPES = 8;

/**
 * Attach a PR email to Instagram-discovered brands.
 * Overrides win immediately. Website scrape runs only when a known domain exists.
 */
export async function enrichDiscoveredBrands(brands, options = {}) {
  const maxScrapes = options.maxScrapes ?? MAX_DISCOVERY_SCRAPES;
  const timeoutMs = options.timeoutMs ?? 4000;
  let scrapesUsed = 0;
  const results = [];

  for (const brand of brands) {
    if (brand?.isUnknown) {
      results.push(withDiscoveryEmail(brand));
      continue;
    }

    const target = findTargetBrand(brand.brandName, brand.instagramHandle);
    const override =
      (target && findBrandEmailOverride(target.name, brand.instagramHandle)) ||
      findBrandEmailOverride(brand.brandName, brand.instagramHandle);

    if (override?.email) {
      results.push(
        withDiscoveryEmail(brand, {
          email: override.email,
          emailSource: 'override',
          emailNotes: override.notes ?? '',
          brandName: override.name || target?.name || brand.brandName,
          category: target?.category ?? '',
          domain: target?.domain ?? '',
        }),
      );
      continue;
    }

    if (target?.domain && scrapesUsed < maxScrapes) {
      scrapesUsed += 1;
      try {
        const scraped = await enrichBrandContacts(target.domain, { timeoutMs });
        results.push(
          withDiscoveryEmail(brand, {
            email: scraped.bestEmail ?? '',
            emailSource: scraped.bestEmail ? 'website' : null,
            emailNotes: '',
            brandName: target.name,
            category: target.category ?? '',
            domain: target.domain,
          }),
        );
        continue;
      } catch {
        results.push(
          withDiscoveryEmail(brand, {
            brandName: target.name,
            category: target.category ?? '',
            domain: target.domain,
          }),
        );
        continue;
      }
    }

    results.push(
      withDiscoveryEmail(brand, {
        brandName: target?.name || brand.brandName,
        category: target?.category ?? '',
        domain: target?.domain ?? '',
      }),
    );
  }

  return results;
}

function withDiscoveryEmail(brand, extra = {}) {
  return {
    ...brand,
    brandName: extra.brandName || brand.brandName,
    email: extra.email ?? '',
    emailSource: extra.emailSource ?? null,
    emailNotes: extra.emailNotes ?? '',
    category: extra.category ?? brand.category ?? '',
    domain: extra.domain ?? brand.domain ?? '',
  };
}
