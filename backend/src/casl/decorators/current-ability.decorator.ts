import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/** Pulls the ability PoliciesGuard already built for this request instead of rebuilding it. */
export const CurrentAbility = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.ability;
  },
);
