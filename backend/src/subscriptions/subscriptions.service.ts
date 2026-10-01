import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppAbility } from '../casl/casl-ability.factory';
import {
  assertCanCreate,
  assertFieldsAllowed,
} from '../casl/policy-assertions';
import { TransactionsService } from '../transactions/transactions.service';
import {
  SubscriptionAccessService,
  SubscriptionSnapshot,
  effectiveStatus,
} from './subscription-access.service';
import {
  ExtendSubscriptionDto,
  GrantSubscriptionDto,
  PurchasePlanDto,
  RevokeSubscriptionDto,
} from './dto/subscription.dto';

const PURCHASE_FIELDS = ['planId'];
const GRANT_FIELDS = [
  'userId',
  'planId',
  'accessType',
  'attemptLimit',
  'durationDays',
  'note',
];
const DAY_MS = 24 * 60 * 60 * 1000;

const LIST_INCLUDE = {
  user: { select: { id: true, fullName: true, phone: true } },
  plan: { select: { id: true, isActive: true } },
} satisfies Prisma.UserSubscriptionInclude;

type SubscriptionRow = Prisma.UserSubscriptionGetPayload<{
  include: typeof LIST_INCLUDE;
}>;

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SubscriptionAccessService,
    private readonly transactionsService: TransactionsService,
  ) {}

  getMyAccess(userId: string) {
    return this.access.getAccessSummary(userId);
  }

  /** Purchase history (own rows for clients, everyone's for staff), newest first. */
  async list(ability: AppAbility) {
    const where = accessibleBy(ability, 'read').ofType(
      'UserSubscription',
    ) as unknown as Prisma.UserSubscriptionWhereInput;

    const rows = await this.prisma.userSubscription.findMany({
      where,
      include: LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    const now = new Date();
    return rows.map((row) => this.shape(row, now));
  }

  /**
   * Buys an active plan with wallet funds: debit, PLAN_PURCHASE ledger row and the
   * subscription commit together or not at all. Never blocked by existing subscriptions —
   * createSubscription() queues time plans and keeps bundles as separate rows.
   *
   * TODO(payment-gateway): for a direct mobile-money/card purchase, create the Transaction and
   * the UserSubscription as PENDING here instead of debiting the wallet, then in the provider's
   * confirmation callback flip both to SUCCESS/ACTIVE and (re)compute startsAt/expiresAt there
   * via SubscriptionAccessService — PENDING rows never grant access.
   */
  async purchase(userId: string, dto: PurchasePlanDto, ability: AppAbility) {
    assertFieldsAllowed(
      ability,
      'create',
      'UserSubscription',
      PURCHASE_FIELDS,
      Object.keys(dto),
    );
    assertCanCreate(ability, 'UserSubscription', {
      userId,
      planId: dto.planId,
      source: 'PURCHASE',
    });

    const id = await this.prisma.$transaction(async (tx) => {
      await this.access.lockUser(tx, userId);

      const plan = await tx.subscriptionPlan.findFirst({
        where: { id: dto.planId, isActive: true },
      });
      if (!plan) {
        throw new NotFoundException('Plan not found or no longer available');
      }

      const transaction = await this.transactionsService.debitForPlanPurchase(
        tx,
        userId,
        plan.price,
      );
      const subscription = await this.access.createSubscription(tx, {
        userId,
        snapshot: {
          planId: plan.id,
          planName: plan.name as Prisma.InputJsonValue,
          price: plan.price,
          currency: plan.currency,
          accessType: plan.accessType,
          attemptLimit: plan.attemptLimit,
          durationDays: plan.durationDays,
        },
        source: 'PURCHASE',
        transactionId: transaction.id,
      });
      return subscription.id;
    });

    return this.findShaped(id);
  }

  async grant(
    grantedById: string,
    dto: GrantSubscriptionDto,
    ability: AppAbility,
  ) {
    assertFieldsAllowed(
      ability,
      'create',
      'UserSubscription',
      GRANT_FIELDS,
      Object.keys(dto),
    );
    assertCanCreate(ability, 'UserSubscription', {
      userId: dto.userId,
      planId: dto.planId,
      source: 'ADMIN_GRANT',
    });

    const id = await this.prisma.$transaction(async (tx) => {
      await this.access.lockUser(tx, dto.userId);
      const user = await tx.user.findUnique({
        where: { id: dto.userId },
        select: { id: true },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const snapshot = await this.grantSnapshot(tx, dto);
      const subscription = await this.access.createSubscription(tx, {
        userId: dto.userId,
        snapshot,
        source: 'ADMIN_GRANT',
        grantedById,
        note: dto.note,
      });
      return subscription.id;
    });

    return this.findShaped(id);
  }

  /** Cancels a subscription (it stops granting access immediately), optionally refunding it. */
  async revoke(
    id: string,
    performedById: string,
    dto: RevokeSubscriptionDto,
    ability: AppAbility,
  ) {
    const existing = await this.findForUpdate(id, ability);

    await this.prisma.$transaction(async (tx) => {
      await this.access.lockUser(tx, existing.userId);
      const row = await tx.userSubscription.findUniqueOrThrow({
        where: { id },
      });
      if (row.status === 'CANCELLED') {
        throw new BadRequestException('This subscription is already revoked');
      }
      if (dto.refund && !(row.source === 'PURCHASE' && row.price > 0)) {
        throw new BadRequestException('Only paid purchases can be refunded');
      }

      await tx.userSubscription.update({
        where: { id },
        data: { status: 'CANCELLED', note: appendNote(row.note, dto.note) },
      });
      if (dto.refund) {
        await this.transactionsService.refundToWallet(
          tx,
          row.userId,
          row.price,
          performedById,
          dto.note,
        );
      }
    });

    return this.findShaped(id);
  }

  /**
   * Adds days to a time plan (shifting any time plans queued after it by the same amount, so
   * they never overlap) or attempts to a bundle (reviving it if exhausted).
   */
  async extend(
    id: string,
    performedById: string,
    dto: ExtendSubscriptionDto,
    ability: AppAbility,
  ) {
    const existing = await this.findForUpdate(id, ability);

    await this.prisma.$transaction(async (tx) => {
      await this.access.lockUser(tx, existing.userId);
      const row = await tx.userSubscription.findUniqueOrThrow({
        where: { id },
      });
      const now = new Date();
      if (row.status === 'CANCELLED' || row.status === 'PENDING') {
        throw new BadRequestException(
          'Only usable subscriptions can be extended',
        );
      }

      if (row.accessType === 'TIME') {
        if (!dto.days || dto.attempts !== undefined) {
          throw new BadRequestException('Time plans are extended by days');
        }
        if (!row.expiresAt || row.expiresAt <= now) {
          throw new BadRequestException(
            'This plan has already expired — grant a new one instead',
          );
        }
        const shiftMs = dto.days * DAY_MS;
        const later = await tx.userSubscription.findMany({
          where: {
            userId: row.userId,
            accessType: 'TIME',
            status: { notIn: ['PENDING', 'CANCELLED'] },
            startsAt: { gte: row.expiresAt },
            id: { not: id },
          },
        });
        for (const queued of later) {
          await tx.userSubscription.update({
            where: { id: queued.id },
            data: {
              startsAt: new Date(queued.startsAt.getTime() + shiftMs),
              expiresAt: new Date(queued.expiresAt!.getTime() + shiftMs),
            },
          });
        }
        await tx.userSubscription.update({
          where: { id },
          data: {
            expiresAt: new Date(row.expiresAt.getTime() + shiftMs),
            durationDays: (row.durationDays ?? 0) + dto.days,
            status: 'ACTIVE',
            note: appendNote(row.note, dto.note),
          },
        });
      } else {
        if (!dto.attempts || dto.days !== undefined) {
          throw new BadRequestException(
            'Attempt bundles are extended by attempts',
          );
        }
        await tx.userSubscription.update({
          where: { id },
          data: {
            attemptsRemaining: { increment: dto.attempts },
            attemptLimit: (row.attemptLimit ?? 0) + dto.attempts,
            status: 'ACTIVE',
            note: appendNote(row.note, dto.note),
          },
        });
      }
    });

    return this.findShaped(id);
  }

  private async grantSnapshot(
    tx: Prisma.TransactionClient,
    dto: GrantSubscriptionDto,
  ): Promise<SubscriptionSnapshot> {
    const custom =
      dto.accessType !== undefined ||
      dto.attemptLimit !== undefined ||
      dto.durationDays !== undefined;

    if (dto.planId) {
      if (custom) {
        throw new BadRequestException(
          'Grant either a plan or a custom allowance, not both',
        );
      }
      const plan = await tx.subscriptionPlan.findUnique({
        where: { id: dto.planId },
      });
      if (!plan) {
        throw new NotFoundException('Plan not found');
      }
      return {
        planId: plan.id,
        planName: plan.name as Prisma.InputJsonValue,
        price: 0,
        currency: plan.currency,
        accessType: plan.accessType,
        attemptLimit: plan.attemptLimit,
        durationDays: plan.durationDays,
      };
    }

    if (
      dto.accessType === 'ATTEMPTS' &&
      dto.attemptLimit &&
      !dto.durationDays
    ) {
      return this.customSnapshot('ATTEMPTS', dto.attemptLimit, null);
    }
    if (dto.accessType === 'TIME' && dto.durationDays && !dto.attemptLimit) {
      return this.customSnapshot('TIME', null, dto.durationDays);
    }
    throw new BadRequestException(
      'Provide planId, or accessType ATTEMPTS with attemptLimit, or accessType TIME with durationDays',
    );
  }

  // Custom grants have no catalog name — the frontend labels an empty planName generically.
  private customSnapshot(
    accessType: 'ATTEMPTS' | 'TIME',
    attemptLimit: number | null,
    durationDays: number | null,
  ): SubscriptionSnapshot {
    return {
      planId: null,
      planName: {},
      price: 0,
      currency: 'RWF',
      accessType,
      attemptLimit,
      durationDays,
    };
  }

  private async findForUpdate(id: string, ability: AppAbility) {
    const row = await this.prisma.userSubscription.findFirst({
      where: {
        AND: [
          { id },
          accessibleBy(ability, 'update').ofType('UserSubscription'),
        ],
      },
      select: { id: true, userId: true },
    });
    if (!row) {
      throw new NotFoundException('Subscription not found');
    }
    return row;
  }

  private async findShaped(id: string) {
    const row = await this.prisma.userSubscription.findUniqueOrThrow({
      where: { id },
      include: LIST_INCLUDE,
    });
    return this.shape(row, new Date());
  }

  private shape(row: SubscriptionRow, now: Date) {
    return {
      ...row,
      status: effectiveStatus(row, now),
      isQueued:
        row.accessType === 'TIME' &&
        row.status !== 'CANCELLED' &&
        row.status !== 'PENDING' &&
        row.startsAt > now,
    };
  }
}

/** Keeps the full admin trail (grant reason, then each revoke/extend) on the row. */
function appendNote(existing: string | null, next: string) {
  return existing ? `${existing}\n${next}` : next;
}
