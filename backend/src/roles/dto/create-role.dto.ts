import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

// Role.name is @unique — see category/dto/create-category.ts for why leading/trailing
// whitespace needs stripping before it reaches validation/the DB, not after.
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateRoleDto {
  @IsString()
  @Transform(trim)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isSuperAdmin?: boolean;

  @IsOptional()
  @IsString()
  guardName?: string;
}
