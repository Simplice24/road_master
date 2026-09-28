import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/** Pulls the authenticated caller's id off the request — never trust a client-supplied userId
 * in a request body for whose wallet/resource an action applies to. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user;
  },
);
