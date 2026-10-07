// Rich metadata for each vaccine *family*, so the detail screen can show
// "what it protects against", "why it's important", "side effects",
// and the names doctors commonly use for the same thing — without us
// repeating it per-dose in data/vaccines.ts.
//
// Each schedule entry (iap-dtp-1, iap-dtp-2, nis-penta-1, …) maps to a
// family key here via `familyForVaccineId`. Dose number and age context
// come from the schedule row itself.

export interface VaccineFamilyEnrichment {
  /** Which diseases this vaccine prevents (ids into DISEASES). */
  diseaseIds: string[];
  /** One sentence on why a parent should prioritise this one. */
  whyImportant: string;
  /** Typical, usually-mild reactions parents should expect. Optional. */
  sideEffects?: string;
  /** Alternate names a paediatrician or pharmacist may use. */
  aliases?: string[];
}

/**
 * One entry per vaccine family. All doses in the schedule that belong to
 * the family inherit this metadata — e.g. iap-dtp-1, iap-dtp-2, iap-dtp-3,
 * iap-dtp-b1, iap-dtp-b2 all read from `dtp`.
 */
export const VACCINE_ENRICHMENTS: Record<string, VaccineFamilyEnrichment> = {
  bcg: {
    diseaseIds: ['tb'],
    whyImportant:
      'A single dose at birth protects against severe forms of TB in infants — tuberculous meningitis and disseminated TB.',
    sideEffects:
      'A small ulcer forms at the injection site over 2–3 weeks and heals leaving a tiny scar. Mild fever is normal.',
    aliases: ['Bacillus Calmette–Guérin'],
  },
  opv: {
    diseaseIds: ['polio'],
    whyImportant:
      'Drops given by mouth — the oral vaccine India uses as part of the strategy that kept polio eliminated.',
    sideEffects: 'Essentially none. Very rare mild diarrhoea.',
    aliases: ['Oral polio vaccine', 'Polio drops'],
  },
  ipv: {
    diseaseIds: ['polio'],
    whyImportant:
      'Injected polio vaccine, given alongside OPV in the primary series for stronger immunity.',
    sideEffects: 'Soreness or redness at the injection site. Mild fever possible.',
    aliases: ['Inactivated polio vaccine'],
  },
  hepb: {
    diseaseIds: ['hepb'],
    whyImportant:
      'The first dose within 24 hours of birth cuts the risk of lifelong Hep B infection from 90% to under 5%.',
    sideEffects: 'Mild soreness at the injection site. Low-grade fever occasionally.',
    aliases: ['Hep B', 'HBV'],
  },
  dtp: {
    diseaseIds: ['diphtheria', 'tetanus', 'pertussis'],
    whyImportant:
      'One shot that protects against three serious childhood illnesses — needs boosters at 15 months, 5 years and again in adolescence.',
    sideEffects: 'Fever, fussiness and a sore red spot at the injection site for 1–2 days are common.',
    aliases: ['DTP', 'DTwP', 'DTaP', 'Triple'],
  },
  tdap: {
    diseaseIds: ['tetanus', 'diphtheria', 'pertussis'],
    whyImportant:
      'The adolescent booster — keeps protection going into adulthood, especially the whooping-cough piece.',
    sideEffects: 'Arm soreness is common. Occasional mild fever.',
    aliases: ['Adult Tdap', 'Boostrix'],
  },
  td: {
    diseaseIds: ['tetanus', 'diphtheria'],
    whyImportant:
      'Adult tetanus + diphtheria booster recommended every 10 years for lifelong protection.',
    sideEffects: 'Mild arm soreness.',
    aliases: ['Td'],
  },
  hib: {
    diseaseIds: ['hib'],
    whyImportant:
      'Prevents Hib meningitis and pneumonia, which killed or disabled thousands of under-5s before this vaccine.',
    sideEffects: 'Mild soreness. Low-grade fever possible.',
    aliases: ['Haemophilus influenzae type B'],
  },
  rotavirus: {
    diseaseIds: ['rotavirus'],
    whyImportant:
      'Oral drops that prevent the most common cause of severe diarrhoea in babies. India produces its own low-cost version.',
    sideEffects: 'Very rare — mild irritability or temporary diarrhoea. Not given after 32 weeks of age.',
    aliases: ['RVV', 'Rotarix', 'Rotateq', 'Rotavac'],
  },
  pcv: {
    diseaseIds: ['pneumococcal'],
    whyImportant:
      'The strongest protection against pneumonia and bacterial meningitis in young children.',
    sideEffects: 'Fever and arm soreness for a day or two is common.',
    aliases: ['Pneumococcal conjugate vaccine', 'PCV13', 'Prevnar'],
  },
  influenza: {
    diseaseIds: ['influenza'],
    whyImportant:
      'A yearly flu shot is the only reliable protection — the virus changes each season, so last year\'s immunity does not carry over.',
    sideEffects: 'Mild soreness at the injection site. Fever occasionally in the first 24 hours.',
    aliases: ['Flu shot', 'IIV', 'Fluarix', 'Vaxigrip'],
  },
  mmr: {
    diseaseIds: ['measles', 'mumps', 'rubella'],
    whyImportant:
      'Two doses give around 97% protection against measles — still one of India\'s most dangerous childhood infections.',
    sideEffects: 'Mild fever and a faint rash 7–10 days after the dose is normal and short-lived.',
    aliases: ['Measles–Mumps–Rubella'],
  },
  mr: {
    diseaseIds: ['measles', 'rubella'],
    whyImportant:
      'The MR shot given under India\'s UIP — same protection as MMR for measles and rubella.',
    sideEffects: 'Mild fever and a faint rash 7–10 days later is normal.',
    aliases: ['Measles–Rubella'],
  },
  typhoid: {
    diseaseIds: ['typhoid'],
    whyImportant:
      'TCV protects from 6 months onwards and lasts for years. Important in India where typhoid is still common.',
    sideEffects: 'Mild soreness. Low-grade fever possible.',
    aliases: ['TCV', 'Typbar-TCV'],
  },
  hepa: {
    diseaseIds: ['hepa'],
    whyImportant:
      'Hepatitis A spreads via contaminated food and water — this vaccine prevents weeks of jaundice and liver inflammation.',
    sideEffects: 'Mild arm soreness.',
    aliases: ['Hep A', 'HAV', 'Havrix'],
  },
  varicella: {
    diseaseIds: ['varicella'],
    whyImportant:
      'Two doses prevent most chickenpox cases, and vaccinated kids who still catch it get a milder form.',
    sideEffects: 'Mild rash or soreness at the site; sometimes a few blisters 1–2 weeks later.',
    aliases: ['Chickenpox vaccine', 'Varilrix', 'Varivax'],
  },
  hpv: {
    diseaseIds: ['hpv'],
    whyImportant:
      'Given between 9 and 14 years — prevents up to 90% of future cervical cancers in women.',
    sideEffects: 'Arm soreness is common. Occasionally feel faint right after — the clinic will ask you to wait 15 minutes.',
    aliases: ['Human papillomavirus', 'Gardasil', 'Cervavac'],
  },
  meningo: {
    diseaseIds: ['meningo'],
    whyImportant:
      'Recommended for Haj pilgrims, hostel-bound students, and travel to outbreak regions. Not part of routine schedules in India.',
    sideEffects: 'Mild soreness. Occasional low-grade fever.',
    aliases: ['Meningococcal', 'MCV4', 'Menactra'],
  },
  je: {
    diseaseIds: ['je'],
    whyImportant:
      'Routine in JE-endemic districts (UP, Bihar, Assam, West Bengal and others). A mosquito-borne brain infection that can leave lasting damage.',
    sideEffects: 'Mild soreness. Fever uncommon.',
    aliases: ['Japanese encephalitis'],
  },
  cholera: {
    diseaseIds: ['cholera'],
    whyImportant:
      'Oral vaccine for high-risk areas and outbreaks — not part of routine schedules.',
    sideEffects: 'Essentially none.',
    aliases: ['OCV', 'Shanchol'],
  },
  vitaminA: {
    diseaseIds: ['vitaminA'],
    whyImportant:
      'Not a vaccine but a routine supplement — prevents vitamin A deficiency, night blindness, and reduces severity of infections.',
    sideEffects: 'Essentially none at routine doses.',
    aliases: ['Vit A', 'Retinol dose'],
  },
  // Combination vaccines mapped to all three families they cover.
  pentavalent: {
    diseaseIds: ['diphtheria', 'tetanus', 'pertussis', 'hepb', 'hib'],
    whyImportant:
      "India's UIP uses a single 5-in-1 shot — DPT + Hep B + Hib — to cut the number of jabs per visit.",
    sideEffects: 'Fever and fussiness for 1–2 days are common. Call the paediatrician if fever stays above 39°C.',
    aliases: ['Penta', '5-in-1', 'Pentavac'],
  },
  fipv: {
    diseaseIds: ['polio'],
    whyImportant:
      "A fractional dose of IPV given intra-dermally — a dose-sparing option UIP uses to extend supply.",
    sideEffects: 'Mild soreness at the site.',
    aliases: ['fractional IPV', 'fIPV'],
  },
};

