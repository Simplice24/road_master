import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppAbility } from '../casl/casl-ability.factory';
import {
  assertCanCreate,
  assertFieldsAllowed,
} from '../casl/policy-assertions';
import { TopUpDto } from './dto/topup.dto';

const TRANSACTION_FIELDS = ['amount', 'provider', 'providerRef'];

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listTransactions(ability: AppAbility) {
    const where = accessibleBy(ability, 'read').ofType(
      'Transaction',
    ) as unknown as Prisma.TransactionWhereInput;

    return this.prisma.transaction.findMany({ where });
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
   * Debits the exam fee and records the charge, from inside the caller's own transaction (see
   * exam-attempts.service.ts#startAttempt) so the debit, transaction row, and attempt creation
   * commit or roll back together. Not exposed on the controller — this is server-authored, not
   * a client-submitted write, so it deliberately bypasses assertFieldsAllowed/assertCanCreate.
   *
   * Uses a conditional updateMany (not findUnique + update) as a compare-and-swap: under
   * MySQL/InnoDB's default REPEATABLE READ, an UPDATE ... WHERE is a locking read, so concurrent
   * debits against the same row correctly serialize on the row lock without needing a
   * Serializable isolation level (there's no DB-level check constraint on walletBalance either,
   * so this is the only thing preventing it from going negative).
   */
  async chargeExamFee(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: Prisma.Decimal | number,
  ) {
    const debited = await tx.user.updateMany({
      where: { id: userId, walletBalance: { gte: amount } },
      data: { walletBalance: { decrement: amount } },
    });
    if (debited.count === 0) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    return tx.transaction.create({
      data: { userId, type: 'EXAM_FEE', status: 'SUCCESS', amount },
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
