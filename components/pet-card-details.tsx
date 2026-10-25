"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { IdCardSvg } from './id-card';
import { BREED_NAMES, COAT_COLORS, COAT_TYPES, EYE_COLORS } from '../lib/breeds';
import { SIGNATURE_STYLES, STATUS_TAGS, US_STATES, coatCode, eyeCode, formatDob, formatHeight, licenseNumber, mergeLayout, sexCode, type CardLayout } from '../lib/id-card';

/**
 * The owner's dog profile + ID card details, saved to their MyPetID account (pets.profile
 * and profiles.details), so admins see the same data when making the physical card.
 */
type CloudPet = { id: string; name: string; breed: string | null; photo_url: string | null; behavior_public: string | null; medical_public: string | null; contact_public: Record<string, string | null> | null; public_fields: string[]; profile: Record<string, any> };
type Draft = {
  name: string; breed: string; photo_url: string; about: string; health: string;
  sex: string; birthday: string; height_in: string; weight_lb: string; eyes: string; coat: string; colors: string; microchip: string; rabies_tag: string;
  status_tags: string[]; state: string; full_name: string; species: string; restrictions: string; signature_style: string;
  vet_clinic: string; vet_phone: string; contact_phone: string; contact_email: string;
  show_details: boolean; show_vet: boolean;
  line1: string; line2: string; city: string; addr_state: string; postal_code: string; card_phone: string;
};

function toDraft(pet: CloudPet, owner: Record<string, any>): Draft {
  const p = pet.profile || {}; const d = p.details || {}; const c = p.card || {}; const v = p.vet || {}; const a = owner.address || {};
  return {
    name: pet.name || '', breed: pet.breed || '', photo_url: pet.photo_url || '', about: pet.behavior_public || '', health: pet.medical_public || '',
    sex: d.sex || '', birthday: d.birthday || '', height_in: d.height_in ? String(d.height_in) : '', weight_lb: d.weight_lb ? String(d.weight_lb) : '', eyes: d.eyes || '', coat: d.coat || '', colors: d.colors || '', microchip: d.microchip || '', rabies_tag: d.rabies_tag || '',
    status_tags: Array.isArray(p.status_tags) ? p.status_tags : [], state: c.state || a.state || '', full_name: c.full_name || '', species: c.species || 'Canine', restrictions: c.restrictions || '', signature_style: c.signature_style || 'script',
    vet_clinic: v.clinic || '', vet_phone: v.phone || '', contact_phone: pet.contact_public?.phone || '', contact_email: pet.contact_public?.email || '',
    show_details: pet.public_fields?.includes('details') ?? false, show_vet: pet.public_fields?.includes('vet') ?? false,
    line1: a.line1 || '', line2: a.line2 || '', city: a.city || '', addr_state: a.state || '', postal_code: a.postal_code || '', card_phone: owner.card_phone || '',
  };
}

