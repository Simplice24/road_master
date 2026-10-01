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
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionType } from '../../../generated/prisma/enums';

export class UpdateOptionDto {
  @IsOptional()
  @IsUUID()
  id?: string; // present = update this existing option; absent = create a new one

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

export class UpdateQuestionDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @IsOptional()
  @IsString()
  @MinLength(3)
  text?: string;

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOptionDto)
  options?: UpdateOptionDto[];
}
