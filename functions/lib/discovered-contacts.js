import { brandLeadToContact, normalizeInstagramUsername } from './instagram-brand-discovery.js';
import { generateDraftsForContacts } from './outreach-drafts.js';
import { listContacts, newId, saveContacts } from './outreach-store.js';

export function isSameDiscoveredContact(contact, lead) {
  const emailKey = String(lead.email ?? '')
    .trim()
    .toLowerCase();
  if (emailKey && contact.email && contact.email === emailKey) return true;

  const handle = normalizeInstagramUsername(lead.instagramHandle);
  const existingHandle = normalizeInstagramUsername(contact.instagramHandle);
  if (handle && existingHandle && handle === existingHandle) return true;

  const companyKey = String(lead.company ?? '').trim().toLowerCase();
  return (
    Boolean(companyKey) &&
    String(contact.company ?? '').trim().toLowerCase() === companyKey &&
    contact.source === 'instagram-discovery'
  );
}

export async function upsertDiscoveredBrands(env, brands, options = {}) {
  const generateDrafts = options.generateDrafts !== false;
  const contacts = await listContacts(env);
  const touched = [];

  for (const brand of brands) {
    if (brand?.isUnknown) continue;
    const lead = brandLeadToContact(brand);
    const duplicate = contacts.find((contact) => isSameDiscoveredContact(contact, lead));

    if (duplicate) {
      const emailKey = String(lead.email ?? '')
        .trim()
        .toLowerCase();
      if (emailKey && duplicate.email !== emailKey) {
        duplicate.email = emailKey;
        duplicate.isLead = false;
        duplicate.name = duplicate.name || lead.name || 'PR Team';
        duplicate.category = duplicate.category || lead.category;
        duplicate.notes = lead.notes;
        duplicate.updatedAt = new Date().toISOString();
        touched.push(duplicate);
      }
      continue;
    }

    contacts.push({
      id: newId(),
      ...lead,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    touched.push(contacts[contacts.length - 1]);
  }

  await saveContacts(env, contacts);

  const draftable = touched.filter((contact) => contact.email && !contact.isLead);
  const drafts =
    generateDrafts && draftable.length ? await generateDraftsForContacts(env, draftable) : [];

  return {
    imported: touched.length,
    contacts: touched,
    drafted: drafts.length,
    drafts,
  };
}
