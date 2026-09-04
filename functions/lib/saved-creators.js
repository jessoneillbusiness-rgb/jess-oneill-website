/**
 * Persist and score Instagram creators used for brand discovery rescans.
 */

export function scoreCreator(creator) {
  const brands = Number(creator?.lastBrandsFound) || 0;
  const scans = Number(creator?.scanCount) || 0;
  const okBonus = creator?.lastOk ? 2 : 0;
  return brands * 10 + scans + okBonus;
}

export function sortSavedCreators(creators) {
  return [...creators].sort((left, right) => {
    const scoreDelta = (right.score ?? 0) - (left.score ?? 0);
    if (scoreDelta !== 0) return scoreDelta;
    const scannedDelta =
      new Date(right.lastScannedAt ?? 0).getTime() - new Date(left.lastScannedAt ?? 0).getTime();
    if (scannedDelta !== 0) return scannedDelta;
    return String(left.username).localeCompare(String(right.username));
  });
}

export function emptySavedCreator(username, addedAt = new Date().toISOString()) {
  return {
    username,
    addedAt,
    lastScannedAt: null,
    lastOk: null,
    lastError: null,
    lastBrandsFound: 0,
    lastSponsoredPosts: 0,
    scanCount: 0,
    totalBrandsFound: 0,
    score: 0,
  };
}

export function applyCreatorScan(existing, options = {}) {
  const added = [...new Set(options.added ?? [])].filter(Boolean);
  const scanned = Array.isArray(options.scanned) ? options.scanned : [];
  const now = options.now ?? new Date().toISOString();
  const map = new Map((existing ?? []).map((creator) => [creator.username, { ...creator }]));

  for (const username of added) {
    if (!map.has(username)) {
      map.set(username, emptySavedCreator(username, now));
    }
  }

  for (const result of scanned) {
    const username = result?.username;
    if (!username) continue;
    const current = map.get(username) ?? emptySavedCreator(username, now);
    const brandsFound = Number(result.brandsFound) || 0;
    current.lastScannedAt = now;
    current.lastOk = result.ok !== false;
    current.lastError = current.lastOk ? null : result.error || 'Scan failed';
    current.lastBrandsFound = brandsFound;
    current.lastSponsoredPosts = Number(result.sponsoredPosts) || 0;
    current.scanCount = (Number(current.scanCount) || 0) + 1;
    current.totalBrandsFound = (Number(current.totalBrandsFound) || 0) + brandsFound;
    current.score = scoreCreator(current);
    map.set(username, current);
  }

  return sortSavedCreators([...map.values()]);
}
