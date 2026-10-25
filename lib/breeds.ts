// Breed data and care recommendations for MyPetID.
// This is general guidance compiled from common breed references (AKC and other
// standard breed resources). It is not veterinary advice: ranges are typical, every
// dog is an individual, and owners should ask their vet about diet, exercise and health.

export type SizeClass = 'toy' | 'small' | 'medium' | 'large' | 'giant';
export type EnergyLevel = 1 | 2 | 3 | 4 | 5;
export type BreedGroup = 'Sporting' | 'Hound' | 'Working' | 'Terrier' | 'Toy' | 'Non-Sporting' | 'Herding' | 'Miscellaneous' | 'Mixed';
export type BreedInfo = {
  name: string;
  aliases?: string[];
  group: BreedGroup;
  size: SizeClass;
  weightLb: [number, number];
  heightIn: [number, number];
  lifespanYears: [number, number];
  energy: EnergyLevel;
  exerciseMinutesPerDay: [number, number];
  walksPerDay: number;
  coat: string[];
  shedding: 'low' | 'moderate' | 'high';
  groomingEveryDays: number;
  temperament: string[];
  habits: string[];
  healthWatch: string[];
  warningSigns: string[];
  feedingNotes: string;
  goodWith?: { kids?: boolean; dogs?: boolean; cats?: boolean };
};
export type CareGuide = { dailyCalories: [number, number]; mealsPerDay: number; cupsPerDay: [number, number]; walks: string; play: string; grooming: string; tips: string[] };

type R = [number, number];
const EN = '–';

// ---------------------------------------------------------------------------
// Pick-lists
// ---------------------------------------------------------------------------

export const COAT_TYPES: string[] = [
  'Smooth/Short', 'Medium', 'Long', 'Double coat', 'Single coat', 'Wire/Broken', 'Rough',
  'Curly', 'Wavy', 'Corded', 'Silky', 'Feathered', 'Plush', 'Hairless', 'Powderpuff', 'Combination',
];

export const COAT_COLORS: string[] = [
  'Black', 'White', 'Brown/Chocolate', 'Liver', 'Red', 'Mahogany', 'Fawn', 'Cream', 'Gold/Golden', 'Yellow',
  'Apricot', 'Orange', 'Lemon', 'Tan', 'Buff', 'Biscuit', 'Champagne', 'Blue', 'Gray', 'Blue gray', 'Steel blue',
  'Silver', 'Platinum', 'Charcoal', 'Sable', 'Red sable', 'Wolf gray', 'Wheaten', 'Isabella/Lilac', 'Seal', 'Copper',
  'Rust', 'Ruby', 'Blenheim (chestnut and white)', 'Grizzle', 'Salt and pepper', 'Brindle', 'Blue brindle',
  'Red brindle', 'Seal brindle', 'Blue merle', 'Red merle', 'Chocolate merle', 'Lilac merle', 'Blue fawn', 'Red fawn',
  'Black and tan', 'Black and white', 'Black and silver', 'Blue and tan', 'Liver and tan', 'Brown and white',
  'Red and white', 'Orange and white', 'Lemon and white', 'Liver and white', 'Tricolor', 'Agouti', 'Domino', 'Other',
];

export const COAT_PATTERNS: string[] = [
  'Solid', 'Bicolor', 'Tricolor', 'Tuxedo', 'Piebald/Parti', 'Irish spotting', 'Extreme white', 'Brindle',
  'Reverse brindle', 'Merle', 'Dapple', 'Harlequin', 'Ticked', 'Roan', 'Belton', 'Speckled/Flecked', 'Spotted',
  'Saddle/Blanket', 'Mantle', 'Mask', 'Points/Tan points', 'Phantom', 'Sable', 'Agouti/Wolf sable', 'Shaded',
  'Grizzle', 'Sesame', 'Urajiro (light underside)', 'Blaze', 'Domino', 'Other',
];

export const EYE_COLORS: string[] = [
  'Dark brown', 'Brown', 'Light brown', 'Amber', 'Hazel', 'Yellow', 'Gold', 'Green', 'Blue', 'Light blue', 'Gray',
  'Odd-eyed (two different colors)', 'Split/partial (two colors in one eye)', 'Marbled (merle)', 'Other',
];

export const EAR_TYPES: string[] = [
  'Erect/Prick', 'Drop/Pendant', 'Long hanging (hound)', 'Rose', 'Button', 'Bat', 'Semi-erect/Semi-prick', 'Folded',
  'Cropped', 'Candle-flame', 'Tulip', 'Hooded', 'Blunt-tipped', 'V-shaped', 'Filbert', 'Butterfly', 'Fringed/Feathered',
  'Other',
];

export const TAIL_TYPES: string[] = [
  'Curled', 'Double curl', 'Ring', 'Sickle', 'Otter', 'Whip', 'Bobbed/Docked', 'Natural bob', 'Corkscrew', 'Screw',
  'Plumed', 'Saber', 'Gay', 'Snap', 'Crank', 'Brush', 'Bushy', 'Feathered', 'Rat tail', 'Carrot', 'Kinked', 'Tufted',
  'Straight', 'Low-set', 'Other',
];

export const SIZE_LABELS: Record<SizeClass, string> = {
  toy: 'Toy (under 12 lb)',
  small: `Small (12${EN}25 lb)`,
  medium: `Medium (25${EN}50 lb)`,
  large: `Large (50${EN}90 lb)`,
  giant: 'Giant (90+ lb)',
};

// ---------------------------------------------------------------------------
// Health conditions: [plain label, warning sign to see a vet for]
// ---------------------------------------------------------------------------

const HEALTH = {
  hd: ['Hip and elbow dysplasia', 'Limping, stiffness, bunny-hopping, or trouble getting up'],
  hip: ['Hip dysplasia', 'Limping, stiffness, bunny-hopping, or trouble getting up'],
  elbow: ['Elbow dysplasia', 'Front-leg limping or stiffness after rest'],
  bloat: ['Bloat (GDV, stomach twisting)', 'Swollen belly, retching without bringing anything up, restlessness: go to a vet immediately'],
  patella: ['Kneecap slipping (luxating patella)', 'Skipping or hopping on a back leg for a few steps'],
  legg: ['Hip joint breakdown in young dogs (Legg-Calve-Perthes)', 'Back-leg limp in a young dog that gets worse'],
  cruciate: ['Knee ligament (cruciate) injury', 'Sudden back-leg limp or not putting weight on a leg'],
  shoulder: ['Shoulder cartilage problems (OCD)', 'Front-leg limp in a growing dog'],
  fracture: ['Leg fractures (fine, delicate bones)', 'Sudden lameness after a jump or fall'],
  ivdd: ['Back disc disease (IVDD)', 'Back pain, hunched posture, yelping, or wobbly or dragging back legs'],
  spine: ['Spine malformations', 'Back pain, weakness, or wobbliness in the back legs'],
  wobbler: ['Wobbler syndrome (neck spine)', 'Wobbly walk, neck pain, or scuffing toes'],
  dm: ['Degenerative myelopathy (spinal cord disease)', 'Gradual back-leg weakness or toe dragging in an older dog'],
  brachy: ['Breathing problems from a short face (BOAS)', 'Loud or labored breathing, gagging, collapsing, or overheating easily'],
  heat: ['Overheating in hot weather', 'Heavy panting, drooling, bright red gums, or weakness in warm weather'],
  cold: ['Feels the cold easily', 'Shivering, lethargy, or reluctance to walk in cold weather'],
  laryngeal: ['Throat (laryngeal) paralysis', 'Noisy breathing, voice change, or tiring quickly'],
  trachea: ['Collapsing windpipe (trachea)', 'Honking cough, especially when excited or pulling on the leash'],
  lung: ['Lung scarring (pulmonary fibrosis)', 'Ongoing cough, fast breathing, or tiring easily'],
  eye: ['Inherited eye disease (such as PRA or cataracts)', 'Bumping into things, night blindness, or cloudy eyes'],
  glaucoma: ['Glaucoma', 'Red, painful, bulging, or cloudy eye, or squinting'],
  lens: ['Lens luxation (displaced lens)', 'Sudden red, painful, or cloudy eye'],
  eyelid: ['Eyelid problems (entropion or ectropion)', 'Squinting, heavy tearing, or red, irritated eyes'],
  cherry: ['Cherry eye', 'Red swelling in the inner corner of the eye'],
  dryeye: ['Dry eye', 'Thick, sticky eye discharge or dull, red eyes'],
  corneal: ['Eye injuries and ulcers (prominent eyes)', 'Squinting, pawing at an eye, or a cloudy spot on the eye'],
  deaf: ['Inherited deafness', 'Not reacting to sounds or name, or startling easily when touched'],
  ear: ['Ear infections', 'Head shaking, ear odor, redness, or scratching at ears'],
  dental: ['Dental disease', 'Bad breath, red or bleeding gums, or dropping food'],
  heart: ['Heart disease', 'Coughing, tiring quickly, fast breathing at rest, or fainting'],
  mvd: ['Heart valve disease (mitral valve)', 'Coughing, tiring quickly, or fast breathing while asleep'],
  dcm: ['Dilated cardiomyopathy (enlarged heart)', 'Weakness, fainting, coughing, or a swollen belly'],
  thyroid: ['Low thyroid (hypothyroidism)', 'Weight gain without eating more, low energy, or thinning coat'],
  addison: ['Addison disease (adrenal glands)', 'Repeated vomiting, weakness, or collapse with no clear cause'],
  cushings: ['Cushing disease (adrenal glands)', 'Increased thirst and urination, pot belly, or hair loss'],
  diabetes: ['Diabetes', 'Increased thirst and urination, or weight loss despite a good appetite'],
  allergy: ['Skin allergies', 'Constant scratching, paw licking, red skin, or repeat ear infections'],
  skin: ['Skin and coat conditions', 'Hair loss, flaky or crusty skin, or sores that do not heal'],
  skinfold: ['Skin fold infections', 'Redness, odor, or moisture in skin folds'],
  sunburn: ['Sunburn and sensitive skin', 'Red, peeling, or blistered skin after sun'],
  dermoid: ['Dermoid sinus (skin defect along the spine)', 'A small hole, swelling, or discharge along the back'],
  cancer: ['Higher cancer risk', 'New lumps, unexplained weight loss, pale gums, or low energy'],
  osteo: ['Bone cancer (osteosarcoma)', 'Leg lameness that does not improve or swelling on a leg bone'],
  epilepsy: ['Epilepsy (seizures)', 'Seizures, trembling, or collapse episodes'],
  obesity: ['Weight gain and obesity', 'Ribs hard to feel, no visible waist, or low stamina'],
  hypogly: ['Low blood sugar (especially puppies)', 'Weakness, trembling, wobbliness, or glassy eyes'],
  liver: ['Liver shunt', 'Slow growth, confusion or head-pressing after meals'],
  copper: ['Copper storage liver disease', 'Vomiting, weight loss, or yellow gums or eyes'],
  pancreatitis: ['Pancreatitis and high blood fats', 'Vomiting, belly pain, or hunched posture after fatty food'],
  epi: ['Exocrine pancreatic insufficiency (EPI)', 'Weight loss with a big appetite, or greasy, pale stools'],
  gastro: ['Digestive disease (protein-losing gut disease)', 'Ongoing diarrhea, weight loss, or belly swelling'],
  megaeso: ['Megaesophagus', 'Bringing food back up soon after eating'],
  kidney: ['Kidney disease', 'Increased thirst and urination, weight loss, or poor appetite'],
  fanconi: ['Fanconi syndrome (kidney)', 'Heavy thirst and urination, or weight loss'],
  stones: ['Bladder stones', 'Straining to pee, frequent small pees, or blood in urine'],
  vwd: ['Von Willebrand disease (bleeding disorder)', 'Nosebleeds, bleeding gums, or bleeding that takes long to stop'],
  mdr1: ['MDR1 drug sensitivity (gene)', 'Wobbliness, drooling, or confusion after certain medications'],
  anesth: ['Sensitivity to anesthesia', 'Tell your vet the breed before any surgery or sedation'],
  syringo: ['Chiari-like malformation / syringomyelia', 'Scratching at the neck or air, yelping when touched, or head sensitivity'],
  eic: ['Exercise-induced collapse', 'Wobbly back legs or collapse after intense exercise'],
  spfever: ['Shar-Pei fever (recurring fevers)', 'Repeated fevers with swollen ankles (hocks)'],
} as const satisfies Record<string, readonly [string, string]>;
type HKey = keyof typeof HEALTH;

const COAT_CODE: Record<string, string> = {
  S: 'Smooth/Short', M: 'Medium', L: 'Long', D: 'Double coat', W: 'Wire/Broken', C: 'Curly', V: 'Wavy',
  R: 'Corded', K: 'Silky', H: 'Hairless', X: 'Combination', F: 'Feathered',
};

type Opt = { a?: string[]; g?: string; ex?: R; w?: number; feed?: string; warn?: string[] };

const KEYS = new Map<BreedInfo, HKey[]>();

const EX_BY_ENERGY: Record<EnergyLevel, R> = { 1: [20, 40], 2: [30, 60], 3: [45, 75], 4: [60, 90], 5: [90, 120] };
const r5 = (n: number) => Math.max(10, Math.round(n / 5) * 5);

function feedNotes(size: SizeClass, energy: EnergyLevel, h: HKey[], override?: string): string {
  const has = (k: HKey) => h.includes(k);
  const out: string[] = [];
  if (override) out.push(override);
  if (has('bloat')) out.push('Deep-chested breed with bloat risk: split food into two or more smaller meals, consider a slow feeder, and avoid hard exercise for an hour after eating.');
  if (has('pancreatitis')) out.push('Prone to pancreatitis: keep the diet moderate to low in fat and skip greasy table scraps.');
  if (has('stones')) out.push('Encourage plenty of water and ask your vet whether a stone-prevention diet makes sense.');
  if (has('copper')) out.push('Ask your vet about a lower-copper diet and avoid copper-rich treats like liver.');
  if (has('epi') || has('gastro')) out.push('Can have a sensitive gut: keep the diet consistent and highly digestible, and tell your vet about greasy stools or weight loss.');
  if (has('brachy')) out.push('Flat-faced: a shallow bowl or slow feeder helps with gulping, and staying lean eases breathing.');
  if (has('diabetes')) out.push('Keep meals regular and the dog lean; ask your vet about checks if thirst increases.');
  if (size === 'toy' || has('hypogly')) out.push('Tiny stomach: use a small-kibble food in regular meals, and do not let puppies skip meals because of low blood sugar risk.');
  if (has('obesity')) out.push('Gains weight easily: measure every meal and count treats as part of the daily total.');
  if (size === 'giant' || size === 'large') out.push('Use a large- or giant-breed puppy food so growth stays slow and steady.');
  if (has('allergy')) out.push('If itchy skin or ear trouble keeps returning, ask your vet whether a food trial is worth trying.');
  if (energy === 5) out.push('Very active: working or sporting days may need a bit more food; adjust portions by body condition.');
  out.push('Feed a complete, balanced diet for the dog\'s life stage and adjust portions to keep a visible waist.');
  return out.slice(0, 2).join(' ');
}

