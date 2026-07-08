"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { hasSupabaseConfig, isAdminEmail, supabase } from '../lib/supabase';

type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  phone: string | null;
  tier: 'free' | 'basic' | 'silver' | 'gold' | 'diamond' | 'admin';
  is_admin: boolean;
  patreon_linked?: boolean;
  patreon_tier?: string | null;
  email_verified_at?: string | null;
  public_contact?: Record<string, unknown> | null;
};

type PetRow = {
  id: string;
  owner_id: string;
  name: string;
  species: string;
  breed: string | null;
  photo_url: string | null;
  medical_public: string | null;
  behavior_public: string | null;
  contact_public: Record<string, unknown> | null;
  lost_mode: boolean;
  feeding_plan?: string | null;
  care_notes?: string | null;
  public_fields?: string[] | null;
};

type TagRow = {
  id: string;
  tag_code: string;
  pet_id: string | null;
  created_by: string | null;
  claimed_at: string | null;
  claim_code_hint?: string | null;
  nfc_uid?: string | null;
  status?: string | null;
  created_at: string;
};

type ScanRow = {
  id: string;
  tag_id: string | null;
  pet_id: string | null;
  actor: 'owner' | 'linked_user' | 'stranger';
  scanner_profile_id: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  note: string | null;
  reported_lost: boolean;
  found_status?: string | null;
  finder_contact?: string | null;
  finder_note?: string | null;
  owner_follow_up?: string | null;
  owner_resolution_note?: string | null;
  resolved_at?: string | null;
  created_at: string;
};

type DeviceRow = {
  id: string;
  profile_id: string;
  device_fingerprint: string;
  trusted: boolean;
  label: string | null;
  created_at: string;
};

type MembershipSummary = {
  effective_tier: 'free' | 'basic' | 'silver' | 'gold' | 'diamond' | 'admin';
  provider: string;
  status: string;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  active_grant?: Record<string, any> | null;
  limits: { max_tags: number | null; max_users: number | null; scan_tracking_enabled: boolean };
  usage: { active_tags: number; pets: number; helpers: number };
  remaining: { tags: number | null; users: number | null };
};

type AdminMembershipAccount = {
  profile: Profile;
  membership: MembershipSummary;
  grants: Array<Record<string, any>>;
};

type AccessCoupon = {
  id: string;
  code_hint: string | null;
  tier: 'basic' | 'silver' | 'gold' | 'diamond' | 'admin';
  duration_days: number | null;
  max_redemptions: number;
  redemption_count: number;
  status: string;
  recipient_email: string | null;
  expires_at: string | null;
  redeemed_at: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
};

type ProviderAdminSnapshot = {
  tiers: Array<Record<string, any>>;
  stripe: { products: Array<Record<string, any>>; prices: Array<Record<string, any>>; coupons: Array<Record<string, any>>; promotion_codes: Array<Record<string, any>>; errors?: string[] };
  patreon: { campaigns: Array<Record<string, any>>; included: Array<Record<string, any>>; editable_in_app: boolean; note?: string; error?: string };
  capabilities: Record<string, any>;
};

type AdminDebugRow = {
  profile_id: string;
  email: string | null;
  display_name: string | null;
  phone: string | null;
  tier: string;
  is_admin: boolean;
  pet_count: number;
  tag_count: number;
  scan_count: number;
  device_count: number;
  document_count: number;
  care_event_count: number;
  calendar_event_count: number;
  verification_count: number;
  last_activity_at: string | null;
};

type ActivityLogRow = {
  id: string;
  event_time: string;
  actor_email: string | null;
  target_profile_id: string | null;
  target_pet_id: string | null;
  target_table: string;
  target_record_id: string | null;
  action: string;
  changed_fields: string[] | null;
  note: string | null;
};

type AwardRuleRow = {
  id: string;
  title: string;
  category: string;
  icon: string;
  trigger_key: string;
  target: number;
  points: number;
  requirement: string;
  active: boolean;
  admin_locked: boolean;
};

type TrainingCommandRow = {
  id: string;
  pet_id: string;
  command: string;
  verbal_cue: string | null;
  hand_signal: string | null;
  proofing_goal: string | null;
  status: string;
  points: number;
  notes: string | null;
  created_at: string;
};

type XpEventRow = {
  id: string;
  profile_id: string | null;
  pet_id: string | null;
  award_rule_id: string | null;
  event_type: string;
  points: number;
  note: string | null;
  created_at: string;
};

type FulfillmentOrder = {
  id: string;
  profile_id: string | null;
  pet_id: string | null;
  tag_product_id: string | null;
  provider: string;
  provider_checkout_id: string | null;
  provider_payment_id: string | null;
  status: string;
  amount_cents: number | null;
  currency: string | null;
  public_pet_url: string | null;
  qr_payload: string | null;
  ship_to: Record<string, any> | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  product?: { name?: string | null; slug?: string | null; tag_type?: string | null; price_cents?: number | null } | null;
  profile?: { email?: string | null; display_name?: string | null; phone?: string | null; tier?: string | null } | null;
  pet?: { name?: string | null; species?: string | null; breed?: string | null; photo_url?: string | null; lost_mode?: boolean | null } | null;
};

type PetDraft = {
  id?: string;
  name: string;
  species: string;
  breed: string;
  photoUrl: string;
  medicalPublic: string;
  behaviorPublic: string;
  publicPhone: string;
  publicEmail: string;
  lostMode: boolean;
};

const emptyPetDraft: PetDraft = {
  name: 'Clyde',
  species: 'dog',
  breed: 'Good boy mix',
  photoUrl: '/images/dog/Clyde-Nice.jpg',
  medicalPublic: 'Sensitive stomach. Avoid rich treats unless needed for safety.',
  behaviorPublic: 'Friendly, loves tug, nervous around loud trucks.',
  publicPhone: '',
  publicEmail: '',
  lostMode: false,
};

const dogBreedOptions = ['Affenpinscher', 'Afghan Hound', 'Airedale Terrier', 'Akita', 'Alaskan Malamute', 'American Bulldog', 'American Eskimo Dog', 'American Foxhound', 'American Hairless Terrier', 'American Pit Bull Terrier', 'American Staffordshire Terrier', 'Australian Cattle Dog', 'Australian Shepherd', 'Basenji', 'Basset Hound', 'Beagle', 'Bearded Collie', 'Beauceron', 'Bernese Mountain Dog', 'Bichon Frise', 'Black and Tan Coonhound', 'Bloodhound', 'Border Collie', 'Border Terrier', 'Borzoi', 'Boston Terrier', 'Boxer', 'Boykin Spaniel', 'Brittany', 'Brussels Griffon', 'Bull Terrier', 'Bulldog', 'Bullmastiff', 'Cairn Terrier', 'Cane Corso', 'Cardigan Welsh Corgi', 'Cavalier King Charles Spaniel', 'Chihuahua', 'Chinese Crested', 'Chinese Shar-Pei', 'Chow Chow', 'Cocker Spaniel', 'Collie', 'Corgi', 'Dachshund', 'Dalmatian', 'Doberman Pinscher', 'Dogo Argentino', 'English Setter', 'English Springer Spaniel', 'French Bulldog', 'German Pinscher', 'German Shepherd Dog', 'German Shorthaired Pointer', 'Giant Schnauzer', 'Golden Retriever', 'Goldendoodle', 'Great Dane', 'Great Pyrenees', 'Greyhound', 'Havanese', 'Husky', 'Irish Setter', 'Irish Wolfhound', 'Italian Greyhound', 'Jack Russell Terrier', 'Labradoodle', 'Labrador Retriever', 'Lhasa Apso', 'Maltese', 'Mastiff', 'Miniature Pinscher', 'Miniature Schnauzer', 'Mixed Breed', 'Newfoundland', 'Norwegian Elkhound', 'Old English Sheepdog', 'Papillon', 'Pekingese', 'Pembroke Welsh Corgi', 'Pit Bull / Bully Mix', 'Pointer', 'Pomeranian', 'Poodle', 'Portuguese Water Dog', 'Pug', 'Rat Terrier', 'Rhodesian Ridgeback', 'Rottweiler', 'Saint Bernard', 'Samoyed', 'Schipperke', 'Shetland Sheepdog', 'Shiba Inu', 'Shih Tzu', 'Siberian Husky', 'Staffordshire Bull Terrier', 'Vizsla', 'Weimaraner', 'Welsh Terrier', 'West Highland White Terrier', 'Whippet', 'Yorkshire Terrier', 'Other / custom'];
function fmtDate(value?: string | null) { return value ? new Date(value).toLocaleString() : 'n/a'; }
function installId() {
  if (typeof window === 'undefined') return 'server';
  const key = 'mypetid.installId';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(key, next);
  return next;
}
function randomDigits(length: number) { return Array.from({ length }, () => Math.floor(Math.random() * 10)).join(''); }
function randomAlphaNum(length: number) { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
function makeCardId() { return `MPID-${randomAlphaNum(4)}-${randomAlphaNum(4)}`; }
function makeClaimCode() {
  const digits = randomDigits(4);
  const inner = ['M', randomDigits(1), 'P', randomDigits(1), 'I', randomDigits(1), 'D', randomDigits(1)].join('');
  return `${digits}-${inner}`;
}
function normalizeClaim(value: string) { return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); }
async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(normalizeClaim(value));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function authValue(token: string) { return [String.fromCharCode(66, 101, 97, 114, 101, 114), token].join(' '); }
function limitLabel(value: number | null) { return value === null ? 'Unlimited' : String(value); }
function money(cents?: number | null, currency = 'usd') { return cents == null ? 'n/a' : new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'usd' }).format(cents / 100); }
function shippingSummary(shipTo?: Record<string, any> | null) {
  const details = shipTo || {};
  const address = details.address || {};
  return [details.name, address.line1, address.line2, address.city, address.state, address.postal_code].filter(Boolean).join(', ') || 'No shipping address yet';
}
const fulfillmentStatuses = ['paid', 'queued', 'printing', 'shipped', 'delivered', 'manual_review', 'cancelled', 'refunded'];

