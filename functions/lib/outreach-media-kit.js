/** Temporary Canva media kit — switch to site URL when website media kit is final */
export const MEDIA_KIT_URL = 'https://canva.link/q2i85mbldexvw9v';

export const MEDIA_KIT_LINK_TEXT = "View Jess O'Neill's Media Kit";

/** PDF attached to outreach emails (also hosted on site for Resend remote fetch) */
export const MEDIA_KIT_PDF_FILENAME = 'Jess-ONeill-Media-Kit.pdf';
export const MEDIA_KIT_PDF_URL = 'https://www.jess-oneill.com/downloads/Jess-ONeill-Media-Kit.pdf';

export function buildMediaKitAttachment() {
  return {
    filename: MEDIA_KIT_PDF_FILENAME,
    path: MEDIA_KIT_PDF_URL,
  };
}
