import { authError, isAuthenticated, json } from '../../lib/outreach-auth.js';
import {
  resolveBcc,
  resolveFromEmail,
  resolveReplyTo,
} from '../../lib/outreach-email.js';
import { buildHtmlEmail, formatPlainTextEmail } from '../../lib/outreach-templates.js';
import { listDrafts, saveDrafts } from '../../lib/outreach-store.js';

function resendErrorMessage(result) {
  if (typeof result?.message === 'string' && result.message) return result.message;
  if (Array.isArray(result?.errors) && result.errors[0]?.message) return result.errors[0].message;
  return 'Failed to send email via Resend';
}

export async function onRequestPost(context) {
  if (!(await isAuthenticated(context.request, context.env))) return authError();

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { draftId } = body;
  if (!draftId) return json({ error: 'Missing draftId' }, 400);

  if (!context.env.RESEND_API_KEY) {
    return json(
      {
        error:
          'Email sending is not configured. Add RESEND_API_KEY in Cloudflare environment variables.',
      },
      503,
    );
  }

  const fromEmail = resolveFromEmail(context.env);
  const replyTo = resolveReplyTo(context.env);
  const bcc = resolveBcc(context.env);
  const draftBody = String(body.body ?? '').trim();

  try {
    const drafts = await listDrafts(context.env);
    const index = drafts.findIndex((item) => item.id === draftId);
    if (index === -1) return json({ error: 'Draft not found' }, 404);

    const draft = drafts[index];
    if (draft.status === 'sent') {
      return json({ error: 'This draft has already been sent' }, 409);
    }

    const subject = String(body.subject ?? draft.subject).trim();
    const sourceBody = draftBody || String(draft.body ?? '').trim();
    const textBody = formatPlainTextEmail(sourceBody);

    const payload = {
      from: fromEmail,
      to: [draft.contactEmail],
      reply_to: replyTo,
      bcc: [bcc],
      subject,
      text: textBody,
      html: buildHtmlEmail(sourceBody),
    };

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${context.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const raw = await response.text();
    let result = {};
    try {
      result = raw ? JSON.parse(raw) : {};
    } catch {
      result = { message: raw?.slice(0, 200) || 'Unexpected Resend response' };
    }

    if (!response.ok) {
      return json(
        {
          error: resendErrorMessage(result),
          details: result,
          from: fromEmail,
          hint:
            fromEmail !== String(context.env.OUTREACH_FROM_EMAIL || '').trim()
              ? 'Your From address was corrected to use your verified jess-oneill.com domain. Update OUTREACH_FROM_EMAIL in Cloudflare to avoid this.'
              : undefined,
        },
        502,
      );
    }

    drafts[index] = {
      ...draft,
      subject,
      body: sourceBody,
      status: 'sent',
      sentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sentVia: 'resend',
      resendId: result.id ?? null,
    };

    await saveDrafts(context.env, drafts);
    return json({ ok: true, draft: drafts[index] });
  } catch (error) {
    return json({ error: error.message || 'Send failed' }, 503);
  }
}
