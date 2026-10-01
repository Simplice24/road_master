import { Module } from '@nestjs/common';
import { ExamAttemptsController } from './exam-attempts.controller';
import { ExamAttemptsService } from './exam-attempts.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [SubscriptionsModule],
  controllers: [ExamAttemptsController],
  providers: [ExamAttemptsService],
})
export class ExamAttemptsModule {}
