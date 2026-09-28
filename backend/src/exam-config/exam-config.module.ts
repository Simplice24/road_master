import { Module } from '@nestjs/common';
import { ExamConfigService } from './exam-config.service';
import { ExamConfigController } from './exam-config.controller';

@Module({
  controllers: [ExamConfigController],
  providers: [ExamConfigService],
})
export class ExamConfigModule {}
