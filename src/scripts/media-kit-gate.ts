type PreviewPlatform = {
  followers: number | null;
  followersLabel: string | null;
  totalLikes: number | null;
  totalLikesLabel: string | null;
  avgViews: number | null;
  avgViewsLabel: string | null;
  avgLikesPerVideo: number | null;
  avgLikesPerVideoLabel: string | null;
  avgReach: number | null;
  avgReachLabel: string | null;
  avgEngagement: number | null;
  avgEngagementLabel: string | null;
  monthlyViews: number | null;
  monthlyViewsLabel: string | null;
};

type PreviewMetrics = {
  totalAudience: number | null;
  totalAudienceLabel: string | null;
  totalLabel?: string | null;
  platforms: {
    instagram: PreviewPlatform | null;
    tiktok: PreviewPlatform | null;
  };
};

const gateEl = document.getElementById('media-kit-gate')!;
const contentEl = document.getElementById('media-kit-content')!;
const formEl = document.getElementById('media-kit-gate-form') as HTMLFormElement;
const errorEl = document.getElementById('media-kit-gate-error')!;
const submitBtn = document.getElementById('media-kit-gate-submit') as HTMLButtonElement;
const previewTotalEl = document.getElementById('media-kit-preview-total')!;
const previewPlatformsEl = document.getElementById('media-kit-preview-platforms')!;

const previewTotalLabelEl = document.getElementById('media-kit-preview-total-label')!;

const SUBMIT_LABEL = 'View Media Kit';

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

function resetSubmitButton() {
  submitBtn.disabled = false;
  submitBtn.textContent = SUBMIT_LABEL;
}

function showContent() {
  gateEl.hidden = true;
  contentEl.hidden = false;
  gateEl.style.display = 'none';
  contentEl.style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.dispatchEvent(new CustomEvent('media-kit:unlocked'));
}

function showError(message: string) {
  errorEl.textContent = message;
  errorEl.hidden = !message;
}

function platformLine(name: string, platform: PreviewPlatform | null) {
  if (!platform?.followersLabel) return '';

  const details = [`${platform.followersLabel} followers`];
  if (platform.avgViewsLabel) details.push(`${platform.avgViewsLabel} avg. views`);
  if (platform.avgLikesPerVideoLabel) details.push(`${platform.avgLikesPerVideoLabel} avg. likes/video`);
  if (platform.avgReachLabel) details.push(`${platform.avgReachLabel} avg. reach`);
  if (platform.avgEngagementLabel) details.push(`${platform.avgEngagementLabel} avg. engagement`);
  if (platform.monthlyViewsLabel) details.push(`${platform.monthlyViewsLabel} monthly views`);
  if (platform.totalLikesLabel) details.push(`${platform.totalLikesLabel} total likes`);

  return `
    <div class="media-kit-gate__preview-platform">
      <strong>${name}</strong>
      <span>${details.join(' · ')}</span>
    </div>
  `;
}

async function loadPreviewMetrics() {
  try {
    const response = await fetchWithTimeout('/api/media-kit/preview-metrics');
    if (!response.ok) throw new Error('Failed to load preview metrics');
    const data = (await response.json()) as PreviewMetrics;

    previewTotalEl.textContent = data.totalAudienceLabel || '—';
    if (data.totalLabel) {
      previewTotalLabelEl.textContent = data.totalLabel;
    }

    const rows = [
      platformLine('Instagram', data.platforms.instagram),
      platformLine('TikTok', data.platforms.tiktok),
    ].filter(Boolean);

    previewPlatformsEl.innerHTML =
      rows.join('') ||
      '<p class="media-kit-gate__preview-footnote">Live audience stats are updating. Unlock the full media kit for complete metrics.</p>';
  } catch {
    previewTotalEl.textContent = '—';
    previewPlatformsEl.innerHTML =
      '<p class="media-kit-gate__preview-footnote">Live audience stats are updating. Unlock the full media kit for complete metrics.</p>';
  }
}

async function checkAccess() {
  try {
    const response = await fetchWithTimeout('/api/media-kit/access', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const data = await response.json();
    if (data.hasAccess || !data.kvConfigured) {
      showContent();
      return true;
    }
  } catch {
    // keep gate visible
  }

  gateEl.hidden = false;
  gateEl.style.display = '';
  contentEl.hidden = true;
  contentEl.style.display = 'none';
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
    const response = await fetchWithTimeout('/api/media-kit/access', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Could not unlock the media kit');
    }

    if (data.ok && data.hasAccess) {
      showContent();
      return;
    }

    const verified = await checkAccess();
    if (!verified) {
      throw new Error(
        'Your access was saved, but this browser blocked the unlock cookie. Try again or use a regular browser window.',
      );
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      showError('That took too long. Please try again.');
    } else {
      showError(error instanceof Error ? error.message : 'Could not unlock the media kit');
    }
  } finally {
    if (!gateEl.hidden) {
      resetSubmitButton();
    }
  }
});

void loadPreviewMetrics();
void checkAccess();
