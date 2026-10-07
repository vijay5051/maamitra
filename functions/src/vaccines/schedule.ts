// Server-side vaccine schedule — a MINIMAL mirror of data/vaccines.ts
// for the reminder cron. Only the fields the dispatcher needs:
//   id            — must match the client's completedVaccines keys so
//                   dedup works (we don't push for ones already marked done).
//   name          — rendered into the push body.
//   daysFromBirth — compared against the kid's DOB to decide status.
//   schedule      — 'iap' | 'nis', so we filter to the one the kid is on.
//
// Why we duplicate instead of importing data/vaccines.ts: functions has
// its own tsconfig with rootDir=src — it cannot reach across the repo.
// When you add a new vaccine on the client, mirror it here if it should
// trigger reminders. Boosters past 5y aren't mirrored since reminder
// value drops off and the parent is better served by in-app view.

export type VaccineScheduleType = 'iap' | 'nis';

export interface ScheduleVaccine {
  id: string;
  name: string;
  daysFromBirth: number;
  schedule: VaccineScheduleType;
}

export const SCHEDULE_IAP: ScheduleVaccine[] = [
  { id: 'iap-bcg',         name: 'BCG',                         daysFromBirth: 0,    schedule: 'iap' },
  { id: 'iap-opv-0',       name: 'OPV birth dose',              daysFromBirth: 0,    schedule: 'iap' },
  { id: 'iap-hepb-1',      name: 'Hepatitis B — 1',             daysFromBirth: 0,    schedule: 'iap' },
  { id: 'iap-dtp-1',       name: 'DTP — 1',                     daysFromBirth: 42,   schedule: 'iap' },
  { id: 'iap-ipv-1',       name: 'IPV — 1',                     daysFromBirth: 42,   schedule: 'iap' },
  { id: 'iap-hib-1',       name: 'Hib — 1',                     daysFromBirth: 42,   schedule: 'iap' },
  { id: 'iap-rota-1',      name: 'Rotavirus — 1',               daysFromBirth: 42,   schedule: 'iap' },
  { id: 'iap-pcv-1',       name: 'PCV — 1',                     daysFromBirth: 42,   schedule: 'iap' },
  { id: 'iap-dtp-2',       name: 'DTP — 2',                     daysFromBirth: 70,   schedule: 'iap' },
  { id: 'iap-ipv-2',       name: 'IPV — 2',                     daysFromBirth: 70,   schedule: 'iap' },
  { id: 'iap-hib-2',       name: 'Hib — 2',                     daysFromBirth: 70,   schedule: 'iap' },
  { id: 'iap-rota-2',      name: 'Rotavirus — 2',               daysFromBirth: 70,   schedule: 'iap' },
  { id: 'iap-pcv-2',       name: 'PCV — 2',                     daysFromBirth: 70,   schedule: 'iap' },
  { id: 'iap-dtp-3',       name: 'DTP — 3',                     daysFromBirth: 98,   schedule: 'iap' },
  { id: 'iap-ipv-3',       name: 'IPV — 3',                     daysFromBirth: 98,   schedule: 'iap' },
  { id: 'iap-hib-3',       name: 'Hib — 3',                     daysFromBirth: 98,   schedule: 'iap' },
  { id: 'iap-rota-3',      name: 'Rotavirus — 3',               daysFromBirth: 98,   schedule: 'iap' },
  { id: 'iap-pcv-3',       name: 'PCV — 3',                     daysFromBirth: 98,   schedule: 'iap' },
  { id: 'iap-iiv-1',       name: 'Flu — 1',                     daysFromBirth: 180,  schedule: 'iap' },
  { id: 'iap-iiv-2',       name: 'Flu — 2',                     daysFromBirth: 210,  schedule: 'iap' },
  { id: 'iap-mmr-1',       name: 'MMR — 1',                     daysFromBirth: 270,  schedule: 'iap' },
  { id: 'iap-hepa-1',      name: 'Hepatitis A — 1',             daysFromBirth: 365,  schedule: 'iap' },
  { id: 'iap-pcv-b',       name: 'PCV booster',                 daysFromBirth: 455,  schedule: 'iap' },
  { id: 'iap-mmr-2',       name: 'MMR — 2',                     daysFromBirth: 455,  schedule: 'iap' },
  { id: 'iap-varicella-1', name: 'Chickenpox — 1',              daysFromBirth: 455,  schedule: 'iap' },
  { id: 'iap-dtp-b1',      name: 'DTP booster 1',               daysFromBirth: 548,  schedule: 'iap' },
  { id: 'iap-hib-b',       name: 'Hib booster',                 daysFromBirth: 548,  schedule: 'iap' },
  { id: 'iap-hepa-2',      name: 'Hepatitis A — 2',             daysFromBirth: 548,  schedule: 'iap' },
  { id: 'iap-tcv-1',       name: 'Typhoid (TCV)',               daysFromBirth: 548,  schedule: 'iap' },
  { id: 'iap-varicella-2', name: 'Chickenpox — 2',              daysFromBirth: 1460, schedule: 'iap' },
  { id: 'iap-dtp-b2',      name: 'DTP booster 2',               daysFromBirth: 1825, schedule: 'iap' },
];