function b(
  name: string, group: BreedGroup, size: SizeClass, weightLb: R, heightIn: R, lifespanYears: R, energy: EnergyLevel,
  coat: string, shed: 'l' | 'm' | 'h', groom: number, temp: string, hab: string, health: HKey[], o: Opt = {},
): BreedInfo {
  const scale = size === 'toy' ? 0.6 : size === 'small' ? 0.85 : 1;
  const base = EX_BY_ENERGY[energy];
  const ex: R = o.ex ?? [r5(base[0] * scale), r5(base[1] * scale)];
  const walks = o.w ?? (energy === 5 && size !== 'toy' ? 3 : 2);
  const signs: string[] = [];
  for (const s of o.warn ?? []) if (!signs.includes(s)) signs.push(s);
  for (const k of health) { const s = HEALTH[k][1]; if (!signs.includes(s)) signs.push(s); }
  const warningSigns = signs.slice(0, 5);
  if (warningSigns.length < 2) warningSigns.push('Changes in appetite, energy, or bathroom habits that last more than a day or two');
  const info: BreedInfo = {
    name, group, size, weightLb, heightIn, lifespanYears, energy,
    exerciseMinutesPerDay: ex,
    walksPerDay: walks,
    coat: coat.split('').map((c) => COAT_CODE[c] ?? c),
    shedding: shed === 'l' ? 'low' : shed === 'm' ? 'moderate' : 'high',
    groomingEveryDays: groom,
    temperament: temp.split('|'),
    habits: hab.split('|'),
    healthWatch: health.slice(0, 6).map((k) => HEALTH[k][0]),
    warningSigns,
    feedingNotes: feedNotes(size, energy, health, o.feed),
  };
  if (o.a) info.aliases = o.a;
  if (o.g) {
    const gw: { kids?: boolean; dogs?: boolean; cats?: boolean } = {};
    for (const c of o.g) {
      if (c === 'K' || c === 'k') gw.kids = c === 'K';
      if (c === 'D' || c === 'd') gw.dogs = c === 'D';
      if (c === 'C' || c === 'c') gw.cats = c === 'C';
    }
    info.goodWith = gw;
  }
  KEYS.set(info, health);
  return info;
}

// ---------------------------------------------------------------------------
// Breeds. Arguments: name, group, size, weight lb, height in, lifespan yrs, energy,
// coat codes, shedding (l/m/h), brush every N days, temperament, habits, health keys, options.
// Options: a = aliases, g = good with (K kids, D dogs, C cats; lowercase = use caution).
// ---------------------------------------------------------------------------

