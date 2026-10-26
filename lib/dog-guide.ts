// Daily reads, life stages and personal goals for each dog, based on breed, age, size, energy
// and what the owner has logged. General guidance only, not veterinary advice.

import { careGuide, findBreed, type BreedInfo, type SizeClass } from './breeds';

export type LifeStage = 'puppy' | 'adolescent' | 'adult' | 'senior';
export type ReadTopic = 'food' | 'health' | 'exercise' | 'training' | 'grooming' | 'behavior' | 'safety';
export const TOPIC_LABELS: Record<ReadTopic, string> = { food: 'Food', health: 'Health', exercise: 'Exercise', training: 'Training', grooming: 'Grooming', behavior: 'Behavior', safety: 'Safety' };

export type DogFacts = {
  name: string; breed: string; birthday?: string; weightLb?: number;
  /** Spayed / neutered: true, false, or unknown. */
  fixed?: boolean;
  /** Free-text signals from the profile: medicine side effects, status tags, notes. */
  flags?: string[];
};

export type Read = {
  id: string; topic: ReadTopic; title: string; body: string;
  stages?: LifeStage[]; sizes?: SizeClass[]; minEnergy?: number; maxEnergy?: number; groups?: string[]; flags?: string[];
  link?: { label: string; url: string };
};

export function ageInMonths(birthday?: string, now = new Date()) {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}/.test(birthday)) return undefined;
  const b = new Date(`${birthday.slice(0, 10)}T12:00:00`);
  const m = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth()) - (now.getDate() < b.getDate() ? 1 : 0);
  return Math.max(0, m);
}

export function lifeStage(months: number | undefined, size: SizeClass = 'medium'): LifeStage {
  if (months === undefined) return 'adult';
  const grownAt = size === 'giant' ? 18 : size === 'large' ? 15 : 12;
  if (months < grownAt) return 'puppy';
  if (months < 24) return 'adolescent';
  const seniorAt = size === 'giant' ? 72 : size === 'large' ? 84 : size === 'medium' ? 96 : 120;
  return months >= seniorAt ? 'senior' : 'adult';
}

export const STAGE_LABELS: Record<LifeStage, string> = { puppy: 'Puppy', adolescent: 'Young adult', adult: 'Adult', senior: 'Senior' };