export const SCHEDULE_NIS: ScheduleVaccine[] = [
  { id: 'nis-bcg',          name: 'BCG',                        daysFromBirth: 0,    schedule: 'nis' },
  { id: 'nis-opv-0',        name: 'OPV birth dose',             daysFromBirth: 0,    schedule: 'nis' },
  { id: 'nis-hepb-birth',   name: 'Hepatitis B birth dose',     daysFromBirth: 0,    schedule: 'nis' },
  { id: 'nis-opv-1',        name: 'OPV — 1',                    daysFromBirth: 42,   schedule: 'nis' },
  { id: 'nis-penta-1',      name: 'Pentavalent (5-in-1) — 1',   daysFromBirth: 42,   schedule: 'nis' },
  { id: 'nis-rvv-1',        name: 'Rotavirus — 1',              daysFromBirth: 42,   schedule: 'nis' },
  { id: 'nis-fipv-1',       name: 'Fractional IPV — 1',         daysFromBirth: 42,   schedule: 'nis' },
  { id: 'nis-pcv-1',        name: 'PCV — 1',                    daysFromBirth: 42,   schedule: 'nis' },
  { id: 'nis-opv-2',        name: 'OPV — 2',                    daysFromBirth: 70,   schedule: 'nis' },
  { id: 'nis-penta-2',      name: 'Pentavalent — 2',            daysFromBirth: 70,   schedule: 'nis' },
  { id: 'nis-rvv-2',        name: 'Rotavirus — 2',              daysFromBirth: 70,   schedule: 'nis' },
  { id: 'nis-opv-3',        name: 'OPV — 3',                    daysFromBirth: 98,   schedule: 'nis' },
  { id: 'nis-penta-3',      name: 'Pentavalent — 3',            daysFromBirth: 98,   schedule: 'nis' },
  { id: 'nis-fipv-2',       name: 'Fractional IPV — 2',         daysFromBirth: 98,   schedule: 'nis' },
  { id: 'nis-rvv-3',        name: 'Rotavirus — 3',              daysFromBirth: 98,   schedule: 'nis' },
  { id: 'nis-pcv-2',        name: 'PCV — 2',                    daysFromBirth: 98,   schedule: 'nis' },
  { id: 'nis-mr-1',         name: 'Measles–Rubella — 1',        daysFromBirth: 270,  schedule: 'nis' },
  { id: 'nis-je-1',         name: 'Japanese encephalitis — 1',  daysFromBirth: 270,  schedule: 'nis' },
  { id: 'nis-vita-1',       name: 'Vitamin A — 1',              daysFromBirth: 270,  schedule: 'nis' },
  { id: 'nis-pcv-b',        name: 'PCV booster',                daysFromBirth: 273,  schedule: 'nis' },
  { id: 'nis-mr-2',         name: 'Measles–Rubella — 2',        daysFromBirth: 548,  schedule: 'nis' },
  { id: 'nis-je-2',         name: 'Japanese encephalitis — 2',  daysFromBirth: 548,  schedule: 'nis' },
  { id: 'nis-dpt-b1',       name: 'DPT booster — 1',            daysFromBirth: 548,  schedule: 'nis' },
];

export function scheduleFor(type: VaccineScheduleType): ScheduleVaccine[] {
  return type === 'nis' ? SCHEDULE_NIS : SCHEDULE_IAP;
}
