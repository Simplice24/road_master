import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MinLength,
  MaxLength,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionType } from '../../../generated/prisma/enums'; // adjust to your actual generated client path

export class CreateOptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  text?: string;

  // null removes the image. require_tld:false so dev uploads (http://localhost:3000/...) pass.
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUrl({ require_tld: false })
  imageUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;
}

export class CreateQuestionDto {
  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @IsString()
  @MinLength(3)
  text!: string;

  // null removes the image. require_tld:false so dev uploads (http://localhost:3000/...) pass.
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUrl({ require_tld: false })
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  allowMultiple?: boolean;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateOptionDto)
  options!: CreateOptionDto[];
}