const RAW: BreedInfo[] = [
  // Sporting
  b('American Water Spaniel', 'Sporting', 'medium', [25, 45], [15, 18], [10, 14], 4, 'CV', 'm', 7, 'Eager|Friendly|Energetic|Sensitive', 'Loves water and retrieving|Can be vocal|May be wary of strangers', ['hd', 'eye', 'thyroid', 'ear'], { g: 'KD' }),
  b('Barbet', 'Sporting', 'medium', [35, 65], [19, 24.5], [12, 14], 4, 'C', 'l', 3, 'Friendly|Joyful|Intelligent|Social', 'Water lover that will jump into any pond|Wants to be with the family', ['hip', 'ear', 'eye', 'epilepsy'], { g: 'KD' }),
  b('Boykin Spaniel', 'Sporting', 'medium', [25, 40], [14, 18], [10, 15], 4, 'VM', 'm', 4, 'Friendly|Eager|Trainable|Lively', 'Loves to swim and fetch|Gets restless without exercise', ['hip', 'eye', 'eic', 'ear'], { g: 'KD' }),
  b('Bracco Italiano', 'Sporting', 'large', [55, 90], [21, 27], [10, 14], 4, 'S', 'm', 7, 'Gentle|Affectionate|Docile|Hardworking', 'Hunts with nose held high|Drools, especially after drinking', ['hd', 'bloat', 'ear', 'eyelid'], { g: 'KD' }),
  b('Brittany', 'Sporting', 'medium', [30, 40], [17.5, 20.5], [12, 14], 5, 'MV', 'm', 7, 'Bright|Upbeat|Agile|Eager', 'Points at birds and may chase them|Gets restless without a job', ['hip', 'eye', 'epilepsy', 'thyroid'], { a: ['Brittany Spaniel'], g: 'KD' }),
  b('Chesapeake Bay Retriever', 'Sporting', 'large', [55, 80], [21, 26], [10, 13], 4, 'DV', 'm', 7, 'Bright|Affectionate|Protective|Strong-willed', 'Loves cold water|Can be reserved with strangers', ['hd', 'eye', 'dm', 'eic'], { a: ['Chessie'], g: 'K' }),
  b('Clumber Spaniel', 'Sporting', 'large', [55, 85], [17, 20], [10, 12], 2, 'M', 'h', 3, 'Gentle|Easygoing|Loyal|Mellow', 'Drools and sheds a lot|Likes to carry things in its mouth', ['hd', 'eyelid', 'ear', 'obesity', 'ivdd'], { g: 'KD' }),
  b('Cocker Spaniel', 'Sporting', 'small', [20, 30], [13.5, 15.5], [10, 14], 3, 'KL', 'm', 2, 'Gentle|Happy|Smart|Affectionate', 'Merry tail-wagger|Sensitive to harsh correction|Long ears dip into food', ['ear', 'eye', 'glaucoma', 'patella', 'hip', 'allergy'], { a: ['American Cocker Spaniel', 'Cocker'], g: 'KDC' }),
  b('Curly-Coated Retriever', 'Sporting', 'large', [60, 95], [23, 27], [10, 12], 4, 'C', 'm', 14, 'Confident|Smart|Independent|Calm indoors', 'Slow to mature; playful into adulthood|Loves water', ['hd', 'eye', 'eic', 'bloat', 'cancer'], { g: 'K' }),
  b('English Cocker Spaniel', 'Sporting', 'medium', [26, 34], [15, 17], [12, 14], 4, 'KM', 'm', 3, 'Merry|Responsive|Loyal|Busy', 'Nose to the ground on walks|Loves carrying toys', ['eye', 'ear', 'hip', 'kidney'], { g: 'KD' }),
  b('English Setter', 'Sporting', 'large', [45, 80], [23, 27], [10, 12], 4, 'KF', 'm', 3, 'Mellow|Friendly|Merry|Gentle', 'Calm indoors once exercised|Tends to roam after scents', ['hd', 'deaf', 'thyroid', 'allergy'], { g: 'KD' }),
  b('English Springer Spaniel', 'Sporting', 'medium', [40, 50], [19, 20], [12, 14], 5, 'MF', 'm', 3, 'Friendly|Playful|Obedient|Eager', 'Bounds through fields; loves fetch|Can be clingy', ['hd', 'eye', 'ear', 'epilepsy'], { a: ['Springer Spaniel', 'Springer'], g: 'KD' }),
  b('Field Spaniel', 'Sporting', 'medium', [35, 50], [17, 18], [12, 13], 3, 'KF', 'm', 4, 'Sweet|Sensitive|Fun-loving|Independent', 'Steady, thoughtful worker|Loves to snuggle after exercise', ['hip', 'thyroid', 'eye', 'ear'], { g: 'KD' }),
  b('Flat-Coated Retriever', 'Sporting', 'large', [60, 70], [22, 24.5], [8, 10], 5, 'MF', 'm', 4, 'Cheerful|Optimistic|Good-humored|Outgoing', 'Puppy-like attitude for years|Retrieves anything it can carry', ['cancer', 'hip', 'patella', 'glaucoma'], { a: ['Flat-Coat', 'Flatcoat'], g: 'KD' }),
  b('German Shorthaired Pointer', 'Sporting', 'large', [45, 70], [21, 25], [10, 12], 5, 'S', 'm', 7, 'Friendly|Smart|Willing|Tireless', 'Points at and chases small animals|Destructive if under-exercised', ['hip', 'bloat', 'eye', 'heart'], { a: ['GSP'], g: 'KD' }),
  b('German Wirehaired Pointer', 'Sporting', 'large', [50, 70], [22, 26], [14, 16], 5, 'W', 'm', 7, 'Affectionate|Eager|Enthusiastic|Aloof with strangers', 'Loves to hunt and swim|Can be wary of new dogs', ['hd', 'eye', 'vwd'], { a: ['GWP'], g: 'K' }),
  b('Golden Retriever', 'Sporting', 'large', [55, 75], [21.5, 24], [10, 12], 4, 'DF', 'h', 2, 'Friendly|Intelligent|Devoted|Gentle', 'Carries toys or shoes around|Loves water and fetch|Mouthy as a puppy', ['hd', 'cancer', 'eye', 'heart', 'allergy', 'thyroid'], { a: ['Golden'], g: 'KDC' }),
  b('Gordon Setter', 'Sporting', 'large', [45, 80], [23, 27], [12, 13], 4, 'KF', 'm', 3, 'Confident|Bold|Alert|Affectionate', 'Protective of family|Slow to mature', ['hd', 'bloat', 'eye', 'thyroid'], { g: 'K' }),
  b('Irish Red and White Setter', 'Sporting', 'large', [50, 75], [22.5, 26], [11, 15], 4, 'KF', 'm', 3, 'Happy|Courageous|Friendly|Spirited', 'Wants to be near people|Very bird-oriented', ['hip', 'eye', 'vwd'], { g: 'KD' }),
  b('Irish Setter', 'Sporting', 'large', [60, 70], [25, 27], [12, 15], 5, 'KF', 'm', 3, 'Outgoing|Sweet-natured|Active|Rollicking', 'Puppyish for years|Can be a counter-surfer', ['hip', 'bloat', 'eye', 'epilepsy', 'thyroid'], { a: ['Red Setter'], g: 'KD' }),
  b('Irish Water Spaniel', 'Sporting', 'large', [45, 68], [21, 24], [12, 13], 4, 'C', 'l', 4, 'Playful|Inquisitive|Brave|Clownish', 'Loves water|Can be reserved with strangers', ['hip', 'thyroid', 'ear', 'eye'], { g: 'K' }),
  b('Labrador Retriever', 'Sporting', 'large', [55, 80], [21.5, 24.5], [11, 13], 4, 'SD', 'h', 4, 'Friendly|Outgoing|Eager to please|Gentle', 'Loves to retrieve and swim|May chew when bored|Food-motivated and quick to beg', ['hd', 'obesity', 'eye', 'eic', 'ear'], { a: ['Lab', 'Labrador'], g: 'KDC' }),
  b('Lagotto Romagnolo', 'Sporting', 'medium', [24, 35], [16, 19], [15, 17], 4, 'C', 'l', 7, 'Affectionate|Loyal|Lively|Easy to train', 'Digs enthusiastically (bred to find truffles)|Nose-driven on walks', ['hip', 'epilepsy', 'eye'], { a: ['Lagotto'], g: 'KD' }),
  b('Nederlandse Kooikerhondje', 'Sporting', 'small', [20, 30], [15, 16], [12, 14], 4, 'MF', 'm', 7, 'Alert|Cheerful|Agile|Reserved with strangers', 'Waves its feathered tail|Bonds closely with one person', ['vwd', 'eye', 'patella'], { a: ['Kooikerhondje', 'Kooiker'], g: 'K' }),
  b('Nova Scotia Duck Tolling Retriever', 'Sporting', 'medium', [35, 50], [17, 21], [12, 14], 5, 'DM', 'm', 7, 'Affectionate|Outgoing|Intelligent|Playful', 'Lets out a high-pitched scream when excited|Loves fetch and water', ['hip', 'eye', 'thyroid', 'addison'], { a: ['Toller', 'Duck Toller'], g: 'KD' }),
  b('Pointer', 'Sporting', 'large', [45, 75], [23, 28], [12, 17], 5, 'S', 'm', 7, 'Even-tempered|Loyal|Hard-driving|Alert', 'Freezes and points at birds|Needs room to run', ['hip', 'eye', 'thyroid', 'deaf'], { a: ['English Pointer'], g: 'KD' }),
  b('Spinone Italiano', 'Sporting', 'large', [62, 85], [22, 27], [12, 14], 3, 'W', 'm', 7, 'Docile|Patient|Sociable|Gentle', 'Steady, methodical trotter|Drools and has a wet beard', ['hd', 'bloat', 'ear', 'eyelid'], { a: ['Spinone', 'Italian Spinone'], g: 'KD' }),
  b('Sussex Spaniel', 'Sporting', 'medium', [35, 45], [13, 15], [13, 15], 2, 'MF', 'm', 4, 'Cheerful|Calm|Friendly|Steady', 'Deep, baying bark|Slow-paced worker', ['hip', 'ear', 'ivdd', 'heart'], { g: 'KD' }),
  b('Vizsla', 'Sporting', 'medium', [44, 60], [21, 24], [12, 14], 5, 'S', 'l', 7, 'Affectionate|Gentle|Energetic|Sensitive', 'Velcro dog that follows you room to room|Destructive if bored', ['hip', 'epilepsy', 'eye', 'allergy', 'cancer'], { a: ['Hungarian Vizsla'], g: 'KD' }),
  b('Weimaraner', 'Sporting', 'large', [55, 90], [23, 27], [10, 13], 5, 'S', 'm', 7, 'Friendly|Fearless|Obedient|Alert', 'Separation anxiety when left alone|Strong prey drive', ['hd', 'bloat', 'thyroid', 'eyelid'], { a: ['Weim'], g: 'K' }),
  b('Welsh Springer Spaniel', 'Sporting', 'medium', [35, 55], [17, 19], [12, 15], 4, 'KF', 'm', 4, 'Friendly|Affectionate|Even-tempered|Reserved with strangers', 'Velcro companion|Loves to swim', ['hip', 'eye', 'epilepsy', 'thyroid'], { g: 'KD' }),
  b('Wirehaired Pointing Griffon', 'Sporting', 'medium', [35, 70], [20, 24], [12, 15], 4, 'W', 'l', 7, 'Devoted|Friendly|Eager|Trainable', 'Loves water|Bearded face holds food and water', ['hip', 'eyelid', 'ear'], { a: ['Griffon', 'Korthals Griffon'], g: 'KD' }),
  b('Wirehaired Vizsla', 'Sporting', 'medium', [45, 65], [21.5, 25], [12, 14], 5, 'W', 'm', 7, 'Gentle|Loyal|Trainable|Energetic', 'Affectionate shadow|Loves to hunt and swim', ['hip', 'ear', 'eye'], { g: 'KD' }),

  // Hound
  b('Afghan Hound', 'Hound', 'large', [50, 60], [25, 27], [12, 18], 4, 'KL', 'l', 2, 'Independent|Dignified|Aloof|Clownish at times', 'Sprints off after moving things|Can be hard to call back', ['hip', 'eye', 'thyroid', 'anesth'], { a: ['Afghan'] }),
  b('American English Coonhound', 'Hound', 'large', [45, 65], [23, 26], [11, 12], 5, 'S', 'm', 7, 'Friendly|Mellow|Sweet|Energetic', 'Loud baying voice|Follows scent trails single-mindedly', ['hip', 'ear', 'eye'], { a: ['English Coonhound', 'Redtick Coonhound'], g: 'KD' }),
  b('American Foxhound', 'Hound', 'large', [60, 70], [21, 25], [11, 13], 5, 'S', 'm', 7, 'Independent|Easygoing|Sweet|Pack-loving', 'Bays and howls|Likes the company of other dogs', ['hip', 'ear', 'obesity'], { g: 'KD' }),
  b('American Leopard Hound', 'Miscellaneous', 'large', [35, 75], [21, 27], [12, 15], 5, 'S', 'l', 7, 'Friendly|Loyal|Brave|Energetic', 'Trees game|Vocal on the trail', ['hip', 'ear', 'eye'], { g: 'KD' }),
  b('Azawakh', 'Hound', 'medium', [33, 55], [23.5, 29], [12, 15], 4, 'S', 'l', 7, 'Loyal|Reserved|Independent|Protective', 'Aloof with strangers|Fast sprinter that chases', ['epilepsy', 'thyroid', 'cold', 'anesth'], { g: 'c' }),
  b('Basenji', 'Hound', 'small', [22, 24], [16, 17], [13, 14], 4, 'S', 'l', 7, 'Independent|Smart|Poised|Alert', 'Yodels instead of barking|Grooms itself like a cat|Escape artist', ['fanconi', 'eye', 'thyroid', 'hip'], { g: 'c' }),
  b('Basset Hound', 'Hound', 'medium', [40, 65], [12, 15], [12, 13], 2, 'S', 'm', 7, 'Charming|Patient|Low-key|Stubborn', 'Follows its nose and may not come when called|Long ears drag through food|Drools and bays', ['bloat', 'ear', 'obesity', 'ivdd', 'eyelid', 'glaucoma'], { a: ['Basset'], g: 'KDC' }),
  b('Beagle', 'Hound', 'small', [18, 30], [13, 15], [10, 15], 4, 'S', 'm', 7, 'Merry|Friendly|Curious|Determined', 'Howls and bays|Nose-driven escape artist|Will raid the trash', ['obesity', 'ear', 'epilepsy', 'thyroid', 'hip'], { g: 'KD' }),
  b('Black and Tan Coonhound', 'Hound', 'large', [65, 110], [23, 27], [10, 12], 4, 'S', 'm', 7, 'Easygoing|Friendly|Bright|Brave', 'Baying voice|Trails scents single-mindedly', ['hip', 'ear', 'eye'], { g: 'KD' }),
  b('Bloodhound', 'Hound', 'large', [80, 110], [23, 27], [10, 12], 3, 'S', 'm', 7, 'Friendly|Independent|Inquisitive|Gentle', 'Drools a lot|Will follow a scent for miles', ['bloat', 'hd', 'ear', 'eyelid', 'skinfold'], { g: 'KD' }),
  b('Bluetick Coonhound', 'Hound', 'large', [45, 80], [21, 27], [11, 12], 4, 'S', 'm', 7, 'Smart|Devoted|Tenacious|Vocal', 'Bawls loudly|Strong urge to tree small animals', ['hip', 'ear', 'obesity'], { a: ['Bluetick'], g: 'K' }),
  b('Borzoi', 'Hound', 'large', [60, 105], [26, 32], [9, 14], 3, 'KL', 'm', 3, 'Quiet|Affectionate|Independent|Athletic', 'Bursts of speed then long naps|Chases small animals', ['bloat', 'heart', 'eye', 'anesth'], { a: ['Russian Wolfhound'], g: 'c' }),
  b("Cirneco dell'Etna", 'Hound', 'small', [17, 26], [16.5, 19.5], [12, 14], 4, 'S', 'l', 7, 'Affectionate|Friendly|Even-tempered|Alert', 'Hunts by sight, scent, and sound|Can jump fences', ['cold', 'anesth'], { a: ['Cirneco'] }),
  b('Dachshund', 'Hound', 'small', [11, 32], [5, 9], [12, 16], 3, 'SWL', 'm', 7, 'Curious|Friendly|Spunky|Stubborn', 'Digs and burrows under blankets|Barks at noises|Can be possessive of toys', ['ivdd', 'obesity', 'dental', 'eye', 'patella'], { a: ['Doxie', 'Wiener Dog', 'Sausage Dog', 'Miniature Dachshund', 'Mini Dachshund'], g: 'D' }),
  b('English Foxhound', 'Hound', 'large', [60, 75], [24, 25], [10, 13], 5, 'S', 'm', 7, 'Friendly|Gentle|Sociable|Pack-oriented', 'Loud baying|Wants canine company', ['hip', 'ear', 'kidney'], { g: 'KD' }),
  b('Grand Basset Griffon Vendeen', 'Hound', 'medium', [40, 45], [15.5, 18], [13, 15], 4, 'W', 'm', 7, 'Happy|Outgoing|Independent|Vocal', 'Nose leads the way|Voice carries far', ['hip', 'ear', 'eye', 'epilepsy'], { a: ['GBGV'], g: 'KD' }),
  b('Greyhound', 'Hound', 'large', [60, 70], [27, 30], [10, 13], 3, 'S', 'l', 7, 'Gentle|Independent|Noble|Quiet', 'Sleeps much of the day|Sprints in bursts and chases small animals|Feels the cold', ['anesth', 'cold', 'osteo', 'dental', 'bloat'], { a: ['Grey', 'Retired Racing Greyhound'], g: 'Kc' }),
  b('Harrier', 'Hound', 'medium', [45, 60], [19, 21], [12, 15], 5, 'S', 'm', 7, 'Friendly|Outgoing|People-oriented|Pack-loving', 'Bays|Follows scent', ['hip', 'ear', 'eye'], { g: 'KD' }),
  b('Ibizan Hound', 'Hound', 'large', [45, 50], [22.5, 27.5], [11, 14], 4, 'SW', 'l', 7, 'Even-tempered|Loyal|Graceful|Playful', 'Jumps very high from a standstill|Chases small animals', ['anesth', 'allergy', 'eye', 'deaf'], { g: 'c' }),
  b('Irish Wolfhound', 'Hound', 'giant', [105, 180], [30, 35], [6, 8], 3, 'W', 'm', 7, 'Calm|Dignified|Gentle|Courageous', 'Gentle giant indoors|Needs room to stretch out', ['bloat', 'dcm', 'osteo', 'hip', 'liver'], { a: ['Wolfhound'], g: 'KD' }),
  b('Norwegian Elkhound', 'Hound', 'medium', [48, 55], [19.5, 20.5], [12, 15], 4, 'D', 'h', 3, 'Bold|Confident|Friendly|Dependable', 'Barks a lot|Sheds heavily twice a year', ['hip', 'eye', 'thyroid', 'fanconi', 'obesity'], { a: ['Elkhound'], g: 'K' }),
  b('Otterhound', 'Hound', 'large', [80, 115], [24, 27], [10, 13], 4, 'W', 'm', 7, 'Amiable|Boisterous|Even-tempered|Vocal', 'Loves water and mud|Messy drinker', ['hd', 'bloat', 'vwd'], { g: 'KD' }),
  b('Petit Basset Griffon Vendeen', 'Hound', 'small', [25, 40], [13, 15], [14, 16], 4, 'W', 'm', 7, 'Happy|Curious|Vocal|Independent', 'Digs and barks|Always busy sniffing', ['eye', 'ear', 'hip', 'patella'], { a: ['PBGV'], g: 'KD' }),
  b('Pharaoh Hound', 'Hound', 'medium', [45, 55], [21, 25], [12, 14], 4, 'S', 'l', 7, 'Friendly|Playful|Smart|Noble', 'Ears and nose blush rosy when excited|Chases moving things', ['anesth', 'hip', 'patella', 'cold'], { g: 'Kc' }),
  b('Plott Hound', 'Hound', 'large', [40, 60], [20, 25], [12, 14], 4, 'S', 'm', 7, 'Loyal|Alert|Intelligent|Determined', 'Loud, choppy bark on the trail|Strong prey drive', ['bloat', 'ear', 'hip'], { a: ['Plott'], g: 'K' }),
  b('Portuguese Podengo Pequeno', 'Hound', 'small', [9, 13], [8, 12], [12, 15], 4, 'SW', 'l', 7, 'Lively|Playful|Alert|Independent', 'Hunts lizards and rodents|Barks to alert', ['patella', 'dental', 'eye'], { a: ['Podengo', 'Podengo Pequeno'] }),
  b('Redbone Coonhound', 'Hound', 'large', [45, 70], [21, 27], [12, 15], 4, 'S', 'm', 7, 'Even-tempered|Amiable|Eager|Vocal', 'Baying voice|Loves to tree game', ['hip', 'ear', 'obesity'], { a: ['Redbone'], g: 'KD' }),
  b('Rhodesian Ridgeback', 'Hound', 'large', [70, 85], [24, 27], [10, 12], 4, 'S', 'm', 7, 'Dignified|Affectionate|Strong-willed|Protective', 'Reserved with strangers|Chases cats and small animals', ['hd', 'thyroid', 'dermoid', 'bloat'], { a: ['Ridgeback'], g: 'Kc' }),
  b('Saluki', 'Hound', 'large', [40, 65], [23, 28], [10, 17], 4, 'SF', 'l', 7, 'Gentle|Dignified|Independent|Reserved', 'Sprints after anything that moves|Loves soft furniture', ['heart', 'cancer', 'thyroid', 'anesth'], { g: 'c' }),
  b('Scottish Deerhound', 'Hound', 'giant', [75, 110], [28, 32], [8, 11], 3, 'W', 'l', 7, 'Gentle|Dignified|Polite|Quiet', 'Lounges indoors and sprints outdoors|Chases small animals', ['bloat', 'dcm', 'osteo', 'anesth'], { a: ['Deerhound'], g: 'KDc' }),
  b('Sloughi', 'Hound', 'large', [35, 50], [24, 29], [10, 15], 4, 'S', 'l', 7, 'Reserved|Loyal|Sensitive|Gentle', 'Bonds tightly with family|Chases moving things', ['eye', 'anesth', 'cold'], { a: ['Arabian Greyhound'], g: 'c' }),
  b('Treeing Walker Coonhound', 'Hound', 'large', [50, 70], [20, 27], [12, 13], 5, 'S', 'm', 7, 'Smart|Brave|Courteous|Vocal', 'Bawls on a scent|Trees game', ['hip', 'ear', 'obesity'], { a: ['Walker Coonhound', 'Treeing Walker'], g: 'KD' }),
  b('Whippet', 'Hound', 'medium', [25, 40], [18, 22], [12, 15], 3, 'S', 'l', 7, 'Affectionate|Playful|Calm indoors|Gentle', 'Zoomies, then long naps|Chases squirrels; recall can fail', ['heart', 'eye', 'deaf', 'anesth', 'cold'], { g: 'KDc' }),
  b('Black Mouth Cur', 'Hound', 'large', [40, 95], [16, 25], [12, 18], 5, 'S', 'l', 7, 'Loyal|Brave|Protective|Energetic', 'Herds and hunts|Needs lots of activity', ['hip', 'ear', 'epilepsy'], { g: 'K' }),
  b('Mountain Cur', 'Hound', 'medium', [30, 60], [18, 26], [12, 16], 5, 'S', 'l', 7, 'Brave|Loyal|Intelligent|Energetic', 'Trees game|Protective of home', ['hip', 'ear'] , { g: 'K' }),
  b('Carolina Dog', 'Hound', 'medium', [30, 55], [17, 24], [12, 15], 4, 'S', 'm', 7, 'Independent|Reserved|Loyal|Alert', 'Digs small pits in the ground|Pack-minded', ['hip', 'dental'], { a: ['American Dingo'] }),

  // Working
  b('Akita', 'Working', 'large', [70, 130], [24, 28], [10, 14], 3, 'D', 'h', 7, 'Courageous|Dignified|Loyal|Reserved', 'Often intolerant of other dogs|Very protective of family', ['hd', 'bloat', 'thyroid', 'eye', 'skin'], { a: ['Akita Inu', 'American Akita'], g: 'd' }),
  b('Alaskan Malamute', 'Working', 'large', [75, 85], [23, 25], [10, 14], 4, 'D', 'h', 3, 'Affectionate|Loyal|Playful|Strong', 'Digs and howls|Pulls hard on the leash|Food-driven', ['hd', 'eye', 'thyroid', 'heat'], { a: ['Malamute', 'Mal'], g: 'K' }),
  b('Alaskan Klee Kai', 'Working', 'small', [10, 20], [13, 17], [13, 16], 4, 'D', 'h', 3, 'Curious|Alert|Reserved with strangers|Energetic', 'Vocal talker|Escape artist', ['patella', 'heart', 'eye', 'thyroid'], { a: ['Klee Kai', 'Mini Husky'] }),
  b('Anatolian Shepherd Dog', 'Working', 'giant', [80, 150], [27, 29], [11, 13], 3, 'SD', 'm', 7, 'Loyal|Independent|Protective|Calm', 'Guards its people and property|Barks at night', ['hd', 'thyroid', 'eyelid', 'anesth'], { a: ['Anatolian Shepherd', 'Anatolian'] }),
  b('Bernese Mountain Dog', 'Working', 'giant', [70, 115], [23, 27.5], [7, 10], 3, 'DL', 'h', 3, 'Good-natured|Calm|Affectionate|Strong', 'Loves cold weather|Leans on people|Slow to mature', ['hd', 'cancer', 'bloat', 'dm', 'heat'], { a: ['Berner', 'Bernese'], g: 'KDC' }),
  b('Black Russian Terrier', 'Working', 'large', [80, 130], [26, 30], [10, 12], 3, 'W', 'l', 3, 'Confident|Calm|Brave|Protective', 'Watchful guardian|Wants to be with family', ['hd', 'eye', 'heart'], { a: ['BRT'], g: 'K' }),
  b('Boerboel', 'Working', 'giant', [150, 200], [22, 27], [9, 11], 3, 'S', 'm', 7, 'Confident|Intelligent|Calm|Protective', 'Very protective of home|Needs firm early socialization', ['hd', 'eyelid', 'bloat', 'heat'], { a: ['South African Mastiff'] }),
  b('Boxer', 'Working', 'large', [50, 80], [21.5, 25], [10, 12], 4, 'S', 'm', 7, 'Fun-loving|Bright|Active|Loyal', 'Wiggles its whole body when happy|Snores|Jumps up to greet', ['heart', 'cancer', 'hd', 'thyroid', 'bloat', 'brachy'], { g: 'KD' }),
  b('Bullmastiff', 'Working', 'giant', [100, 130], [24, 27], [7, 9], 2, 'S', 'm', 7, 'Affectionate|Loyal|Brave|Calm', 'Drools and snores|Protective of home', ['hd', 'bloat', 'eyelid', 'cancer', 'heat'], { g: 'K' }),
  b('Cane Corso', 'Working', 'giant', [88, 110], [23.5, 27.5], [9, 12], 3, 'S', 'm', 7, 'Smart|Trainable|Assertive|Protective', 'Watchful and reserved with strangers|Needs confident handling', ['hd', 'eyelid', 'bloat', 'cherry', 'heat'], { a: ['Corso', 'Italian Mastiff'] }),
  b('Caucasian Shepherd Dog', 'Working', 'giant', [99, 170], [24, 30], [10, 12], 2, 'DL', 'h', 3, 'Protective|Bold|Independent|Strong-willed', 'Very territorial|Needs an experienced owner', ['hd', 'obesity'], { a: ['Caucasian Ovcharka', 'Caucasian Shepherd'] }),
  b('Chinook', 'Working', 'large', [50, 90], [22, 26], [12, 15], 3, 'D', 'h', 7, 'Friendly|Calm|Devoted|Smart', 'Gentle with kids|Loves pulling and hiking', ['hip', 'epilepsy', 'eye'], { g: 'KD' }),
  b('Danish-Swedish Farmdog', 'Working', 'small', [15, 25], [12.5, 14.5], [11, 13], 4, 'S', 'l', 7, 'Friendly|Lively|Alert|Easygoing', 'Mouser and ratter|Loves learning tricks', ['hip', 'patella', 'eye'], { a: ['Farmdog'], g: 'KD' }),
  b('Doberman Pinscher', 'Working', 'large', [60, 100], [24, 28], [10, 12], 4, 'S', 'l', 7, 'Loyal|Fearless|Alert|Intelligent', 'Velcro dog with family|Alert barker; protective', ['dcm', 'vwd', 'hd', 'wobbler', 'bloat', 'thyroid'], { a: ['Doberman', 'Dobie', 'Dobermann'], g: 'K' }),
  b('Dogo Argentino', 'Working', 'large', [80, 100], [24, 26.5], [9, 15], 4, 'S', 'l', 7, 'Courageous|Loyal|Cheerful|Protective', 'High prey drive|Can be selective with other dogs', ['deaf', 'hip', 'allergy', 'thyroid'], { a: ['Dogo', 'Argentine Mastiff'] }),
  b('Dogue de Bordeaux', 'Working', 'giant', [99, 110], [23, 27], [5, 8], 2, 'S', 'm', 7, 'Loyal|Affectionate|Courageous|Calm', 'Drools heavily and snores|Stubborn', ['bloat', 'hd', 'heart', 'cancer', 'brachy', 'skinfold'], { a: ['French Mastiff', 'Bordeaux Mastiff'] }),
  b('German Pinscher', 'Working', 'medium', [25, 45], [17, 20], [12, 14], 4, 'S', 'l', 7, 'Courageous|Alert|Lively|Intelligent', 'Tests boundaries|Hunts vermin', ['hip', 'eye', 'vwd'] ),
  b('Giant Schnauzer', 'Working', 'large', [55, 85], [23.5, 27.5], [12, 15], 4, 'W', 'l', 7, 'Loyal|Alert|Trainable|Territorial', 'Needs a job or gets destructive|Protective of home', ['hd', 'thyroid', 'eye', 'cancer'], { g: 'K' }),
  b('Great Dane', 'Working', 'giant', [110, 175], [28, 32], [7, 10], 3, 'S', 'm', 7, 'Friendly|Patient|Dependable|Gentle', 'Leans on people|Thinks it is a lap dog', ['bloat', 'dcm', 'hd', 'wobbler', 'thyroid', 'osteo'], { a: ['Dane'], g: 'KD' }),
  b('Great Pyrenees', 'Working', 'giant', [85, 160], [25, 32], [10, 12], 2, 'DL', 'h', 3, 'Calm|Patient|Smart|Protective', 'Barks at night to guard|Independent; may wander', ['hd', 'bloat', 'osteo', 'eyelid', 'patella'], { a: ['Pyrenean Mountain Dog', 'Pyr'], g: 'K' }),
  b('Greater Swiss Mountain Dog', 'Working', 'giant', [85, 140], [23.5, 28.5], [8, 11], 3, 'SD', 'h', 7, 'Faithful|Family-oriented|Dependable|Bold', 'Loves to pull carts|A big licker', ['hd', 'bloat', 'epilepsy', 'shoulder'], { a: ['Swissy'], g: 'K' }),
  b('Kangal', 'Working', 'giant', [90, 145], [28, 32], [12, 15], 3, 'SD', 'm', 7, 'Calm|Protective|Independent|Loyal', 'Guards livestock and home|Barks at night', ['hd', 'eyelid'], { a: ['Kangal Shepherd Dog'] }),
  b('Komondor', 'Working', 'giant', [80, 130], [25.5, 30], [10, 12], 2, 'R', 'l', 14, 'Dignified|Brave|Loyal|Protective', 'Guards flock and family|Wary of strangers', ['hd', 'bloat', 'eye', 'skin'], { a: ['Hungarian Sheepdog'] }),
  b('Kuvasz', 'Working', 'large', [70, 115], [26, 30], [10, 12], 3, 'DV', 'h', 7, 'Loyal|Courageous|Patient|Independent', 'Protective guardian|Independent thinker', ['hd', 'thyroid', 'osteo'] ),
  b('Leonberger', 'Working', 'giant', [90, 170], [25.5, 31.5], [7, 9], 3, 'DL', 'h', 3, 'Friendly|Gentle|Playful|Calm', 'Loves water and mud|Leans on people', ['hd', 'bloat', 'cancer', 'laryngeal', 'eye'], { a: ['Leo'], g: 'KD' }),
  b('Mastiff', 'Working', 'giant', [120, 230], [27.5, 30], [6, 10], 2, 'S', 'm', 7, 'Courageous|Dignified|Good-natured|Calm', 'Drools and snores|Lazy indoors but protective', ['bloat', 'hd', 'cruciate', 'eye', 'cancer', 'heat'], { a: ['English Mastiff'], g: 'K' }),
  b('Neapolitan Mastiff', 'Working', 'giant', [110, 150], [24, 31], [7, 9], 2, 'S', 'm', 7, 'Watchful|Dignified|Devoted|Calm', 'Drools a lot|Wary of strangers', ['hd', 'bloat', 'eyelid', 'cherry', 'skinfold', 'heat'], { a: ['Neo', 'Mastino Napoletano'] }),
  b('Newfoundland', 'Working', 'giant', [100, 150], [26, 28], [9, 10], 2, 'DL', 'h', 3, 'Sweet|Patient|Devoted|Gentle', 'Drools|Loves water and may try to rescue swimmers', ['hd', 'heart', 'bloat', 'stones', 'cruciate'], { a: ['Newfie'], g: 'KDC' }),
  b('Portuguese Water Dog', 'Working', 'medium', [35, 60], [17, 23], [11, 13], 4, 'CV', 'l', 3, 'Affectionate|Adventurous|Athletic|Smart', 'Loves water|Mouthy and chewy', ['hip', 'eye', 'addison'], { a: ['PWD', 'Portie'], g: 'KD' }),
  b('Rottweiler', 'Working', 'large', [80, 135], [22, 27], [9, 10], 3, 'SD', 'm', 7, 'Loyal|Loving|Confident|Protective', 'Leans on people|Protective of home and family', ['hd', 'osteo', 'heart', 'bloat', 'cruciate', 'obesity'], { a: ['Rottie', 'Rott'], g: 'K' }),
  b('Saint Bernard', 'Working', 'giant', [120, 180], [26, 30], [8, 10], 2, 'SL', 'h', 3, 'Playful|Charming|Patient|Gentle', 'Drools|Prefers cool weather', ['hd', 'bloat', 'dcm', 'eyelid', 'osteo', 'heat'], { a: ['St. Bernard', 'St Bernard'], g: 'KD' }),
  b('Samoyed', 'Working', 'medium', [35, 65], [19, 23.5], [12, 14], 4, 'D', 'h', 2, 'Friendly|Gentle|Adaptable|Talkative', 'Barks and howls to talk|Digs|Smiling expression', ['hip', 'eye', 'thyroid', 'diabetes', 'kidney'], { a: ['Sammy'], g: 'KD' }),
  b('Siberian Husky', 'Working', 'medium', [35, 60], [20, 23.5], [12, 14], 5, 'DM', 'h', 3, 'Loyal|Mischievous|Outgoing|Friendly', 'Escape artist that digs and jumps fences|Howls and talks|Runs off if off-leash', ['eye', 'hip', 'thyroid', 'heat', 'skin'], { a: ['Husky', 'Siberian'], g: 'KDc' }),
  b('Standard Schnauzer', 'Working', 'medium', [30, 50], [17.5, 19.5], [13, 16], 4, 'W', 'l', 7, 'Smart|Fearless|Spirited|Protective', 'Alert barker|Loves family games', ['hip', 'eye', 'thyroid'], { g: 'K' }),
  b('Tibetan Mastiff', 'Working', 'giant', [70, 150], [24, 30], [10, 12], 2, 'DL', 'h', 7, 'Independent|Reserved|Protective|Intelligent', 'Barks at night|Very territorial', ['hd', 'thyroid', 'eye'] ),

  // Terrier
  b('Airedale Terrier', 'Terrier', 'large', [50, 70], [22, 23], [11, 14], 4, 'W', 'l', 7, 'Friendly|Clever|Courageous|Confident', 'Digs and chases small animals|Playful well into adulthood', ['hd', 'thyroid', 'allergy', 'bloat'], { a: ['Airedale'], g: 'K' }),
  b('American Bully', 'Terrier', 'large', [50, 90], [13, 20], [10, 13], 3, 'S', 'l', 7, 'Gentle|Friendly|Confident|Loyal', 'Loves people and lap time|Snores and tires in heat', ['hd', 'allergy', 'cherry', 'heat', 'obesity'], { a: ['Bully', 'XL Bully', 'Pocket Bully', 'American Bulldog Bully'] }),
  b('American Hairless Terrier', 'Terrier', 'small', [12, 16], [12, 16], [14, 16], 4, 'HS', 'l', 7, 'Energetic|Inquisitive|Smart|Playful', 'Burrows under blankets|Needs sunscreen and sweaters', ['sunburn', 'cold', 'patella', 'allergy'], { a: ['AHT'], g: 'K' }),
  b('American Pit Bull Terrier', 'Terrier', 'medium', [30, 65], [17, 21], [12, 16], 4, 'S', 'l', 7, 'Confident|Eager|Affectionate|Strong', 'Very people-oriented|Strong chewer; may be selective with dogs', ['hd', 'allergy', 'cruciate', 'thyroid'], { a: ['APBT', 'Pit Bull', 'Pitbull'], g: 'K' }),
  b('American Staffordshire Terrier', 'Terrier', 'medium', [40, 70], [17, 19], [12, 16], 4, 'S', 'm', 7, 'Confident|Smart|Good-natured|Loyal', 'Very people-oriented|Strong; can be selective with dogs', ['hd', 'allergy', 'thyroid', 'cruciate'], { a: ['AmStaff', 'Am Staff'], g: 'K' }),
  b('Australian Terrier', 'Terrier', 'small', [15, 20], [10, 11], [11, 15], 4, 'W', 'l', 7, 'Courageous|Spirited|Alert|Affectionate', 'Digs|Barks at critters', ['patella', 'legg', 'diabetes', 'allergy'], { a: ['Aussie Terrier'] }),
  b('Bedlington Terrier', 'Terrier', 'small', [17, 23], [15, 17.5], [11, 16], 3, 'C', 'l', 4, 'Mild|Playful|Alert|Lively', 'Lamb-like look but a fast runner|Chases small animals', ['copper', 'eye', 'patella'], { a: ['Bedlington'], g: 'K' }),
  b('Border Terrier', 'Terrier', 'small', [11.5, 15.5], [12, 15], [12, 15], 4, 'W', 'l', 7, 'Affectionate|Happy|Alert|Plucky', 'Digs and chases|Squeezes through small gaps', ['hip', 'eye', 'heart', 'epilepsy'], { g: 'KD' }),
  b('Bull Terrier', 'Terrier', 'medium', [50, 70], [21, 22], [12, 13], 4, 'S', 'm', 7, 'Playful|Charming|Mischievous|Stubborn', 'May spin or chase its tail|Clownish and pushy', ['deaf', 'kidney', 'heart', 'allergy', 'patella'], { a: ['English Bull Terrier'], g: 'K' }),
  b('Cairn Terrier', 'Terrier', 'small', [13, 14], [9.5, 10], [13, 15], 4, 'W', 'm', 7, 'Alert|Cheerful|Busy|Independent', 'Digs holes|Barks at small animals', ['patella', 'glaucoma', 'liver', 'legg'], { a: ['Cairn'], g: 'KD' }),
  b('Cesky Terrier', 'Terrier', 'small', [14, 24], [10, 13], [12, 15], 3, 'K', 'l', 3, 'Calm|Loyal|Playful|Reserved with strangers', 'Gentler than most terriers|Needs regular clipping', ['patella', 'eye', 'ivdd'], { a: ['Bohemian Terrier'], g: 'KD' }),
  b('Dandie Dinmont Terrier', 'Terrier', 'small', [18, 24], [8, 11], [12, 15], 3, 'X', 'l', 3, 'Independent|Smart|Proud|Affectionate', 'Long-backed digger|Deep, big-dog bark', ['ivdd', 'glaucoma', 'thyroid', 'obesity'], { a: ['Dandie'] }),
  b('Glen of Imaal Terrier', 'Terrier', 'small', [32, 40], [12.5, 14], [12, 15], 3, 'MW', 'l', 7, 'Spirited|Brave|Gentle|Loyal', 'Low-slung digger|Quiet but tenacious', ['eye', 'hd', 'allergy'], { a: ['Glen'] }),
  b('Irish Terrier', 'Terrier', 'medium', [25, 27], [18, 18], [13, 15], 4, 'W', 'l', 7, 'Bold|Dashing|Tenderhearted|Spirited', 'Can be scrappy with other dogs|Loves to chase', ['stones', 'hip', 'eye'], { g: 'K' }),
  b('Jack Russell Terrier', 'Terrier', 'small', [13, 17], [10, 15], [13, 16], 5, 'SW', 'm', 7, 'Bold|Energetic|Clever|Stubborn', 'Digs, jumps, and chases|Barks a lot when bored', ['lens', 'deaf', 'patella', 'legg'], { a: ['JRT', 'Jack Russell'] }),
  b('Kerry Blue Terrier', 'Terrier', 'medium', [33, 40], [17.5, 19.5], [12, 15], 4, 'VK', 'l', 3, 'Alert|Adaptable|People-oriented|Spirited', 'Protective of home|Can be scrappy with dogs', ['eye', 'hip', 'ear'], { a: ['Kerry Blue'], g: 'K' }),
  b('Lakeland Terrier', 'Terrier', 'small', [15, 17], [13.5, 15], [12, 16], 4, 'W', 'l', 7, 'Friendly|Bold|Confident|Busy', 'Digs and barks|Clever escape artist', ['lens', 'legg', 'eye'], { a: ['Lakeland'] }),
  b('Manchester Terrier', 'Terrier', 'small', [12, 22], [10, 16], [15, 17], 4, 'S', 'l', 7, 'Spirited|Bright|Keen|Devoted', 'Ratter that chases small animals|Can be a barker', ['vwd', 'legg', 'thyroid', 'heart'], { a: ['Toy Manchester Terrier', 'Standard Manchester Terrier'] }),
  b('Miniature Bull Terrier', 'Terrier', 'small', [18, 28], [10, 14], [11, 14], 4, 'S', 'm', 7, 'Playful|Comical|Stubborn|Fearless', 'Spins and chases its tail|Pushy and playful', ['lens', 'deaf', 'kidney', 'glaucoma'], { a: ['Mini Bull Terrier'] }),
  b('Miniature Schnauzer', 'Terrier', 'small', [11, 20], [12, 14], [12, 15], 4, 'W', 'l', 7, 'Friendly|Smart|Obedient|Alert', 'Alert barker|Follows family closely', ['pancreatitis', 'stones', 'eye', 'diabetes', 'liver', 'obesity'], { a: ['Mini Schnauzer', 'Schnauzer'], g: 'KD' }),
  b('Norfolk Terrier', 'Terrier', 'small', [11, 12], [9, 10], [12, 16], 4, 'W', 'l', 7, 'Fearless|Alert|Fun-loving|Happy', 'Digs and chases|Wants to be with people', ['mvd', 'patella', 'hip', 'dental'], { a: ['Norfolk'], g: 'KD' }),
  b('Norwich Terrier', 'Terrier', 'small', [11, 12], [9, 10], [12, 15], 4, 'W', 'l', 7, 'Affectionate|Alert|Curious|Gregarious', 'Chases small animals|Busy digger', ['hip', 'epilepsy', 'dental', 'patella'], { a: ['Norwich'], g: 'KD' }),
  b('Parson Russell Terrier', 'Terrier', 'small', [13, 17], [13, 14], [13, 15], 5, 'SW', 'm', 7, 'Clever|Athletic|Friendly|Bold', 'Digs and chases|Jumps high|Never seems to run out of energy', ['lens', 'deaf', 'patella', 'legg'], { a: ['Parson Jack Russell Terrier'] }),
  b('Patterdale Terrier', 'Terrier', 'small', [11, 13], [10, 15], [11, 14], 5, 'SW', 'm', 7, 'Bold|Energetic|Confident|Stubborn', 'Strong hunting drive|Digs', ['eye', 'patella'], { a: ['Patterdale'] }),
  b('Rat Terrier', 'Terrier', 'small', [10, 25], [10, 18], [12, 18], 4, 'S', 'm', 7, 'Friendly|Inquisitive|Lovable|Busy', 'Digs and hunts vermin|Burrows under blankets', ['patella', 'allergy', 'legg', 'dental'], { a: ['Rattie'], g: 'KD' }),
  b('Russell Terrier', 'Terrier', 'small', [9, 15], [10, 12], [12, 14], 5, 'SW', 'm', 7, 'Alert|Lively|Inquisitive|Friendly', 'Bold explorer|Chases anything small', ['lens', 'deaf', 'patella'] ),
  b('Scottish Terrier', 'Terrier', 'small', [18, 22], [10, 11], [12, 15], 3, 'W', 'l', 7, 'Confident|Independent|Spirited|Dignified', 'Digs and is strong-willed|Watchful barker', ['cancer', 'vwd', 'thyroid'], { a: ['Scottie', 'Scotty'] }),
  b('Sealyham Terrier', 'Terrier', 'small', [23, 24], [10, 11], [12, 14], 3, 'W', 'l', 7, 'Alert|Outgoing|Funny|Calm', 'Big-dog bark|Clownish at home', ['lens', 'eye', 'ear'], { a: ['Sealyham'] }),
  b('Skye Terrier', 'Terrier', 'small', [35, 45], [9.5, 10], [12, 14], 3, 'L', 'm', 7, 'Courageous|Good-tempered|Loyal|Reserved', 'Wary of strangers|Long, low digger', ['ivdd', 'thyroid', 'cancer'], { a: ['Skye'] }),
  b('Smooth Fox Terrier', 'Terrier', 'small', [15, 18], [14, 15.5], [12, 15], 5, 'S', 'm', 7, 'Friendly|Alert|Independent|Energetic', 'Digs and chases|Loves games', ['lens', 'deaf', 'patella', 'legg'], { a: ['Fox Terrier', 'Smooth Fox'] }),
  b('Soft Coated Wheaten Terrier', 'Terrier', 'medium', [30, 40], [17, 19], [12, 14], 3, 'KV', 'l', 2, 'Happy|Friendly|Devoted|Bouncy', 'Jumps up to greet people|Bouncy and playful for years', ['kidney', 'gastro', 'allergy', 'hip', 'eye'], { a: ['Wheaten', 'Wheaten Terrier'], g: 'KD' }),
  b('Staffordshire Bull Terrier', 'Terrier', 'medium', [24, 38], [14, 16], [12, 14], 4, 'S', 'm', 7, 'Courageous|Clever|Tenacious|Affectionate', 'Loves people; may be selective with dogs|Strong chewer', ['hip', 'allergy', 'eye'], { a: ['Staffy', 'Staffie', 'Stafford'], g: 'K' }),
  b('Teddy Roosevelt Terrier', 'Terrier', 'small', [8, 25], [8, 15], [14, 16], 4, 'S', 'l', 7, 'Friendly|Alert|Playful|Busy', 'Hunts vermin|Digs', ['patella', 'allergy', 'hip'] ),
  b('Welsh Terrier', 'Terrier', 'small', [18, 22], [15, 15.5], [12, 15], 4, 'W', 'l', 7, 'Friendly|Spirited|Intelligent|Independent', 'Digs and chases|Playful clown', ['glaucoma', 'lens', 'allergy', 'thyroid'], { a: ['Welshie'], g: 'K' }),
  b('West Highland White Terrier', 'Terrier', 'small', [15, 20], [10, 11], [13, 15], 4, 'W', 'l', 7, 'Loyal|Happy|Entertaining|Confident', 'Digs|Barks at critters', ['allergy', 'legg', 'lung', 'dryeye', 'liver'], { a: ['Westie'], g: 'K' }),
  b('Wire Fox Terrier', 'Terrier', 'small', [15, 18], [14, 15.5], [12, 15], 5, 'W', 'm', 7, 'Friendly|Alert|Independent|Energetic', 'Digs and chases|Loves games', ['lens', 'deaf', 'eye', 'legg'], { a: ['Wire Fox', 'Wire Haired Fox Terrier'] }),

  // Toy
  b('Affenpinscher', 'Toy', 'toy', [7, 10], [9, 11.5], [12, 15], 3, 'W', 'l', 3, 'Confident|Curious|Comical|Loyal', 'Bold with bigger dogs|Can guard its toys', ['patella', 'legg', 'eye', 'dental'], { a: ['Affen', 'Monkey Terrier'] }),
  b('Biewer Terrier', 'Toy', 'toy', [4, 8], [7, 11], [12, 16], 3, 'KL', 'l', 1, 'Whimsical|Affectionate|Playful|Alert', 'Lap dog that loves games|Can be slow to house-train', ['patella', 'dental', 'hypogly', 'liver', 'trachea'], { a: ['Biewer', 'Biewer Yorkie'] }),
  b('Bolognese', 'Toy', 'toy', [5.5, 9], [10, 12], [12, 14], 2, 'VC', 'l', 2, 'Calm|Devoted|Playful|Reserved', 'Shadows its owner|Calm indoors', ['patella', 'dental', 'eye'] ),
  b('Brussels Griffon', 'Toy', 'toy', [8, 10], [7, 10], [12, 15], 3, 'WS', 'l', 7, 'Loyal|Curious|Sensitive|Comical', 'Velcro dog|Expressive, almost human face', ['brachy', 'corneal', 'syringo', 'patella', 'hip'], { a: ['Griffon Bruxellois', 'Griff'] }),
  b('Cavalier King Charles Spaniel', 'Toy', 'small', [13, 18], [12, 13], [12, 15], 3, 'KF', 'm', 3, 'Affectionate|Gentle|Graceful|Eager', 'Lap dog that follows you around|Loves to snuggle', ['mvd', 'syringo', 'eye', 'patella', 'ear', 'hip'], { a: ['Cavalier', 'CKCS', 'King Charles Spaniel'], g: 'KDC' }),
  b('Chihuahua', 'Toy', 'toy', [2, 6], [5, 8], [14, 16], 3, 'SL', 'm', 7, 'Charming|Graceful|Sassy|Loyal', 'Bonds to one person|Burrows under blankets and feels the cold|May bark at strangers', ['patella', 'dental', 'hypogly', 'trachea', 'mvd', 'cold'], { a: ['Chi', 'Long Coat Chihuahua', 'Smooth Coat Chihuahua'] }),
  b('Chinese Crested', 'Toy', 'toy', [8, 12], [11, 13], [13, 18], 3, 'HKL', 'l', 7, 'Affectionate|Alert|Lively|Sensitive', 'Lap warmer|Hairless type needs sunscreen; Powderpuff needs brushing', ['dental', 'sunburn', 'lens', 'eye', 'patella'], { a: ['Crested', 'Powderpuff'] }),
  b('English Toy Spaniel', 'Toy', 'toy', [8, 14], [9, 10], [10, 12], 2, 'KF', 'm', 3, 'Gentle|Playful|Loving|Calm', 'Couch companion|Snores', ['brachy', 'mvd', 'patella', 'eye', 'dental'], { a: ['King Charles Spaniel (English Toy)'] }),
  b('Havanese', 'Toy', 'toy', [7, 13], [8.5, 11.5], [14, 16], 3, 'KL', 'l', 2, 'Friendly|Outgoing|Funny|Smart', 'Velcro dog that dislikes being alone|Loves performing tricks', ['patella', 'eye', 'deaf', 'liver', 'legg'], { a: ['Havanese Cuban'], g: 'KDC' }),
  b('Italian Greyhound', 'Toy', 'toy', [7, 14], [13, 15], [14, 15], 3, 'S', 'l', 7, 'Playful|Affectionate|Sensitive|Alert', 'Feels the cold and loves blankets|Sprints in bursts on delicate legs', ['dental', 'fracture', 'patella', 'epilepsy', 'cold'], { a: ['IG', 'Iggy'] }),
  b('Japanese Chin', 'Toy', 'toy', [7, 11], [8, 11], [10, 12], 2, 'KL', 'm', 3, 'Charming|Noble|Catlike|Loving', 'Spins in circles when happy|Cleans itself like a cat', ['brachy', 'patella', 'heart', 'eye', 'corneal'], { a: ['Chin'], g: 'C' }),
  b('Maltese', 'Toy', 'toy', [4, 7], [7, 9], [12, 15], 3, 'KL', 'l', 1, 'Gentle|Playful|Charming|Fearless', 'Lap dog that barks at visitors|Prone to tear staining', ['dental', 'patella', 'liver', 'hypogly', 'trachea'], { g: 'D' }),
  b('Miniature Pinscher', 'Toy', 'toy', [8, 10], [10, 12.5], [12, 16], 4, 'S', 'l', 7, 'Fearless|Fun-loving|Proud|Energetic', 'Escape artist|Barks to alert', ['patella', 'legg', 'eye', 'thyroid'], { a: ['Min Pin', 'Minpin', 'Zwergpinscher'] }),
  b('Papillon', 'Toy', 'toy', [5, 10], [8, 11], [14, 16], 4, 'KL', 'l', 3, 'Happy|Alert|Friendly|Smart', 'Learns tricks fast|Loves agility', ['patella', 'dental', 'eye', 'hypogly'], { a: ['Butterfly Dog', 'Phalene'], g: 'KD' }),
  b('Pekingese', 'Toy', 'toy', [7, 14], [6, 9], [12, 14], 2, 'LD', 'h', 2, 'Affectionate|Loyal|Regal|Independent', 'Rolls along rather than runs|Snores', ['brachy', 'corneal', 'ivdd', 'skinfold', 'dental'], { a: ['Peke'] }),
  b('Pomeranian', 'Toy', 'toy', [3, 7], [6, 7], [12, 16], 3, 'D', 'h', 3, 'Inquisitive|Bold|Lively|Smart', 'Barks at everything|Spins and dances for attention', ['patella', 'trachea', 'dental', 'skin', 'hypogly'], { a: ['Pom'] }),
  b('Poodle (Toy)', 'Toy', 'toy', [4, 6], [8, 10], [10, 18], 3, 'C', 'l', 2, 'Smart|Proud|Affectionate|Agile', 'Quick learner|Can be a barker', ['patella', 'eye', 'dental', 'legg', 'epilepsy'], { a: ['Toy Poodle'], g: 'KDC' }),
  b('Pug', 'Toy', 'small', [14, 18], [10, 13], [13, 15], 2, 'S', 'h', 7, 'Charming|Mischievous|Loving|Even-tempered', 'Snores and snorts|Begs for food and gains weight easily|Follows you everywhere', ['brachy', 'corneal', 'obesity', 'skinfold', 'hip'], { a: ['Mops'], g: 'KDC' }),
  b('Russian Toy', 'Toy', 'toy', [3, 6.5], [8, 11], [12, 14], 3, 'SL', 'm', 7, 'Cheerful|Lively|Smart|Devoted', 'Delicate legs; avoid big jumps|Shy with strangers', ['patella', 'dental', 'fracture', 'trachea'], { a: ['Russkiy Toy', 'Russian Toy Terrier'] }),
  b('Russian Tsvetnaya Bolonka', 'Toy', 'toy', [4.5, 9], [8, 10], [12, 16], 2, 'VC', 'l', 2, 'Affectionate|Cheerful|Gentle|Smart', 'Lap dog that wants company|Easy to train', ['patella', 'dental', 'eye'], { a: ['Bolonka', 'Tsvetnaya Bolonka'], g: 'KDC' }),
  b('Shih Tzu', 'Toy', 'small', [9, 16], [9, 10.5], [10, 18], 2, 'LK', 'l', 1, 'Affectionate|Playful|Outgoing|Friendly', 'Lap dog that loves attention|Can be stubborn about house-training', ['brachy', 'corneal', 'dental', 'patella', 'ear', 'hip'], { a: ['Shih-Tzu', 'Shihtzu'], g: 'KDC' }),
  b('Silky Terrier', 'Toy', 'toy', [8, 10], [9, 10], [13, 15], 4, 'K', 'l', 2, 'Friendly|Quick|Alert|Spirited', 'Terrier-feisty and chases small animals|Barks', ['patella', 'trachea', 'legg', 'dental'], { a: ['Australian Silky Terrier', 'Silky'] }),
  b('Toy Fox Terrier', 'Toy', 'toy', [3.5, 7], [8.5, 11.5], [13, 15], 4, 'S', 'l', 7, 'Friendly|Alert|Smart|Spunky', 'Barks at noises|Plays like a big terrier', ['patella', 'legg', 'dental', 'thyroid'], { a: ['TFT', 'American Toy Terrier'] }),
  b('Yorkshire Terrier', 'Toy', 'toy', [4, 7], [7, 8], [11, 15], 3, 'KL', 'l', 1, 'Sprightly|Tomboyish|Affectionate|Brave', 'Barks to alert|Acts like a big dog', ['patella', 'trachea', 'dental', 'liver', 'hypogly'], { a: ['Yorkie'] }),

  // Non-Sporting
  b('American Eskimo Dog', 'Non-Sporting', 'small', [6, 35], [9, 19], [13, 15], 4, 'D', 'h', 3, 'Smart|Alert|Perky|Friendly', 'Loves to bark|Learns tricks quickly', ['hip', 'eye', 'patella', 'diabetes'], { a: ['Eskie', 'American Eskimo', 'Toy American Eskimo', 'Miniature American Eskimo'], g: 'KD' }),
  b('Bichon Frise', 'Non-Sporting', 'small', [12, 18], [9.5, 11.5], [14, 15], 3, 'C', 'l', 2, 'Playful|Curious|Peppy|Cheerful', 'Sudden zoomies around the house|Dislikes being alone', ['allergy', 'dental', 'stones', 'patella'], { a: ['Bichon'], g: 'KDC' }),
  b('Boston Terrier', 'Non-Sporting', 'small', [12, 25], [15, 17], [11, 13], 3, 'S', 'l', 7, 'Friendly|Bright|Amusing|Lively', 'Snorts and snores|Loves people', ['brachy', 'corneal', 'patella', 'allergy'], { a: ['Boston'], g: 'KDC' }),
  b('Bulldog', 'Non-Sporting', 'medium', [40, 50], [14, 15], [8, 10], 2, 'S', 'm', 7, 'Calm|Courageous|Friendly|Stubborn', 'Snores loudly|Overheats easily|Short bursts of play', ['brachy', 'skinfold', 'hip', 'allergy', 'cherry', 'eyelid'], { a: ['English Bulldog', 'British Bulldog'], g: 'KD' }),
  b('Chinese Shar-Pei', 'Non-Sporting', 'medium', [45, 60], [18, 20], [8, 12], 3, 'S', 'l', 7, 'Loyal|Independent|Calm|Suspicious of strangers', 'Reserved and protective|Likes routine', ['eyelid', 'skinfold', 'allergy', 'spfever', 'kidney'], { a: ['Shar-Pei', 'Shar Pei', 'Sharpei'] }),
  b('Chow Chow', 'Non-Sporting', 'medium', [45, 70], [17, 20], [8, 12], 2, 'D', 'h', 3, 'Dignified|Aloof|Loyal|Independent', 'Catlike and clean|Protective and wary of strangers', ['eyelid', 'hd', 'heat', 'thyroid'], { a: ['Chow'] }),
  b('Coton de Tulear', 'Non-Sporting', 'small', [8, 15], [9, 11], [15, 19], 3, 'L', 'l', 2, 'Happy|Bright|Charming|Gentle', 'Clownish and loves attention|Barks little', ['patella', 'eye', 'hip'], { a: ['Coton'], g: 'KDC' }),
  b('Dalmatian', 'Non-Sporting', 'large', [45, 70], [19, 24], [11, 13], 5, 'S', 'h', 7, 'Dignified|Smart|Outgoing|Energetic', 'Strong running companion|Can be reserved with strangers', ['stones', 'deaf', 'hip', 'allergy'], { a: ['Dal', 'Dalmation'], g: 'K', feed: 'Dalmatians can form urate bladder stones: keep fresh water available and ask your vet about a lower-purine diet.' }),
  b('Finnish Spitz', 'Non-Sporting', 'medium', [20, 33], [15.5, 20], [13, 15], 4, 'D', 'h', 7, 'Friendly|Lively|Alert|Vocal', 'Barks a lot (bred to bark at game)|Independent', ['hip', 'patella', 'epilepsy', 'diabetes'], { a: ['Finkie'], g: 'K' }),
  b('French Bulldog', 'Non-Sporting', 'small', [16, 28], [11, 13], [10, 12], 2, 'S', 'm', 7, 'Adaptable|Playful|Smart|Affectionate', 'Snores and snorts|Overheats easily|Clownish lap dog', ['brachy', 'ivdd', 'allergy', 'cherry', 'spine', 'ear'], { a: ['Frenchie', 'Frenchy'], g: 'KD' }),
  b('Keeshond', 'Non-Sporting', 'medium', [35, 45], [17, 18], [12, 15], 3, 'D', 'h', 3, 'Friendly|Lively|Outgoing|Smart', 'Talkative barker|Loves to be with family', ['hip', 'patella', 'thyroid', 'diabetes'], { a: ['Kees', 'Wolfspitz'], g: 'KDC' }),
  b('Korean Jindo', 'Non-Sporting', 'medium', [30, 50], [18, 22], [12, 15], 4, 'D', 'h', 7, 'Loyal|Independent|Alert|Clean', 'Escape artist and fence-jumper|Bonds closely to one family', ['thyroid', 'allergy', 'hip'], { a: ['Jindo', 'Jindo Dog'] }),
  b('Lhasa Apso', 'Non-Sporting', 'small', [12, 18], [10, 11], [12, 15], 3, 'L', 'l', 2, 'Confident|Smart|Comical|Wary of strangers', 'Watchful alert barker|Independent', ['eye', 'kidney', 'dryeye', 'patella', 'cherry'], { a: ['Lhasa'] }),
  b('Lowchen', 'Non-Sporting', 'small', [8, 18], [12, 14], [13, 15], 3, 'VL', 'l', 3, 'Affectionate|Lively|Positive|Smart', 'Lap dog that loves company|May bark from windows', ['patella', 'eye', 'hip'], { a: ['Little Lion Dog', 'Löwchen'], g: 'KDC' }),
  b('Norwegian Lundehund', 'Non-Sporting', 'small', [20, 30], [12, 15], [12, 15], 4, 'D', 'h', 7, 'Alert|Energetic|Loyal|Playful', 'Six toes and very flexible; climbs well|Hides food', ['gastro', 'eye'], { a: ['Lundehund'], feed: 'Lundehunds can have a very sensitive gut: ask your vet about a highly digestible diet and watch stools closely.' }),
  b('Olde English Bulldogge', 'Non-Sporting', 'medium', [50, 80], [16, 20], [9, 14], 3, 'S', 'l', 7, 'Confident|Friendly|Alert|Loyal', 'Snores|Strong and playful', ['hd', 'heat', 'allergy', 'cherry', 'eyelid'], { a: ['Old English Bulldog', 'Olde Bulldogge'] }),
  b('Poodle (Miniature)', 'Non-Sporting', 'small', [10, 15], [10, 15], [10, 18], 4, 'C', 'l', 2, 'Smart|Active|Proud|Affectionate', 'Quick learner who loves tricks|Can be a barker', ['patella', 'eye', 'legg', 'epilepsy', 'dental'], { a: ['Miniature Poodle', 'Mini Poodle'], g: 'KDC' }),
  b('Poodle (Standard)', 'Non-Sporting', 'large', [40, 70], [18, 24], [10, 18], 4, 'C', 'l', 2, 'Intelligent|Proud|Active|Elegant', 'Clever and easily bored|Loves water and retrieving', ['bloat', 'addison', 'hip', 'eye', 'skin'], { a: ['Standard Poodle', 'Poodle'], g: 'KDC' }),
  b('Schipperke', 'Non-Sporting', 'small', [10, 16], [10, 13], [13, 15], 4, 'D', 'm', 7, 'Confident|Curious|Agile|Mischievous', 'Alert watchdog|Escape artist', ['eye', 'hip', 'legg', 'thyroid'], { a: ['Schip'] }),
  b('Shiba Inu', 'Non-Sporting', 'small', [17, 23], [13.5, 16.5], [13, 16], 3, 'D', 'h', 3, 'Alert|Independent|Bold|Spirited', 'Screams dramatically when unhappy|Escape artist with poor recall|Catlike cleanliness', ['allergy', 'patella', 'eye', 'hip'], { a: ['Shiba'] }),
  b('Tibetan Spaniel', 'Non-Sporting', 'small', [9, 15], [9, 11], [12, 15], 3, 'K', 'm', 3, 'Playful|Smart|Independent|Self-confident', 'Perches up high to watch|Aloof with strangers', ['eye', 'patella'], { a: ['Tibbie'], g: 'KC' }),
  b('Tibetan Terrier', 'Non-Sporting', 'medium', [18, 30], [14, 17], [15, 16], 3, 'L', 'l', 2, 'Affectionate|Loyal|Sensitive|Amiable', 'Springy jumper|Wary of strangers', ['eye', 'lens', 'hip', 'patella', 'thyroid'], { a: ['TT'], g: 'K' }),
  b('Xoloitzcuintli', 'Non-Sporting', 'medium', [10, 55], [10, 23], [13, 18], 4, 'HS', 'l', 7, 'Loyal|Alert|Calm|Aware', 'Watchful and reserved with strangers|Hairless type needs sunscreen and skin care', ['sunburn', 'dental', 'cold', 'skin'], { a: ['Xolo', 'Mexican Hairless Dog', 'Toy Xolo', 'Miniature Xolo'] }),

  // Herding
  b('Australian Cattle Dog', 'Herding', 'medium', [35, 50], [17, 20], [12, 16], 5, 'SD', 'h', 7, 'Alert|Curious|Pleasant|Tireless', 'Nips heels to herd|Needs a job or invents one', ['hd', 'deaf', 'eye'], { a: ['Blue Heeler', 'Red Heeler', 'Heeler', 'Queensland Heeler', 'ACD'], g: 'K' }),
  b('Australian Shepherd', 'Herding', 'medium', [40, 65], [18, 23], [12, 15], 5, 'DM', 'h', 7, 'Smart|Work-oriented|Exuberant|Loyal', 'Herds kids and pets|Destructive when bored', ['hd', 'eye', 'epilepsy', 'mdr1', 'thyroid'], { a: ['Aussie'], g: 'KD' }),
  b('Bearded Collie', 'Herding', 'medium', [45, 55], [20, 22], [12, 14], 4, 'DL', 'm', 2, 'Bright|Bouncy|Charismatic|Smart', 'Bounds and bounces when happy|Herds and nudges', ['hip', 'thyroid', 'addison', 'eye'], { a: ['Beardie'], g: 'KD' }),
  b('Beauceron', 'Herding', 'large', [70, 110], [24, 27.5], [10, 12], 4, 'SD', 'm', 7, 'Confident|Smart|Loyal|Gentle', 'Has double dewclaws on the hind legs|Protective herding dog', ['hd', 'bloat', 'eye'], { a: ['Berger de Beauce'], g: 'K' }),
  b('Belgian Laekenois', 'Herding', 'medium', [55, 65], [22, 26], [10, 12], 4, 'W', 'm', 7, 'Watchful|Alert|Affectionate|Serious', 'Protective of home|Needs a job', ['hip', 'epilepsy', 'eye'], { a: ['Laekenois'] }),
  b('Belgian Malinois', 'Herding', 'large', [40, 80], [22, 26], [14, 16], 5, 'SD', 'm', 7, 'Confident|Smart|Hardworking|Intense', 'Extremely driven and needs work daily|Mouthy; may spin or pace when bored', ['hd', 'eye', 'epilepsy'], { a: ['Malinois', 'Mali'] }),
  b('Belgian Sheepdog', 'Herding', 'medium', [45, 75], [22, 26], [12, 14], 4, 'LD', 'm', 3, 'Bright|Watchful|Serious-minded|Devoted', 'Herds in circles|Sensitive to family mood', ['hip', 'epilepsy', 'eye', 'thyroid'], { a: ['Groenendael', 'Belgian Shepherd'] }),
  b('Belgian Tervuren', 'Herding', 'medium', [45, 75], [22, 26], [12, 14], 4, 'LD', 'm', 3, 'Intelligent|Courageous|Alert|Devoted', 'Wants to be with family|Herds and circles', ['hip', 'epilepsy', 'eye', 'thyroid'], { a: ['Tervuren', 'Terv'] }),
  b('Bergamasco Sheepdog', 'Herding', 'large', [57, 84], [22, 23.5], [13, 15], 3, 'R', 'l', 14, 'Calm|Watchful|Independent|Friendly', 'Coat forms felted mats (flocks)|Thinks for itself', ['hip', 'eye'], { a: ['Bergamasco'], g: 'K' }),
  b('Berger Picard', 'Herding', 'medium', [50, 70], [21.5, 25.5], [12, 13], 4, 'W', 'l', 7, 'Loyal|Observant|Stubborn|Even-tempered', 'Expressive and sensitive|Needs a job', ['hip', 'eye'], { a: ['Picard', 'Picardy Shepherd'] }),
  b('Border Collie', 'Herding', 'medium', [30, 55], [18, 22], [12, 15], 5, 'DM', 'm', 7, 'Affectionate|Smart|Energetic|Work-driven', 'Stares down and herds anything that moves|Needs mental work daily|Can be noise-sensitive', ['hip', 'eye', 'epilepsy', 'deaf'], { a: ['BC'], g: 'K' }),
  b('Bouvier des Flandres', 'Herding', 'large', [70, 110], [23.5, 27.5], [10, 12], 3, 'W', 'm', 7, 'Gentle|Loyal|Rational|Protective', 'Protective of family|Bearded face holds water', ['hd', 'glaucoma', 'thyroid'], { a: ['Bouvier'], g: 'K' }),
  b('Briard', 'Herding', 'large', [55, 100], [22, 27], [12, 14], 3, 'L', 'm', 2, 'Confident|Smart|Faithful|Protective', 'Herds family members|Wary of strangers', ['hd', 'bloat', 'eye'], { a: ['Berger de Brie'], g: 'K' }),
  b('Canaan Dog', 'Herding', 'medium', [35, 55], [19, 24], [12, 15], 4, 'D', 'h', 7, 'Alert|Vigilant|Devoted|Inquisitive', 'Barks to alert|Reserved with strangers', ['hip', 'eye'] ),
  b('Cardigan Welsh Corgi', 'Herding', 'medium', [25, 38], [10.5, 12.5], [12, 15], 4, 'D', 'h', 7, 'Affectionate|Loyal|Smart|Even-tempered', 'Herds by nipping heels|Big bark for its size', ['ivdd', 'hd', 'eye', 'dm', 'obesity'], { a: ['Cardigan', 'Cardi', 'Cardigan Corgi'], g: 'KD' }),
  b('Catahoula Leopard Dog', 'Herding', 'large', [50, 95], [22, 26], [10, 14], 5, 'S', 'm', 7, 'Independent|Energetic|Protective|Loyal', 'Herds and hunts|Needs lots of work', ['deaf', 'hip', 'eye'], { a: ['Catahoula', 'Louisiana Catahoula'] }),
  b('Collie', 'Herding', 'large', [50, 75], [22, 26], [12, 14], 3, 'LSD', 'h', 3, 'Devoted|Graceful|Proud|Gentle', 'Barks when excited|Senses family moods', ['eye', 'mdr1', 'skin', 'bloat'], { a: ['Rough Collie', 'Smooth Collie', 'Scotch Collie'], g: 'KDC' }),
  b('Dutch Shepherd', 'Miscellaneous', 'large', [42, 75], [21.5, 24.5], [11, 14], 5, 'SLW', 'm', 7, 'Lively|Intelligent|Athletic|Loyal', 'Needs a job every day|Alert watchdog', ['hip', 'eye'], { a: ['Hollandse Herder'] }),
  b('English Shepherd', 'Herding', 'medium', [40, 60], [18, 23], [12, 15], 4, 'DM', 'm', 7, 'Smart|Loyal|Versatile|Protective', 'Farm helper that herds and guards|Needs a job', ['hip', 'mdr1', 'eye'], { g: 'K' }),
  b('Entlebucher Mountain Dog', 'Herding', 'medium', [40, 65], [16, 21], [11, 13], 4, 'SD', 'm', 7, 'Loyal|Smart|Enthusiastic|Self-assured', 'Herds and nips heels|Needs a job', ['hd', 'eye'], { a: ['Entlebucher', 'Entle'] }),
  b('Finnish Lapphund', 'Herding', 'medium', [33, 53], [16, 21], [12, 15], 3, 'DL', 'h', 3, 'Friendly|Courageous|Calm|Keen', 'Barks to herd|Loves snow', ['eye', 'hip'], { a: ['Lappie', 'Lapphund'], g: 'KD' }),
  b('German Shepherd Dog', 'Herding', 'large', [50, 90], [22, 26], [7, 10], 4, 'D', 'h', 3, 'Confident|Courageous|Smart|Loyal', 'Herds and guards the family|Mouthy as a pup; needs training and work', ['hd', 'bloat', 'dm', 'epi', 'allergy'], { a: ['German Shepherd', 'GSD', 'Alsatian'], g: 'K' }),
  b('Icelandic Sheepdog', 'Herding', 'medium', [25, 30], [16.5, 18], [12, 14], 4, 'DM', 'h', 3, 'Friendly|Inquisitive|Playful|Cheerful', 'Barks a lot|Loves people', ['hip', 'patella', 'eye'], { a: ['Icelandic'], g: 'KDC' }),
  b('Lancashire Heeler', 'Herding', 'small', [9, 17], [10, 12], [12, 15], 4, 'S', 'm', 7, 'Friendly|Alert|Courageous|Playful', 'Nips heels to herd|Ratter instincts', ['lens', 'eye'] ),
  b('Miniature American Shepherd', 'Herding', 'medium', [20, 40], [13, 18], [12, 13], 5, 'DM', 'm', 7, 'Good-natured|Intelligent|Devoted|Energetic', 'Herds kids and pets|Needs a job', ['hip', 'eye', 'mdr1', 'epilepsy'], { a: ['Mini Aussie', 'Miniature Australian Shepherd', 'Mini American Shepherd'], g: 'KD' }),
  b('Mudi', 'Herding', 'medium', [18, 29], [15, 18.5], [12, 14], 5, 'VC', 'l', 7, 'Versatile|Intelligent|Alert|Energetic', 'Barks a lot|Learns fast', ['hip', 'epilepsy', 'eye'] ),
  b('Norwegian Buhund', 'Herding', 'medium', [26, 40], [16, 18.5], [12, 15], 4, 'D', 'h', 7, 'Self-confident|Smart|Light-hearted|Affectionate', 'Barks to alert|Loves to herd', ['hip', 'eye'], { a: ['Buhund'], g: 'K' }),
  b('Old English Sheepdog', 'Herding', 'large', [60, 100], [21, 24], [10, 12], 3, 'DL', 'h', 2, 'Adaptable|Gentle|Smart|Playful', 'Herds family by bumping with its head|Clownish', ['hd', 'eye', 'deaf', 'thyroid'], { a: ['OES', 'Bobtail'], g: 'KD' }),
  b('Pembroke Welsh Corgi', 'Herding', 'medium', [24, 30], [10, 12], [12, 13], 4, 'D', 'h', 7, 'Affectionate|Smart|Alert|Bold', 'Herds heels and barks|Food-motivated and gains weight easily', ['ivdd', 'hd', 'dm', 'obesity', 'eye'], { a: ['Corgi', 'Pembroke', 'Pembroke Corgi'], g: 'KD' }),
  b('Peruvian Inca Orchid', 'Miscellaneous', 'medium', [15, 55], [10, 26], [12, 14], 4, 'HS', 'l', 7, 'Affectionate|Alert|Noble|Protective', 'Hairless type needs sunscreen and sweaters|Wary of strangers', ['sunburn', 'dental', 'cold'], { a: ['PIO', 'Peruvian Hairless Dog'] }),
  b('Polish Lowland Sheepdog', 'Herding', 'medium', [30, 50], [17, 20], [12, 14], 3, 'DL', 'm', 2, 'Confident|Clever|Lively|Steady', 'Watchful guardian|Strong-willed', ['hip', 'eye', 'thyroid'], { a: ['PON', 'Polski Owczarek Nizinny'] }),
  b('Portuguese Sheepdog', 'Miscellaneous', 'medium', [37, 59], [16.5, 21.5], [12, 15], 4, 'L', 'm', 3, 'Lively|Loyal|Wary of strangers|Smart', 'Monkey-faced herder|Watchful', ['hip', 'eye'], { a: ['Cao da Serra de Aires'] }),
  b('Puli', 'Herding', 'medium', [25, 35], [16, 17], [10, 15], 4, 'R', 'l', 14, 'Loyal|Smart|Agile|Faithful', 'Corded coat takes a long time to dry|Bouncy herder', ['hd', 'eye', 'patella'], { a: ['Pulik'] }),
  b('Pumi', 'Herding', 'medium', [22, 29], [15, 18.5], [12, 13], 5, 'CW', 'l', 7, 'Lively|Smart|Vocal|Bold', 'Talkative barker|Always on the move', ['hip', 'patella'] ),
  b('Pyrenean Shepherd', 'Herding', 'small', [15, 32], [15, 21], [15, 17], 5, 'LM', 'm', 7, 'Smart|Playful|Energetic|Wary of strangers', 'Tireless herder that barks|Very busy', ['hip', 'eye', 'patella'], { a: ['Berger des Pyrenees', 'Pyr Shep'] }),
  b('Shetland Sheepdog', 'Herding', 'small', [15, 25], [13, 16], [12, 14], 4, 'DL', 'h', 3, 'Playful|Energetic|Bright|Sensitive', 'Barks a lot|Herds kids and pets', ['eye', 'mdr1', 'thyroid', 'hip', 'skin'], { a: ['Sheltie'], g: 'KDC' }),
  b('Spanish Water Dog', 'Herding', 'medium', [31, 49], [16, 20], [12, 14], 4, 'CR', 'l', 30, 'Loyal|Diligent|Wary of strangers|Energetic', 'Loves water|Protective herder', ['hip', 'eye', 'thyroid'], { a: ['SWD', 'Perro de Agua Espanol'] }),
  b('Swedish Vallhund', 'Herding', 'medium', [20, 35], [11.5, 13.75], [12, 15], 4, 'D', 'h', 7, 'Friendly|Watchful|Energetic|Smart', 'Herds heels|Barks', ['hip', 'eye', 'ivdd'], { a: ['Vallhund'], g: 'K' }),

  // Designer and common mixes
  b('Aussiedoodle', 'Mixed', 'medium', [25, 70], [14, 23], [10, 13], 5, 'CV', 'l', 2, 'Smart|Energetic|Affectionate|Playful', 'Needs daily mental work|May try to herd', ['hip', 'eye', 'mdr1', 'epilepsy'], { a: ['Aussie Doodle', 'Aussiepoo'], g: 'KD' }),
  b('Bernedoodle', 'Mixed', 'large', [25, 90], [18, 29], [12, 15], 3, 'CV', 'l', 2, 'Goofy|Gentle|Affectionate|Smart', 'Loves family time|Can be stubborn', ['hd', 'cancer', 'eye', 'allergy', 'bloat'], { a: ['Mini Bernedoodle', 'Berne Doodle'], g: 'KD' }),
  b('Cavachon', 'Mixed', 'small', [10, 20], [12, 13], [12, 15], 3, 'VC', 'l', 2, 'Gentle|Affectionate|Playful|Calm', 'Lap dog|Dislikes being alone', ['mvd', 'patella', 'eye', 'allergy'], { g: 'KDC' }),
  b('Cavapoo', 'Mixed', 'small', [9, 25], [9, 14], [12, 15], 3, 'CV', 'l', 2, 'Gentle|Affectionate|Playful|Social', 'Lap dog that dislikes being alone|Loves to fetch', ['mvd', 'patella', 'eye', 'ear', 'syringo'], { a: ['Cavoodle', 'Cavadoodle'], g: 'KDC' }),
  b('Chiweenie', 'Mixed', 'toy', [5, 12], [6, 10], [12, 16], 3, 'SL', 'm', 7, 'Feisty|Loyal|Playful|Vocal', 'Burrows in blankets|Barks at strangers', ['ivdd', 'dental', 'patella', 'hypogly'], { a: ['Chihuahua Dachshund Mix'] }),
  b('Cockapoo', 'Mixed', 'small', [12, 24], [10, 15], [12, 15], 3, 'CV', 'l', 2, 'Affectionate|Cheerful|Smart|Gentle', 'Velcro dog|Loves fetch and cuddles', ['ear', 'eye', 'patella', 'allergy'], { a: ['Cockerpoo', 'Spoodle', 'Cock-a-poo'], g: 'KDC' }),
  b('Goldador', 'Mixed', 'large', [60, 80], [22, 24], [10, 12], 4, 'SD', 'h', 3, 'Friendly|Gentle|Eager|Smart', 'Loves fetch and swimming|Food-motivated', ['hd', 'obesity', 'cancer', 'eye'], { a: ['Golden Labrador', 'Golden Lab Mix'], g: 'KDC' }),
  b('Goldendoodle', 'Mixed', 'medium', [25, 90], [14, 26], [10, 15], 4, 'CV', 'l', 2, 'Friendly|Smart|Playful|Social', 'Loves people and may jump to greet|Loves water and fetch', ['hd', 'eye', 'allergy', 'ear', 'addison'], { a: ['Groodle', 'Golden Doodle', 'Mini Goldendoodle', 'Doodle'], g: 'KDC' }),
  b('Labradoodle', 'Mixed', 'medium', [25, 65], [14, 24], [12, 14], 4, 'CV', 'l', 2, 'Friendly|Clever|Energetic|Affectionate', 'Loves to fetch and swim|Can be bouncy and jumpy', ['hd', 'eye', 'allergy', 'ear', 'addison'], { a: ['Australian Labradoodle', 'Mini Labradoodle'], g: 'KDC' }),
  b('Lurcher', 'Mixed', 'large', [35, 70], [22, 28], [12, 15], 3, 'SW', 'm', 7, 'Gentle|Affectionate|Laid-back|Athletic', 'Sprints then sleeps|Chases small animals', ['anesth', 'cold', 'cruciate'], { g: 'Kc' }),
  b('Maltipoo', 'Mixed', 'toy', [5, 20], [8, 14], [12, 15], 3, 'CV', 'l', 2, 'Affectionate|Gentle|Playful|Smart', 'Lap dog that barks at visitors|Tear staining', ['patella', 'dental', 'trachea', 'eye'], { a: ['Moodle', 'Maltepoo'], g: 'KDC' }),
  b('Morkie', 'Mixed', 'toy', [4, 12], [6, 10], [10, 14], 3, 'KL', 'l', 2, 'Affectionate|Bold|Playful|Vocal', 'Barks to alert|Loves laps', ['patella', 'trachea', 'dental', 'hypogly'], { a: ['Yorktese', 'Maltese Yorkie Mix'] }),
  b('Pit Bull / Bully Mix', 'Mixed', 'medium', [35, 70], [17, 21], [12, 16], 4, 'S', 'l', 7, 'Affectionate|Loyal|Playful|Strong', 'Very people-oriented|Strong chewer|May be selective with other dogs', ['allergy', 'hd', 'cruciate', 'thyroid'], { a: ['Pit Mix', 'Pitbull Mix', 'Bully Mix', 'Pit Bull Mix'] }),
  b('Pomsky', 'Mixed', 'small', [20, 30], [10, 15], [12, 15], 4, 'D', 'h', 3, 'Playful|Smart|Vocal|Stubborn', 'Talkative and may howl|Escape artist', ['patella', 'dental', 'eye', 'hip'], { a: ['Pomeranian Husky'] }),
  b('Poochon', 'Mixed', 'small', [6, 18], [9, 15], [12, 15], 3, 'C', 'l', 2, 'Playful|Friendly|Smart|Cheerful', 'Loves attention|Bouncy', ['patella', 'dental', 'allergy'], { a: ['Bichpoo', 'Bichon Poodle'], g: 'KDC' }),
  b('Puggle', 'Mixed', 'small', [15, 30], [10, 15], [10, 15], 4, 'S', 'h', 7, 'Friendly|Curious|Playful|Vocal', 'Follows its nose and may howl|Gains weight easily', ['obesity', 'ear', 'patella', 'eye'], { g: 'KD' }),
  b('Schnoodle', 'Mixed', 'small', [10, 20], [10, 15], [13, 17], 4, 'VC', 'l', 3, 'Smart|Loyal|Playful|Alert', 'Alert barker|Loves games', ['pancreatitis', 'eye', 'patella', 'diabetes'], { a: ['Schnauzer Poodle Mix'], g: 'KD' }),
  b('Sheepadoodle', 'Mixed', 'large', [25, 80], [16, 22], [12, 15], 3, 'CV', 'l', 2, 'Gentle|Playful|Smart|Social', 'Herds kids gently|Loves to play', ['hd', 'eye', 'ear'], { a: ['Sheep-a-doodle', 'Mini Sheepadoodle'], g: 'KD' }),
  b('Shih-Poo', 'Mixed', 'small', [7, 20], [8, 15], [13, 16], 3, 'CV', 'l', 2, 'Affectionate|Playful|Smart|Friendly', 'Lap dog that loves attention|Can be a barker', ['patella', 'dental', 'eye', 'corneal'], { a: ['Shihpoo', 'Shoodle', 'Shih Poo'], g: 'KD' }),
  b('Shorkie', 'Mixed', 'toy', [7, 15], [6, 10], [12, 15], 3, 'KL', 'l', 2, 'Spunky|Affectionate|Brave|Vocal', 'Lap dog and alert barker|Bold with big dogs', ['patella', 'dental', 'trachea', 'corneal'], { a: ['Shorkie Tzu', 'Yorkie Shih Tzu Mix'] }),
  b('Yorkipoo', 'Mixed', 'toy', [3, 14], [7, 15], [10, 15], 3, 'KV', 'l', 2, 'Affectionate|Smart|Lively|Vocal', 'Barks at visitors|Loves learning tricks', ['patella', 'dental', 'trachea', 'legg'], { a: ['Yorkiepoo', 'Yorkie-poo', 'Yorkie Poo'] }),
];

