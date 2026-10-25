"use client";

import { useMemo } from 'react';
import { careGuide, findBreed, SIZE_LABELS } from '../lib/breeds';
import { Activity, Bowl, Footprints, Heart, Scissors, ShieldCheck, Sparkles } from './icons';

/** Care recommendations for the dog's breed, weight and age (general guidance, not vet advice). */
export function BreedGuide({ breed, weightLb, ageYears }: { breed: string; weightLb?: number; ageYears?: number }) {
  const info = useMemo(() => findBreed(breed || ''), [breed]);
  const guide = useMemo(() => careGuide(info, { weightLb: weightLb && weightLb > 0 ? weightLb : undefined, ageYears }), [info, weightLb, ageYears]);
  const energy = info ? '●'.repeat(info.energy) + '○'.repeat(5 - info.energy) : '';
  return (
    <section className="panel full breedGuide">
      <div className="panelTitleRow"><div><p className="eyebrow">Breed guide</p><h2>{info ? info.name : breed || 'Your dog'}</h2></div><span className="iconBubble"><Sparkles /></span></div>
      {info ? <div className="chipCloud"><span>{info.group} group</span><span>{SIZE_LABELS[info.size]}</span><span>{info.weightLb[0]}–{info.weightLb[1]} lb</span><span>Lives {info.lifespanYears[0]}–{info.lifespanYears[1]} yrs</span><span title="Energy">Energy {energy}</span><span>{info.shedding} shedding</span></div>
        : <p className="formHint">Pick a breed in the profile to see breed-specific tips. Showing general guidance for now.</p>}
      <div className="guideGrid">
        <article className="guideTile"><span className="iconBubble"><Bowl /></span><h3>Feeding</h3><p><strong>{guide.mealsPerDay} meals a day</strong>, about {guide.cupsPerDay[0]}–{guide.cupsPerDay[1]} cups total ({guide.dailyCalories[0]}–{guide.dailyCalories[1]} kcal).</p>{info?.feedingNotes && <p className="formHint">{info.feedingNotes}</p>}</article>
        <article className="guideTile"><span className="iconBubble green"><Footprints /></span><h3>Walks</h3><p>{guide.walks}</p></article>
        <article className="guideTile"><span className="iconBubble blue"><Activity /></span><h3>Play</h3><p>{guide.play}</p></article>
        <article className="guideTile"><span className="iconBubble violet"><Scissors /></span><h3>Grooming</h3><p>{guide.grooming}</p></article>
      </div>
      {info && <div className="guideGrid two">
        <article className="guideTile"><span className="iconBubble"><Heart /></span><h3>Personality & habits</h3><div className="chipCloud">{info.temperament.map((t) => <span key={t}>{t}</span>)}</div><ul>{info.habits.map((h) => <li key={h}>{h}</li>)}</ul></article>
        <article className="guideTile"><span className="iconBubble red"><ShieldCheck /></span><h3>Health to watch</h3><ul>{info.healthWatch.map((h) => <li key={h}>{h}</li>)}</ul><p className="formHint"><strong>See your vet if you notice:</strong> {info.warningSigns.join('; ')}.</p></article>
      </div>}
      {guide.tips.length > 0 && <ul className="checklist guideTips">{guide.tips.map((t) => <li key={t}>{t}</li>)}</ul>}
      <p className="formHint">General guidance from common breed references, not veterinary advice. Your vet knows your dog best.</p>
    </section>
  );
}
