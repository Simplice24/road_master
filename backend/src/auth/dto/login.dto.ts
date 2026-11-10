import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  /** Phone number or email — treated as an email when it contains "@". */
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @IsString()
  password!: string;
}
