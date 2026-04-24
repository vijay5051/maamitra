export interface Vaccine {
  id: string;
  name: string;
  shortName: string;
  description: string;
  daysFromBirth: number;
  ageLabel: string;
  category: string;
}

// Vaccine schedule source:
// Indian Academy of Pediatrics (IAP) Advisory Committee on Vaccines and
// Immunization Practices (ACVIP) — Recommended Immunization Schedule (2023),
// published in Indian Pediatrics, Jan 2024 (Rao IS, Kasi SG et al.).
// PII: S097475591600592.
//
// Each vaccine is its own entry so parents can log the exact date of each
// jab independently — vaccines given at the same visit in practice are
// sometimes spread across different days.

export const VACCINE_SCHEDULE: Vaccine[] = [
  // ─── Birth ─────────────────────────────────────────────────────────────────
  {
    id: 'iap-bcg',
    name: 'BCG',
    shortName: 'BCG',
    description: 'Protects against tuberculosis. Given before discharge.',
    daysFromBirth: 0,
    ageLabel: 'Birth',
    category: 'Birth',
  },
  {
    id: 'iap-opv-0',
    name: 'OPV-0 (Birth dose)',
    shortName: 'OPV 0',
    description: 'Oral polio vaccine, given as soon as possible after birth.',
    daysFromBirth: 0,
    ageLabel: 'Birth',
    category: 'Birth',
  },
  {
    id: 'iap-hepb-1',
    name: 'Hepatitis B — 1',
    shortName: 'Hep B 1',
    description: 'First Hep B dose, ideally within 24 hours of birth.',
    daysFromBirth: 0,
    ageLabel: 'Birth',
    category: 'Birth',
  },

  // ─── 6 weeks ──────────────────────────────────────────────────────────────
  {
    id: 'iap-dtp-1',
    name: 'DTwP / DTaP — 1',
    shortName: 'DTP 1',
    description: 'Diphtheria, tetanus and pertussis — primary dose 1.',
    daysFromBirth: 42,
    ageLabel: '6 weeks',
    category: 'Primary Series',
  },
  {
    id: 'iap-ipv-1',
    name: 'IPV — 1',
    shortName: 'IPV 1',
    description: 'Injectable polio vaccine, primary dose 1.',
    daysFromBirth: 42,
    ageLabel: '6 weeks',
    category: 'Primary Series',
  },
  {
    id: 'iap-hib-1',
    name: 'Hib — 1',
    shortName: 'Hib 1',
    description: 'Haemophilus influenzae type B, primary dose 1.',
    daysFromBirth: 42,
    ageLabel: '6 weeks',
    category: 'Primary Series',
  },
  {
    id: 'iap-hepb-2',
    name: 'Hepatitis B — 2',
    shortName: 'Hep B 2',
    description: 'Second Hep B dose (often part of the combination vaccine).',
    daysFromBirth: 42,
    ageLabel: '6 weeks',
    category: 'Primary Series',
  },
  {
    id: 'iap-rota-1',
    name: 'Rotavirus — 1',
    shortName: 'Rota 1',
    description: 'Oral rotavirus vaccine, dose 1.',
    daysFromBirth: 42,
    ageLabel: '6 weeks',
    category: 'Primary Series',
  },
  {
    id: 'iap-pcv-1',
    name: 'PCV — 1',
    shortName: 'PCV 1',
    description: 'Pneumococcal conjugate vaccine, primary dose 1.',
    daysFromBirth: 42,
    ageLabel: '6 weeks',
    category: 'Primary Series',
  },

  // ─── 10 weeks ─────────────────────────────────────────────────────────────
  {
    id: 'iap-dtp-2',
    name: 'DTwP / DTaP — 2',
    shortName: 'DTP 2',
    description: 'Diphtheria, tetanus and pertussis — primary dose 2.',
    daysFromBirth: 70,
    ageLabel: '10 weeks',
    category: 'Primary Series',
  },
  {
    id: 'iap-ipv-2',
    name: 'IPV — 2',
    shortName: 'IPV 2',
    description: 'Injectable polio vaccine, primary dose 2.',
    daysFromBirth: 70,
    ageLabel: '10 weeks',
    category: 'Primary Series',
  },
  {
    id: 'iap-hib-2',
    name: 'Hib — 2',
    shortName: 'Hib 2',
    description: 'Haemophilus influenzae type B, primary dose 2.',
    daysFromBirth: 70,
    ageLabel: '10 weeks',
    category: 'Primary Series',
  },
  {
    id: 'iap-hepb-3',
    name: 'Hepatitis B — 3',
    shortName: 'Hep B 3',
    description: 'Third Hep B dose (combination vaccine).',
    daysFromBirth: 70,
    ageLabel: '10 weeks',
    category: 'Primary Series',
  },
  {
    id: 'iap-rota-2',
    name: 'Rotavirus — 2',
    shortName: 'Rota 2',
    description: 'Oral rotavirus vaccine, dose 2.',
    daysFromBirth: 70,
    ageLabel: '10 weeks',
    category: 'Primary Series',
  },
  {
    id: 'iap-pcv-2',
    name: 'PCV — 2',
    shortName: 'PCV 2',
    description: 'Pneumococcal conjugate vaccine, primary dose 2.',
    daysFromBirth: 70,
    ageLabel: '10 weeks',
    category: 'Primary Series',
  },

  // ─── 14 weeks ─────────────────────────────────────────────────────────────
  {
    id: 'iap-dtp-3',
    name: 'DTwP / DTaP — 3',
    shortName: 'DTP 3',
    description: 'Diphtheria, tetanus and pertussis — primary dose 3.',
    daysFromBirth: 98,
    ageLabel: '14 weeks',
    category: 'Primary Series',
  },
  {
    id: 'iap-ipv-3',
    name: 'IPV — 3',
    shortName: 'IPV 3',
    description: 'Injectable polio vaccine, primary dose 3.',
    daysFromBirth: 98,
    ageLabel: '14 weeks',
    category: 'Primary Series',
  },
  {
    id: 'iap-hib-3',
    name: 'Hib — 3',
    shortName: 'Hib 3',
    description: 'Haemophilus influenzae type B, primary dose 3.',
    daysFromBirth: 98,
    ageLabel: '14 weeks',
    category: 'Primary Series',
  },
  {
    id: 'iap-hepb-4',
    name: 'Hepatitis B — 4',
    shortName: 'Hep B 4',
    description: 'Fourth Hep B dose — safe when given as part of a combination.',
    daysFromBirth: 98,
    ageLabel: '14 weeks',
    category: 'Primary Series',
  },
  {
    id: 'iap-rota-3',
    name: 'Rotavirus — 3',
    shortName: 'Rota 3',
    description: 'Oral rotavirus dose 3 (not required for RV1 / GSK).',
    daysFromBirth: 98,
    ageLabel: '14 weeks',
    category: 'Primary Series',
  },
  {
    id: 'iap-pcv-3',
    name: 'PCV — 3',
    shortName: 'PCV 3',
    description: 'Pneumococcal conjugate vaccine, primary dose 3.',
    daysFromBirth: 98,
    ageLabel: '14 weeks',
    category: 'Primary Series',
  },

  // ─── 6 & 7 months — Influenza ─────────────────────────────────────────────
  {
    id: 'iap-iiv-1',
    name: 'Influenza (IIV) — 1',
    shortName: 'Flu 1',
    description: 'First flu shot — 0.5 mL from 6 months onwards.',
    daysFromBirth: 180,
    ageLabel: '6 months',
    category: 'Seasonal',
  },
  {
    id: 'iap-iiv-2',
    name: 'Influenza (IIV) — 2',
    shortName: 'Flu 2',
    description: 'Second flu shot — 4 weeks after the first.',
    daysFromBirth: 210,
    ageLabel: '7 months',
    category: 'Seasonal',
  },

  // ─── 6–9 months — Typhoid conjugate ───────────────────────────────────────
  {
    id: 'iap-tcv',
    name: 'Typhoid Conjugate Vaccine',
    shortName: 'TCV',
    description: 'Given once between 6–9 months. No booster recommended.',
    daysFromBirth: 180,
    ageLabel: '6–9 months',
    category: 'Primary Series',
  },

  // ─── 9 months — MMR 1 ─────────────────────────────────────────────────────
  {
    id: 'iap-mmr-1',
    name: 'MMR — 1',
    shortName: 'MMR 1',
    description: 'Measles, mumps and rubella, first dose.',
    daysFromBirth: 270,
    ageLabel: '9 months',
    category: 'Primary Series',
  },

  // ─── 12 months — Hep A 1 ──────────────────────────────────────────────────
  {
    id: 'iap-hepa-1',
    name: 'Hepatitis A — 1',
    shortName: 'Hep A 1',
    description: 'Single dose for live vaccine; first of two for inactivated.',
    daysFromBirth: 365,
    ageLabel: '12 months',
    category: 'Primary Series',
  },

  // ─── 15 months ────────────────────────────────────────────────────────────
  {
    id: 'iap-mmr-2',
    name: 'MMR — 2',
    shortName: 'MMR 2',
    description: 'Second MMR dose — 3–6 months after dose 1.',
    daysFromBirth: 450,
    ageLabel: '15 months',
    category: 'Primary Series',
  },
  {
    id: 'iap-varicella-1',
    name: 'Varicella — 1',
    shortName: 'Varicella 1',
    description: 'Chickenpox vaccine, first dose.',
    daysFromBirth: 450,
    ageLabel: '15 months',
    category: 'Primary Series',
  },
  {
    id: 'iap-pcv-boost',
    name: 'PCV Booster',
    shortName: 'PCV B',
    description: 'Pneumococcal booster in the second year of life.',
    daysFromBirth: 450,
    ageLabel: '15 months',
    category: 'Boosters',
  },

  // ─── 16–18 months ─────────────────────────────────────────────────────────
  {
    id: 'iap-dtp-b1',
    name: 'DTwP / DTaP Booster — 1',
    shortName: 'DTP B1',
    description: 'First DTP booster.',
    daysFromBirth: 480,
    ageLabel: '16–18 months',
    category: 'Boosters',
  },
  {
    id: 'iap-hib-b1',
    name: 'Hib Booster — 1',
    shortName: 'Hib B1',
    description: 'First Hib booster.',
    daysFromBirth: 480,
    ageLabel: '16–18 months',
    category: 'Boosters',
  },
  {
    id: 'iap-ipv-b1',
    name: 'IPV Booster — 1',
    shortName: 'IPV B1',
    description: 'First IPV booster.',
    daysFromBirth: 480,
    ageLabel: '16–18 months',
    category: 'Boosters',
  },

  // ─── 18–19 months ─────────────────────────────────────────────────────────
  {
    id: 'iap-hepa-2',
    name: 'Hepatitis A — 2',
    shortName: 'Hep A 2',
    description: 'Only needed for the inactivated Hep A vaccine.',
    daysFromBirth: 540,
    ageLabel: '18–19 months',
    category: 'Primary Series',
  },
  {
    id: 'iap-varicella-2',
    name: 'Varicella — 2',
    shortName: 'Varicella 2',
    description: 'Second chickenpox dose — 3–6 months after dose 1.',
    daysFromBirth: 540,
    ageLabel: '18–19 months',
    category: 'Primary Series',
  },

  // ─── 4–6 years ────────────────────────────────────────────────────────────
  {
    id: 'iap-dtp-b2',
    name: 'DTwP / DTaP Booster — 2',
    shortName: 'DTP B2',
    description: 'School-entry DTP booster.',
    daysFromBirth: 1460,
    ageLabel: '4–6 years',
    category: 'Boosters',
  },
  {
    id: 'iap-ipv-b2',
    name: 'IPV Booster — 2',
    shortName: 'IPV B2',
    description: 'Second IPV booster, given at school entry.',
    daysFromBirth: 1460,
    ageLabel: '4–6 years',
    category: 'Boosters',
  },
  {
    id: 'iap-mmr-3',
    name: 'MMR — 3',
    shortName: 'MMR 3',
    description: 'Third MMR dose at school entry.',
    daysFromBirth: 1460,
    ageLabel: '4–6 years',
    category: 'Boosters',
  },

  // ─── 9–14 years — HPV (2-dose, 0 / 6 mo) ──────────────────────────────────
  {
    id: 'iap-hpv-1',
    name: 'HPV — 1',
    shortName: 'HPV 1',
    description: 'For girls and boys — 2-dose schedule, 6 months apart.',
    daysFromBirth: 3285,
    ageLabel: '9–14 years',
    category: 'Adolescent',
  },
  {
    id: 'iap-hpv-2',
    name: 'HPV — 2',
    shortName: 'HPV 2',
    description: 'Second HPV dose, 6 months after the first.',
    daysFromBirth: 3465,
    ageLabel: '9–14 years',
    category: 'Adolescent',
  },

  // ─── 10 years — Tdap ──────────────────────────────────────────────────────
  {
    id: 'iap-tdap',
    name: 'Tdap',
    shortName: 'Tdap',
    description: 'Tetanus, diphtheria and acellular pertussis booster.',
    daysFromBirth: 3650,
    ageLabel: '10 years',
    category: 'Adolescent',
  },

  // ─── 16–18 years — Td ─────────────────────────────────────────────────────
  {
    id: 'iap-td',
    name: 'Td',
    shortName: 'Td',
    description: 'Tetanus-diphtheria booster — new in the 2023 schedule.',
    daysFromBirth: 5840,
    ageLabel: '16–18 years',
    category: 'Adolescent',
  },
];

