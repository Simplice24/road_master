import {
  ConflictException,
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
import { CreateCategoryDto } from './dto/create-category';
import { UpdateCategoryDto } from './dto/update-category';

const CATEGORY_FIELDS = ['name', 'description'];

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(ability: AppAbility) {
    const where = accessibleBy(ability, 'read').ofType(
      'Category',
    ) as unknown as Prisma.CategoryWhereInput;

    return this.prisma.category.findMany({ where });
  }

  async createCategory(data: CreateCategoryDto, ability: AppAbility) {
    assertFieldsAllowed(
      ability,
      'create',
      'Category',
      CATEGORY_FIELDS,
      Object.keys(data),
    );
    assertCanCreate(ability, 'Category', data);

    const existing = await this.prisma.category.findFirst({
      where: { name: data.name },
    });
    if (existing) {
      throw new ConflictException('Category with this name already exists');
    }

    return this.prisma.category.create({ data });
  }

  async updateCategory(
    id: string,
    data: UpdateCategoryDto,
    ability: AppAbility,
  ) {
    assertFieldsAllowed(
      ability,
      'update',
      'Category',
      CATEGORY_FIELDS,
      Object.keys(data),
    );

    const where: Prisma.CategoryWhereInput = {
      AND: [{ id }, accessibleBy(ability, 'update').ofType('Category')],
    };
    const category = await this.prisma.category.findFirst({ where });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (data.name && data.name !== category.name) {
      const nameTaken = await this.prisma.category.findFirst({
        where: { name: data.name, NOT: { id } },
      });
      if (nameTaken) {
        throw new ConflictException('Category with this name already exists');
      }
    }

    try {
      return await this.prisma.category.update({ where: { id }, data });
    } catch (error) {
      throw this.mapPrismaError(error, 'Category not found');
    }
  }

  async deleteCategory(id: string, ability: AppAbility) {
    const where: Prisma.CategoryWhereInput = {
      AND: [{ id }, accessibleBy(ability, 'delete').ofType('Category')],
    };
    const category = await this.prisma.category.findFirst({ where });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    try {
      return await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      throw this.mapPrismaError(error, 'Category not found');
    }
  }

  private mapPrismaError(error: unknown, notFoundMessage: string): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return new NotFoundException(notFoundMessage);
      }
      if (error.code === 'P2002') {
        return new ConflictException('Category with this name already exists');
      }
      if (error.code === 'P2003') {
        return new ConflictException(
          'Cannot delete a category that still has questions',
        );
      }
    }
    return error as Error;
  }
}
