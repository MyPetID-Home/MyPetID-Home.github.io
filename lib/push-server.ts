// Server-only helpers for web push (Vercel API routes). Never import from a client component:
// it reads the VAPID private key from the environment.
import { createHash, timingSafeEqual } from 'crypto';
import webpush from 'web-push';
import { serverSupabase } from './server-integrations';

export type PushSubscriptionRow = { id: string; profile_id: string; endpoint: string; p256dh: string; auth: string; failures: number };
export type PushMessage = { title: string; body?: string | null; url?: string | null; kind?: string | null; id?: string | null };

// Browsers only hand out endpoints on these push services. Refusing anything else stops a
// stored "subscription" from turning the dispatcher into a request proxy to arbitrary hosts.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)push\.apple\.com$/];

export function isAllowedPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && PUSH_HOSTS.some((pattern) => pattern.test(url.hostname));
  } catch {
    return false;
  }
}

/** Constant-time string compare (hashing first makes the lengths equal). */
export function safeEqual(a: string, b: string) {
  const left = createHash('sha256').update(a).digest();
  const right = createHash('sha256').update(b).digest();
  return timingSafeEqual(left, right);
}

let configured = false;
export function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}
function configure() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error('Push is not configured on the server (VAPID keys missing).');
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:dev.mypetid-help@yahoo.com', publicKey, privateKey);
  configured = true;
}

/**
 * Sends one message to every saved device of a profile. Subscriptions the push service reports
 * as gone (404/410) are deleted; other failures bump `failures` (rows over 10 failures are dropped).
 */
export async function sendPushToProfile(profileId: string, message: PushMessage) {
  configure();
  const supabase = serverSupabase();
  const { data, error } = await supabase.from('push_subscriptions').select('id,profile_id,endpoint,p256dh,auth,failures').eq('profile_id', profileId).limit(20);
  if (error) throw new Error(error.message);
  const rows = (data || []) as PushSubscriptionRow[];
  const payload = JSON.stringify({
    title: String(message.title || 'MyPetID').slice(0, 120),
    body: String(message.body || '').slice(0, 300),
    url: message.url || '/dashboard/',
    kind: message.kind || 'info',
    id: message.id || null,
  });
  let sent = 0, removed = 0, failed = 0;
  await Promise.all(rows.map(async (row) => {
    if (!isAllowedPushEndpoint(row.endpoint)) {
      await supabase.from('push_subscriptions').delete().eq('id', row.id);
      removed += 1;
      return;
    }
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, { TTL: 60 * 60 * 24, urgency: message.kind === 'alert' || message.kind === 'scan' ? 'high' : 'normal' });
      await supabase.from('push_subscriptions').update({ last_success_at: new Date().toISOString(), failures: 0 }).eq('id', row.id);
      sent += 1;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410 || row.failures >= 10) {
        await supabase.from('push_subscriptions').delete().eq('id', row.id);
        removed += 1;
      } else {
        await supabase.from('push_subscriptions').update({ failures: row.failures + 1 }).eq('id', row.id);
        failed += 1;
      }
    }
  }));
  return { devices: rows.length, sent, removed, failed };
}
