import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';
import { PermissionName } from '../src/access/access.config';
import { PermissionSyncService } from '../src/access/permission-sync.service';
import type { PrismaService } from '../src/prisma/prisma.service';

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL as string),
});

// Small, read/self-scoped set for the default "client" role — the exam candidate persona
// every self-registered user other than the first lands in via the DefaultRole pointer. Names
// come from src/access/access.config.ts; the rules behind them live there too.
const CLIENT_PERMISSIONS: PermissionName[] = [
  'questions.view',
  'categories.view',
  'examConfig.view',
  'examAttempts.start',
  'examAttempts.viewOwn',
  'examAttempts.answerOwn',
  'transactions.viewOwn',
  'transactions.topUpOwn',
  'users.viewOwn',
  'users.updateOwn',
];

async function main() {
  // "client" is a literal here because this script is *defining* the seed data, not branching
  // on a role name at request time — the running application never compares against it.
  const clientRole = await prisma.role.upsert({
    where: { name: 'client' },
    update: {},
    create: {
      name: 'client',
      description: 'Default role for every self-registered exam candidate',
    },
  });

  // Same sync the app runs on startup: creates missing config permissions (or adopts matching
  // pre-config rows), so this script works on a fresh database before the API has ever booted.
  const permissionSync = new PermissionSyncService(
    prisma as unknown as PrismaService,
  );
  await permissionSync.syncAll(prisma);
  const permissionIds = await permissionSync.resolveNames(
    CLIENT_PERMISSIONS,
    prisma,
  );

  for (const permissionId of permissionIds) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: clientRole.id, permissionId } },
      update: {},
      create: { roleId: clientRole.id, permissionId },
    });
  }

  await prisma.defaultRole.upsert({
    where: { id: 1 },
    update: { roleId: clientRole.id },
    create: { id: 1, roleId: clientRole.id },
  });

  console.log(
    `Seeded default role "client" (${clientRole.id}) with ${CLIENT_PERMISSIONS.length} permissions.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
