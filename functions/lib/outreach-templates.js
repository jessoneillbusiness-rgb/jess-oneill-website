import { MEDIA_KIT_LINK_TEXT, MEDIA_KIT_URL } from './outreach-media-kit.js';
import { getMediaMetrics } from './media-metrics.js';
import { buildMetricsIntroParagraph } from './outreach-metrics-summary.js';

const TIKTOK_URL = 'https://www.tiktok.com/@imjesschillin';
const INSTAGRAM_URL = 'https://www.instagram.com/jess.oneill';
const GMAIL_FONT = 'Arial, Helvetica, sans-serif';
const GMAIL_LINK_COLOR = '#1a73e8';

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
  return `<div style="margin: 0; padding: 0; line-height: 1.35; font-family: ${GMAIL_FONT};">
  <div style="margin: 0; padding: 0; font-weight: bold;">Jess O'Neill</div>
  <div style="margin: 0; padding: 0;">
    <strong>TT:</strong> <a href="${TIKTOK_URL}" style="color: ${GMAIL_LINK_COLOR}; text-decoration: none;">@imjesschillin</a>
    &nbsp;|&nbsp;
    <strong>IG:</strong> <a href="${INSTAGRAM_URL}" style="color: ${GMAIL_LINK_COLOR}; text-decoration: none;">@jess.oneill</a>
  </div>
</div>`;
}

function splitBodyLines(body) {
  return normaliseBody(body)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitClosingAndSignature(lines) {
  const closingIndex = lines.findIndex((line) => line === 'Best,');
  if (closingIndex === -1) {
    const signatureIndex = lines.findIndex(isSignatureLine);
    if (signatureIndex === -1) {
      return { contentLines: lines, includeClosing: false };
    }
    return {
      contentLines: lines.slice(0, signatureIndex),
      includeClosing: false,
    };
  }

  return {
    contentLines: lines.slice(0, closingIndex),
    includeClosing: true,
  };
}

function renderHtmlLine(line) {
  if (isMediaKitLinkLine(line)) {
    return `<a href="${MEDIA_KIT_URL}" style="color: ${GMAIL_LINK_COLOR}; font-weight: 600; text-decoration: none;">${MEDIA_KIT_LINK_TEXT}</a>`;
  }
  return escapeHtml(line);
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
  const lines = normaliseBody(body).split('\n');
  const trimmedLines = lines.map((line) => line.trim());
  const { includeClosing } = splitClosingAndSignature(trimmedLines.filter(Boolean));

  const closingIndex = trimmedLines.findIndex((line) => line === 'Best,');
  const bodyLines =
    closingIndex === -1
      ? lines.filter((line, index) => !isSignatureLine(trimmedLines[index]))
      : lines.slice(0, closingIndex);

  const plainLines = bodyLines.map((line) => {
    const trimmed = line.trim();
    if (isMediaKitLinkLine(trimmed)) {
      return `${MEDIA_KIT_LINK_TEXT}: ${MEDIA_KIT_URL}`;
    }
    return line.trim();
  });

  while (plainLines.length && plainLines[plainLines.length - 1] === '') {
    plainLines.pop();
  }

  if (includeClosing || trimmedLines.some(isSignatureLine)) {
    plainLines.push('Best,', '', ...EMAIL_SIGNATURE_PLAIN.split('\n'));
  }

  return plainLines.join('\n');
}

export function buildHtmlEmail(body) {
  const lines = splitBodyLines(body);
  const { contentLines, includeClosing } = splitClosingAndSignature(lines);
  const htmlParts = [];

  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    htmlParts.push(
      `<p style="margin: 0 0 16px 0; padding: 0; font-family: ${GMAIL_FONT}; color: #222222; line-height: 1.5;">${paragraph.join('<br>')}</p>`,
    );
    paragraph = [];
  };

  for (const line of contentLines) {
    if (isSignatureLine(line)) break;
    paragraph.push(renderHtmlLine(line));
  }

  flushParagraph();

  if (includeClosing || lines.some(isSignatureLine)) {
    htmlParts.push(
      `<p style="margin: 0 0 4px 0; padding: 0; font-family: ${GMAIL_FONT}; color: #222222; line-height: 1.5;">Best,</p>`,
    );
    htmlParts.push(buildSignatureHtml());
  }

  return `<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0; font-family: ${GMAIL_FONT}; color: #222222; line-height: 1.5; max-width: 560px;">
${htmlParts.join('\n')}
</body>
</html>`;
}
