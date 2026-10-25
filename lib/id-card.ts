/**
 * MyPetID pet ID card ("pet drivers license") data: US states, the default field
 * layout (measured from the original Maine card), and status tags.
 * Card size is CR80 at 300 dpi: 3.375 x 2.125 in = 1012 x 638 px (+ 1/8 in bleed for print).
 */

export const CARD_W = 1012;
export const CARD_H = 638;
export const BLEED = 38; // 1/8 in at 300 dpi

export type UsState = { code: string; name: string; nickname: string; colors: [string, string, string] };

// colors: [header ink, banner, accent]; original palettes inspired by each state's flag colors.
export const US_STATES: UsState[] = [
  { code: 'AL', name: 'Alabama', nickname: 'Heart of Dixie', colors: ['#9e1b32', '#9e1b32', '#c9a227'] },
  { code: 'AK', name: 'Alaska', nickname: 'The Last Frontier', colors: ['#0f2d6b', '#123f8f', '#f2c14e'] },
  { code: 'AZ', name: 'Arizona', nickname: 'Grand Canyon State', colors: ['#002868', '#bf5b04', '#ce5c17'] },
  { code: 'AR', name: 'Arkansas', nickname: 'The Natural State', colors: ['#a51c30', '#1d3f8a', '#a51c30'] },
  { code: 'CA', name: 'California', nickname: 'The Golden State', colors: ['#1a3d7c', '#1a3d7c', '#c8102e'] },
  { code: 'CO', name: 'Colorado', nickname: 'Centennial State', colors: ['#0c3c8c', '#0c3c8c', '#d4a017'] },
  { code: 'CT', name: 'Connecticut', nickname: 'Constitution State', colors: ['#14306b', '#1f4f9c', '#c9a227'] },
  { code: 'DE', name: 'Delaware', nickname: 'The First State', colors: ['#1d5a8f', '#2271b3', '#c9a227'] },
  { code: 'DC', name: 'District of Columbia', nickname: 'The Capital', colors: ['#b31942', '#b31942', '#1c2430'] },
  { code: 'FL', name: 'Florida', nickname: 'Sunshine State', colors: ['#c8102e', '#0b74b8', '#f28c28'] },
  { code: 'GA', name: 'Georgia', nickname: 'Peach State', colors: ['#1c3f8c', '#b22234', '#f4a259'] },
  { code: 'HI', name: 'Hawaii', nickname: 'The Aloha State', colors: ['#0b4f8c', '#0b7fa8', '#d9a21b'] },
  { code: 'ID', name: 'Idaho', nickname: 'Gem State', colors: ['#14306b', '#1f4f9c', '#c29b2c'] },
  { code: 'IL', name: 'Illinois', nickname: 'Land of Lincoln', colors: ['#1c2b5a', '#2c4a8f', '#c9a227'] },
  { code: 'IN', name: 'Indiana', nickname: 'The Hoosier State', colors: ['#1e3a8a', '#1e3a8a', '#d4a017'] },
  { code: 'IA', name: 'Iowa', nickname: 'Hawkeye State', colors: ['#1d4f9c', '#c8102e', '#1d4f9c'] },
  { code: 'KS', name: 'Kansas', nickname: 'Sunflower State', colors: ['#1a3d8c', '#1a3d8c', '#e8b923'] },
  { code: 'KY', name: 'Kentucky', nickname: 'Bluegrass State', colors: ['#102a6b', '#1f3f8f', '#c9a227'] },
  { code: 'LA', name: 'Louisiana', nickname: 'Pelican State', colors: ['#0b3a6e', '#0b3a6e', '#d4a017'] },
  { code: 'ME', name: 'Maine', nickname: 'The Pine Tree State', colors: ['#2a74b8', '#1f6fd1', '#c97a2b'] },
  { code: 'MD', name: 'Maryland', nickname: 'Old Line State', colors: ['#b31942', '#1c1c1c', '#e8b923'] },
  { code: 'MA', name: 'Massachusetts', nickname: 'Bay State', colors: ['#14306b', '#1f4f9c', '#d4a017'] },
  { code: 'MI', name: 'Michigan', nickname: 'Great Lakes State', colors: ['#0b3a7a', '#0b5aa8', '#c9a227'] },
  { code: 'MN', name: 'Minnesota', nickname: 'Land of 10,000 Lakes', colors: ['#0b3a7a', '#0b5aa8', '#4f9d69'] },
  { code: 'MS', name: 'Mississippi', nickname: 'Magnolia State', colors: ['#1c3f8c', '#b22234', '#d4a017'] },
  { code: 'MO', name: 'Missouri', nickname: 'Show-Me State', colors: ['#1c3f8c', '#b22234', '#1c3f8c'] },
  { code: 'MT', name: 'Montana', nickname: 'Treasure State', colors: ['#14306b', '#1f4f9c', '#c29b2c'] },
  { code: 'NE', name: 'Nebraska', nickname: 'Cornhusker State', colors: ['#14306b', '#1f4f9c', '#c9a227'] },
  { code: 'NV', name: 'Nevada', nickname: 'Silver State', colors: ['#0b3a7a', '#0b5aa8', '#9aa3ad'] },
  { code: 'NH', name: 'New Hampshire', nickname: 'Granite State', colors: ['#14306b', '#1f4f9c', '#c9a227'] },
  { code: 'NJ', name: 'New Jersey', nickname: 'Garden State', colors: ['#8a6d1f', '#4b84c4', '#c9a227'] },
  { code: 'NM', name: 'New Mexico', nickname: 'Land of Enchantment', colors: ['#b31942', '#c8102e', '#f2c14e'] },
  { code: 'NY', name: 'New York', nickname: 'The Empire State', colors: ['#0b2d6b', '#0b4a9c', '#e09b1a'] },
  { code: 'NC', name: 'North Carolina', nickname: 'Tar Heel State', colors: ['#14306b', '#b22234', '#1f4f9c'] },
  { code: 'ND', name: 'North Dakota', nickname: 'Peace Garden State', colors: ['#14306b', '#1f4f9c', '#c9a227'] },
  { code: 'OH', name: 'Ohio', nickname: 'The Buckeye State', colors: ['#b31942', '#1c2b5a', '#b31942'] },
  { code: 'OK', name: 'Oklahoma', nickname: 'Sooner State', colors: ['#1a6fa3', '#1a6fa3', '#8a5a2b'] },
  { code: 'OR', name: 'Oregon', nickname: 'Beaver State', colors: ['#102a6b', '#1d3f8a', '#e8b923'] },
  { code: 'PA', name: 'Pennsylvania', nickname: 'Keystone State', colors: ['#14306b', '#1f4f9c', '#c9a227'] },
  { code: 'RI', name: 'Rhode Island', nickname: 'The Ocean State', colors: ['#1d3f8a', '#1d3f8a', '#d4a017'] },
  { code: 'SC', name: 'South Carolina', nickname: 'Palmetto State', colors: ['#14306b', '#14457a', '#9aa3ad'] },
  { code: 'SD', name: 'South Dakota', nickname: 'Mount Rushmore State', colors: ['#1a5a96', '#1a5a96', '#d4a017'] },
  { code: 'TN', name: 'Tennessee', nickname: 'Volunteer State', colors: ['#b31942', '#1c3f8c', '#b31942'] },
  { code: 'TX', name: 'Texas', nickname: 'The Lone Star State', colors: ['#002868', '#bf0a30', '#002868'] },
  { code: 'UT', name: 'Utah', nickname: 'Beehive State', colors: ['#14306b', '#1f4f9c', '#c29b2c'] },
  { code: 'VT', name: 'Vermont', nickname: 'Green Mountain State', colors: ['#0b4f3c', '#0b6e4f', '#c9a227'] },
  { code: 'VA', name: 'Virginia', nickname: 'Old Dominion', colors: ['#14306b', '#1f4f9c', '#b22234'] },
  { code: 'WA', name: 'Washington', nickname: 'The Evergreen State', colors: ['#0b5a3c', '#0b6e4f', '#c9a227'] },
  { code: 'WV', name: 'West Virginia', nickname: 'Mountain State', colors: ['#14306b', '#1f4f9c', '#e8b923'] },
  { code: 'WI', name: 'Wisconsin', nickname: "America's Dairyland", colors: ['#14306b', '#1f4f9c', '#c9a227'] },
  { code: 'WY', name: 'Wyoming', nickname: 'Equality State', colors: ['#b31942', '#1d3f8a', '#b31942'] },
];
export const stateByCode = (code?: string | null) => US_STATES.find((s) => s.code === (code || '').toUpperCase());

