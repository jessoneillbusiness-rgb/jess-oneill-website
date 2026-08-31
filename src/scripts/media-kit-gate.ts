import { mediaKit } from '../config/media-kit';

const gateEl = document.getElementById('media-kit-gate')!;
const contentEl = document.getElementById('media-kit-content')!;
const formEl = document.getElementById('media-kit-gate-form') as HTMLFormElement;
const errorEl = document.getElementById('media-kit-gate-error')!;
const submitBtn = document.getElementById('media-kit-gate-submit') as HTMLButtonElement;

function showContent() {
  gateEl.hidden = true;
  contentEl.hidden = false;
  document.dispatchEvent(new CustomEvent('media-kit:unlocked'));
}

function showError(message: string) {
  errorEl.textContent = message;
  errorEl.hidden = !message;
}

async function checkAccess() {
  try {
    const response = await fetch('/api/media-kit/access', { credentials: 'same-origin' });
    const data = await response.json();
    if (data.hasAccess || !data.kvConfigured) {
      showContent();
      return true;
    }
  } catch {
    // keep gate visible
  }
  gateEl.hidden = false;
  contentEl.hidden = true;
  return false;
}

formEl.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError('');

  const formData = new FormData(formEl);
  const payload = {
    email: String(formData.get('email') ?? '').trim(),
    name: String(formData.get('name') ?? '').trim(),
    company: String(formData.get('company') ?? '').trim(),
    newsletter: formData.get('newsletter') === 'on',
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'Unlocking…';

  try {
    const response = await fetch('/api/media-kit/access', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Could not unlock the media kit');
    }
    showContent();
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Could not unlock the media kit');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'View Media Kit';
  }
});

void checkAccess();
