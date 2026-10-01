import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { RequirePermission } from '../casl/decorators/check-policies.decorator';
import { CurrentAbility } from '../casl/decorators/current-ability.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AppAbility } from '../casl/casl-ability.factory';
import {
  ExtendSubscriptionDto,
  GrantSubscriptionDto,
  PurchasePlanDto,
  RevokeSubscriptionDto,
} from './dto/subscription.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /** The caller's access status: active time plan, queued time plans, bundle attempts. */
  @Get('me/access')
  @RequirePermission('read', 'UserSubscription')
  myAccess(@CurrentUser() userParam: unknown) {
    const user = userParam as Express.User;
    return this.subscriptionsService.getMyAccess(user.id);
  }

  /** Purchase history — scoped by accessibleBy (own rows, or everyone's for staff). */
  @Get()
  @RequirePermission('read', 'UserSubscription')
  list(@CurrentAbility() abilityParam: unknown) {
    return this.subscriptionsService.list(abilityParam as AppAbility);
  }

  @Post('purchase')
  @RequirePermission('create', 'UserSubscription')
  purchase(
    @Body() data: PurchasePlanDto,
    @CurrentUser() userParam: unknown,
    @CurrentAbility() abilityParam: unknown,
  ) {
    const user = userParam as Express.User;
    return this.subscriptionsService.purchase(
      user.id,
      data,
      abilityParam as AppAbility,
    );
  }

  @Post('grant')
  @RequirePermission('create', 'UserSubscription')
  grant(
    @Body() data: GrantSubscriptionDto,
    @CurrentUser() userParam: unknown,
    @CurrentAbility() abilityParam: unknown,
  ) {
    const user = userParam as Express.User;
    return this.subscriptionsService.grant(
      user.id,
      data,
      abilityParam as AppAbility,
    );
  }

  @Post(':id/revoke')
  @RequirePermission('update', 'UserSubscription')
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: RevokeSubscriptionDto,
    @CurrentUser() userParam: unknown,
    @CurrentAbility() abilityParam: unknown,
  ) {
    const user = userParam as Express.User;
    return this.subscriptionsService.revoke(
      id,
      user.id,
      data,
      abilityParam as AppAbility,
    );
  }

  @Post(':id/extend')
  @RequirePermission('update', 'UserSubscription')
  extend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: ExtendSubscriptionDto,
    @CurrentUser() userParam: unknown,
    @CurrentAbility() abilityParam: unknown,
  ) {
    const user = userParam as Express.User;
    return this.subscriptionsService.extend(
      id,
      user.id,
      data,
      abilityParam as AppAbility,
    );
  }
}
