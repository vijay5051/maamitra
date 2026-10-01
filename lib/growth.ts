// Growth maths for Health → Growth & Milestones. Pure functions only.
//
// Reference curves come from data/whoGrowthStandards.ts (official WHO LMS
// tables). Nothing here invents a reading or a target: curves are computed
// from WHO's published L, M, S values, and a child's own measurements are
// only ever grouped, validated and plotted.

import { LMS, WHO_LMS, WHO_MAX_MONTHS, WhoIndicator, WhoSex } from '../data/whoGrowthStandards';
import type { GrowthEntry, KidGrowthMap } from '../store/useGrowthStore';

// ─── LMS maths ─────────────────────────────────────────────────────────────

/** Measurement at z-score `z` for the given LMS row (WHO / Cole's LMS method). */
export function lmsValue([L, M, S]: LMS, z: number): number {
  return Math.abs(L) < 1e-8 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
}

/** z-score of `value` for the given LMS row. */
export function lmsZ([L, M, S]: LMS, value: number): number {
  return Math.abs(L) < 1e-8 ? Math.log(value / M) / S : (Math.pow(value / M, L) - 1) / (L * S);
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26), accurate to ~1e-7. */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

/** z-scores of the percentile lines drawn on the charts. */
export const PERCENTILE_LINES: { p: number; z: number }[] = [
  { p: 3, z: -1.8808 },
  { p: 15, z: -1.0364 },
  { p: 50, z: 0 },
  { p: 85, z: 1.0364 },
  { p: 97, z: 1.8808 },
];

/**
 * WHO LMS row at a (fractional) age in months, linearly interpolated
 * between the monthly rows. Null outside WHO's supported 0–60 month range.
 */
