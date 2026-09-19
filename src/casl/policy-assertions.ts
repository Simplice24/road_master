import { ForbiddenException } from '@nestjs/common';
import { subject as toSubject } from '@casl/ability';
import { AppAbility, Actions, Subjects } from './casl-ability.factory';

/**
 * Type-level `can()` checks (used by RequirePermission/PoliciesGuard) can't evaluate a
 * permission row's `conditions` because there's no instance yet — this is for the one place
 * that needs it: validating a *proposed* create payload against those conditions before insert.
 * Update/delete get the same enforcement for free via accessibleBy() scoping their query.
 */
export function assertCanCreate(
  ability: AppAbility,
  subjectType: Exclude<Subjects, 'all'>,
  proposed: object,
): void {
  const taggedSubject = toSubject(subjectType, proposed);
  if (!ability.can('create', taggedSubject)) {
    throw new ForbiddenException(
      'You do not have permission to perform this action',
    );
  }
}

/**
 * Enforces a Permission row's `fields` restriction, which nothing else checks: PoliciesGuard
 * only verifies the caller may act on the subject *type*, not which fields of the payload
 * they're allowed to set. A rule with no `fields` array means "all fields" (CASL convention).
 *
 * This re-implements the relevant slice of @casl/ability/extra's permittedFieldsOf on the
 * stable `rulesFor`/`Rule` API instead of importing that subpath: this project's tsconfig uses
 * classic ("node10") module resolution, which can't see package.json `exports` subpaths.
 * Rules are evaluated at the subject *type* level (matchesConditions gets the type string, not
 * an instance) — the same granularity RequirePermission/PoliciesGuard already check at.
 */
export function assertFieldsAllowed(
  ability: AppAbility,
  action: Actions,
  subjectType: Subjects,
  allFieldsForSubject: string[],
  submittedFields: string[],
): void {
  const rules = ability.rulesFor(action, subjectType);
  const permitted = new Set<string>();
  for (let i = rules.length - 1; i >= 0; i--) {
    const rule = rules[i];
    if (!rule.matchesConditions(subjectType)) {
      continue;
    }
    const ruleFields = rule.fields ?? allFieldsForSubject;
    if (rule.inverted) {
      ruleFields.forEach((field) => permitted.delete(field));
    } else {
      ruleFields.forEach((field) => permitted.add(field));
    }
  }

  const disallowed = submittedFields.filter((field) => !permitted.has(field));
  if (disallowed.length > 0) {
    throw new ForbiddenException(
      `You do not have permission to set field(s): ${disallowed.join(', ')}`,
    );
  }
}