const READS: Read[] = [
  // Food
  { id: 'food-measure', topic: 'food', title: 'Measure every meal', body: 'Use a measuring cup or kitchen scale instead of eyeballing. Small daily overfeeding adds up to pounds over a year. Treats should stay under about 10% of daily calories.', link: { label: 'AKC: How Much Should I Feed My Dog?', url: 'https://www.akc.org/expert-advice/nutrition/how-much-should-i-feed-my-dog/' } },
  { id: 'food-body-score', topic: 'food', title: 'Check the waistline monthly', body: 'You should feel the ribs easily under a thin layer, and see a waist from above. If not, trim portions a little and recheck in a month. Your vet can show you a body condition score.', link: { label: 'AKC: How to Check Your Dog\'s Body Condition Score', url: 'https://www.akc.org/expert-advice/health/check-dogs-body-condition-score/' } },
  { id: 'food-switch', topic: 'food', title: 'Change food slowly', body: 'Switch foods over 7 to 10 days: mix a little more new food with the old each day. Sudden changes are a common cause of upset stomachs.', link: { label: 'AKC: How to Switch Dog Foods', url: 'https://www.akc.org/expert-advice/nutrition/right-way-switch-dog-foods/' } },
  { id: 'food-puppy', topic: 'food', title: 'Growing dogs eat more often', body: 'Puppies usually do best on three meals a day until about six months, then two. Feed a food labelled for growth (or all life stages).', stages: ['puppy'], link: { label: 'AKC: Puppy Feeding Fundamentals', url: 'https://www.akc.org/expert-advice/nutrition/puppy-feeding-fundamentals/' } },
  { id: 'food-large-puppy', topic: 'food', title: 'Large-breed puppy food matters', body: 'Large and giant puppies should eat a large-breed puppy formula. It controls calcium and calories so bones and joints grow at a steady pace.', stages: ['puppy'], sizes: ['large', 'giant'], link: { label: 'VCA Animal Hospitals: Nutritional Requirements of Large and Giant Breed Puppies', url: 'https://vcahospitals.com/know-your-pet/nutritional-requirements-of-large-and-giant-breed-puppies' } },
  { id: 'food-senior', topic: 'food', title: 'Senior appetite changes', body: 'Older dogs often need fewer calories but just as much protein. Sudden changes in appetite, thirst or weight are worth a vet visit.', stages: ['senior'], link: { label: 'VCA Animal Hospitals: Feeding Mature and Senior Dogs', url: 'https://vcahospitals.com/know-your-pet/feeding-mature-and-senior-dogs' } },
  { id: 'food-toxic', topic: 'food', title: 'Foods to keep out of reach', body: 'Grapes and raisins, chocolate, onions and garlic, xylitol (in some gum, peanut butters and baked goods), macadamia nuts and cooked bones are common dangers. Call your vet or a pet poison line right away if eaten.', link: { label: 'ASPCA: People Foods to Avoid Feeding Your Pets', url: 'https://www.aspca.org/pet-care/aspca-poison-control/people-foods-avoid-feeding-your-pets' } },
  { id: 'food-slow', topic: 'food', title: 'Fast eaters', body: 'Slow-feeder bowls, snuffle mats and puzzle feeders slow gulping and add brain work to every meal.', minEnergy: 4, link: { label: 'AKC: How to Help Your Dog Eat More Slowly', url: 'https://www.akc.org/expert-advice/nutrition/slow-your-dogs-eating/' } },
  { id: 'food-water-aversion', topic: 'food', title: 'When a dog avoids the water bowl', body: 'Some dogs link a bowl or a spot with something scary or unpleasant. Try a different bowl (ceramic or glass, wide and shallow), a new spot in a quiet room, a pet fountain, or water from a cup. Keep it calm and low pressure, and tell your vet if drinking drops off.', flags: ['bowl', 'water', 'skittish', 'fear'], link: { label: 'PetMD: Dog Not Drinking Water? Possible Causes and When To Call Your Vet', url: 'https://www.petmd.com/dog/symptoms/dog-not-drinking-water' } },
  // Health
  { id: 'health-preventives', topic: 'health', title: 'Ask about preventives', body: 'Heartworm, flea and tick prevention needs depend on where you live and how your dog spends time outside. Your vet can tell you what is right and how often.', link: { label: 'American Heartworm Society: Heartworm Basics', url: 'https://www.heartwormsociety.org/pet-owner-resources/heartworm-basics' } },
  { id: 'health-ticks', topic: 'health', title: 'Tick checks after walks', body: 'Run your hands over ears, neck, armpits, belly and between toes after woodsy or grassy walks. Remove ticks with fine tweezers close to the skin and note the date.', link: { label: 'CDC: Preventing Ticks on Pets', url: 'https://www.cdc.gov/ticks/prevention/preventing-ticks-on-pets.html' } },
  { id: 'health-lyme', topic: 'health', title: 'After a Lyme diagnosis', body: 'Keep a log of energy, limping, appetite and behavior during and after treatment. Ask your vet about follow-up testing and tick prevention. If a medicine seems to cause side effects, call the vet before stopping or changing it when you can.', flags: ['lyme'], link: { label: 'VCA Animal Hospitals: Lyme Disease in Dogs', url: 'https://vcahospitals.com/know-your-pet/lyme-disease-in-dogs' } },
  { id: 'health-side-effects', topic: 'health', title: 'Tracking medicine side effects', body: 'Write down what you saw, when it started, and whether it eased after the medicine stopped. Bring the notes to every visit so your vet can choose a different option next time.', flags: ['side effect', 'stopped_side_effects'], link: { label: 'FDA: How to Report Animal Drug Side Effects', url: 'https://www.fda.gov/animal-veterinary/report-problem/how-report-animal-drug-and-device-side-effects-and-product-problems' } },
  { id: 'health-teeth', topic: 'health', title: 'Teeth count too', body: 'Most adult dogs show some dental disease by age three. Brushing a few times a week with dog toothpaste is the best home care. Bad breath, red gums or dropping food are signs to book a check.', link: { label: 'AKC: How to Brush Your Dog\'s Teeth', url: 'https://www.akc.org/expert-advice/health/how-brush-dog-teeth/' } },
  { id: 'health-senior-visits', topic: 'health', title: 'Twice-yearly checkups', body: 'Senior dogs change faster. Many vets suggest visits every six months with bloodwork, so problems are caught early.', stages: ['senior'], link: { label: 'VCA Animal Hospitals: Senior Dog Care', url: 'https://vcahospitals.com/know-your-pet/senior-dog-care' } },
  { id: 'health-vaccines-puppy', topic: 'health', title: 'Puppy vaccine series', body: 'Puppies need a series of core vaccines a few weeks apart, then boosters. Keep the dates in Appointments so nothing is missed.', stages: ['puppy'], link: { label: 'AKC: Puppy Vaccination Schedule', url: 'https://www.akc.org/expert-advice/health/puppy-shots-complete-guide/' } },
  { id: 'health-hips', topic: 'health', title: 'Joints and hips', body: 'Bunny-hopping, stiffness after rest or trouble on stairs can be early hip or knee trouble. Keeping a lean weight is the single best thing for joints.', sizes: ['medium', 'large', 'giant'], link: { label: 'AKC: Hip Dysplasia in Dogs', url: 'https://www.akc.org/expert-advice/health/hip-dysplasia-in-dogs/' } },
  { id: 'health-cruciate', topic: 'health', title: 'Knee ligament injuries', body: 'Strong, active dogs can tear a knee ligament (CCL). Sudden limping on a back leg after play is the classic sign. Warm-ups and steady fitness help more than weekend-only bursts.', flags: ['cruciate'], link: { label: 'VCA Animal Hospitals: Cruciate Ligament Rupture in Dogs', url: 'https://vcahospitals.com/know-your-pet/cruciate-ligament-rupture-in-dogs' } },
  { id: 'health-allergy', topic: 'health', title: 'Itchy skin and allergies', body: 'Licking paws, rubbing the face, or ear infections that keep coming back often point to allergies. Note when it flares (season, food, place) and share it with your vet.', flags: ['allergy'], link: { label: 'AKC: Dog Allergies: What You Need to Know', url: 'https://www.akc.org/expert-advice/health/dog-allergies/' } },
  // Exercise
  { id: 'ex-sniff', topic: 'exercise', title: 'Sniff walks tire the brain', body: 'Let your dog sniff for part of each walk. Ten minutes of nose work can be as tiring as a much longer brisk walk, and it lowers stress.', link: { label: 'AKC: 3 Ways To Improve Your Dog\'s Walk', url: 'https://www.akc.org/expert-advice/training/improve-your-dogs-walk/' } },
  { id: 'ex-puppy', topic: 'exercise', title: 'Puppy exercise in short bursts', body: 'Several short walks and free play beat one long hike. Avoid forced running and lots of jumping while bones are growing.', stages: ['puppy'], link: { label: 'AKC: How Much Exercise Does a Puppy Need?', url: 'https://www.akc.org/expert-advice/health/puppies-mental-physical-exercise/' } },
  { id: 'ex-high', topic: 'exercise', title: 'High-energy days', body: 'Mix activities: a walk, a fetch or tug session, and a short training game. Variety keeps an energetic dog satisfied without endless miles.', minEnergy: 4, link: { label: 'AKC: Fun Ways to Stay Active With Your Dog', url: 'https://www.akc.org/expert-advice/health/ways-to-stay-active-with-your-dog/' } },
  { id: 'ex-senior', topic: 'exercise', title: 'Gentle movement for seniors', body: 'Shorter, more frequent walks on soft ground keep older joints moving. Watch for lagging behind or slowing at the end of a walk.', stages: ['senior'], link: { label: 'AKC: How to Provide Your Senior Dog With Proper Exercise', url: 'https://www.akc.org/expert-advice/health/provide-senior-dog-proper-exercise/' } },
  { id: 'ex-heat', topic: 'exercise', title: 'Hot pavement test', body: 'Hold the back of your hand on the pavement for 7 seconds. If it is too hot for you, it is too hot for paws. Walk early or late on hot days.', link: { label: 'AKC: How to Protect Dog Paws From Hot Pavement', url: 'https://www.akc.org/expert-advice/health/dog-paws-hot-pavement/' } },
  { id: 'ex-flirt', topic: 'exercise', title: 'Flirt poles and tug', body: 'Strong, driven dogs love a flirt pole or tug with rules: wait, take it, and drop it. It burns energy fast and builds impulse control.', groups: ['Terrier', 'Working'], link: { label: 'AKC: How to Play Tug-of-War Safely With Your Dog', url: 'https://www.akc.org/expert-advice/advice/is-tug-of-war-bad-for-dogs/' } },
  { id: 'ex-low', topic: 'exercise', title: 'Easy-going dogs still need walks', body: 'Lower-energy breeds still need daily walks and play to stay fit and avoid weight gain. Two relaxed walks and a short game are a good baseline.', maxEnergy: 2, link: { label: 'AKC: How Much Exercise Does a Dog Need?', url: 'https://www.akc.org/expert-advice/health/how-much-exercise-does-dog-need/' } },
  // Training
  { id: 'tr-short', topic: 'training', title: 'Train in 5-minute bursts', body: 'Two or three short sessions a day work better than one long one. End on an easy win so your dog looks forward to the next session.', link: { label: 'AKC: Dog Training Ideas for Busy People', url: 'https://www.akc.org/expert-advice/training/dog-training-for-busy-people/' } },
  { id: 'tr-recall', topic: 'training', title: 'Build a reliable recall', body: 'Practice "come" in a quiet room first with a great treat, then add distance and distractions slowly. Never call your dog to something unpleasant.', link: { label: 'AKC: Reliable Recall: Teaching Your Dog to Come When Called', url: 'https://www.akc.org/expert-advice/training/reliable-recall-train-dogs-to-come-when-called/' } },
  { id: 'tr-social', topic: 'training', title: 'Socialization window', body: 'Gentle, positive meetings with new people, sounds, surfaces and calm dogs now shape confidence for life. Go at your puppy\'s pace.', stages: ['puppy'], link: { label: 'AKC: Puppy Socialization: How to Socialize a Puppy', url: 'https://www.akc.org/expert-advice/training/puppy-socialization/' } },
  { id: 'tr-teen', topic: 'training', title: 'The teenage phase', body: 'Between about 6 and 24 months many dogs "forget" cues and test limits. Keep training sessions short and fun; it passes faster with consistency.', stages: ['adolescent'], link: { label: 'AKC: Your Adolescent Puppy and Changes to Expect', url: 'https://www.akc.org/expert-advice/health/adolescent-puppy-changes/' } },
  { id: 'tr-loose-leash', topic: 'training', title: 'Loose-leash walking', body: 'Stop when the leash goes tight and move on when it is loose. Reward often at your side. Strong pullers may do better on a front-clip harness.', sizes: ['medium', 'large', 'giant'], link: { label: 'AKC: Leash Training: How to Train a Dog to Walk on a Leash', url: 'https://www.akc.org/expert-advice/training/teach-puppy-walk-leash/' } },
  { id: 'tr-dog-selective', topic: 'training', title: 'Dog-selective dogs', body: 'Some breeds are choosy about other dogs. Give space on walks, keep greetings short, and reward calm looking. It is fine for your dog not to greet every dog.', groups: ['Terrier'], link: { label: 'AKC: Understanding the Scale of Dog Selectivity', url: 'https://www.akc.org/expert-advice/training/understanding-scale-dog-selectivity/' } },
  { id: 'tr-fear', topic: 'behavior', title: 'Helping a skittish dog', body: 'Let your dog choose to approach scary things; never drag them closer. Pair the scary spot with great things from a distance (a treat, a favorite toy), then move a step closer over days. A vet or certified behaviorist can help if fear lasts.', flags: ['skittish', 'fear', 'anxious', 'reactive'], link: { label: 'AKC: How to Train a Fearful Dog', url: 'https://www.akc.org/expert-advice/training/how-to-train-fearful-dog/' } },
  { id: 'beh-enrich', topic: 'behavior', title: 'Five-minute enrichment', body: 'Scatter part of a meal in the grass, stuff a lick mat, or hide treats in a towel. Mental work curbs chewing, barking and restlessness.', link: { label: 'AKC: Brain Games for Dogs', url: 'https://www.akc.org/expert-advice/health/fun-cognitive-training-games-for-dogs/' } },
  { id: 'beh-alone', topic: 'behavior', title: 'Time alone', body: 'Practice short departures and calm returns. A food toy when you leave helps your dog link alone time with good things.', link: { label: 'ASPCA: Separation Anxiety', url: 'https://www.aspca.org/pet-care/dog-care/common-dog-behavior-issues/separation-anxiety' } },
  { id: 'beh-senior-mind', topic: 'behavior', title: 'Keep an older mind busy', body: 'Easy new tricks, scent games and new walking routes help older dogs stay sharp. Night-time restlessness or getting stuck in corners is worth mentioning to your vet.', stages: ['senior'], link: { label: 'University of Illinois Vet Med: Canine Cognitive Dysfunction', url: 'https://vetmed.illinois.edu/pet-health-columns/canine-cognitive-dysfunction/' } },
  // Grooming
  { id: 'gr-nails', topic: 'grooming', title: 'Nail trims', body: 'If you hear clicking on the floor, nails are too long. Trim a little every 2 to 4 weeks; a grinder is easier for many owners.', link: { label: 'AKC: How to Trim Your Dog\'s Nails at Home', url: 'https://www.akc.org/expert-advice/health/how-to-trim-dogs-nails-safely/' } },
  { id: 'gr-ears', topic: 'grooming', title: 'Ear checks', body: 'Look and sniff weekly. Redness, a yeasty smell or head shaking are signs of infection.', link: { label: 'AKC: How to Clean a Dog\'s Ears Safely', url: 'https://www.akc.org/expert-advice/health/how-to-clean-dogs-ears/' } },
  { id: 'gr-short-coat', topic: 'grooming', title: 'Short coats shine with brushing', body: 'A rubber curry brush once a week pulls out loose hair and spreads skin oils. It is also a calm bonding routine.', flags: ['short'], link: { label: 'AKC: Dog Grooming at Home', url: 'https://www.akc.org/expert-advice/health/dog-grooming-at-home/' } },
  // Safety
  { id: 'sa-tag', topic: 'safety', title: 'Keep the tag current', body: 'Check that your phone number and the tag scan page are up to date. Most lost dogs who get home quickly were wearing ID.', link: { label: 'AKC: Properly Identify Your Dog Today', url: 'https://www.akc.org/press-releases/properly-identify-your-dog-today/' } },
  { id: 'sa-chip', topic: 'safety', title: 'Microchip registration', body: 'A chip only helps if the registry has your current details. Renew or update after a move or a new phone number.', flags: ['microchip'], link: { label: 'AKC: How Dog Microchips Work', url: 'https://www.akc.org/expert-advice/lifestyle/how-do-dog-microchips-work/' } },
  { id: 'sa-car', topic: 'safety', title: 'Cars heat up fast', body: 'Even on a mild day a parked car can get dangerously hot in minutes. Never leave your dog in a parked car.', link: { label: 'AKC: Can I Leave My Dog in the Car?', url: 'https://www.akc.org/expert-advice/health/dogs-in-hot-cars/' } },
  { id: 'sa-strong', topic: 'safety', title: 'Strong dog gear', body: 'Powerful dogs need gear that fits well: check collar and harness buckles monthly and use a leash rated for their weight.', sizes: ['large', 'giant'], minEnergy: 4, link: { label: 'AKC: How to Find the Right Dog Harness', url: 'https://www.akc.org/expert-advice/training/choosing-the-right-dog-harness/' } },
];

