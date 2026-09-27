import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FACEBOOK_FOLLOWER_FALLBACK,
  hasFacebookFollowerOverride,
  resolveFacebookFollowers,
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
