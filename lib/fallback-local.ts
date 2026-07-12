export type FallbackAccount = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

export type FallbackSession = {
  id: string;
  email: string;
  displayName: string;
  mode: 'local-fallback';
  signedInAt: string;
};

export type FallbackQueueItem = {
  id: string;
  type: 'profile_save' | 'pet_save' | 'scan_event' | 'upload_metadata' | 'generic';
  status: 'pending' | 'synced' | 'failed';
  createdAt: string;
  updatedAt: string;
  summary: string;
  payload: unknown;
  lastError?: string;
};

const ACCOUNTS_KEY = 'mypetid.fallback.accounts';
const SESSION_KEY = 'mypetid.fallback.session';
const QUEUE_KEY = 'mypetid.fallback.syncQueue';

function isBrowser() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function sha256(input: string) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const bytes = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  // Non-crypto fallback for old browsers. This is only a local outage unlock, never a server credential.
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  return `legacy-${Math.abs(hash)}`;
}

function accounts() {
  return readJson<FallbackAccount[]>(ACCOUNTS_KEY, []);
}

function saveAccounts(next: FallbackAccount[]) {
  writeJson(ACCOUNTS_KEY, next);
}

export function getFallbackSession() {
  return readJson<FallbackSession | null>(SESSION_KEY, null);
}

export function getFallbackQueue() {
  return readJson<FallbackQueueItem[]>(QUEUE_KEY, []);
}

export function getFallbackQueueStats() {
  const queue = getFallbackQueue();
  return {
    total: queue.length,
    pending: queue.filter((item) => item.status === 'pending').length,
    failed: queue.filter((item) => item.status === 'failed').length,
    synced: queue.filter((item) => item.status === 'synced').length,
  };
}

export async function createFallbackAccount(email: string, password: string, displayName?: string) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Enter a valid email for local fallback sign-in.');
  if (password.length < 6) throw new Error('Use at least 6 characters for local fallback sign-in.');
  const existing = accounts();
  const now = new Date().toISOString();
  const passwordHash = await sha256(`${cleanEmail}:${password}`);
  const found = existing.find((account) => account.email === cleanEmail);
  const account: FallbackAccount = found ? {
    ...found,
    displayName: displayName || found.displayName || cleanEmail.split('@')[0],
    passwordHash,
    updatedAt: now,
  } : {
    id: `local-${crypto.randomUUID()}`,
    email: cleanEmail,
    displayName: displayName || cleanEmail.split('@')[0] || 'MyPetID User',
    passwordHash,
    createdAt: now,
    updatedAt: now,
  };
  saveAccounts([account, ...existing.filter((item) => item.email !== cleanEmail)]);
  return signInFallback(cleanEmail, password);
}

export async function signInFallback(email: string, password: string) {
  const cleanEmail = normalizeEmail(email);
  const account = accounts().find((item) => item.email === cleanEmail);
  if (!account) throw new Error('No local fallback account exists for this email on this device. Create one first.');
  const passwordHash = await sha256(`${cleanEmail}:${password}`);
  if (passwordHash !== account.passwordHash) throw new Error('Local fallback password did not match on this device.');
  const session: FallbackSession = {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    mode: 'local-fallback',
    signedInAt: new Date().toISOString(),
  };
  writeJson(SESSION_KEY, session);
  return session;
}

export function signOutFallback() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(SESSION_KEY);
}

export function queueFallbackSync(type: FallbackQueueItem['type'], summary: string, payload: unknown) {
  const now = new Date().toISOString();
  const item: FallbackQueueItem = {
    id: `queue-${crypto.randomUUID()}`,
    type,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    summary,
    payload,
  };
  writeJson(QUEUE_KEY, [item, ...getFallbackQueue()].slice(0, 500));
  return item;
}

export function clearSyncedFallbackItems() {
  writeJson(QUEUE_KEY, getFallbackQueue().filter((item) => item.status !== 'synced'));
}

export function markFallbackItemFailed(id: string, lastError: string) {
  const now = new Date().toISOString();
  writeJson(QUEUE_KEY, getFallbackQueue().map((item) => item.id === id ? { ...item, status: 'failed', lastError, updatedAt: now } : item));
}

export function isServiceRestrictionMessage(message: string) {
  const text = message.toLowerCase();
  return text.includes('exceed_egress_quota') || text.includes('service for this project is restricted') || text.includes('quota') || text.includes('failed to fetch') || text.includes('networkerror');
}