// Stable daily pick: same dog, same day, same list; it changes tomorrow.
function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

export type DogProfile = { facts: DogFacts; breed?: BreedInfo; months?: number; stage: LifeStage; size: SizeClass; energy: number; flagText: string };

export function profileFor(facts: DogFacts, now = new Date()): DogProfile {
  const breed = findBreed(facts.breed);
  const months = ageInMonths(facts.birthday, now);
  const size = breed?.size ?? (facts.weightLb ? (facts.weightLb < 12 ? 'toy' : facts.weightLb < 25 ? 'small' : facts.weightLb < 55 ? 'medium' : facts.weightLb < 90 ? 'large' : 'giant') : 'medium');
  const breedFlags = breed ? [...breed.healthWatch, ...breed.coat, ...breed.temperament, ...breed.habits].join(' ') : '';
  return { facts, breed, months, stage: lifeStage(months, size), size, energy: breed?.energy ?? 3, flagText: `${(facts.flags || []).join(' ')} ${breedFlags}`.toLowerCase() };
}

function relevance(read: Read, dog: DogProfile) {
  if (read.stages && !read.stages.includes(dog.stage)) return -1;
  if (read.sizes && !read.sizes.includes(dog.size)) return -1;
  if (read.minEnergy && dog.energy < read.minEnergy) return -1;
  if (read.maxEnergy && dog.energy > read.maxEnergy) return -1;
  if (read.groups && !(dog.breed && read.groups.includes(dog.breed.group))) return -1;
  let score = 1;
  if (read.flags) { if (!read.flags.some((f) => dog.flagText.includes(f))) return -1; score += 4; }
  if (read.stages) score += 2;
  if (read.sizes || read.groups || read.minEnergy || read.maxEnergy) score += 1;
  return score;
}

