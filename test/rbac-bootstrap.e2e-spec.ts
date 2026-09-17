import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { subject } from '@casl/ability';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { UsersService } from '../src/users/users.service';
import { CaslAbilityFactory } from '../src/casl/casl-ability.factory';

/**
 * Requires a real, reachable MySQL database at DATABASE_URL (see .env / prisma/schema.prisma).
 * Run with `npm run test:e2e` after `npx prisma migrate dev`.
 */
describe('RBAC bootstrap (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let usersService: UsersService;
  let caslAbilityFactory: CaslAbilityFactory;
  let clientRoleId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    usersService = app.get(UsersService);
    caslAbilityFactory = app.get(CaslAbilityFactory);

    // Clean slate — deletion order respects FK constraints.
    await prisma.userRole.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.defaultRole.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();

    const clientRole = await prisma.role.create({
      data: { name: 'client', description: 'test default role' },
    });
    clientRoleId = clientRole.id;

    const readOwnExamAttempt = await prisma.permission.create({
      data: {
        action: 'read',
        subject: 'ExamAttempt',
        conditions: { userId: '${user.id}' },
      },
    });
    await prisma.rolePermission.create({
      data: { roleId: clientRole.id, permissionId: readOwnExamAttempt.id },
    });

    await prisma.defaultRole.create({ data: { id: 1, roleId: clientRole.id } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('gives the first created user a SuperAdmin role with full access and zero Permission rows', async () => {
    const firstUser = await usersService.create({
      fullName: 'First User',
      email: 'first@example.com',
      phone: '0000000001',
      password: 'password123',
    });

    const userRoles = await prisma.userRole.findMany({
      where: { userId: firstUser.id },
      include: { role: true },
    });
    expect(userRoles).toHaveLength(1);
    expect(userRoles[0].role.isSuperAdmin).toBe(true);

    const permissionCount = await prisma.rolePermission.count({
      where: { roleId: userRoles[0].role.id },
    });
    expect(permissionCount).toBe(0);

    const ability = await caslAbilityFactory.createForUser({
      id: firstUser.id,
    });
    expect(ability.can('manage', 'all')).toBe(true);
    expect(ability.can('delete', 'ExamAttempt')).toBe(true);
  });

  it("gives every user after the first the DefaultRole role, scoped to that role's permissions", async () => {
    const secondUser = await usersService.create({
      fullName: 'Second User',
      email: 'second@example.com',
      phone: '0000000002',
      password: 'password123',
    });

    const userRoles = await prisma.userRole.findMany({
      where: { userId: secondUser.id },
      include: { role: true },
    });
    expect(userRoles).toHaveLength(1);
    expect(userRoles[0].roleId).toBe(clientRoleId);
    expect(userRoles[0].role.isSuperAdmin).toBe(false);

    const ability = await caslAbilityFactory.createForUser({
      id: secondUser.id,
    });
    expect(ability.can('manage', 'all')).toBe(false);
    expect(ability.can('delete', 'ExamAttempt')).toBe(false);

    // Row-level condition: can read their OWN ExamAttempt, not someone else's.
    expect(
      ability.can('read', subject('ExamAttempt', { userId: secondUser.id })),
    ).toBe(true);
    expect(
      ability.can('read', subject('ExamAttempt', { userId: 'someone-else' })),
    ).toBe(false);
  });

  it('never allows a second DefaultRole row to be inserted', async () => {
    const otherRole = await prisma.role.create({
      data: { name: 'other-role-for-pk-test' },
    });
    await expect(
      prisma.defaultRole.create({ data: { id: 1, roleId: otherRole.id } }),
    ).rejects.toThrow();
  });
});
