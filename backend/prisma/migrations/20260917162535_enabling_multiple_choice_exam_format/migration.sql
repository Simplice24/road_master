/*
  Warnings:

  - You are about to drop the column `selectedOptionId` on the `exam_attempt_answers` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `exam_attempt_answers` DROP FOREIGN KEY `exam_attempt_answers_selectedOptionId_fkey`;

-- DropIndex
DROP INDEX `exam_attempt_answers_selectedOptionId_fkey` ON `exam_attempt_answers`;

-- AlterTable
ALTER TABLE `exam_attempt_answers` DROP COLUMN `selectedOptionId`;

-- AlterTable
ALTER TABLE `questions` ADD COLUMN `allowMultiple` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `exam_attempt_answer_options` (
    `id` VARCHAR(191) NOT NULL,
    `answerId` VARCHAR(191) NOT NULL,
    `optionId` VARCHAR(191) NOT NULL,

    INDEX `exam_attempt_answer_options_optionId_idx`(`optionId`),
    UNIQUE INDEX `exam_attempt_answer_options_answerId_optionId_key`(`answerId`, `optionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `exam_attempt_answer_options` ADD CONSTRAINT `exam_attempt_answer_options_answerId_fkey` FOREIGN KEY (`answerId`) REFERENCES `exam_attempt_answers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_attempt_answer_options` ADD CONSTRAINT `exam_attempt_answer_options_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `options`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
