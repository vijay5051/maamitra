import { describe, expect, test } from 'bun:test';
import { WHO_LMS } from '../data/whoGrowthStandards';
import {
  ageMonthsAt,
  lmsAt,
  lmsValue,
  lmsZ,
  markerIndexFor,
  normalCdf,
  parseMeasure,
  timelineMarkers,
  validateVisit,
  visitsByMarker,
  visitsFromGrowth,
  whoCurve,
  whoPercentile,
  latestOf,
} from '../lib/growth';
import { DEV_MILESTONES, milestonesForAge, milestoneWindowText } from '../data/developmentMilestones';

describe('WHO reference data (spot-checks against published WHO tables)', () => {
  test('medians at birth and 12 months', () => {
    expect(WHO_LMS.weight.boy[0][1]).toBeCloseTo(3.3464, 4);
    expect(WHO_LMS.weight.girl[0][1]).toBeCloseTo(3.2322, 4);
    expect(WHO_LMS.height.boy[0][1]).toBeCloseTo(49.8842, 4);
    expect(WHO_LMS.head.girl[0][1]).toBeCloseTo(33.8787, 4);
    expect(WHO_LMS.weight.boy[12][1]).toBeGreaterThan(9.5);
    expect(WHO_LMS.weight.boy[12][1]).toBeLessThan(9.8);
  });
  test('61 monthly rows (0–60) for every chart, medians increase with age', () => {
    for (const ind of ['weight', 'height', 'head'] as const) for (const sex of ['boy', 'girl'] as const) {
      const rows = WHO_LMS[ind][sex];
      expect(rows.length).toBe(61);
      for (let m = 1; m <= 60; m++) {
        // Length→height switch at 24→25 months drops ~0.7 cm less than a month's growth, so still increasing.
        expect(rows[m][1]).toBeGreaterThan(rows[m - 1][1]);
      }
    }
  });
});

describe('chart calculations', () => {
  const row = WHO_LMS.weight.boy[6];
  test('z = 0 gives the median; value↔z round-trips', () => {
    expect(lmsValue(row, 0)).toBeCloseTo(row[1], 6);
    for (const z of [-2, -1, 0.5, 2]) expect(lmsZ(row, lmsValue(row, z))).toBeCloseTo(z, 6);
  });
  test('L = 1 charts (length, head) are symmetric: M·(1 ± S·z)', () => {
    const r = WHO_LMS.height.girl[10];
    expect(lmsValue(r, 2)).toBeCloseTo(r[1] * (1 + 2 * r[2]), 6);
  });
  test('normal CDF', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.8808)).toBeCloseTo(0.97, 3);
    expect(normalCdf(-1.0364)).toBeCloseTo(0.15, 3);
  });
  test('percentile of the median is 50; lines are ordered', () => {
    expect(whoPercentile('weight', 'boy', 6, row[1])).toBe(50);
    const p3 = whoCurve('weight', 'girl', -1.8808, 24);
    const p97 = whoCurve('weight', 'girl', 1.8808, 24);
    expect(p3.length).toBe(25);
    p3.forEach((pt, i) => expect(pt.y).toBeLessThan(p97[i].y));
  });
  test('interpolates between months and refuses ages WHO does not cover', () => {
    const mid = lmsAt('weight', 'boy', 6.5)!;
    expect(mid[1]).toBeCloseTo((WHO_LMS.weight.boy[6][1] + WHO_LMS.weight.boy[7][1]) / 2, 6);
    expect(lmsAt('weight', 'boy', 60.5)).toBeNull();
    expect(lmsAt('weight', 'boy', -1)).toBeNull();
    expect(whoPercentile('height', 'girl', 72, 110)).toBeNull();
    expect(whoCurve('head', 'boy', 0, 200).length).toBe(61);
  });
});