/**
 * Map a schedule vaccine id (iap-dtp-1, nis-penta-2, …) to a family key.
 * Returns undefined if the id is unknown — callers should fall back to
 * the Vaccine.description from the schedule row.
 */
export function familyForVaccineId(id: string): string | undefined {
  // Strip the schedule prefix (iap-/nis-) to make the suffix easier to match.
  const suffix = id.replace(/^(iap|nis)-/, '');

  // Direct starts-with checks, longest-prefix first so 'rota' doesn't beat 'rotavirus'.
  const prefixMap: Array<[string, string]> = [
    ['pentavalent', 'pentavalent'],
    ['penta', 'pentavalent'],
    ['bcg', 'bcg'],
    ['hepb-birth', 'hepb'],
    ['hepb', 'hepb'],
    ['hepa', 'hepa'],
    ['opv', 'opv'],
    ['fipv', 'fipv'],
    ['ipv', 'ipv'],
    ['hib', 'hib'],
    ['rota', 'rotavirus'],
    ['rvv', 'rotavirus'],
    ['pcv', 'pcv'],
    ['iiv', 'influenza'],
    ['flu', 'influenza'],
    ['mmr', 'mmr'],
    ['mr', 'mr'],
    ['varicella', 'varicella'],
    ['hpv', 'hpv'],
    ['tcv', 'typhoid'],
    ['typhoid', 'typhoid'],
    ['tdap', 'tdap'],
    ['td-', 'td'],
    ['dtp', 'dtp'],
    ['dpt', 'dtp'],
    ['je', 'je'],
    ['meningo', 'meningo'],
    ['vita', 'vitaminA'],
    ['cholera', 'cholera'],
  ];

  for (const [prefix, family] of prefixMap) {
    if (suffix.startsWith(prefix)) return family;
  }
  return undefined;
}

export function getEnrichment(vaccineId: string): VaccineFamilyEnrichment | undefined {
  const family = familyForVaccineId(vaccineId);
  if (!family) return undefined;
  return VACCINE_ENRICHMENTS[family];
}
