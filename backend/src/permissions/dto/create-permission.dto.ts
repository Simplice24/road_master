import { IsArray, IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { Prisma } from '../../../generated/prisma/client';

const ACTIONS = ['create', 'read', 'update', 'delete', 'manage'] as const;
const SUBJECTS = [...Object.values(Prisma.ModelName), 'all'] as const;

export class CreatePermissionDto {
  @IsIn(ACTIONS)
  action!: (typeof ACTIONS)[number];

  @IsIn(SUBJECTS)
  subject!: (typeof SUBJECTS)[number];

  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fields?: string[];

  @IsOptional()
  @IsString()
  description?: string;
}
