// Daily cron that enqueues vaccine-reminder push notifications.
//
// Fires at 09:00 IST (03:30 UTC). For every user with push enabled AND
// `notifPrefs.vaccines !== false`, scans their kids and sends one push
// per (kid, vaccine) that:
//   - becomes due within the next 3 days, OR
//   - is already overdue
// …as long as the parent hasn't already logged it as done.
//
// Dedup via a `vaccine_reminder_log/{userId}_{kidId}_{vaccineId}` doc.
// For a given reminder, we send at most once a week — if the parent
// hasn't acted on the first push, we nudge again 7 days later. Once the
// vaccine is marked done in `completedVaccines`, no more pushes fire.
//
// The push itself goes through the existing `push_queue` collection, so
// per-user token management, pref-gates (vaccines topic), and dead-token
// cleanup all keep working with zero extra code.

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

import { scheduleFor, type ScheduleVaccine, type VaccineScheduleType } from './schedule';

const RUN_LIMIT_USERS = 400;
const LOOKAHEAD_DAYS = 3;
const REMINDER_COOLDOWN_DAYS = 7;

interface Kid {
  id?: string;
  name?: string;
  dob?: string;
  isExpecting?: boolean;
  vaccineSchedule?: VaccineScheduleType;
}

interface CompletedVaccineEntry {
  done?: boolean;
  doneDate?: string;
}

interface UserDoc {
  motherName?: string;
  name?: string;
  pushEnabled?: boolean;
  fcmTokens?: string[];
  notifPrefs?: { vaccines?: boolean };
  kids?: Kid[];
  completedVaccines?: Record<string, Record<string, CompletedVaccineEntry>>;
}

export function buildVaccineReminderCron() {
  return functions
    .runWith({ memory: '512MB', timeoutSeconds: 540 })
    .pubsub.schedule('30 3 * * *') // 09:00 IST = 03:30 UTC
    .timeZone('UTC')
    .onRun(async () => {
      const db = admin.firestore();
      const todayStart = startOfTodayUtc();
      const todayStamp = isoDay(todayStart);

      // Narrow to users with push on. The dispatcher gates the vaccines
      // pref again downstream, so we only use `pushEnabled` here to avoid
      // scanning the entire users table.
      const snap = await db
        .collection('users')
        .where('pushEnabled', '==', true)
        .limit(RUN_LIMIT_USERS)
        .get();

      if (snap.empty) {
        console.log('[vaccineReminderCron] no push-enabled users to scan');
        return null;
      }

      let scanned = 0;
      let kidsConsidered = 0;
      let remindersQueued = 0;
      let remindersSkippedCooldown = 0;

      for (const userSnap of snap.docs) {
        scanned++;
        const data = userSnap.data() as UserDoc;
        if (data.notifPrefs?.vaccines === false) continue;

        const kids = Array.isArray(data.kids) ? data.kids : [];
        if (kids.length === 0) continue;

        const completedPerKid = data.completedVaccines ?? {};

        for (const kid of kids) {
          if (!kid?.id || !kid.dob || kid.isExpecting) continue;
          kidsConsidered++;

          const dob = new Date(kid.dob);
          if (Number.isNaN(dob.getTime())) continue;

          const scheduleType = (kid.vaccineSchedule ?? 'iap') as VaccineScheduleType;
          const list = scheduleFor(scheduleType);
          const completedForThisKid = completedPerKid[kid.id] ?? {};

          const picks = pickRemindableVaccines({
            dob,
            today: todayStart,
            list,
            completed: completedForThisKid,
          });

          for (const pick of picks) {
            const logId = `${userSnap.id}_${kid.id}_${pick.vaccine.id}`;
            const logRef = db.collection('vaccine_reminder_log').doc(logId);
            const logDoc = await logRef.get();

            if (logDoc.exists) {
              const lastSentAt = (logDoc.data()?.lastSentAt as admin.firestore.Timestamp | undefined);
              if (lastSentAt) {
                const daysSince = (Date.now() - lastSentAt.toMillis()) / (1000 * 60 * 60 * 24);
                if (daysSince < REMINDER_COOLDOWN_DAYS) {
                  remindersSkippedCooldown++;
                  continue;
                }
              }
            }

            const title = pick.status === 'overdue'
              ? `${kid.name || 'Your child'}'s ${pick.vaccine.name} is overdue`
              : pick.diffDays <= 0
                ? `${pick.vaccine.name} due today for ${kid.name || 'your child'}`
                : `${pick.vaccine.name} due in ${pick.diffDays} day${pick.diffDays === 1 ? '' : 's'}`;

            const body = pick.status === 'overdue'
              ? `Was due ${isoShort(pick.dueDate)}. Tap to view the schedule or log the visit.`
              : `Due ${isoShort(pick.dueDate)}. Tap to view the schedule or log it once given.`;

            await db.collection('push_queue').add({
              kind: 'personal',
              toUid: userSnap.id,
              title,
              body,
              notifType: 'vaccine_reminder',
              data: {
                vaccineId: pick.vaccine.id,
                kidId: kid.id,
                status: pick.status,
                url: '/(tabs)/health?tab=vaccines',
              },
              status: 'pending',
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            await logRef.set(
              {
                userId: userSnap.id,
                kidId: kid.id,
                vaccineId: pick.vaccine.id,
                firstSentAt: logDoc.exists ? logDoc.data()?.firstSentAt : admin.firestore.FieldValue.serverTimestamp(),
                lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
                lastStatus: pick.status,
                lastDueDate: pick.dueDate.toISOString(),
                sendCount: admin.firestore.FieldValue.increment(1),
              },
              { merge: true },
            );
            remindersQueued++;
          }
        }
      }

      console.log(
        `[vaccineReminderCron] ${todayStamp} — scanned=${scanned} kids=${kidsConsidered} ` +
          `queued=${remindersQueued} skippedCooldown=${remindersSkippedCooldown}`,
      );
      return null;
    });
}

interface RemindablePick {
  vaccine: ScheduleVaccine;
  dueDate: Date;
  diffDays: number;
  status: 'due-soon' | 'overdue';
}

function pickRemindableVaccines({
  dob,
  today,
  list,
  completed,
}: {
  dob: Date;
  today: Date;
  list: ScheduleVaccine[];
  completed: Record<string, CompletedVaccineEntry>;
}): RemindablePick[] {
  const out: RemindablePick[] = [];
  const dayMs = 24 * 60 * 60 * 1000;

  for (const v of list) {
    if (completed[v.id]?.done) continue;
    const dueDate = new Date(dob.getTime() + v.daysFromBirth * dayMs);
    const diffDays = Math.round((dueDate.getTime() - today.getTime()) / dayMs);

    if (diffDays <= 0) {
      out.push({ vaccine: v, dueDate, diffDays, status: 'overdue' });
    } else if (diffDays <= LOOKAHEAD_DAYS) {
      out.push({ vaccine: v, dueDate, diffDays, status: 'due-soon' });
    }
  }

  return out;
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isoShort(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}