describe('measurement validation', () => {
  const dob = '2026-01-14T00:00:00.000Z';
  const today = '2026-10-01';
  const ok = { date: '2026-06-01', weight: '7.2', length: '', head: '' };
  test('partial entries are fine; at least one value is required', () => {
    expect(validateVisit(ok, dob, today)).toEqual({});
    expect(validateVisit({ ...ok, weight: '' }, dob, today).form).toBeDefined();
    expect(validateVisit({ ...ok, length: '66.5', head: '43' }, dob, today)).toEqual({});
  });
  test('dates: not in the future, not before birth, birth day allowed', () => {
    expect(validateVisit({ ...ok, date: '2026-10-02' }, dob, today).date).toMatch(/future/);
    expect(validateVisit({ ...ok, date: '2026-01-10' }, dob, today).date).toMatch(/before/);
    expect(validateVisit({ ...ok, date: '2026-01-14' }, dob, today)).toEqual({});
    expect(validateVisit({ ...ok, date: 'yesterday' }, dob, today).date).toBeDefined();
  });
  test('units: grams / inches / text are rejected with a hint', () => {
    expect(validateVisit({ ...ok, weight: '7200' }, dob, today).weight).toMatch(/kilograms/);
    expect(validateVisit({ ...ok, length: '5' }, dob, today).length).toMatch(/centimetres/);
    expect(validateVisit({ ...ok, head: 'abc' }, dob, today).head).toMatch(/number/);
  });
  test('parseMeasure', () => {
    expect(parseMeasure(' 7,25 kg')).toBe(7.25);
    expect(parseMeasure('')).toBeUndefined();
    expect(parseMeasure('-3')).toBeNaN();
  });
});

describe('visits + timeline', () => {
  const dob = '2026-01-14T06:00:00.000Z';
  const e = (at: string, value: number, extra = {}) => ({ id: at + value, at, value, ...extra });
  const map = {
    weight: [e('2026-07-14T06:30:00.000Z', 7.6), e('2026-01-14T06:30:00.000Z', 3.1)],
    height: [e('2026-07-14T06:30:00.000Z', 67, { lengthMode: 'lying' as const, place: 'clinic' as const, note: '6-month visit' })],
    head: [],
    diaper: [{ id: 'd', at: '2026-07-14T06:30:00.000Z', diaperKind: 'wet' as const }],
  };
  test('groups separate entry lists into one visit per day; ignores routine logs', () => {
    const v = visitsFromGrowth(map);
    expect(v.map((x) => x.date)).toEqual(['2026-01-14', '2026-07-14']);
    expect(v[1]).toEqual({ date: '2026-07-14', weightKg: 7.6, lengthCm: 67, lengthMode: 'lying', place: 'clinic', note: '6-month visit' });
    expect(latestOf(v, 'weightKg')).toEqual({ value: 7.6, date: '2026-07-14' });
    expect(latestOf(v, 'headCm')).toBeNull();
    expect(visitsFromGrowth(undefined)).toEqual([]);
  });
  test('markers: monthly in year one, wider later, ending at the current age', () => {
    expect(timelineMarkers(0).map((m) => m.label)).toEqual(['Birth']);
    expect(timelineMarkers(8.6).map((m) => m.months)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const six = timelineMarkers(76).map((m) => m.months);
    expect(six.slice(13)).toEqual([15, 18, 21, 24, 30, 36, 42, 48, 54, 60, 72, 84]);
  });
  test('each visit lands on its nearest age marker; nothing is invented for empty ones', () => {
    const markers = timelineMarkers(8.6);
    const by = visitsByMarker(markers, visitsFromGrowth(map), dob);
    expect(by[0].length).toBe(1); // birth
    expect(by[6].length).toBe(1); // 6 months
    expect(by.filter((x) => x.length > 0).length).toBe(2);
    expect(markerIndexFor(markers, 5.6)).toBe(6);
    expect(ageMonthsAt(dob, '2026-07-14T06:30:00.000Z')).toBeCloseTo(5.95, 1);
  });
});

describe('milestones', () => {
  test('every milestone has a verified window and one of the four domains', () => {
    for (const m of DEV_MILESTONES) {
      expect(['movement', 'communication', 'social', 'learning']).toContain(m.domain);
      expect(!!m.byMonths !== !!m.window).toBe(true);
      expect(milestoneWindowText(m).length).toBeGreaterThan(10);
    }
    expect(new Set(DEV_MILESTONES.map((m) => m.id)).size).toBe(DEV_MILESTONES.length);
  });
  test('WHO motor windows match the published table', () => {
    const w = Object.fromEntries(DEV_MILESTONES.filter((m) => m.window).map((m) => [m.id, m.window]));
    expect(w['w-sit']).toEqual([3.8, 9.2]);
    expect(w['w-walk']).toEqual([8.2, 17.6]);
  });
  test('list for an age includes earlier ones and the next checkpoint only', () => {
    const at8 = milestonesForAge(8).map((m) => m.id);
    expect(at8).toContain('d2-so');
    expect(at8).toContain('d9-co');
    expect(at8).not.toContain('d12-co');
    expect(at8).toContain('w-walk');
  });
});
