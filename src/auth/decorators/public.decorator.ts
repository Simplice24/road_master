import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Bypasses JwtAuthGuard (and therefore PoliciesGuard, which has nothing to check without a
 * user) for unauthenticated routes such as login/register. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
