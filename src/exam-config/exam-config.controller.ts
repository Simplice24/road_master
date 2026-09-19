import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ExamConfigService } from './exam-config.service';
import { RequirePermission } from 'src/casl/decorators/check-policies.decorator';
import { CurrentAbility } from 'src/casl/decorators/current-ability.decorator';
import { AppAbility } from 'src/casl/casl-ability.factory';
import { CreateExamConfigDto } from './dto/create-exam-config';
import { UpdateExamConfigDto } from './dto/update-exam-config';

@Controller('exam-config')
export class ExamConfigController {
  constructor(private readonly examConfigService: ExamConfigService) {}

  @Get()
  @RequirePermission('read', 'ExamConfig')
  getExamConfig(@CurrentAbility() abilityParam: unknown) {
    return this.examConfigService.getExamConfig(abilityParam as AppAbility);
  }

  @Post()
  @RequirePermission('create', 'ExamConfig')
  createExamConfig(
    @Body() data: CreateExamConfigDto, 
    @CurrentAbility() abilityParam: unknown) {
    return this.examConfigService.createExamConfig(
      data,
      abilityParam as AppAbility);
  }

  @Put(':id')
  @RequirePermission('update', 'ExamConfig')
  updateExamConfig(
    @Param('id') id: string,
    @Body() data: UpdateExamConfigDto, 
    @CurrentAbility() abilityParam: unknown) {
    return this.examConfigService.updateExamConfig(
      id,
      data,
      abilityParam as AppAbility);
  }

  @Delete(':id')
  @RequirePermission('delete', 'ExamConfig')
  deleteExamConfig(
    @Param('id') id: string,
    @CurrentAbility() abilityParam: unknown) {
    return this.examConfigService.deleteExamConfig(
      id,
      abilityParam as AppAbility);
  }
}