/** Breed page links for the reader (only for recognised breeds). */
export function breedResources(dog: DogProfile): Read[] {
  if (!dog.breed) return [];
  const slug = dog.breed.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const watch = dog.breed.warningSigns.slice(0, 3).join('; ');
  return [{
    id: `breed-${slug}`, topic: 'health', title: `${dog.breed.name}: what to watch for`,
    body: `${dog.breed.temperament.slice(0, 3).join(', ')}. Common health watch-outs: ${dog.breed.healthWatch.slice(0, 4).join(', ')}.${watch ? ` See a vet for: ${watch}.` : ''}`,
    link: { label: `AKC ${dog.breed.name} breed guide`, url: `https://www.akc.org/dog-breeds/${slug}/` },
  }];
}

/** Today's reads: a few relevant picks from different topics, never the same set two days running. */
export function dailyReads(facts: DogFacts, count = 3, now = new Date(), done: string[] = []): Read[] {
  const dog = profileFor(facts, now);
  const day = now.toISOString().slice(0, 10);
  const rand = seeded(`${facts.name}|${facts.breed}|${day}`);
  const pool = [...READS, ...breedResources(dog)]
    .map((r) => ({ r, s: relevance(r, dog) }))
    .filter((x) => x.s > 0)
    // Unread and highly relevant first, with a daily shuffle so it varies.
    .map((x) => ({ ...x, k: x.s + (done.includes(x.r.id) ? -3 : 0) + rand() * 3 }))
    .sort((a, b) => b.k - a.k);
  const picks: Read[] = [];
  const topics = new Set<ReadTopic>();
  for (const { r } of pool) { if (picks.length >= count) break; if (topics.has(r.topic)) continue; topics.add(r.topic); picks.push(r); }
  return picks;
}

