import { planValidationErrors } from './plan-validation';

const attemptPlan = {
  name: { en: 'Starter' },
  price: 500,
  accessType: 'ATTEMPTS',
  attemptLimit: 5,
  durationDays: null,
};
const timePlan = {
  name: { en: 'Weekly' },
  price: 3000,
  accessType: 'TIME',
  attemptLimit: null,
  durationDays: 7,
};

describe('planValidationErrors', () => {
  it('accepts a valid attempt-based and a valid time-based plan', () => {
    expect(planValidationErrors(attemptPlan)).toEqual([]);
    expect(planValidationErrors(timePlan)).toEqual([]);
  });

  it('requires attemptLimit > 0 and no duration for attempt-based plans', () => {
    expect(planValidationErrors({ ...attemptPlan, attemptLimit: 0 })).toEqual([
      expect.stringMatching(/attemptLimit > 0/),
    ]);
    expect(
      planValidationErrors({ ...attemptPlan, attemptLimit: null }),
    ).toEqual([expect.stringMatching(/attemptLimit > 0/)]);
    expect(planValidationErrors({ ...attemptPlan, durationDays: 7 })).toEqual([
      expect.stringMatching(/must not have durationDays/),
    ]);
  });

  it('requires durationDays > 0 and no attempt limit for time-based plans', () => {
    expect(planValidationErrors({ ...timePlan, durationDays: 0 })).toEqual([
      expect.stringMatching(/durationDays > 0/),
    ]);
    expect(planValidationErrors({ ...timePlan, attemptLimit: 5 })).toEqual([
      expect.stringMatching(/must not have attemptLimit/),
    ]);
  });

  it('requires a positive whole-RWF price', () => {
    for (const price of [0, -500, 499.5, '500', null]) {
      expect(planValidationErrors({ ...attemptPlan, price })).toEqual([
        expect.stringMatching(/price/),
      ]);
    }
  });

  it('requires a name in the default locale and rejects unknown locales', () => {
    expect(
      planValidationErrors({ ...attemptPlan, name: { rw: 'Gutangira' } }),
    ).toEqual([expect.stringMatching(/name\.en is required/)]);
    expect(
      planValidationErrors({ ...attemptPlan, name: { en: 'A', de: 'B' } }),
    ).toEqual([expect.stringMatching(/unsupported locale "de"/)]);
  });

  it('validates extra feature lines per locale', () => {
    expect(
      planValidationErrors({
        ...attemptPlan,
        extraFeatures: { en: ['Explanations'], fr: ['Explications'] },
      }),
    ).toEqual([]);
    expect(
      planValidationErrors({ ...attemptPlan, extraFeatures: { en: [''] } }),
    ).toHaveLength(1);
    expect(
      planValidationErrors({ ...attemptPlan, extraFeatures: ['x'] }),
    ).toHaveLength(1);
  });

  it('rejects an unknown access type', () => {
    expect(
      planValidationErrors({ ...attemptPlan, accessType: 'MONTHLY' }),
    ).toEqual([expect.stringMatching(/accessType/)]);
  });
});
