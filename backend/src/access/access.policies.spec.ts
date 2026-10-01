import { ForbiddenException } from '@nestjs/common';
import { CaslAbilityFactory, AppAbility } from '../casl/casl-ability.factory';
import { assertCanCreate } from '../casl/policy-assertions';
import type { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { PermissionName, getPermissionDefinition } from './access.config';

/**
 * Builds the ability a user would get from a role holding exactly `names` — the rule rows
 * PermissionSyncService writes from access.config.ts, run through the real CaslAbilityFactory.
 */
function abilityFor(
  userId: string,
  names: PermissionName[],
): Promise<AppAbility> {
  const rolePermissions = names.map((name) => {
    const { rule } = getPermissionDefinition(name)!;
    return {
      permission: {
        action: rule.action,
        subject: rule.subject,
        conditions: rule.conditions ?? null,
        fields: null,
      },
    };
  });
  return new CaslAbilityFactory({
    user: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: userId,
        isActive: true,
        userRoles: [{ role: { isSuperAdmin: false, rolePermissions } }],
      }),
    },
  } as unknown as PrismaService).createForUser({ id: userId });
}

const CLIENT: PermissionName[] = [
  'subscriptions.viewOwn',
  'subscriptions.purchaseOwn',
  'transactions.viewOwn',
  'transactions.topUpOwn',
];

describe('access policies for subscriptions and wallets', () => {
  it('lets a client purchase for themselves only', async () => {
    const ability = await abilityFor('me', CLIENT);
    expect(() =>
      assertCanCreate(ability, 'UserSubscription', {
        userId: 'me',
        source: 'PURCHASE',
      }),
    ).not.toThrow();
    expect(() =>
      assertCanCreate(ability, 'UserSubscription', {
        userId: 'someone-else',
        source: 'PURCHASE',
      }),
    ).toThrow(ForbiddenException);
  });

  it('never lets purchaseOwn satisfy an admin grant — not even to yourself', async () => {
    const ability = await abilityFor('me', CLIENT);
    expect(() =>
      assertCanCreate(ability, 'UserSubscription', {
        userId: 'me',
        source: 'ADMIN_GRANT',
      }),
    ).toThrow(ForbiddenException);
  });

  it('lets staff with subscriptions.grant grant to anyone', async () => {
    const ability = await abilityFor('staff', ['subscriptions.grant']);
    expect(() =>
      assertCanCreate(ability, 'UserSubscription', {
        userId: 'candidate',
        source: 'ADMIN_GRANT',
      }),
    ).not.toThrow();
  });

  it('scopes subscriptions.viewOwn to the caller and subscriptions.view to everyone', async () => {
    const client = await abilityFor('me', CLIENT);
    const staff = await abilityFor('staff', ['subscriptions.view']);
    const ofSomeoneElse = {
      __caslSubjectType__: 'UserSubscription',
      userId: 'other',
    };
    const own = { __caslSubjectType__: 'UserSubscription', userId: 'me' };
    expect(client.can('read', own as never)).toBe(true);
    expect(client.can('read', ofSomeoneElse as never)).toBe(false);
    expect(staff.can('read', ofSomeoneElse as never)).toBe(true);
    expect(client.can('update', 'UserSubscription')).toBe(false);
  });

  it('keeps plan administration away from clients', async () => {
    const client = await abilityFor('me', CLIENT);
    for (const action of ['read', 'create', 'update', 'delete'] as const) {
      expect(client.can(action, 'SubscriptionPlan')).toBe(false);
    }
  });

  it("lets a client's top-up rule cover only their own wallet", async () => {
    const ability = await abilityFor('me', CLIENT);
    expect(() =>
      assertCanCreate(ability, 'Transaction', {
        userId: 'someone-else',
        type: 'ADMIN_ADJUSTMENT',
      }),
    ).toThrow(ForbiddenException);
  });

  it('refuses wallet self-adjustment even though topUpOwn matches your own wallet', async () => {
    const ability = await abilityFor('me', [...CLIENT, 'transactions.adjust']);
    const service = new TransactionsService({} as unknown as PrismaService);
    await expect(
      service.adjust(
        'me',
        { userId: 'me', amount: 5000, note: 'free money' },
        ability,
      ),
    ).rejects.toThrow(/your own wallet/);
  });
});
