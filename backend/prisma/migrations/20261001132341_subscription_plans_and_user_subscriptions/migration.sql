-- AlterTable
ALTER TABLE `exam_attempts` ADD COLUMN `userSubscriptionId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `transactions` ADD COLUMN `note` TEXT NULL,
    ADD COLUMN `performedById` VARCHAR(191) NULL,
    MODIFY `type` ENUM('TOPUP', 'EXAM_FEE', 'REFUND', 'PLAN_PURCHASE', 'ADMIN_ADJUSTMENT') NOT NULL;

-- CreateTable
CREATE TABLE `subscription_plans` (
    `id` VARCHAR(191) NOT NULL,
    `name` JSON NOT NULL,
    `extraFeatures` JSON NULL,
    `price` INTEGER NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'RWF',
    `accessType` ENUM('ATTEMPTS', 'TIME') NOT NULL,
    `attemptLimit` INTEGER NULL,
    `durationDays` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isMostPopular` BOOLEAN NOT NULL DEFAULT false,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `subscription_plans_isActive_displayOrder_idx`(`isActive`, `displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NULL,
    `planName` JSON NOT NULL,
    `price` INTEGER NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'RWF',
    `accessType` ENUM('ATTEMPTS', 'TIME') NOT NULL,
    `attemptLimit` INTEGER NULL,
    `durationDays` INTEGER NULL,
    `attemptsRemaining` INTEGER NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'EXHAUSTED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `source` ENUM('PURCHASE', 'ADMIN_GRANT', 'MIGRATION') NOT NULL DEFAULT 'PURCHASE',
    `startsAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `transactionId` VARCHAR(191) NULL,
    `grantedById` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_subscriptions_transactionId_key`(`transactionId`),
    INDEX `user_subscriptions_userId_accessType_startsAt_expiresAt_idx`(`userId`, `accessType`, `startsAt`, `expiresAt`),
    INDEX `user_subscriptions_userId_accessType_attemptsRemaining_idx`(`userId`, `accessType`, `attemptsRemaining`),
    INDEX `user_subscriptions_planId_idx`(`planId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `exam_attempts_userSubscriptionId_idx` ON `exam_attempts`(`userSubscriptionId`);

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_performedById_fkey` FOREIGN KEY (`performedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `subscription_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `transactions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_grantedById_fkey` FOREIGN KEY (`grantedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_attempts` ADD CONSTRAINT `exam_attempts_userSubscriptionId_fkey` FOREIGN KEY (`userSubscriptionId`) REFERENCES `user_subscriptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
