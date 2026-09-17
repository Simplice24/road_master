import { Module } from '@nestjs/common';
import { ExamAttemptsController } from './exam-attempts.controller';

@Module({
  controllers: [ExamAttemptsController],
})
export class ExamAttemptsModule {}
