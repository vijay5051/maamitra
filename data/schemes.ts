export interface GovernmentScheme {
  id: string;
  emoji: string;
  name: string;
  shortDesc: string;
  description: string;
  eligibility: string;
  benefit: string;
  url: string;
}

export const GOVERNMENT_SCHEMES: GovernmentScheme[] = [
  {
    id: 'gs01',
    emoji: '💰',
    name: 'Janani Suraksha Yojana (JSY)',
    shortDesc: '₹1,400 cash incentive for institutional delivery',
    description:
      'Janani Suraksha Yojana is a safe motherhood intervention under the National Health Mission. It promotes institutional deliveries among pregnant women from below poverty line (BPL) households to reduce maternal and neonatal mortality. The scheme provides direct cash assistance to encourage women to deliver at government or accredited private health facilities.',
    eligibility:
      'Pregnant women belonging to BPL households, SC/ST communities, or those aged below 19 years in all states. All pregnant women in low-performing states (LPS) are eligible regardless of BPL status.',
    benefit:
      '₹1,400 cash benefit for rural women and ₹1,000 for urban women in high-performing states (HPS). In low-performing states, ₹1,400 for rural and ₹1,000 for urban deliveries. Additional ASHA incentive of ₹600 in rural LPS and ₹400 in urban LPS areas.',
    url: 'https://nhm.gov.in/index1.php?lang=1&level=3&sublinkid=841&lid=309',
  },
  {
    id: 'gs02',
    emoji: '🤱',
    name: 'Pradhan Mantri Matru Vandana Yojana (PMMVY)',
    shortDesc: '₹5,000 maternity benefit in 3 instalments for first live birth',
    description:
      'PMMVY is a maternity benefit programme that provides partial wage compensation to women for the wage loss during pregnancy and after childbirth. It also contributes to improved health-seeking behaviour and nutritional status of pregnant women and lactating mothers. The scheme aims to reduce the incidence of low birth weight and malnutrition among children.',
    eligibility:
      'All pregnant women and lactating mothers (PW&LM) expecting their first live birth, except those employed with the Central or State Government who are already entitled to maternity benefits.',
    benefit:
      '₹5,000 in three instalments: ₹1,000 on early registration of pregnancy, ₹2,000 after at least one antenatal check-up after 6 months of pregnancy, and ₹2,000 after registration of child birth and completing first cycle of vaccination.',
    url: 'https://wcd.nic.in/schemes/pradhan-mantri-matru-vandana-yojana',
  },
  {
    id: 'gs03',
    emoji: '🏥',
    name: 'Rashtriya Bal Swasthya Karyakram (RBSK)',
    shortDesc: 'Free health screening for children 0–18 years',
    description:
      'RBSK is a national child health screening and early intervention programme that screens children from birth to 18 years for 4Ds — Defects at birth, Diseases, Deficiencies, and Developmental delays, including Disabilities. Mobile health teams visit schools and Anganwadi centres to screen all children, and those with identified conditions are referred for free treatment.',
    eligibility:
      'All children from birth to 18 years of age. Screening covers children at government and government-aided schools, Anganwadi centres, and newborns through delivery points at public health facilities.',
    benefit:
      'Free screening for 30 conditions including congenital heart disease, hearing loss, vision impairment, nutritional deficiencies, autism, developmental delays, and more. Identified children are referred to District Early Intervention Centres (DEICs) for free corrective treatment, surgery, or therapy.',
    url: 'https://rbsk.gov.in',
  },
  {
    id: 'gs04',
    emoji: '🥗',
    name: 'Poshan Abhiyan',
    shortDesc: 'Free nutritional supplements for children under 6 and pregnant/lactating mothers',
    description:
      "Poshan Abhiyan (National Nutrition Mission) is India's flagship programme to improve nutritional outcomes for children under 6 years, pregnant women, and lactating mothers. Launched in 2018, it uses technology, convergence of government schemes, and community mobilisation to combat stunting, wasting, undernutrition, and anaemia across the country.",
    eligibility:
      'Children under 6 years, pregnant women, and lactating mothers across India, with priority for those in high-burden districts and tribal areas. Services are delivered through Anganwadi centres under the Integrated Child Development Services (ICDS) scheme.',
    benefit:
      'Free take-home rations, supplementary nutrition, growth monitoring, nutrition and health education, and referral services. Pregnant and lactating mothers receive monthly nutritional supplements including Iron and Folic Acid tablets. Children 6 months to 6 years receive hot cooked meals at Anganwadi centres.',
    url: 'https://poshanabhiyaan.gov.in',
  },
  {
    id: 'gs05',
    emoji: '💰',
    name: 'Sukanya Samriddhi Yojana',
    shortDesc: 'High-interest savings scheme for girl child',
    description:
      "Sukanya Samriddhi Yojana (SSY) is a government-backed small savings scheme under the 'Beti Bachao Beti Padhao' initiative. It offers one of the highest interest rates among fixed income small savings schemes and provides tax benefits, making it an excellent long-term savings vehicle for a girl child's education and marriage expenses.",
    eligibility:
      'A parent or legal guardian can open an SSY account for a girl child up to the age of 10 years. Only one account is allowed per girl child, and a family can open accounts for a maximum of two girl children (three in case of twins/triplets as the second birth).',
    benefit:
      'Current interest rate of 8.2% per annum (subject to quarterly government revision), compounded annually. Minimum annual deposit of ₹250; maximum of ₹1.5 lakh per year. Tax exemption under Section 80C on deposits up to ₹1.5 lakh. The account matures when the girl turns 21 years old or upon marriage after the age of 18.',
    url: 'https://www.indiapost.gov.in/Financial/pages/content/Sukanya.aspx',
  },
  {
    id: 'gs06',
    emoji: '💊',
    name: 'Anemia Mukt Bharat',
    shortDesc: 'Free Iron + Folic Acid supplements for pregnant women, children, and adolescents',
    description:
      'Anemia Mukt Bharat (Anaemia-Free India) is a national programme aimed at reducing the prevalence of anaemia among six key beneficiary groups — children aged 6–59 months, children aged 5–9 years, adolescents aged 10–19 years, pregnant women, lactating mothers, and women of reproductive age. The programme uses a 6x6x6 strategy: six beneficiary groups, six interventions, and six institutional mechanisms.',
    eligibility:
      'All pregnant women, lactating mothers, children aged 6 months to 14 years, and adolescent girls and boys aged 10–19 years are eligible for free supplements through government health facilities, schools, and Anganwadi centres.',
    benefit:
      'Free Iron and Folic Acid (IFA) supplementation: daily IFA tablets for pregnant and lactating mothers; weekly IFA supplementation for children 5–9 years and adolescents through schools; bi-weekly IFA syrup for children 6–59 months. Accompanied by deworming, dietary counselling, and POSHAN Abhiyan convergence activities.',
    url: 'https://anemiamuktbharat.info',
  },
];
