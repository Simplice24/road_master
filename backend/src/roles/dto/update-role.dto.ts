import {
  ArrayUnique,
  IsArray,
  IsEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { SUPER_ADMIN_FLAG_MESSAGE } from './create-role.dto';

// See create-role.dto.ts — same whitespace-normalization rationale applies on update.
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** When present, *replaces* the role's configured permissions with exactly this set. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions?: string[];

  @IsEmpty({ message: SUPER_ADMIN_FLAG_MESSAGE })
  isSuperAdmin?: never;

  @IsOptional()
  @IsString()
  guardName?: string;
}
