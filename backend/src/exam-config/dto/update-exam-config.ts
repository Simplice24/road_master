import { PartialType } from '@nestjs/mapped-types';
import { CreateExamConfigDto } from './create-exam-config';

// Same rules as create, every field optional — the settings page saves one section at a time.
export class UpdateExamConfigDto extends PartialType(CreateExamConfigDto) {}
