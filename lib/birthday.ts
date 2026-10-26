// Birthday card logic. Pure (no React / storage) so it is unit-tested in
// tests/birthday.test.ts. The server push (functions/src/notifications/
// growthReminderCron.ts) uses the same "Feb 29 → Feb 28" rule.

import { dobDay } from './kids';

/**
 * Years the child turns today, or null if today isn't their birthday.
 * DOBs are stored as the instant of local midnight (e.g. 11 May in India is
 * "2026-05-10T18:30:00.000Z"), so read the date in the device's time zone.
 */
export function birthdayToday(dob: string | undefined | null, now: Date = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dobDay(dob) ?? '');
  if (!match) return null;
  const [dy, dm, dd] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const years = y - dy;
  if (years < 1 || m !== dm) return null;
  // A Feb 29 baby celebrates on Feb 28 in non-leap years.
  const lastDay = new Date(y, m, 0).getDate();
  return now.getDate() === Math.min(dd, lastDay) ? years : null;
}

export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** Dedup key: the card opens by itself once per child per birthday. */
export function birthdayCardKey(kidId: string, now: Date = new Date()): string {
  return `birthdayCard-${kidId}-${now.getFullYear()}`;
}

export interface BirthdayNote {
  /** e.g. "Happy 1st Birthday" */
  heading: string;
  /** Note to the child. */
  note: string;
  /** Short line for the parent. */
  parentLine: string;
}

export function birthdayNote(name: string, years: number): BirthdayNote {
  const who = name.trim() || 'little one';
  const heading = `Happy ${ordinal(years)} Birthday`;
  if (years === 1) {
    return {
      heading,
      note: `Dear ${who}, one whole year of you! From tiny fingers holding ours to that first big smile, you have filled every day with wonder. May your year ahead be full of giggles, wobbly steps and endless cuddles.`,
      parentLine: 'One year ago, you became a parent too. Happy birthday to you as well.',
    };
  }
  if (years === 2) {
    return {
      heading,
      note: `Dear ${who}, two years of running, climbing, chattering and discovering everything around you. Keep asking, keep exploring, and keep that wonderful laugh going all year long.`,
      parentLine: 'Two years of love, patience and very little sleep. You are doing beautifully.',
    };
  }
  if (years <= 5) {
    return {
      heading,
      note: `Dear ${who}, ${years} years old today! You are growing braver, kinder and more curious every single day. May this year bring you new friends, big adventures and lots of stories to tell.`,
      parentLine: `${years} years of watching ${who} grow. Enjoy every bit of today.`,
    };
  }
  return {
    heading,
    note: `Dear ${who}, happy ${ordinal(years)} birthday! Keep dreaming big, keep learning something new, and never stop being the wonderful person you are.`,
    parentLine: `Wishing your whole family a joyful celebration today.`,
  };
}

/** Text the parent can send to family from the card. */
export function birthdayShareText(name: string, years: number): string {
  const who = name.trim() || 'Our little one';
  return `🎂 ${who} turns ${years} today! Sending love and blessings for a wonderful year ahead. 💜`;
}
