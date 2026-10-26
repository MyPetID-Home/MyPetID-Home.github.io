/**
 * The permanent public address printed on cards and written to NFC tags. It must not depend on
 * where the admin happens to be signed in (localhost, a preview, GitHub Pages), because a tag
 * can't be changed after it ships. Set NEXT_PUBLIC_APP_BASE_URL to move to a custom domain.
 */
export const PUBLIC_APP_URL = (process.env.NEXT_PUBLIC_APP_BASE_URL || 'https://mypetid.vercel.app').replace(/\/+$/, '');

/** A tag's public page (what the NFC chip, card QR and barcode open), e.g. /public/MPID-000001. */
export function publicTagUrl(tagCode: string) {
  return `${PUBLIC_APP_URL}/public/${encodeURIComponent(tagCode)}`;
}
/** Kept for older callers; same page as publicTagUrl. */
export const tagScanUrl = publicTagUrl;
