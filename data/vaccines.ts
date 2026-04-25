export type VaccineScheduleType = 'iap' | 'nis';

export interface Vaccine {
  id: string;
  name: string;
  shortName: string;
  description: string;
  daysFromBirth: number;
  ageLabel: string;
  category: string;
  /** Which national/society schedule this entry belongs to. */
  schedule: VaccineScheduleType;
}

// =============================================================================
//  IAP — Indian Academy of Pediatrics, ACVIP 2023 schedule
// =============================================================================
// Source: Rao IS, Kasi SG et al. "Indian Academy of Pediatrics (IAP) Advisory
// Committee on Vaccines and Immunization Practices (ACVIP): Recommended
// Immunization Schedule (2023) and Update on Immunization for Children Aged 0
// Through 18 Years." Indian Pediatrics, Jan 15 2024 (PII: S097475591600592).
//
// Each vaccine is its own entry so parents can log the exact date of every
// jab — vaccines given on the same visit in theory are sometimes split
// across different days in practice.

export const IAP_VACCINE_SCHEDULE: Vaccine[] = [
  // ─── Birth ─────────────────────────────────────────────────────────────────
  { id: 'iap-bcg',           name: 'BCG',                         shortName: 'BCG',         description: 'Protects against tuberculosis. Given before discharge.',                              daysFromBirth: 0,    ageLabel: 'Birth',         category: 'Birth',          schedule: 'iap' },
  { id: 'iap-opv-0',         name: 'OPV-0 (Birth dose)',          shortName: 'OPV 0',       description: 'Oral polio vaccine, given as soon as possible after birth.',                          daysFromBirth: 0,    ageLabel: 'Birth',         category: 'Birth',          schedule: 'iap' },
  { id: 'iap-hepb-1',        name: 'Hepatitis B — 1',             shortName: 'Hep B 1',     description: 'First Hep B dose, ideally within 24 hours of birth.',                                 daysFromBirth: 0,    ageLabel: 'Birth',         category: 'Birth',          schedule: 'iap' },

  // ─── 6 weeks ──────────────────────────────────────────────────────────────
  { id: 'iap-dtp-1',         name: 'DTwP / DTaP — 1',             shortName: 'DTP 1',       description: 'Diphtheria, tetanus and pertussis — primary dose 1.',                                 daysFromBirth: 42,   ageLabel: '6 weeks',       category: 'Primary Series', schedule: 'iap' },
  { id: 'iap-ipv-1',         name: 'IPV — 1',                     shortName: 'IPV 1',       description: 'Injectable polio vaccine, primary dose 1.',                                           daysFromBirth: 42,   ageLabel: '6 weeks',       category: 'Primary Series', schedule: 'iap' },
  { id: 'iap-hib-1',         name: 'Hib — 1',                     shortName: 'Hib 1',       description: 'Haemophilus influenzae type B, primary dose 1.',                                      daysFromBirth: 42,   ageLabel: '6 weeks',       category: 'Primary Series', schedule: 'iap' },
  { id: 'iap-hepb-2',        name: 'Hepatitis B — 2',             shortName: 'Hep B 2',     description: 'Second Hep B dose (often part of the combination vaccine).',                          daysFromBirth: 42,   ageLabel: '6 weeks',       category: 'Primary Series', schedule: 'iap' },
  { id: 'iap-rota-1',        name: 'Rotavirus — 1',               shortName: 'Rota 1',      description: 'Oral rotavirus vaccine, dose 1.',                                                     daysFromBirth: 42,   ageLabel: '6 weeks',       category: 'Primary Series', schedule: 'iap' },
  { id: 'iap-pcv-1',         name: 'PCV — 1',                     shortName: 'PCV 1',       description: 'Pneumococcal conjugate vaccine, primary dose 1.',                                     daysFromBirth: 42,   ageLabel: '6 weeks',       category: 'Primary Series', schedule: 'iap' },

  // ─── 10 weeks ─────────────────────────────────────────────────────────────
  { id: 'iap-dtp-2',         name: 'DTwP / DTaP — 2',             shortName: 'DTP 2',       description: 'Diphtheria, tetanus and pertussis — primary dose 2.',                                 daysFromBirth: 70,   ageLabel: '10 weeks',      category: 'Primary Series', schedule: 'iap' },
  { id: 'iap-ipv-2',         name: 'IPV — 2',                     shortName: 'IPV 2',       description: 'Injectable polio vaccine, primary dose 2.',                                           daysFromBirth: 70,   ageLabel: '10 weeks',      category: 'Primary Series', schedule: 'iap' },
  { id: 'iap-hib-2',         name: 'Hib — 2',                     shortName: 'Hib 2',       description: 'Haemophilus influenzae type B, primary dose 2.',                                      daysFromBirth: 70,   ageLabel: '10 weeks',      category: 'Primary Series', schedule: 'iap' },
  { id: 'iap-hepb-3',        name: 'Hepatitis B — 3',             shortName: 'Hep B 3',     description: 'Third Hep B dose (combination vaccine).',                                             daysFromBirth: 70,   ageLabel: '10 weeks',      category: 'Primary Series', schedule: 'iap' },
  { id: 'iap-rota-2',        name: 'Rotavirus — 2',               shortName: 'Rota 2',      description: 'Oral rotavirus vaccine, dose 2.',                                                     daysFromBirth: 70,   ageLabel: '10 weeks',      category: 'Primary Series', schedule: 'iap' },
  { id: 'iap-pcv-2',         name: 'PCV — 2',                     shortName: 'PCV 2',       description: 'Pneumococcal conjugate vaccine, primary dose 2.',                                     daysFromBirth: 70,   ageLabel: '10 weeks',      category: 'Primary Series', schedule: 'iap' },

  // ─── 14 weeks ─────────────────────────────────────────────────────────────
  { id: 'iap-dtp-3',         name: 'DTwP / DTaP — 3',             shortName: 'DTP 3',       description: 'Diphtheria, tetanus and pertussis — primary dose 3.',                                 daysFromBirth: 98,   ageLabel: '14 weeks',      category: 'Primary Series', schedule: 'iap' },
  { id: 'iap-ipv-3',         name: 'IPV — 3',                     shortName: 'IPV 3',       description: 'Injectable polio vaccine, primary dose 3.',                                           daysFromBirth: 98,   ageLabel: '14 weeks',      category: 'Primary Series', schedule: 'iap' },
  { id: 'iap-hib-3',         name: 'Hib — 3',                     shortName: 'Hib 3',       description: 'Haemophilus influenzae type B, primary dose 3.',                                      daysFromBirth: 98,   ageLabel: '14 weeks',      category: 'Primary Series', schedule: 'iap' },
  { id: 'iap-hepb-4',        name: 'Hepatitis B — 4',             shortName: 'Hep B 4',     description: 'Fourth Hep B dose — safe when given as part of a combination.',                      daysFromBirth: 98,   ageLabel: '14 weeks',      category: 'Primary Series', schedule: 'iap' },
  { id: 'iap-rota-3',        name: 'Rotavirus — 3',               shortName: 'Rota 3',      description: 'Oral rotavirus dose 3 (not required for RV1 / GSK).',                                 daysFromBirth: 98,   ageLabel: '14 weeks',      category: 'Primary Series', schedule: 'iap' },
  { id: 'iap-pcv-3',         name: 'PCV — 3',                     shortName: 'PCV 3',       description: 'Pneumococcal conjugate vaccine, primary dose 3.',                                     daysFromBirth: 98,   ageLabel: '14 weeks',      category: 'Primary Series', schedule: 'iap' },

  // ─── 6 & 7 months — Influenza ─────────────────────────────────────────────
  { id: 'iap-iiv-1',         name: 'Influenza (IIV) — 1',         shortName: 'Flu 1',       description: 'First flu shot — 0.5 mL from 6 months onwards.',                                      daysFromBirth: 180,  ageLabel: '6 months',      category: 'Seasonal',       schedule: 'iap' },
  { id: 'iap-iiv-2',         name: 'Influenza (IIV) — 2',         shortName: 'Flu 2',       description: 'Second flu shot — 4 weeks after the first.',                                          daysFromBirth: 210,  ageLabel: '7 months',      category: 'Seasonal',       schedule: 'iap' },

  // ─── 6–9 months — TCV ─────────────────────────────────────────────────────
  { id: 'iap-tcv',           name: 'Typhoid Conjugate Vaccine',   shortName: 'TCV',         description: 'Given once between 6–9 months. No booster recommended.',                              daysFromBirth: 180,  ageLabel: '6–9 months',    category: 'Primary Series', schedule: 'iap' },

  // ─── 9 months — MMR 1 ─────────────────────────────────────────────────────
  { id: 'iap-mmr-1',         name: 'MMR — 1',                     shortName: 'MMR 1',       description: 'Measles, mumps and rubella, first dose.',                                             daysFromBirth: 270,  ageLabel: '9 months',      category: 'Primary Series', schedule: 'iap' },

  // ─── 12 months — Hep A 1 ──────────────────────────────────────────────────
  { id: 'iap-hepa-1',        name: 'Hepatitis A — 1',             shortName: 'Hep A 1',     description: 'Single dose for live vaccine; first of two for inactivated.',                         daysFromBirth: 365,  ageLabel: '12 months',     category: 'Primary Series', schedule: 'iap' },

  // ─── 15 months ────────────────────────────────────────────────────────────
  { id: 'iap-mmr-2',         name: 'MMR — 2',                     shortName: 'MMR 2',       description: 'Second MMR dose — 3–6 months after dose 1.',                                          daysFromBirth: 450,  ageLabel: '15 months',     category: 'Primary Series', schedule: 'iap' },
  { id: 'iap-varicella-1',   name: 'Varicella — 1',               shortName: 'Varicella 1', description: 'Chickenpox vaccine, first dose.',                                                     daysFromBirth: 450,  ageLabel: '15 months',     category: 'Primary Series', schedule: 'iap' },
  { id: 'iap-pcv-boost',     name: 'PCV Booster',                 shortName: 'PCV B',       description: 'Pneumococcal booster in the second year of life.',                                    daysFromBirth: 450,  ageLabel: '15 months',     category: 'Boosters',       schedule: 'iap' },

  // ─── 16–18 months ─────────────────────────────────────────────────────────
  { id: 'iap-dtp-b1',        name: 'DTwP / DTaP Booster — 1',     shortName: 'DTP B1',      description: 'First DTP booster.',                                                                  daysFromBirth: 480,  ageLabel: '16–18 months',  category: 'Boosters',       schedule: 'iap' },
  { id: 'iap-hib-b1',        name: 'Hib Booster — 1',             shortName: 'Hib B1',      description: 'First Hib booster.',                                                                  daysFromBirth: 480,  ageLabel: '16–18 months',  category: 'Boosters',       schedule: 'iap' },
  { id: 'iap-ipv-b1',        name: 'IPV Booster — 1',             shortName: 'IPV B1',      description: 'First IPV booster.',                                                                  daysFromBirth: 480,  ageLabel: '16–18 months',  category: 'Boosters',       schedule: 'iap' },

  // ─── 18–19 months ─────────────────────────────────────────────────────────
  { id: 'iap-hepa-2',        name: 'Hepatitis A — 2',             shortName: 'Hep A 2',     description: 'Only needed for the inactivated Hep A vaccine.',                                      daysFromBirth: 540,  ageLabel: '18–19 months',  category: 'Primary Series', schedule: 'iap' },
  { id: 'iap-varicella-2',   name: 'Varicella — 2',               shortName: 'Varicella 2', description: 'Second chickenpox dose — 3–6 months after dose 1.',                                   daysFromBirth: 540,  ageLabel: '18–19 months',  category: 'Primary Series', schedule: 'iap' },

  // ─── 4–6 years ────────────────────────────────────────────────────────────
  { id: 'iap-dtp-b2',        name: 'DTwP / DTaP Booster — 2',     shortName: 'DTP B2',      description: 'School-entry DTP booster.',                                                           daysFromBirth: 1460, ageLabel: '4–6 years',     category: 'Boosters',       schedule: 'iap' },
  { id: 'iap-ipv-b2',        name: 'IPV Booster — 2',             shortName: 'IPV B2',      description: 'Second IPV booster, given at school entry.',                                          daysFromBirth: 1460, ageLabel: '4–6 years',     category: 'Boosters',       schedule: 'iap' },
  { id: 'iap-mmr-3',         name: 'MMR — 3',                     shortName: 'MMR 3',       description: 'Third MMR dose at school entry.',                                                     daysFromBirth: 1460, ageLabel: '4–6 years',     category: 'Boosters',       schedule: 'iap' },

  // ─── 9–14 years — HPV ─────────────────────────────────────────────────────
  { id: 'iap-hpv-1',         name: 'HPV — 1',                     shortName: 'HPV 1',       description: 'For girls and boys — 2-dose schedule, 6 months apart.',                               daysFromBirth: 3285, ageLabel: '9–14 years',    category: 'Adolescent',     schedule: 'iap' },
  { id: 'iap-hpv-2',         name: 'HPV — 2',                     shortName: 'HPV 2',       description: 'Second HPV dose, 6 months after the first.',                                          daysFromBirth: 3465, ageLabel: '9–14 years',    category: 'Adolescent',     schedule: 'iap' },

  // ─── 10 years — Tdap ──────────────────────────────────────────────────────
  { id: 'iap-tdap',          name: 'Tdap',                        shortName: 'Tdap',        description: 'Tetanus, diphtheria and acellular pertussis booster.',                                daysFromBirth: 3650, ageLabel: '10 years',      category: 'Adolescent',     schedule: 'iap' },

  // ─── 16–18 years — Td ─────────────────────────────────────────────────────
  { id: 'iap-td',            name: 'Td',                          shortName: 'Td',          description: 'Tetanus-diphtheria booster — new in the 2023 schedule.',                              daysFromBirth: 5840, ageLabel: '16–18 years',   category: 'Adolescent',     schedule: 'iap' },
];

