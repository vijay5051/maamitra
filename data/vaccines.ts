export interface Vaccine {
  id: string;
  name: string;
  shortName: string;
  description: string;
  daysFromBirth: number;
  ageLabel: string;
  category: string;
}

export const VACCINE_SCHEDULE: Vaccine[] = [
  {
    id: 'v01',
    name: 'BCG + OPV0 + Hepatitis B',
    shortName: 'BCG + OPV0 + Hep B',
    description:
      'Given at birth, protects against TB, Polio, and Hepatitis B. BCG is administered as a single intradermal injection; OPV0 and Hep B are given orally and by injection respectively.',
    daysFromBirth: 0,
    ageLabel: 'Birth',
    category: 'Birth Doses',
  },
  {
    id: 'v02',
    name: 'OPV1 + Pentavalent Dose 1 + Rotavirus Dose 1 + PCV Dose 1',
    shortName: 'OPV1 + Pentavalent1 + Rotavirus1 + PCV1',
    description:
      'First set of combination vaccines given at 6 weeks of age. Pentavalent covers Diphtheria, Pertussis, Tetanus, Hepatitis B, and Hib. PCV protects against pneumococcal diseases.',
    daysFromBirth: 42,
    ageLabel: '6 Weeks',
    category: 'Primary Series',
  },
  {
    id: 'v03',
    name: 'OPV2 + Pentavalent Dose 2 + Rotavirus Dose 2 + PCV Dose 2',
    shortName: 'OPV2 + Pentavalent2 + Rotavirus2 + PCV2',
    description:
      'Second dose of combination vaccines given at 10 weeks. Continuing the primary immunisation series builds stronger immunity against multiple serious diseases.',
    daysFromBirth: 70,
    ageLabel: '10 Weeks',
    category: 'Primary Series',
  },
  {
    id: 'v04',
    name: 'OPV3 + Pentavalent Dose 3 + Rotavirus Dose 3 + PCV Dose 3 + IPV Dose 1',
    shortName: 'OPV3 + Pentavalent3 + Rotavirus3 + PCV3 + IPV1',
    description:
      'Completing the primary vaccine series at 14 weeks. IPV (Inactivated Polio Vaccine) is added for enhanced polio protection alongside the oral drops.',
    daysFromBirth: 98,
    ageLabel: '14 Weeks',
    category: 'Primary Series',
  },
  {
    id: 'v05',
    name: 'Vitamin A — 1st Dose',
    shortName: 'Vitamin A (1st dose)',
    description:
      'Essential for healthy vision and immunity. A single oral dose of 1,00,000 IU is given at 9 months alongside MR and JE vaccines, markedly reducing child mortality from infections.',
    daysFromBirth: 270,
    ageLabel: '9 Months',
    category: 'Nutritional Supplements',
  },
  {
    id: 'v06',
    name: 'MR Dose 1 + Japanese Encephalitis Dose 1',
    shortName: 'MR1 + JE1',
    description:
      'Protection against Measles, Rubella, and Japanese Encephalitis. These are given together at 9 months as part of the national immunisation schedule to prevent dangerous viral diseases.',
    daysFromBirth: 270,
    ageLabel: '9 Months',
    category: 'Primary Series',
  },
  {
    id: 'v07',
    name: 'Varicella Dose 1',
    shortName: 'Varicella 1',
    description:
      'Chickenpox vaccine, first dose. Given at 15 months, this live attenuated vaccine provides strong protection against varicella infection and its complications such as bacterial superinfection.',
    daysFromBirth: 450,
    ageLabel: '15 Months',
    category: 'Primary Series',
  },
  {
    id: 'v08',
    name: 'MR Dose 2 + Japanese Encephalitis Dose 2',
    shortName: 'MR2 + JE2',
    description:
      'Booster for Measles, Rubella, and Japanese Encephalitis. The second dose at 15 months ensures long-lasting immunity and closes immunity gaps for children who may not have responded fully to the first dose.',
    daysFromBirth: 450,
    ageLabel: '15 Months',
    category: 'Boosters',
  },
  {
    id: 'v09',
    name: 'OPV Booster + Pentavalent Booster + PCV Booster',
    shortName: 'OPV Booster + Pentavalent Booster + PCV Booster',
    description:
      'Booster doses for long-term protection given between 16–18 months. Reinforces immunity against Polio, Diphtheria, Pertussis, Tetanus, Hepatitis B, Hib, and Pneumococcal disease.',
    daysFromBirth: 510,
    ageLabel: '16–18 Months',
    category: 'Boosters',
  },
  {
    id: 'v10',
    name: 'Vitamin A — 2nd to 9th Doses',
    shortName: 'Vitamin A (2nd–9th doses)',
    description:
      'Administered every 6 months from 18 months until 5 years of age. Each dose of 2,00,000 IU supports immune health, eye health, and reduces childhood mortality from common infections.',
    daysFromBirth: 540,
    ageLabel: '18 Months to 5 Years',
    category: 'Nutritional Supplements',
  },
  {
    id: 'v11',
    name: 'Td / DPT Booster',
    shortName: 'Td/DPT Booster',
    description:
      'School entry booster for Tetanus, Diphtheria, and Pertussis given between 4–6 years. This booster top-up ensures children are protected before they enter group-living environments like school.',
    daysFromBirth: 1460,
    ageLabel: '4–6 Years',
    category: 'Boosters',
  },
];
