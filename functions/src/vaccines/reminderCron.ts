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

import { scheduleFor, type VaccineScheduleType } from './schedule';
import { CompletedVaccineEntry, pickRemindableVaccines, reminderMessage } from './pick';
import { hasFullAccess } from '../billing/access';

const RUN_LIMIT_USERS = 400;
const REMINDER_COOLDOWN_DAYS = 7;

interface Kid {
  id?: string;
  name?: string;
  dob?: string;
  isExpecting?: boolean;
  vaccineSchedule?: VaccineScheduleType;
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

      // Due-date reminders are a Plus/Family feature (or early-member free period)
      // once app plan locks are on
      // (they reach users as phone notifications, so the app switch governs).
      const billing = (await db.doc('app_settings/billing').get()).data();
      const planLocked = billing?.locks?.app === true;

      let scanned = 0;
      let kidsConsidered = 0;
      let remindersQueued = 0;
      let remindersSkippedCooldown = 0;

      for (const userSnap of snap.docs) {
        scanned++;
        const data = userSnap.data() as UserDoc;
        if (data.notifPrefs?.vaccines === false) continue;
        if (planLocked && !(await hasFullAccess(userSnap.id, billing))) continue;

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

          // Drop vaccines nudged in the last week, then send ONE push for
          // whatever is left for this child (combined when several).
          const due: typeof picks = [];
          for (const pick of picks) {
            const logDoc = await db.collection('vaccine_reminder_log').doc(`${userSnap.id}_${kid.id}_${pick.vaccine.id}`).get();
            const lastSentAt = logDoc.exists ? (logDoc.data()?.lastSentAt as admin.firestore.Timestamp | undefined) : undefined;
            if (lastSentAt && (Date.now() - lastSentAt.toMillis()) / 86400000 < REMINDER_COOLDOWN_DAYS) {
              remindersSkippedCooldown++;
              continue;
            }
            due.push(pick);
          }
          if (due.length === 0) continue;

          const { title, body } = reminderMessage(kid.name, due);
          await db.collection('push_queue').add({
            kind: 'personal',
            toUid: userSnap.id,
            title,
            body,
            notifType: 'vaccine_reminder',
            data: {
              vaccineId: due[0].vaccine.id,
              kidId: kid.id,
              status: due[0].status,
              count: String(due.length),
              url: '/(tabs)/health?tab=vaccines',
            },
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          for (const pick of due) {
            const logRef = db.collection('vaccine_reminder_log').doc(`${userSnap.id}_${kid.id}_${pick.vaccine.id}`);
            await logRef.set(
              {
                userId: userSnap.id,
                kidId: kid.id,
                vaccineId: pick.vaccine.id,
                lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
                lastStatus: pick.status,
                lastDueDate: pick.dueDate.toISOString(),
                sendCount: admin.firestore.FieldValue.increment(1),
              },
              { merge: true },
            );
          }
          remindersQueued++;
        }
      }

      console.log(
        `[vaccineReminderCron] ${todayStamp} — scanned=${scanned} kids=${kidsConsidered} ` +
          `queued=${remindersQueued} skippedCooldown=${remindersSkippedCooldown}`,
      );
      return null;
    });
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

