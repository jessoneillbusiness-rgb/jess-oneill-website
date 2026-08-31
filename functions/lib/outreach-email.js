/** Shared outreach email settings */
export const OUTREACH_BUSINESS_EMAIL = 'jessoneill.business@gmail.com';

export const DEFAULT_FROM_EMAIL = "Jess O'Neill <partnerships@jess-oneill.com>";

/** Resend requires a verified domain — Gmail/Outlook cannot be used as the From address. */
export function resolveFromEmail(env) {
  const configured = String(env.OUTREACH_FROM_EMAIL || '').trim();

  if (!configured) return DEFAULT_FROM_EMAIL;

  const lower = configured.toLowerCase();
  if (
    lower.includes('@gmail.com') ||
    lower.includes('@googlemail.com') ||
    lower.includes('@outlook.com') ||
    lower.includes('@hotmail.com') ||
    lower.includes('@live.com')
  ) {
    return DEFAULT_FROM_EMAIL;
  }

  if (configured.includes('<') && configured.includes('>')) {
    return configured;
  }

  if (configured.includes('@')) {
    return `Jess O'Neill <${configured}>`;
  }

  return DEFAULT_FROM_EMAIL;
}

export function resolveReplyTo(env) {
  return String(env.OUTREACH_REPLY_TO || OUTREACH_BUSINESS_EMAIL).trim();
}

export function resolveBcc(env) {
  return String(env.OUTREACH_BCC || OUTREACH_BUSINESS_EMAIL).trim();
}
