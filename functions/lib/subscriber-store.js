import { listContacts, newId, saveContacts } from './outreach-store.js';

const SUBSCRIBERS_KEY = 'media-kit:subscribers';

function requireKv(env) {
  if (!env.OUTREACH_KV) {
    throw new Error(
      'OUTREACH_KV is not configured. Add a KV namespace binding in Cloudflare Pages settings.',
    );
  }
  return env.OUTREACH_KV;
}

async function readJson(kv, key, fallback) {
  const raw = await kv.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(kv, key, value) {
  await kv.put(key, JSON.stringify(value));
}

export async function addMediaKitSubscriber(env, input) {
  const kv = requireKv(env);
  const subscribers = await readJson(kv, SUBSCRIBERS_KEY, []);
  const email = input.email.toLowerCase();
  const now = new Date().toISOString();
  const existing = subscribers.find((item) => item.email === email);

  const record = {
    id: existing?.id || newId(),
    email,
    name: String(input.name ?? existing?.name ?? '').trim(),
    company: String(input.company ?? existing?.company ?? '').trim(),
    newsletter: input.newsletter ?? existing?.newsletter ?? false,
    source: 'media-kit',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const next = existing
    ? subscribers.map((item) => (item.email === email ? record : item))
    : [...subscribers, record];

  await writeJson(kv, SUBSCRIBERS_KEY, next);
  await syncOutreachContact(env, record);
  return record;
}

async function syncOutreachContact(env, subscriber) {
  const contacts = await listContacts(env);
  const index = contacts.findIndex((item) => item.email === subscriber.email);

  const noteParts = ['Media kit email gate'];
  if (subscriber.newsletter) noteParts.push('newsletter opt-in');

  if (index === -1) {
    contacts.push({
      id: newId(),
      name: subscriber.name,
      email: subscriber.email,
      company: subscriber.company,
      role: '',
      category: '',
      notes: noteParts.join(' · '),
      source: 'media-kit',
      createdAt: subscriber.createdAt,
      updatedAt: subscriber.updatedAt,
    });
  } else {
    contacts[index] = {
      ...contacts[index],
      name: contacts[index].name || subscriber.name,
      company: contacts[index].company || subscriber.company,
      notes: contacts[index].notes || noteParts.join(' · '),
      updatedAt: subscriber.updatedAt,
    };
  }

  await saveContacts(env, contacts);
}

export async function listMediaKitSubscribers(env) {
  const kv = requireKv(env);
  return readJson(kv, SUBSCRIBERS_KEY, []);
}
