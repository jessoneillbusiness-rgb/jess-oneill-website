import { MEDIA_KIT_LINK_TEXT, MEDIA_KIT_URL } from './outreach-media-kit.js';

const BUSINESS_EMAIL = 'jessoneill.business@gmail.com';
const LINK_LINE_ALIASES = [
  MEDIA_KIT_LINK_TEXT,
  "View Jess O'Neill's Media Kit",
  'View Jess O\'Neill\'s Media Kit',
  'View my media kit',
];

function isMediaKitLinkLine(line) {
  const trimmed = line.trim();
  if (trimmed === MEDIA_KIT_URL) return true;
  return LINK_LINE_ALIASES.some((alias) => trimmed === alias);
}

export function buildDraftEmail(contact) {
  const firstName = contact.name?.trim().split(/\s+/)[0] || 'there';
  const company = contact.company?.trim() || 'your team';
  const category = contact.category?.trim();

  const categoryLine = category
    ? `I've been following ${company}'s work in ${category.toLowerCase()} and think there could be a strong fit.`
    : `I've been following ${company}'s work and think there could be a strong fit.`;

  const subject = `Partnership enquiry — Jess O'Neill x ${company}`;

  const body = `Hi ${firstName},

${categoryLine}

I'm Jess O'Neill, a NYC-based creator focused on travel, food, beauty, and lifestyle. I share polished, relatable content with an engaged audience across Instagram, TikTok, Facebook, and my site.

My media kit includes audience stats, platform info, and collaboration options:
${MEDIA_KIT_LINK_TEXT}

I'd love to explore how we could work together on a campaign, launch, or brand story. Happy to share ideas tailored to ${company}'s goals.

Best,
Jess O'Neill
${BUSINESS_EMAIL}
www.jess-oneill.com`;

  return { subject, body };
}

function normaliseBody(body) {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== MEDIA_KIT_URL && !line.startsWith('http'))
    .join('\n');
}

export function formatPlainTextEmail(body) {
  const lines = normaliseBody(body).split('\n');
  return lines
    .map((line) => {
      if (isMediaKitLinkLine(line)) {
        return `${MEDIA_KIT_LINK_TEXT}: ${MEDIA_KIT_URL}`;
      }
      return line;
    })
    .join('\n');
}

export function buildHtmlEmail(body) {
  const htmlBody = normaliseBody(body)
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (isMediaKitLinkLine(trimmed)) {
        return `<p><a href="${MEDIA_KIT_URL}" style="color: #0abab5; font-weight: 600;">${MEDIA_KIT_LINK_TEXT}</a></p>`;
      }
      if (trimmed.startsWith('www.')) {
        return `<p><a href="https://${trimmed}">${trimmed}</a></p>`;
      }
      return `<p>${line || '&nbsp;'}</p>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html>
<body style="font-family: Georgia, serif; color: #111; line-height: 1.6; max-width: 560px;">
${htmlBody}
</body>
</html>`;
}
