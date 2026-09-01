type Contact = {
  id: string;
  name: string;
  email: string;
  company: string;
  role?: string;
  category?: string;
  notes?: string;
  instagramHandle?: string;
  isLead?: boolean;
  source?: string;
};

type BrandCreatorRef = {
  username: string;
  postUrl: string;
  captionSnippet: string;
  signals: string[];
};

type BrandLead = {
  brandUsername: string;
  brandName: string;
  brandUrl: string;
  instagramHandle: string;
  creators: BrandCreatorRef[];
  postCount: number;
  isUnknown?: boolean;
};

type DiscoveryResult = {
  brands: BrandLead[];
  creators: Array<{ username: string; ok: boolean; error?: string; brandsFound?: number }>;
  scannedCount: number;
  brandCount: number;
};

type Draft = {
  id: string;
  contactId: string;
  contactEmail: string;
  contactName: string;
  contactCompany: string;
  status: 'pending' | 'sent' | 'skipped';
  subject: string;
  body: string;
  sentAt?: string;
  sentVia?: string;
};

const loginEl = document.getElementById('outreach-login')!;
const dashboardEl = document.getElementById('outreach-dashboard')!;
const loginForm = document.getElementById('outreach-login-form') as HTMLFormElement;
const loginError = document.getElementById('outreach-login-error')!;
const alertEl = document.getElementById('outreach-alert')!;
const alertMessageEl = document.getElementById('outreach-alert-message')!;
const alertDismissEl = document.getElementById('outreach-alert-dismiss') as HTMLButtonElement;
const contactsBody = document.getElementById('contacts-table-body')!;
const draftsList = document.getElementById('drafts-list')!;
const sentList = document.getElementById('sent-list')!;
const generateBtn = document.getElementById('generate-drafts') as HTMLButtonElement;
const selectAll = document.getElementById('select-all-contacts') as HTMLInputElement;
const discoverForm = document.getElementById('discover-form') as HTMLFormElement;
const discoverUsernames = document.getElementById('discover-usernames') as HTMLTextAreaElement;
const discoverScanBtn = document.getElementById('discover-scan') as HTMLButtonElement;
const discoverResultsPanel = document.getElementById('discover-results-panel')!;
const discoverResultsBody = document.getElementById('discover-results-body')!;
const discoverSummary = document.getElementById('discover-summary')!;
const discoverImportBtn = document.getElementById('discover-import') as HTMLButtonElement;
const discoverSelectAll = document.getElementById('discover-select-all') as HTMLInputElement;

const TEST_CONTACT = {
  name: 'Matthew Roberts',
  email: 'matthew.anthony.roberts@gmail.com',
  company: 'Test Contact',
  role: 'Test',
  category: 'Lifestyle',
  notes: 'Test draft — review and send to verify outreach is working.',
};

function usesLegacyEmailTemplate(body: string) {
  return body.includes('I share polished, relatable content with an engaged audience');
}

async function regenerateDrafts(contactIds: string[]) {
  return api<{ drafts: Draft[] }>('/api/outreach/drafts', {
    method: 'POST',
    body: JSON.stringify({
      action: 'generate',
      contactIds,
      regenerate: true,
    }),
  });
}

let contacts: Contact[] = [];
let drafts: Draft[] = [];
let resendEnabled = false;
const selectedContactIds = new Set<string>();
let discoveryBrands: BrandLead[] = [];
const selectedBrandKeys = new Set<string>();

async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    credentials: 'same-origin',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details =
      typeof data.details === 'object' && data.details !== null
        ? data.details.message || JSON.stringify(data.details)
        : '';
    const hint = typeof data.hint === 'string' ? data.hint : '';
    const message = [data.error, details, hint, `HTTP ${response.status}`]
      .filter(Boolean)
      .join(' — ');
    throw new Error(message || 'Request failed');
  }
  return data as T;
}

function showAlert(message: string, type: 'success' | 'error' = 'success') {
  alertMessageEl.textContent = message;
  alertEl.className = `outreach-alert outreach-alert--${type}`;
  alertEl.hidden = false;
  alertDismissEl.hidden = type !== 'error';
  alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  if (type === 'error') return;

  window.setTimeout(() => {
    alertEl.hidden = true;
  }, 5000);
}

