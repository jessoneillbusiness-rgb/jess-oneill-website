import { authError, isAuthenticated, json } from '../../lib/outreach-auth.js';
import { enrichDiscoveredBrands } from '../../lib/brand-contact-enrichment.js';
import {
  brandLeadToContact,
  discoverBrandsFromCreators,
  MAX_CREATORS_PER_SCAN,
  normalizeInstagramUsername,
} from '../../lib/instagram-brand-discovery.js';
import { generateDraftsForContacts } from '../../lib/outreach-drafts.js';
import { applyCreatorScan, sortSavedCreators } from '../../lib/saved-creators.js';
import { listContacts, listSavedCreators, newId, saveContacts, saveSavedCreators } from '../../lib/outreach-store.js';

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
      const brands = await enrichDiscoveredBrands(result.brands, { timeoutMs: 4000, maxScrapes: 8 });
      const emailCount = brands.filter((brand) => brand.email).length;

      const existing = await listSavedCreators(context.env);
      const creators = applyCreatorScan(existing, {
        added,
        scanned: result.creators,
      });
      await saveSavedCreators(context.env, creators);

      return json({
        ...result,
        brands,
        emailCount,
        savedCreators: creators,
        added,
        skipped,
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

      const contacts = await listContacts(context.env);
      const created = [];

      for (const brand of brands) {
        const lead = brandLeadToContact(brand);
        const handle = normalizeInstagramUsername(lead.instagramHandle);
        const companyKey = String(lead.company ?? '').trim().toLowerCase();
        const emailKey = String(lead.email ?? '')
          .trim()
          .toLowerCase();

        const duplicate = contacts.find((contact) => {
          if (emailKey && contact.email && contact.email === emailKey) return true;
          const existingHandle = normalizeInstagramUsername(contact.instagramHandle);
          if (handle && existingHandle && handle === existingHandle) return true;
          return (
            companyKey &&
            String(contact.company ?? '').trim().toLowerCase() === companyKey &&
            contact.source === 'instagram-discovery'
          );
        });

        if (duplicate) {
          if (emailKey && !duplicate.email) {
            duplicate.email = emailKey;
            duplicate.isLead = false;
            duplicate.name = duplicate.name || lead.name || 'PR Team';
            duplicate.category = duplicate.category || lead.category;
            duplicate.notes = lead.notes;
            duplicate.updatedAt = new Date().toISOString();
            created.push(duplicate);
          }
          continue;
        }

        contacts.push({
          id: newId(),
          ...lead,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        created.push(contacts[contacts.length - 1]);
      }

      await saveContacts(context.env, contacts);

      const generateDrafts = body.generateDrafts !== false;
      const draftable = created.filter((contact) => contact.email && !contact.isLead);
      const drafts =
        generateDrafts && draftable.length
          ? await generateDraftsForContacts(context.env, draftable)
          : [];

      return json(
        {
          imported: created.length,
          contacts: created,
          drafted: drafts.length,
          drafts,
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
