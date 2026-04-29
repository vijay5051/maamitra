import { db } from './firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

/**
 * Closed-beta feedback collection.
 *
 * Two surfaces:
 *  - submitMicroSurvey: structured Day 1 / 3 / 7 answers with optional free text.
 *  - submitFeedback (future): free-form bug / suggestion reports.
 *
 * All writes go to the top-level `feedback/` collection. The admin
 * dashboard at /admin reads this for triage.
 */

export type MicroSurveyKey = 'day1' | 'day3' | 'day7';

export interface MicroSurveyPayload {
  uid: string;
  surveyKey: MicroSurveyKey;
  question: string;
  answer: string;
  freeText?: string;
  testCohort?: string;
  appVersion?: string;
  platform?: string;
}

export async function submitMicroSurvey(payload: MicroSurveyPayload): Promise<void> {
  if (!db) throw new Error('Firestore not configured');
  await addDoc(collection(db, 'feedback'), {
    type: 'micro-survey',
    ...payload,
    createdAt: serverTimestamp(),
  });
}
