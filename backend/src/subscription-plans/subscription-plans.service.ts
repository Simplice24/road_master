import {
  BadRequestException,
  ConflictException,
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
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import {
  assertValidPlan,
  cleanLocalizedLines,
  cleanLocalizedText,
} from './plan-validation';
import type { LocalizedLines } from './plan-locales';

const PLAN_FIELDS = [
  'name',
  'extraFeatures',
  'price',
  'accessType',
  'attemptLimit',
  'durationDays',
  'isActive',
  'isMostPopular',
];

// What the public pricing page gets — no admin bookkeeping (timestamps, purchase counts).
const PUBLIC_PLAN_SELECT = {
  id: true,
  name: true,
  extraFeatures: true,
  price: true,
  currency: true,
  accessType: true,
  attemptLimit: true,
  durationDays: true,
  isMostPopular: true,
  displayOrder: true,
} satisfies Prisma.SubscriptionPlanSelect;

const ORDER = [{ displayOrder: 'asc' as const }, { createdAt: 'asc' as const }];

@Injectable()
export class SubscriptionPlansService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public: active plans only, in display order. Deactivated plans simply disappear here. */
  listActive() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      select: PUBLIC_PLAN_SELECT,
      orderBy: ORDER,
    });
  }

  /** Admin: every plan, inactive included, with how many times each was bought/granted. */
  listAll(ability: AppAbility) {
    const where = accessibleBy(ability, 'read').ofType(
      'SubscriptionPlan',
    ) as unknown as Prisma.SubscriptionPlanWhereInput;

    return this.prisma.subscriptionPlan.findMany({
      where,
      orderBy: ORDER,
      include: { _count: { select: { subscriptions: true } } },
    });
  }

  async create(dto: CreatePlanDto, ability: AppAbility) {
    assertFieldsAllowed(
      ability,
      'create',
      'SubscriptionPlan',
      PLAN_FIELDS,
      Object.keys(dto),
    );
    assertCanCreate(ability, 'SubscriptionPlan', dto);

    const data = this.normalize(dto);
    assertValidPlan(data);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isMostPopular) {
        await this.clearMostPopular(tx);
      }
      const last = await tx.subscriptionPlan.aggregate({
        _max: { displayOrder: true },
      });
      return tx.subscriptionPlan.create({
        data: {
          ...data,
          extraFeatures: data.extraFeatures ?? Prisma.DbNull,
          isActive: dto.isActive ?? true,
          isMostPopular: dto.isMostPopular ?? false,
          displayOrder: (last._max.displayOrder ?? -1) + 1,
        },
      });
    });
  }

  /**
   * Edits affect future purchases only: UserSubscription rows carry their own snapshot of
   * name/price/limits, so nothing here touches them.
   */
  async update(id: string, dto: UpdatePlanDto, ability: AppAbility) {
    assertFieldsAllowed(
      ability,
      'update',
      'SubscriptionPlan',
      PLAN_FIELDS,
      Object.keys(dto),
    );

    const existing = await this.findForAction(id, 'update', ability);
    const merged = this.normalize({
      name: (dto.name ?? existing.name) as CreatePlanDto['name'],
      extraFeatures:
        dto.extraFeatures !== undefined
          ? dto.extraFeatures
          : (existing.extraFeatures as LocalizedLines | null),
      price: dto.price ?? existing.price,
      accessType: dto.accessType ?? existing.accessType,
      attemptLimit:
        dto.attemptLimit !== undefined
          ? dto.attemptLimit
          : existing.attemptLimit,
      durationDays:
        dto.durationDays !== undefined
          ? dto.durationDays
          : existing.durationDays,
    });
    assertValidPlan(merged);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isMostPopular) {
        await this.clearMostPopular(tx, id);
      }
      return tx.subscriptionPlan.update({
        where: { id },
        data: {
          ...merged,
          extraFeatures: merged.extraFeatures ?? Prisma.DbNull,
          isActive: dto.isActive,
          isMostPopular: dto.isMostPopular,
        },
      });
    });
  }

  /** Applies a full ordering of every plan in one transaction. */
  async reorder(planIds: string[], ability: AppAbility) {
    const where = accessibleBy(ability, 'update').ofType(
      'SubscriptionPlan',
    ) as unknown as Prisma.SubscriptionPlanWhereInput;

    return this.prisma.$transaction(async (tx) => {
      const plans = await tx.subscriptionPlan.findMany({
        where,
        select: { id: true },
      });
      const known = new Set(plans.map((plan) => plan.id));
      if (
        planIds.length !== known.size ||
        !planIds.every((planId) => known.has(planId))
      ) {
        throw new BadRequestException(
          'planIds must list every plan exactly once',
        );
      }
      for (const [index, planId] of planIds.entries()) {
        await tx.subscriptionPlan.update({
          where: { id: planId },
          data: { displayOrder: index },
        });
      }
      return tx.subscriptionPlan.findMany({
        where,
        orderBy: ORDER,
        include: { _count: { select: { subscriptions: true } } },
      });
    });
  }

  /** Only never-purchased plans can be deleted; anything else must be deactivated instead. */
  async remove(id: string, ability: AppAbility) {
    await this.findForAction(id, 'delete', ability);

    const purchases = await this.prisma.userSubscription.count({
      where: { planId: id },
    });
    if (purchases > 0) {
      throw new ConflictException(
        'This plan has purchases and can only be deactivated, not deleted',
      );
    }

    try {
      return await this.prisma.subscriptionPlan.delete({ where: { id } });
    } catch (error) {
      // A purchase landed between the count and the delete — the FK (onDelete: Restrict) wins.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'This plan has purchases and can only be deactivated, not deleted',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Plan not found');
      }
      throw error;
    }
  }

  /** At most one "most popular" plan: setting it on one clears it everywhere else. */
  private clearMostPopular(tx: Prisma.TransactionClient, exceptId?: string) {
    return tx.subscriptionPlan.updateMany({
      where: {
        isMostPopular: true,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { isMostPopular: false },
    });
  }

  private async findForAction(
    id: string,
    action: 'update' | 'delete',
    ability: AppAbility,
  ) {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: {
        AND: [{ id }, accessibleBy(ability, action).ofType('SubscriptionPlan')],
      },
    });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    return plan;
  }

  private normalize(input: {
    name: CreatePlanDto['name'];
    extraFeatures?: LocalizedLines | null;
    price: number;
    accessType: CreatePlanDto['accessType'];
    attemptLimit?: number | null;
    durationDays?: number | null;
  }) {
    return {
      name: cleanLocalizedText(input.name ?? {}),
      extraFeatures: cleanLocalizedLines(input.extraFeatures),
      price: input.price,
      accessType: input.accessType,
      attemptLimit: input.attemptLimit ?? null,
      durationDays: input.durationDays ?? null,
    };
  }
}
