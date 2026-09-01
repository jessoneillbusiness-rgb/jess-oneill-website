/**
 * POST /api/outreach/enrich
 * { action: "scan", brands: [{ name, domain, category }] }
 * { action: "import", contacts: [{ name, email, company, category, notes, ... }] }
 */

import { authError, isAuthenticated, json } from '../../lib/outreach-auth.js';
import { enrichBrandList } from '../../lib/brand-contact-enrichment.js';
import { applyBrandEmailOverride } from '../../lib/brand-pr-overrides.js';
import { TARGET_BRANDS } from '../../lib/target-brand-list.js';
import { listContacts, newId, saveContacts } from '../../lib/outreach-store.js';

export async function onRequestPost(context) {
  if (!(await isAuthenticated(context.request, context.env))) return authError();

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  try {
    if (body.action === 'scan-default') {
      const scanned = await enrichBrandList(TARGET_BRANDS, { timeoutMs: 5000 });
      const results = scanned.map((item) => applyBrandEmailOverride(item.name, item));
      const found = results.filter((item) => item.bestEmail);
      return json({
        scanned: results.length,
        found: found.length,
        results,
        updatedAt: new Date().toISOString(),
      });
    }

    if (body.action === 'scan') {
      const brands = Array.isArray(body.brands) ? body.brands : [];
      if (!brands.length) return json({ error: 'No brands provided' }, 400);
      const scanned = await enrichBrandList(brands.slice(0, 25), { timeoutMs: 5000 });
      const results = scanned.map((item) => applyBrandEmailOverride(item.name, item));
      return json({
        scanned: results.length,
        found: results.filter((item) => item.bestEmail).length,
        results,
        updatedAt: new Date().toISOString(),
      });
    }

    if (body.action === 'import-default') {
      const scanned = TARGET_BRANDS.map((brand) =>
        applyBrandEmailOverride(brand.name, {
          name: brand.name,
          domain: brand.domain,
          category: brand.category,
          emails: [],
          bestEmail: null,
          pagesChecked: [],
        }),
      );
      const contacts = scanned
        .filter((item) => item.bestEmail)
        .map((item) => ({
          name: 'PR Team',
          email: item.bestEmail,
          company: item.name,
          role: 'PR / Partnerships',
          category: item.category,
          notes: item.notes ?? `Target brand list. Domain: ${item.domain}`,
          source: 'brand-enrichment',
        }));
      body = { action: 'import', contacts };
    }

    if (body.action === 'import') {
      const incoming = Array.isArray(body.contacts) ? body.contacts : [];
      const contacts = await listContacts(context.env);
      let imported = 0;

      for (const item of incoming) {
        const email = String(item.email ?? '')
          .trim()
          .toLowerCase();
        const company = String(item.company ?? item.name ?? '').trim();
        if (!email || !email.includes('@') || !company) continue;

        if (contacts.some((contact) => contact.email === email)) continue;

        contacts.push({
          id: newId(),
          name: String(item.name ?? 'PR Team').trim() || 'PR Team',
          email,
          company,
          role: String(item.role ?? 'PR / Partnerships').trim(),
          category: String(item.category ?? '').trim(),
          notes: String(item.notes ?? '').trim(),
          instagramHandle: String(item.instagramHandle ?? '').trim().replace(/^@/, ''),
          isLead: false,
          source: item.source === 'import' ? 'import' : 'brand-enrichment',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        imported += 1;
      }

      await saveContacts(context.env, contacts);
      return json({ imported, total: contacts.length }, 201);
    }

    return json({ error: 'Unsupported action' }, 400);
  } catch (error) {
    return json({ error: error.message || 'Enrichment failed' }, 503);
  }
}