// =============================================================================
//  NIS — Government of India Universal Immunization Programme
// =============================================================================
// Source: Ministry of Health & Family Welfare, "National Immunization Schedule
// (NIS) for Infants, Children and Pregnant Women (Vaccine-wise)". This is the
// schedule followed by Anganwadi / PHC immunization sessions across India.
//
// Notes:
//   * PCV is rolled out in selected states only.
//   * JE is given in endemic districts only.
//   * Vitamin A 2nd–9th doses run every 6 months between 16 mo and 5 years.

export const NIS_VACCINE_SCHEDULE: Vaccine[] = [
  // ─── Birth ─────────────────────────────────────────────────────────────────
  { id: 'nis-bcg',           name: 'BCG',                                shortName: 'BCG',          description: 'Given at birth or as early as possible up to 1 year of age.',          daysFromBirth: 0,    ageLabel: 'Birth',         category: 'Birth',          schedule: 'nis' },
  { id: 'nis-hepb-birth',    name: 'Hepatitis B — Birth dose',           shortName: 'Hep B Birth',  description: 'Within 24 hours of birth (or as early as possible).',                 daysFromBirth: 0,    ageLabel: 'Birth',         category: 'Birth',          schedule: 'nis' },
  { id: 'nis-opv-0',         name: 'OPV-0',                              shortName: 'OPV 0',        description: 'Oral polio birth dose — within the first 15 days.',                   daysFromBirth: 0,    ageLabel: 'Birth',         category: 'Birth',          schedule: 'nis' },

  // ─── 6 weeks ──────────────────────────────────────────────────────────────
  { id: 'nis-opv-1',         name: 'OPV — 1',                            shortName: 'OPV 1',        description: '2 oral drops.',                                                       daysFromBirth: 42,   ageLabel: '6 weeks',       category: 'Primary Series', schedule: 'nis' },
  { id: 'nis-penta-1',       name: 'Pentavalent — 1',                    shortName: 'Penta 1',      description: 'DPT + Hep B + Hib in one shot, primary dose 1.',                      daysFromBirth: 42,   ageLabel: '6 weeks',       category: 'Primary Series', schedule: 'nis' },
  { id: 'nis-rvv-1',         name: 'Rotavirus (RVV) — 1',                shortName: 'RVV 1',        description: 'Oral rotavirus vaccine, dose 1.',                                     daysFromBirth: 42,   ageLabel: '6 weeks',       category: 'Primary Series', schedule: 'nis' },
  { id: 'nis-fipv-1',        name: 'fIPV — 1',                           shortName: 'fIPV 1',       description: 'Fractional IPV — intra-dermal, right upper arm.',                     daysFromBirth: 42,   ageLabel: '6 weeks',       category: 'Primary Series', schedule: 'nis' },
  { id: 'nis-pcv-1',         name: 'PCV — 1',                            shortName: 'PCV 1',        description: 'Pneumococcal conjugate vaccine — selected states only.',              daysFromBirth: 42,   ageLabel: '6 weeks',       category: 'Primary Series', schedule: 'nis' },

  // ─── 10 weeks ─────────────────────────────────────────────────────────────
  { id: 'nis-opv-2',         name: 'OPV — 2',                            shortName: 'OPV 2',        description: '2 oral drops.',                                                       daysFromBirth: 70,   ageLabel: '10 weeks',      category: 'Primary Series', schedule: 'nis' },
  { id: 'nis-penta-2',       name: 'Pentavalent — 2',                    shortName: 'Penta 2',      description: 'Primary dose 2 of the 5-in-1 vaccine.',                               daysFromBirth: 70,   ageLabel: '10 weeks',      category: 'Primary Series', schedule: 'nis' },
  { id: 'nis-rvv-2',         name: 'Rotavirus (RVV) — 2',                shortName: 'RVV 2',        description: 'Oral rotavirus vaccine, dose 2.',                                     daysFromBirth: 70,   ageLabel: '10 weeks',      category: 'Primary Series', schedule: 'nis' },

  // ─── 14 weeks ─────────────────────────────────────────────────────────────
  { id: 'nis-opv-3',         name: 'OPV — 3',                            shortName: 'OPV 3',        description: '2 oral drops.',                                                       daysFromBirth: 98,   ageLabel: '14 weeks',      category: 'Primary Series', schedule: 'nis' },
  { id: 'nis-penta-3',       name: 'Pentavalent — 3',                    shortName: 'Penta 3',      description: 'Primary dose 3 of the 5-in-1 vaccine.',                               daysFromBirth: 98,   ageLabel: '14 weeks',      category: 'Primary Series', schedule: 'nis' },
  { id: 'nis-fipv-2',        name: 'fIPV — 2',                           shortName: 'fIPV 2',       description: 'Second fractional IPV dose.',                                         daysFromBirth: 98,   ageLabel: '14 weeks',      category: 'Primary Series', schedule: 'nis' },
  { id: 'nis-rvv-3',         name: 'Rotavirus (RVV) — 3',                shortName: 'RVV 3',        description: 'Oral rotavirus vaccine, dose 3.',                                     daysFromBirth: 98,   ageLabel: '14 weeks',      category: 'Primary Series', schedule: 'nis' },
  { id: 'nis-pcv-2',         name: 'PCV — 2',                            shortName: 'PCV 2',        description: 'Pneumococcal conjugate vaccine — selected states only.',              daysFromBirth: 98,   ageLabel: '14 weeks',      category: 'Primary Series', schedule: 'nis' },

  // ─── 9–12 months ──────────────────────────────────────────────────────────
  { id: 'nis-mr-1',          name: 'MR — 1',                             shortName: 'MR 1',         description: 'Measles & rubella, first dose. Sub-cutaneous, right upper arm.',      daysFromBirth: 270,  ageLabel: '9–12 months',   category: 'Primary Series', schedule: 'nis' },
  { id: 'nis-je-1',          name: 'JE — 1',                             shortName: 'JE 1',         description: 'Japanese Encephalitis — endemic districts only.',                     daysFromBirth: 270,  ageLabel: '9–12 months',   category: 'Primary Series', schedule: 'nis' },
  { id: 'nis-pcv-boost',     name: 'PCV Booster',                        shortName: 'PCV B',        description: 'Pneumococcal booster — selected states only.',                        daysFromBirth: 270,  ageLabel: '9–12 months',   category: 'Boosters',       schedule: 'nis' },
  { id: 'nis-vita-1',        name: 'Vitamin A — 1st dose',               shortName: 'Vit A 1',      description: '1 mL (1 lakh IU) oral, alongside MR-1.',                              daysFromBirth: 270,  ageLabel: '9–12 months',   category: 'Nutrition',      schedule: 'nis' },

  // ─── 16–24 months ─────────────────────────────────────────────────────────
  { id: 'nis-mr-2',          name: 'MR — 2',                             shortName: 'MR 2',         description: 'Second measles & rubella dose.',                                      daysFromBirth: 480,  ageLabel: '16–24 months',  category: 'Boosters',       schedule: 'nis' },
  { id: 'nis-je-2',          name: 'JE — 2',                             shortName: 'JE 2',         description: 'Second JE dose — endemic districts only.',                            daysFromBirth: 480,  ageLabel: '16–24 months',  category: 'Boosters',       schedule: 'nis' },
  { id: 'nis-dpt-b1',        name: 'DPT Booster — 1',                    shortName: 'DPT B1',       description: 'First DPT booster, IM in antero-lateral mid-thigh.',                  daysFromBirth: 480,  ageLabel: '16–24 months',  category: 'Boosters',       schedule: 'nis' },
  { id: 'nis-opv-boost',     name: 'OPV Booster',                        shortName: 'OPV B',        description: '2 oral drops.',                                                       daysFromBirth: 480,  ageLabel: '16–24 months',  category: 'Boosters',       schedule: 'nis' },
  { id: 'nis-vita-2',        name: 'Vitamin A — 2nd dose',               shortName: 'Vit A 2',      description: '2 mL (2 lakh IU) oral, at 16–18 months.',                             daysFromBirth: 480,  ageLabel: '16–24 months',  category: 'Nutrition',      schedule: 'nis' },

  // ─── Vitamin A 3rd–9th — every 6 months until 5 years ─────────────────────
  { id: 'nis-vita-3',        name: 'Vitamin A — 3rd dose',               shortName: 'Vit A 3',      description: '2 mL oral, biannual.',                                                daysFromBirth: 720,  ageLabel: '24 months',     category: 'Nutrition',      schedule: 'nis' },
  { id: 'nis-vita-4',        name: 'Vitamin A — 4th dose',               shortName: 'Vit A 4',      description: '2 mL oral, biannual.',                                                daysFromBirth: 900,  ageLabel: '30 months',     category: 'Nutrition',      schedule: 'nis' },
  { id: 'nis-vita-5',        name: 'Vitamin A — 5th dose',               shortName: 'Vit A 5',      description: '2 mL oral, biannual.',                                                daysFromBirth: 1080, ageLabel: '3 years',       category: 'Nutrition',      schedule: 'nis' },
  { id: 'nis-vita-6',        name: 'Vitamin A — 6th dose',               shortName: 'Vit A 6',      description: '2 mL oral, biannual.',                                                daysFromBirth: 1260, ageLabel: '3.5 years',     category: 'Nutrition',      schedule: 'nis' },
  { id: 'nis-vita-7',        name: 'Vitamin A — 7th dose',               shortName: 'Vit A 7',      description: '2 mL oral, biannual.',                                                daysFromBirth: 1440, ageLabel: '4 years',       category: 'Nutrition',      schedule: 'nis' },
  { id: 'nis-vita-8',        name: 'Vitamin A — 8th dose',               shortName: 'Vit A 8',      description: '2 mL oral, biannual.',                                                daysFromBirth: 1620, ageLabel: '4.5 years',     category: 'Nutrition',      schedule: 'nis' },
  { id: 'nis-vita-9',        name: 'Vitamin A — 9th dose',               shortName: 'Vit A 9',      description: '2 mL oral, biannual (last dose).',                                    daysFromBirth: 1800, ageLabel: '5 years',       category: 'Nutrition',      schedule: 'nis' },

  // ─── 5–6 years — DPT B2 ───────────────────────────────────────────────────
  { id: 'nis-dpt-b2',        name: 'DPT Booster — 2',                    shortName: 'DPT B2',       description: 'School-entry DPT booster.',                                           daysFromBirth: 1825, ageLabel: '5–6 years',     category: 'Boosters',       schedule: 'nis' },

  // ─── Adolescent Td ────────────────────────────────────────────────────────
  { id: 'nis-td-10y',        name: 'Td — 10 years',                      shortName: 'Td 10y',       description: 'Tetanus & adult diphtheria booster.',                                 daysFromBirth: 3650, ageLabel: '10 years',      category: 'Adolescent',     schedule: 'nis' },
  { id: 'nis-td-16y',        name: 'Td — 16 years',                      shortName: 'Td 16y',       description: 'Final adolescent Td booster.',                                        daysFromBirth: 5840, ageLabel: '16 years',      category: 'Adolescent',     schedule: 'nis' },
];

