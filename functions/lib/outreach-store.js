const CONTACTS_KEY = 'outreach:contacts';
const DRAFTS_KEY = 'outreach:drafts';

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

export async function listContacts(env) {
  const kv = requireKv(env);
  return readJson(kv, CONTACTS_KEY, []);
}

export async function saveContacts(env, contacts) {
  const kv = requireKv(env);
  await writeJson(kv, CONTACTS_KEY, contacts);
}

export async function listDrafts(env) {
  const kv = requireKv(env);
  return readJson(kv, DRAFTS_KEY, []);
}

export async function saveDrafts(env, drafts) {
  const kv = requireKv(env);
  await writeJson(kv, DRAFTS_KEY, drafts);
}

export function newId() {
  return crypto.randomUUID();
}
