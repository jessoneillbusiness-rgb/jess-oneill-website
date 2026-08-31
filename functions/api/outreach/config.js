import { authError, isAuthenticated, json } from '../../lib/outreach-auth.js';
import {
  DEFAULT_FROM_EMAIL,
  OUTREACH_BUSINESS_EMAIL,
  resolveBcc,
  resolveFromEmail,
  resolveReplyTo,
} from '../../lib/outreach-email.js';

export async function onRequestGet(context) {
  if (!(await isAuthenticated(context.request, context.env))) return authError();

  const configuredFrom = String(context.env.OUTREACH_FROM_EMAIL || '').trim();

  return json({
    resendEnabled: Boolean(context.env.RESEND_API_KEY),
    fromEmail: resolveFromEmail(context.env),
    replyTo: resolveReplyTo(context.env),
    bcc: resolveBcc(context.env),
    configuredFrom: configuredFrom || null,
    usingDefaultFrom:
      !configuredFrom ||
      configuredFrom.toLowerCase().includes('@gmail.com') ||
      configuredFrom.toLowerCase().includes('@outlook.com'),
    defaultFrom: DEFAULT_FROM_EMAIL,
    businessEmail: OUTREACH_BUSINESS_EMAIL,
  });
}
