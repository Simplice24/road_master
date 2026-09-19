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
import { CreateExamConfigDto } from './dto/create-exam-config';
import { UpdateExamConfigDto } from './dto/update-exam-config';

const EXAM_CONFIG_FIELDS = [
  'name',
  'numberOfQuestions',
  'price',
  'passMarkPercent',
  'durationMinutes',
  'isActive',
];

@Injectable()
export class ExamConfigService {
    constructor(private readonly prisma: PrismaService) {}

    async getExamConfig(ability: AppAbility) {
        const where =  accessibleBy(ability, 'read').ofType(
            'ExamConfig',
        ) as unknown as Prisma.ExamConfigWhereInput;

        return this.prisma.examConfig.findMany({ where });
    }

    async createExamConfig(data: CreateExamConfigDto, ability: AppAbility) {
        assertFieldsAllowed(
            ability,
            'create',
            'ExamConfig',
            EXAM_CONFIG_FIELDS,
            Object.keys(data),
        );
        assertCanCreate(ability, 'ExamConfig', data);

        return this.prisma.examConfig.create({ 
            data: {
                name: data.name,
                numberOfQuestions: data.numberOfQuestions,
                price: data.price,
                passMarkPercent: data.passMarkPercent,
                durationMinutes: data.durationMinutes,
                isActive: data.isActive
            } 
            });
    }

    async updateExamConfig(id: string,data: UpdateExamConfigDto, ability: AppAbility) {
        assertFieldsAllowed(
            ability,
            'update',
            'ExamConfig',
            EXAM_CONFIG_FIELDS,
            Object.keys(data),
        );
        
        const where: Prisma.ExamConfigWhereInput = {
            AND: [{ id }, accessibleBy(ability, 'update').ofType('ExamConfig')],
        };

        const existingConfig = await this.prisma.examConfig.findFirst({ where });
        if (!existingConfig) {
            throw new NotFoundException(`ExamConfig not found or you do not have permission to update it.`);
        }

        try{
            return await this.prisma.examConfig.update({
                where: { id },
                data: {
                    name: data.name ?? existingConfig.name,
                    numberOfQuestions: data.numberOfQuestions ?? existingConfig.numberOfQuestions,
                    price: data.price ?? existingConfig.price,
                    passMarkPercent: data.passMarkPercent ?? existingConfig.passMarkPercent,
                    durationMinutes: data.durationMinutes ?? existingConfig.durationMinutes,
                    isActive: data.isActive ?? existingConfig.isActive,
                },
            });
        } catch(error) {
            throw this.mapPrismaError(error, 'Exam config not found or you do not have permission to update it.')
        }
    }

    async deleteExamConfig(id: string, ability: AppAbility) {
        const where: Prisma.ExamConfigWhereInput = {
        AND: [{ id }, accessibleBy(ability, 'delete').ofType('ExamConfig')],
        };
        const examConfig = await this.prisma.examConfig.findFirst({ where });
        if (!examConfig) {
        throw new NotFoundException('Exam config not found');
        }

        try {
        return await this.prisma.examConfig.delete({ where: { id } });
        } catch (error) {
        throw this.mapPrismaError(error, 'Exam config not found');
        }
    }

    private mapPrismaError(error: unknown, notFoundMessage: string): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return new NotFoundException(notFoundMessage);
      }
      if (error.code === 'P2003') {
        return new BadRequestException(
          'Cannot delete an exam config that has already been used in an exam attempt',
        );
      }
    }
    return error as Error;
  }
}
