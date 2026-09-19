import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  phone!: string;

  @IsString()
  password!: string;
}
