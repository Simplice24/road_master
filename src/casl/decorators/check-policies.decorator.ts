import { SetMetadata } from '@nestjs/common';
import { AppAbility, Actions, Subjects } from '../casl-ability.factory';

export const CHECK_POLICIES_KEY = 'check_policies';

export type PolicyHandlerCallback = (ability: AppAbility) => boolean;
export interface PolicyHandlerObject {
  handle(ability: AppAbility): boolean;
}
export type PolicyHandler = PolicyHandlerCallback | PolicyHandlerObject;

/** Callback-style policy check — use when you need the actual entity instance for a
 * condition check, e.g. CheckPolicies((ability) => ability.can('update', subject('ExamAttempt', attempt))). */
export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);

/** Class/subject-level permission check — the action/subject strings are just the query
 * CASL evaluates against the caller's dynamically-built ability, never a role check. */
export const RequirePermission = (action: Actions, subject: Subjects) =>
  CheckPolicies((ability) => ability.can(action, subject));
