import { BadRequestException, ConflictException } from '@nestjs/common';
import { SubscriptionPlansService } from './subscription-plans.service';
import type { PrismaService } from '../prisma/prisma.service';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';

const EXISTING = {
  id: 'plan-1',
  name: { en: 'Weekly' },
  extraFeatures: null,
  price: 3000,
  currency: 'RWF',
  accessType: 'TIME',
  attemptLimit: null,
  durationDays: 7,
  isActive: true,
  isMostPopular: false,
  displayOrder: 0,
};

function setup() {
  const subscriptionPlan = {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(EXISTING),
    aggregate: jest.fn().mockResolvedValue({ _max: { displayOrder: 2 } }),
    create: jest.fn(({ data }: { data: object }) =>
      Promise.resolve({ id: 'new', ...data }),
    ),
    update: jest.fn(({ data }: { data: object }) =>
      Promise.resolve({ ...EXISTING, ...data }),
    ),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    delete: jest.fn().mockResolvedValue(EXISTING),
  };
  const userSubscription = {
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
  const delegates = { subscriptionPlan, userSubscription };
  const prisma = {
    ...delegates,
    $transaction: jest.fn((callback: (tx: typeof delegates) => unknown) =>
      callback(delegates),
    ),
  };
  const service = new SubscriptionPlansService(
    prisma as unknown as PrismaService,
  );
  const adminAbility = () =>
    new CaslAbilityFactory({
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'admin',
          isActive: true,
          userRoles: [{ role: { isSuperAdmin: true, rolePermissions: [] } }],
        }),
      },
    } as unknown as PrismaService).createForUser({ id: 'admin' });
  return { service, prisma, adminAbility };
}

describe('SubscriptionPlansService', () => {
  it('lists only active plans, in display order, for the public pricing page', async () => {
    const { service, prisma } = setup();
    await service.listActive();
    expect(prisma.subscriptionPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      }),
    );
  });

  it('clears "most popular" from every other plan when creating a most-popular plan', async () => {
    const { service, prisma, adminAbility } = setup();
    await service.create(
      {
        name: { en: 'Two weeks' },
        price: 5000,
        accessType: 'TIME',
        durationDays: 14,
        isMostPopular: true,
      },
      await adminAbility(),
    );
    expect(prisma.subscriptionPlan.updateMany).toHaveBeenCalledWith({
      where: { isMostPopular: true },
      data: { isMostPopular: false },
    });
    expect(prisma.subscriptionPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isMostPopular: true, displayOrder: 3 }),
      }),
    );
  });

  it('clears "most popular" from the others, not itself, when updating', async () => {
    const { service, prisma, adminAbility } = setup();
    await service.update(
      'plan-1',
      { isMostPopular: true },
      await adminAbility(),
    );
    expect(prisma.subscriptionPlan.updateMany).toHaveBeenCalledWith({
      where: { isMostPopular: true, id: { not: 'plan-1' } },
      data: { isMostPopular: false },
    });
  });

  it('leaves the other plans alone when the flag is not being set', async () => {
    const { service, prisma, adminAbility } = setup();
    await service.update('plan-1', { price: 3500 }, await adminAbility());
    expect(prisma.subscriptionPlan.updateMany).not.toHaveBeenCalled();
  });

  it('never touches existing user subscriptions when a plan is edited', async () => {
    const { service, prisma, adminAbility } = setup();
    await service.update(
      'plan-1',
      { price: 9999, durationDays: 10, name: { en: 'Renamed' } },
      await adminAbility(),
    );
    expect(prisma.userSubscription.update).not.toHaveBeenCalled();
    expect(prisma.userSubscription.updateMany).not.toHaveBeenCalled();
  });

  it('validates the merged plan: switching access type must drop the other limit', async () => {
    const { service, prisma, adminAbility } = setup();
    const ability = await adminAbility();
    await expect(
      service.update(
        'plan-1',
        { accessType: 'ATTEMPTS', attemptLimit: 5 },
        ability,
      ),
    ).rejects.toThrow(BadRequestException);
    await service.update(
      'plan-1',
      { accessType: 'ATTEMPTS', attemptLimit: 5, durationDays: null },
      ability,
    );
    expect(prisma.subscriptionPlan.update).toHaveBeenCalledTimes(1);
  });

  it('deactivates via update — the row stays, it just leaves the public list', async () => {
    const { service, prisma, adminAbility } = setup();
    await service.update('plan-1', { isActive: false }, await adminAbility());
    expect(prisma.subscriptionPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isActive: false }),
      }),
    );
    expect(prisma.subscriptionPlan.delete).not.toHaveBeenCalled();
  });

  it('refuses to delete a plan that has purchases', async () => {
    const { service, prisma, adminAbility } = setup();
    prisma.userSubscription.count.mockResolvedValue(2);
    await expect(
      service.remove('plan-1', await adminAbility()),
    ).rejects.toThrow(ConflictException);
    expect(prisma.subscriptionPlan.delete).not.toHaveBeenCalled();
  });

  it('deletes a plan nobody bought', async () => {
    const { service, prisma, adminAbility } = setup();
    await service.remove('plan-1', await adminAbility());
    expect(prisma.subscriptionPlan.delete).toHaveBeenCalledWith({
      where: { id: 'plan-1' },
    });
  });

  it('requires reorder to list every plan exactly once', async () => {
    const { service, prisma, adminAbility } = setup();
    prisma.subscriptionPlan.findMany.mockResolvedValue([
      { id: 'a' },
      { id: 'b' },
    ]);
    await expect(service.reorder(['a'], await adminAbility())).rejects.toThrow(
      BadRequestException,
    );
    await service.reorder(['b', 'a'], await adminAbility());
    expect(prisma.subscriptionPlan.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'b' },
      data: { displayOrder: 0 },
    });
    expect(prisma.subscriptionPlan.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'a' },
      data: { displayOrder: 1 },
    });
  });
});
