import assert from 'node:assert/strict';
import { test } from 'node:test';
import { domainSlug, slugifyBrand, slugsLooselyMatch } from './brand-match.js';
import { findBrandEmailOverride } from './brand-pr-overrides.js';
import { findTargetBrand } from './target-brand-list.js';
import { enrichDiscoveredBrands } from './brand-contact-enrichment.js';
import { analyzeCreatorPosts, brandLeadToContact } from './instagram-brand-discovery.js';
import { mapIphoneMediaToTimelineEdge } from './instagram-api.js';

test('slugifyBrand strips punctuation and diacritics', () => {
  assert.equal(slugifyBrand("Paula's Choice"), 'paulaschoice');
  assert.equal(slugifyBrand('Grüns'), 'gruns');
  assert.equal(slugifyBrand('ONE/SIZE'), 'onesize');
  assert.equal(slugifyBrand('Liquid I.V.'), 'liquidiv');
});

test('domainSlug drops the public suffix', () => {
  assert.equal(domainSlug('saiehello.com'), 'saiehello');
  assert.equal(domainSlug('gruns.co'), 'gruns');
  assert.equal(domainSlug('us.laneige.com'), 'uslaneige');
});

test('slugsLooselyMatch accepts handle prefixes', () => {
  assert.equal(slugsLooselyMatch('saie', 'saiehello'), true);
  assert.equal(slugsLooselyMatch('olipop', 'drinkolipop'), true);
  assert.equal(slugsLooselyMatch('dae', 'daehair'), false);
});

test('override matching works from Instagram handle or formatted name', () => {
  assert.equal(findBrandEmailOverride('Saie', 'saie')?.email, 'community@saiehello.com');
  assert.equal(findBrandEmailOverride('Charlotte Tilbury', 'charlottetilbury')?.email, 'Influencer@charlottetilbury.com');
  assert.equal(findBrandEmailOverride('onesizebeauty', 'onesizebeauty')?.email, 'influencer@onesizebeauty.com');
  assert.equal(findBrandEmailOverride('Random Cafe', 'randomcafe'), null);
});

test('target brand matching works from handle against domain', () => {
  assert.equal(findTargetBrand('Dae Hair', 'daehair')?.name, 'Dae');
  assert.equal(findTargetBrand('K18', 'k18hair')?.domain, 'k18hair.com');
  assert.equal(findTargetBrand('Olipop', 'drinkolipop')?.domain, 'drinkolipop.com');
  assert.equal(findTargetBrand('Unknown Diner', 'joesburgers'), null);
});

test('enrichDiscoveredBrands applies overrides without scraping', async () => {
  const [saie, dae, diner] = await enrichDiscoveredBrands(
    [
      {
        brandUsername: 'saie',
        brandName: 'Saie',
        instagramHandle: 'saie',
        creators: [{ username: 'creator', postUrl: 'https://instagram.com/p/abc/', captionSnippet: '#ad', signals: [] }],
        postCount: 1,
      },
      {
        brandUsername: 'daehair',
        brandName: 'Daehair',
        instagramHandle: 'daehair',
        creators: [{ username: 'creator', postUrl: 'https://instagram.com/p/ghi/', captionSnippet: '#ad', signals: [] }],
        postCount: 1,
      },
      {
        brandUsername: 'joesburgers',
        brandName: 'Joes Burgers',
        instagramHandle: 'joesburgers',
        creators: [{ username: 'creator', postUrl: 'https://instagram.com/p/def/', captionSnippet: '#ad', signals: [] }],
        postCount: 1,
      },
    ],
    { maxScrapes: 0 },
  );

  assert.equal(saie.email, 'community@saiehello.com');
  assert.equal(saie.emailSource, 'override');
  assert.equal(saie.category, 'Beauty');
  assert.equal(dae.email, 'hello@daehair.com');
  assert.equal(dae.brandName, 'Dae');
  assert.equal(diner.email, '');
  assert.equal(diner.emailSource, null);
});

test('brandLeadToContact becomes draftable when a PR email is present', () => {
  const withEmail = brandLeadToContact({
    brandName: 'Saie',
    instagramHandle: 'saie',
    email: 'community@saiehello.com',
    emailSource: 'override',
    emailNotes: 'Influencer/community inbox',
    category: 'Beauty',
    creators: [
      {
        username: 'creatorone',
        postUrl: 'https://www.instagram.com/p/abc/',
        captionSnippet: 'Loving this #ad',
        signals: ['sponsored caption'],
      },
    ],
  });

  assert.equal(withEmail.email, 'community@saiehello.com');
  assert.equal(withEmail.isLead, false);
  assert.equal(withEmail.name, 'PR Team');
  assert.match(withEmail.notes, /researched list/);

  const lead = brandLeadToContact({
    brandName: 'Joes Burgers',
    instagramHandle: 'joesburgers',
    email: '',
    creators: [
      {
        username: 'creatorone',
        postUrl: 'https://www.instagram.com/p/def/',
        captionSnippet: '#ad dinner',
        signals: ['sponsored caption'],
      },
    ],
  });

  assert.equal(lead.email, '');
  assert.equal(lead.isLead, true);
  assert.match(lead.notes, /add manually/);
});

test('analyzeCreatorPosts keeps tagged brands on sponsored iPhone media', () => {
  const edge = mapIphoneMediaToTimelineEdge({
    code: 'abc123',
    caption: { text: 'Obsessed with this serum #ad @saie' },
    usertags: { in: [{ user: { username: 'saie' } }] },
    is_paid_partnership: true,
  });

  const brands = analyzeCreatorPosts({
    username: 'creatorone',
    timeline: [edge],
  });

  assert.equal(brands.length, 1);
  assert.equal(brands[0].instagramHandle, 'saie');
  assert.equal(brands[0].postCount, 1);
});
