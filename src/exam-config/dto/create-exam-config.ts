import { IsNotEmpty, IsString, IsNumber, IsBoolean, Min, Max } from 'class-validator';

export class CreateExamConfigDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsNotEmpty()
  @IsNumber()
  numberOfQuestions!: number;

  @IsNotEmpty()
  @IsNumber()
  price!: number;


  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  passMarkPercent!: number;

  @IsNotEmpty()
  @IsNumber()
  durationMinutes!: number;

  @IsNotEmpty()
  @IsBoolean()
  isActive!: boolean;
}