import { IsOptional, IsUUID } from 'class-validator';

export class StartExamAttemptDto {
  @IsUUID()
  examConfigId!: string;

  /** Omit to draw a balanced mix across every active category. */
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
