import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** GET /users — admin user browser: paginated, searchable, filterable. */
export class ListUsersQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  /** Substring of the full name or phone. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** A role id, or `none` for users without any role. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  roleId?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
