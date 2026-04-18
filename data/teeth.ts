// Primary teeth reference (FDI numbering 51-55, 61-65, 71-75, 81-85).
// Eruption / shed windows from the user's reference (FOGSI / AAP standard ranges).
//
// FDI quadrant codes for primary teeth:
//   5 = upper right, 6 = upper left, 7 = lower left, 8 = lower right
// Position 1..5 within each quadrant runs from the centre of the mouth outward
// (1 = central incisor next to the midline, 5 = second molar at the back).

export type ToothJaw = 'upper' | 'lower';
export type ToothSide = 'left' | 'right';
export type ToothType =
  | 'centralIncisor'
  | 'lateralIncisor'
  | 'canine'
  | 'firstMolar'
  | 'secondMolar';

export interface ToothRef {
  /** FDI two-digit code, e.g. '51'. Stable identifier persisted to Firestore. */
  id: string;
  jaw: ToothJaw;
  side: ToothSide;
  type: ToothType;
  /** Long human-readable name, e.g. "Upper Right Central Incisor". */
  name: string;
  /** Short type label without side, e.g. "Central Incisor". */
  shortName: string;
  /**
   * 1..10 left-to-right position across the jaw arc (used purely as the
   * x-slot for the SVG layout; anatomical side is in `side`).
   *
   * Layout looking at the baby face-on:
   *   left of screen = baby's right, right of screen = baby's left
   * So for the upper jaw, slot 1 maps to FDI 55 (upper right 2nd molar) and
   * slot 10 maps to 65 (upper left 2nd molar). For the lower jaw, slot 1
   * maps to 85 (lower right 2nd molar) and slot 10 maps to 75 (lower left
   * 2nd molar).
   */
  position: number;
  eruptMinMo: number;
  eruptMaxMo: number;
  shedMinYr: number;
  shedMaxYr: number;
}

const TYPE_INFO: Record<ToothType, { short: string; long: string }> = {
  centralIncisor: { short: 'Central Incisor', long: 'Central Incisor' },
  lateralIncisor: { short: 'Lateral Incisor', long: 'Lateral Incisor' },
  canine:         { short: 'Canine',          long: 'Canine' },
  firstMolar:     { short: '1st Molar',       long: 'First Molar' },
  secondMolar:    { short: '2nd Molar',       long: 'Second Molar' },
};

interface RangeRow {
  type: ToothType;
  eruptMinMo: number;
  eruptMaxMo: number;
  shedMinYr: number;
  shedMaxYr: number;
}

const UPPER_RANGES: RangeRow[] = [
  { type: 'centralIncisor', eruptMinMo: 8,  eruptMaxMo: 12, shedMinYr: 6,  shedMaxYr: 7 },
  { type: 'lateralIncisor', eruptMinMo: 9,  eruptMaxMo: 13, shedMinYr: 7,  shedMaxYr: 8 },
  { type: 'canine',         eruptMinMo: 16, eruptMaxMo: 22, shedMinYr: 10, shedMaxYr: 12 },
  { type: 'firstMolar',     eruptMinMo: 13, eruptMaxMo: 19, shedMinYr: 9,  shedMaxYr: 11 },
  { type: 'secondMolar',    eruptMinMo: 25, eruptMaxMo: 33, shedMinYr: 10, shedMaxYr: 12 },
];

const LOWER_RANGES: RangeRow[] = [
  { type: 'centralIncisor', eruptMinMo: 6,  eruptMaxMo: 10, shedMinYr: 6,  shedMaxYr: 7 },
  { type: 'lateralIncisor', eruptMinMo: 10, eruptMaxMo: 16, shedMinYr: 7,  shedMaxYr: 8 },
  { type: 'canine',         eruptMinMo: 17, eruptMaxMo: 23, shedMinYr: 9,  shedMaxYr: 12 },
  { type: 'firstMolar',     eruptMinMo: 14, eruptMaxMo: 18, shedMinYr: 9,  shedMaxYr: 11 },
  { type: 'secondMolar',    eruptMinMo: 23, eruptMaxMo: 31, shedMinYr: 10, shedMaxYr: 12 },
];

function buildJaw(jaw: ToothJaw): ToothRef[] {
  const ranges = jaw === 'upper' ? UPPER_RANGES : LOWER_RANGES;
  const rightQuad = jaw === 'upper' ? 5 : 8; // FDI quadrants 5/8 = right
  const leftQuad  = jaw === 'upper' ? 6 : 7; // FDI quadrants 6/7 = left
  const out: ToothRef[] = [];

  // Right side: slots 1..5 map to baby's right (FDI 5x or 8x), back→front.
  // Slot 1 = 2nd molar (rangeIndex 4), slot 5 = central incisor (rangeIndex 0).
  for (let slot = 1; slot <= 5; slot++) {
    const rangeIndex = 5 - slot; // 4,3,2,1,0
    const r = ranges[rangeIndex];
    const fdiPosition = rangeIndex + 1; // 5,4,3,2,1 within the quadrant
    const id = `${rightQuad}${fdiPosition}`;
    const info = TYPE_INFO[r.type];
    out.push({
      id,
      jaw,
      side: 'right',
      type: r.type,
      name: `${jaw === 'upper' ? 'Upper' : 'Lower'} Right ${info.long}`,
      shortName: info.short,
      position: slot,
      eruptMinMo: r.eruptMinMo,
      eruptMaxMo: r.eruptMaxMo,
      shedMinYr: r.shedMinYr,
      shedMaxYr: r.shedMaxYr,
    });
  }

  // Left side: slots 6..10 map to baby's left (FDI 6x or 7x), front→back.
  // Slot 6 = central incisor (rangeIndex 0), slot 10 = 2nd molar (rangeIndex 4).
  for (let slot = 6; slot <= 10; slot++) {
    const rangeIndex = slot - 6;
    const r = ranges[rangeIndex];
    const fdiPosition = rangeIndex + 1;
    const id = `${leftQuad}${fdiPosition}`;
    const info = TYPE_INFO[r.type];
    out.push({
      id,
      jaw,
      side: 'left',
      type: r.type,
      name: `${jaw === 'upper' ? 'Upper' : 'Lower'} Left ${info.long}`,
      shortName: info.short,
      position: slot,
      eruptMinMo: r.eruptMinMo,
      eruptMaxMo: r.eruptMaxMo,
      shedMinYr: r.shedMinYr,
      shedMaxYr: r.shedMaxYr,
    });
  }

  return out;
}

export const TEETH: ToothRef[] = [...buildJaw('upper'), ...buildJaw('lower')];

export const TOOTH_BY_ID: Record<string, ToothRef> = TEETH.reduce(
  (acc, t) => {
    acc[t.id] = t;
    return acc;
  },
  {} as Record<string, ToothRef>,
);

export function eruptionWindowLabel(t: ToothRef): string {
  return `${t.eruptMinMo}–${t.eruptMaxMo} months`;
}

export function shedWindowLabel(t: ToothRef): string {
  return `${t.shedMinYr}–${t.shedMaxYr} years`;
}
