import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

// Strips leading/trailing whitespace before validation and storage — otherwise " Traffic
// Signs" and "Traffic Signs" pass the @@unique(name) check as distinct values (MySQL compares
// them literally), silently accumulating near-duplicate categories from stray whitespace.
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCategoryDto {
  @IsString()
  @Transform(trim)
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(500)
  description?: string;
}
