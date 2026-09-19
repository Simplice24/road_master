import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class SubmitAnswerDto {
  @IsUUID()
  questionId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  optionIds!: string[];
}
