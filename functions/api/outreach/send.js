import { authError, isAuthenticated, json } from '../../lib/outreach-auth.js';
import { buildHtmlEmail } from '../../lib/outreach-templates.js';
import { listDrafts, saveDrafts } from '../../lib/outreach-store.js';

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
          'Email sending is not configured. Add RESEND_API_KEY and OUTREACH_FROM_EMAIL in Cloudflare environment variables.',
      },
      503,
    );
  }

  const fromEmail = context.env.OUTREACH_FROM_EMAIL || 'jess@ykwtalent.com';
  const replyTo = context.env.OUTREACH_REPLY_TO || 'jess@ykwtalent.com';

  try {
    const drafts = await listDrafts(context.env);
    const index = drafts.findIndex((item) => item.id === draftId);
    if (index === -1) return json({ error: 'Draft not found' }, 404);

    const draft = drafts[index];
    if (draft.status === 'sent') {
      return json({ error: 'This draft has already been sent' }, 409);
    }

    const subject = String(body.subject ?? draft.subject).trim();
    const textBody = String(body.body ?? draft.body).trim();

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${context.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [draft.contactEmail],
        reply_to: replyTo,
        subject,
        text: textBody,
        html: buildHtmlEmail(subject, textBody, draft),
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json({ error: result.message || 'Failed to send email', details: result }, 502);
    }

    drafts[index] = {
      ...draft,
      subject,
      body: textBody,
      status: 'sent',
      sentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resendId: result.id ?? null,
    };

    await saveDrafts(context.env, drafts);
    return json({ ok: true, draft: drafts[index] });
  } catch (error) {
    return json({ error: error.message }, 503);
  }
}