export const BREEDS: BreedInfo[] = RAW.slice().sort((x, y) => x.name.localeCompare(y.name));

export const BREED_NAMES: string[] = Array.from(new Set([...BREEDS.map((x) => x.name), 'Mixed Breed', 'Other / custom']))
  .sort((x, y) => x.localeCompare(y));

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const LOOKUP = new Map<string, BreedInfo>();
for (const x of BREEDS) if (!LOOKUP.has(norm(x.name))) LOOKUP.set(norm(x.name), x);
for (const x of BREEDS) for (const a of x.aliases ?? []) if (!LOOKUP.has(norm(a))) LOOKUP.set(norm(a), x);

export function findBreed(name: string): BreedInfo | undefined {
  if (!name) return undefined;
  return LOOKUP.get(norm(name));
}

// ---------------------------------------------------------------------------
// Care guide
// ---------------------------------------------------------------------------

const PLAY: Record<BreedGroup, string> = {
  Sporting: 'Fetch, swimming, and retrieving games, plus short training sessions.',
  Hound: 'Sniffing games, scent trails, and hide-and-seek with treats; use a long line or fenced area.',
  Working: 'Purposeful activities like tug, carrying a pack, cart pulling, and obedience games.',
  Terrier: 'Tug, flirt poles, a digging box, and chase-the-toy games.',
  Toy: 'Short indoor play with small toys, gentle fetch, and trick training.',
  'Non-Sporting': 'A mix of fetch, puzzle toys, and short training games.',
  Herding: 'Herding-style games, fetch, agility, and puzzle feeders; daily brain work matters as much as running.',
  Miscellaneous: 'Daily play such as fetch, tug, and food puzzles, matched to the dog\'s energy.',
  Mixed: 'Daily play such as fetch, tug, and food puzzles, matched to the dog\'s energy.',
};

