import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Db = Prisma.TransactionClient | PrismaService;

/** Machine-readable code on the 403 the frontend uses to send the user to the pricing page. */
export const SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED';

// Rows that can never grant access, whatever their dates/counters say.
const NEVER_GRANTS: Prisma.EnumUserSubscriptionStatusFilter = {
  notIn: ['PENDING', 'CANCELLED'],
};

const SUMMARY_SELECT = {
  id: true,
  planId: true,
  planName: true,
  accessType: true,
  attemptLimit: true,
  attemptsRemaining: true,
  durationDays: true,
  startsAt: true,
  expiresAt: true,
  source: true,
  createdAt: true,
} satisfies Prisma.UserSubscriptionSelect;

export type SubscriptionSummary = Prisma.UserSubscriptionGetPayload<{
  select: typeof SUMMARY_SELECT;
}>;

export interface AccessSummary {
  /** The time plan covering `now`, if any — bundle attempts are paused while it lasts. */
  activeTimePlan: SubscriptionSummary | null;
  /** Time plans bought ahead, in start order. They activate by date, no job needed. */
  queuedTimePlans: SubscriptionSummary[];
  /** Attempt bundles with attempts left, oldest (next to be consumed) first. */
  bundles: SubscriptionSummary[];
  bundleAttemptsRemaining: number;
  freeExamAvailable: boolean;
  hasAccess: boolean;
}

