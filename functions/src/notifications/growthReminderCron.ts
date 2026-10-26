// Daily 09:30 IST: on each child's month-birthday (1–36 months), remind the
// parent to log growth and look at this month's milestones. Gated downstream
// by the `reminders` notification pref (notifType growth_reminder).

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

const RUN_LIMIT_USERS = 2000;
const MAX_MONTHS = 36;

interface Kid {
  id?: string;
  name?: string;
  dob?: string;
  isExpecting?: boolean;
}

/** Today's calendar date in India. */
function todayIst(): { y: number; m: number; d: number } {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  return { y: ist.getUTCFullYear(), m: ist.getUTCMonth() + 1, d: ist.getUTCDate() };
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Months completed today if today is the child's month-birthday, else null. */
export function monthBirthday(dob: string, today: { y: number; m: number; d: number }): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob);
  if (!match) return null;
  const [dy, dm, dd] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const months = (today.y - dy) * 12 + (today.m - dm);
  if (months < 1) return null;
  // A child born on the 31st has their month-birthday on the last day of shorter months.
  const dueDay = Math.min(dd, daysInMonth(today.y, today.m));
  return today.d === dueDay ? months : null;
}

function ageLabel(months: number): string {
  if (months < 24) return `${months} months`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y} years` : `${y} years ${m} months`;
}

export function buildGrowthReminderCron() {
  return functions
    .runWith({ memory: '512MB', timeoutSeconds: 540 })
    .pubsub.schedule('0 4 * * *') // 09:30 IST
    .timeZone('UTC')
    .onRun(async () => {
      const db = admin.firestore();
      const today = todayIst();
      const snap = await db.collection('users').where('pushEnabled', '==', true).limit(RUN_LIMIT_USERS).get();

      let queued = 0;
      for (const userSnap of snap.docs) {
        const data = userSnap.data() as { notifPrefs?: { reminders?: boolean }; kids?: Kid[] };
        if (data.notifPrefs?.reminders === false) continue;
        for (const kid of Array.isArray(data.kids) ? data.kids : []) {
          if (!kid?.dob || kid.isExpecting) continue;
          const months = monthBirthday(kid.dob, today);
          if (months === null || months > MAX_MONTHS) continue;
          const name = kid.name?.trim() || 'Your little one';
          await db.collection('push_queue').add({
            kind: 'personal',
            toUid: userSnap.id,
            title: `${name} turns ${ageLabel(months)} today 🎉`,
            body: 'Log weight and height, and see the milestones for this month.',
            notifType: 'growth_reminder',
            data: { kidId: kid.id ?? '', months: String(months), url: '/(tabs)/health?tab=growth' },
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          queued++;
        }
      }
      console.log(`[growthReminderCron] scanned ${snap.size} users, queued ${queued} reminders`);
      return null;
    });
}
