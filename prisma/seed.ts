import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { Prisma, PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL as string) });

interface SeedPermission {
  action: string;
  subject: string;
  conditions?: Record<string, unknown>;
  description: string;
}

// Small, read/self-scoped set for the default "client" role — the exam candidate persona
// every self-registered user other than the first lands in via the DefaultRole pointer.
const CLIENT_PERMISSIONS: SeedPermission[] = [
  { action: 'read', subject: 'Question', description: 'Browse exam questions' },
  { action: 'read', subject: 'Category', description: 'Browse question categories' },
  { action: 'read', subject: 'ExamConfig', description: 'View available exam configurations' },
  { action: 'create', subject: 'ExamAttempt', description: 'Start a new exam attempt' },
  {
    action: 'read',
    subject: 'ExamAttempt',
    conditions: { userId: '${user.id}' },
    description: 'View own exam attempts',
  },
  {
    action: 'update',
    subject: 'ExamAttempt',
    conditions: { userId: '${user.id}' },
    description: 'Answer/submit own exam attempts',
  },
  {
    action: 'read',
    subject: 'Transaction',
    conditions: { userId: '${user.id}' },
    description: 'View own transactions',
  },
  { action: 'read', subject: 'User', conditions: { id: '${user.id}' }, description: 'View own profile' },
  { action: 'update', subject: 'User', conditions: { id: '${user.id}' }, description: 'Update own profile' },
];

async function main() {
  // "client" is a literal here because this script is *defining* the seed data, not branching
  // on a role name at request time — the running application never compares against it.
  const clientRole = await prisma.role.upsert({
    where: { name: 'client' },
    update: {},
    create: { name: 'client', description: 'Default role for every self-registered exam candidate' },
  });

  for (const seedPermission of CLIENT_PERMISSIONS) {
    const existing = await prisma.permission.findFirst({
      where: { action: seedPermission.action, subject: seedPermission.subject },
    });
    const permission =
      existing ??
      (await prisma.permission.create({
        data: {
          action: seedPermission.action,
          subject: seedPermission.subject,
          conditions: seedPermission.conditions as Prisma.InputJsonValue | undefined,
          description: seedPermission.description,
        },
      }));

    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: clientRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: clientRole.id, permissionId: permission.id },
    });
  }

  await prisma.defaultRole.upsert({
    where: { id: 1 },
    update: { roleId: clientRole.id },
    create: { id: 1, roleId: clientRole.id },
  });

  console.log(`Seeded default role "client" (${clientRole.id}) with ${CLIENT_PERMISSIONS.length} permissions.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
