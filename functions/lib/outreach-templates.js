import { MEDIA_KIT_LINK_TEXT, MEDIA_KIT_URL } from './outreach-media-kit.js';
import { getMediaMetrics } from './media-metrics.js';
import { buildMetricsIntroParagraph } from './outreach-metrics-summary.js';

const TIKTOK_URL = 'https://www.tiktok.com/@imjesschillin';
const INSTAGRAM_URL = 'https://www.instagram.com/jess.oneill';
const GMAIL_FONT = 'Arial, Helvetica, sans-serif';
const GMAIL_LINK_COLOR = '#1a73e8';
const EMAIL_TEXT_COLOR = '#222222';
const EMAIL_FONT_SIZE = '14px';
const PARAGRAPH_SPACING = '12px';

const PARAGRAPH_STYLE = `margin: 0 0 ${PARAGRAPH_SPACING} 0; padding: 0; font-family: ${GMAIL_FONT}; font-size: ${EMAIL_FONT_SIZE}; color: ${EMAIL_TEXT_COLOR}; line-height: 1.5;`;

const LINK_LINE_ALIASES = [
  MEDIA_KIT_LINK_TEXT,
  "View Jess O'Neill's Media Kit",
  'View Jess O\'Neill\'s Media Kit',
  'View my media kit',
];

const LEGACY_SIGNATURE_LINES = new Set([
  'jessoneill.business@gmail.com',
  'www.jess-oneill.com',
]);

export const EMAIL_SIGNATURE_PLAIN = `Jess O'Neill
TT: @imjesschillin | IG: @jess.oneill`;

function isMediaKitLinkLine(line) {
  const trimmed = line.trim();
  if (trimmed === MEDIA_KIT_URL) return true;
  return LINK_LINE_ALIASES.some((alias) => trimmed === alias);
}

function isSignatureLine(line) {
  const trimmed = line.trim();
  if (trimmed === "Jess O'Neill") return true;
  if (LEGACY_SIGNATURE_LINES.has(trimmed.toLowerCase())) return true;
  return /^TT:\s*@imjesschillin\s*\|\s*IG:\s*@jess\.oneill$/i.test(trimmed);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSignatureHtml() {
  return `<div style="margin: 0; padding: 0; font-family: ${GMAIL_FONT}; font-size: ${EMAIL_FONT_SIZE}; color: ${EMAIL_TEXT_COLOR}; line-height: 1.35;">
  <div style="margin: 0; padding: 0; font-weight: bold;">Jess O'Neill</div>
  <div style="margin: 0; padding: 0;">
    <strong>TT:</strong> <a href="${TIKTOK_URL}" style="color: ${GMAIL_LINK_COLOR}; text-decoration: underline;">@imjesschillin</a>
    &nbsp;|&nbsp;
    <strong>IG:</strong> <a href="${INSTAGRAM_URL}" style="color: ${GMAIL_LINK_COLOR}; text-decoration: underline;">@jess.oneill</a>
  </div>
</div>`;
}

function formatPlainSignature() {
  return `Jess O'Neill
TT: @imjesschillin (${TIKTOK_URL}) | IG: @jess.oneill (${INSTAGRAM_URL})`;
}

function parseParagraphs(body) {
  const lines = normaliseBody(body).split('\n');
  const paragraphs = [];
  let current = [];

  const flush = () => {
    if (current.length) {
      paragraphs.push([...current]);
      current = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line === 'Best,' || isSignatureLine(line)) {
      flush();
      break;
    }
    current.push(line);
  }

  return paragraphs;
}

function hasClosing(body) {
  const lines = normaliseBody(body)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.some((line) => line === 'Best,') || lines.some(isSignatureLine);
}

function formatPlainParagraph(lines) {
  return lines
    .map((line) => {
      if (isMediaKitLinkLine(line)) {
        return `${MEDIA_KIT_LINK_TEXT}: ${MEDIA_KIT_URL}`;
      }
      return line;
    })
    .join('\n');
}

function renderHtmlParagraph(lines) {
  const chunks = [];

  for (const line of lines) {
    if (isMediaKitLinkLine(line)) {
      chunks.push(
        `<a href="${MEDIA_KIT_URL}" style="color: ${GMAIL_LINK_COLOR}; font-weight: 600; text-decoration: underline;">${MEDIA_KIT_LINK_TEXT}</a>`,
      );
      continue;
    }
    chunks.push(escapeHtml(line));
  }

  if (chunks.length === 1) {
    return `<p style="${PARAGRAPH_STYLE}">${chunks[0]}</p>`;
  }

  return `<p style="${PARAGRAPH_STYLE}">${chunks.join('<br>')}</p>`;
}

function renderHtmlParagraphs(paragraphs) {
  const htmlParts = [];

  for (const lines of paragraphs) {
    const linkIndex = lines.findIndex(isMediaKitLinkLine);

    if (linkIndex === -1) {
      htmlParts.push(renderHtmlParagraph(lines));
      continue;
    }

    const beforeLink = lines.slice(0, linkIndex).filter(Boolean);
    const linkLine = lines[linkIndex];
    const afterLink = lines.slice(linkIndex + 1).filter(Boolean);

    if (beforeLink.length) {
      htmlParts.push(renderHtmlParagraph(beforeLink));
    }

    htmlParts.push(renderHtmlParagraph([linkLine]));

    if (afterLink.length) {
      htmlParts.push(renderHtmlParagraph(afterLink));
    }
  }

  return htmlParts;
}

export async function buildDraftEmail(contact, env = {}) {
  const firstName = contact.name?.trim().split(/\s+/)[0] || 'there';
  const company = contact.company?.trim() || 'your team';
  const category = contact.category?.trim();

  const categoryLine = category
    ? `I've been following ${company}'s work in ${category.toLowerCase()} and think there could be a strong fit.`
    : `I've been following ${company}'s work and think there could be a strong fit.`;

  const subject = `Partnership enquiry — Jess O'Neill x ${company}`;

  let introParagraph;
  try {
    const metrics = await getMediaMetrics(env, { timeoutMs: 6000 });
    introParagraph = buildMetricsIntroParagraph(metrics);
  } catch {
    introParagraph = buildMetricsIntroParagraph(null);
  }

  const body = `Hi ${firstName},

${introParagraph}

${categoryLine}

My media kit includes audience stats, platform info, and collaboration options:
${MEDIA_KIT_LINK_TEXT}

I'd love to explore how we could work together on a campaign, launch, or brand story. Happy to share ideas tailored to ${company}'s goals.

Best,

${EMAIL_SIGNATURE_PLAIN}`;

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
  const paragraphs = parseParagraphs(body).map(formatPlainParagraph).filter(Boolean);
  const parts = [...paragraphs];

  if (hasClosing(body)) {
    parts.push(`Best,\n${formatPlainSignature()}`);
  }

  return parts.join('\n\n');
}

export function buildHtmlEmail(body) {
  const paragraphs = parseParagraphs(body);
  const htmlParts = renderHtmlParagraphs(paragraphs);

  if (hasClosing(body)) {
    htmlParts.push(`<p style="${PARAGRAPH_STYLE} margin-bottom: 8px;">Best,</p>`);
    htmlParts.push(buildSignatureHtml());
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff;">
  <div style="margin: 0; padding: 0; font-family: ${GMAIL_FONT}; font-size: ${EMAIL_FONT_SIZE}; color: ${EMAIL_TEXT_COLOR}; line-height: 1.5; max-width: 600px;">
${htmlParts.join('\n')}
  </div>
</body>
</html>`;
}
