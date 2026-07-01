import crypto from 'crypto';

export type CouponTier = 'basic' | 'silver' | 'gold' | 'diamond' | 'admin';
export const couponTiers: CouponTier[] = ['basic', 'silver', 'gold', 'diamond', 'admin'];

export function cleanCouponTier(value: unknown): CouponTier {
  const tier = String(value || '').toLowerCase() as CouponTier;
  if (!couponTiers.includes(tier)) throw new Error('Choose a valid coupon tier.');
  return tier;
}

export function generateCouponCode(tier: string) {
  const prefix = `MYPETID-${String(tier || 'tier').toUpperCase().slice(0, 4)}`;
  const random = crypto.randomBytes(6).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return `${prefix}-${random}`;
}

export function normalizeCouponCode(code: string) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

export function hashCouponCode(code: string) {
  const secret = process.env.MYPETID_COUPON_SECRET || process.env.MYPETID_EMAIL_VERIFICATION_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Coupon secret is not configured.');
  return crypto.createHmac('sha256', secret).update(normalizeCouponCode(code)).digest('hex');
}

export function couponHint(code: string) {
  const normalized = normalizeCouponCode(code);
  return normalized.length <= 4 ? normalized : `••••${normalized.slice(-4)}`;
}

export function grantExpiration(durationDays?: number | null) {
  const days = Number(durationDays || 0);
  if (!Number.isFinite(days) || days <= 0) return null;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
