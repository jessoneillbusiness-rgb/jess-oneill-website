import { authError, isAuthenticated, json } from '../../lib/outreach-auth.js';
import { listContacts, newId, saveContacts } from '../../lib/outreach-store.js';

function normalizeContact(input) {
  const email = String(input.email ?? '')
    .trim()
    .toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('A valid email is required');
  }

  return {
    id: input.id || newId(),
    name: String(input.name ?? '').trim(),
    email,
    company: String(input.company ?? '').trim(),
    role: String(input.role ?? '').trim(),
    category: String(input.category ?? '').trim(),
    notes: String(input.notes ?? '').trim(),
    source: input.source === 'import' ? 'import' : 'manual',
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function onRequestGet(context) {
  if (!(await isAuthenticated(context.request, context.env))) return authError();

  try {
    const contacts = await listContacts(context.env);
    return json({ contacts: contacts.sort((a, b) => a.company.localeCompare(b.company)) });
  } catch (error) {
    return json({ error: error.message }, 503);
  }
}

export async function onRequestPost(context) {
  if (!(await isAuthenticated(context.request, context.env))) return authError();

  let body;
  try {
    body = await requestJson(context.request);
  } catch (error) {
    return json({ error: error.message }, 400);
  }

  try {
    const contacts = await listContacts(context.env);

    if (Array.isArray(body.contacts)) {
      const imported = body.contacts.map((item) => normalizeContact({ ...item, source: 'import' }));
      const merged = mergeContacts(contacts, imported);
      await saveContacts(context.env, merged);
      return json({ contacts: merged, imported: imported.length });
    }

    const contact = normalizeContact(body);
    if (contacts.some((item) => item.email === contact.email)) {
      return json({ error: 'A contact with this email already exists' }, 409);
    }

    contacts.push(contact);
    await saveContacts(context.env, contacts);
    return json({ contact }, 201);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
}

export async function onRequestPut(context) {
  if (!(await isAuthenticated(context.request, context.env))) return authError();

  let body;
  try {
    body = await requestJson(context.request);
  } catch (error) {
    return json({ error: error.message }, 400);
  }

  try {
    const contacts = await listContacts(context.env);
    const index = contacts.findIndex((item) => item.id === body.id);
    if (index === -1) return json({ error: 'Contact not found' }, 404);

    const updated = normalizeContact({ ...contacts[index], ...body });
    contacts[index] = updated;
    await saveContacts(context.env, contacts);
    return json({ contact: updated });
  } catch (error) {
    return json({ error: error.message }, 400);
  }
}

export async function onRequestDelete(context) {
  if (!(await isAuthenticated(context.request, context.env))) return authError();

  const id = new URL(context.request.url).searchParams.get('id');
  if (!id) return json({ error: 'Missing id' }, 400);

  try {
    const contacts = await listContacts(context.env);
    const next = contacts.filter((item) => item.id !== id);
    await saveContacts(context.env, next);
    return json({ ok: true });
  } catch (error) {
    return json({ error: error.message }, 503);
  }
}

async function requestJson(request) {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON');
  }
}

function mergeContacts(existing, incoming) {
  const map = new Map(existing.map((item) => [item.email, item]));
  for (const contact of incoming) {
    map.set(contact.email, { ...map.get(contact.email), ...contact, updatedAt: new Date().toISOString() });
  }
  return [...map.values()];
}