export function PetCardDetails({ localPetName }: { localPetName?: string }) {
  const [me, setMe] = useState('');
  const [pets, setPets] = useState<CloudPet[]>([]);
  const [petId, setPetId] = useState('');
  const [owner, setOwner] = useState<Record<string, any>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [template, setTemplate] = useState<{ background_url: string | null; layout: Partial<CardLayout> } | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'about' | 'details' | 'contact' | 'card'>('about');

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    setMe(auth.user.id);
    const [{ data: rows }, { data: profile }] = await Promise.all([
      supabase.from('pets').select('id,name,breed,photo_url,behavior_public,medical_public,contact_public,public_fields,profile').eq('owner_id', auth.user.id).order('created_at'),
      supabase.from('profiles').select('details').eq('id', auth.user.id).maybeSingle(),
    ]);
    const list = (rows || []) as CloudPet[];
    setPets(list);
    setOwner(((profile as { details?: Record<string, any> } | null)?.details) || {});
    setPetId((current) => current && list.some((p) => p.id === current) ? current : list[0]?.id || '');
  }, []);
  useEffect(() => { load(); }, [load]);

  const pet = useMemo(() => pets.find((p) => p.id === petId) || null, [pets, petId]);
  useEffect(() => { if (pet) setDraft(toDraft(pet, owner)); }, [pet, owner]);
  useEffect(() => {
    if (!supabase || !draft?.state) return;
    supabase.from('card_templates').select('background_url,layout').eq('state', draft.state).maybeSingle().then(({ data }) => setTemplate((data as typeof template) || null));
  }, [draft?.state]);

  async function addPet() {
    if (!supabase || !me) return;
    const { data, error } = await supabase.from('pets').insert({ owner_id: me, name: localPetName || 'My dog', species: 'dog', public_fields: ['name', 'photo', 'contact', 'medical_public', 'behavior_public', 'lost_mode', 'last_scan'] }).select('id').single();
    if (error) return setMessage(error.message);
    setPetId((data as { id: string }).id);
    await load();
  }

  async function uploadPhoto(file?: File | null) {
    if (!supabase || !file || !me || !draft) return;
    const path = `${me}/${Date.now()}-${file.name.replace(/[^a-z0-9.]+/gi, '-').toLowerCase()}`;
    const { error } = await supabase.storage.from('pet-photos').upload(path, file, { upsert: true, contentType: file.type });
    if (error) return setMessage(error.message);
    setDraft({ ...draft, photo_url: supabase.storage.from('pet-photos').getPublicUrl(path).data.publicUrl });
    setMessage('Photo uploaded. Save to keep it.');
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !pet || !draft) return;
    setBusy(true);
    const fields = new Set(pet.public_fields || []);
    draft.show_details ? fields.add('details') : fields.delete('details');
    draft.show_vet ? fields.add('vet') : fields.delete('vet');
    const profile = {
      ...(pet.profile || {}),
      status_tags: draft.status_tags,
      details: { ...(pet.profile?.details || {}), sex: draft.sex, birthday: draft.birthday, height_in: draft.height_in ? Number(draft.height_in) : null, weight_lb: draft.weight_lb ? Number(draft.weight_lb) : null, eyes: draft.eyes, coat: draft.coat, colors: draft.colors, microchip: draft.microchip, rabies_tag: draft.rabies_tag, age: '', size: '' },
      card: { ...(pet.profile?.card || {}), state: draft.state, full_name: draft.full_name, species: draft.species, restrictions: draft.restrictions, signature_style: draft.signature_style },
      vet: { ...(pet.profile?.vet || {}), clinic: draft.vet_clinic, phone: draft.vet_phone },
    };
    const { error } = await supabase.from('pets').update({ name: draft.name.trim() || pet.name, breed: draft.breed || null, photo_url: draft.photo_url || null, behavior_public: draft.about || null, medical_public: draft.health || null, contact_public: { phone: draft.contact_phone || null, email: draft.contact_email || null }, public_fields: Array.from(fields), profile }).eq('id', pet.id);
    const ownerDetails = { ...owner, card_phone: draft.card_phone, address: { line1: draft.line1, line2: draft.line2, city: draft.city, state: draft.addr_state, postal_code: draft.postal_code } };
    const { error: ownerError } = await supabase.from('profiles').update({ details: ownerDetails }).eq('id', me);
    setBusy(false);
    if (error || ownerError) return setMessage((error || ownerError)!.message);
    setMessage('Saved to your account.');
    await load();
  }

  if (!supabase) return null;
  if (!me) return null;
  if (!pets.length) return (
    <section className="panel full petCardDetails">
      <div className="panelTitleRow"><div><p className="eyebrow">Your account</p><h2>Add your dog to your account</h2></div></div>
      <p>Your dog’s profile is saved on this device only. Add it to your account so it’s backed up, shows on your tag and can be printed on your MyPetID card.</p>
      <div className="actions"><button className="primary" type="button" onClick={addPet}>Add {localPetName || 'my dog'} to my account</button></div>
      {message && <p className="authMessage">{message}</p>}
    </section>
  );
  if (!draft) return null;
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const toggleTag = (key: string) => set({ status_tags: draft.status_tags.includes(key) ? draft.status_tags.filter((t) => t !== key) : [...draft.status_tags, key] });
  const cardData = { state: draft.state || 'ME', petName: draft.name, fullName: draft.full_name || draft.name, species: draft.species, photoUrl: draft.photo_url || '/images/logo/MyPetID-Logo_Resized.jpg', address1: [draft.line1, draft.line2].filter(Boolean).join(' '), address2: [draft.city, [draft.addr_state, draft.postal_code].filter(Boolean).join(' ')].filter(Boolean).join(', '), phone: draft.card_phone, height: formatHeight(draft.height_in), weight: draft.weight_lb ? `${draft.weight_lb}lbs` : '', eyes: eyeCode(draft.eyes), sex: sexCode(draft.sex), dob: formatDob(draft.birthday), restrictions: draft.restrictions, license: licenseNumber(draft.rabies_tag, draft.microchip, pet?.id), coat: coatCode(draft.colors || draft.coat), signatureFont: draft.signature_style as never, statusTags: draft.status_tags, qrUrl: '', barcode: '' };

  return (
    <form className="panel full petCardDetails" onSubmit={save}>
      <div className="panelTitleRow"><div><p className="eyebrow">Saved to your account</p><h2>{draft.name || 'Your dog'}’s profile & ID card</h2></div>
        {pets.length > 1 && <select value={petId} onChange={(e) => setPetId(e.target.value)} aria-label="Choose dog" style={{ width: 'auto' }}>{pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}</div>
      {message && <p className="authMessage" role="status">{message}</p>}

      <div className="formTabs" role="tablist" aria-label="Profile sections">{([['about', 'About'], ['details', 'Details'], ['contact', 'Contact & vet'], ['card', 'ID card']] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</div>
      {tab === 'about' && <div>
          <h3>Status tags</h3>
          <p className="formHint">These show on the card and to anyone who scans the tag, so they know how to help.</p>
          <div className="chipCloud tagPicker">{STATUS_TAGS.map((t) => <button key={t.key} type="button" className={draft.status_tags.includes(t.key) ? 'activeMini' : ''} aria-pressed={draft.status_tags.includes(t.key)} onClick={() => toggleTag(t.key)}>{t.label}</button>)}</div>

          <h3>About your dog</h3>
          <div className="grid2">
            <label>Name<input value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={40} /></label>
            <label>Breed<input list="card-breeds" value={draft.breed} onChange={(e) => set({ breed: e.target.value })} /><datalist id="card-breeds">{BREED_NAMES.map((b) => <option key={b} value={b} />)}</datalist></label>
            <label>Photo<input type="file" accept="image/*" onChange={(e) => uploadPhoto(e.target.files?.[0])} /></label>
          </div>
          <label>Personality (public)<textarea value={draft.about} onChange={(e) => set({ about: e.target.value })} maxLength={1000} /></label>
          <label>Health notes for finders (public)<textarea value={draft.health} onChange={(e) => set({ health: e.target.value })} maxLength={1000} /></label>

      </div>}
      {tab === 'details' && <div>
          <h3>Body & markings</h3>
          <div className="grid2">
            <label>Sex<select value={draft.sex} onChange={(e) => set({ sex: e.target.value })}><option value="">Select</option><option>Male</option><option>Female</option><option>Male (neutered)</option><option>Female (spayed)</option></select></label>
            <label>Date of birth<input type="date" value={draft.birthday} onChange={(e) => set({ birthday: e.target.value })} /></label>
            <label>Height at shoulder (inches)<input inputMode="decimal" value={draft.height_in} onChange={(e) => set({ height_in: e.target.value.replace(/[^\d.]/g, '') })} placeholder="20" /></label>
            <label>Weight (lb)<input inputMode="decimal" value={draft.weight_lb} onChange={(e) => set({ weight_lb: e.target.value.replace(/[^\d.]/g, '') })} placeholder="53" /></label>
            <label>Eyes<select value={draft.eyes} onChange={(e) => set({ eyes: e.target.value })}><option value="">Select</option>{EYE_COLORS.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>Coat<select value={draft.coat} onChange={(e) => set({ coat: e.target.value })}><option value="">Select</option>{COAT_TYPES.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>Colors<input list="card-colors" value={draft.colors} onChange={(e) => set({ colors: e.target.value })} /><datalist id="card-colors">{COAT_COLORS.map((c) => <option key={c} value={c} />)}</datalist></label>
            <label>Microchip<input value={draft.microchip} onChange={(e) => set({ microchip: e.target.value })} inputMode="numeric" /></label>
            <label>Rabies tag number<input value={draft.rabies_tag} onChange={(e) => set({ rabies_tag: e.target.value })} placeholder="Used as the card's license number" maxLength={24} /></label>
          </div>
      </div>}
      {tab === 'contact' && <div>
          <h3>Contact & vet</h3>
          <div className="grid2">
            <label>Phone for finders<input value={draft.contact_phone} onChange={(e) => set({ contact_phone: e.target.value })} inputMode="tel" /></label>
            <label>Email for finders<input value={draft.contact_email} onChange={(e) => set({ contact_email: e.target.value })} type="email" /></label>
            <label>Vet clinic<input value={draft.vet_clinic} onChange={(e) => set({ vet_clinic: e.target.value })} /></label>
            <label>Vet phone<input value={draft.vet_phone} onChange={(e) => set({ vet_phone: e.target.value })} inputMode="tel" /></label>
          </div>
          <label className="toggleRow"><input type="checkbox" checked={draft.show_details} onChange={(e) => set({ show_details: e.target.checked })} /> Show sex, size, coat and microchip on the scan page</label>
          <label className="toggleRow"><input type="checkbox" checked={draft.show_vet} onChange={(e) => set({ show_vet: e.target.checked })} /> Show my vet on the scan page</label>
      </div>}
      {tab === 'card' && <div className="cardDetailsGrid">
        <div>
          <div className="grid2">
            <label>Card state<select value={draft.state} onChange={(e) => set({ state: e.target.value })}><option value="">Select your state</option>{US_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></label>
            <label>Species line<select value={draft.species} onChange={(e) => set({ species: e.target.value })}>{['Canine', 'Service Canine', 'Support Canine', 'Therapy Canine', 'K9'].map((s) => <option key={s}>{s}</option>)}</select></label>
            <label>Full name (signature)<input value={draft.full_name} onChange={(e) => set({ full_name: e.target.value })} placeholder={`${draft.name || 'Clyde'} Rio Evensen`} maxLength={40} /></label>
            <label>Restrictions (just for fun)<input value={draft.restrictions} onChange={(e) => set({ restrictions: e.target.value })} placeholder="Not allowed on furniture" maxLength={34} /></label>
            <label>Signature style<select value={draft.signature_style} onChange={(e) => set({ signature_style: e.target.value })}>{SIGNATURE_STYLES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
            <label>License number<input value={licenseNumber(draft.rabies_tag, draft.microchip, pet?.id)} readOnly title="Your rabies tag number, else your microchip, else a MyPetID number" /></label>
          </div>
          <h3>Address printed on the card</h3>
          <p className="formHint">Only used on your physical card. It’s never shown on the scan page.</p>
          <label>Street<input value={draft.line1} onChange={(e) => set({ line1: e.target.value })} autoComplete="address-line1" /></label>
          <div className="grid2">
            <label>Apt / unit<input value={draft.line2} onChange={(e) => set({ line2: e.target.value })} autoComplete="address-line2" /></label>
            <label>City<input value={draft.city} onChange={(e) => set({ city: e.target.value })} autoComplete="address-level2" /></label>
            <label>State<input value={draft.addr_state} onChange={(e) => set({ addr_state: e.target.value.toUpperCase().slice(0, 2) })} autoComplete="address-level1" /></label>
            <label>ZIP<input value={draft.postal_code} onChange={(e) => set({ postal_code: e.target.value })} autoComplete="postal-code" inputMode="numeric" /></label>
          </div>
          <label>Phone printed on the card<input value={draft.card_phone} onChange={(e) => set({ card_phone: e.target.value })} inputMode="tel" autoComplete="tel" /></label>
        </div>
        <div><div className="cardMini"><IdCardSvg data={cardData} layout={mergeLayout(template?.layout)} background={template?.background_url} hideCodes /></div><p className="formHint">The QR code and barcode are added when MyPetID prints your card.</p></div>
      </div>}
      <div className="actions"><button className="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save to my account'}</button></div>
    </form>
  );
}
