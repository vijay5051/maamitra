// Diseases that childhood vaccines protect against.
// Each entry is a short, parent-friendly explanation — enough to answer
// "what's this one for?" without pretending to be medical advice.
//
// Source cross-check: WHO fact sheets, CDC Vaccine Information Statements,
// IAP ACVIP 2023 schedule rationale. Reviewed for accessibility (no jargon
// without an immediate plain-English gloss).

export type DiseaseSeverity = 'serious' | 'severe' | 'preventable';

export interface Disease {
  id: string;
  name: string;
  /** Parent-friendly, one sentence. */
  oneLiner: string;
  /** Why it matters — one short line. */
  whyItMatters: string;
  severity: DiseaseSeverity;
}

export const DISEASES: Record<string, Disease> = {
  tb: {
    id: 'tb',
    name: 'Tuberculosis',
    oneLiner: 'A serious bacterial infection that attacks the lungs and can spread to the brain and bones.',
    whyItMatters: 'TB meningitis in infants is often fatal — BCG at birth is the single best protection.',
    severity: 'severe',
  },
  polio: {
    id: 'polio',
    name: 'Polio',
    oneLiner: 'A virus that can paralyze a child for life, usually the legs, within hours of infection.',
    whyItMatters: 'India is polio-free since 2014. Keeping it that way needs every child vaccinated.',
    severity: 'severe',
  },
  hepb: {
    id: 'hepb',
    name: 'Hepatitis B',
    oneLiner: 'A virus that silently damages the liver and can lead to liver cancer decades later.',
    whyItMatters: 'Babies infected at birth have a 90% chance of lifelong infection. Vaccinated babies: under 5%.',
    severity: 'serious',
  },
  diphtheria: {
    id: 'diphtheria',
    name: 'Diphtheria',
    oneLiner: 'A bacterial infection that makes a thick coat in the throat, blocking breathing.',
    whyItMatters: 'Still kills 1 in 10 unvaccinated kids who catch it. Vaccination has nearly eliminated it.',
    severity: 'severe',
  },
  tetanus: {
    id: 'tetanus',
    name: 'Tetanus',
    oneLiner: "A bacteria from soil and rust that causes painful muscle spasms (also called 'lockjaw').",
    whyItMatters: 'A single untreated infection can be fatal within days. Boosters keep protection going.',
    severity: 'severe',
  },
  pertussis: {
    id: 'pertussis',
    name: 'Whooping cough',
    oneLiner: 'A violent cough that can last 10+ weeks — babies often turn blue and stop breathing.',
    whyItMatters: 'Most dangerous in babies under 6 months. Family members get the booster to protect newborns.',
    severity: 'severe',
  },
  hib: {
    id: 'hib',
    name: 'Hib (Haemophilus influenzae type B)',
    oneLiner: 'A common cause of meningitis and pneumonia in under-5s before vaccines.',
    whyItMatters: 'Pre-vaccine, Hib meningitis killed 1 in 20 kids and left many with brain damage.',
    severity: 'severe',
  },
  rotavirus: {
    id: 'rotavirus',
    name: 'Rotavirus',
    oneLiner: 'The commonest cause of severe diarrhoea and dehydration in babies under 2.',
    whyItMatters: 'Before the vaccine, rotavirus hospitalised lakhs of Indian children every year.',
    severity: 'serious',
  },
  pneumococcal: {
    id: 'pneumococcal',
    name: 'Pneumococcal disease',
    oneLiner: 'Bacteria that cause pneumonia, meningitis and severe ear infections in young children.',
    whyItMatters: 'A top killer of under-5s worldwide. PCV cut Indian under-5 pneumonia deaths sharply.',
    severity: 'severe',
  },
  influenza: {
    id: 'influenza',
    name: 'Flu (influenza)',
    oneLiner: 'A respiratory virus that comes back every season and is harsher in young children.',
    whyItMatters: 'A yearly shot is the only reliable protection — the virus changes every year.',
    severity: 'serious',
  },
  measles: {
    id: 'measles',
    name: 'Measles',
    oneLiner: 'A highly contagious rash and fever that can lead to pneumonia, brain swelling and death.',
    whyItMatters: 'India still has measles outbreaks. 2 doses of MMR give 97% protection.',
    severity: 'severe',
  },
  mumps: {
    id: 'mumps',
    name: 'Mumps',
    oneLiner: 'A viral infection that swells the salivary glands and can cause deafness or infertility.',
    whyItMatters: 'MMR covers this in the same shot — no extra visit needed.',
    severity: 'serious',
  },
  rubella: {
    id: 'rubella',
    name: 'Rubella (German measles)',
    oneLiner: "A mild rash in kids, but devastating if a pregnant mother catches it — causes birth defects.",
    whyItMatters: 'Girls especially: being vaccinated protects their future babies from Congenital Rubella Syndrome.',
    severity: 'serious',
  },
  typhoid: {
    id: 'typhoid',
    name: 'Typhoid',
    oneLiner: 'A gut infection spread by contaminated food and water — endemic across India.',
    whyItMatters: 'The newer TCV vaccine protects from 6 months onwards and lasts years.',
    severity: 'serious',
  },
  hepa: {
    id: 'hepa',
    name: 'Hepatitis A',
    oneLiner: 'A liver infection spread via contaminated food and water — common in Indian cities.',
    whyItMatters: 'Not as deadly as Hep B but can keep a child sick and jaundiced for weeks.',
    severity: 'preventable',
  },
  varicella: {
    id: 'varicella',
    name: 'Chickenpox',
    oneLiner: 'Itchy blisters covering the whole body — usually mild but very contagious.',
    whyItMatters: 'Vaccinated kids who do catch it get a milder case with far fewer complications.',
    severity: 'preventable',
  },
  hpv: {
    id: 'hpv',
    name: 'HPV (cervical cancer virus)',
    oneLiner: 'A common virus that can cause cervical cancer in women decades later.',
    whyItMatters: 'Given between 9 and 14 years, before any exposure, prevents up to 90% of cervical cancers.',
    severity: 'severe',
  },
  je: {
    id: 'je',
    name: 'Japanese encephalitis',
    oneLiner: 'A mosquito-borne brain infection endemic to parts of UP, Bihar, Assam and West Bengal.',
    whyItMatters: '1 in 3 who survive have lasting brain damage. Routine JE immunisation stops it.',
    severity: 'severe',
  },
  meningo: {
    id: 'meningo',
    name: 'Meningococcal disease',
    oneLiner: 'A fast-moving bacterial infection of the lining of the brain — can kill within hours.',
    whyItMatters: 'Recommended before travel to hostels, Haj or outbreaks. Not routine for most Indian kids.',
    severity: 'severe',
  },
  cholera: {
    id: 'cholera',
    name: 'Cholera',
    oneLiner: 'An intense diarrhoea spread by dirty water that can dehydrate a child dangerously fast.',
    whyItMatters: 'Mostly for high-risk areas and travel. Boils + bottled water help too.',
    severity: 'serious',
  },
  vitaminA: {
    id: 'vitaminA',
    name: 'Vitamin A deficiency',
    oneLiner: 'Not a vaccine but a routine dose — prevents night blindness and boosts infection recovery.',
    whyItMatters: 'Covered under UIP from 9 months to 5 years. Two doses a year.',
    severity: 'preventable',
  },
};

export function getDisease(id: string): Disease | undefined {
  return DISEASES[id];
}

export function getDiseases(ids: string[]): Disease[] {
  return ids
    .map((id) => DISEASES[id])
    .filter((d): d is Disease => d !== undefined);
}
