import { useMemo } from 'react';
import { VACCINE_SCHEDULE } from '../data/vaccines';
import { useActiveKid } from './useActiveKid';
import { useProfileStore } from '../store/useProfileStore';
import { addDays, isBefore, differenceInDays } from 'date-fns';

export type VaccineStatus = 'overdue' | 'due-soon' | 'upcoming' | 'done';

export interface VaccineWithDate {
  id: string;
  name: string;
  description: string;
  ageLabel: string;
  dueDate: Date | null;
  status: VaccineStatus;
  formattedDate: string;
  doneDate?: string;
}

export function useVaccineSchedule(): VaccineWithDate[] {
  const { activeKid } = useActiveKid();
  const completedVaccinesAll = useProfileStore((s) => s.completedVaccines);

  return useMemo(() => {
    // Per-kid vaccine tracking: get only this kid's vaccines
    const completedVaccines = activeKid ? (completedVaccinesAll[activeKid.id] ?? {}) : {};

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
      // If marked as done, always show done
      const completed = completedVaccines[v.id];
      if (completed?.done) {
        const dueDate = addDays(dob, v.daysFromBirth);
        const formattedDate = dueDate.toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
        });
        return {
          ...v,
          dueDate,
          status: 'done' as VaccineStatus,
          formattedDate,
          doneDate: completed.doneDate,
        };
      }

      const dueDate = addDays(dob, v.daysFromBirth);
      const diffDays = differenceInDays(dueDate, today);

      let status: VaccineStatus;
      if (isBefore(dueDate, today)) status = 'overdue';
      else if (diffDays <= 7) status = 'due-soon';
      else status = 'upcoming';

      const formattedDate = dueDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      return { ...v, dueDate, status, formattedDate };
    });
  }, [activeKid, completedVaccinesAll]);
}
