import { CaslAbilityFactory } from './casl-ability.factory';
import { subject } from '@casl/ability';
import type { PrismaService } from '../prisma/prisma.service';

type FakeRole = {
  isSuperAdmin: boolean;
  rolePermissions: {
    permission: {
      action: string;
      subject: string;
      conditions: unknown;
      fields: unknown;
    };
  }[];
};

function factoryFor(user: {
  id: string;
  isActive: boolean;
  roles: FakeRole[];
}) {
  const prisma = {
    user: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: user.id,
        isActive: user.isActive,
        userRoles: user.roles.map((role) => ({ role })),
      }),
    },
  };
  return new CaslAbilityFactory(prisma as unknown as PrismaService);
}

const superAdminRole: FakeRole = { isSuperAdmin: true, rolePermissions: [] };
const emptyRole: FakeRole = { isSuperAdmin: false, rolePermissions: [] };
const ownAttemptsRole: FakeRole = {
  isSuperAdmin: false,
  rolePermissions: [
    {
      permission: {
        action: 'read',
        subject: 'ExamAttempt',
        conditions: { userId: '${user.id}' },
        fields: null,
      },
    },
  ],
};

describe('CaslAbilityFactory', () => {
  it('lets a SuperAdmin do everything with zero permission rows (the bypass)', async () => {
    const ability = await factoryFor({
      id: 'u1',
      isActive: true,
      roles: [superAdminRole],
    }).createForUser({ id: 'u1' });

    expect(ability.can('manage', 'all')).toBe(true);
    expect(ability.can('delete', 'Role')).toBe(true);
    expect(ability.can('update', 'ExamConfig')).toBe(true);
    expect(ability.can('manage', 'UserRole')).toBe(true);
  });

  it('keeps the bypass when SuperAdmin is only one of several roles', async () => {
    const ability = await factoryFor({
      id: 'u1',
      isActive: true,
      roles: [emptyRole, superAdminRole],
    }).createForUser({ id: 'u1' });

    expect(ability.can('manage', 'all')).toBe(true);
  });

  it('grants nothing to a role with no permissions', async () => {
    const ability = await factoryFor({
      id: 'u2',
      isActive: true,
      roles: [emptyRole],
    }).createForUser({ id: 'u2' });

    expect(ability.rules).toHaveLength(0);
    expect(ability.can('read', 'Category')).toBe(false);
    expect(ability.can('read', 'User')).toBe(false);
  });

  it("interpolates ${user.id} so *Own permissions only match the caller's rows", async () => {
    const ability = await factoryFor({
      id: 'u3',
      isActive: true,
      roles: [ownAttemptsRole],
    }).createForUser({ id: 'u3' });

    expect(ability.can('read', subject('ExamAttempt', { userId: 'u3' }))).toBe(
      true,
    );
    expect(ability.can('read', subject('ExamAttempt', { userId: 'u4' }))).toBe(
      false,
    );
  });

  it('gives a deactivated user an empty ability — SuperAdmin included', async () => {
    const ability = await factoryFor({
      id: 'u5',
      isActive: false,
      roles: [superAdminRole, ownAttemptsRole],
    }).createForUser({ id: 'u5' });

    expect(ability.rules).toHaveLength(0);
    expect(ability.can('manage', 'all')).toBe(false);
    expect(ability.can('read', 'ExamAttempt')).toBe(false);
  });
});