/** Status tags owners can pick. They show on the card, the profile and the scan page. */
export const STATUS_TAGS = [
  { key: 'service', label: 'Service dog', short: 'SERVICE', tone: 'blue' },
  { key: 'emotional_support', label: 'Emotional support', short: 'SUPPORT', tone: 'violet' },
  { key: 'therapy', label: 'Therapy dog', short: 'THERAPY', tone: 'blue' },
  { key: 'medical_alert', label: 'Medical alert', short: 'MEDICAL', tone: 'red' },
  { key: 'medical_needs', label: 'Has medical needs', short: 'MED NEEDS', tone: 'red' },
  { key: 'rescue', label: 'Rescue', short: 'RESCUE', tone: 'green' },
  { key: 'senior', label: 'Senior', short: 'SENIOR', tone: 'gold' },
  { key: 'deaf', label: 'Deaf', short: 'DEAF', tone: 'gold' },
  { key: 'blind', label: 'Blind / low vision', short: 'BLIND', tone: 'gold' },
  { key: 'reactive', label: 'Needs space / reactive', short: 'NEEDS SPACE', tone: 'red' },
  { key: 'in_training', label: 'In training', short: 'IN TRAINING', tone: 'green' },
] as const;
export type StatusTagKey = typeof STATUS_TAGS[number]['key'];
export const statusTag = (key: string) => STATUS_TAGS.find((t) => t.key === key);
export const TAG_COLORS: Record<string, string> = { blue: '#1f5fa8', violet: '#6b4fd1', red: '#b8322a', green: '#2f7d32', gold: '#9a6500' };

