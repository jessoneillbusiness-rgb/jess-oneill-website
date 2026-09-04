/**
 * Fuzzy matching between Instagram-discovered brands and researched
 * target / override lists (name, handle, or domain slug).
 */

export function slugifyBrand(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

export function slugsLooselyMatch(left, right) {
  const a = slugifyBrand(left);
  const b = slugifyBrand(right);
  if (!a || !b) return false;
  if (a === b) return true;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  return shorter.length >= 4 && longer.includes(shorter);
}

export function domainSlug(domain) {
  const host = String(domain ?? '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .toLowerCase();
  if (!host) return '';

  const parts = host.split('.').filter(Boolean);
  if (parts.length >= 3 && parts[parts.length - 2].length <= 3) {
    return slugifyBrand(parts.slice(0, -2).join(''));
  }
  return slugifyBrand(parts.slice(0, -1).join(''));
}

export function brandKeysMatch(candidate, known) {
  const candidateValues = [candidate?.name, candidate?.handle].filter(Boolean);
  const knownValues = [known?.name, known?.handle, known?.domain && domainSlug(known.domain)].filter(
    Boolean,
  );

  return candidateValues.some((left) => knownValues.some((right) => slugsLooselyMatch(left, right)));
}
