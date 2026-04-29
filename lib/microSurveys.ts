/**
 * Day 1 / 3 / 7 micro-surveys for the closed beta.
 *
 * Each survey has 1–2 quick-tap options and an optional free-text follow-up.
 * Anchored on the user's first home visit (recorded once in AsyncStorage)
 * so we don't need a server-side cohort.
 */

import type { MicroSurveyKey } from '../services/feedback';

export interface MicroSurvey {
  key: MicroSurveyKey;
  daysAfterFirstVisit: number;
  question: string;
  helper?: string;
  options: string[];
  freeTextLabel?: string;
}

export const MICRO_SURVEYS: MicroSurvey[] = [
  {
    key: 'day1',
    daysAfterFirstVisit: 1,
    question: 'Was anything confusing in your first few minutes?',
    helper: 'Quick gut-check — your answer helps us fix friction fast.',
    options: ['Nothing — smooth', 'A little', 'Quite a bit'],
    freeTextLabel: 'What almost made you give up? (optional)',
  },
  {
    key: 'day3',
    daysAfterFirstVisit: 3,
    question: "Which feature have you used most so far?",
    options: ['Chat', 'Vaccines', 'Community', 'Health tracker', "Haven't really used it"],
    freeTextLabel: "What's missing for you? (optional)",
  },
  {
    key: 'day7',
    daysAfterFirstVisit: 7,
    question: 'Are you still using MaaMitra regularly?',
    options: ['Yes, daily', 'A few times a week', 'Not really'],
    freeTextLabel: 'One thing we should fix first? (optional)',
  },
];
