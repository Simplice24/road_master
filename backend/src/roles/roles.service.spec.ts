import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PermissionSyncService } from '../access/permission-sync.service';
import { FakePermissionStore } from '../access/testing/fake-permission-store';
import type { PrismaService } from '../prisma/prisma.service';

function roleRow(
  overrides: Partial<{ id: string; isSuperAdmin: boolean; isDefault: boolean }>,
) {
  const id = overrides.id ?? 'role-1';
  return {
    id,
    name: 'Role',
    description: null,
    isSuperAdmin: overrides.isSuperAdmin ?? false,
    guardName: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    rolePermissions: [],
    defaultRole: overrides.isDefault ? { id: 1, roleId: id } : null,
    _count: { userRoles: 0 },
  };
}

function setup(role = roleRow({})) {
  const store = new FakePermissionStore();
  const tx = {
    permission: store.permission,
    role: { create: jest.fn().mockResolvedValue(role), update: jest.fn() },
    rolePermission: { createMany: jest.fn(), deleteMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
    role: {
      findUnique: jest.fn().mockResolvedValue(role),
      delete: jest.fn(),
    },
    defaultRole: { upsert: jest.fn() },
  };
  const permissionSync = new PermissionSyncService(
    prisma as unknown as PrismaService,
  );
  const service = new RolesService(
    prisma as unknown as PrismaService,
    permissionSync,
  );
  return { service, prisma, tx, store };
}

describe('RolesService', () => {
  describe('permission validation', () => {
    it('rejects a role create with permissions that are not in the access config — nothing is written', async () => {
      const { service, tx, store } = setup();

      await expect(
        service.create({
          name: 'Editors',
          permissions: ['categories.view', 'categories.obliterate'],
        }),
      ).rejects.toThrow(/Unknown permission\(s\): categories\.obliterate/);
      expect(tx.role.create).not.toHaveBeenCalled();
      expect(tx.rolePermission.createMany).not.toHaveBeenCalled();
      expect(store.writes).toBe(0);
    });

    it('upserts missing config permissions before assigning them on create', async () => {
      const { service, tx, store } = setup();

      await service.create({
        name: 'Editors',
        permissions: ['categories.create'],
      });

      const created = store.rows.find(
        (row) => row.name === 'categories.create',
      )!;
      expect(created).toBeDefined();
      expect(tx.rolePermission.createMany).toHaveBeenCalledWith({
        data: [{ roleId: 'role-1', permissionId: created.id }],
      });
    });

    it('rejects unknown permissions on update too', async () => {
      const { service, tx } = setup();

      await expect(
        service.update('role-1', { permissions: ['roles.becomeGod'] }),
      ).rejects.toThrow(BadRequestException);
      expect(tx.rolePermission.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('SuperAdmin role protection', () => {
    const superAdmin = roleRow({ id: 'sa', isSuperAdmin: true });

    it('cannot be deleted', async () => {
      const { service, prisma } = setup(superAdmin);
      await expect(service.remove('sa')).rejects.toThrow(ForbiddenException);
      expect(prisma.role.delete).not.toHaveBeenCalled();
    });

    it('cannot be given a permission list', async () => {
      const { service, tx } = setup(superAdmin);
      await expect(
        service.update('sa', { permissions: ['categories.view'] }),
      ).rejects.toThrow(BadRequestException);
      expect(tx.role.update).not.toHaveBeenCalled();
    });

    it('cannot become the default role for new registrations', async () => {
      const { service, prisma } = setup(superAdmin);
      await expect(service.setDefault('sa')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.defaultRole.upsert).not.toHaveBeenCalled();
    });

    it('can still be renamed', async () => {
      const { service, tx } = setup(superAdmin);
      await service.update('sa', { name: 'Owners' });
      expect(tx.role.update).toHaveBeenCalledWith({
        where: { id: 'sa' },
        data: { name: 'Owners' },
      });
    });

    it.each([
      ['create', CreateRoleDto, { name: 'x', isSuperAdmin: true }],
      ['create', CreateRoleDto, { name: 'x', isSuperAdmin: false }],
      ['update', UpdateRoleDto, { isSuperAdmin: false }],
      ['update', UpdateRoleDto, { isSuperAdmin: true }],
    ] as const)(
      'rejects isSuperAdmin in the %s payload (%#)',
      async (_, Dto, payload) => {
        const errors = await validate(plainToInstance(Dto, payload));
        expect(errors.map((error) => error.property)).toContain('isSuperAdmin');
      },
    );
  });

  it('refuses to delete the current default role', async () => {
    const { service, prisma } = setup(roleRow({ isDefault: true }));
    await expect(service.remove('role-1')).rejects.toThrow(BadRequestException);
    expect(prisma.role.delete).not.toHaveBeenCalled();
  });
});
