import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CaslAbilityFactory, AppAbility } from '../casl/casl-ability.factory';
import { Prisma } from '../../generated/prisma/client';
import { accessibleBy } from '@casl/prisma';
import { assertFieldsAllowed } from '../casl/policy-assertions';
import {
  PERMISSION_DEFINITIONS,
  isPermissionName,
} from '../access/access.config';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';

export interface CreateUserInput {
  fullName: string;
  email?: string;
  phone: string;
  password: string;
  /** Explicit roles (admin-created users). When omitted, the first-user/DefaultRole
   * bootstrap below decides. */
  roleIds?: string[];
  isActive?: boolean;
}

// A label for the admin UI only — never queried or compared against. The bootstrap logic
// below finds this role by its `isSuperAdmin` flag, not by this name.
const SUPER_ADMIN_ROLE_NAME = 'SuperAdmin';

const USER_FIELDS = ['fullName', 'email', 'phone'];

const ROLE_SUMMARY = {
  select: { id: true, name: true, isSuperAdmin: true },
} as const;

type Tx = Prisma.TransactionClient;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  /**
   * The single code path all user creation goes through (self-registration, admin creation,
   * seed scripts). Handles the first-user SuperAdmin bootstrap and the default-role
   * assignment for every user after that, unless explicit `roleIds` are given.
   */
  async create(input: CreateUserInput) {
    const passwordHash = await bcrypt.hash(input.password, 10);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.assertPhoneAvailable(tx, input.phone);
          const isFirstUser = (await tx.user.count()) === 0;

          const user = await tx.user.create({
            data: {
              fullName: input.fullName,
              email: input.email,
              phone: input.phone,
              passwordHash,
              isActive: input.isActive ?? true,
            },
          });

          if (isFirstUser) {
            let superAdminRole = await tx.role.findFirst({
              where: { isSuperAdmin: true },
            });
            if (!superAdminRole) {
              superAdminRole = await tx.role.create({
                data: {
                  name: SUPER_ADMIN_ROLE_NAME,
                  isSuperAdmin: true,
                  description:
                    'Full, unrestricted access. Created automatically for the first registered user.',
                },
              });
            }
            await tx.userRole.create({
              data: { userId: user.id, roleId: superAdminRole.id },
            });
          } else if (input.roleIds && input.roleIds.length > 0) {
            await this.assertRolesExist(tx, input.roleIds);
            await tx.userRole.createMany({
              data: input.roleIds.map((roleId) => ({
                userId: user.id,
                roleId,
              })),
              skipDuplicates: true,
            });
          } else {
            const defaultRole = await tx.defaultRole.findUnique({
              where: { id: 1 },
            });
            if (!defaultRole) {
              throw new Error(
                'No default role is configured. Seed a DefaultRole (see prisma/seed.ts) before registering additional users.',
              );
            }
            await tx.userRole.create({
              data: { userId: user.id, roleId: defaultRole.roleId },
            });
          }

          return user;
        },
        // Serializable so a concurrent registration can't also observe count() === 0 before
        // either transaction commits — MySQL/InnoDB turns the count() read into a locking
        // read at this isolation level, so the second transaction blocks until the first
        // commits and then correctly sees count() === 1.
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }
  }

  /** Admin-side user creation (POST /users). Assigning roles additionally needs roles.assign,
   * and handing out a SuperAdmin role needs the caller to be a SuperAdmin. */
  async adminCreate(dto: CreateUserDto, ability: AppAbility, callerId: string) {
    if (dto.roleIds && dto.roleIds.length > 0) {
      this.assertCanAssignRoles(ability);
      await this.assertSuperAdminRoleChangeAllowed(callerId, dto.roleIds);
    }
    const user = await this.create(dto);
    return this.findWithRoles(user.id);
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByPhone(phone: string) {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  /** The one query allowed to read the password hash (opting out of the global omit) — used
   * only by AuthService to verify a login. */
  findCredentialsByPhone(phone: string) {
    return this.prisma.user.findUnique({
      where: { phone },
      select: { id: true, passwordHash: true, isActive: true },
    });
  }

  /** Backs GET /auth/me: the caller's profile + roles + effective permission names. */
  async getAccessProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: { select: { name: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { userRoles, ...profile } = user;
    const roles = userRoles.map(({ role }) => role);
    const isSuperAdmin = roles.some((role) => role.isSuperAdmin);
    const permissions = isSuperAdmin
      ? PERMISSION_DEFINITIONS.map((definition) => definition.name)
      : [
          ...new Set(
            roles.flatMap((role) =>
              role.rolePermissions
                .map((rolePermission) => rolePermission.permission.name)
                .filter(
                  (name): name is string => !!name && isPermissionName(name),
                ),
            ),
          ),
        ];

    return {
      ...profile,
      roles: roles.map(({ id, name, isSuperAdmin: flag }) => ({
        id,
        name,
        isSuperAdmin: flag,
      })),
      isSuperAdmin,
      permissions,
    };
  }

  async userProfile(id: string, ability: AppAbility) {
    const where: Prisma.UserWhereInput = {
      AND: [{ id }, accessibleBy(ability, 'read').ofType('User')],
    };
    const user = await this.prisma.user.findFirst({ where });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateUser(id: string, data: UpdateUserDto, ability: AppAbility) {
    assertFieldsAllowed(
      ability,
      'update',
      'User',
      USER_FIELDS,
      Object.keys(data),
    );

    const where: Prisma.UserWhereInput = {
      AND: [{ id }, accessibleBy(ability, 'update').ofType('User')],
    };
    const user = await this.prisma.user.findFirst({ where });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (data.phone && data.phone !== user.phone) {
      await this.assertPhoneAvailable(this.prisma, data.phone);
    }

    try {
      return await this.prisma.user.update({ where: { id }, data });
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }
  }

  async listUsers(ability: AppAbility) {
    const where: Prisma.UserWhereInput = accessibleBy(ability, 'read').ofType(
      'User',
    );
    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { userRoles: { include: { role: ROLE_SUMMARY } } },
    });
    return users.map(({ userRoles, ...user }) => ({
      ...user,
      roles: userRoles.map(({ role }) => role),
    }));
  }

  /** Activates/deactivates a user. Nobody can change their own status (no self-lockout, and an
   * own-profile-only `users.updateOwn` can't be used to flip it), and the last active SuperAdmin
   * can't be deactivated. */
  async setStatus(
    id: string,
    isActive: boolean,
    ability: AppAbility,
    callerId: string,
  ) {
    if (id === callerId) {
      throw new ForbiddenException('You cannot change your own account status');
    }
    const where: Prisma.UserWhereInput = {
      AND: [{ id }, accessibleBy(ability, 'update').ofType('User')],
    };
    const user = await this.prisma.user.findFirst({
      where,
      include: { userRoles: { include: { role: ROLE_SUMMARY } } },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const targetIsSuperAdmin = user.userRoles.some(
      ({ role }) => role.isSuperAdmin,
    );
    if (targetIsSuperAdmin && !(await this.isSuperAdmin(callerId))) {
      throw new ForbiddenException(
        'Only a SuperAdmin can change the status of a SuperAdmin',
      );
    }
    if (!isActive && targetIsSuperAdmin) {
      await this.assertAnotherActiveSuperAdmin(this.prisma, id);
    }

    await this.prisma.user.update({ where: { id }, data: { isActive } });
    return this.findWithRoles(id);
  }

  async listRoles(userId: string, ability: AppAbility) {
    await this.ensureExists(userId);
    const where: Prisma.UserRoleWhereInput = {
      AND: [{ userId }, accessibleBy(ability, 'read').ofType('Role')],
    };
    return this.prisma.userRole.findMany({
      where,
      include: { role: true },
    });
  }

  async assignRole(userId: string, roleId: string, callerId: string) {
    await this.ensureExists(userId);
    await this.assertRolesExist(this.prisma, [roleId]);
    await this.assertSuperAdminRoleChangeAllowed(callerId, [roleId]);
    return this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId },
    });
  }

  async unassignRole(userId: string, roleId: string, callerId: string) {
    await this.assertSuperAdminRoleChangeAllowed(callerId, [roleId]);
    await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({ where: { id: roleId } });
      if (role?.isSuperAdmin) {
        await this.assertAnotherActiveSuperAdmin(tx, userId);
      }
      await tx.userRole.deleteMany({ where: { userId, roleId } });
    });
  }

  /** Replaces a user's full role set in one transaction (PUT /users/:id/roles). */
  async setRoles(userId: string, roleIds: string[], callerId: string) {
    await this.ensureExists(userId);
    const current = await this.prisma.userRole.findMany({ where: { userId } });
    const currentIds = current.map((userRole) => userRole.roleId);
    const changed = [
      ...roleIds.filter((id) => !currentIds.includes(id)),
      ...currentIds.filter((id) => !roleIds.includes(id)),
    ];
    await this.assertSuperAdminRoleChangeAllowed(callerId, changed);

    await this.prisma.$transaction(async (tx) => {
      await this.assertRolesExist(tx, roleIds);
      const removed = currentIds.filter((id) => !roleIds.includes(id));
      if (removed.length > 0) {
        const losesSuperAdmin = await tx.role.count({
          where: { id: { in: removed }, isSuperAdmin: true },
        });
        const keepsSuperAdmin = await tx.role.count({
          where: { id: { in: roleIds }, isSuperAdmin: true },
        });
        if (losesSuperAdmin > 0 && keepsSuperAdmin === 0) {
          await this.assertAnotherActiveSuperAdmin(tx, userId);
        }
        await tx.userRole.deleteMany({
          where: { userId, roleId: { in: removed } },
        });
      }
      await tx.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId, roleId })),
        skipDuplicates: true,
      });
    });
    return this.findWithRoles(userId);
  }

  /** The user's final computed permission set, resolved through CASL — useful for debugging
   * and for the frontend to conditionally render UI without re-implementing the ability logic. */
  async getEffectivePermissions(userId: string) {
    await this.ensureExists(userId);
    const ability = await this.caslAbilityFactory.createForUser({ id: userId });
    return ability.rules;
  }

  private async findWithRoles(id: string) {
    const { userRoles, ...user } = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { userRoles: { include: { role: ROLE_SUMMARY } } },
    });
    return { ...user, roles: userRoles.map(({ role }) => role) };
  }

  private assertCanAssignRoles(ability: AppAbility) {
    if (!ability.can('manage', 'UserRole')) {
      throw new ForbiddenException(
        'You do not have permission to assign roles',
      );
    }
  }

  private async isSuperAdmin(userId: string) {
    const count = await this.prisma.userRole.count({
      where: { userId, role: { isSuperAdmin: true } },
    });
    return count > 0;
  }

  /** Granting or revoking a SuperAdmin role is itself a SuperAdmin-only action — otherwise
   * anyone with roles.assign could escalate to full access. */
  private async assertSuperAdminRoleChangeAllowed(
    callerId: string,
    roleIds: string[],
  ) {
    if (roleIds.length === 0) return;
    const touchesSuperAdmin = await this.prisma.role.count({
      where: { id: { in: roleIds }, isSuperAdmin: true },
    });
    if (touchesSuperAdmin > 0 && !(await this.isSuperAdmin(callerId))) {
      throw new ForbiddenException(
        'Only a SuperAdmin can assign or remove the SuperAdmin role',
      );
    }
  }

  /** Blocks any change that would leave the system with no active SuperAdmin. */
  private async assertAnotherActiveSuperAdmin(
    client: Tx | PrismaService,
    excludingUserId: string,
  ) {
    const others = await client.user.count({
      where: {
        id: { not: excludingUserId },
        isActive: true,
        userRoles: { some: { role: { isSuperAdmin: true } } },
      },
    });
    if (others === 0) {
      throw new BadRequestException(
        'This is the last active SuperAdmin — assign the SuperAdmin role to another active user first',
      );
    }
  }

  private async assertRolesExist(
    client: Tx | PrismaService,
    roleIds: string[],
  ) {
    const unique = [...new Set(roleIds)];
    const found = await client.role.count({ where: { id: { in: unique } } });
    if (found !== unique.length) {
      throw new BadRequestException('One or more roles do not exist');
    }
  }

  private async assertPhoneAvailable(
    client: Tx | PrismaService,
    phone: string,
  ) {
    const existing = await client.user.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'A user with this phone number already exists',
      );
    }
  }

  private mapUniqueViolation(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(
        'A user with this phone number or email already exists',
      );
    }
    return error;
  }

  private async ensureExists(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
  }
}
