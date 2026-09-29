-- Config-driven permissions + user deactivation. Purely additive: no rows are dropped or
-- rewritten here. permissions.name starts NULL and is backfilled by PermissionSyncService on
-- app startup (matching existing rows by action + subject + conditions, so every existing
-- role_permissions link is kept). users.phone becomes unique — fails loudly if a database
-- still has duplicate phones; resolve those first rather than editing user data here.

-- AlterTable
ALTER TABLE `permissions` ADD COLUMN `name` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX `permissions_name_key` ON `permissions`(`name`);

-- CreateIndex
CREATE UNIQUE INDEX `users_phone_key` ON `users`(`phone`);