export interface SubscriptionSnapshot {
  planId: string | null;
  planName: Prisma.InputJsonValue;
  price: number;
  currency: string;
  accessType: 'ATTEMPTS' | 'TIME';
  attemptLimit: number | null;
  durationDays: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The single source of truth for "may this user take an exam?". Every decision is made from
 * dates and counters at query time — status columns are bookkeeping for display/reporting,
 * so queued plans activate and time plans lapse without any background job.
 *
 * Callers that mutate (consume, create) must run inside a transaction and call lockUser()
 * as its *first* statement: it serializes everything that touches one user's access, and
 * because InnoDB only takes a REPEATABLE READ snapshot at the first plain read, every read
 * after the lock sees the latest committed state.
 */
@Injectable()
export class SubscriptionAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async lockUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
  }

  async getAccessSummary(
    userId: string,
    now = new Date(),
    db: Db = this.prisma,
  ): Promise<AccessSummary> {
    const [timePlans, bundles, user] = await Promise.all([
      db.userSubscription.findMany({
        where: {
          userId,
          accessType: 'TIME',
          status: NEVER_GRANTS,
          expiresAt: { gt: now },
        },
        orderBy: { startsAt: 'asc' },
        select: SUMMARY_SELECT,
      }),
      db.userSubscription.findMany({
        where: {
          userId,
          accessType: 'ATTEMPTS',
          status: 'ACTIVE',
          attemptsRemaining: { gt: 0 },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: SUMMARY_SELECT,
      }),
      db.user.findUnique({
        where: { id: userId },
        select: { hasUsedFreeExam: true },
      }),
    ]);

    const activeTimePlan =
      timePlans.find((plan) => plan.startsAt <= now) ?? null;
    const queuedTimePlans = timePlans.filter((plan) => plan.startsAt > now);
    const bundleAttemptsRemaining = bundles.reduce(
      (sum, bundle) => sum + (bundle.attemptsRemaining ?? 0),
      0,
    );
    const freeExamAvailable = user ? !user.hasUsedFreeExam : false;

    return {
      activeTimePlan,
      queuedTimePlans,
      bundles,
      bundleAttemptsRemaining,
      freeExamAvailable,
      hasAccess:
        !!activeTimePlan || bundleAttemptsRemaining > 0 || freeExamAvailable,
    };
  }

  /**
   * Authorizes one exam start (the free first exam is handled by the caller, before this):
   *   1. a time plan covering `now` → allowed, nothing consumed;
   *   2. else the oldest bundle with attempts left → one attempt consumed atomically;
   *   3. else 403 SUBSCRIPTION_REQUIRED.
   * Returns the subscription that authorized the attempt. Requires lockUser() first.
   */
  async consumeForExamStart(
    tx: Prisma.TransactionClient,
    userId: string,
    now = new Date(),
  ): Promise<{ userSubscriptionId: string }> {
    const timePlan = await tx.userSubscription.findFirst({
      where: {
        userId,
        accessType: 'TIME',
        status: NEVER_GRANTS,
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
      orderBy: { startsAt: 'asc' },
      select: { id: true },
    });
    if (timePlan) {
      return { userSubscriptionId: timePlan.id };
    }

    // Oldest bundle first (FIFO by purchase). The decrement is a conditional updateMany — a
    // compare-and-swap that can't take attemptsRemaining below zero even without the user
    // lock. `tried` guarantees progress if a candidate loses that race.
    const tried: string[] = [];
    for (;;) {
      const bundle = await tx.userSubscription.findFirst({
        where: {
          userId,
          accessType: 'ATTEMPTS',
          status: 'ACTIVE',
          attemptsRemaining: { gt: 0 },
          id: { notIn: tried },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });
      if (!bundle) break;

      const consumed = await tx.userSubscription.updateMany({
        where: { id: bundle.id, attemptsRemaining: { gt: 0 } },
        data: { attemptsRemaining: { decrement: 1 } },
      });
      if (consumed.count === 1) {
        await tx.userSubscription.updateMany({
          where: { id: bundle.id, attemptsRemaining: 0 },
          data: { status: 'EXHAUSTED' },
        });
        return { userSubscriptionId: bundle.id };
      }
      tried.push(bundle.id);
    }

    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      code: SUBSCRIPTION_REQUIRED,
      message: 'An active plan is required to start an exam',
    });
  }

  /**
   * Creates a usable subscription from a snapshot, applying the stacking rules: a time plan
   * starts when the user's last active/queued time plan ends (or now), so no paid time is
   * lost; a bundle starts now, never expires, and is kept as its own row. Requires lockUser().
   */
  async createSubscription(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      snapshot: SubscriptionSnapshot;
      source: 'PURCHASE' | 'ADMIN_GRANT' | 'MIGRATION';
      transactionId?: string;
      grantedById?: string;
      note?: string;
    },
    now = new Date(),
  ) {
    const { snapshot } = params;
    let startsAt = now;
    let expiresAt: Date | null = null;

    if (snapshot.accessType === 'TIME') {
      startsAt = await this.nextTimePlanStart(tx, params.userId, now);
      expiresAt = new Date(
        startsAt.getTime() + (snapshot.durationDays ?? 0) * DAY_MS,
      );
    }

    return tx.userSubscription.create({
      data: {
        userId: params.userId,
        planId: snapshot.planId,
        planName: snapshot.planName,
        price: snapshot.price,
        currency: snapshot.currency,
        accessType: snapshot.accessType,
        attemptLimit: snapshot.attemptLimit,
        durationDays: snapshot.durationDays,
        attemptsRemaining:
          snapshot.accessType === 'ATTEMPTS' ? snapshot.attemptLimit : null,
        status: 'ACTIVE',
        source: params.source,
        startsAt,
        expiresAt,
        transactionId: params.transactionId,
        grantedById: params.grantedById,
        note: params.note,
      },
    });
  }

  /** The latest end among the user's active/queued time plans, or `now` if there are none. */
  async nextTimePlanStart(
    tx: Prisma.TransactionClient,
    userId: string,
    now = new Date(),
  ): Promise<Date> {
    const last = await tx.userSubscription.findFirst({
      where: {
        userId,
        accessType: 'TIME',
        status: NEVER_GRANTS,
        expiresAt: { gt: now },
      },
      orderBy: { expiresAt: 'desc' },
      select: { expiresAt: true },
    });
    return last?.expiresAt ?? now;
  }
}

/**
 * The status to show for a row. Stored ACTIVE time plans read as EXPIRED once past expiresAt
 * — derived here rather than by a job, the same way access itself is derived.
 */
export function effectiveStatus(
  row: {
    status: string;
    accessType: string;
    expiresAt: Date | null;
    attemptsRemaining: number | null;
  },
  now = new Date(),
) {
  if (row.status === 'PENDING' || row.status === 'CANCELLED') return row.status;
  if (row.accessType === 'TIME') {
    return row.expiresAt && row.expiresAt <= now ? 'EXPIRED' : 'ACTIVE';
  }
  return (row.attemptsRemaining ?? 0) > 0 ? 'ACTIVE' : 'EXHAUSTED';
}
