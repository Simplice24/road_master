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
import { CreateOptionDto, CreateQuestionDto } from './dto/create-question';
import { UpdateOptionDto, UpdateQuestionDto } from './dto/update-question';
import { ListQuestionsQuery } from './dto/list-questions.query';
import { QuestionImageStorage } from './question-image.storage';

const QUESTION_FIELDS = [
  'categoryId',
  'type',
  'text',
  'imageUrl',
  'explanation',
  'isActive',
  'allowMultiple',
  'options',
];

// Options are always returned in display order. Labels (A, B, C…) are derived from this order
// by the client, never stored, and correctness lives on each option row (isCorrect) — so
// reordering can never change which option is correct.
const DETAIL_INCLUDE = {
  category: { select: { id: true, name: true } },
  options: { orderBy: { position: 'asc' as const } },
} satisfies Prisma.QuestionInclude;

@Injectable()
export class QuestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: QuestionImageStorage,
  ) {}

  /** Admin question bank: paginated, newest first, soft-deleted questions excluded. */
  async listQuestions(query: ListQuestionsQuery, ability: AppAbility) {
    const filters: Prisma.QuestionWhereInput[] = [
      accessibleBy(ability, 'read').ofType('Question'),
      { deletedAt: null },
    ];
    const search = query.search?.trim();
    if (search) filters.push({ text: { contains: search } });
    if (query.categoryId) filters.push({ categoryId: query.categoryId });
    if (query.image === 'with') filters.push({ imageUrl: { not: null } });
    if (query.image === 'without') filters.push({ imageUrl: null });
    if (query.status) filters.push({ isActive: query.status === 'active' });
    const where: Prisma.QuestionWhereInput = { AND: filters };

    const [total, rows] = await Promise.all([
      this.prisma.question.count({ where }),
      this.prisma.question.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          category: { select: { id: true, name: true } },
          options: { select: { imageUrl: true } },
        },
      }),
    ]);

    return {
      items: rows.map(({ options, ...question }) => ({
        ...question,
        optionCount: options.length,
        optionImageCount: options.filter((option) => !!option.imageUrl).length,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getQuestion(id: string, ability: AppAbility) {
    const question = await this.prisma.question.findFirst({
      where: {
        AND: [
          { id, deletedAt: null },
          accessibleBy(ability, 'read').ofType('Question'),
        ],
      },
      include: DETAIL_INCLUDE,
    });
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    return question;
  }

  async createQuestion(data: CreateQuestionDto, ability: AppAbility) {
    assertFieldsAllowed(
      ability,
      'create',
      'Question',
      QUESTION_FIELDS,
      Object.keys(data),
    );
    assertCanCreate(ability, 'Question', data);

    await this.assertCategoryExists(data.categoryId);

    for (const option of data.options) {
      this.assertOptionHasContent(option);
    }
    this.assertCorrectOptionCount(data.options, data.allowMultiple ?? false);

    return this.prisma.question.create({
      data: {
        categoryId: data.categoryId,
        type: data.type ?? (data.imageUrl ? 'TEXT_IMAGE' : 'TEXT'),
        text: data.text,
        imageUrl: data.imageUrl ?? null,
        explanation: data.explanation,
        isActive: data.isActive,
        allowMultiple: data.allowMultiple,
        options: {
          // Array order is display order.
          create: data.options.map((option, position) => ({
            text: option.text,
            imageUrl: option.imageUrl ?? null,
            isCorrect: option.isCorrect,
            position,
          })),
        },
      },
      include: DETAIL_INCLUDE,
    });
  }

  /**
   * When `options` is sent it is the question's complete option list *in display order*:
   * listed ids are updated, id-less entries created, unlisted options deleted, and every
   * option's position set from its index — content and order commit in one transaction.
   */
  async updateQuestion(
    id: string,
    data: UpdateQuestionDto,
    ability: AppAbility,
  ) {
    assertFieldsAllowed(
      ability,
      'update',
      'Question',
      QUESTION_FIELDS,
      Object.keys(data),
    );

    const where: Prisma.QuestionWhereInput = {
      AND: [
        { id, deletedAt: null },
        accessibleBy(ability, 'update').ofType('Question'),
      ],
    };
    const existing = await this.prisma.question.findFirst({
      where,
      include: { options: true },
    });
    if (!existing) {
      throw new NotFoundException('Question not found');
    }

    if (data.categoryId) {
      await this.assertCategoryExists(data.categoryId);
    }

    let optionsWrite: Prisma.QuestionUpdateInput['options'] | undefined;
    if (data.options) {
      const existingIds = new Set(existing.options.map((option) => option.id));
      const keepIds: string[] = [];
      for (const option of data.options) {
        if (option.id) {
          if (!existingIds.has(option.id)) {
            throw new BadRequestException(
              `Option ${option.id} does not belong to this question`,
            );
          }
          keepIds.push(option.id);
        } else {
          this.assertOptionHasContent(option);
        }
      }
      if (new Set(keepIds).size !== keepIds.length) {
        throw new BadRequestException('Each option may appear only once');
      }
      if (data.options.length < 2) {
        throw new BadRequestException(
          'A question must have at least 2 options',
        );
      }

      // Merge each kept option's patch over its current values to validate the final state.
      const finalOptions = data.options.map((option) => {
        const current = option.id
          ? existing.options.find((row) => row.id === option.id)!
          : undefined;
        return {
          text: option.text !== undefined ? option.text : current?.text,
          imageUrl:
            option.imageUrl !== undefined ? option.imageUrl : current?.imageUrl,
          isCorrect: option.isCorrect ?? current?.isCorrect ?? false,
        };
      });
      for (const option of finalOptions) {
        this.assertOptionHasContent(option);
      }
      this.assertCorrectOptionCount(
        finalOptions,
        data.allowMultiple ?? existing.allowMultiple,
      );

      // Options a candidate picked in a past attempt are part of that attempt's history
      // (ExamAttemptAnswerOption → Option has no cascade), so they can be edited but not removed.
      const removedIds = existing.options
        .filter((option) => !keepIds.includes(option.id))
        .map((option) => option.id);
      if (removedIds.length > 0) {
        const used = await this.prisma.examAttemptAnswerOption.count({
          where: { optionId: { in: removedIds } },
        });
        if (used > 0) {
          throw new BadRequestException(
            'An option you removed was chosen in past exam attempts, so it can’t be deleted. Edit its text instead.',
          );
        }
      }

      optionsWrite = {
        deleteMany: { id: { in: removedIds } },
        update: data.options
          .map((option, position) => ({ option, position }))
          .filter(
            (
              entry,
            ): entry is {
              option: UpdateOptionDto & { id: string };
              position: number;
            } => !!entry.option.id,
          )
          .map(({ option, position }) => ({
            where: { id: option.id },
            data: {
              text: option.text,
              imageUrl: option.imageUrl,
              isCorrect: option.isCorrect,
              position,
            },
          })),
        create: data.options
          .map((option, position) => ({ option, position }))
          .filter(({ option }) => !option.id)
          .map(({ option, position }) => ({
            text: option.text,
            imageUrl: option.imageUrl ?? null,
            isCorrect: option.isCorrect ?? false,
            position,
          })),
      };
    }

    const nextImageUrl =
      data.imageUrl !== undefined ? data.imageUrl : existing.imageUrl;
    let updated;
    try {
      updated = await this.prisma.question.update({
        where: { id },
        data: {
          categoryId: data.categoryId,
          type: data.type ?? (nextImageUrl ? 'TEXT_IMAGE' : 'TEXT'),
          text: data.text,
          imageUrl: data.imageUrl,
          explanation: data.explanation,
          isActive: data.isActive,
          allowMultiple: data.allowMultiple,
          options: optionsWrite,
        },
        include: DETAIL_INCLUDE,
      });
    } catch (error) {
      throw this.mapPrismaError(error, 'Question not found');
    }

    // Replaced/removed images become orphans once nothing references them.
    await this.images.deleteIfUnreferenced([
      existing.imageUrl,
      ...existing.options.map((option) => option.imageUrl),
    ]);
    return updated;
  }

  /** Applies a complete new option order in one transaction. */
  async reorderOptions(id: string, optionIds: string[], ability: AppAbility) {
    const question = await this.prisma.question.findFirst({
      where: {
        AND: [
          { id, deletedAt: null },
          accessibleBy(ability, 'update').ofType('Question'),
        ],
      },
      include: { options: { select: { id: true } } },
    });
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    const known = new Set(question.options.map((option) => option.id));
    if (
      optionIds.length !== known.size ||
      !optionIds.every((optionId) => known.has(optionId))
    ) {
      throw new BadRequestException(
        'optionIds must list every option of this question exactly once',
      );
    }

    await this.prisma.$transaction(
      optionIds.map((optionId, position) =>
        this.prisma.option.update({
          where: { id: optionId },
          data: { position },
        }),
      ),
    );
    return this.prisma.question.findUniqueOrThrow({
      where: { id },
      include: DETAIL_INCLUDE,
    });
  }

  /**
   * Questions that appeared in any exam attempt are soft-deleted (hidden everywhere, kept for
   * attempt history/review); never-used questions are removed outright with their options.
   */
  async deleteQuestion(id: string, ability: AppAbility) {
    const where: Prisma.QuestionWhereInput = {
      AND: [
        { id, deletedAt: null },
        accessibleBy(ability, 'delete').ofType('Question'),
      ],
    };
    const question = await this.prisma.question.findFirst({
      where,
      include: { options: { select: { imageUrl: true } } },
    });
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const usedInAttempts = await this.prisma.examAttemptQuestion.count({
      where: { questionId: id },
    });
    if (usedInAttempts > 0) {
      await this.prisma.question.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
      return { id, mode: 'soft' as const };
    }

    try {
      await this.prisma.question.delete({ where: { id } });
    } catch (error) {
      throw this.mapPrismaError(error, 'Question not found');
    }
    await this.images.deleteIfUnreferenced([
      question.imageUrl,
      ...question.options.map((option) => option.imageUrl),
    ]);
    return { id, mode: 'hard' as const };
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
  }

  private assertOptionHasContent(
    option:
      | CreateOptionDto
      | UpdateOptionDto
      | { text?: string | null; imageUrl?: string | null },
  ): void {
    if (!option.text?.trim() && !option.imageUrl) {
      throw new BadRequestException('Each option must have text or an image');
    }
  }

  private assertCorrectOptionCount(
    options: { isCorrect?: boolean }[],
    allowMultiple: boolean,
  ): void {
    const correctCount = options.filter((option) => option.isCorrect).length;
    if (correctCount === 0) {
      throw new BadRequestException(
        'At least one option must be marked as correct',
      );
    }
    if (!allowMultiple && correctCount > 1) {
      throw new BadRequestException(
        'Only one option can be marked as correct when allowMultiple is false',
      );
    }
  }

  private mapPrismaError(error: unknown, notFoundMessage: string): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return new NotFoundException(notFoundMessage);
      }
      if (error.code === 'P2003') {
        return new BadRequestException(
          'This change conflicts with past exam attempts that reference it',
        );
      }
    }
    return error as Error;
  }
}