function groomingText(b0: BreedInfo | undefined): string {
  if (!b0) return `Brush weekly, trim nails every 3${EN}4 weeks, and check ears and teeth regularly.`;
  const n = b0.groomingEveryDays;
  const base = n <= 1 ? 'Brush daily' : n < 7 ? `Brush every ${n} days` : n === 7 ? 'Brush weekly' : n % 7 === 0 ? `Brush or check the coat every ${n / 7} weeks` : `Brush about every ${n} days`;
  const c = b0.coat;
  const notes: string[] = [];
  if (c.includes('Hairless')) notes.push('Hairless skin needs dog-safe sunscreen, gentle baths, and moisturizing.');
  if (c.includes('Corded')) notes.push('Separate cords by hand instead of brushing, and dry thoroughly after baths.');
  if (c.includes('Curly')) notes.push(`Plan a professional trim every 4${EN}8 weeks to prevent mats.`);
  if (c.includes('Wire/Broken')) notes.push('Hand-stripping or clipping a few times a year keeps the coat tidy.');
  if (c.includes('Double coat') && b0.shedding === 'high') notes.push('Expect heavy seasonal sheds; an undercoat rake helps.');
  if ((c.includes('Long') || c.includes('Silky')) && !c.includes('Corded')) notes.push('Comb down to the skin to prevent mats, especially behind the ears.');
  if (notes.length === 0 && c.includes('Smooth/Short')) notes.push('A rubber curry brush removes loose hair.');
  return `${base}. ${notes.slice(0, 2).join(' ')} Trim nails every 3${EN}4 weeks.`.replace(/\s+/g, ' ').trim();
}