export type CardField =
  | 'state' | 'banner' | 'country' | 'scan' | 'species' | 'name' | 'address1' | 'address2' | 'phone'
  | 'labelHeight' | 'labelWeight' | 'labelEyes' | 'labelSex' | 'height' | 'weight' | 'eyes' | 'sex'
  | 'labelDob' | 'labelRestrictions' | 'dob' | 'restrictions' | 'signature' | 'tags' | 'license' | 'labelCoat' | 'coat' | 'issued';
export type CardBox = 'photo' | 'qr' | 'barcode' | 'seal';
export type TextSpec = { x: number; y: number; size: number; color?: string; weight?: 400 | 700; font?: 'serif' | 'sans' | 'script' | 'script2' | 'script3' | 'script4'; anchor?: 'start' | 'middle' | 'end'; hidden?: boolean };
export type BoxSpec = { x: number; y: number; w: number; h: number; hidden?: boolean };
export type CardLayout = { text: Record<CardField, TextSpec>; boxes: Record<CardBox, BoxSpec>; bannerBox: BoxSpec };

/** Positions measured from the original MyPetID Maine card (1012 x 638 px). */
export const DEFAULT_LAYOUT: CardLayout = {
  bannerBox: { x: 377, y: 22, w: 486, h: 38 },
  text: {
    state: { x: 14, y: 56, size: 62, weight: 700, font: 'serif' },
    banner: { x: 620, y: 51, size: 27, weight: 700, color: '#ffffff', anchor: 'middle' },
    country: { x: 968, y: 24, size: 17, weight: 700, anchor: 'middle' },
    scan: { x: 372, y: 108, size: 25, weight: 700, color: '#1c2430' },
    license: { x: 380, y: 200, size: 20, weight: 700, color: '#1c2430' },
    issued: { x: 846, y: 318, size: 18, weight: 700, color: '#1c2430' },
    species: { x: 833, y: 156, size: 31, weight: 700, color: '#1c2430' },
    name: { x: 380, y: 240, size: 38, weight: 700, color: '#141414' },
    address1: { x: 380, y: 290, size: 30, weight: 700, color: '#141414' },
    address2: { x: 380, y: 339, size: 30, weight: 700, color: '#141414' },
    phone: { x: 380, y: 398, size: 40, weight: 700, color: '#d23b2b' },
    tags: { x: 380, y: 432, size: 15, weight: 700 },
    labelHeight: { x: 390, y: 470, size: 25, weight: 700, color: '#141414' },
    labelWeight: { x: 530, y: 470, size: 25, weight: 700, color: '#141414' },
    labelEyes: { x: 670, y: 470, size: 25, weight: 700, color: '#141414' },
    labelCoat: { x: 770, y: 470, size: 25, weight: 700, color: '#141414' },
    labelSex: { x: 925, y: 470, size: 25, weight: 700, color: '#141414' },
    height: { x: 390, y: 516, size: 25, weight: 700, color: '#141414' },
    weight: { x: 530, y: 516, size: 25, weight: 700, color: '#141414' },
    eyes: { x: 670, y: 516, size: 25, weight: 700, color: '#141414' },
    coat: { x: 770, y: 516, size: 20, weight: 700, color: '#141414' },
    sex: { x: 925, y: 516, size: 25, weight: 700, color: '#141414' },
    labelDob: { x: 390, y: 572, size: 25, weight: 700, color: '#141414' },
    labelRestrictions: { x: 558, y: 572, size: 25, weight: 700, color: '#141414' },
    dob: { x: 390, y: 610, size: 24, weight: 700, color: '#141414' },
    restrictions: { x: 558, y: 610, size: 20, weight: 700, color: '#141414' },
    signature: { x: 10, y: 590, size: 32, font: 'script', color: '#1c2430' },
  },
  boxes: {
    photo: { x: 0, y: 152, w: 322, h: 364 },
    qr: { x: 642, y: 79, w: 182, h: 182 },
    seal: { x: 846, y: 176, w: 116, h: 116 },
    barcode: { x: 372, y: 120, w: 252, h: 52 },
  },
};

