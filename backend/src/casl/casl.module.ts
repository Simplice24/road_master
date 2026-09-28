import { Global, Module } from '@nestjs/common';
import { CaslAbilityFactory } from './casl-ability.factory';

// PoliciesGuard itself is registered as an APP_GUARD in AppModule (not here) so there is a
// single instance wired into Nest's global guard chain, rather than one copy exported from
// this module and a second implicitly created by the APP_GUARD registration.
@Global()
@Module({
  providers: [CaslAbilityFactory],
  exports: [CaslAbilityFactory],
})
export class CaslModule {}
