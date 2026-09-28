import { Controller } from '@nestjs/common';
import { QuestionService } from './question.service';
import { Body, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { RequirePermission } from '../casl/decorators/check-policies.decorator';
import { CurrentAbility } from '../casl/decorators/current-ability.decorator';
import { AppAbility } from '../casl/casl-ability.factory';
import { CreateQuestionDto } from './dto/create-question';
import { UpdateQuestionDto } from './dto/update-question';

@Controller('question')
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

  @Get()
  @RequirePermission('read', 'Question')
  listQuestions(@CurrentAbility() abilityParam: unknown) {
    return this.questionService.listQuestions(abilityParam as AppAbility);
  }

  @Post()
  @RequirePermission('create', 'Question')
  createQuestion(
    @Body() data: CreateQuestionDto,
    @CurrentAbility() abilityParam: unknown,
  ) {
    return this.questionService.createQuestion(
      data,
      abilityParam as AppAbility,
    );
  }

  @Put(':id')
  @RequirePermission('update', 'Question')
  updateQuestion(
    @Param('id') id: string,
    @Body() data: UpdateQuestionDto,
    @CurrentAbility() abilityParam: unknown,
  ) {
    return this.questionService.updateQuestion(
      id,
      data,
      abilityParam as AppAbility,
    );
  }

  @Delete(':id')
  @RequirePermission('delete', 'Question')
  deleteQuestion(
    @Param('id') id: string,
    @CurrentAbility() abilityParam: unknown,
  ) {
    return this.questionService.deleteQuestion(id, abilityParam as AppAbility);
  }
}
