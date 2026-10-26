// Rules for adding / renaming children. Pure, unit-tested in tests/kids.test.ts.
//
// Two children on one profile may not share a name (that is how a parent tells
// them apart everywhere in the app). They may share a date of birth: twins.

interface KidLike {
  id: string;
  name?: string;
  dob?: string;
  isExpecting?: boolean;
}

export function normalizeKidName(name: string | undefined | null): string {
  return (name ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-IN');
}

/** The existing child (other than `excludeId`) that already uses this name, if any. */
export function findKidWithName<T extends KidLike>(kids: readonly T[], name: string, excludeId?: string): T | null {
  const n = normalizeKidName(name);
  if (!n) return null;
  return kids.find((k) => k.id !== excludeId && normalizeKidName(k.name) === n) ?? null;
}

/** Calendar date of a stored DOB in the device's time zone, as YYYY-MM-DD. */
export function dobDay(dob: string | undefined | null): string | null {
  if (!dob) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) return dob;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Existing children born (or due) on the same day: the new child's twins. */
export function twinsOf<T extends KidLike>(kids: readonly T[], dob: string, isExpecting: boolean, excludeId?: string): T[] {
  const day = dobDay(dob);
  if (!day) return [];
  return kids.filter((k) => k.id !== excludeId && !!k.isExpecting === isExpecting && dobDay(k.dob) === day);
}

export function duplicateNameMessage(name: string, hasTwin: boolean): string {
  const shown = name.trim() || 'Little one';
  return hasTwin
    ? `You already have a child called ${shown}. Twins? Please give each one their own name.`
    : `You already have a child called ${shown}. Please use a different name.`;
}
