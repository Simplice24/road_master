import { IsEmail, IsIn, IsOptional } from 'class-validator';
import {
  RESET_EMAIL_LOCALES,
  type ResetEmailLocale,
} from '../password-reset.email';

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;

  /** Language of the email and of the reset page the link opens. Defaults to English. */
  @IsOptional()
  @IsIn(RESET_EMAIL_LOCALES)
  locale?: ResetEmailLocale;
}
