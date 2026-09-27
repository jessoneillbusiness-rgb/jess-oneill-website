import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FACEBOOK_FOLLOWER_FALLBACK,
  INSTAGRAM_FOLLOWER_FALLBACK,
  TIKTOK_FOLLOWER_FALLBACK,
  hasFacebookFollowerOverride,
  resolveFacebookFollowers,
  resolveInstagramFollowers,
  resolveTikTokFollowers,
} from '../functions/lib/social-config.js';

test('FACEBOOK_FOLLOWER_COUNT overrides the hardcoded fallback', () => {
  assert.equal(hasFacebookFollowerOverride({ FACEBOOK_FOLLOWER_COUNT: '25000' }), true);
  assert.equal(resolveFacebookFollowers({ FACEBOOK_FOLLOWER_COUNT: '25000' }), 25000);
});

test('missing Facebook env var uses the fallback', () => {
  assert.equal(hasFacebookFollowerOverride({}), false);
  assert.equal(hasFacebookFollowerOverride({ FACEBOOK_FOLLOWER_COUNT: '' }), false);
  assert.equal(resolveFacebookFollowers({}), FACEBOOK_FOLLOWER_FALLBACK);
  assert.equal(FACEBOOK_FOLLOWER_FALLBACK, 20000);
});

test('Instagram and TikTok fallbacks match the latest live counts', () => {
  assert.equal(INSTAGRAM_FOLLOWER_FALLBACK, 25044);
  assert.equal(TIKTOK_FOLLOWER_FALLBACK, 81100);
  assert.equal(resolveInstagramFollowers({}), 25044);
  assert.equal(resolveTikTokFollowers({}), 81100);
});

test('Instagram and TikTok env vars replace the hardcoded backup', () => {
  assert.equal(resolveInstagramFollowers({ INSTAGRAM_FOLLOWER_COUNT: '26000' }), 26000);
  assert.equal(resolveTikTokFollowers({ TIKTOK_FOLLOWER_COUNT: '82000' }), 82000);
});
