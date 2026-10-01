import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionAccessService } from './subscription-access.service';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [TransactionsModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionAccessService],
  // The access check is reused by exam starts (ExamAttemptsModule) and GET /auth/me.
  exports: [SubscriptionAccessService],
})
export class SubscriptionsModule {}