alertDismissEl.addEventListener('click', () => {
  alertEl.hidden = true;
});

function setAuthenticated(isAuthed: boolean) {
  loginEl.hidden = isAuthed;
  dashboardEl.hidden = !isAuthed;
}

async function checkAuth() {
  try {
    await loadData();
    setAuthenticated(true);
  } catch {
    setAuthenticated(false);
  }
}

async function loadData() {
  const [contactsRes, draftsRes, configRes] = await Promise.all([
    api<{ contacts: Contact[] }>('/api/outreach/contacts'),
    api<{ drafts: Draft[] }>('/api/outreach/drafts'),
    api<{ resendEnabled: boolean }>('/api/outreach/config').catch(() => ({ resendEnabled: false })),
  ]);
  contacts = contactsRes.contacts;
  drafts = draftsRes.drafts;
  resendEnabled = configRes.resendEnabled;
  renderContacts();
  renderDrafts();
  renderSent();
  await ensureTestDraft();
}

async function ensureTestDraft() {
  const testEmail = TEST_CONTACT.email.toLowerCase();
  let contact = contacts.find((item) => item.email.toLowerCase() === testEmail);

  if (!contact) {
    try {
      const created = await api<{ contact: Contact }>('/api/outreach/contacts', {
        method: 'POST',
        body: JSON.stringify(TEST_CONTACT),
      });
      contact = created.contact;
      contacts = [...contacts, contact];
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('already exists')) {
        return;
      }
      contact = contacts.find((item) => item.email.toLowerCase() === testEmail);
    }
  }

  if (!contact) return;

  const pendingDraft = drafts.find(
    (item) => item.contactEmail.toLowerCase() === testEmail && item.status === 'pending',
  );

  if (pendingDraft && !usesLegacyEmailTemplate(pendingDraft.body)) return;

  try {
    await regenerateDrafts([contact.id]);
    const draftsRes = await api<{ drafts: Draft[] }>('/api/outreach/drafts');
    drafts = draftsRes.drafts;
    renderDrafts();
    renderSent();
    activateTab('drafts');
    showAlert('Test draft for Matthew is ready in Pending drafts.');
  } catch (error) {
    showAlert(
      error instanceof Error ? error.message : 'Could not refresh Matthew test draft',
      'error',
    );
  }
}

function isDraftReadyContact(contact: Contact) {
  return Boolean(contact.email) && !contact.isLead;
}

