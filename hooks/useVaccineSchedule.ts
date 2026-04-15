import { useMemo } from 'react';
import { VACCINE_SCHEDULE } from '../data/vaccines';
import { useActiveKid } from './useActiveKid';
import { addDays, isAfter, isBefore, differenceInDays } from 'date-fns';

export type VaccineStatus = 'overdue' | 'due-soon' | 'upcoming';

export interface VaccineWithDate {
  id: string;
  name: string;
  description: string;
  ageLabel: string;
  dueDate: Date | null;
  status: VaccineStatus;
  formattedDate: string;
}

export function useVaccineSchedule(): VaccineWithDate[] {
  const { activeKid } = useActiveKid();

  return useMemo(() => {
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
      const diffDays = differenceInDays(dueDate, today);

      let status: VaccineStatus;
      if (isBefore(dueDate, today)) status = 'overdue';
      else if (diffDays <= 30) status = 'due-soon';
      else status = 'upcoming';

      const formattedDate = dueDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      return { ...v, dueDate, status, formattedDate };
    });
  }, [activeKid]);
}
