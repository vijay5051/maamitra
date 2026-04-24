import { useMemo } from 'react';
import { VACCINE_SCHEDULE, LEGACY_VACCINE_ID_MAP } from '../data/vaccines';
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
function resolveCompletions(
  completed: Record<string, { done?: boolean; doneDate?: string }>,
): Record<string, { done?: boolean; doneDate?: string }> {
  const resolved: Record<string, { done?: boolean; doneDate?: string }> = {
    ...completed,
  };
  for (const [legacyId, newIds] of Object.entries(LEGACY_VACCINE_ID_MAP)) {
    const legacy = completed[legacyId];
    if (!legacy?.done) continue;
    for (const id of newIds) {
      // Don't overwrite an explicit new-id completion (user may have re-logged it).
      if (!resolved[id]?.done) {
        resolved[id] = { done: true, doneDate: legacy.doneDate };
      }
    }
  }
  return resolved;
}

export function useVaccineSchedule(): VaccineWithDate[] {
  const { activeKid } = useActiveKid();
  const completedVaccinesAll = useProfileStore((s) => s.completedVaccines);

  return useMemo(() => {
    // Per-kid vaccine tracking: get only this kid's vaccines
    const rawCompleted = activeKid ? (completedVaccinesAll[activeKid.id] ?? {}) : {};
    const completedVaccines = resolveCompletions(rawCompleted);

    if (!activeKid || activeKid.isExpecting || !activeKid.dob) {
      return VACCINE_SCHEDULE.map((v) => ({
        ...v,
        dueDate: null,
        status: 'upcoming' as VaccineStatus,
        formattedDate: 'After birth',
      }));
    }

    const dob = new Date(activeKid.dob);
    const today = new Date();

    return VACCINE_SCHEDULE.map((v) => {
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