// Combined export — used by admin tooling and the library journey timeline
// (which looks up vaccine ids regardless of the kid's chosen schedule).
export const VACCINE_SCHEDULE: Vaccine[] = [
  ...IAP_VACCINE_SCHEDULE,
  ...NIS_VACCINE_SCHEDULE,
];

export function getScheduleFor(type: VaccineScheduleType): Vaccine[] {
  return type === 'nis' ? NIS_VACCINE_SCHEDULE : IAP_VACCINE_SCHEDULE;
}

// ─── Schedule metadata for the chooser ─────────────────────────────────────
export interface ScheduleInfo {
  type: VaccineScheduleType;
  name: string;
  fullName: string;
  authority: string;
  tagline: string;
  bestFor: string;
  highlights: string[];
  source: string;
}

export const SCHEDULE_INFO: Record<VaccineScheduleType, ScheduleInfo> = {
  iap: {
    type: 'iap',
    name: 'IAP',
    fullName: 'IAP ACVIP 2023',
    authority: 'Indian Academy of Pediatrics',
    tagline: 'Followed by most private paediatricians',
    bestFor: 'Private paediatric care',
    highlights: [
      'Adds Influenza, Typhoid (TCV), Hepatitis A, Varicella & HPV',
      'Two boosters of MMR (9, 15 mo and 4–6 y)',
      'Tdap at 10 y and Td at 16–18 y',
      'IPV at 6 / 10 / 14 weeks (full intramuscular dose)',
    ],
    source: 'Indian Pediatrics, Jan 2024 — Rao IS, Kasi SG et al.',
  },
  nis: {
    type: 'nis',
    name: 'NIS / UIP',
    fullName: 'National Immunization Schedule',
    authority: 'Govt. of India · MoHFW',
    tagline: 'Free at PHCs, Anganwadi & UIP sessions',
    bestFor: 'Anganwadi / PHC immunization',
    highlights: [
      'Includes Vitamin A doses (1st at 9 mo, 2nd–9th biannual to 5 y)',
      'Pentavalent (5-in-1) instead of separate DTP / Hib / Hep B',
      'Fractional IPV (intra-dermal) at 6 & 14 weeks',
      'JE in endemic districts; PCV in selected states',
    ],
    source: 'Ministry of Health & Family Welfare, Govt. of India',
  },
};

