import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import {
  SUBSCRIPTION_REQUIRED,
  SubscriptionAccessService,
  effectiveStatus,
} from './subscription-access.service';
import { FakeSubscriptionStore } from './testing/fake-subscription-store';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-01T10:00:00Z');
const daysFromNow = (days: number) => new Date(NOW.getTime() + days * DAY);

function setup() {
  const store = new FakeSubscriptionStore();
  const service = new SubscriptionAccessService(
    store as unknown as PrismaService,
  );
  const tx = store as unknown as Prisma.TransactionClient;
  return { store, service, tx };
}

const timePlan = (startsIn: number, days: number) => ({
  accessType: 'TIME' as const,
  durationDays: days,
  startsAt: daysFromNow(startsIn),
  expiresAt: daysFromNow(startsIn + days),
});
const bundle = (remaining: number, limit = remaining) => ({
  accessType: 'ATTEMPTS' as const,
  attemptLimit: limit,
  attemptsRemaining: remaining,
  startsAt: daysFromNow(-30),
});

describe('SubscriptionAccessService.consumeForExamStart', () => {
  it('allows an active time plan without consuming bundle attempts', async () => {
    const { store, service, tx } = setup();
    const time = store.add(timePlan(-2, 7));
    const saved = store.add(bundle(3));

    const result = await service.consumeForExamStart(tx, 'user-1', NOW);

    expect(result.userSubscriptionId).toBe(time.id);
    expect(store.get(saved.id).attemptsRemaining).toBe(3);
  });

  it('does not treat an expired time plan as access', async () => {
    const { store, service, tx } = setup();
    store.add(timePlan(-10, 7)); // ended 3 days ago

    await expect(
      service.consumeForExamStart(tx, 'user-1', NOW),
    ).rejects.toThrow(ForbiddenException);
  });

  it('activates a queued time plan purely by date — no job needed', async () => {
    const { store, service, tx } = setup();
    const queued = store.add(timePlan(3, 7)); // starts in 3 days

    await expect(
      service.consumeForExamStart(tx, 'user-1', NOW),
    ).rejects.toThrow(ForbiddenException);
    const later = daysFromNow(4);
    await expect(
      service.consumeForExamStart(tx, 'user-1', later),
    ).resolves.toEqual({
      userSubscriptionId: queued.id,
    });
  });

  it('ignores cancelled and pending time plans', async () => {
    const { store, service, tx } = setup();
    store.add({ ...timePlan(-1, 7), status: 'CANCELLED' });
    store.add({ ...timePlan(-1, 7), status: 'PENDING' });

    await expect(
      service.consumeForExamStart(tx, 'user-1', NOW),
    ).rejects.toThrow(ForbiddenException);
  });

  it('consumes bundles oldest-first and marks one EXHAUSTED at zero', async () => {
    const { store, service, tx } = setup();
    const oldest = store.add(bundle(1, 5));
    const newer = store.add(bundle(5));

    const first = await service.consumeForExamStart(tx, 'user-1', NOW);
    expect(first.userSubscriptionId).toBe(oldest.id);
    expect(store.get(oldest.id)).toMatchObject({
      attemptsRemaining: 0,
      status: 'EXHAUSTED',
    });
    expect(store.get(newer.id).attemptsRemaining).toBe(5);

    const second = await service.consumeForExamStart(tx, 'user-1', NOW);
    expect(second.userSubscriptionId).toBe(newer.id);
    expect(store.get(newer.id).attemptsRemaining).toBe(4);
  });

  it('denies with a structured SUBSCRIPTION_REQUIRED error once everything is exhausted', async () => {
    const { store, service, tx } = setup();
    store.add({ ...bundle(0, 5), status: 'EXHAUSTED' });

    const error = await service
      .consumeForExamStart(tx, 'user-1', NOW)
      .catch((e: ForbiddenException) => e);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      code: SUBSCRIPTION_REQUIRED,
    });
  });

  it('moves on to the next bundle when the oldest loses a decrement race', async () => {
    const { store, service, tx } = setup();
    const oldest = store.add(bundle(1));
    const next = store.add(bundle(2));
    // Simulate a concurrent start draining `oldest` between this call's read and its CAS.
    const realUpdateMany =
      store.userSubscription.updateMany.getMockImplementation()!;
    store.userSubscription.updateMany.mockImplementationOnce((args) => {
      store.get(oldest.id).attemptsRemaining = 0;
      return realUpdateMany(args);
    });

    const result = await service.consumeForExamStart(tx, 'user-1', NOW);

    expect(result.userSubscriptionId).toBe(next.id);
    expect(store.get(oldest.id).attemptsRemaining).toBe(0);
    expect(store.get(next.id).attemptsRemaining).toBe(1);
  });
});

