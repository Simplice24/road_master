-- AlterTable
ALTER TABLE `exam_attempts` ADD COLUMN `categoryId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `exam_configs` MODIFY `passMarkPercent` INTEGER NOT NULL DEFAULT 60,
    MODIFY `durationMinutes` INTEGER NOT NULL DEFAULT 20;

-- AddForeignKey
ALTER TABLE `exam_attempts` ADD CONSTRAINT `exam_attempts_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
