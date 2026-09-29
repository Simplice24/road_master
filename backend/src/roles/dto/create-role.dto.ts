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

// Role.name is @unique — see category/dto/create-category.ts for why leading/trailing
// whitespace needs stripping before it reaches validation/the DB, not after.
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const SUPER_ADMIN_FLAG_MESSAGE =
  'isSuperAdmin cannot be set through the API — the SuperAdmin role is created automatically for the first user';

export class CreateRoleDto {
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** Permission names from access.config.ts, e.g. "categories.create". Unknown names are
   * rejected by PermissionSyncService.resolveNames with a 400 listing them. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions?: string[];

  // Explicitly rejected (not just stripped by the whitelist) so a client trying to mint or
  // un-flag a SuperAdmin role gets a clear 400 instead of a silent no-op.
  @IsEmpty({ message: SUPER_ADMIN_FLAG_MESSAGE })
  isSuperAdmin?: never;

  @IsOptional()
  @IsString()
  guardName?: string;
}