// ─── Legacy ID compatibility ───────────────────────────────────────────────
// Older builds of the app stored per-kid completions against the v0X ids
// below (each of which bundled several real vaccines). When the parent
// marked one of those rows done, we fold the completion onto every new
// granular id under that group — so nobody's history disappears, regardless
// of which schedule they pick going forward.
export const LEGACY_VACCINE_ID_MAP: Record<string, Record<VaccineScheduleType, string[]>> = {
  v01: {
    iap: ['iap-bcg', 'iap-opv-0', 'iap-hepb-1'],
    nis: ['nis-bcg', 'nis-opv-0', 'nis-hepb-birth'],
  },
  v02: {
    iap: ['iap-dtp-1', 'iap-ipv-1', 'iap-hib-1', 'iap-hepb-2', 'iap-rota-1', 'iap-pcv-1'],
    nis: ['nis-opv-1', 'nis-penta-1', 'nis-rvv-1', 'nis-fipv-1', 'nis-pcv-1'],
  },
  v03: {
    iap: ['iap-dtp-2', 'iap-ipv-2', 'iap-hib-2', 'iap-hepb-3', 'iap-rota-2', 'iap-pcv-2'],
    nis: ['nis-opv-2', 'nis-penta-2', 'nis-rvv-2'],
  },
  v04: {
    iap: ['iap-dtp-3', 'iap-ipv-3', 'iap-hib-3', 'iap-hepb-4', 'iap-rota-3', 'iap-pcv-3'],
    nis: ['nis-opv-3', 'nis-penta-3', 'nis-fipv-2', 'nis-rvv-3', 'nis-pcv-2'],
  },
  v05: {
    iap: [],
    nis: ['nis-vita-1'],
  },
  v06: {
    iap: ['iap-mmr-1'],
    nis: ['nis-mr-1', 'nis-je-1'],
  },
  v07: {
    iap: ['iap-varicella-1'],
    nis: [],
  },
  v08: {
    iap: ['iap-mmr-2'],
    nis: ['nis-mr-2', 'nis-je-2'],
  },
  v09: {
    iap: ['iap-dtp-b1', 'iap-hib-b1', 'iap-ipv-b1'],
    nis: ['nis-dpt-b1', 'nis-opv-boost', 'nis-pcv-boost'],
  },
  v10: {
    iap: [],
    nis: ['nis-vita-2'],
  },
  v11: {
    iap: ['iap-dtp-b2', 'iap-ipv-b2', 'iap-mmr-3'],
    nis: ['nis-dpt-b2'],
  },
};
