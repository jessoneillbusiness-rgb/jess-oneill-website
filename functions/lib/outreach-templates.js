import { MEDIA_KIT_LABEL, MEDIA_KIT_URL } from './outreach-media-kit.js';

const BUSINESS_EMAIL = 'jessoneill.business@gmail.com';

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

You can view my media kit here — it includes audience stats, platform info, and collaboration options:
${MEDIA_KIT_URL}

I'd love to explore how we could work together on a campaign, launch, or brand story. Happy to share ideas tailored to ${company}'s goals.

Best,
Jess O'Neill
${BUSINESS_EMAIL}
www.jess-oneill.com`;

  return { subject, body };
}

export function buildHtmlEmail(subject, body, contact) {
  const htmlBody = body
    .split('\n')
    .map((line) => {
      if (line.startsWith('http')) {
        return `<p><a href="${line}">${MEDIA_KIT_LABEL}</a></p>`;
      }
      return `<p>${line || '&nbsp;'}</p>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html>
<body style="font-family: Georgia, serif; color: #111; line-height: 1.6; max-width: 560px;">
${htmlBody}
<hr style="border: none; border-top: 1px solid #e2e2e2; margin: 24px 0;" />
<p style="font-size: 12px; color: #5c5c5c;">
  ${MEDIA_KIT_LABEL}: <a href="${MEDIA_KIT_URL}">${MEDIA_KIT_URL}</a>
</p>
</body>
</html>`;
}
