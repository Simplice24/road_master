import { Module } from '@nestjs/common';
import { QuestionService } from './question.service';
import { QuestionController } from './question.controller';
import { QuestionImageStorage } from './question-image.storage';

@Module({
  controllers: [QuestionController],
  providers: [QuestionService, QuestionImageStorage],
})
export class QuestionModule {}