/**
 * Layout for uploaded artwork that already has the state name, the PET DRIVERS LICENSE banner and
 * any seal drawn in (like the owner-made Alabama to Colorado cards). Matches the template kit guide.
 */
export const ARTWORK_LAYOUT: CardLayout = {
  bannerBox: { ...DEFAULT_LAYOUT.bannerBox, hidden: true },
  text: {
    ...DEFAULT_LAYOUT.text,
    state: { ...DEFAULT_LAYOUT.text.state, hidden: true },
    banner: { ...DEFAULT_LAYOUT.text.banner, hidden: true },
    country: { ...DEFAULT_LAYOUT.text.country, hidden: true },
    species: { x: 840, y: 157, size: 32, weight: 700, color: '#111111' },
    scan: { x: 840, y: 226, size: 15, weight: 700, color: '#1c2430' },
    license: { x: 399, y: 410, size: 18, weight: 700, color: '#1c2430' },
    tags: { x: 560, y: 410, size: 14, weight: 700 },
    issued: { x: 770, y: 410, size: 15, weight: 700, color: '#1c2430' },
    name: { x: 399, y: 230, size: 40, weight: 700, color: '#111111' },
    address1: { x: 399, y: 278, size: 32, weight: 700, color: '#111111' },
    address2: { x: 399, y: 324, size: 32, weight: 700, color: '#111111' },
    phone: { x: 399, y: 380, size: 42, weight: 700, color: '#e3121b' },
    labelHeight: { x: 407, y: 452, size: 26, weight: 700, color: '#111111' },
    labelWeight: { x: 555, y: 452, size: 26, weight: 700, color: '#111111' },
    labelEyes: { x: 700, y: 452, size: 26, weight: 700, color: '#111111' },
    labelCoat: { x: 795, y: 452, size: 26, weight: 700, color: '#111111' },
    labelSex: { x: 905, y: 452, size: 26, weight: 700, color: '#111111' },
    height: { x: 407, y: 490, size: 25, weight: 700, color: '#111111' },
    weight: { x: 555, y: 490, size: 25, weight: 700, color: '#111111' },
    eyes: { x: 700, y: 490, size: 25, weight: 700, color: '#111111' },
    coat: { x: 795, y: 490, size: 20, weight: 700, color: '#111111' },
    sex: { x: 905, y: 490, size: 25, weight: 700, color: '#111111' },
    labelDob: { x: 407, y: 532, size: 26, weight: 700, color: '#111111' },
    labelRestrictions: { x: 569, y: 532, size: 26, weight: 700, color: '#111111' },
    dob: { x: 407, y: 570, size: 24, weight: 700, color: '#111111' },
    restrictions: { x: 569, y: 570, size: 20, weight: 700, color: '#111111' },
    signature: { x: 40, y: 588, size: 30, font: 'script', color: '#111111' },
  },
  boxes: {
    photo: { x: 40, y: 150, w: 320, h: 340 },
    qr: { x: 840, y: 232, w: 130, h: 130 },
    seal: { ...DEFAULT_LAYOUT.boxes.seal, hidden: true },
    barcode: { x: 40, y: 500, w: 300, h: 34 },
  },
};

