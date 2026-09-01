#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { enrichBrandList } from '../functions/lib/brand-contact-enrichment.js';
import { applyBrandEmailOverride } from '../functions/lib/brand-pr-overrides.js';
import { TARGET_BRANDS } from '../functions/lib/target-brand-list.js';

const results = TARGET_BRANDS.map((brand) =>
  applyBrandEmailOverride(brand.name, {
    name: brand.name,
    domain: brand.domain,
    category: brand.category,
    emails: [],
    bestEmail: null,
    pagesChecked: [],
  }),
);

// Fill gaps with website scan only where no manual override email exists.
const missing = results.filter((item) => !item.bestEmail);
for (let index = 0; index < missing.length; index += 4) {
  const batch = missing.slice(index, index + 4).map((item) => ({
    name: item.name,
    domain: item.domain,
    category: item.category,
  }));
  const scanned = await enrichBrandList(batch, { timeoutMs: 6000 });
  for (const item of scanned) {
    const merged = applyBrandEmailOverride(item.name, item);
    const target = results.find((entry) => entry.name === item.name);
    if (target && merged.bestEmail) Object.assign(target, merged);
  }
  console.log(`Scanned ${Math.min(index + 4, missing.length)}/${missing.length} missing brands`);
}

const csvLines = [
  'company,email,name,role,category,notes',
  ...results.map((item) =>
    [
      csvCell(item.name),
      csvCell(item.bestEmail ?? ''),
      csvCell(item.bestEmail ? 'PR Team' : ''),
      csvCell(item.bestEmail ? 'PR / Partnerships' : ''),
      csvCell(item.category ?? ''),
      csvCell(
        item.bestEmail
          ? `${item.notes ?? ''}${item.notes ? ' | ' : ''}Domain: ${item.domain}`
          : `No email found. Domain: ${item.domain}. Try LinkedIn or press page manually.`,
      ),
    ].join(','),
  ),
];

writeFileSync('brand-pr-contacts.csv', `${csvLines.join('\n')}\n`);
writeFileSync('brand-pr-contacts.json', `${JSON.stringify(results, null, 2)}\n`);

const found = results.filter((item) => item.bestEmail);
console.log(`Curated ${found.length}/${results.length} brand emails into brand-pr-contacts.csv`);

function csvCell(value) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
