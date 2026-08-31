import { authError, isAuthenticated, json } from '../../lib/outreach-auth.js';

export async function onRequestGet(context) {
  if (!(await isAuthenticated(context.request, context.env))) return authError();

  return json({
    resendEnabled: Boolean(context.env.RESEND_API_KEY),
  });
}
