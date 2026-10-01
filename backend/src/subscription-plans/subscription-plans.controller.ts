import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { SubscriptionPlansService } from './subscription-plans.service';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermission } from '../casl/decorators/check-policies.decorator';
import { CurrentAbility } from '../casl/decorators/current-ability.decorator';
import { AppAbility } from '../casl/casl-ability.factory';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { ReorderPlansDto } from './dto/reorder-plans.dto';

@Controller('plans')
export class SubscriptionPlansController {
  constructor(private readonly plansService: SubscriptionPlansService) {}

  /** The public pricing page — no login, active plans only. */
  @Public()
  @Get()
  listActive() {
    return this.plansService.listActive();
  }

  @Get('manage')
  @RequirePermission('read', 'SubscriptionPlan')
  listAll(@CurrentAbility() abilityParam: unknown) {
    return this.plansService.listAll(abilityParam as AppAbility);
  }

  @Post()
  @RequirePermission('create', 'SubscriptionPlan')
  create(@Body() data: CreatePlanDto, @CurrentAbility() abilityParam: unknown) {
    return this.plansService.create(data, abilityParam as AppAbility);
  }

  @Put('order')
  @RequirePermission('update', 'SubscriptionPlan')
  reorder(
    @Body() data: ReorderPlansDto,
    @CurrentAbility() abilityParam: unknown,
  ) {
    return this.plansService.reorder(data.planIds, abilityParam as AppAbility);
  }

  @Patch(':id')
  @RequirePermission('update', 'SubscriptionPlan')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdatePlanDto,
    @CurrentAbility() abilityParam: unknown,
  ) {
    return this.plansService.update(id, data, abilityParam as AppAbility);
  }

  @Delete(':id')
  @RequirePermission('delete', 'SubscriptionPlan')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAbility() abilityParam: unknown,
  ) {
    return this.plansService.remove(id, abilityParam as AppAbility);
  }
}
