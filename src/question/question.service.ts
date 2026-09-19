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
import { CreateOptionDto, CreateQuestionDto } from './dto/create-question';
import { UpdateOptionDto, UpdateQuestionDto } from './dto/update-question';

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

@Injectable()
export class QuestionService {
  constructor(private readonly prisma: PrismaService) {}

  async listQuestions(ability: AppAbility) {
    const where = accessibleBy(ability, 'read').ofType(
      'Question',
    ) as unknown as Prisma.QuestionWhereInput;

    return this.prisma.question.findMany({
      where,
      include: {
        options: true,
        answers: true,
      },
    });
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
        type: data.type,
        text: data.text,
        imageUrl: data.imageUrl,
        explanation: data.explanation,
        isActive: data.isActive,
        allowMultiple: data.allowMultiple,
        options: {
          create: data.options.map((option) => ({
            text: option.text,
            imageUrl: option.imageUrl ?? null,
            isCorrect: option.isCorrect,
          })),
        },
      },
    });
  }

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
      AND: [{ id }, accessibleBy(ability, 'update').ofType('Question')],
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
      const optionsToUpdate = data.options.filter(
        (option): option is UpdateOptionDto & { id: string } => !!option.id,
      );
      const optionsToCreate = data.options.filter((option) => !option.id);

      for (const option of optionsToUpdate) {
        if (!existingIds.has(option.id)) {
          throw new BadRequestException(
            `Option ${option.id} does not belong to this question`,
          );
        }
      }
      for (const option of optionsToCreate) {
        this.assertOptionHasContent(option);
      }

      const keepIds = optionsToUpdate.map((option) => option.id);
      const finalOptions = [
        ...existing.options
          .filter((option) => keepIds.includes(option.id))
          .map((option) => {
            const patch = optionsToUpdate.find((u) => u.id === option.id);
            return { isCorrect: patch?.isCorrect ?? option.isCorrect };
          }),
        ...optionsToCreate.map((option) => ({
          isCorrect: option.isCorrect ?? false,
        })),
      ];
      if (finalOptions.length < 2) {
        throw new BadRequestException(
          'A question must have at least 2 options',
        );
      }
      this.assertCorrectOptionCount(
        finalOptions,
        data.allowMultiple ?? existing.allowMultiple,
      );

      optionsWrite = {
        deleteMany: { id: { notIn: keepIds } },
        update: optionsToUpdate.map((option) => ({
          where: { id: option.id },
          data: {
            text: option.text,
            imageUrl:
              option.imageUrl !== undefined ? option.imageUrl : undefined,
            isCorrect: option.isCorrect,
          },
        })),
        create: optionsToCreate.map((option) => ({
          text: option.text,
          imageUrl: option.imageUrl ?? null,
          isCorrect: option.isCorrect,
        })),
      };
    }

    try {
      return await this.prisma.question.update({
        where: { id },
        data: {
          categoryId: data.categoryId,
          type: data.type,
          text: data.text,
          imageUrl: data.imageUrl,
          explanation: data.explanation,
          isActive: data.isActive,
          allowMultiple: data.allowMultiple,
          options: optionsWrite,
        },
      });
    } catch (error) {
      throw this.mapPrismaError(error, 'Question not found');
    }
  }

  async deleteQuestion(id: string, ability: AppAbility) {
    const where: Prisma.QuestionWhereInput = {
      AND: [{ id }, accessibleBy(ability, 'delete').ofType('Question')],
    };
    const question = await this.prisma.question.findFirst({ where });
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    try {
      return await this.prisma.question.delete({ where: { id } });
    } catch (error) {
      throw this.mapPrismaError(error, 'Question not found');
    }
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
    option: CreateOptionDto | UpdateOptionDto,
  ): void {
    if (!option.text && !option.imageUrl) {
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
          'Cannot delete a question that has already been used in an exam attempt',
        );
      }
    }
    return error as Error;
  }
}