// ─── Legacy ID compatibility ───────────────────────────────────────────────
// Older builds of the app stored per-kid completions against the ids below
// (each of which bundled several real vaccines). When the parent marked one
// of those rows done, we treat ALL of the new granular ids under that group
// as done with the same date — so nobody's history disappears.
export const LEGACY_VACCINE_ID_MAP: Record<string, string[]> = {
  v01: ['iap-bcg', 'iap-opv-0', 'iap-hepb-1'],
  v02: ['iap-dtp-1', 'iap-ipv-1', 'iap-hib-1', 'iap-hepb-2', 'iap-rota-1', 'iap-pcv-1'],
  v03: ['iap-dtp-2', 'iap-ipv-2', 'iap-hib-2', 'iap-hepb-3', 'iap-rota-2', 'iap-pcv-2'],
  v04: ['iap-dtp-3', 'iap-ipv-3', 'iap-hib-3', 'iap-hepb-4', 'iap-rota-3', 'iap-pcv-3'],
  v06: ['iap-mmr-1'],
  v07: ['iap-varicella-1'],
  v08: ['iap-mmr-2'],
  v09: ['iap-dtp-b1', 'iap-hib-b1', 'iap-ipv-b1'],
  v11: ['iap-dtp-b2', 'iap-ipv-b2', 'iap-mmr-3'],
};
