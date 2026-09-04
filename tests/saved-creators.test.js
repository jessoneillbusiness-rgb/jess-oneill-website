import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyCreatorScan, scoreCreator, sortSavedCreators } from '../functions/lib/saved-creators.js';

test('new handles are saved even before a successful scan', () => {
  const next = applyCreatorScan([], {
    added: ['desiperkins', 'jackieaina'],
    scanned: [],
    now: '2026-09-04T12:00:00.000Z',
  });

  assert.deepEqual(
    next.map((creator) => creator.username),
    ['desiperkins', 'jackieaina'],
  );
  assert.equal(next[0].scanCount, 0);
  assert.equal(next[0].score, 0);
});

test('scan results score creators by brands found and keep them sorted', () => {
  const next = applyCreatorScan([], {
    added: ['olayfan', 'desiperkins'],
    scanned: [
      { username: 'desiperkins', ok: true, brandsFound: 4, sponsoredPosts: 2 },
      { username: 'olayfan', ok: true, brandsFound: 1, sponsoredPosts: 1 },
    ],
    now: '2026-09-04T12:00:00.000Z',
  });

  assert.equal(next[0].username, 'desiperkins');
  assert.equal(next[0].lastBrandsFound, 4);
  assert.equal(next[0].scanCount, 1);
  assert.equal(next[0].score, scoreCreator(next[0]));
  assert.ok(next[0].score > next[1].score);
  assert.equal(next[1].username, 'olayfan');
});

test('failed scans stay on the list with a low score', () => {
  const existing = applyCreatorScan([], {
    added: ['privateaccount'],
    scanned: [{ username: 'privateaccount', ok: false, error: 'unavailable', brandsFound: 0 }],
    now: '2026-09-04T12:00:00.000Z',
  });

  assert.equal(existing[0].lastOk, false);
  assert.equal(existing[0].lastError, 'unavailable');
  assert.equal(existing[0].scanCount, 1);
  assert.deepEqual(
    sortSavedCreators(existing).map((creator) => creator.username),
    ['privateaccount'],
  );
});
