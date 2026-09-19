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
import { TransactionsService } from '../transactions/transactions.service';
import { StartExamAttemptDto } from './dto/start-exam-attempt.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';

const EXAM_ATTEMPT_FIELDS = ['examConfigId', 'categoryId'];

const ATTEMPT_DETAIL_INCLUDE = {
  examConfig: true,
  questions: {
    orderBy: { order: 'asc' as const },
    include: { question: { include: { options: true } } },
  },
  answers: { include: { selectedOptions: true } },
} satisfies Prisma.ExamAttemptInclude;

type AttemptDetail = Prisma.ExamAttemptGetPayload<{
  include: typeof ATTEMPT_DETAIL_INCLUDE;
}>;

@Injectable()
export class ExamAttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async listAttempts(ability: AppAbility) {
    const where = accessibleBy(ability, 'read').ofType(
      'ExamAttempt',
    ) as unknown as Prisma.ExamAttemptWhereInput;

    return this.prisma.examAttempt.findMany({ where });
  }

  async getAttempt(id: string, ability: AppAbility) {
    const where: Prisma.ExamAttemptWhereInput = {
      AND: [{ id }, accessibleBy(ability, 'read').ofType('ExamAttempt')],
    };
    const attempt = await this.prisma.examAttempt.findFirst({
      where,
      include: ATTEMPT_DETAIL_INCLUDE,
    });
    if (!attempt) {
      throw new NotFoundException('Exam attempt not found');
    }
    return this.shapeAttempt(attempt);
  }

  async startAttempt(
    userId: string,
    dto: StartExamAttemptDto,
    ability: AppAbility,
  ) {
    assertFieldsAllowed(
      ability,
      'create',
      'ExamAttempt',
      EXAM_ATTEMPT_FIELDS,
      Object.keys(dto),
    );
    assertCanCreate(ability, 'ExamAttempt', {
      userId,
      examConfigId: dto.examConfigId,
      categoryId: dto.categoryId,
    });

    const attemptId = await this.prisma.$transaction(async (tx) => {
      const examConfig = await tx.examConfig.findFirst({
        where: { id: dto.examConfigId, isActive: true },
      });
      if (!examConfig) {
        throw new NotFoundException('Exam config not found or inactive');
      }

      const inProgress = await tx.examAttempt.findFirst({
        where: { userId, status: 'IN_PROGRESS' },
        include: { examConfig: true },
      });
      if (inProgress) {
        const deadline = new Date(
          inProgress.startedAt.getTime() +
            inProgress.examConfig.durationMinutes * 60_000,
        );
        if (deadline > new Date()) {
          throw new BadRequestException('You already have an exam in progress');
        }
        await tx.examAttempt.update({
          where: { id: inProgress.id },
          data: { status: 'ABANDONED' },
        });
      }

      let selected: { id: string }[];
      if (dto.categoryId) {
        const category = await tx.category.findUnique({
          where: { id: dto.categoryId },
        });
        if (!category) {
          throw new NotFoundException('Category not found');
        }
        const categoryQuestions = await tx.question.findMany({
          where: { isActive: true, categoryId: dto.categoryId },
          select: { id: true },
        });
        if (categoryQuestions.length < examConfig.numberOfQuestions) {
          throw new BadRequestException(
            `Not enough active questions in this category to start this exam (need ${examConfig.numberOfQuestions}, have ${categoryQuestions.length})`,
          );
        }
        selected = this.shuffle(categoryQuestions).slice(
          0,
          examConfig.numberOfQuestions,
        );
      } else {
        selected = await this.selectBalancedQuestions(
          tx,
          examConfig.numberOfQuestions,
        );
      }

      // Compare-and-swap on the free-exam flag: a plain findUnique + blind update would let two
      // concurrent starts both observe hasUsedFreeExam=false (a SELECT is a snapshot read under
      // MySQL's default REPEATABLE READ, unblocked by a concurrent uncommitted write), granting
      // two free exams. updateMany's WHERE turns this into a locking read, same as
      // TransactionsService#chargeExamFee's balance CAS below.
      const claimed = await tx.user.updateMany({
        where: { id: userId, hasUsedFreeExam: false },
        data: { hasUsedFreeExam: true },
      });
      const isFree = claimed.count === 1;

      let transactionId: string | undefined;
      if (!isFree && examConfig.price.greaterThan(0)) {
        const transaction = await this.transactionsService.chargeExamFee(
          tx,
          userId,
          examConfig.price,
        );
        transactionId = transaction.id;
      }

      const attempt = await tx.examAttempt.create({
        data: {
          userId,
          examConfigId: dto.examConfigId,
          categoryId: dto.categoryId,
          transactionId,
          isFree,
          totalQuestions: selected.length,
          questions: {
            create: selected.map((question, index) => ({
              questionId: question.id,
              order: index + 1,
            })),
          },
        },
      });

      return attempt.id;
    });

    return this.getAttempt(attemptId, ability);
  }

  async submitAnswer(id: string, dto: SubmitAnswerDto, ability: AppAbility) {
    const where: Prisma.ExamAttemptWhereInput = {
      AND: [{ id }, accessibleBy(ability, 'update').ofType('ExamAttempt')],
    };
    const attempt = await this.prisma.examAttempt.findFirst({
      where,
      include: { examConfig: true },
    });
    if (!attempt) {
      throw new NotFoundException('Exam attempt not found');
    }
    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Exam attempt is not in progress');
    }

    const deadline = new Date(
      attempt.startedAt.getTime() + attempt.examConfig.durationMinutes * 60_000,
    );
    if (deadline <= new Date()) {
      try {
        await this.prisma.examAttempt.update({
          where: { id },
          data: { status: 'ABANDONED' },
        });
      } catch (error) {
        throw this.mapPrismaError(error, 'Exam attempt not found');
      }
      throw new BadRequestException(
        'Exam attempt time limit has been exceeded',
      );
    }

    const link = await this.prisma.examAttemptQuestion.findUnique({
      where: {
        examAttemptId_questionId: {
          examAttemptId: id,
          questionId: dto.questionId,
        },
      },
    });
    if (!link) {
      throw new BadRequestException('Question does not belong to this attempt');
    }

    const question = await this.prisma.question.findUniqueOrThrow({
      where: { id: dto.questionId },
      include: { options: true },
    });

    const validOptionIds = new Set(question.options.map((option) => option.id));
    for (const optionId of dto.optionIds) {
      if (!validOptionIds.has(optionId)) {
        throw new BadRequestException(
          `Option ${optionId} does not belong to this question`,
        );
      }
    }
    if (!question.allowMultiple && dto.optionIds.length > 1) {
      throw new BadRequestException(
        'Only one option can be selected for this question',
      );
    }

    const correctOptionIds = new Set(
      question.options
        .filter((option) => option.isCorrect)
        .map((option) => option.id),
    );
    const submittedOptionIds = new Set(dto.optionIds);
    const isCorrect =
      submittedOptionIds.size === correctOptionIds.size &&
      [...submittedOptionIds].every((optionId) =>
        correctOptionIds.has(optionId),
      );

    const answer = await this.prisma.examAttemptAnswer.upsert({
      where: {
        examAttemptId_questionId: {
          examAttemptId: id,
          questionId: dto.questionId,
        },
      },
      create: {
        examAttemptId: id,
        questionId: dto.questionId,
        isCorrect,
        answeredAt: new Date(),
        selectedOptions: {
          create: dto.optionIds.map((optionId) => ({ optionId })),
        },
      },
      update: {
        isCorrect,
        answeredAt: new Date(),
        selectedOptions: {
          deleteMany: {},
          create: dto.optionIds.map((optionId) => ({ optionId })),
        },
      },
    });

    // isCorrect deliberately withheld from the response — don't leak correctness mid-exam.
    return {
      questionId: answer.questionId,
      selectedOptionIds: dto.optionIds,
      answeredAt: answer.answeredAt,
    };
  }

  async completeAttempt(id: string, ability: AppAbility) {
    const where: Prisma.ExamAttemptWhereInput = {
      AND: [{ id }, accessibleBy(ability, 'update').ofType('ExamAttempt')],
    };
    const attempt = await this.prisma.examAttempt.findFirst({
      where,
      include: { examConfig: true, answers: true },
    });
    if (!attempt) {
      throw new NotFoundException('Exam attempt not found');
    }
    // Intentionally not subject to the durationMinutes deadline check that submitAnswer applies
    // — a user finishing late should still be able to submit their final score for whatever was
    // answered, rather than being locked out of completing altogether.
    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Exam attempt has already been finalized');
    }

    // Unanswered questions have no ExamAttemptAnswer row, so they're correctly excluded here
    // and counted as wrong.
    const score = attempt.answers.filter((answer) => answer.isCorrect).length;
    const percentage = new Prisma.Decimal(score)
      .dividedBy(attempt.totalQuestions)
      .times(100)
      .toDecimalPlaces(2);
    const passed = percentage.gte(attempt.examConfig.passMarkPercent);

    try {
      await this.prisma.examAttempt.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          score,
          percentage,
          passed,
        },
      });
    } catch (error) {
      throw this.mapPrismaError(error, 'Exam attempt not found');
    }

    return this.getAttempt(id, ability);
  }

  /**
   * While IN_PROGRESS, strips isCorrect/explanation so a candidate can't read the answer key
   * mid-exam; once COMPLETED/ABANDONED, reveals both for review.
   */
  private shapeAttempt(attempt: AttemptDetail) {
    const revealAnswers = attempt.status !== 'IN_PROGRESS';

    return {
      ...attempt,
      questions: attempt.questions.map((link) => ({
        order: link.order,
        question: {
          id: link.question.id,
          type: link.question.type,
          text: link.question.text,
          imageUrl: link.question.imageUrl,
          allowMultiple: link.question.allowMultiple,
          explanation: revealAnswers ? link.question.explanation : undefined,
          options: link.question.options.map((option) => ({
            id: option.id,
            text: option.text,
            imageUrl: option.imageUrl,
            isCorrect: revealAnswers ? option.isCorrect : undefined,
          })),
        },
      })),
      answers: attempt.answers.map((answer) => ({
        questionId: answer.questionId,
        selectedOptionIds: answer.selectedOptions.map(
          (selected) => selected.optionId,
        ),
        isCorrect: revealAnswers ? answer.isCorrect : undefined,
        answeredAt: answer.answeredAt,
      })),
    };
  }

  /**
   * No-category attempts must still be a real, comprehensive exam — not a uniform-random draw
   * over the whole bank, which would over-represent large categories and under-represent small
   * ones. Splits numberOfQuestions evenly across every category with active questions, then
   * redistributes any per-category shortfall (a thin category with fewer questions than its
   * quota) round-robin onto categories with spare capacity, so the exam still hits its target
   * count whenever the bank as a whole has enough questions.
   */
  private async selectBalancedQuestions(
    tx: Prisma.TransactionClient,
    numberOfQuestions: number,
  ): Promise<{ id: string }[]> {
    const activeQuestions = await tx.question.findMany({
      where: { isActive: true },
      select: { id: true, categoryId: true },
    });

    const byCategory = new Map<string, string[]>();
    for (const question of activeQuestions) {
      const bucket = byCategory.get(question.categoryId);
      if (bucket) {
        bucket.push(question.id);
      } else {
        byCategory.set(question.categoryId, [question.id]);
      }
    }

    const categoryIds = this.shuffle([...byCategory.keys()]);
    if (categoryIds.length === 0) {
      throw new BadRequestException(
        'No active questions available to start this exam',
      );
    }

    // Split evenly; hand the remainder to a random subset (via the shuffled category order
    // above) so no single category is always the one that gets the extra question.
    const baseQuota = Math.floor(numberOfQuestions / categoryIds.length);
    const remainder = numberOfQuestions % categoryIds.length;
    const quota = new Map<string, number>(
      categoryIds.map((categoryId, index) => [
        categoryId,
        baseQuota + (index < remainder ? 1 : 0),
      ]),
    );

    let shortfall = 0;
    for (const categoryId of categoryIds) {
      const available = byCategory.get(categoryId)!.length;
      const want = quota.get(categoryId)!;
      if (want > available) {
        shortfall += want - available;
        quota.set(categoryId, available);
      }
    }
    for (const categoryId of categoryIds) {
      if (shortfall === 0) break;
      const available = byCategory.get(categoryId)!.length;
      const spare = available - quota.get(categoryId)!;
      if (spare <= 0) continue;
      const take = Math.min(spare, shortfall);
      quota.set(categoryId, quota.get(categoryId)! + take);
      shortfall -= take;
    }

    if (shortfall > 0) {
      throw new BadRequestException(
        `Not enough active questions to start this exam (need ${numberOfQuestions}, have ${activeQuestions.length})`,
      );
    }

    const selectedIds = categoryIds.flatMap((categoryId) =>
      this.shuffle(byCategory.get(categoryId)!).slice(0, quota.get(categoryId)),
    );

    return this.shuffle(selectedIds.map((id) => ({ id })));
  }

  private shuffle<T>(items: T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  private mapPrismaError(error: unknown, notFoundMessage: string): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return new NotFoundException(notFoundMessage);
      }
    }
    return error as Error;
  }
}
