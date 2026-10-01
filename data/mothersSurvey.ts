// Mothers survey — "Everyday experiences of mothers with babies and toddlers".
//
// A public, no-login research survey served at /mothers-survey. It asks about
// the motherhood journey only — never about MaaMitra itself. The 10 questions
// are condensed from the 26-question research questionnaire.
//
// Option `key`s are what gets stored in Firestore, so they must stay stable:
// reword a `label` freely, but never rename or reuse a key. If the question
// set changes meaningfully, bump MOTHERS_SURVEY_VERSION so the admin screen
// can tell old responses from new ones.

export const MOTHERS_SURVEY_VERSION = 1;

export type SurveyQuestionType = 'single' | 'multi';

export interface SurveyOption {
  key: string;
  label: string;
  /** Multi-select only: choosing this clears every other choice. */
  exclusive?: boolean;
}

export interface SurveyQuestion {
  id: string;
  section: string;
  text: string;
  /** Short label for admin charts and CSV headers. */
  short: string;
  type: SurveyQuestionType;
  /** Multi-select only: the most options a mother may pick. */
  max?: number;
  options: SurveyOption[];
}

export const MOTHERS_SURVEY_INTRO = {
  title: 'Your motherhood journey',
  body:
    'We want to understand the everyday experiences, challenges, and support needs of Indian mothers. ' +
    'There are 10 short questions and it takes about 3 minutes. Taking part is voluntary, and you may skip any question. ' +
    'Please answer about your youngest child.',
  consent: 'I am 18 or older and I am happy to take part.',
  privacy:
    'Your answers are anonymous unless you choose to share your contact details at the end. ' +
    'They are used only to understand where mothers need better everyday support.',
};

export const MOTHERS_SURVEY_CLOSING =
  'Thank you for sharing your experience. Your answers will help us understand where mothers need better everyday support.';

