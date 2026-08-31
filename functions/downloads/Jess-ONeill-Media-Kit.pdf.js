import { hasValidAttachmentBypass } from '../lib/outreach-media-kit.js';
import { hasMediaKitAccess } from '../lib/media-kit-access.js';

export async function onRequestGet(context) {
  const allowed =
    (await hasMediaKitAccess(context.request, context.env)) ||
    hasValidAttachmentBypass(context.request, context.env);

  if (!allowed) {
    return Response.redirect(new URL('/media-kit', context.request.url), 302);
  }

  const assetUrl = new URL(context.request.url);
  assetUrl.search = '';
  return context.env.ASSETS.fetch(new Request(assetUrl.toString(), context.request));
}