export function allReadsFor(facts: DogFacts, now = new Date()) {
  const dog = profileFor(facts, now);
  return [...breedResources(dog), ...READS.filter((r) => relevance(r, dog) > 0)];
}

/** A short, calm set of recommendations from the breed care guide (one line each). */
export function recommendations(facts: DogFacts, now = new Date()) {
  const dog = profileFor(facts, now);
  const g = careGuide(dog.breed, { weightLb: facts.weightLb, ageYears: dog.months !== undefined ? dog.months / 12 : undefined, neutered: facts.fixed });
  const stagePreventive: Record<LifeStage, string> = {
    puppy: 'Puppy vaccine series and boosters; ask about deworming, heartworm, flea and tick prevention.',
    adolescent: 'First-year boosters, plus heartworm, flea and tick prevention your vet recommends.',
    adult: 'Yearly checkup and vaccines on your vet\'s schedule, plus year-round parasite prevention where advised.',
    senior: 'Checkups every 6 months with bloodwork; ask about joint support and dental care.',
  };
  return {
    dog,
    items: [
      { topic: 'food' as ReadTopic, text: `About ${g.dailyCalories[0]}–${g.dailyCalories[1]} calories a day (roughly ${g.cupsPerDay[0]}–${g.cupsPerDay[1]} cups of a typical dry food), split into ${g.mealsPerDay} meals. Check your food's label.` },
      { topic: 'exercise' as ReadTopic, text: g.walks },
      { topic: 'training' as ReadTopic, text: g.play },
      { topic: 'grooming' as ReadTopic, text: g.grooming },
      { topic: 'health' as ReadTopic, text: `Medicine and prevention: ${stagePreventive[dog.stage]} Never give human medicine without asking your vet.` },
    ],
    tips: g.tips.slice(0, 3),
  };
}

