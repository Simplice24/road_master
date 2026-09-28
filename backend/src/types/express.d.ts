import { AppAbility } from '../casl/casl-ability.factory';

declare global {
  namespace Express {
    interface User {
      id: string;
    }
    interface Request {
      // Built once per request by PoliciesGuard and reused by any later policy check in the
      // same request, instead of re-querying and rebuilding the ability on every guard call.
      ability?: AppAbility;
    }
  }
}

export {};
