import { authError, isAuthenticated, json } from '../../lib/outreach-auth.js';
import { buildDraftEmail } from '../../lib/outreach-templates.js';
import { listContacts, listDrafts, newId, saveDrafts } from '../../lib/outreach-store.js';

export async function onRequestGet(context) {
  if (!(await isAuthenticated(context.request, context.env))) return authError();

  try {
    const drafts = await listDrafts(context.env);
    const status = new URL(context.request.url).searchParams.get('status');
    const filtered = status ? drafts.filter((item) => item.status === status) : drafts;
    return json({
      drafts: filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    });
  } catch (error) {
    return json({ error: error.message }, 503);
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
    const contacts = await listContacts(context.env);
    const drafts = await listDrafts(context.env);

    if (body.action === 'generate') {
      const contactIds = Array.isArray(body.contactIds) ? body.contactIds : [];
      const created = [];

      for (const contactId of contactIds) {
        const contact = contacts.find((item) => item.id === contactId);
        if (!contact) continue;

        const existingPending = drafts.find(
          (item) => item.contactId === contactId && item.status === 'pending',
        );
        if (existingPending) {
          created.push(existingPending);
          continue;
        }

        const template = buildDraftEmail(contact);
        const draft = {
          id: newId(),
          contactId,
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

      await saveDrafts(context.env, drafts);
      return json({ drafts: created }, 201);
    }

    return json({ error: 'Unsupported action' }, 400);
  } catch (error) {
    return json({ error: error.message }, 503);
  }
}

export async function onRequestPut(context) {
  if (!(await isAuthenticated(context.request, context.env))) return authError();

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  try {
    const drafts = await listDrafts(context.env);
    const index = drafts.findIndex((item) => item.id === body.id);
    if (index === -1) return json({ error: 'Draft not found' }, 404);

    drafts[index] = {
      ...drafts[index],
      subject: String(body.subject ?? drafts[index].subject).trim(),
      body: String(body.body ?? drafts[index].body).trim(),
      status: body.status ?? drafts[index].status,
      updatedAt: new Date().toISOString(),
    };

    await saveDrafts(context.env, drafts);
    return json({ draft: drafts[index] });
  } catch (error) {
    return json({ error: error.message }, 503);
  }
}

export async function onRequestDelete(context) {
  if (!(await isAuthenticated(context.request, context.env))) return authError();

  const id = new URL(context.request.url).searchParams.get('id');
  if (!id) return json({ error: 'Missing id' }, 400);

  try {
    const drafts = await listDrafts(context.env);
    const next = drafts.filter((item) => item.id !== id);
    await saveDrafts(context.env, next);
    return json({ ok: true });
  } catch (error) {
    return json({ error: error.message }, 503);
  }
}
