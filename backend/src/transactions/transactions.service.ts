import {
  BadRequestException,
  ForbiddenException,
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
import { TopUpDto } from './dto/topup.dto';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';

const TRANSACTION_FIELDS = ['amount', 'provider', 'providerRef'];
const ADJUST_FIELDS = ['userId', 'amount', 'note'];

/** Machine-readable code on the 400 the frontend uses to offer a wallet top-up. */
export const INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listTransactions(ability: AppAbility) {
    const where = accessibleBy(ability, 'read').ofType(
      'Transaction',
    ) as unknown as Prisma.TransactionWhereInput;

    return this.prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async topUp(userId: string, data: TopUpDto, ability: AppAbility) {
    assertFieldsAllowed(
      ability,
      'create',
      'Transaction',
      TRANSACTION_FIELDS,
      Object.keys(data),
    );
    assertCanCreate(ability, 'Transaction', {
      userId,
      amount: data.amount,
      type: 'TOPUP',
    });

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: 'TOPUP',
          status: 'SUCCESS',
          amount: data.amount,
          provider: data.provider,
          providerRef: data.providerRef,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { walletBalance: { increment: data.amount } },
      });

      return transaction;
    });
  }

  /**
   * Debits a plan's price and records the PLAN_PURCHASE, from inside the caller's own
   * transaction (see subscriptions.service.ts#purchase) so the debit, ledger row and
   * subscription commit or roll back together. Not exposed on the controller — this is
   * server-authored (the amount comes from the plan row, not the client), so it deliberately
   * bypasses assertFieldsAllowed/assertCanCreate. Exams themselves never touch the wallet.
   *
   * Uses a conditional updateMany (not findUnique + update) as a compare-and-swap: under
   * MySQL/InnoDB's default REPEATABLE READ, an UPDATE ... WHERE is a locking read, so concurrent
   * debits against the same row correctly serialize on the row lock without needing a
   * Serializable isolation level (there's no DB-level check constraint on walletBalance either,
   * so this is the only thing preventing it from going negative).
   */
  async debitForPlanPurchase(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
  ) {
    const debited = await tx.user.updateMany({
      where: { id: userId, walletBalance: { gte: amount } },
      data: { walletBalance: { decrement: amount } },
    });
    if (debited.count === 0) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: INSUFFICIENT_FUNDS,
        message: 'Insufficient wallet balance',
      });
    }

    return tx.transaction.create({
      data: { userId, type: 'PLAN_PURCHASE', status: 'SUCCESS', amount },
    });
  }

  /** Credits a plan's price back when an admin revokes a purchase with a refund. */
  async refundToWallet(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
    performedById: string,
    note?: string,
  ) {
    await tx.user.update({
      where: { id: userId },
      data: { walletBalance: { increment: amount } },
    });
    return tx.transaction.create({
      data: {
        userId,
        type: 'REFUND',
        status: 'SUCCESS',
        amount,
        performedById,
        note,
      },
    });
  }

  /**
   * Admin correction of someone else's wallet (support cases, payment issues). The amount is
   * signed; a debit can't take the balance below zero. Self-adjustment is refused: the
   * client role's own-wallet top-up rule would otherwise satisfy assertCanCreate here too.
   */
  async adjust(
    performedById: string,
    data: AdjustBalanceDto,
    ability: AppAbility,
  ) {
    assertFieldsAllowed(
      ability,
      'create',
      'Transaction',
      ADJUST_FIELDS,
      Object.keys(data),
    );
    if (data.userId === performedById) {
      throw new ForbiddenException('You cannot adjust your own wallet');
    }
    assertCanCreate(ability, 'Transaction', {
      userId: data.userId,
      amount: data.amount,
      type: 'ADMIN_ADJUSTMENT',
    });

    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: {
          id: data.userId,
          ...(data.amount < 0
            ? { walletBalance: { gte: Math.abs(data.amount) } }
            : {}),
        },
        data: { walletBalance: { increment: data.amount } },
      });
      if (changed.count === 0) {
        const exists = await tx.user.count({ where: { id: data.userId } });
        throw exists
          ? new BadRequestException(
              'Adjustment would make the balance negative',
            )
          : new NotFoundException('User not found');
      }

      return tx.transaction.create({
        data: {
          userId: data.userId,
          type: 'ADMIN_ADJUSTMENT',
          status: 'SUCCESS',
          amount: data.amount,
          performedById,
          note: data.note,
        },
      });
    });
  }

  private mapPrismaError(error: unknown, notFoundMessage: string): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return new NotFoundException(notFoundMessage);
      }
      if (error.code === 'P2003') {
        return new BadRequestException('Invalid transaction reference');
      }
    }
    return error as Error;
  }
}