describe('SubscriptionAccessService.createSubscription', () => {
  const snapshot = (accessType: 'TIME' | 'ATTEMPTS', limit: number) => ({
    planId: 'plan-1',
    planName: { en: 'Plan' },
    price: 3000,
    currency: 'RWF',
    accessType,
    attemptLimit: accessType === 'ATTEMPTS' ? limit : null,
    durationDays: accessType === 'TIME' ? limit : null,
  });

  it('starts a time plan now when no time plan is active or queued', async () => {
    const { service, tx } = setup();
    const row = await service.createSubscription(
      tx,
      { userId: 'user-1', snapshot: snapshot('TIME', 7), source: 'PURCHASE' },
      NOW,
    );
    expect(row.startsAt).toEqual(NOW);
    expect(row.expiresAt).toEqual(daysFromNow(7));
  });

  it('queues a time plan after the latest active/queued time plan, losing no time', async () => {
    const { store, service, tx } = setup();
    store.add(timePlan(-2, 7)); // active, ends in 5 days
    store.add(timePlan(5, 14)); // queued, ends in 19 days

    const row = await service.createSubscription(
      tx,
      { userId: 'user-1', snapshot: snapshot('TIME', 30), source: 'PURCHASE' },
      NOW,
    );
    expect(row.startsAt).toEqual(daysFromNow(19));
    expect(row.expiresAt).toEqual(daysFromNow(49));
  });

  it('does not queue behind a cancelled time plan', async () => {
    const { store, service, tx } = setup();
    store.add({ ...timePlan(-2, 30), status: 'CANCELLED' });

    const row = await service.createSubscription(
      tx,
      { userId: 'user-1', snapshot: snapshot('TIME', 7), source: 'PURCHASE' },
      NOW,
    );
    expect(row.startsAt).toEqual(NOW);
  });

  it('creates bundles as separate never-expiring rows', async () => {
    const { store, service, tx } = setup();
    store.add(bundle(2, 5));

    const row = await service.createSubscription(
      tx,
      {
        userId: 'user-1',
        snapshot: snapshot('ATTEMPTS', 5),
        source: 'PURCHASE',
      },
      NOW,
    );
    expect(row).toMatchObject({
      attemptsRemaining: 5,
      expiresAt: null,
      startsAt: NOW,
    });
    expect(store.rows.filter((r) => r.accessType === 'ATTEMPTS')).toHaveLength(
      2,
    );
  });
});

describe('SubscriptionAccessService.getAccessSummary', () => {
  it('reports the active plan, queued plans and saved bundle attempts', async () => {
    const { store, service } = setup();
    const active = store.add(timePlan(-1, 7));
    const queued = store.add(timePlan(6, 14));
    store.add(bundle(2));
    store.add(bundle(3));
    store.add({ ...bundle(0, 5), status: 'EXHAUSTED' });

    const summary = await service.getAccessSummary('user-1', NOW);

    expect(summary.activeTimePlan?.id).toBe(active.id);
    expect(summary.queuedTimePlans.map((p) => p.id)).toEqual([queued.id]);
    expect(summary.bundleAttemptsRemaining).toBe(5);
    expect(summary.hasAccess).toBe(true);
  });

  it('reports no access when nothing is usable and the free exam is spent', async () => {
    const { store, service } = setup();
    store.add(timePlan(-30, 7));

    const summary = await service.getAccessSummary('user-1', NOW);
    expect(summary).toMatchObject({
      activeTimePlan: null,
      queuedTimePlans: [],
      bundleAttemptsRemaining: 0,
      freeExamAvailable: false,
      hasAccess: false,
    });
  });
});

describe('effectiveStatus', () => {
  it('derives EXPIRED/EXHAUSTED from dates and counters', () => {
    const base = { status: 'ACTIVE', attemptsRemaining: null };
    expect(
      effectiveStatus(
        { ...base, accessType: 'TIME', expiresAt: daysFromNow(-1) },
        NOW,
      ),
    ).toBe('EXPIRED');
    expect(
      effectiveStatus(
        { ...base, accessType: 'TIME', expiresAt: daysFromNow(1) },
        NOW,
      ),
    ).toBe('ACTIVE');
    expect(
      effectiveStatus(
        {
          status: 'ACTIVE',
          accessType: 'ATTEMPTS',
          expiresAt: null,
          attemptsRemaining: 0,
        },
        NOW,
      ),
    ).toBe('EXHAUSTED');
    expect(
      effectiveStatus(
        {
          status: 'CANCELLED',
          accessType: 'TIME',
          expiresAt: daysFromNow(1),
          attemptsRemaining: null,
        },
        NOW,
      ),
    ).toBe('CANCELLED');
  });
});