export function lmsAt(indicator: WhoIndicator, sex: WhoSex, ageMonths: number): LMS | null {
  if (!isFinite(ageMonths) || ageMonths < 0 || ageMonths > WHO_MAX_MONTHS) return null;
  const rows = WHO_LMS[indicator][sex];
  const lo = Math.floor(ageMonths);
  const hi = Math.min(WHO_MAX_MONTHS, lo + 1);
  const f = ageMonths - lo;
  const a = rows[lo];
  const b = rows[hi];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** Points of one WHO percentile curve, one per month from 0 to `toMonths` (≤ 60). */
export function whoCurve(indicator: WhoIndicator, sex: WhoSex, z: number, toMonths: number): { x: number; y: number }[] {
  const end = Math.min(WHO_MAX_MONTHS, Math.max(0, Math.floor(toMonths)));
  const rows = WHO_LMS[indicator][sex];
  const out: { x: number; y: number }[] = [];
  for (let m = 0; m <= end; m++) out.push({ x: m, y: lmsValue(rows[m], z) });
  return out;
}

/**
 * Percentile (1–99) of a reading on the WHO chart, or null when WHO has no
 * chart for that age. Descriptive only — callers must not turn it into a
 * verdict about the child.
 */
export function whoPercentile(indicator: WhoIndicator, sex: WhoSex, ageMonths: number, value: number): number | null {
  const row = lmsAt(indicator, sex, ageMonths);
  if (!row || !(value > 0)) return null;
  const p = normalCdf(lmsZ(row, value)) * 100;
  return Math.max(1, Math.min(99, Math.round(p)));
}

// ─── Dates / ages ──────────────────────────────────────────────────────────

/** Local-calendar YYYY-MM-DD for an ISO timestamp or Date. */
export function dateKey(d: string | Date): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/** ISO timestamp at local noon for a YYYY-MM-DD key (noon avoids day-shift across time zones). */
export function isoFromDateKey(key: string): string {
  return new Date(`${key}T12:00:00`).toISOString();
}

/** Fractional age in months at `at`, counted from `dob` (no prematurity correction). */
export function ageMonthsAt(dob: string, at: string): number {
  const ms = new Date(dateKey(at) + 'T12:00:00').getTime() - new Date(dateKey(dob) + 'T12:00:00').getTime();
  return ms / (30.4375 * 86400000);
}

export function formatAge(months: number): string {
  if (months < 0.5) return 'At birth';
  const m = Math.round(months);
  if (m < 24) return `${m} ${m === 1 ? 'month' : 'months'}`;
  const y = Math.floor(m / 12);
  const r = m % 12;
  return r === 0 ? `${y} ${y === 1 ? 'year' : 'years'}` : `${y}y ${r}m`;
}

// ─── Measurement visits ────────────────────────────────────────────────────
// The store keeps weight / height / head as separate entry lists (existing
// data). A "visit" is everything recorded on one calendar day.

export type MeasurePlace = 'home' | 'clinic';
export type LengthMode = 'lying' | 'standing';

export interface Visit {
  /** YYYY-MM-DD — unique per child. */
  date: string;
  weightKg?: number;
  lengthCm?: number;
  headCm?: number;
  lengthMode?: LengthMode;
  place?: MeasurePlace;
  note?: string;
}

/** All of a child's measurement days, oldest first. Routine logs (diaper/sleep) are ignored. */
export function visitsFromGrowth(map: KidGrowthMap | undefined): Visit[] {
  const by = new Map<string, Visit>();
  const take = (list: GrowthEntry[] | undefined, apply: (v: Visit, e: GrowthEntry) => void) => {
    // Entries are stored newest-first; iterate oldest-first so the newest entry of a day wins.
    for (const e of [...(list ?? [])].reverse()) {
      if (typeof e.value !== 'number' || !isFinite(e.value) || !e.at) continue;
      const key = dateKey(e.at);
      const v = by.get(key) ?? { date: key };
      apply(v, e);
      if (e.note) v.note = e.note;
      if (e.place) v.place = e.place;
      by.set(key, v);
    }
  };
  take(map?.weight, (v, e) => { v.weightKg = e.value; });
  take(map?.height, (v, e) => { v.lengthCm = e.value; if (e.lengthMode) v.lengthMode = e.lengthMode; });
  take(map?.head, (v, e) => { v.headCm = e.value; });
  return Array.from(by.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Latest recorded value (and its date) for one measure. */
export function latestOf(visits: Visit[], key: 'weightKg' | 'lengthCm' | 'headCm'): { value: number; date: string } | null {
  for (let i = visits.length - 1; i >= 0; i--) {
    const v = visits[i][key];
    if (typeof v === 'number') return { value: v, date: visits[i].date };
  }
  return null;
}

// ─── Validation ────────────────────────────────────────────────────────────

/** Plausible human ranges — these catch typos / wrong units, they are not growth targets. */
export const LIMITS = {
  weightKg: { min: 0.3, max: 80 },
  lengthCm: { min: 20, max: 180 },
  headCm: { min: 15, max: 65 },
} as const;

/** Parse "7.2", "7,2", " 7.20 kg" → 7.2. Empty → undefined. Garbage → NaN. */
export function parseMeasure(input: string): number | undefined {
  const t = input.trim().toLowerCase().replace(/(kg|cm)\s*$/, '').trim().replace(',', '.');
  if (!t) return undefined;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

export interface VisitDraft {
  date: string; // YYYY-MM-DD
  weight: string;
  length: string;
  head: string;
}

export interface VisitErrors {
  date?: string;
  weight?: string;
  length?: string;
  head?: string;
  form?: string;
}

/**
 * Validate a measurement form. Partial entries are fine — at least one of
 * the three values is required. `todayKey` is injectable for tests.
 */
export function validateVisit(draft: VisitDraft, dob: string | null | undefined, todayKey: string = dateKey(new Date())): VisitErrors {
  const errors: VisitErrors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || isNaN(new Date(draft.date + 'T12:00:00').getTime())) {
    errors.date = 'Pick the date of the measurement.';
  } else if (draft.date > todayKey) {
    errors.date = 'That date is in the future.';
  } else if (dob && draft.date < dateKey(dob)) {
    errors.date = 'That date is before the date of birth.';
  }
  const check = (raw: string, lim: { min: number; max: number }, unit: string, hint: string): string | undefined => {
    const n = parseMeasure(raw);
    if (n === undefined) return undefined;
    if (isNaN(n)) return `Enter a number in ${unit}.`;
    if (n < lim.min || n > lim.max) return `That doesn’t look right for ${unit}. ${hint}`;
    return undefined;
  };
  errors.weight = check(draft.weight, LIMITS.weightKg, 'kg', 'Check it’s in kilograms, e.g. 7.2 (not grams or pounds).');
  errors.length = check(draft.length, LIMITS.lengthCm, 'cm', 'Check it’s in centimetres, e.g. 68 (not inches).');
  errors.head = check(draft.head, LIMITS.headCm, 'cm', 'Check it’s in centimetres, e.g. 43.');
  if ([draft.weight, draft.length, draft.head].every((v) => parseMeasure(v) === undefined)) {
    errors.form = 'Add at least one measurement.';
  }
  (Object.keys(errors) as (keyof VisitErrors)[]).forEach((k) => { if (!errors[k]) delete errors[k]; });
  return errors;
}

// ─── Timeline ──────────────────────────────────────────────────────────────

export interface TimelineMarker {
  months: number;
  label: string;
}

/**
 * Age markers from birth to the child's current age: monthly for the first
 * year, every 3 months to 2 years, every 6 months to 5 years, then yearly.
 * Always ends with the first marker at or after the current age.
 */
export function timelineMarkers(currentAgeMonths: number): TimelineMarker[] {
  const all: number[] = [];
  for (let m = 0; m <= 12; m++) all.push(m);
  for (let m = 15; m <= 24; m += 3) all.push(m);
  for (let m = 30; m <= 60; m += 6) all.push(m);
  for (let m = 72; m <= 216; m += 12) all.push(m);
  const age = Math.max(0, currentAgeMonths);
  const idx = all.findIndex((m) => m >= age);
  const end = idx === -1 ? all.length - 1 : idx;
  return all.slice(0, end + 1).map((m) => ({
    months: m,
    label: m === 0 ? 'Birth' : m < 24 ? `${m} ${m === 1 ? 'month' : 'months'}` : m % 12 === 0 ? `${m / 12} years` : `${Math.floor(m / 12)}½ years`,
  }));
}

/** Index of the marker closest in age to a visit. */
export function markerIndexFor(markers: TimelineMarker[], ageMonths: number): number {
  let best = 0;
  for (let i = 1; i < markers.length; i++) {
    if (Math.abs(markers[i].months - ageMonths) < Math.abs(markers[best].months - ageMonths)) best = i;
  }
  return best;
}

/** visitsByMarker[i] = visits whose age is closest to markers[i], oldest first. */
export function visitsByMarker(markers: TimelineMarker[], visits: Visit[], dob: string): Visit[][] {
  const out: Visit[][] = markers.map(() => []);
  for (const v of visits) {
    const age = ageMonthsAt(dob, isoFromDateKey(v.date));
    if (age < -0.1) continue;
    out[markerIndexFor(markers, Math.max(0, age))].push(v);
  }
  return out;
}
