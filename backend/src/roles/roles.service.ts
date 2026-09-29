import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionSyncService } from '../access/permission-sync.service';
import { isPermissionName } from '../access/access.config';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Prisma } from '../../generated/prisma/client';

const ROLE_INCLUDE = {
  rolePermissions: { include: { permission: true } },
  defaultRole: true,
  _count: { select: { userRoles: true } },
} satisfies Prisma.RoleInclude;

type RoleWithRelations = Prisma.RoleGetPayload<{
  include: typeof ROLE_INCLUDE;
}>;

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionSync: PermissionSyncService,
  ) {}

  async create(dto: CreateRoleDto) {
    const { permissions, ...data } = dto;
    try {
      const role = await this.prisma.$transaction(async (tx) => {
        const permissionIds = await this.permissionSync.resolveNames(
          permissions ?? [],
          tx,
        );
        const created = await tx.role.create({ data });
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId: created.id,
            permissionId,
          })),
        });
        return created;
      });
      return this.findOne(role.id);
    } catch (error) {
      throw this.mapNameConflict(error, dto.name);
    }
  }

  async findAll() {
    const roles = await this.prisma.role.findMany({
      include: ROLE_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return roles.map((role) => this.shape(role));
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: ROLE_INCLUDE,
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return this.shape(role);
  }

  async update(id: string, dto: UpdateRoleDto) {
    const existing = await this.findOne(id);
    const { permissions, ...data } = dto;
    if (existing.isSuperAdmin && permissions !== undefined) {
      throw new BadRequestException(
        'The SuperAdmin role bypasses all permission checks — it cannot be given a permission list',
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.role.update({ where: { id }, data });
        if (permissions === undefined) return;

        const permissionIds = await this.permissionSync.resolveNames(
          permissions,
          tx,
        );
        // Only config-named permissions are replaced; legacy unnamed rows the role already
        // holds aren't in the picker, so they're left alone rather than silently revoked.
        await tx.rolePermission.deleteMany({
          where: {
            roleId: id,
            permission: { name: { not: null } },
            permissionId: { notIn: permissionIds },
          },
        });
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId: id,
            permissionId,
          })),
          skipDuplicates: true,
        });
      });
    } catch (error) {
      throw this.mapNameConflict(error, dto.name);
    }
    return this.findOne(id);
  }

  async remove(id: string) {
    const role = await this.findOne(id);
    if (role.isSuperAdmin) {
      throw new ForbiddenException('The SuperAdmin role cannot be deleted');
    }
    if (role.isDefault) {
      throw new BadRequestException(
        'This is the default role for new registrations — make another role the default before deleting it',
      );
    }
    await this.prisma.role.delete({ where: { id } });
    return role;
  }

  /** Legacy single-permission attach (POST /roles/:id/permissions). Only permissions that are
   * defined in the access config can be attached. */
  async attachPermission(roleId: string, permissionId: string) {
    const role = await this.findOne(roleId);
    if (role.isSuperAdmin) {
      throw new BadRequestException(
        'The SuperAdmin role bypasses all permission checks — it cannot be given permissions',
      );
    }
    const permission = await this.prisma.permission.findUnique({
      where: { id: permissionId },
    });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }
    if (!permission.name || !isPermissionName(permission.name)) {
      throw new BadRequestException(
        'This permission is not defined in the access config and cannot be assigned',
      );
    }
    return this.prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      update: {},
      create: { roleId, permissionId },
    });
  }

  async detachPermission(roleId: string, permissionId: string) {
    await this.prisma.rolePermission
      .delete({ where: { roleId_permissionId: { roleId, permissionId } } })
      .catch(() => undefined);
  }

  /** Makes `roleId` the single default role assigned to every user after the first. The
   * DefaultRole table is a pinned-primary-key singleton (id is always 1), so this upsert is
   * the only way this pointer is ever written — a second row can never exist. */
  async setDefault(roleId: string) {
    const role = await this.findOne(roleId);
    if (role.isSuperAdmin) {
      throw new BadRequestException(
        'The SuperAdmin role cannot be the default role — every new registrant would get full access',
      );
    }
    return this.prisma.defaultRole.upsert({
      where: { id: 1 },
      update: { roleId },
      create: { id: 1, roleId },
    });
  }

  private shape(role: RoleWithRelations) {
    const { rolePermissions, _count, ...rest } = role;
    return {
      ...rest,
      isDefault: role.defaultRole !== null,
      userCount: _count.userRoles,
      permissions: rolePermissions
        .map(({ permission }) => permission.name)
        .filter((name): name is string => name !== null),
    };
  }

  private mapNameConflict(error: unknown, name: string | undefined) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(`A role named "${name}" already exists`);
    }
    return error;
  }
}