// ---------- personal goals & achievements ----------

export type Counters = {
  weeklyMiles: number; walksThisWeek: number; tricksMastered: number; mealsDone: number; playMinutes: number;
  documents: number; profilePercent: number; photos: number; readsTotal: number; readStreak: number; scheduleItems: number; scheduleDoneToday: number;
};

export type PersonalGoal = { id: string; title: string; detail: string; current: number; target: number; unit: string; xp: number; icon: 'walk' | 'read' | 'train' | 'care' | 'profile' | 'play' };

/** Goals tuned to this dog: walking targets from breed energy and age, training by life stage, plus profile and reading goals. */
export function personalGoals(facts: DogFacts, c: Counters, now = new Date()): PersonalGoal[] {
  const dog = profileFor(facts, now);
  const ex = dog.breed?.exerciseMinutesPerDay ?? [45, 90];
  const minutes = dog.stage === 'senior' ? ex[0] * 0.7 : dog.stage === 'puppy' ? Math.min(ex[0], 40) : ex[0];
  // ~20 min per mile at a dog's pace; weekly target rounded to a friendly number.
  const weeklyMiles = Math.max(2, Math.round(((minutes * 7) / 20) / 2) * 2);
  const walksPerWeek = (dog.breed?.walksPerDay ?? 2) * 7;
  const tricks = dog.stage === 'puppy' ? 3 : dog.stage === 'senior' ? 2 : 5;
  const goals: PersonalGoal[] = [
    { id: 'miles', title: `${weeklyMiles} miles this week`, detail: `${dog.breed ? dog.breed.name : 'Dogs like ' + facts.name} at ${STAGE_LABELS[dog.stage].toLowerCase()} age do well with about ${Math.round(minutes)} active minutes a day.`, current: c.weeklyMiles, target: weeklyMiles, unit: 'mi', xp: 80, icon: 'walk' },
    { id: 'walks', title: `${walksPerWeek} walks this week`, detail: `${dog.breed?.walksPerDay ?? 2} a day keeps routines steady.`, current: c.walksThisWeek, target: walksPerWeek, unit: 'walks', xp: 50, icon: 'walk' },
    { id: 'tricks', title: dog.stage === 'puppy' ? 'Learn 3 puppy basics' : dog.stage === 'senior' ? 'Two gentle new tricks' : `Master ${tricks} cues`, detail: dog.stage === 'puppy' ? 'Sit, name and come are the big three.' : 'Short daily sessions keep the brain busy.', current: c.tricksMastered, target: tricks, unit: 'cues', xp: 75, icon: 'train' },
    { id: 'reads', title: 'Read 7 daily tips', detail: `Picked for ${facts.name}'s breed, age and routine.`, current: c.readsTotal, target: 7, unit: 'reads', xp: 40, icon: 'read' },
    { id: 'schedule', title: 'Keep a daily schedule', detail: 'Add meals, walks or medicine to the schedule and tick them off.', current: Math.min(c.scheduleItems, 3), target: 3, unit: 'items', xp: 30, icon: 'care' },
    { id: 'profile', title: 'Complete the profile', detail: 'Photos, details, vet and documents all count.', current: c.profilePercent, target: 100, unit: '%', xp: 60, icon: 'profile' },
  ];
  if (dog.energy >= 4) goals.splice(2, 0, { id: 'play', title: '150 play minutes this week', detail: 'High-energy breeds need play on top of walks.', current: c.playMinutes, target: 150, unit: 'min', xp: 50, icon: 'play' });
  return goals;
}