export const MOTHERS_SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'child_age',
    section: 'About you',
    text: 'How old is your youngest child?',
    short: 'Youngest child’s age',
    type: 'single',
    options: [
      { key: 'under_3m', label: 'Under 3 months' },
      { key: '3_5m', label: '3–5 months' },
      { key: '6_11m', label: '6–11 months' },
      { key: '12_23m', label: '12–23 months' },
      { key: '2_3y', label: '2–3 years' },
      { key: 'over_3y', label: 'Older than 3 years' },
    ],
  },
  {
    id: 'first_child',
    section: 'About you',
    text: 'Is this your first child?',
    short: 'First child',
    type: 'single',
    options: [
      { key: 'yes', label: 'Yes' },
      { key: 'no', label: 'No' },
      { key: 'no_say', label: 'Prefer not to say' },
    ],
  },
  {
    id: 'location',
    section: 'About you',
    text: 'Where do you currently live?',
    short: 'Where she lives',
    type: 'single',
    options: [
      { key: 'metro', label: 'Metro city' },
      { key: 'city_town', label: 'Other city or town' },
      { key: 'rural', label: 'Village or rural area' },
      { key: 'outside_india', label: 'Outside India' },
      { key: 'no_say', label: 'Prefer not to say' },
    ],
  },
  {
    id: 'routine',
    section: 'About you',
    text: 'Which best describes your current daily routine?',
    short: 'Daily routine',
    type: 'single',
    options: [
      { key: 'home', label: 'Mainly childcare and household responsibilities' },
      { key: 'work_outside', label: 'Paid work mainly outside the home' },
      { key: 'work_home', label: 'Paid work mainly from home' },
      { key: 'work_both', label: 'Paid work both at home and outside' },
      { key: 'maternity_leave', label: 'On maternity leave' },
      { key: 'studying', label: 'Studying' },
      { key: 'other', label: 'Another situation' },
      { key: 'no_say', label: 'Prefer not to say' },
    ],
  },
  {
    id: 'feeling',
    section: 'Everyday experiences',
    text: 'How has motherhood felt for you overall?',
    short: 'How motherhood feels',
    type: 'single',
    options: [
      { key: 'mostly_positive', label: 'Mostly positive and manageable' },
      { key: 'positive_some_hard', label: 'Positive, with some difficult periods' },
      { key: 'equal_mix', label: 'An equal mix of positive and difficult experiences' },
      { key: 'mostly_difficult', label: 'Mostly difficult' },
      { key: 'changes', label: 'My experience changes too much to choose' },
      { key: 'no_say', label: 'Prefer not to say' },
    ],
  },
  {
    id: 'challenges',
    section: 'Everyday experiences',
    text: 'Which areas have been challenging during the past two weeks?',
    short: 'Challenges (past 2 weeks)',
    type: 'multi',
    max: 5,
    options: [
      { key: 'sleep', label: 'Interrupted sleep or lack of rest' },
      { key: 'own_health', label: 'Physical recovery or my own health' },
      { key: 'stress', label: 'Stress, worry, or feeling overwhelmed' },
      { key: 'lonely', label: 'Feeling lonely or unsupported' },
      { key: 'milk_feeding', label: 'Breastfeeding or other milk-feeding concerns' },
      { key: 'solids', label: 'Starting solids or managing food reactions' },
      { key: 'picky_meals', label: 'Picky eating or preparing meals' },
      { key: 'crying_behaviour', label: 'Understanding my child’s crying or behaviour' },
      { key: 'growth_milestones', label: 'Understanding growth or developmental milestones' },
      { key: 'illness', label: 'Managing illness, medicines, or appointments' },
      { key: 'trusted_advice', label: 'Finding trustworthy advice' },
      { key: 'conflicting_advice', label: 'Conflicting advice from others' },
      { key: 'household', label: 'Managing household responsibilities' },
      { key: 'work_balance', label: 'Balancing motherhood and paid work or study' },
      { key: 'money', label: 'Financial pressure' },
      { key: 'childcare', label: 'Finding reliable childcare' },
      { key: 'me_time', label: 'Finding time for myself' },
      { key: 'other', label: 'Another challenge' },
      { key: 'none', label: 'None of these', exclusive: true },
    ],
  },
  {
    id: 'top_help',
    section: 'Everyday experiences',
    text: 'Which ONE area would you most like help with?',
    short: 'Most wants help with',
    type: 'single',
    options: [
      { key: 'sleep', label: 'Sleep and rest' },
      { key: 'own_health', label: 'My physical health or recovery' },
      { key: 'emotional', label: 'My emotional wellbeing' },
      { key: 'feeding', label: 'Feeding my baby' },
      { key: 'solids_meals', label: 'Solids, food reactions, or meal preparation' },
      { key: 'behaviour', label: 'My child’s behaviour' },
      { key: 'growth', label: 'Growth or development' },
      { key: 'illness', label: 'Illness and healthcare' },
      { key: 'information', label: 'Reliable information' },
      { key: 'support', label: 'Childcare or household support' },
      { key: 'work_balance', label: 'Work or study balance' },
      { key: 'money', label: 'Financial needs' },
      { key: 'me_time', label: 'Time for myself' },
      { key: 'other', label: 'Another area' },
      { key: 'none', label: 'I don’t currently need help' },
    ],
  },
  {
    id: 'self_time',
    section: 'Your wellbeing',
    text: 'During the past two weeks, how often have you had time for your own wellbeing?',
    short: 'Time for own wellbeing',
    type: 'single',
    options: [
      { key: 'every_day', label: 'Every day' },
      { key: 'several_days', label: 'Several days a week' },
      { key: 'weekly', label: 'About once a week' },
      { key: 'less_weekly', label: 'Less than once a week' },
      { key: 'not_at_all', label: 'Not at all' },
      { key: 'no_say', label: 'Prefer not to say' },
    ],
  },
  {
    id: 'organising',
    section: 'Organising your child’s care',
    text: 'What feels difficult about keeping track of your child’s care?',
    short: 'Hard to keep track of',
    type: 'multi',
    max: 3,
    options: [
      { key: 'vaccine_dates', label: 'Remembering appointments or vaccination dates' },
      { key: 'medicines', label: 'Remembering medicine instructions or times' },
      { key: 'one_place', label: 'Keeping records in one place' },
      { key: 'regular', label: 'Recording information regularly' },
      { key: 'growth_charts', label: 'Understanding growth charts or milestones' },
      { key: 'foods', label: 'Remembering foods tried or reactions' },
      { key: 'coordinating', label: 'Coordinating care with family or caregivers' },
      { key: 'doctor_visit', label: 'Finding records during a doctor’s visit' },
      { key: 'other', label: 'Another difficulty' },
      { key: 'nothing', label: 'Nothing currently feels difficult', exclusive: true },
    ],
  },
  {
    id: 'one_change',
    section: 'Looking ahead',
    text: 'If ONE thing could change to make your daily life easier, what would you choose?',
    short: 'One change that would help',
    type: 'single',
    options: [
      { key: 'sleep', label: 'More uninterrupted sleep' },
      { key: 'childcare_help', label: 'More help with childcare' },
      { key: 'less_housework', label: 'Less household workload' },
      { key: 'physical_health', label: 'Better support for my physical health' },
      { key: 'emotional_support', label: 'Better emotional support' },
      { key: 'feeding', label: 'Easier feeding or mealtimes' },
      { key: 'healthcare', label: 'Easier access to healthcare' },
      { key: 'advice', label: 'Clearer, more trustworthy advice' },
      { key: 'records', label: 'Easier organisation of child-related records and tasks' },
      { key: 'flexibility', label: 'More flexibility at work or in studies' },
      { key: 'money', label: 'Less financial pressure' },
      { key: 'me_time', label: 'More time for myself' },
      { key: 'other', label: 'Another change' },
      { key: 'none', label: 'No change needed right now' },
    ],
  },
];

export type SurveyAnswers = Record<string, string | string[]>;

/** Label for a stored option key, falling back to the key for retired options. */
export function surveyOptionLabel(q: SurveyQuestion, key: string): string {
  return q.options.find((o) => o.key === key)?.label ?? key;
}
