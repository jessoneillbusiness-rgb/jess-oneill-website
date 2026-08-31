type Contact = {
  id: string;
  name: string;
  email: string;
  company: string;
  role?: string;
  category?: string;
  notes?: string;
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
};

const loginEl = document.getElementById('outreach-login')!;
const dashboardEl = document.getElementById('outreach-dashboard')!;
const loginForm = document.getElementById('outreach-login-form') as HTMLFormElement;
const loginError = document.getElementById('outreach-login-error')!;
const alertEl = document.getElementById('outreach-alert')!;
const contactsBody = document.getElementById('contacts-table-body')!;
const draftsList = document.getElementById('drafts-list')!;
const sentList = document.getElementById('sent-list')!;
const generateBtn = document.getElementById('generate-drafts') as HTMLButtonElement;
const selectAll = document.getElementById('select-all-contacts') as HTMLInputElement;

let contacts: Contact[] = [];
let drafts: Draft[] = [];
const selectedContactIds = new Set<string>();

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
    throw new Error(data.error || 'Request failed');
  }
  return data as T;
}

function showAlert(message: string, type: 'success' | 'error' = 'success') {
  alertEl.textContent = message;
  alertEl.className = `outreach-alert outreach-alert--${type}`;
  alertEl.hidden = false;
  window.setTimeout(() => {
    alertEl.hidden = true;
  }, 5000);
}

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
  const [contactsRes, draftsRes] = await Promise.all([
    api<{ contacts: Contact[] }>('/api/outreach/contacts'),
    api<{ drafts: Draft[] }>('/api/outreach/drafts'),
  ]);
  contacts = contactsRes.contacts;
  drafts = draftsRes.drafts;
  renderContacts();
  renderDrafts();
  renderSent();
}

function renderContacts() {
  if (contacts.length === 0) {
    contactsBody.innerHTML = '<tr><td colspan="6" class="outreach-empty">No contacts yet.</td></tr>';
    generateBtn.disabled = true;
    return;
  }

  contactsBody.innerHTML = contacts
    .map(
      (contact) => `
      <tr>
        <td><input type="checkbox" data-contact-id="${contact.id}" ${selectedContactIds.has(contact.id) ? 'checked' : ''} /></td>
        <td>${escapeHtml(contact.name)}</td>
        <td>${escapeHtml(contact.email)}</td>
        <td>${escapeHtml(contact.company)}</td>
        <td>${escapeHtml(contact.category || '—')}</td>
        <td><button type="button" class="outreach-link-btn" data-delete-contact="${contact.id}">Delete</button></td>
      </tr>
    `,
    )
    .join('');

  generateBtn.disabled = selectedContactIds.size === 0;

  contactsBody.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement;
      const id = target.dataset.contactId!;
      if (target.checked) selectedContactIds.add(id);
      else selectedContactIds.delete(id);
      generateBtn.disabled = selectedContactIds.size === 0;
      selectAll.checked = selectedContactIds.size === contacts.length;
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

function renderDraftCard(draft: Draft, mode: 'pending' | 'sent') {
  if (mode === 'sent') {
    return `
      <article class="outreach-draft outreach-draft--sent">
        <header class="outreach-draft__header">
          <div>
            <h3>${escapeHtml(draft.contactName)} · ${escapeHtml(draft.contactCompany)}</h3>
            <p>${escapeHtml(draft.contactEmail)}</p>
          </div>
          <span class="outreach-badge outreach-badge--sent">Sent ${draft.sentAt ? new Date(draft.sentAt).toLocaleString() : ''}</span>
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
      <div class="outreach-draft__actions">
        <button type="button" class="btn btn--primary draft-send">Approve & send</button>
        <button type="button" class="btn btn--outline-dark draft-save">Save edits</button>
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

    card.querySelector('.draft-delete')?.addEventListener('click', async () => {
      if (!confirm('Delete this draft?')) return;
      await api(`/api/outreach/drafts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      await loadData();
      showAlert('Draft deleted.');
    });

    card.querySelector('.draft-send')?.addEventListener('click', async () => {
      const draft = drafts.find((item) => item.id === id);
      const recipient = draft?.contactEmail ?? 'this contact';
      if (!confirm(`Send this email to ${recipient}?`)) return;

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
        showAlert('Email sent.');
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
  if (selectAll.checked) contacts.forEach((contact) => selectedContactIds.add(contact.id));
  renderContacts();
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
