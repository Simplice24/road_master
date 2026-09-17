import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { Prisma, User } from '../../generated/prisma/client';

export interface CreateUserInput {
  fullName: string;
  email?: string;
  phone: string;
  password: string;
}

// A label for the admin UI only — never queried or compared against. The bootstrap logic
// below finds this role by its `isSuperAdmin` flag, not by this name.
const SUPER_ADMIN_ROLE_NAME = 'SuperAdmin';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  /**
   * The single code path all user creation goes through (self-registration, seed scripts,
   * future admin-invite flows). Handles the first-user SuperAdmin bootstrap and the
   * default-role assignment for every user after that.
   */
  async create(input: CreateUserInput): Promise<User> {
    const passwordHash = await bcrypt.hash(input.password, 10);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const isFirstUser = (await tx.user.count()) === 0;

          const user = await tx.user.create({
            data: {
              fullName: input.fullName,
              email: input.email,
              phone: input.phone,
              passwordHash,
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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A user with this email already exists');
      }
      throw error;
    }
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async listRoles(userId: string) {
    await this.ensureExists(userId);
    return this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
  }

  async assignRole(userId: string, roleId: string) {
    await this.ensureExists(userId);
    return this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId },
    });
  }

  async unassignRole(userId: string, roleId: string) {
    await this.prisma.userRole
      .delete({ where: { userId_roleId: { userId, roleId } } })
      .catch(() => undefined);
  }

  /** The user's final computed permission set, resolved through CASL — useful for debugging
   * and for the frontend to conditionally render UI without re-implementing the ability logic. */
  async getEffectivePermissions(userId: string) {
    await this.ensureExists(userId);
    const ability = await this.caslAbilityFactory.createForUser({ id: userId });
    return ability.rules;
  }

  private async ensureExists(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
  }
}
