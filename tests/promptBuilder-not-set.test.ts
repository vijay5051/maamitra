import { describe, expect, test } from 'bun:test';
import { buildSystemPrompt } from '../lib/promptBuilder';
import type { ChatContext } from '../lib/promptBuilder';

const base: ChatContext = {
  motherName: 'Priya',
  stage: 'newborn',
  state: 'Karnataka',
  diet: 'vegetarian',
  kidName: 'Aarav',
  kidAgeMonths: 3,
  kidDOB: '2026-02-19',
};

describe("promptBuilder treats 'not-set' like 'surprise'", () => {
  test("'not-set' renders as generic 'baby', not 'son' or 'daughter'", () => {
    const prompt = buildSystemPrompt({ ...base, kidGender: 'not-set' });
    expect(prompt).toContain('baby');
    expect(prompt).not.toContain('son Aarav');
    expect(prompt).not.toContain('daughter Aarav');
  });

  test("'surprise' still works (regression)", () => {
    const prompt = buildSystemPrompt({ ...base, kidGender: 'surprise' });
    expect(prompt).toContain('baby');
  });
});
