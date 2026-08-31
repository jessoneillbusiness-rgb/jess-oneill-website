/** Temporary Canva media kit — switch to site URL when website media kit is final */
export const MEDIA_KIT_URL = 'https://canva.link/q2i85mbldexvw9v';

export const MEDIA_KIT_LINK_TEXT = "View Jess O'Neill's Media Kit";

/** PDF attached to outreach emails (also hosted on site for Resend remote fetch) */
export const MEDIA_KIT_PDF_FILENAME = 'Jess-ONeill-Media-Kit.pdf';
export const MEDIA_KIT_PDF_URL = 'https://www.jess-oneill.com/downloads/Jess-ONeill-Media-Kit.pdf';

export function mediaKitPdfAccessUrl(env = {}) {
  const token = String(env.MEDIA_KIT_ATTACHMENT_TOKEN || '').trim();
  if (!token) return MEDIA_KIT_PDF_URL;
  return `${MEDIA_KIT_PDF_URL}?access=${encodeURIComponent(token)}`;
}

export function buildMediaKitAttachment(env = {}) {
  return {
    filename: MEDIA_KIT_PDF_FILENAME,
    path: mediaKitPdfAccessUrl(env),
  };
}

export function hasValidAttachmentBypass(request, env) {
  const token = String(env.MEDIA_KIT_ATTACHMENT_TOKEN || '').trim();
  if (!token) return false;
  const url = new URL(request.url);
  return url.searchParams.get('access') === token;
}
