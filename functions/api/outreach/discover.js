import { authError, isAuthenticated, json } from '../../lib/outreach-auth.js';
import { enrichDiscoveredBrands } from '../../lib/brand-contact-enrichment.js';
import {
  discoverBrandsFromCreators,
  MAX_CREATORS_PER_SCAN,
  normalizeInstagramUsername,
} from '../../lib/instagram-brand-discovery.js';
import { upsertDiscoveredBrands } from '../../lib/discovered-contacts.js';
import { applyCreatorScan, sortSavedCreators } from '../../lib/saved-creators.js';
import { listSavedCreators, saveSavedCreators } from '../../lib/outreach-store.js';

export async function onRequestGet(context) {
  if (!(await isAuthenticated(context.request, context.env))) return authError();

  try {
    const creators = sortSavedCreators(await listSavedCreators(context.env));
    return json({ creators });
  } catch (error) {
    return json({ error: error.message || 'Could not load saved creators' }, 503);
  }
}

export async function onRequestPost(context) {
  if (!(await isAuthenticated(context.request, context.env))) return authError();

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  try {
    if (body.action === 'scan') {
      const added = parseUsernames(body.usernames);
      const selected = parseUsernames(body.selectedUsernames);
      const toScan = [...new Set([...added, ...selected])];

      if (!toScan.length) {
        return json({ error: 'Select saved creators below, or add new handles to scan' }, 400);
      }

      const scannedUsernames = toScan.slice(0, MAX_CREATORS_PER_SCAN);
      const skipped = toScan.slice(MAX_CREATORS_PER_SCAN);

      const result = await discoverBrandsFromCreators(scannedUsernames, { timeoutMs: 6000 });

      const existing = await listSavedCreators(context.env);
      const creators = applyCreatorScan(existing, {
        added,
        scanned: result.creators,
      });
      await saveSavedCreators(context.env, creators);

      const withOverrides = await enrichDiscoveredBrands(result.brands, { maxScrapes: 0 });
      const firstSave = await upsertDiscoveredBrands(context.env, withOverrides, { generateDrafts: true });

      const brands = await enrichDiscoveredBrands(result.brands, { timeoutMs: 2000, maxScrapes: 4 });
      const saved = await upsertDiscoveredBrands(context.env, brands, { generateDrafts: true });
      const emailCount = brands.filter((brand) => brand.email).length;

      return json({
        ...result,
        brands,
        emailCount,
        savedCreators: creators,
        added,
        skipped,
        imported: firstSave.imported,
        drafted: firstSave.drafted + saved.drafted,
      });
    }

    if (body.action === 'remove') {
      const username = normalizeInstagramUsername(body.username);
      if (!username) return json({ error: 'Missing Instagram username' }, 400);

      const creators = sortSavedCreators(
        (await listSavedCreators(context.env)).filter((creator) => creator.username !== username),
      );
      await saveSavedCreators(context.env, creators);
      return json({ removed: username, creators });
    }

    if (body.action === 'import') {
      const brands = Array.isArray(body.brands) ? body.brands : [];
      if (!brands.length) {
        return json({ error: 'No brands selected to import' }, 400);
      }

      const saved = await upsertDiscoveredBrands(context.env, brands, {
        generateDrafts: body.generateDrafts !== false,
      });

      return json(
        {
          imported: saved.imported,
          contacts: saved.contacts,
          drafted: saved.drafted,
          drafts: saved.drafts,
        },
        201,
      );
    }

    return json({ error: 'Unsupported action' }, 400);
  } catch (error) {
    return json({ error: error.message || 'Discovery failed' }, 503);
  }
}

function parseUsernames(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeInstagramUsername).filter(Boolean);
  }

  return String(value ?? '')
    .split(/[\n,;\s]+/)
    .map(normalizeInstagramUsername)
    .filter(Boolean);
}