export type Milestone = { id: string; title: string; requirement: string; done: boolean; xp: number };

/** Achievements that differ by breed and life stage, so each dog's list is its own. */
export function personalAchievements(facts: DogFacts, c: Counters, now = new Date()): Milestone[] {
  const dog = profileFor(facts, now);
  const list: Milestone[] = [
    { id: 'first-photo', title: 'Picture perfect', requirement: 'Add a photo of your dog.', done: c.photos > 0, xp: 25 },
    { id: 'paperwork', title: 'Paperwork pro', requirement: 'Upload 3 documents (vaccines, license, insurance).', done: c.documents >= 3, xp: 50 },
    { id: 'profile-100', title: 'All about me', requirement: 'Complete the profile to 100%.', done: c.profilePercent >= 100, xp: 75 },
    { id: 'reader-7', title: 'Bookworm', requirement: 'Read a daily tip 7 days in a row.', done: c.readStreak >= 7, xp: 70 },
    { id: 'routine', title: 'Creature of habit', requirement: 'Finish every scheduled care task today.', done: c.scheduleItems > 0 && c.scheduleDoneToday >= c.scheduleItems, xp: 40 },
  ];
  if (dog.stage === 'puppy') list.push({ id: 'puppy-basics', title: 'Puppy school', requirement: 'Master 3 basic cues.', done: c.tricksMastered >= 3, xp: 80 });
  if (dog.stage === 'adolescent') list.push({ id: 'teen-focus', title: 'Through the teens', requirement: 'Master 5 cues during the teenage months.', done: c.tricksMastered >= 5, xp: 90 });
  if (dog.stage === 'senior') list.push({ id: 'golden-strolls', title: 'Golden strolls', requirement: 'Take 20 gentle walks.', done: c.walksThisWeek >= 20, xp: 80 });
  if (dog.energy >= 4) list.push({ id: 'energizer', title: 'Energy burner', requirement: 'Log 150 play minutes in a week.', done: c.playMinutes >= 150, xp: 70 });
  if (dog.energy <= 2) list.push({ id: 'steady', title: 'Slow and steady', requirement: 'Walk every day for a week.', done: c.walksThisWeek >= 7, xp: 60 });
  if (dog.breed?.group === 'Terrier') list.push({ id: 'terrier-tug', title: 'Tug champion', requirement: 'Teach "drop it" and log 3 tug sessions.', done: c.tricksMastered >= 2 && c.playMinutes >= 30, xp: 60 });
  if (dog.breed?.group === 'Herding') list.push({ id: 'brain-games', title: 'Brainy herder', requirement: 'Master 6 cues or tricks.', done: c.tricksMastered >= 6, xp: 90 });
  if (dog.breed?.group === 'Hound') list.push({ id: 'nose-work', title: 'Nose knows', requirement: 'Log 60 minutes of sniff walks or scent games.', done: c.playMinutes >= 60, xp: 60 });
  if (dog.size === 'large' || dog.size === 'giant') list.push({ id: 'big-miles', title: 'Big dog, big miles', requirement: 'Walk 15 miles in a week.', done: c.weeklyMiles >= 15, xp: 90 });
  return list;
}

// ---------- reading log (per device) ----------

const READ_KEY = 'mypetid.reads';
export type ReadLog = { day: string; id: string }[];

export function getReadLog(): ReadLog {
  if (typeof window === 'undefined') return [];
  try { const v = JSON.parse(localStorage.getItem(READ_KEY) || '[]'); return Array.isArray(v) ? v.slice(-400) : []; } catch { return []; }
}
export function markRead(id: string, now = new Date()) {
  const log = getReadLog();
  const day = now.toISOString().slice(0, 10);
  if (!log.some((x) => x.id === id && x.day === day)) log.push({ day, id });
  try { localStorage.setItem(READ_KEY, JSON.stringify(log.slice(-400))); } catch { /* storage blocked */ }
  window.dispatchEvent(new CustomEvent('mypetid:reads'));
  return log;
}
export function readStreak(log: ReadLog, now = new Date()) {
  const days = new Set(log.map((x) => x.day));
  let streak = 0;
  const d = new Date(now);
  while (days.has(d.toISOString().slice(0, 10))) { streak += 1; d.setDate(d.getDate() - 1); }
  return streak;
}
