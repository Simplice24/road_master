import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Admin-side user creation (POST /users). The admin sets the initial password; it is hashed
 * by UsersService.create exactly like self-registration. */
export class CreateUserDto {
  @IsString()
  @Transform(trim)
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(32)
  phone!: string;

  @IsOptional()
  @Transform(trim)
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt ignores bytes past 72
  password!: string;

  /** Optional: when omitted the user gets the DefaultRole. Setting it requires roles.assign. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  roleIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
