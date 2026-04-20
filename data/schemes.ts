import type { Audience } from './audience';

export interface GovernmentScheme {
  id: string;
  emoji: string;
  name: string;
  shortName: string;
  shortDesc: string;
  description: string;
  eligibility: string;
  benefit: string;
  howToApply: string;
  url: string;
  // relevance tags: 'pregnant' | 'newborn' | 'girl' | 'all-kids' | 'all'
  tags: string[];
  /** Parent-role audience. Most schemes apply to mothers directly
   *  (maternity benefits) — tag accordingly as content is curated. */
  audience?: Audience;
}

export const GOVERNMENT_SCHEMES: GovernmentScheme[] = [
  {
    id: 'gs01',
    emoji: '💰',
    name: 'Janani Suraksha Yojana (JSY)',
    shortName: 'JSY',
    shortDesc: '₹1,400 cash for institutional delivery',
    description:
      'JSY promotes safe institutional deliveries for BPL families. The cash incentive is paid directly to the mother to cover transport and delivery costs at government or accredited private hospitals — reducing maternal and newborn mortality.',
    eligibility:
      'Pregnant women from BPL households, SC/ST communities, or below 19 years of age. In low-performing states (UP, Bihar, MP, Rajasthan, etc.) ALL pregnant women qualify regardless of BPL status.',
    benefit:
      '₹1,400 for rural women and ₹1,000 for urban women (higher-performing states). In low-performing states: ₹1,400 rural / ₹1,000 urban. ASHA worker gets an additional ₹600 incentive for facilitating the delivery.',
    howToApply:
      'Register at your nearest government Primary Health Centre (PHC) or Anganwadi centre during pregnancy. Carry your BPL card, Aadhaar, and Mamta card. The payment is transferred directly to your bank account after delivery.',
    url: 'https://nhm.gov.in/index1.php?lang=1&level=3&sublinkid=841&lid=309',
    tags: ['pregnant'],
    audience: 'mother',
  },
  {
    id: 'gs02',
    emoji: '🤱',
    name: 'Pradhan Mantri Matru Vandana Yojana (PMMVY)',
    shortName: 'PMMVY',
    shortDesc: '₹5,000 maternity benefit in 3 instalments',
    description:
      'PMMVY provides partial wage compensation to pregnant and lactating mothers to help them rest and recover without financial pressure. The scheme supports better nutrition and health-seeking behaviour during and after pregnancy.',
    eligibility:
      'All pregnant women and lactating mothers expecting their first live birth. Women employed with Central or State Government who already receive paid maternity leave are not eligible.',
    benefit:
      '₹5,000 in three instalments: ₹1,000 on early pregnancy registration, ₹2,000 after first antenatal check-up (after 6 months), and ₹2,000 after child birth registration and first vaccination cycle.',
    howToApply:
      'Apply at your nearest Anganwadi centre or approved health facility within the first trimester. Carry your Aadhaar, bank passbook, and MCP (Mother Child Protection) card. Forms available at AWC, PHC, or online at pmmvy-cas.nic.in.',
    url: 'https://wcd.nic.in/schemes/pradhan-mantri-matru-vandana-yojana',
    tags: ['pregnant', 'newborn'],
    audience: 'mother',
  },
  {
    id: 'gs03',
    emoji: '🏥',
    name: 'Rashtriya Bal Swasthya Karyakram (RBSK)',
    shortName: 'RBSK',
    shortDesc: 'Free developmental screening for children 0–18 years',
    description:
      'RBSK screens children for 4Ds — Defects at birth, Diseases, Deficiencies, and Developmental delays. Mobile health teams visit Anganwadi centres and schools. Children with issues are referred to District Early Intervention Centres (DEICs) for free corrective treatment, surgery, or therapy.',
    eligibility:
      'All children from birth to 18 years. Newborns are screened at delivery points; infants and children under 6 are screened at Anganwadi centres; school-age children are screened at government and government-aided schools.',
    benefit:
      'Free screening for 30+ conditions including congenital heart disease, hearing loss, vision impairment, cleft lip/palate, autism, cerebral palsy, and nutritional deficiencies. Free referral treatment, corrective surgeries, and rehabilitation at DEICs.',
    howToApply:
      'No application needed — screening teams visit Anganwadi centres and schools automatically. For newborns, inform the hospital staff. You can also contact your local DEIC directly or ask your Anganwadi worker to register your child.',
    url: 'https://rbsk.gov.in',
    tags: ['newborn', 'all-kids'],
    audience: 'all',
  },
  {
    id: 'gs04',
    emoji: '🥗',
    name: 'Poshan Abhiyan',
    shortName: 'Poshan Abhiyan',
    shortDesc: 'Free nutrition supplements & growth monitoring',
    description:
      "India's flagship nutrition mission combating stunting, wasting, and anaemia. Delivered through Anganwadi centres across India, Poshan Abhiyan uses community mobilisation and technology to improve nutritional outcomes for mothers and young children under 6.",
    eligibility:
      'Children under 6 years, pregnant women, and lactating mothers across all states. Priority for those in high-burden districts and tribal areas. Services are delivered through your nearest Anganwadi centre under ICDS.',
    benefit:
      'Free take-home rations, supplementary nutrition (hot meals at AWC for 6mo–6yr children), Iron & Folic Acid tablets for mothers, growth monitoring, nutrition counselling, and referral services.',
    howToApply:
      'Visit your nearest Anganwadi centre and register with the Anganwadi Worker (AWW). Carry your Aadhaar and the child\'s birth certificate. Services begin from pregnancy and continue until the child turns 6.',
    url: 'https://poshanabhiyaan.gov.in',
    tags: ['pregnant', 'newborn', 'all-kids'],
    audience: 'all',
  },
  {
    id: 'gs05',
    emoji: '🌸',
    name: 'Sukanya Samriddhi Yojana (SSY)',
    shortName: 'SSY',
    shortDesc: '8.2% interest savings account for your daughter',
    description:
      "SSY is a government-backed savings scheme under 'Beti Bachao Beti Padhao' offering one of the highest interest rates among small savings instruments. The account matures when your daughter turns 21, making it ideal for higher education and marriage expenses.",
    eligibility:
      'Parents or legal guardians of a girl child up to age 10. Maximum two SSY accounts per family (three in case of twins or triplets). Account can be opened at any post office or authorised bank.',
    benefit:
      '8.2% per annum interest, compounded annually. Minimum ₹250/year, maximum ₹1.5 lakh/year. Full tax exemption under Section 80C. Partial withdrawal (up to 50%) allowed after girl turns 18 for education. Matures at 21 years.',
    howToApply:
      'Visit your nearest Post Office or banks like SBI, HDFC, ICICI, or PNB. Carry the girl\'s birth certificate, your Aadhaar, PAN, and address proof. Open with a minimum deposit of ₹250.',
    url: 'https://www.indiapost.gov.in/Financial/pages/content/Sukanya.aspx',
    tags: ['girl'],
    audience: 'all',
  },
  {
    id: 'gs06',
    emoji: '💊',
    name: 'Anemia Mukt Bharat',
    shortName: 'Anemia Mukt Bharat',
    shortDesc: 'Free Iron & Folic Acid supplements for mothers & children',
    description:
      'A national programme targeting anaemia across six groups including pregnant women, lactating mothers, children, and adolescents. Uses a 6×6×6 strategy — six beneficiaries, six interventions, six mechanisms — alongside deworming, dietary counselling, and POSHAN Abhiyan.',
    eligibility:
      'All pregnant women, lactating mothers, children aged 6 months to 14 years, and adolescents (10–19 years). Available through government hospitals, PHCs, Anganwadi centres, and schools — no income criteria.',
    benefit:
      'Daily IFA tablets for pregnant and lactating mothers; bi-weekly IFA syrup for children 6–59 months; weekly IFA for children 5–9 years and adolescents. All provided free through government health facilities.',
    howToApply:
      'Ask at your nearest government hospital, PHC, or Anganwadi centre. Supplements are distributed free — no application form required. Your Anganwadi worker or ASHA can deliver to your home in most areas.',
    url: 'https://anemiamuktbharat.info',
    tags: ['pregnant', 'newborn', 'all-kids'],
    audience: 'all',
  },
];
