import { useMemo } from 'react';
import {
  getScheduleFor,
  IAP_VACCINE_SCHEDULE,
  LEGACY_VACCINE_ID_MAP,
  VaccineScheduleType,
} from '../data/vaccines';
import { useActiveKid } from './useActiveKid';
import { useProfileStore } from '../store/useProfileStore';
import { addDays, isBefore, differenceInDays } from 'date-fns';

export type VaccineStatus = 'overdue' | 'due-soon' | 'upcoming' | 'done';

export interface VaccineWithDate {
  id: string;
  name: string;
  description: string;
  ageLabel: string;
  category: string;
  dueDate: Date | null;
  status: VaccineStatus;
  formattedDate: string;
  doneDate?: string;
}

// Fold legacy group-level completions (v01…v11) onto the new granular ids
// so nobody's previously-logged vaccines disappear after the schedule split.
// The legacy mapping is schedule-aware: a kid on IAP gets old completions
// folded onto IAP ids, a kid on NIS gets them folded onto NIS ids.
function resolveCompletions(
  completed: Record<string, { done?: boolean; doneDate?: string }>,
  schedule: VaccineScheduleType,
): Record<string, { done?: boolean; doneDate?: string }> {
  const resolved: Record<string, { done?: boolean; doneDate?: string }> = {
    ...completed,
  };
  for (const [legacyId, mapByType] of Object.entries(LEGACY_VACCINE_ID_MAP)) {
    const legacy = completed[legacyId];
    if (!legacy?.done) continue;
    for (const id of mapByType[schedule] ?? []) {
      // Don't overwrite an explicit new-id completion (user may have re-logged).
      if (!resolved[id]?.done) {
        resolved[id] = { done: true, doneDate: legacy.doneDate };
      }
    }
  }
  return resolved;
}

/**
 * Returns the active kid's vaccine schedule as a flat list, ready to render.
 * Falls back to IAP for previewing dates when:
 *   - the kid is still expecting (DOB in future), or
 *   - the parent hasn't picked a schedule yet (so the chooser still shows
 *     the same age-by-age preview the live tracker will use).
 *
 * Use {@link useKidVaccineSchedulePreference} to read whether the parent has
 * actually committed to a schedule for this kid.
 */
export function useVaccineSchedule(): VaccineWithDate[] {
  const { activeKid } = useActiveKid();
  const completedVaccinesAll = useProfileStore((s) => s.completedVaccines);

  return useMemo(() => {
    const schedule = (activeKid?.vaccineSchedule ?? 'iap') as VaccineScheduleType;
    const list = getScheduleFor(schedule);

    if (!activeKid || activeKid.isExpecting || !activeKid.dob) {
      return list.map((v) => ({
        ...v,
        dueDate: null,
        status: 'upcoming' as VaccineStatus,
        formattedDate: 'After birth',
      }));
    }

    const rawCompleted = completedVaccinesAll[activeKid.id] ?? {};
    const completedVaccines = resolveCompletions(rawCompleted, schedule);

    const dob = new Date(activeKid.dob);
    const today = new Date();

    return list.map((v) => {
      const dueDate = addDays(dob, v.daysFromBirth);
      const formattedDate = dueDate.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      });

      const completed = completedVaccines[v.id];
      if (completed?.done) {
        return {
          ...v,
          dueDate,
          status: 'done' as VaccineStatus,
          formattedDate,
          doneDate: completed.doneDate,
        };
      }

      const diffDays = differenceInDays(dueDate, today);
      let status: VaccineStatus;
      if (isBefore(dueDate, today)) status = 'overdue';
      else if (diffDays <= 7) status = 'due-soon';
      else status = 'upcoming';

      return { ...v, dueDate, status, formattedDate };
    });
  }, [activeKid, completedVaccinesAll]);
}

/**
 * Returns whether the active kid has had a schedule picked (and which one).
 * The vaccine tracker shows a chooser until this returns `hasChosen: true`.
 */
export function useKidVaccineSchedulePreference(): {
  hasChosen: boolean;
  schedule: VaccineScheduleType;
} {
  const { activeKid } = useActiveKid();
  const schedule = (activeKid?.vaccineSchedule ?? 'iap') as VaccineScheduleType;
  return {
    hasChosen: !!activeKid?.vaccineSchedule,
    schedule,
  };
}

// Reference for callers that need the unfiltered IAP list (e.g. the journey
// timeline in library.tsx, which deliberately uses IAP-id milestones).
export const IAP_VACCINES_REF = IAP_VACCINE_SCHEDULE;