function petToDraft(pet: PetRow): PetDraft {
  const contact = pet.contact_public || {};
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed || '',
    photoUrl: pet.photo_url || '',
    medicalPublic: pet.medical_public || '',
    behaviorPublic: pet.behavior_public || '',
    publicPhone: typeof contact.phone === 'string' ? contact.phone : '',
    publicEmail: typeof contact.email === 'string' ? contact.email : '',
    lostMode: pet.lost_mode,
  };
}


async function ensureProfile(user: User) {
  if (!supabase) throw new Error('Supabase unavailable');
  const { data: existing, error: readError } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (readError) throw readError;
  if (existing) return existing as Profile;

  const admin = isAdminEmail(user.email);
  const fallback = {
    id: user.id,
    email: user.email ?? null,
    display_name: user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'MyPetID User',
    tier: admin ? 'admin' : 'free',
    is_admin: admin,
  };

  const { data, error } = await supabase
    .from('profiles')
    .insert(fallback)
    .select('*')
    .single();
  if (error) throw error;
  return data as Profile;
}

export function SupabaseWorkspace() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<MembershipSummary | null>(null);
  const [pets, setPets] = useState<PetRow[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [adminProfiles, setAdminProfiles] = useState<Profile[]>([]);
  const [adminDebugRows, setAdminDebugRows] = useState<AdminDebugRow[]>([]);
  const [activityRows, setActivityRows] = useState<ActivityLogRow[]>([]);
  const [awardRules, setAwardRules] = useState<AwardRuleRow[]>([]);
  const [fulfillmentOrders, setFulfillmentOrders] = useState<FulfillmentOrder[]>([]);
  const [adminMembershipAccounts, setAdminMembershipAccounts] = useState<AdminMembershipAccount[]>([]);
  const [adminCoupons, setAdminCoupons] = useState<AccessCoupon[]>([]);
  const [fulfillmentSearch, setFulfillmentSearch] = useState('');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('all');
  const [fulfillmentNote, setFulfillmentNote] = useState('');
  const [trainingCommands, setTrainingCommands] = useState<TrainingCommandRow[]>([]);
  const [xpEvents, setXpEvents] = useState<XpEventRow[]>([]);
  const [trainingDraft, setTrainingDraft] = useState({ command: 'Sit', verbalCue: 'Sit', handSignal: '✋ open palm', proofingGoal: 'Responds with distractions', status: 'Learning', points: '20', notes: 'Short upbeat sessions.' });
  const [xpDraft, setXpDraft] = useState({ eventType: 'care_task', points: '20', note: 'Care task completed' });
  const [foundDraft, setFoundDraft] = useState({ foundStatus: 'Awaiting owner confirmation', ownerFollowUp: 'Needs owner review', finderContact: '', ownerResolutionNote: '' });
  const [emailCode, setEmailCode] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [grantDraft, setGrantDraft] = useState({ profileId: '', tier: 'basic', durationDays: '30', note: 'Admin comp access' });
  const [couponDraft, setCouponDraft] = useState({ recipientEmail: '', tier: 'basic', durationDays: '30', maxRedemptions: '1', expiresInDays: '30', emailCode: true, createStripePromotion: true });
  const [providerSnapshot, setProviderSnapshot] = useState<ProviderAdminSnapshot | null>(null);
  const [providerTierDraft, setProviderTierDraft] = useState({ tier: 'basic', name: 'Basic Membership', monthlyCents: '300', description: 'MyPetID Basic monthly membership' });
  const [stripeCouponDraft, setStripeCouponDraft] = useState({ name: 'MyPetID one-month free', code: '', percentOff: '100', duration: 'repeating', durationMonths: '1', maxRedemptions: '1' });
  const [uploadKind, setUploadKind] = useState<'pet_photo' | 'medical_document'>('pet_photo');
  const [uploadTitle, setUploadTitle] = useState('MyPetID upload');
  const [inviteUrl, setInviteUrl] = useState('');
  const [adminSearch, setAdminSearch] = useState('');
  const [petDraft, setPetDraft] = useState<PetDraft>(emptyPetDraft);
  const [tagCode, setTagCode] = useState('demo-tag-001');
  const [claimCode, setClaimCode] = useState('');
  const [newTagCode, setNewTagCode] = useState('');
  const [newClaimCode, setNewClaimCode] = useState('');
  const [newNfcUid, setNewNfcUid] = useState('');
  const [deviceLabel, setDeviceLabel] = useState('This browser');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Supabase workspace ready. Sign in to sync real account, pet, tag, scan, trusted-device, and admin data.');

  const isAdmin = Boolean(profile?.is_admin || isAdminEmail(session?.user.email));
  const selectedPet = useMemo(() => pets.find((pet) => pet.id === petDraft.id) || pets[0] || null, [petDraft.id, pets]);
  const selectedPetTags = useMemo(() => tags.filter((tag) => tag.pet_id === selectedPet?.id), [selectedPet?.id, tags]);
  const selectedPetScans = useMemo(() => scans.filter((scan) => (!selectedPet?.id || scan.pet_id === selectedPet.id) && scan.actor === 'stranger').slice(0, 6), [scans, selectedPet?.id]);
  const selectedPetTraining = useMemo(() => trainingCommands.filter((item) => item.pet_id === selectedPet?.id).slice(0, 6), [trainingCommands, selectedPet?.id]);
  const selectedPetXp = useMemo(() => xpEvents.filter((item) => !selectedPet?.id || item.pet_id === selectedPet.id).slice(0, 6), [xpEvents, selectedPet?.id]);
  const latestSelectedScan = selectedPetScans[0] || null;
  const fulfillmentCounts = useMemo(() => fulfillmentOrders.reduce((acc, order) => ({ ...acc, [order.status]: (acc[order.status] || 0) + 1 }), {} as Record<string, number>), [fulfillmentOrders]);
  const tierLine = membership ? `${membership.effective_tier} via ${membership.provider} • ${membership.status}${profile?.is_admin ? ' • unrestricted admin bypass' : ''}` : profile ? `${profile.tier}${profile.is_admin ? ' • unrestricted admin bypass' : ''}` : 'not signed in';
  const filteredAdminDebugRows = useMemo(() => {
    const needle = adminSearch.trim().toLowerCase();
    if (!needle) return adminDebugRows.slice(0, 12);
    return adminDebugRows.filter((row) => [row.email, row.display_name, row.phone, row.profile_id].some((value) => String(value || '').toLowerCase().includes(needle))).slice(0, 12);
  }, [adminDebugRows, adminSearch]);
  const filteredActivityRows = useMemo(() => {
    const ids = new Set(filteredAdminDebugRows.map((row) => row.profile_id));
    if (!adminSearch.trim()) return activityRows.slice(0, 10);
    return activityRows.filter((row) => (row.target_profile_id && ids.has(row.target_profile_id)) || String(row.actor_email || '').toLowerCase().includes(adminSearch.trim().toLowerCase())).slice(0, 12);
  }, [activityRows, filteredAdminDebugRows, adminSearch]);

  const loadWorkspace = useCallback(async (activeSession: Session | null = session) => {
    if (!supabase || !activeSession?.user) return;
    setBusy(true);
    try {
      const nextProfile = await ensureProfile(activeSession.user);
      setProfile(nextProfile);
      const membershipResponse = await fetch('/api/account/membership/', { headers: { Authorization: authValue(activeSession.access_token) } });
      const membershipJson = await membershipResponse.json();
      if (membershipResponse.ok) setMembership(membershipJson.membership as MembershipSummary);
      else setMembership(null);
      const adminMode = Boolean(nextProfile.is_admin || isAdminEmail(activeSession.user.email));
      const petQuery = supabase.from('pets').select('*').order('created_at', { ascending: false });
      const { data: petData, error: petError } = adminMode ? await petQuery.limit(100) : await petQuery.eq('owner_id', activeSession.user.id).limit(25);
      if (petError) throw petError;
      const nextPets = (petData || []) as PetRow[];
      setPets(nextPets);
      if (nextPets[0]) setPetDraft(petToDraft(nextPets[0]));

      const { data: tagData, error: tagError } = await supabase.from('tags').select('*').order('created_at', { ascending: false }).limit(100);
      if (tagError) throw tagError;
      setTags((tagData || []) as TagRow[]);

      const scanQuery = supabase.from('scan_events').select('*').order('created_at', { ascending: false });
      const { data: scanData, error: scanError } = adminMode || !nextPets[0]
        ? await scanQuery.limit(100)
        : await scanQuery.in('pet_id', nextPets.map((pet) => pet.id)).limit(50);
      if (scanError) throw scanError;
      setScans((scanData || []) as ScanRow[]);

      const { data: deviceData, error: deviceError } = await supabase.from('devices').select('*').eq('profile_id', activeSession.user.id).order('created_at', { ascending: false });
      if (deviceError) throw deviceError;
      setDevices((deviceData || []) as DeviceRow[]);

      const { data: awardData, error: awardError } = await supabase.from('award_rules').select('*').order('category', { ascending: true }).order('points', { ascending: true });
      if (awardError) throw awardError;
      setAwardRules((awardData || []) as AwardRuleRow[]);

      if (nextPets.length > 0) {
        const petIds = nextPets.map((pet) => pet.id);
        const { data: trainingData, error: trainingError } = await supabase.from('training_commands').select('*').in('pet_id', petIds).order('created_at', { ascending: false }).limit(100);
        if (trainingError) throw trainingError;
        setTrainingCommands((trainingData || []) as TrainingCommandRow[]);

        const { data: xpData, error: xpError } = await supabase.from('xp_events').select('*').in('pet_id', petIds).order('created_at', { ascending: false }).limit(100);
        if (xpError) throw xpError;
        setXpEvents((xpData || []) as XpEventRow[]);
      } else {
        setTrainingCommands([]);
        setXpEvents([]);
      }

      if (adminMode) {
        const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100);
        if (profileError) throw profileError;
        setAdminProfiles((profileData || []) as Profile[]);

        const { data: debugData, error: debugError } = await supabase.from('admin_account_debug_view').select('*').order('last_activity_at', { ascending: false, nullsFirst: false }).limit(100);
        if (debugError) throw debugError;
        setAdminDebugRows((debugData || []) as AdminDebugRow[]);

        const { data: activityData, error: activityError } = await supabase.from('account_activity_log').select('id,event_time,actor_email,target_profile_id,target_pet_id,target_table,target_record_id,action,changed_fields,note').order('event_time', { ascending: false }).limit(100);
        if (activityError) throw activityError;
        setActivityRows((activityData || []) as ActivityLogRow[]);

        const orderParams = new URLSearchParams();
        if (fulfillmentFilter !== 'all') orderParams.set('status', fulfillmentFilter);
        if (fulfillmentSearch.trim()) orderParams.set('search', fulfillmentSearch.trim());
        const ordersResponse = await fetch(`/api/admin/tag-orders/?${orderParams.toString()}`, { headers: { Authorization: authValue(activeSession.access_token) } });
        const ordersJson = await ordersResponse.json();
        if (ordersResponse.ok) setFulfillmentOrders((ordersJson.orders || []) as FulfillmentOrder[]);
        else setFulfillmentOrders([]);

        const memberParams = new URLSearchParams();
        if (adminSearch.trim()) memberParams.set('search', adminSearch.trim());
        const membersResponse = await fetch(`/api/admin/memberships/?${memberParams.toString()}`, { headers: { Authorization: authValue(activeSession.access_token) } });
        const membersJson = await membersResponse.json();
        if (membersResponse.ok) {
          setAdminMembershipAccounts((membersJson.accounts || []) as AdminMembershipAccount[]);
          setAdminCoupons((membersJson.coupons || []) as AccessCoupon[]);
        } else {
          setAdminMembershipAccounts([]);
          setAdminCoupons([]);
        }

        const providerResponse = await fetch('/api/admin/providers/', { headers: { Authorization: authValue(activeSession.access_token) } });
        const providerJson = await providerResponse.json();
        if (providerResponse.ok) setProviderSnapshot(providerJson as ProviderAdminSnapshot);
        else setProviderSnapshot(null);
      } else {
        setAdminProfiles([]);
        setAdminDebugRows([]);
        setActivityRows([]);
        setFulfillmentOrders([]);
        setAdminMembershipAccounts([]);
        setAdminCoupons([]);
        setProviderSnapshot(null);
      }
      setMessage(`Loaded Supabase workspace for ${activeSession.user.email}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Supabase load failed.');
    } finally {
      setBusy(false);
    }
  }, [session, fulfillmentFilter, fulfillmentSearch]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadWorkspace(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) loadWorkspace(nextSession);
      else {
        setProfile(null);
        setMembership(null);
        setPets([]);
        setTags([]);
        setScans([]);
        setDevices([]);
        setAdminProfiles([]);
        setAdminDebugRows([]);
        setActivityRows([]);
        setFulfillmentOrders([]);
        setAdminMembershipAccounts([]);
        setAdminCoupons([]);
        setAwardRules([]);
        setTrainingCommands([]);
        setXpEvents([]);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [loadWorkspace]);

  async function sendEmailCode() {
    if (!session?.user || !profile?.email) return setMessage('Sign in first.');
    setBusy(true);
    const response = await fetch('/api/email/send-code/', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: authValue(session.access_token) }, body: JSON.stringify({ purpose: 'signup' }) });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(json.error || 'Email code could not be sent.');
    setMessage(json.alreadyVerified ? 'Email is already verified.' : `Verification code sent to ${json.email} from ${json.sender}.`);
  }

  async function verifyEmailCode() {
    if (!session?.user) return setMessage('Sign in first.');
    setBusy(true);
    const response = await fetch('/api/email/verify-code/', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: authValue(session.access_token) }, body: JSON.stringify({ purpose: 'signup', code: emailCode }) });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(json.error || 'Email verification failed.');
    setProfile(json.profile as Profile);
    setEmailCode('');
    setMessage(`Email verified for ${json.email}.`);
  }

  async function redeemCoupon() {
    if (!session?.user) return setMessage('Sign in first.');
    setBusy(true);
    const response = await fetch('/api/coupons/redeem/', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: authValue(session.access_token) }, body: JSON.stringify({ code: couponCode }) });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(json.error || 'Coupon redemption failed.');
    setMembership(json.membership as MembershipSummary);
    setCouponCode('');
    setMessage(`Coupon redeemed: ${json.membership.effective_tier} access is active.`);
  }

  async function adminGrantMembership() {
    if (!session?.user) return setMessage('Sign in first.');
    setBusy(true);
    const response = await fetch('/api/admin/memberships/', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: authValue(session.access_token) }, body: JSON.stringify({ action: 'grant_membership', profileId: grantDraft.profileId, tier: grantDraft.tier, durationDays: Number(grantDraft.durationDays || 0), note: grantDraft.note }) });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(json.error || 'Admin grant failed.');
    setMessage(`Granted ${grantDraft.tier} access.`);
    loadWorkspace();
  }

  async function adminGenerateCoupon() {
    if (!session?.user) return setMessage('Sign in first.');
    setBusy(true);
    const response = await fetch('/api/admin/memberships/', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: authValue(session.access_token) }, body: JSON.stringify({ action: 'generate_coupon', tier: couponDraft.tier, durationDays: Number(couponDraft.durationDays || 30), maxRedemptions: Number(couponDraft.maxRedemptions || 1), expiresInDays: Number(couponDraft.expiresInDays || 30), recipientEmail: couponDraft.recipientEmail, emailCode: couponDraft.emailCode, createStripePromotion: couponDraft.createStripePromotion }) });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(json.error || 'Coupon generation failed.');
    setMessage(json.emailed ? `Coupon emailed to ${couponDraft.recipientEmail}.` : `Coupon generated: ${json.code}`);
    loadWorkspace();
  }

  async function adminUpdateGrant(grantId: string, status: string) {
    if (!session?.user) return setMessage('Sign in first.');
    setBusy(true);
    const response = await fetch('/api/admin/memberships/', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: authValue(session.access_token) }, body: JSON.stringify({ action: 'update_grant', grantId, status }) });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(json.error || 'Grant update failed.');
    setMessage(`Grant marked ${status}.`);
    loadWorkspace();
  }

  async function adminProviderAction(action: string, body: Record<string, unknown> = {}) {
    if (!session?.user) return setMessage('Sign in first.');
    setBusy(true);
    const response = await fetch('/api/admin/providers/', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: authValue(session.access_token) }, body: JSON.stringify({ action, ...body }) });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(json.error || 'Provider action failed.');
    setMessage(`Provider action complete: ${action}.`);
    loadWorkspace();
  }

  async function adminCreateStripeTier() {
    await adminProviderAction('stripe_create_product_price', { tier: providerTierDraft.tier, name: providerTierDraft.name, monthlyCents: Number(providerTierDraft.monthlyCents || 0), description: providerTierDraft.description });
  }

  async function adminCreateStripeCoupon() {
    await adminProviderAction('stripe_create_coupon', { name: stripeCouponDraft.name, code: stripeCouponDraft.code, percentOff: Number(stripeCouponDraft.percentOff || 100), duration: stripeCouponDraft.duration, durationMonths: Number(stripeCouponDraft.durationMonths || 1), maxRedemptions: Number(stripeCouponDraft.maxRedemptions || 1) });
  }

  async function adminSyncPatreonTiers() {
    await adminProviderAction('sync_patreon_tiers');
  }

  async function saveProfile() {
    if (!supabase || !session?.user || !profile) return;
    setBusy(true);
    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name: profile.display_name, phone: profile.phone, public_contact: { phone: profile.phone, email: profile.email } })
      .eq('id', session.user.id)
      .select('*')
      .single();
    setBusy(false);
    if (error) return setMessage(error.message);
    setProfile(data as Profile);
    setMessage('Account profile saved to Supabase.');
  }

  async function refreshMembership() {
    if (!session?.user) return setMessage('Sign in first.');
    setBusy(true);
    const response = await fetch('/api/account/membership/', { headers: { Authorization: authValue(session.access_token) } });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(json.error || 'Membership refresh failed.');
    setMembership(json.membership as MembershipSummary);
    setMessage(`Membership refreshed: ${json.membership.effective_tier} via ${json.membership.provider}.`);
  }

  async function manageBilling() {
    if (!session?.user) return setMessage('Sign in first.');
    setBusy(true);
    const response = await fetch('/api/subscriptions/portal/', { method: 'POST', headers: { Authorization: authValue(session.access_token) } });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(json.error || 'Stripe billing portal is not available for this account.');
    window.location.href = json.url;
  }

  async function updateOrderStatus(order: FulfillmentOrder, status: string) {
    if (!session?.user) return setMessage('Sign in first.');
    setBusy(true);
    const response = await fetch('/api/admin/tag-orders/', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: authValue(session.access_token) },
      body: JSON.stringify({ id: order.id, status, note: fulfillmentNote }),
    });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(json.error || 'Order status update failed.');
    setFulfillmentOrders((orders) => orders.map((item) => item.id === order.id ? { ...item, ...json.order } : item));
    setMessage(`Order ${order.id.slice(0, 8)} moved to ${status}.`);
  }

  async function savePet() {
    if (!supabase || !session?.user) return setMessage('Sign in first.');
    setBusy(true);
    const payload = {
      ...(petDraft.id ? { id: petDraft.id } : {}),
      owner_id: session.user.id,
      name: petDraft.name.trim() || 'Unnamed pet',
      species: petDraft.species.trim() || 'dog',
      breed: petDraft.breed || null,
      photo_url: petDraft.photoUrl || null,
      medical_public: petDraft.medicalPublic || null,
      behavior_public: petDraft.behaviorPublic || null,
      contact_public: { phone: petDraft.publicPhone || null, email: petDraft.publicEmail || null },
      lost_mode: petDraft.lostMode,
      public_fields: ['name', 'photo', 'contact', 'medical_public', 'behavior_public', 'lost_mode', 'last_scan'],
    };
    const { data, error } = await supabase.from('pets').upsert(payload).select('*').single();
    setBusy(false);
    if (error) return setMessage(error.message);
    const saved = data as PetRow;
    setPets((current) => [saved, ...current.filter((pet) => pet.id !== saved.id)]);
    setPetDraft(petToDraft(saved));
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mypetid-home.github.io';
    const publicPetUrl = `${origin}/pet/?pet=${encodeURIComponent(saved.id)}`;
    const accountShareUrl = `${origin}/dashboard/pack/?profile=${encodeURIComponent(session.user.id)}`;
    await supabase.from('pet_qr_codes').upsert({ pet_id: saved.id, profile_id: session.user.id, qr_type: 'public_pet_profile', payload_url: publicPetUrl, active: true, metadata: { created_from: 'pet_save' } }, { onConflict: 'pet_id,qr_type,payload_url' });
    await supabase.from('account_qr_codes').upsert({ profile_id: session.user.id, payload_url: accountShareUrl, active: true, metadata: { created_from: 'pet_save' } }, { onConflict: 'profile_id,payload_url' });
    setMessage(`Saved ${saved.name} to Supabase and created QR destinations for public pet profile + account Dog Pack sharing.`);
  }

  async function claimTag() {
    if (!supabase || !session?.user || !selectedPet) return setMessage('Save/select a pet before activating a tag.');
    const code = tagCode.trim();
    if (!code) return setMessage('Enter a tag code to activate.');
    setBusy(true);
    const response = await fetch('/api/tags/activate/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authValue(session.access_token) },
      body: JSON.stringify({ tagCode: code, claimCode, petId: selectedPet.id }),
    });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(json.error || 'Tag activation failed.');
    const saved = json.tag as TagRow;
    setTags((current) => [saved, ...current.filter((tag) => tag.id !== saved.id)]);
    if (json.membership) setMembership(json.membership as MembershipSummary);
    setClaimCode('');
    setMessage(`Activated card ${saved.tag_code} for ${selectedPet.name}. Claim code is now used and invalid for future activation. ${json.membership?.remaining?.tags === null ? 'Unlimited tag slots remain.' : `${json.membership?.remaining?.tags ?? 0} tag slot(s) remain.`}`);
  }

  async function mintTag() {
    if (!supabase || !session?.user || !isAdmin) return setMessage('Only unrestricted admins can mint card IDs from the static admin UI.');
    const code = (newTagCode || makeCardId()).trim().toUpperCase();
    const rawClaim = (newClaimCode || makeClaimCode()).trim().toUpperCase();
    const claimHash = await sha256Hex(rawClaim);
    const hint = rawClaim.slice(-4);
    setBusy(true);
    const { data, error } = await supabase
      .from('tags')
      .insert({ tag_code: code, claim_code_hash: claimHash, claim_code_hint: hint, nfc_uid: newNfcUid.trim().replace(/:/g, '').toUpperCase() || null, status: 'unassigned', created_by: session.user.id })
      .select('*')
      .single();
    setBusy(false);
    if (error) return setMessage(error.message);
    const saved = data as TagRow;
    setTags((current) => [saved, ...current]);
    setNewTagCode('');
    setNewClaimCode('');
    setNewNfcUid('');
    setTagCode(saved.tag_code);
    setClaimCode(rawClaim);
    setMessage(`Created physical card ${saved.tag_code}. One-time claim code: ${rawClaim}. Program NFC/QR to /scan/?tag=${encodeURIComponent(saved.tag_code)}&mode=finder, print Card ID, include claim code privately, then mark the order printing/shipped.`);
  }

  async function trustDevice() {
    if (!supabase || !session?.user) return setMessage('Sign in first.');
    setBusy(true);
    const fingerprint = installId();
    const { data, error } = await supabase
      .from('devices')
      .upsert({ profile_id: session.user.id, device_fingerprint: fingerprint, trusted: true, label: deviceLabel || 'Trusted browser' }, { onConflict: 'profile_id,device_fingerprint' })
      .select('*')
      .single();
    setBusy(false);
    if (error) return setMessage(error.message);
    const saved = data as DeviceRow;
    setDevices((current) => [saved, ...current.filter((device) => device.id !== saved.id)]);
    setMessage('Trusted this browser for owner scan detection. Stronger passkey/PWA trust can layer on later.');
  }

  async function markOwnerScan() {
    if (!supabase || !session?.user || !selectedPet) return setMessage('Sign in and select a pet first.');
    setMessage(`Owner device scan recognized for ${selectedPet.name} on install ${installId().slice(0, 12)}…. Owner/user scans do not update recent finder scans; they will feed a separate owner activity log later.`);
  }

  async function saveTrainingCommand() {
    if (!supabase || !session?.user || !selectedPet) return setMessage('Save/select a pet before adding training commands.');
    setBusy(true);
    const payload = {
      pet_id: selectedPet.id,
      command: trainingDraft.command.trim() || 'New command',
      verbal_cue: trainingDraft.verbalCue || null,
      hand_signal: trainingDraft.handSignal || null,
      proofing_goal: trainingDraft.proofingGoal || null,
      status: trainingDraft.status || 'Learning',
      points: Number(trainingDraft.points) || 0,
      notes: trainingDraft.notes || null,
    };
    const { data, error } = await supabase.from('training_commands').insert(payload).select('*').single();
    setBusy(false);
    if (error) return setMessage(error.message);
    setTrainingCommands((current) => [data as TrainingCommandRow, ...current]);
    setMessage(`Saved ${payload.command} training command for ${selectedPet.name}.`);
  }

  async function logXpEvent(rule?: AwardRuleRow) {
    if (!supabase || !session?.user || !selectedPet) return setMessage('Save/select a pet before logging XP.');
    const points = rule?.points ?? (Number(xpDraft.points) || 0);
    setBusy(true);
    const { data, error } = await supabase.from('xp_events').insert({
      profile_id: selectedPet.owner_id || session.user.id,
      pet_id: selectedPet.id,
      award_rule_id: rule?.id ?? null,
      event_type: rule?.trigger_key ?? xpDraft.eventType,
      points,
      note: rule ? `Award progress: ${rule.title}` : xpDraft.note,
    }).select('*').single();
    setBusy(false);
    if (error) return setMessage(error.message);
    setXpEvents((current) => [data as XpEventRow, ...current]);
    setMessage(`Logged ${points} XP for ${selectedPet.name}.`);
  }

  async function saveAwardRule(rule: AwardRuleRow, patch: Partial<AwardRuleRow>) {
    if (!supabase || !session?.user || !isAdmin) return setMessage('Only unrestricted admins can edit award rules.');
    setBusy(true);
    const payload = { ...patch, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from('award_rules').update(payload).eq('id', rule.id).select('*').single();
    setBusy(false);
    if (error) return setMessage(error.message);
    setAwardRules((current) => current.map((item) => item.id === rule.id ? data as AwardRuleRow : item));
    setMessage(`Updated award rule: ${(data as AwardRuleRow).title}.`);
  }

  async function saveFoundFollowup() {
    if (!supabase || !session?.user || !latestSelectedScan) return setMessage('No scan event is loaded for found-report follow-up yet.');
    const resolved = ['Resolved - returned home', 'Declined - not my dog', 'False alarm'].includes(foundDraft.foundStatus);
    setBusy(true);
    const { data, error } = await supabase.from('scan_events').update({
      found_status: foundDraft.foundStatus,
      finder_contact: foundDraft.finderContact || latestSelectedScan.finder_contact || null,
      owner_follow_up: foundDraft.ownerFollowUp,
      owner_resolution_note: foundDraft.ownerResolutionNote || null,
      resolved_at: resolved ? new Date().toISOString() : null,
    }).eq('id', latestSelectedScan.id).select('*').single();
    setBusy(false);
    if (error) return setMessage(error.message);
    setScans((current) => current.map((scan) => scan.id === latestSelectedScan.id ? data as ScanRow : scan));
    setMessage(`Updated owner follow-up for scan ${latestSelectedScan.id.slice(0, 8)}.`);
  }

  async function startGoogleConnect() {
    if (!supabase || !session?.user) return setMessage('Sign in before connecting Google.');
    const response = await fetch('/api/google/oauth/start', { headers: { Authorization: authValue(session.access_token) } });
    const json = await response.json();
    if (!response.ok) return setMessage(json.error || 'Google connect failed.');
    window.location.href = json.url;
  }

  async function createPackInvite() {
    if (!supabase || !session?.user) return setMessage('Sign in before creating Dog Pack invites.');
    const response = await fetch('/api/dog-pack/invites', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: authValue(session.access_token) }, body: JSON.stringify({ petId: selectedPet?.id || null }) });
    const json = await response.json();
    if (!response.ok) return setMessage(json.error || 'Invite creation failed.');
    setInviteUrl(json.inviteUrl);
    await refreshMembership();
    setMessage('Dog Pack invite link created.');
  }

  async function uploadSelectedFile(file?: File | null) {
    if (!supabase || !session?.user) return setMessage('Sign in before uploading.');
    if (!file) return setMessage('Choose a file first.');
    if (!selectedPet && uploadKind !== 'pet_photo') return setMessage('Save/select a pet before uploading documents.');
    const form = new FormData();
    form.set('file', file);
    form.set('kind', uploadKind);
    form.set('title', uploadTitle || file.name);
    if (selectedPet?.id) form.set('petId', selectedPet.id);
    setBusy(true);
    const response = await fetch('/api/uploads', { method: 'POST', headers: { Authorization: authValue(session.access_token) }, body: form });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(json.error || 'Upload failed.');
    setMessage(`Uploaded to Supabase${json.upload?.google_status === 'synced' ? ' and synced to Google.' : json.upload?.google_status === 'failed' ? `; Google sync failed: ${json.upload.google_error}` : '; connect Google to sync there too.'}`);
    if (json.publicUrl && selectedPet) setPetDraft({ ...petDraft, photoUrl: json.publicUrl });
  }

  if (!hasSupabaseConfig) {
    return (
      <section className="panel wide supabaseWorkspace">
        <p className="eyebrow">Real Supabase workspace</p>
        <h2>Cloud sync waiting on public build env</h2>
        <p>This static build does not include browser-safe Supabase public values. Add only <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in local/GitHub Actions to activate real account, pet, tag, scan, trusted-device, and admin flows.</p>
      </section>
    );
  }

  if (!session?.user) {
    return (
      <section className="panel wide supabaseWorkspace">
        <p className="eyebrow">Real Supabase workspace</p>
        <h2>Sign in from Account access to sync the live app</h2>
        <p>The dashboard demo still works locally, but live Supabase writes wait for a session before writing account profiles, pets, physical tag claims, owner scans, trusted browser records, or admin inventory.</p>
      </section>
    );
  }

  return (
    <section className="supabaseWorkspace">
      <div className="workspaceTitle">
        <div>
          <p className="eyebrow">Real Supabase workspace</p>
          <h2>Account, pets, tags, scans, devices, admin</h2>
          <p>{session.user.email} • {tierLine}</p>
        </div>
        <div className="actions compact"><button type="button" disabled={busy} onClick={() => loadWorkspace()}>{busy ? 'Syncing…' : 'Refresh Supabase'}</button></div>
      </div>
      <p className="notice">{message}</p>

      <article className="panel wide membershipPanel">
        <div className="workspaceTitle">
          <div>
            <p className="eyebrow">Membership enforcement</p>
            <h3>{membership ? `${membership.effective_tier.toUpperCase()} plan` : 'Membership loading'}</h3>
            <p>{membership ? `Private account status: ${membership.provider} • ${membership.status}` : 'Refresh to load Stripe/Patreon/admin/coupon status.'}</p>
            <small>Only the membership tier is used for app/profile limits. Provider source and payment/coupon status stay inside Account/Admin and are not shown on public pet profiles.</small>
          </div>
          <div className="actions compact"><button type="button" disabled={busy} onClick={refreshMembership}>Refresh membership</button><button type="button" disabled={busy} onClick={manageBilling}>Manage Stripe billing</button></div>
        </div>
        <div className="adminLookupGrid">
          <div className="adminLookupCard"><strong>Tags</strong><small>Active scan-enabled tag slots</small><span>{membership ? `${membership.usage.active_tags} / ${limitLabel(membership.limits.max_tags)}` : 'n/a'}</span><small>{membership?.remaining.tags === null ? 'Unlimited remaining' : `${membership?.remaining.tags ?? 0} remaining`}</small></div>
          <div className="adminLookupCard"><strong>Users/helpers</strong><small>Owner plus Dog Pack invite slots</small><span>{membership ? `${membership.usage.helpers + 1} / ${limitLabel(membership.limits.max_users)}` : 'n/a'}</span><small>{membership?.remaining.users === null ? 'Unlimited remaining' : `${membership?.remaining.users ?? 0} helper slot(s) remaining`}</small></div>
          <div className="adminLookupCard"><strong>Scan tracking</strong><small>Required for active NFC/QR location history</small><span>{membership?.limits.scan_tracking_enabled ? 'Enabled' : 'Disabled'}</span><small>{membership?.limits.scan_tracking_enabled ? 'Tag activation allowed when slots remain' : 'Upgrade to Basic, Silver, Gold, Diamond, Patreon, or admin'}</small></div>
        </div>
      </article>

      <div className="dashboardGrid supabaseGrid">
        <article className="panel wide">
          <h3>Account profile</h3>
          <div className="grid2">
            <label>Display name<input value={profile?.display_name || ''} onChange={(event) => setProfile(profile ? { ...profile, display_name: event.target.value } : profile)} /></label>
            <label>Public/owner phone<input value={profile?.phone || ''} onChange={(event) => setProfile(profile ? { ...profile, phone: event.target.value } : profile)} /></label>
          </div>
          <div className="actions"><button className="primary" type="button" disabled={busy || !profile} onClick={saveProfile}>Save account</button><button type="button" disabled={busy} onClick={trustDevice}>Trust this browser</button></div>
        </article>

        <article className="panel emailVerifyPanel">
          <p className="eyebrow">Email verification</p>
          <h3>{profile?.email_verified_at ? 'Email verified' : 'Verify signup email'}</h3>
          <p>{profile?.email || session.user.email} • {profile?.email_verified_at ? `verified ${fmtDate(profile.email_verified_at)}` : 'verification code comes from mypetid@yahoo.com'}</p>
          {!profile?.email_verified_at && <>
            <label>6-digit code<input inputMode="numeric" maxLength={6} value={emailCode} onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" /></label>
            <div className="actions"><button type="button" disabled={busy} onClick={sendEmailCode}>Send code</button><button className="primary" type="button" disabled={busy || emailCode.length !== 6} onClick={verifyEmailCode}>Verify email</button></div>
          </>}
        </article>

        <article className="panel emailVerifyPanel">
          <p className="eyebrow">Coupon / comp access</p>
          <h3>Redeem a MyPetID access code</h3>
          <p>Admin-issued codes can unlock Basic, Silver, Gold, Diamond, or admin testing access without Stripe payment.</p>
          <label>Coupon code<input value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="MYPETID-BASI-1234ABCD" /></label>
          <div className="actions"><button className="primary" type="button" disabled={busy || couponCode.trim().length < 8} onClick={redeemCoupon}>Redeem code</button></div>
        </article>

        <article className="panel">
          <h3>Trusted devices</h3>
          {devices.length === 0 ? <p>No trusted browser records yet.</p> : devices.map((device) => <p key={device.id}><strong>{device.label || 'Browser'}</strong><br /><small>{device.trusted ? 'trusted' : 'not trusted'} • {fmtDate(device.created_at)}</small></p>)}
          <label>Device label<input value={deviceLabel} onChange={(event) => setDeviceLabel(event.target.value)} /></label>
        </article>

        <article className="panel wide">
          <h3>Pet profile in Supabase</h3>
          <div className="grid2">
            <label>Name<input value={petDraft.name} onChange={(event) => setPetDraft({ ...petDraft, name: event.target.value })} /></label>
            <label>Species<select value={petDraft.species} onChange={(event) => setPetDraft({ ...petDraft, species: event.target.value })}><option value="dog">Dog</option></select></label>
            <label>Breed<select value={petDraft.breed} onChange={(event) => setPetDraft({ ...petDraft, breed: event.target.value })}>{dogBreedOptions.map((breed) => <option key={breed}>{breed}</option>)}</select></label>
            <label>Photo URL<input value={petDraft.photoUrl} onChange={(event) => setPetDraft({ ...petDraft, photoUrl: event.target.value })} /></label>
            <label>Public phone<input value={petDraft.publicPhone} onChange={(event) => setPetDraft({ ...petDraft, publicPhone: event.target.value })} /></label>
            <label>Public email<input value={petDraft.publicEmail} onChange={(event) => setPetDraft({ ...petDraft, publicEmail: event.target.value })} /></label>
          </div>
          <label>Behavior note<textarea value={petDraft.behaviorPublic} onChange={(event) => setPetDraft({ ...petDraft, behaviorPublic: event.target.value })} /></label>
          <label>Medical note<textarea value={petDraft.medicalPublic} onChange={(event) => setPetDraft({ ...petDraft, medicalPublic: event.target.value })} /></label>
          <label className="toggleRow"><input type="checkbox" checked={petDraft.lostMode} onChange={(event) => setPetDraft({ ...petDraft, lostMode: event.target.checked })} /> Lost mode</label>
          <div className="actions"><button className="primary" type="button" disabled={busy} onClick={savePet}>{petDraft.id ? 'Update pet' : 'Create pet'}</button><button type="button" onClick={() => setPetDraft(emptyPetDraft)}>New pet draft</button></div>
        </article>

        <article className="panel">
          <h3>Your pets</h3>
          {pets.length === 0 ? <p>No Supabase pets yet.</p> : pets.map((pet) => <button className={pet.id === petDraft.id ? 'activeMini' : ''} key={pet.id} type="button" onClick={() => setPetDraft(petToDraft(pet))}>{pet.name}<br /><small>{pet.species} • {pet.lost_mode ? 'lost mode' : 'safe'}</small></button>)}
        </article>

        <article className="panel wide">
          <h3>Uploads, Google sync, and Dog Pack invites</h3>
          <p>Pet photos upload to Supabase Storage and update the saved pet photo. Medical documents upload to the private medical-documents bucket and create a pet document record. If Google is connected, photos sync to Google Photos and documents sync to Google Drive.</p>
          <div className="grid2">
            <label>Upload type<select value={uploadKind} onChange={(event) => setUploadKind(event.target.value as 'pet_photo' | 'medical_document')}><option value="pet_photo">Pet photo → Supabase + Google Photos</option><option value="medical_document">Medical document → Supabase + Google Drive</option></select></label>
            <label>Upload title<input value={uploadTitle} onChange={(event) => setUploadTitle(event.target.value)} /></label>
          </div>
          <input type="file" accept={uploadKind === 'pet_photo' ? 'image/*' : 'image/*,application/pdf'} onChange={(event) => uploadSelectedFile(event.target.files?.[0])} />
          <div className="actions"><button type="button" disabled={busy} onClick={startGoogleConnect}>Connect Google for upload sync</button><button type="button" disabled={busy} onClick={createPackInvite}>Create Dog Pack invite link</button></div>
          {inviteUrl && <p className="notice"><strong>Dog Pack invite:</strong> {inviteUrl}</p>}
        </article>

        <article className="panel wide">
          <h3>Physical card activation</h3>
          <p>Ship every NFC/QR card with a public Card ID printed on it and a private one-time claim code in the package. The card NFC should point to <code>/scan/?tag=&lt;Card ID&gt;&amp;mode=finder</code>. Owners link the card here after saving/selecting their dog.</p>
          <div className="grid2"><label>Card ID / tag code<input value={tagCode} onChange={(event) => setTagCode(event.target.value.toUpperCase())} placeholder="MPID-2A81-K9C4" /></label><label>One-time claim code<input value={claimCode} onChange={(event) => setClaimCode(event.target.value.toUpperCase())} placeholder="7394-M3P7I6D5" /></label><label>Selected pet<input value={selectedPet?.name || 'Save a pet first'} readOnly /></label></div>
          <div className="actions"><button className="primary" type="button" disabled={busy || !selectedPet || !tagCode.trim() || !claimCode.trim()} onClick={claimTag}>Activate card for dog</button><button type="button" disabled={busy || !selectedPet} onClick={trustDevice}>Trust this device for this account</button><button type="button" disabled={busy || !selectedPet} onClick={markOwnerScan}>Test owner-device scan</button></div>
          <p className="formHint">Claim codes are one-time use. Once linked to a dog profile, the same Card ID/claim code cannot activate again. Linked owner/trusted device scans do not update recent finder scans.</p>
          <div className="tagList">{selectedPetTags.length === 0 ? <span>No cards linked to this pet.</span> : selectedPetTags.map((tag) => <span key={tag.id}>#{tag.tag_code}{tag.claim_code_hint ? ` • claim hint ${tag.claim_code_hint}` : ''}</span>)}</div>
        </article>

        <article className="panel">
          <h3>Recent finder scans</h3>
          {selectedPetScans.length === 0 ? <p>No finder scan events loaded yet. Owner/trusted device scans are intentionally excluded.</p> : selectedPetScans.map((scan) => <p key={scan.id}><strong>{scan.actor}{scan.reported_lost ? ' • lost sighting' : ''}</strong><br /><small>{fmtDate(scan.created_at)}{scan.latitude ? ` • ${scan.latitude.toFixed(4)}, ${scan.longitude?.toFixed(4)}` : ' • no GPS'} • {scan.found_status || 'scan_only'} • {scan.owner_follow_up || 'not_required'}</small></p>)}
        </article>

        <article className="panel wide">
          <h3>Live training commands</h3>
          <p>Writes command/trick progress to Supabase with cue, hand signal, proofing goal, status, notes, and points.</p>
          <div className="grid2">
            <label>Command or trick<input value={trainingDraft.command} onChange={(event) => setTrainingDraft({ ...trainingDraft, command: event.target.value })} /></label>
            <label>Verbal cue<input value={trainingDraft.verbalCue} onChange={(event) => setTrainingDraft({ ...trainingDraft, verbalCue: event.target.value })} /></label>
            <label>Hand signal emoji<input value={trainingDraft.handSignal} onChange={(event) => setTrainingDraft({ ...trainingDraft, handSignal: event.target.value })} /></label>
            <label>Status<select value={trainingDraft.status} onChange={(event) => setTrainingDraft({ ...trainingDraft, status: event.target.value })}><option>Not started</option><option>Learning</option><option>Practicing</option><option>Proofing</option><option>Mastered</option></select></label>
            <label>Proofing goal<input value={trainingDraft.proofingGoal} onChange={(event) => setTrainingDraft({ ...trainingDraft, proofingGoal: event.target.value })} /></label>
            <label>Points<input type="number" value={trainingDraft.points} onChange={(event) => setTrainingDraft({ ...trainingDraft, points: event.target.value })} /></label>
          </div>
          <label>Training notes<textarea value={trainingDraft.notes} onChange={(event) => setTrainingDraft({ ...trainingDraft, notes: event.target.value })} /></label>
          <div className="actions"><button className="primary" type="button" disabled={busy || !selectedPet} onClick={saveTrainingCommand}>Save training command</button></div>
          <div className="auditTimeline">{selectedPetTraining.length === 0 ? <p>No live training commands saved for this pet yet.</p> : selectedPetTraining.map((item) => <p key={item.id}><strong>{item.hand_signal || '🐾'} {item.command}</strong><br /><small>{item.status} • cue: {item.verbal_cue || 'n/a'} • proofing: {item.proofing_goal || 'n/a'} • {item.points} XP</small></p>)}</div>
        </article>

        <article className="panel wide">
          <h3>Live XP and award progress</h3>
          <p>Active award rules are admin-managed in Supabase. Owners can log XP/progress events; rule conditions and point values stay locked to admins.</p>
          <div className="grid2"><label>Event type<input value={xpDraft.eventType} onChange={(event) => setXpDraft({ ...xpDraft, eventType: event.target.value })} /></label><label>Points<input type="number" value={xpDraft.points} onChange={(event) => setXpDraft({ ...xpDraft, points: event.target.value })} /></label></div>
          <label>XP note<input value={xpDraft.note} onChange={(event) => setXpDraft({ ...xpDraft, note: event.target.value })} /></label>
          <div className="actions"><button className="primary" type="button" disabled={busy || !selectedPet} onClick={() => logXpEvent()}>Log custom XP event</button></div>
          <div className="adminLookupGrid">{awardRules.slice(0, 8).map((rule) => <button className="adminLookupCard" type="button" key={rule.id} disabled={busy || !selectedPet} onClick={() => logXpEvent(rule)}><strong>{rule.icon} {rule.title}</strong><small>{rule.category} • trigger: {rule.trigger_key}</small><span>{rule.points} XP • target {rule.target}</span><small>{rule.requirement}</small></button>)}</div>
          <div className="auditTimeline"><strong>Recent live XP</strong>{selectedPetXp.length === 0 ? <p>No XP events saved for this pet yet.</p> : selectedPetXp.map((item) => <p key={item.id}><span>+{item.points} {item.event_type}</span><br /><small>{fmtDate(item.created_at)} • {item.note || 'no note'}</small></p>)}</div>
        </article>

        <article className="panel wide">
          <h3>Found-report owner follow-up</h3>
          <p>Updates the latest loaded scan with owner follow-through, finder contact route, resolution note, and resolved timestamp when applicable.</p>
          <div className="grid2">
            <label>Found status<select value={foundDraft.foundStatus} onChange={(event) => setFoundDraft({ ...foundDraft, foundStatus: event.target.value })}><option>Found report received</option><option>Owner contacted</option><option>Awaiting owner confirmation</option><option>Resolved - returned home</option><option>Declined - not my dog</option><option>Unable to verify</option><option>False alarm</option></select></label>
            <label>Owner follow-up<select value={foundDraft.ownerFollowUp} onChange={(event) => setFoundDraft({ ...foundDraft, ownerFollowUp: event.target.value })}><option>Needs owner review</option><option>Owner contacted finder</option><option>Confirmed home</option><option>Declined - not my dog</option><option>Unable to verify</option><option>Escalate to support</option></select></label>
            <label>Finder contact<input value={foundDraft.finderContact} onChange={(event) => setFoundDraft({ ...foundDraft, finderContact: event.target.value })} /></label>
            <label>Latest scan<input readOnly value={latestSelectedScan ? `${latestSelectedScan.actor} • ${fmtDate(latestSelectedScan.created_at)}` : 'No scan loaded'} /></label>
          </div>
          <label>Owner resolution note<textarea value={foundDraft.ownerResolutionNote} onChange={(event) => setFoundDraft({ ...foundDraft, ownerResolutionNote: event.target.value })} /></label>
          <div className="actions"><button className="primary" type="button" disabled={busy || !latestSelectedScan} onClick={saveFoundFollowup}>Save owner follow-up</button></div>
        </article>

        {isAdmin && <article className="panel wide adminLivePanel fulfillmentQueue">
          <h3>Physical card fulfillment queue</h3>
          <p>Paid Stripe/subscription card requests land here as CAK3D admin notifications. For each order: generate a randomized Card ID + one-time claim code, program NFC/QR to the finder URL, package the private claim code, ship it, then move the order through printing/shipped/delivered.</p>
          <div className="grid2">
            <label>Search order, customer, pet, Stripe ID, or address<input placeholder="email, Clyde, pi_..., shipped" value={fulfillmentSearch} onChange={(event) => setFulfillmentSearch(event.target.value)} /></label>
            <label>Status filter<select value={fulfillmentFilter} onChange={(event) => setFulfillmentFilter(event.target.value)}><option value="all">All statuses</option>{fulfillmentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
          </div>
          <label>Fulfillment note for next status change<input placeholder="Printed QR, programmed NFC, tracking #, package note..." value={fulfillmentNote} onChange={(event) => setFulfillmentNote(event.target.value)} /></label>
          <div className="tagList">{fulfillmentStatuses.map((status) => <span key={status}>{status}: {fulfillmentCounts[status] || 0}</span>)}</div>
          <div className="actions"><button className="primary" type="button" disabled={busy} onClick={() => loadWorkspace()}>{busy ? 'Refreshing…' : 'Refresh orders'}</button></div>
          <div className="fulfillmentGrid">
            {fulfillmentOrders.length === 0 ? <p>No tag orders match this view yet. New paid Stripe tag checkouts will appear here after checkout/webhook confirmation.</p> : fulfillmentOrders.map((order) => <div className="fulfillmentCard" key={order.id}>
              <div className="fulfillmentHead"><strong>{order.product?.name || 'Physical MyPetID tag'}</strong><span className={`fulfillmentStatus ${order.status}`}>{order.status}</span></div>
              <small>{money(order.amount_cents, order.currency || 'usd')} • {order.provider} • ordered {fmtDate(order.created_at)}</small>
              <p><strong>Customer:</strong> {order.profile?.email || order.profile?.display_name || order.profile_id || 'unknown'}{order.profile?.phone ? ` • ${order.profile.phone}` : ''}</p>
              <p><strong>Pet:</strong> {order.pet?.name || 'not linked yet'}{order.pet?.breed ? ` • ${order.pet.breed}` : ''}{order.pet?.lost_mode ? ' • LOST MODE' : ''}</p>
              <p><strong>Ship to:</strong> {shippingSummary(order.ship_to)}</p>
              <p><strong>QR/NFC payload:</strong> <code>{order.qr_payload || order.public_pet_url || 'Pending pet profile link'}</code></p>
              <small>Order #{order.id.slice(0, 8)} • checkout {order.provider_checkout_id || 'n/a'} • payment {order.provider_payment_id || 'n/a'}</small>
              {order.metadata?.fulfillment_note && <p className="notice"><strong>Last note:</strong> {String(order.metadata.fulfillment_note)}</p>}
              {order.metadata?.tracking_url && <p><a href={String(order.metadata.tracking_url)} target="_blank" rel="noreferrer">Tracking link</a></p>}
              <div className="actions compact">{fulfillmentStatuses.map((status) => <button key={status} type="button" disabled={busy || status === order.status} onClick={() => updateOrderStatus(order, status)}>{status}</button>)}</div>
            </div>)}
          </div>
        </article>}

        {isAdmin && <article className="panel wide adminLivePanel membershipAdminPanel">
          <h3>Admin membership + coupon control</h3>
          <p>View users, paid/comp status, active grants, and create random access codes. App coupons redeem inside MyPetID; Stripe promotion sync is attempted when enabled. Patreon-style comps use MyPetID grants because Patreon does not expose a normal checkout coupon code flow.</p>
          <div className="grid2">
            <label>Grant target profile<select value={grantDraft.profileId} onChange={(event) => setGrantDraft({ ...grantDraft, profileId: event.target.value })}><option value="">Choose profile…</option>{adminMembershipAccounts.map((item) => <option key={item.profile.id} value={item.profile.id}>{item.profile.email || item.profile.id} • {item.membership.effective_tier}</option>)}</select></label>
            <label>Grant tier<select value={grantDraft.tier} onChange={(event) => setGrantDraft({ ...grantDraft, tier: event.target.value })}>{['basic','silver','gold','diamond','admin'].map((tier) => <option key={tier} value={tier}>{tier}</option>)}</select></label>
            <label>Grant days, blank/0 = ongoing<input value={grantDraft.durationDays} onChange={(event) => setGrantDraft({ ...grantDraft, durationDays: event.target.value })} /></label>
            <label>Grant note<input value={grantDraft.note} onChange={(event) => setGrantDraft({ ...grantDraft, note: event.target.value })} /></label>
          </div>
          <div className="actions"><button className="primary" type="button" disabled={busy || !grantDraft.profileId} onClick={adminGrantMembership}>Grant/update access</button><button type="button" disabled={busy} onClick={() => loadWorkspace()}>Refresh memberships</button></div>

          <div className="grid2">
            <label>Coupon recipient email<input value={couponDraft.recipientEmail} onChange={(event) => setCouponDraft({ ...couponDraft, recipientEmail: event.target.value })} placeholder="newuser@example.com" /></label>
            <label>Coupon tier<select value={couponDraft.tier} onChange={(event) => setCouponDraft({ ...couponDraft, tier: event.target.value })}>{['basic','silver','gold','diamond','admin'].map((tier) => <option key={tier} value={tier}>{tier}</option>)}</select></label>
            <label>Access days<input value={couponDraft.durationDays} onChange={(event) => setCouponDraft({ ...couponDraft, durationDays: event.target.value })} /></label>
            <label>Code expires in days<input value={couponDraft.expiresInDays} onChange={(event) => setCouponDraft({ ...couponDraft, expiresInDays: event.target.value })} /></label>
            <label>Max redemptions<input value={couponDraft.maxRedemptions} onChange={(event) => setCouponDraft({ ...couponDraft, maxRedemptions: event.target.value })} /></label>
            <label className="toggleRow"><input type="checkbox" checked={couponDraft.emailCode} onChange={(event) => setCouponDraft({ ...couponDraft, emailCode: event.target.checked })} /> Email code to recipient</label>
            <label className="toggleRow"><input type="checkbox" checked={couponDraft.createStripePromotion} onChange={(event) => setCouponDraft({ ...couponDraft, createStripePromotion: event.target.checked })} /> Also try Stripe promotion code</label>
          </div>
          <div className="actions"><button className="primary" type="button" disabled={busy} onClick={adminGenerateCoupon}>Generate random coupon</button></div>

          <div className="adminLookupGrid">
            {adminMembershipAccounts.slice(0, 12).map((item) => <div className="adminLookupCard" key={item.profile.id}>
              <strong>{item.profile.email || item.profile.id}</strong>
              <small>{item.profile.display_name || 'No name'} • profile tier {item.profile.tier}{item.profile.is_admin ? ' • admin' : ''}</small>
              <span>Effective: {item.membership.effective_tier} via {item.membership.provider}</span>
              <small>Status: {item.membership.status}</small>
              <small>Stripe customer: {item.membership.provider_customer_id || 'n/a'} • subscription: {item.membership.provider_subscription_id || 'n/a'}</small>
              <small>Usage: {item.membership.usage.active_tags}/{limitLabel(item.membership.limits.max_tags)} tags • {item.membership.usage.helpers + 1}/{limitLabel(item.membership.limits.max_users)} users</small>
              {item.grants.slice(0, 3).map((grant) => <p key={grant.id}><small>{grant.tier} • {grant.status} • {grant.source} • expires {fmtDate(grant.expires_at)}</small><br /><button type="button" disabled={busy || grant.status === 'revoked'} onClick={() => adminUpdateGrant(grant.id, 'revoked')}>Revoke</button> <button type="button" disabled={busy || grant.status === 'active'} onClick={() => adminUpdateGrant(grant.id, 'active')}>Reactivate</button></p>)}
            </div>)}
          </div>
          <div className="adminLookupGrid">
            {adminCoupons.slice(0, 10).map((coupon) => <div className="adminLookupCard" key={coupon.id}>
              <strong>{coupon.tier} coupon {coupon.code_hint || ''}</strong>
              <small>{coupon.status} • {coupon.redemption_count}/{coupon.max_redemptions} redeemed • recipient {coupon.recipient_email || 'any'}</small>
              <span>{coupon.duration_days || 'ongoing'} days access • code expires {fmtDate(coupon.expires_at)}</span>
              <small>Stripe: {coupon.metadata?.stripe ? 'promotion synced' : coupon.metadata?.stripe_error ? `error: ${coupon.metadata.stripe_error}` : 'not requested'}</small>
            </div>)}
          </div>
        </article>}

        {isAdmin && <article className="panel wide adminLivePanel providerControlPanel">
          <h3>Admin provider control center</h3>
          <p>Stripe can be managed from here for products, recurring prices, coupons, and promotion codes. Patreon is currently read/sync from its creator API; Patreon tier edits/native coupons still require Patreon Creator dashboard, while MyPetID grants/coupons handle free Patreon-equivalent app access.</p>
          <div className="actions"><button type="button" disabled={busy} onClick={() => loadWorkspace()}>Refresh provider snapshot</button><button type="button" disabled={busy} onClick={adminSyncPatreonTiers}>Sync Patreon tier metadata</button></div>
          <div className="grid2">
            <label>Stripe tier<select value={providerTierDraft.tier} onChange={(event) => setProviderTierDraft({ ...providerTierDraft, tier: event.target.value })}>{['basic','silver','gold','diamond'].map((tier) => <option key={tier} value={tier}>{tier}</option>)}</select></label>
            <label>Stripe product name<input value={providerTierDraft.name} onChange={(event) => setProviderTierDraft({ ...providerTierDraft, name: event.target.value })} /></label>
            <label>Monthly cents<input value={providerTierDraft.monthlyCents} onChange={(event) => setProviderTierDraft({ ...providerTierDraft, monthlyCents: event.target.value.replace(/\D/g, '') })} /></label>
            <label>Description<input value={providerTierDraft.description} onChange={(event) => setProviderTierDraft({ ...providerTierDraft, description: event.target.value })} /></label>
          </div>
          <div className="actions"><button className="primary" type="button" disabled={busy} onClick={adminCreateStripeTier}>Create Stripe product + monthly price</button></div>
          <div className="grid2">
            <label>Stripe coupon name<input value={stripeCouponDraft.name} onChange={(event) => setStripeCouponDraft({ ...stripeCouponDraft, name: event.target.value })} /></label>
            <label>Promotion code<input value={stripeCouponDraft.code} onChange={(event) => setStripeCouponDraft({ ...stripeCouponDraft, code: event.target.value.toUpperCase() })} placeholder="optional, e.g. CLYDEFREE" /></label>
            <label>Percent off<input value={stripeCouponDraft.percentOff} onChange={(event) => setStripeCouponDraft({ ...stripeCouponDraft, percentOff: event.target.value.replace(/\D/g, '') })} /></label>
            <label>Duration<select value={stripeCouponDraft.duration} onChange={(event) => setStripeCouponDraft({ ...stripeCouponDraft, duration: event.target.value })}><option value="once">once</option><option value="repeating">repeating</option><option value="forever">forever</option></select></label>
            <label>Duration months<input value={stripeCouponDraft.durationMonths} onChange={(event) => setStripeCouponDraft({ ...stripeCouponDraft, durationMonths: event.target.value.replace(/\D/g, '') })} /></label>
            <label>Max redemptions<input value={stripeCouponDraft.maxRedemptions} onChange={(event) => setStripeCouponDraft({ ...stripeCouponDraft, maxRedemptions: event.target.value.replace(/\D/g, '') })} /></label>
          </div>
          <div className="actions"><button className="primary" type="button" disabled={busy} onClick={adminCreateStripeCoupon}>Create Stripe coupon/promo</button></div>
          <div className="adminLookupGrid">
            <div className="adminLookupCard"><strong>Supabase tiers</strong><small>{providerSnapshot?.tiers?.length || 0} rows</small>{providerSnapshot?.tiers?.slice(0, 6).map((tier) => <p key={String(tier.tier)}><small>{String(tier.tier)} • {money(Number(tier.monthly_price || 0), 'usd')}/mo • Stripe {String(tier.stripe_price_id || 'n/a')} • Patreon {String(tier.patreon_tier_id || 'n/a')}</small></p>)}</div>
            <div className="adminLookupCard"><strong>Stripe products/prices</strong><small>{providerSnapshot?.stripe?.products?.length || 0} products • {providerSnapshot?.stripe?.prices?.length || 0} recurring prices</small>{providerSnapshot?.stripe?.errors?.map((error) => <p key={error}><small>Stripe warning: {error}</small></p>)}{providerSnapshot?.stripe?.prices?.slice(0, 6).map((price) => <p key={String(price.id)}><small>{String(price.nickname || price.id)} • {money(Number(price.unit_amount || 0), String(price.currency || 'usd'))}/{String(price.recurring?.interval || 'n/a')} • {String(price.active ? 'active' : 'archived')}</small></p>)}</div>
            <div className="adminLookupCard"><strong>Stripe coupons/promos</strong><small>{providerSnapshot?.stripe?.coupons?.length || 0} coupons • {providerSnapshot?.stripe?.promotion_codes?.length || 0} promo codes</small>{providerSnapshot?.stripe?.promotion_codes?.slice(0, 6).map((promo) => <p key={String(promo.id)}><small>{String(promo.code)} • {String(promo.active ? 'active' : 'disabled')} • redeemed {String(promo.times_redeemed || 0)}/{String(promo.max_redemptions || '∞')}</small></p>)}</div>
            <div className="adminLookupCard"><strong>Patreon campaign/tier sync</strong><small>{providerSnapshot?.patreon?.note || 'Refresh provider snapshot to load Patreon tier metadata.'}</small>{providerSnapshot?.patreon?.error && <p><small>Patreon warning: {providerSnapshot.patreon.error}</small></p>}{providerSnapshot?.patreon?.included?.filter((item) => item.type === 'tier').slice(0, 6).map((tier) => <p key={String(tier.id)}><small>{String(tier.attributes?.title || tier.id)} • {money(Number(tier.attributes?.amount_cents || 0), 'usd')}/mo • {String(tier.attributes?.published ? 'published' : 'not published')}</small></p>)}</div>
          </div>
        </article>}

        {isAdmin && <article className="panel wide adminLivePanel">
          <h3>Admin award rules</h3>
          <p>Live Supabase rules: admins can tune XP and targets. Customers can earn/log progress but cannot change rule values.</p>
          <div className="adminLookupGrid">{awardRules.map((rule) => <div className="adminLookupCard" key={rule.id}>
            <strong>{rule.icon} {rule.title}</strong>
            <small>{rule.category} • trigger: {rule.trigger_key} • {rule.active ? 'active' : 'inactive'}</small>
            <span>{rule.points} XP • target {rule.target}</span>
            <div className="actions compact"><button type="button" disabled={busy} onClick={() => saveAwardRule(rule, { points: rule.points + 10 })}>+10 XP</button><button type="button" disabled={busy} onClick={() => saveAwardRule(rule, { target: Number(rule.target) + 1 })}>+1 target</button><button type="button" disabled={busy} onClick={() => saveAwardRule(rule, { active: !rule.active })}>{rule.active ? 'Pause' : 'Activate'}</button></div>
          </div>)}</div>
        </article>}

        {isAdmin && <article className="panel wide adminLivePanel">
          <h3>Admin dashboard: live lookup + audit trail</h3>
          <p>Admin bypass remains unrestricted for CAK3D testing. Use lookup to connect an account to pets, tags, scans, documents, calendar events, verification requests, and recent edits.</p>
          <div className="grid2"><label>Search account, email, phone, or profile ID<input placeholder="dev.mypetid-adm@yahoo.com" value={adminSearch} onChange={(event) => setAdminSearch(event.target.value)} /></label><label>Admin count<input readOnly value={`${adminProfiles.length} profiles • ${tags.length} tags • ${scans.length} scans • ${activityRows.length} audit events`} /></label></div>
          <div className="grid2"><label>New Card ID<input value={newTagCode} onChange={(event) => setNewTagCode(event.target.value.toUpperCase())} placeholder="auto or MPID-2A81-K9C4" /></label><label>New one-time claim code<input value={newClaimCode} onChange={(event) => setNewClaimCode(event.target.value.toUpperCase())} placeholder="auto or 7394-M3P7I6D5" /></label><label>NFC UID / serial<input value={newNfcUid} onChange={(event) => setNewNfcUid(event.target.value.toUpperCase())} placeholder="046CE30FBE2A81" /></label><label>Finder NFC URL<input readOnly value={newTagCode.trim() ? `/scan/?tag=${encodeURIComponent(newTagCode.trim().toUpperCase())}&mode=finder` : 'Auto-generated after card creation'} /></label></div>
          <p className="formHint">Leave Card ID and claim code blank to randomize. Claim codes use the numeric + MPID pattern, like 7394-M3P7I6D5, and are only shown at generation time for packing slips.</p>
          <div className="actions"><button className="primary" type="button" disabled={busy} onClick={mintTag}>Generate card ID + claim code</button><button type="button" disabled={busy} onClick={() => loadWorkspace()}>Refresh lookup</button></div>
          <div className="adminLookupGrid">
            {filteredAdminDebugRows.length === 0 ? <p>No matching accounts loaded.</p> : filteredAdminDebugRows.map((row) => <button className="adminLookupCard" type="button" key={row.profile_id} onClick={() => setAdminSearch(row.email || row.profile_id)}>
              <strong>{row.email || row.profile_id}</strong>
              <small>{row.display_name || 'No display name'} • {row.tier}{row.is_admin ? ' • admin' : ''}</small>
              <span>{row.pet_count} pets • {row.tag_count} tags • {row.scan_count} scans</span>
              <span>{row.document_count} docs • {row.care_event_count} care • {row.calendar_event_count} calendar • {row.verification_count} verifications</span>
              <small>Last activity: {fmtDate(row.last_activity_at)}</small>
            </button>)}
          </div>
          <div className="auditTimeline">
            <strong>Recent account history</strong>
            {filteredActivityRows.length === 0 ? <p>No audit events loaded yet. New inserts/updates/deletes are tracked from the migration forward.</p> : filteredActivityRows.map((row) => <p key={row.id}>
              <span>{row.action.toUpperCase()} {row.target_table}</span><br />
              <small>{fmtDate(row.event_time)} • {row.actor_email || 'system/service'} • fields: {(row.changed_fields || []).join(', ') || 'record'} • #{row.target_record_id || 'n/a'}</small>
            </p>)}
          </div>
        </article>}
      </div>
    </section>
  );
}
