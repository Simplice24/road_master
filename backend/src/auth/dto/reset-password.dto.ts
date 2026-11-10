import { IsString, Length, MinLength } from 'class-validator';

export class ResetPasswordDto {
  /** The raw token from the emailed link (64 hex chars). */
  @IsString()
  @Length(64, 64)
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