export function mergeLayout(saved?: Partial<CardLayout> | null): CardLayout {
  return {
    bannerBox: { ...DEFAULT_LAYOUT.bannerBox, ...(saved?.bannerBox || {}) },
    text: Object.fromEntries((Object.keys(DEFAULT_LAYOUT.text) as CardField[]).map((k) => [k, { ...DEFAULT_LAYOUT.text[k], ...(saved?.text?.[k] || {}) }])) as CardLayout['text'],
    boxes: Object.fromEntries((Object.keys(DEFAULT_LAYOUT.boxes) as CardBox[]).map((k) => [k, { ...DEFAULT_LAYOUT.boxes[k], ...(saved?.boxes?.[k] || {}) }])) as CardLayout['boxes'],
  };
}

/** Everything printed on a card. */
export type CardData = {
  state: string;
  petName: string;
  fullName: string;
  species: string;
  photoUrl: string;
  address1: string;
  address2: string;
  phone: string;
  height: string;
  weight: string;
  eyes: string;
  sex: string;
  dob: string;
  restrictions: string;
  license: string;
  /** MM/DD/YYYY the card was issued. */
  issued?: string;
  coat: string;
  signatureFont?: 'script' | 'script2' | 'script3' | 'script4';
  statusTags: string[];
  qrUrl: string;
  barcode: string;
};

export function eyeCode(eyes?: string) {
  const v = (eyes || '').toLowerCase();
  const map: Record<string, string> = { brown: 'BRN', amber: 'AMB', hazel: 'HAZ', blue: 'BLU', green: 'GRN', gray: 'GRY', grey: 'GRY', black: 'BLK', yellow: 'YEL', heterochromia: 'MIX', 'odd-eyed': 'MIX' };
  return map[v] || (eyes || '').slice(0, 3).toUpperCase();
}
export function sexCode(sex?: string) { const v = (sex || '').toLowerCase(); return v.startsWith('m') ? 'M' : v.startsWith('f') ? 'F' : (sex || '').slice(0, 1).toUpperCase(); }
export function formatDob(value?: string) {
  if (!value) return '';
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
}
export function formatHeight(inches?: string | number) {
  const n = Number(inches);
  if (!n) return typeof inches === 'string' ? inches : '';
  return `${Math.floor(n / 12)}'${Math.round(n % 12)}"`;
}

/** Signature styles owners can pick (system script fonts so print files match). */
export const SIGNATURE_STYLES = [
  { key: 'script', label: 'Classic script' },
  { key: 'script2', label: 'Elegant' },
  { key: 'script3', label: 'Handwritten' },
  { key: 'script4', label: 'Bold marker' },
] as const;

/**
 * License number: the dog's rabies tag number followed by the owner's account number padded to
 * 3 digits (tag 8397 + account 1 -> 8397001; account 1000+ prints in full). Without a rabies tag
 * the microchip is used, else a stable 9-digit number from the pet id.
 */
export function licenseNumber(rabiesTag?: string, microchip?: string, petId?: string, accountNumber?: number | null) {
  const account = accountNumber && accountNumber > 0 ? String(accountNumber).padStart(3, '0') : '';
  if (rabiesTag && rabiesTag.trim()) return `${rabiesTag.trim().toUpperCase()}${account}`;
  if (microchip && microchip.trim()) return `${microchip.trim()}${account}`;
  let h = 2166136261;
  for (const c of petId || 'mypetid') h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return `${String((h >>> 0) % 1000000000).padStart(9, '0')}${account}`;
}

/** Today's date as YYYY-MM-DD (local), the default issue date. */
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Short coat color for the card, e.g. "Black and white" -> "BLK/WHT". */
export function coatCode(value?: string) {
  if (!value) return '';
  const short: Record<string, string> = { black: 'BLK', white: 'WHT', brown: 'BRN', tan: 'TAN', red: 'RED', cream: 'CRM', gray: 'GRY', grey: 'GRY', blue: 'BLU', gold: 'GLD', golden: 'GLD', fawn: 'FWN', brindle: 'BRDL', merle: 'MRL', liver: 'LVR', yellow: 'YEL', chocolate: 'CHOC', sable: 'SBL', tricolor: 'TRI', apricot: 'APR', silver: 'SLV' };
  const parts = value.toLowerCase().split(/[^a-z]+/).filter((w) => w && w !== 'and' && w !== 'with');
  const codes = parts.map((w) => short[w] || w.slice(0, 3).toUpperCase());
  return codes.slice(0, 3).join('/');
}
