import { Body, Controller, Get, Post } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { RequirePermission } from '../casl/decorators/check-policies.decorator';
import { CurrentAbility } from '../casl/decorators/current-ability.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AppAbility } from '../casl/casl-ability.factory';
import { TopUpDto } from './dto/topup.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @RequirePermission('read', 'Transaction')
  listTransactions(@CurrentAbility() abilityParam: unknown) {
    return this.transactionsService.listTransactions(
      abilityParam as AppAbility,
    );
  }

  @Post('topup')
  @RequirePermission('create', 'Transaction')
  topUp(
    @Body() data: TopUpDto,
    @CurrentUser() userParam: unknown,
    @CurrentAbility() abilityParam: unknown,
  ) {
    const user = userParam as Express.User;
    return this.transactionsService.topUp(
      user.id,
      data,
      abilityParam as AppAbility,
    );
  }
}