function renderContacts() {
  if (contacts.length === 0) {
    contactsBody.innerHTML = '<tr><td colspan="6" class="outreach-empty">No contacts yet.</td></tr>';
    generateBtn.disabled = true;
    return;
  }

  contactsBody.innerHTML = contacts
    .map((contact) => {
      const canDraft = isDraftReadyContact(contact);
      return `
      <tr>
        <td>
          <input
            type="checkbox"
            data-contact-id="${contact.id}"
            ${!canDraft ? 'disabled title="Add a PR email before generating drafts"' : ''}
            ${selectedContactIds.has(contact.id) ? 'checked' : ''}
          />
        </td>
        <td>${escapeHtml(contact.name || (contact.isLead ? 'Brand lead' : '—'))}</td>
        <td>${contact.email ? escapeHtml(contact.email) : '<span class="outreach-badge outreach-badge--lead">Add email</span>'}</td>
        <td>${escapeHtml(contact.company)}${contact.isLead ? ' <span class="outreach-badge outreach-badge--lead">Lead</span>' : ''}</td>
        <td>${escapeHtml(contact.category || '—')}</td>
        <td><button type="button" class="outreach-link-btn" data-delete-contact="${contact.id}">Delete</button></td>
      </tr>
    `;
    })
    .join('');

  generateBtn.disabled = selectedContactIds.size === 0;

  contactsBody.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement;
      if (target.disabled) return;
      const id = target.dataset.contactId!;
      if (target.checked) selectedContactIds.add(id);
      else selectedContactIds.delete(id);
      generateBtn.disabled = selectedContactIds.size === 0;
      const draftableCount = contacts.filter(isDraftReadyContact).length;
      selectAll.checked =
        draftableCount > 0 && selectedContactIds.size === draftableCount;
    });
  });

  contactsBody.querySelectorAll('[data-delete-contact]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = (button as HTMLButtonElement).dataset.deleteContact!;
      if (!confirm('Delete this contact?')) return;
      await api(`/api/outreach/contacts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      selectedContactIds.delete(id);
      await loadData();
      showAlert('Contact deleted.');
    });
  });
}

function buildGmailComposeUrl(to: string, subject: string, body: string) {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to,
    su: subject,
    body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

function buildOutlookComposeUrl(to: string, subject: string, body: string) {
  const params = new URLSearchParams({ to, subject, body });
  return `https://outlook.office.com/mail/deeplink/compose?${params.toString()}`;
}

function buildMailtoUrl(to: string, subject: string, body: string) {
  const params = new URLSearchParams({ subject, body });
  return `mailto:${encodeURIComponent(to)}?${params.toString()}`;
}

async function saveDraftEdits(id: string, subject: string, body: string) {
  await api('/api/outreach/drafts', {
    method: 'PUT',
    body: JSON.stringify({ id, subject, body }),
  });
}

async function markDraftSent(id: string, subject: string, body: string, sentVia: string) {
  await api('/api/outreach/drafts', {
    method: 'PUT',
    body: JSON.stringify({ id, subject, body, status: 'sent', sentVia }),
  });
}

function openCompose(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function formatSentVia(value: string) {
  if (value === 'gmail') return 'Gmail';
  if (value === 'outlook') return 'Outlook';
  if (value === 'mailto') return 'Mail app';
  if (value === 'resend') return 'Resend';
  return 'Manual';
}

function renderDraftCard(draft: Draft, mode: 'pending' | 'sent') {
  if (mode === 'sent') {
    return `
      <article class="outreach-draft outreach-draft--sent">
        <header class="outreach-draft__header">
          <div>
            <h3>${escapeHtml(draft.contactName)} · ${escapeHtml(draft.contactCompany)}</h3>
            <p>${escapeHtml(draft.contactEmail)}</p>
          </div>
          <span class="outreach-badge outreach-badge--sent">Sent ${draft.sentAt ? new Date(draft.sentAt).toLocaleString() : ''}${draft.sentVia ? ` · ${escapeHtml(formatSentVia(draft.sentVia))}` : ''}</span>
        </header>
        <p class="outreach-draft__subject"><strong>Subject:</strong> ${escapeHtml(draft.subject)}</p>
        <pre class="outreach-draft__preview">${escapeHtml(draft.body)}</pre>
      </article>
    `;
  }

  return `
    <article class="outreach-draft" data-draft-id="${draft.id}">
      <header class="outreach-draft__header">
        <div>
          <h3>${escapeHtml(draft.contactName)} · ${escapeHtml(draft.contactCompany)}</h3>
          <p>${escapeHtml(draft.contactEmail)}</p>
        </div>
        <span class="outreach-badge">Pending approval</span>
      </header>
      <label class="outreach-field">
        <span>Subject</span>
        <input class="draft-subject" value="${escapeAttr(draft.subject)}" />
      </label>
      <label class="outreach-field">
        <span>Email body</span>
        <textarea class="draft-body" rows="12">${escapeHtml(draft.body)}</textarea>
      </label>
      <p class="outreach-draft__help">
        Review and edit below. Use <strong>Send from dashboard</strong> (Resend) for one-click send,
        or open in Gmail/Outlook to send from your mail app.
      </p>
      <div class="outreach-draft__actions">
        <button type="button" class="btn btn--primary draft-gmail">Open in Gmail</button>
        <button type="button" class="btn btn--primary draft-outlook">Open in Outlook</button>
        <button type="button" class="btn btn--outline-dark draft-mailto">Open in mail app</button>
        <button type="button" class="btn btn--outline-dark draft-save">Save edits</button>
        <button type="button" class="btn btn--outline-dark draft-regenerate">Regenerate from template</button>
        <button type="button" class="outreach-link-btn draft-mark-sent">Mark as sent</button>
        <button type="button" class="btn btn--primary draft-resend">Send from dashboard</button>
        <button type="button" class="outreach-link-btn draft-delete">Delete draft</button>
      </div>
    </article>
  `;
}

function renderDrafts() {
  const pending = drafts.filter((draft) => draft.status === 'pending');
  if (pending.length === 0) {
    draftsList.innerHTML = '<p class="outreach-empty">No pending drafts. Select contacts and generate drafts first.</p>';
    return;
  }

  draftsList.innerHTML = pending.map((draft) => renderDraftCard(draft, 'pending')).join('');

  draftsList.querySelectorAll('.draft-resend').forEach((button) => {
    button.hidden = !resendEnabled;
  });

  draftsList.querySelectorAll('.outreach-draft').forEach((card) => {
    const id = (card as HTMLElement).dataset.draftId!;
    const subjectInput = card.querySelector('.draft-subject') as HTMLInputElement;
    const bodyInput = card.querySelector('.draft-body') as HTMLTextAreaElement;

    card.querySelector('.draft-save')?.addEventListener('click', async () => {
      await api('/api/outreach/drafts', {
        method: 'PUT',
        body: JSON.stringify({ id, subject: subjectInput.value, body: bodyInput.value }),
      });
      await loadData();
      showAlert('Draft saved.');
    });

    card.querySelector('.draft-regenerate')?.addEventListener('click', async () => {
      const draft = drafts.find((item) => item.id === id);
      if (!draft) return;
      if (
        !confirm(
          'Replace this draft with a fresh template? Your edits will be lost, but the latest audience stats will be included.',
        )
      ) {
        return;
      }

      try {
        await regenerateDrafts([draft.contactId]);
        await loadData();
        showAlert('Draft regenerated with the latest template and stats.');
        activateTab('drafts');
      } catch (error) {
        showAlert(error instanceof Error ? error.message : 'Could not regenerate draft', 'error');
      }
    });

    card.querySelector('.draft-delete')?.addEventListener('click', async () => {
      if (!confirm('Delete this draft?')) return;
      await api(`/api/outreach/drafts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      await loadData();
      showAlert('Draft deleted.');
    });

    card.querySelector('.draft-gmail')?.addEventListener('click', async () => {
      const subject = subjectInput.value;
      const body = bodyInput.value;
      const draft = drafts.find((item) => item.id === id);
      if (!draft) return;

      await saveDraftEdits(id, subject, body);
      openCompose(buildGmailComposeUrl(draft.contactEmail, subject, body));
      showAlert('Gmail opened. Send the email there, then mark as sent when done.');
    });

    card.querySelector('.draft-outlook')?.addEventListener('click', async () => {
      const subject = subjectInput.value;
      const body = bodyInput.value;
      const draft = drafts.find((item) => item.id === id);
      if (!draft) return;

      await saveDraftEdits(id, subject, body);
      openCompose(buildOutlookComposeUrl(draft.contactEmail, subject, body));
      showAlert('Outlook opened. Send the email there, then mark as sent when done.');
    });

    card.querySelector('.draft-mailto')?.addEventListener('click', async () => {
      const subject = subjectInput.value;
      const body = bodyInput.value;
      const draft = drafts.find((item) => item.id === id);
      if (!draft) return;

      await saveDraftEdits(id, subject, body);
      window.location.href = buildMailtoUrl(draft.contactEmail, subject, body);
    });

    card.querySelector('.draft-mark-sent')?.addEventListener('click', async () => {
      const draft = drafts.find((item) => item.id === id);
      const recipient = draft?.contactEmail ?? 'this contact';
      if (!confirm(`Mark this email as sent to ${recipient}?`)) return;

      await markDraftSent(id, subjectInput.value, bodyInput.value, 'manual');
      await loadData();
      showAlert('Marked as sent.');
      activateTab('sent');
    });

    card.querySelector('.draft-resend')?.addEventListener('click', async () => {
      const draft = drafts.find((item) => item.id === id);
      const recipient = draft?.contactEmail ?? 'this contact';
      if (!confirm(`Send this email to ${recipient} via Resend?`)) return;

      try {
        await api('/api/outreach/send', {
          method: 'POST',
          body: JSON.stringify({
            draftId: id,
            subject: subjectInput.value,
            body: bodyInput.value,
          }),
        });
        await loadData();
        showAlert('Email sent via Resend.');
        activateTab('sent');
      } catch (error) {
        showAlert(error instanceof Error ? error.message : 'Send failed', 'error');
      }
    });
  });
}

function renderSent() {
  const sent = drafts.filter((draft) => draft.status === 'sent');
  if (sent.length === 0) {
    sentList.innerHTML = '<p class="outreach-empty">No sent emails yet.</p>';
    return;
  }
  sentList.innerHTML = sent.map((draft) => renderDraftCard(draft, 'sent')).join('');
}

function activateTab(name: string) {
  document.querySelectorAll('.outreach-tab').forEach((tab) => {
    tab.classList.toggle('outreach-tab--active', (tab as HTMLElement).dataset.tab === name);
  });
  document.querySelectorAll('.outreach-tab-panel').forEach((panel) => {
    panel.hidden = panel.id !== `tab-${name}`;
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeAttr(value: string) {
  return escapeHtml(value).replaceAll("'", '&#39;');
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.hidden = true;
  const password = (document.getElementById('outreach-password') as HTMLInputElement).value;

  try {
    await api('/api/outreach/auth', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    setAuthenticated(true);
    await loadData();
  } catch (error) {
    loginError.textContent = error instanceof Error ? error.message : 'Sign in failed';
    loginError.hidden = false;
  }
});

document.getElementById('outreach-logout')?.addEventListener('click', async () => {
  await api('/api/outreach/auth', { method: 'DELETE' });
  setAuthenticated(false);
});

document.querySelectorAll('.outreach-tab').forEach((tab) => {
  tab.addEventListener('click', () => activateTab((tab as HTMLElement).dataset.tab!));
});

(document.getElementById('contact-form') as HTMLFormElement).addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  const data = Object.fromEntries(new FormData(form).entries());

  try {
    await api('/api/outreach/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    form.reset();
    await loadData();
    showAlert('Contact saved.');
  } catch (error) {
    showAlert(error instanceof Error ? error.message : 'Could not save contact', 'error');
  }
});

selectAll.addEventListener('change', () => {
  selectedContactIds.clear();
  if (selectAll.checked) {
    contacts.filter(isDraftReadyContact).forEach((contact) => selectedContactIds.add(contact.id));
  }
  renderContacts();
});

function brandKey(brand: BrandLead) {
  return brand.brandUsername || brand.creators[0]?.postUrl || brand.brandName;
}

function renderDiscoveryResults(result: DiscoveryResult) {
  discoveryBrands = result.brands;
  selectedBrandKeys.clear();
  discoverSelectAll.checked = false;
  discoverImportBtn.disabled = true;

  const creatorSummary = result.creators
    .map((creator) =>
      creator.ok
        ? `@${creator.username} (${creator.brandsFound ?? 0} brands)`
        : `@${creator.username} (failed)`,
    )
    .join(' · ');

  discoverSummary.textContent = `Scanned ${result.scannedCount} creator(s). Found ${result.brandCount} potential brand(s). ${creatorSummary}`;
  discoverResultsPanel.hidden = false;

  if (discoveryBrands.length === 0) {
    discoverResultsBody.innerHTML =
      '<tr><td colspan="6" class="outreach-empty">No sponsored brand posts found. Try different creators.</td></tr>';
    return;
  }

  discoverResultsBody.innerHTML = discoveryBrands
    .map((brand) => {
      const key = brandKey(brand);
      const creator = brand.creators[0];
      const seenWith = [...new Set(brand.creators.map((item) => `@${item.username}`))].join(', ');
      const signals = [...new Set(brand.creators.flatMap((item) => item.signals))].join(', ');
      const instagramCell = brand.instagramHandle
        ? `<a href="${escapeAttr(brand.brandUrl)}" target="_blank" rel="noopener noreferrer">@${escapeHtml(brand.instagramHandle)}</a>`
        : '—';
      const postCell = creator
        ? `<a href="${escapeAttr(creator.postUrl)}" target="_blank" rel="noopener noreferrer">View post</a>`
        : '—';

      return `
        <tr>
          <td><input type="checkbox" data-brand-key="${escapeAttr(key)}" ${brand.isUnknown ? 'disabled' : ''} /></td>
          <td>${escapeHtml(brand.brandName)}</td>
          <td>${instagramCell}</td>
          <td>${escapeHtml(seenWith)}</td>
          <td>${postCell}</td>
          <td>${escapeHtml(signals || '—')}</td>
        </tr>
      `;
    })
    .join('');

  discoverResultsBody.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement;
      const key = target.dataset.brandKey!;
      if (target.checked) selectedBrandKeys.add(key);
      else selectedBrandKeys.delete(key);
      discoverImportBtn.disabled = selectedBrandKeys.size === 0;
      const selectable = discoveryBrands.filter((brand) => !brand.isUnknown).length;
      discoverSelectAll.checked = selectable > 0 && selectedBrandKeys.size === selectable;
    });
  });
}

discoverForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const usernames = discoverUsernames.value.trim();
  if (!usernames) {
    showAlert('Add at least one creator handle.', 'error');
    return;
  }

  discoverScanBtn.disabled = true;
  discoverScanBtn.textContent = 'Scanning…';

  try {
    const result = await api<DiscoveryResult>('/api/outreach/discover', {
      method: 'POST',
      body: JSON.stringify({ action: 'scan', usernames }),
    });
    renderDiscoveryResults(result);
    showAlert(`Scan complete. Found ${result.brandCount} potential brand(s).`);
  } catch (error) {
    showAlert(error instanceof Error ? error.message : 'Scan failed', 'error');
  } finally {
    discoverScanBtn.disabled = false;
    discoverScanBtn.textContent = 'Scan for brand leads';
  }
});

discoverSelectAll.addEventListener('change', () => {
  selectedBrandKeys.clear();
  if (discoverSelectAll.checked) {
    discoveryBrands
      .filter((brand) => !brand.isUnknown)
      .forEach((brand) => selectedBrandKeys.add(brandKey(brand)));
  }
  discoverResultsBody.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    const target = input as HTMLInputElement;
    if (target.disabled) return;
    target.checked = discoverSelectAll.checked;
  });
  discoverImportBtn.disabled = selectedBrandKeys.size === 0;
});

discoverImportBtn.addEventListener('click', async () => {
  const brands = discoveryBrands.filter((brand) => selectedBrandKeys.has(brandKey(brand)));
  if (!brands.length) return;

  try {
    const result = await api<{ imported: number }>('/api/outreach/discover', {
      method: 'POST',
      body: JSON.stringify({ action: 'import', brands }),
    });
    selectedBrandKeys.clear();
    discoverSelectAll.checked = false;
    discoverImportBtn.disabled = true;
    await loadData();
    showAlert(`Saved ${result.imported} brand lead(s) to Contacts. Add PR emails when you find them.`);
    activateTab('contacts');
  } catch (error) {
    showAlert(error instanceof Error ? error.message : 'Import failed', 'error');
  }
});

generateBtn.addEventListener('click', async () => {
  try {
    await api('/api/outreach/drafts', {
      method: 'POST',
      body: JSON.stringify({
        action: 'generate',
        contactIds: [...selectedContactIds],
      }),
    });
    selectedContactIds.clear();
    selectAll.checked = false;
    await loadData();
    showAlert('Drafts created. Review and edit before sending.');
    activateTab('drafts');
  } catch (error) {
    showAlert(error instanceof Error ? error.message : 'Could not generate drafts', 'error');
  }
});

document.getElementById('import-target-brands')?.addEventListener('click', async () => {
  if (!confirm('Import researched PR emails for the target brand list? Existing matching emails will be skipped.')) {
    return;
  }

  try {
    const result = await api<{ imported: number }>('/api/outreach/enrich', {
      method: 'POST',
      body: JSON.stringify({ action: 'import-default' }),
    });
    await loadData();
    showAlert(`Imported ${result.imported} target brand contacts. Review them before generating drafts.`);
  } catch (error) {
    showAlert(error instanceof Error ? error.message : 'Import failed', 'error');
  }
});

document.getElementById('csv-import')?.addEventListener('change', async (event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const text = await file.text();
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length < 2) {
    showAlert('CSV must include a header row and at least one contact.', 'error');
    return;
  }

  const contactsToImport = rows.slice(1).map((line) => {
    const [name, email, company, role = '', category = '', notes = ''] = line.split(',').map((part) => part.trim());
    return { name, email, company, role, category, notes };
  });

  try {
    await api('/api/outreach/contacts', {
      method: 'POST',
      body: JSON.stringify({ contacts: contactsToImport }),
    });
    input.value = '';
    await loadData();
    showAlert(`Imported ${contactsToImport.length} contacts.`);
  } catch (error) {
    showAlert(error instanceof Error ? error.message : 'Import failed', 'error');
  }
});

void checkAuth();
