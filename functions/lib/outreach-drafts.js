import { buildDraftEmail } from './outreach-templates.js';
import { listDrafts, newId, saveDrafts } from './outreach-store.js';

export function canGenerateDraft(contact) {
  return Boolean(contact?.id && contact.email && !contact.isLead);
}

export async function generateDraftsForContacts(env, contacts, options = {}) {
  const regenerate = options.regenerate === true;
  const drafts = await listDrafts(env);
  const created = [];

  for (const contact of contacts) {
    if (!canGenerateDraft(contact)) continue;

    const existingPendingIndex = drafts.findIndex(
      (item) => item.contactId === contact.id && item.status === 'pending',
    );
    if (existingPendingIndex !== -1) {
      if (!regenerate) {
        created.push(drafts[existingPendingIndex]);
        continue;
      }
      drafts.splice(existingPendingIndex, 1);
    }

    const template = await buildDraftEmail(contact, env);
    const draft = {
      id: newId(),
      contactId: contact.id,
      contactEmail: contact.email,
      contactName: contact.name,
      contactCompany: contact.company,
      status: 'pending',
      subject: template.subject,
      body: template.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    drafts.push(draft);
    created.push(draft);
  }

  await saveDrafts(env, drafts);
  return created;
}