const round10 = (n: number) => Math.round(n / 10) * 10;
const quarter = (n: number) => Math.max(0.25, Math.round(n * 4) / 4);

export function careGuide(breed: BreedInfo | undefined, opts: { weightLb?: number; ageYears?: number; neutered?: boolean }): CareGuide {
  const size: SizeClass = breed?.size ?? 'medium';
  const energy: EnergyLevel = breed?.energy ?? 3;
  const keys: HKey[] = breed ? KEYS.get(breed) ?? [] : [];
  const has = (k: HKey) => keys.includes(k);
  const weightLb = opts.weightLb && opts.weightLb > 0 ? opts.weightLb : breed ? (breed.weightLb[0] + breed.weightLb[1]) / 2 : 40;
  const kg = weightLb / 2.20462;
  const rer = 70 * Math.pow(kg, 0.75);
  const age = opts.ageYears;
  const puppy = age !== undefined && age < 1;
  const senior = age !== undefined && !puppy && age >= (size === 'giant' ? 5 : 7);

  let f: R = puppy ? [2.5, 3] : senior ? [1.2, 1.4] : opts.neutered === false ? [1.6, 1.8] : [1.4, 1.6];
  if (energy === 5 && !puppy) f = [f[0] + 0.2, f[1] + 0.2];
  const dailyCalories: R = [round10(rer * f[0]), round10(rer * f[1])];
  const cupsPerDay: R = [quarter(dailyCalories[0] / 380), quarter(dailyCalories[1] / 380)];
  const mealsPerDay = puppy ? 3 : 2;

  const ex: R = breed?.exerciseMinutesPerDay ?? EX_BY_ENERGY[3];
  const walksN = breed?.walksPerDay ?? 2;
  let walks: string;
  if (puppy) walks = 'Several short, gentle walks a day; a common guideline is about 5 minutes per month of age per walk, plus free play.';
  else if (senior) walks = `${walksN} gentler walks a day, about ${r5(ex[0] * 0.7)}${EN}${r5(ex[1] * 0.7)} minutes total, at the dog's own pace`;
  else walks = `${walksN} walks a day, ${ex[0]}${EN}${ex[1]} minutes total`;

  let play = breed ? PLAY[breed.group] : PLAY.Mixed;
  if (has('brachy')) play += ' Keep sessions short and stop before heavy panting.';
  else if (energy === 5) play += ' Aim for at least 30 minutes of active play on top of walks.';

  const tips: string[] = [];
  if (puppy) tips.push(size === 'large' || size === 'giant' ? 'Use a large-breed puppy food so bones and joints grow at a steady pace.' : 'Feed a puppy food until about 12 months (toy and small breeds may switch a little earlier; ask your vet).');
  if (senior) tips.push('Senior dog: book vet checkups every 6 months and watch for stiffness, weight change, or lumps.');
  if (has('bloat')) tips.push('Bloat precautions: feed smaller meals, use a slow feeder, and avoid hard exercise for an hour before and after eating. A swollen belly with unproductive retching is an emergency.');
  if (has('brachy')) tips.push('Flat-faced breed: avoid exercise in heat and humidity, use a harness instead of a collar, and never leave the dog in a warm car.');
  else if (has('heat')) tips.push('Heat-sensitive: exercise in the cool parts of the day and always provide shade and water.');
  if (has('ivdd')) tips.push('Protect the back: use ramps or steps, discourage jumping off furniture, and keep weight lean.');
  if (size === 'giant') tips.push('Joint care: keep a giant dog lean, avoid forced running and lots of stairs while growing, and ask your vet about joint support.');
  if (has('hypogly')) tips.push('Tiny puppies can get low blood sugar: feed small meals often and never let them skip a meal.');
  if (has('trachea')) tips.push('Use a harness instead of a collar to protect the windpipe.');
  if (size === 'toy' || has('dental')) tips.push('Small mouths crowd teeth: brush teeth daily and schedule regular dental checkups.');
  if (breed?.group === 'Herding' && energy >= 4) tips.push('Give daily mental work: training, puzzle feeders, or herding and agility games prevent boredom behaviours.');
  else if (energy === 5) tips.push('High-energy breed: mix running with training and sniff walks to keep both body and brain busy.');
  if (has('mdr1')) tips.push('Ask your vet about MDR1 testing; some common medications can be dangerous for dogs with this gene.');
  if (has('anesth')) tips.push('Remind your vet that sighthounds can be sensitive to some anesthetics.');
  if (breed?.group === 'Hound') tips.push('Strong nose or chase instinct: keep on leash or in a securely fenced area.');
  if (breed?.group === 'Terrier') tips.push('Terriers love to dig and chase: secure the yard and supervise around small pets.');
  if (has('sunburn')) tips.push('Apply dog-safe sunscreen to exposed skin before time outdoors.');
  if (has('cold')) tips.push('Feels the cold: use a coat or sweater in chilly weather.');
  if (has('ear')) tips.push('Check and clean ears weekly, especially after swimming or baths.');
  if (has('skinfold')) tips.push('Wipe and dry skin folds a few times a week.');
  if (has('obesity')) tips.push('Gains weight easily: measure meals, count treats, and check the waistline monthly.');
  if (breed && breed.coat.includes('Double coat') && breed.shedding === 'high') tips.push('Avoid shaving a double coat; it helps protect against both heat and cold.');
  if (has('corneal')) tips.push('Prominent eyes scratch easily: check them daily and see a vet promptly for squinting.');
  if (has('stones')) tips.push('Encourage drinking and give frequent potty breaks.');
  if (has('deaf')) tips.push('Ask about a hearing (BAER) test, especially for puppies.');
  const generic = [
    'Keep vaccines, parasite prevention, and yearly checkups up to date.',
    'Use food puzzles and short training games for mental exercise.',
    'Keep a lean body condition: you should be able to feel the ribs easily.',
  ];
  for (const g of generic) if (tips.length < 3) tips.push(g);

  return {
    dailyCalories,
    mealsPerDay,
    cupsPerDay,
    walks,
    play,
    grooming: groomingText(breed),
    tips: tips.slice(0, 5),
  };
}
