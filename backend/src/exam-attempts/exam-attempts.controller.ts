import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ExamAttemptsService } from './exam-attempts.service';
import { RequirePermission } from '../casl/decorators/check-policies.decorator';
import { CurrentAbility } from '../casl/decorators/current-ability.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AppAbility } from '../casl/casl-ability.factory';
import { StartExamAttemptDto } from './dto/start-exam-attempt.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';

@Controller('exam-attempts')
export class ExamAttemptsController {
  constructor(private readonly examAttemptsService: ExamAttemptsService) {}

  @Get()
  @RequirePermission('read', 'ExamAttempt')
  listAttempts(@CurrentAbility() abilityParam: unknown) {
    return this.examAttemptsService.listAttempts(abilityParam as AppAbility);
  }

  @Get(':id')
  @RequirePermission('read', 'ExamAttempt')
  getAttempt(@Param('id') id: string, @CurrentAbility() abilityParam: unknown) {
    return this.examAttemptsService.getAttempt(id, abilityParam as AppAbility);
  }

  @Post()
  @RequirePermission('create', 'ExamAttempt')
  startAttempt(
    @Body() data: StartExamAttemptDto,
    @CurrentUser() userParam: unknown,
    @CurrentAbility() abilityParam: unknown,
  ) {
    const user = userParam as Express.User;
    return this.examAttemptsService.startAttempt(
      user.id,
      data,
      abilityParam as AppAbility,
    );
  }

  @Post(':id/answers')
  @RequirePermission('update', 'ExamAttempt')
  submitAnswer(
    @Param('id') id: string,
    @Body() data: SubmitAnswerDto,
    @CurrentAbility() abilityParam: unknown,
  ) {
    return this.examAttemptsService.submitAnswer(
      id,
      data,
      abilityParam as AppAbility,
    );
  }

  @Post(':id/complete')
  @RequirePermission('update', 'ExamAttempt')
  completeAttempt(
    @Param('id') id: string,
    @CurrentAbility() abilityParam: unknown,
  ) {
    return this.examAttemptsService.completeAttempt(
      id,
      abilityParam as AppAbility,
    );
  }
}
