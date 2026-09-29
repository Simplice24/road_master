import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import type { PrismaService } from '../prisma/prisma.service';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';

const SUPER_ROLE = { id: 'role-super', name: 'SuperAdmin', isSuperAdmin: true };
const CLIENT_ROLE = { id: 'role-client', name: 'client', isSuperAdmin: false };

/**
 * Minimal Prisma fake: `superAdmins` is the set of user ids holding the SuperAdmin role and
 * `activeSuperAdmins` how many *other* active SuperAdmins exist for last-admin checks.
 */
function setup(opts: {
  superAdmins: string[];
  otherActiveSuperAdmins: number;
}) {
  const delegates = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'target' }),
      findFirst: jest.fn().mockResolvedValue({
        id: 'target',
        userRoles: [{ role: SUPER_ROLE }],
      }),
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ id: 'target', userRoles: [] }),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(opts.otherActiveSuperAdmins),
    },
    userRole: {
      count: jest.fn(({ where }: { where: { userId: string } }) =>
        Promise.resolve(opts.superAdmins.includes(where.userId) ? 1 : 0),
      ),
      findMany: jest.fn().mockResolvedValue([{ roleId: SUPER_ROLE.id }]),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    role: {
      count: jest.fn(
        ({
          where,
        }: {
          where: { id: { in: string[] }; isSuperAdmin?: boolean };
        }) =>
          Promise.resolve(
            [SUPER_ROLE, CLIENT_ROLE].filter(
              (role) =>
                where.id.in.includes(role.id) &&
                (where.isSuperAdmin === undefined ||
                  role.isSuperAdmin === where.isSuperAdmin),
            ).length,
          ),
      ),
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          [SUPER_ROLE, CLIENT_ROLE].find((role) => role.id === where.id) ??
            null,
        ),
      ),
    },
  };
  const prisma = {
    ...delegates,
    $transaction: jest.fn((callback: (tx: typeof delegates) => unknown) =>
      callback(delegates),
    ),
  };
  const service = new UsersService(
    prisma as unknown as PrismaService,
    {} as unknown as CaslAbilityFactory,
  );
  // setStatus scopes by accessibleBy(ability) — build a real SuperAdmin ability for that.
  const superAdminAbility = () =>
    new CaslAbilityFactory({
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'boss',
          isActive: true,
          userRoles: [{ role: { isSuperAdmin: true, rolePermissions: [] } }],
        }),
      },
    } as unknown as PrismaService).createForUser({ id: 'boss' });
  return { service, prisma, superAdminAbility };
}

describe('UsersService SuperAdmin protections', () => {
  it('stops a non-SuperAdmin from granting the SuperAdmin role', async () => {
    const { service, prisma } = setup({
      superAdmins: [],
      otherActiveSuperAdmins: 1,
    });

    await expect(
      service.assignRole('target', SUPER_ROLE.id, 'manager'),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.userRole.upsert).not.toHaveBeenCalled();
  });

  it('lets a SuperAdmin grant the SuperAdmin role', async () => {
    const { service, prisma } = setup({
      superAdmins: ['boss'],
      otherActiveSuperAdmins: 1,
    });

    await service.assignRole('target', SUPER_ROLE.id, 'boss');
    expect(prisma.userRole.upsert).toHaveBeenCalled();
  });

  it('lets a non-SuperAdmin with roles.assign manage ordinary roles', async () => {
    const { service, prisma } = setup({
      superAdmins: [],
      otherActiveSuperAdmins: 1,
    });

    await service.assignRole('target', CLIENT_ROLE.id, 'manager');
    expect(prisma.userRole.upsert).toHaveBeenCalled();
  });

  it('refuses to remove the SuperAdmin role from the last active SuperAdmin', async () => {
    const { service, prisma } = setup({
      superAdmins: ['boss'],
      otherActiveSuperAdmins: 0,
    });

    await expect(
      service.setRoles('target', [CLIENT_ROLE.id], 'boss'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.userRole.deleteMany).not.toHaveBeenCalled();
  });

  it('refuses to deactivate the last active SuperAdmin', async () => {
    const { service, prisma, superAdminAbility } = setup({
      superAdmins: ['boss'],
      otherActiveSuperAdmins: 0,
    });

    await expect(
      service.setStatus('target', false, await superAdminAbility(), 'boss'),
    ).rejects.toThrow(/last active SuperAdmin/);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses to let anyone change their own status', async () => {
    const { service, prisma, superAdminAbility } = setup({
      superAdmins: ['boss'],
      otherActiveSuperAdmins: 3,
    });

    await expect(
      service.setStatus('boss', false, await superAdminAbility(), 'boss'),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
